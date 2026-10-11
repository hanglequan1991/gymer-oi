import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { OverviewPage } from './OverviewPage';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { AppError } from '@/services/errors';
import type { Services } from '@/services';
import type { BookingRequest, GymerAccountStatus } from '@/types/domain';
import type { GymerDetail } from '@/services/repositories/gymerRepository';

// Mốc "bây giờ" cố định: 11/10/2026 10:00 giờ VN. Chỉ giả lập Date, timer thật để waitFor vẫn chạy.
const NOW = new Date('2026-10-11T10:00:00+07:00');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  window.history.pushState({}, '', '/');
});

const READY: GymerAccountStatus = { isListed: true, acceptsRequests: true, hasLocation: true };

function detail(overrides: Partial<GymerDetail['gymer']> = {}): GymerDetail {
  return {
    gymer: {
      id: 'g1',
      name: 'Minh Anh',
      gender: 'female',
      age: 28,
      area: 'Quận 1',
      distanceKm: 1.2,
      rating: 4.8,
      reviewCount: 12,
      priceWeekday: 200000,
      priceWeekend: 250000,
      tags: [],
      bio: '',
      ...overrides,
    },
    certificates: [],
    reviews: [],
  };
}

function req(
  id: string,
  status: BookingRequest['status'],
  start: string,
  end: string,
  extra: Partial<BookingRequest> = {},
): BookingRequest {
  return { id, customerName: `Khách ${id}`, start, end, price: 200000, status, ...extra };
}

interface Setup {
  list?: BookingRequest[];
  listError?: AppError;
  profile?: GymerDetail;
  status?: GymerAccountStatus;
  hang?: boolean;
}

function renderOverview(setup: Setup = {}) {
  const listFn = setup.listError
    ? vi.fn().mockRejectedValue(setup.listError)
    : setup.hang
      ? vi.fn(() => new Promise<BookingRequest[]>(() => {}))
      : vi.fn().mockResolvedValue(setup.list ?? []);
  const services = createStubServices({
    profile: {
      getMyStatus: vi.fn().mockResolvedValue(setup.status ?? READY),
      getMine: vi.fn().mockResolvedValue(setup.profile ?? detail()),
    },
    requests: { list: listFn as unknown as Services['requests']['list'] },
  });
  return renderPage(<OverviewPage />, { services, route: '/gymer/overview' });
}

/** Giá trị của một thẻ thống kê (phần số, không gồm nhãn). */
function statValue(testId: string): string {
  return screen.getByTestId(testId).querySelector('.gy-stat-card__value')?.textContent ?? '';
}

describe('OverviewPage: tải và lỗi', () => {
  it('đang tải: hiện trạng thái loading và tiêu đề luôn có', async () => {
    renderOverview({ hang: true });
    expect(screen.getByTestId('page-header')).toHaveTextContent('Tổng quan');
    expect(await screen.findByRole('status')).toHaveTextContent('Đang tải...');
  });

  it('lỗi tải dữ liệu: hiện thông báo lỗi có nút thử lại', async () => {
    renderOverview({ listError: new AppError('NETWORK', 'mất mạng') });
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByTestId('page-header')).toHaveTextContent('Tổng quan');
  });
});

describe('OverviewPage: số liệu và lời chào', () => {
  it('hiện lời chào và ba thống kê đúng với dữ liệu', async () => {
    renderOverview({
      list: [
        req('p1', 'pending', '2026-10-12T09:00:00+07:00', '2026-10-12T10:00:00+07:00'),
        req('p2', 'pending', '2026-10-13T09:00:00+07:00', '2026-10-13T10:00:00+07:00'),
        req('c1', 'confirmed', '2026-10-12T17:00:00+07:00', '2026-10-12T18:00:00+07:00'),
      ],
    });
    expect(await screen.findByText('Xin chào, Minh Anh')).toBeInTheDocument();
    expect(statValue('stat-pending')).toBe('2');
    expect(statValue('stat-upcoming')).toBe('1');
    expect(statValue('stat-rating')).toBe('4.8 (12)');
  });

  it('chưa có đánh giá (reviewCount = 0) hiện "Chưa có", không hiện 0.0', async () => {
    renderOverview({ profile: detail({ rating: 0, reviewCount: 0 }) });
    await screen.findByText('Xin chào, Minh Anh');
    expect(statValue('stat-rating')).toBe('Chưa có');
  });
});

describe('OverviewPage: hôm nay', () => {
  it('không có buổi hôm nay thì hiện dòng nhắc', async () => {
    renderOverview({
      list: [req('c1', 'confirmed', '2026-10-12T17:00:00+07:00', '2026-10-12T18:00:00+07:00')],
    });
    expect(await screen.findByText('Hôm nay bạn chưa có lịch.')).toBeInTheDocument();
  });

  it('hiện buổi đã xác nhận trong ngày VN, gồm buổi 23:30 UTC hôm trước; bỏ qua buổi chưa xác nhận', async () => {
    renderOverview({
      list: [
        req('edge', 'confirmed', '2026-10-10T23:30:00Z', '2026-10-11T00:30:00Z', { customerName: 'An', goal: 'Giảm mỡ' }),
        req('pend', 'pending', '2026-10-11T15:00:00+07:00', '2026-10-11T16:00:00+07:00', { customerName: 'Bình' }),
      ],
    });
    const time = await screen.findByText('06:30');
    expect(time.closest('li')).toHaveTextContent('An');
    expect(time.closest('li')).toHaveTextContent('Giảm mỡ');
    expect(screen.queryByText('Hôm nay bạn chưa có lịch.')).not.toBeInTheDocument();
    // Bình là yêu cầu chờ duyệt: chỉ nằm ở mục chờ duyệt, không lẫn vào Hôm nay.
    expect(time.closest('ul')).not.toHaveTextContent('Bình');
  });
});

describe('OverviewPage: yêu cầu chờ duyệt', () => {
  it('chỉ hiện tối đa 3 yêu cầu, không có nút duyệt, và có nút Xem tất cả', async () => {
    const pending = [1, 2, 3, 4].map((i) =>
      req(`p${i}`, 'pending', `2026-10-${12 + i}T09:00:00+07:00`, `2026-10-${12 + i}T10:00:00+07:00`),
    );
    renderOverview({ list: pending });
    await screen.findByText('Xin chào, Minh Anh');
    const items = screen.getAllByRole('listitem').filter((li) => li.getAttribute('aria-label')?.startsWith('Yêu cầu của'));
    expect(items).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull();
  });

  it('chưa có yêu cầu chờ duyệt thì hiện trạng thái rỗng', async () => {
    renderOverview({ list: [] });
    expect(await screen.findByText('Chưa có yêu cầu chờ duyệt.')).toBeInTheDocument();
  });

  it('bấm Xem tất cả đi tới tab Yêu cầu', async () => {
    renderOverview({ list: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Xem tất cả' }));
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/requests'));
  });
});

describe('OverviewPage: yêu cầu chờ duyệt đã quá hạn', () => {
  it('không đếm và không liệt kê yêu cầu chờ duyệt đã quá hạn xác nhận', async () => {
    renderOverview({
      list: [
        req('old', 'pending', '2026-10-12T09:00:00+07:00', '2026-10-12T10:00:00+07:00', {
          expiresAt: '2026-10-11T09:00:00+07:00',
        }),
        req('fresh', 'pending', '2026-10-13T09:00:00+07:00', '2026-10-13T10:00:00+07:00', {
          expiresAt: '2026-10-11T12:00:00+07:00',
        }),
      ],
    });
    expect(await screen.findByText('Xin chào, Minh Anh')).toBeInTheDocument();
    expect(statValue('stat-pending')).toBe('1');
    expect(screen.queryByText('Khách old')).not.toBeInTheDocument();
    expect(screen.getByText('Khách fresh')).toBeInTheDocument();
  });

  it('yêu cầu chờ duyệt không có hạn (expiresAt trống) vẫn được đếm', async () => {
    renderOverview({
      list: [req('p1', 'pending', '2026-10-13T09:00:00+07:00', '2026-10-13T10:00:00+07:00')],
    });
    expect(await screen.findByText('Xin chào, Minh Anh')).toBeInTheDocument();
    expect(statValue('stat-pending')).toBe('1');
  });
});

describe('OverviewPage: thông báo trạng thái hồ sơ', () => {
  it('hồ sơ đang ẩn: hiện cảnh báo và nút đi tới Hồ sơ', async () => {
    renderOverview({ status: { ...READY, isListed: false } });
    expect(await screen.findByText('Hồ sơ của bạn đang ẩn, khách chưa tìm thấy bạn.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở hồ sơ' }));
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/profile'));
  });

  it('chưa có vị trí: hiện cảnh báo và nút đi tới Hồ sơ', async () => {
    renderOverview({ status: { ...READY, hasLocation: false } });
    expect(await screen.findByText('Bạn chưa đặt vị trí phòng tập.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở hồ sơ' })).toBeInTheDocument();
  });

  it('hồ sơ đầy đủ thì không hiện cảnh báo nào', async () => {
    renderOverview({});
    await screen.findByText('Xin chào, Minh Anh');
    expect(screen.queryByText('Hồ sơ của bạn đang ẩn, khách chưa tìm thấy bạn.')).toBeNull();
    expect(screen.queryByText('Bạn chưa đặt vị trí phòng tập.')).toBeNull();
  });
});
