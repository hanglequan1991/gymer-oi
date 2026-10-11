import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { RequestsPage } from './RequestsPage';
import { messageFromError } from '@/i18n';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { AppError } from '@/services/errors';
import type { Services } from '@/services';
import type { BookingRequest, GymerAccountStatus } from '@/types/domain';

// jsdom không có Element.scrollTo; zmp-ui Page gọi hàm này khi mount.
beforeAll(() => {
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

const READY: GymerAccountStatus = { isListed: true, acceptsRequests: true, hasLocation: true };

/** Tạo một yêu cầu mẫu. Mặc định là chờ duyệt, bắt đầu lúc 09:00 VN. */
function req(overrides: Partial<BookingRequest> & { id: string; customerName: string }): BookingRequest {
  return {
    start: '2026-10-12T09:00:00+07:00',
    end: '2026-10-12T10:00:00+07:00',
    price: 200000,
    status: 'pending',
    ...overrides,
  };
}

type RequestsStub = Partial<Services['requests']>;

function renderRequests(requests: RequestsStub) {
  const services = createStubServices({
    profile: { getMyStatus: vi.fn().mockResolvedValue(READY) },
    requests,
  });
  return renderPage(<RequestsPage />, { services, route: '/gymer/requests' });
}

function articleNamed(name: string) {
  return screen.getByRole('article', { name: `Yêu cầu của ${name}` });
}

describe('RequestsPage: tải và lỗi', () => {
  it('hiển thị tiêu đề và "Đang tải..." khi chưa có dữ liệu', () => {
    renderRequests({ list: vi.fn(() => new Promise<BookingRequest[]>(() => {})) });
    expect(within(screen.getByTestId('page-header')).getByText('Yêu cầu')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
  });

  it('lỗi tải hiện nút "Thử lại" và bấm thì gọi lại list()', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new AppError('NETWORK', 'mất mạng'))
      .mockResolvedValueOnce([req({ id: 'r1', customerName: 'Minh' })]);
    renderRequests({ list });

    const alert = await screen.findByTestId('error-view');
    expect(alert).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByRole('article', { name: 'Yêu cầu của Minh' })).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe('RequestsPage: ba tab và lọc', () => {
  const DATA: BookingRequest[] = [
    req({ id: 'r1', customerName: 'Minh', start: '2026-10-12T09:00:00+07:00' }),
    req({ id: 'r2', customerName: 'Lan', start: '2026-10-12T07:00:00+07:00' }),
    req({ id: 'r3', customerName: 'Hùng', status: 'confirmed' }),
    req({ id: 'r4', customerName: 'Mai', status: 'rejected' }),
  ];

  it('đếm đúng số yêu cầu ở ba tab và mặc định mở tab Chờ duyệt', async () => {
    renderRequests({ list: vi.fn().mockResolvedValue(DATA) });

    expect(await screen.findByRole('radio', { name: 'Chờ duyệt (2)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Đã xác nhận (1)' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Đã từ chối (1)' })).not.toBeChecked();
  });

  it('tab Chờ duyệt chỉ hiện yêu cầu chờ, sắp theo giờ bắt đầu tăng dần', async () => {
    renderRequests({ list: vi.fn().mockResolvedValue(DATA) });
    await screen.findByRole('radio', { name: 'Chờ duyệt (2)' });

    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(names).toEqual(['Yêu cầu của Lan', 'Yêu cầu của Minh']);
  });

  it('bấm tab Đã xác nhận và Đã từ chối thì lọc đúng danh sách', async () => {
    renderRequests({ list: vi.fn().mockResolvedValue(DATA) });
    await screen.findByRole('radio', { name: 'Chờ duyệt (2)' });

    fireEvent.click(screen.getByRole('radio', { name: 'Đã xác nhận (1)' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(articleNamed('Hùng')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Đã từ chối (1)' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(articleNamed('Mai')).toBeInTheDocument();
  });

  it('mỗi tab rỗng hiện EmptyState riêng', async () => {
    renderRequests({ list: vi.fn().mockResolvedValue([]) });

    expect(await screen.findByText('Chưa có yêu cầu chờ duyệt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Đã xác nhận (0)' }));
    expect(screen.getByText('Chưa có yêu cầu đã xác nhận')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Đã từ chối (0)' }));
    expect(screen.getByText('Chưa có yêu cầu đã từ chối')).toBeInTheDocument();
  });

  it('thẻ không hiện ghi chú của khách, kể cả khi dữ liệu có ghi chú', async () => {
    renderRequests({
      list: vi.fn().mockResolvedValue([req({ id: 'r1', customerName: 'Minh', note: 'Ghi chú bí mật' })]),
    });
    await screen.findByRole('article', { name: 'Yêu cầu của Minh' });
    expect(screen.queryByText('Ghi chú bí mật')).not.toBeInTheDocument();
  });
});

describe('RequestsPage: xác nhận và từ chối', () => {
  const PENDING = [req({ id: 'r1', customerName: 'Minh' })];

  it('bấm Xác nhận gọi respond(id, confirmed), báo thành công và tải lại', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(PENDING)
      .mockResolvedValueOnce([req({ id: 'r1', customerName: 'Minh', status: 'confirmed' })]);
    const respond = vi.fn().mockResolvedValue({ ...PENDING[0], status: 'confirmed' });
    renderRequests({ list, respond });

    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    expect(respond).toHaveBeenCalledWith('r1', 'confirmed');
    expect(await screen.findByText('Đã xác nhận yêu cầu.')).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it('bấm Từ chối mở hộp thoại; Quay lại thì không gọi respond', async () => {
    const respond = vi.fn();
    renderRequests({ list: vi.fn().mockResolvedValue(PENDING), respond });

    fireEvent.click(await screen.findByRole('button', { name: 'Từ chối' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Từ chối yêu cầu này?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(respond).not.toHaveBeenCalled();
  });

  it('xác nhận từ chối trong hộp thoại gọi respond(id, rejected)', async () => {
    const respond = vi.fn().mockResolvedValue({ ...PENDING[0], status: 'rejected' });
    renderRequests({ list: vi.fn().mockResolvedValue(PENDING), respond });

    fireEvent.click(await screen.findByRole('button', { name: 'Từ chối' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));

    expect(respond).toHaveBeenCalledWith('r1', 'rejected');
    expect(await screen.findByText('Đã từ chối yêu cầu.')).toBeInTheDocument();
  });

  it('bấm đúp Xác nhận nhanh chỉ gọi respond một lần', async () => {
    const respond = vi.fn(() => new Promise<BookingRequest>(() => {}));
    renderRequests({ list: vi.fn().mockResolvedValue(PENDING), respond });

    const button = await screen.findByRole('button', { name: 'Xác nhận' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(respond).toHaveBeenCalledTimes(1);
  });

  it('BOOKING_EXPIRED: báo đúng câu lỗi ngữ cảnh requestRespond và tải lại danh sách', async () => {
    const err = new AppError('BOOKING_EXPIRED', 'hết hạn');
    const list = vi.fn().mockResolvedValue(PENDING);
    renderRequests({ list, respond: vi.fn().mockRejectedValue(err) });

    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText(messageFromError(err, 'requestRespond'))).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it.each(['FORBIDDEN', 'NOT_FOUND'] as const)('%s: báo lỗi và tải lại danh sách', async (code) => {
    const err = new AppError(code, 'lỗi nghiệp vụ');
    const list = vi.fn().mockResolvedValue(PENDING);
    renderRequests({ list, respond: vi.fn().mockRejectedValue(err) });

    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText(messageFromError(err, 'requestRespond'))).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it('lỗi mạng khi xác nhận chỉ báo lỗi, không tải lại danh sách', async () => {
    const err = new AppError('NETWORK', 'mất mạng');
    const list = vi.fn().mockResolvedValue(PENDING);
    renderRequests({ list, respond: vi.fn().mockRejectedValue(err) });

    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText(messageFromError(err, 'requestRespond'))).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
  });
});
