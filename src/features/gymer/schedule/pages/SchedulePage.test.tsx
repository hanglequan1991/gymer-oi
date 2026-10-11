import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { SchedulePage } from './SchedulePage';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { AppError } from '@/services/errors';
import type { Services } from '@/services';
import type { DayInfo, GymerAccountStatus, Slot } from '@/types/domain';
import type { GymerDetail } from '@/services/repositories/gymerRepository';

// Mốc "bây giờ" cố định: 11/10/2026 (CN). Chỉ giả lập Date, timer thật để waitFor vẫn chạy.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T10:00:00+07:00'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  window.history.pushState({}, '', '/');
});

const READY: GymerAccountStatus = { isListed: true, acceptsRequests: true, hasLocation: true };

function detail(): GymerDetail {
  return {
    gymer: {
      id: 'g1',
      name: 'Minh Anh',
      gender: 'female',
      age: 28,
      area: 'Quận 1',
      distanceKm: 0.5,
      rating: 4.8,
      reviewCount: 12,
      priceWeekday: 350000,
      priceWeekend: 420000,
      tags: ['Gym'],
      bio: '',
    },
    certificates: [],
    reviews: [],
  };
}

/** Tháng 10/2026: ngày 17 có lịch đặt, ngày 18 có khung trống, ngày 1 không có gì. */
const MONTH_DAYS: DayInfo[] = [
  { date: new Date(2026, 9, 1), marker: 'none' },
  { date: new Date(2026, 9, 17), marker: 'booked', price: 350000 },
  { date: new Date(2026, 9, 18), marker: 'open', price: 350000 },
];

const SLOTS_17: Slot[] = [
  { id: '2026-10-17T07:00', time: '07:00', state: 'available' },
  { id: '2026-10-17T08:00', time: '08:00', state: 'closed' },
  { id: '2026-10-17T09:00', time: '09:00', state: 'booked', bookedBy: 'Lan Anh' },
];

interface Mocks {
  getMine: ReturnType<typeof vi.fn>;
  getMonth: ReturnType<typeof vi.fn>;
  getDaySlots: ReturnType<typeof vi.fn>;
  setPrices: ReturnType<typeof vi.fn>;
  setSlotClosed: ReturnType<typeof vi.fn>;
}

function setup(overrides: Partial<Mocks> = {}, slots: Slot[] = SLOTS_17) {
  const mocks: Mocks = {
    getMine: vi.fn().mockResolvedValue(detail()),
    getMonth: vi.fn().mockResolvedValue(MONTH_DAYS),
    getDaySlots: vi.fn().mockResolvedValue(slots),
    setPrices: vi.fn().mockResolvedValue(undefined),
    setSlotClosed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const services: Services = createStubServices({
    profile: {
      getMyStatus: vi.fn().mockResolvedValue(READY),
      getMine: mocks.getMine,
    },
    schedule: {
      getMonth: mocks.getMonth,
      getDaySlots: mocks.getDaySlots,
      setPrices: mocks.setPrices,
      setSlotClosed: mocks.setSlotClosed,
    },
  });
  renderPage(<SchedulePage />, { services, route: '/gymer/schedule' });
  return mocks;
}

/** Chờ lịch tháng hiện ra (ô ngày 17 là một gridcell). */
async function waitCalendar() {
  return screen.findByRole('gridcell', { name: /17 tháng 10/ });
}

function priceInput(label: string) {
  return screen.getByRole('textbox', { name: label }) as HTMLInputElement;
}

describe('SchedulePage: tải và lỗi', () => {
  it('đang tải thì hiện Đang tải và tiêu đề vẫn có', async () => {
    setup({ getMine: vi.fn(() => new Promise(() => undefined)) });
    expect(await screen.findByRole('status')).toHaveTextContent('Đang tải...');
    expect(screen.getByTestId('page-header')).toHaveTextContent('Lịch và giá');
  });

  it('không có hồ sơ Gymer thì báo lỗi và tiêu đề vẫn có', async () => {
    setup({ getMine: vi.fn().mockRejectedValue(new AppError('NOT_FOUND', 'x')) });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không tìm thấy hồ sơ Gymer của bạn.');
    expect(screen.getByTestId('page-header')).toHaveTextContent('Lịch và giá');
  });
});

describe('SchedulePage: giá mặc định', () => {
  it('điền sẵn giá hiện có và nút lưu chưa bật khi chưa đổi', async () => {
    setup();
    await waitCalendar();
    expect(priceInput('Ngày thường (T2-T6)').value).toBe('350.000');
    expect(priceInput('Cuối tuần (T7-CN)').value).toBe('420.000');
    expect(screen.getByRole('button', { name: 'Lưu giá' })).toBeDisabled();
  });

  it('lưu giá mới gọi setPrices đúng đối số, báo thành công và tải lại lịch', async () => {
    const mocks = setup();
    await waitCalendar();
    fireEvent.change(priceInput('Ngày thường (T2-T6)'), { target: { value: '360000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá' }));

    expect(await screen.findByText('Đã lưu giá mặc định')).toBeInTheDocument();
    expect(mocks.setPrices).toHaveBeenCalledTimes(1);
    expect(mocks.setPrices).toHaveBeenCalledWith({ weekday: 360000, weekend: 420000 });
    await waitFor(() => expect(mocks.getMonth).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Lưu giá' })).toBeDisabled();
  });

  it('giá vượt 5.000.000đ hiện lỗi và không cho lưu', async () => {
    const mocks = setup();
    await waitCalendar();
    fireEvent.change(priceInput('Cuối tuần (T7-CN)'), { target: { value: '5000001' } });
    expect(screen.getByText('Giá phải từ 0 đến 5.000.000đ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu giá' })).toBeDisabled();
    expect(mocks.setPrices).not.toHaveBeenCalled();
  });

  it('ô giá để trống hiện lỗi cần nhập và không cho lưu', async () => {
    setup();
    await waitCalendar();
    fireEvent.change(priceInput('Ngày thường (T2-T6)'), { target: { value: '' } });
    expect(screen.getByText('Hãy nhập giá')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu giá' })).toBeDisabled();
  });

  it('lưu thất bại thì giữ giá đang nhập, nút bật lại và không báo thành công', async () => {
    const mocks = setup({
      setPrices: vi.fn().mockRejectedValue(new AppError('NETWORK', 'x')),
    });
    await waitCalendar();
    fireEvent.change(priceInput('Ngày thường (T2-T6)'), { target: { value: '360000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu giá' })).toBeEnabled());
    expect(mocks.setPrices).toHaveBeenCalledTimes(1);
    expect(priceInput('Ngày thường (T2-T6)').value).toBe('360.000');
    expect(screen.queryByText('Đã lưu giá mặc định')).not.toBeInTheDocument();
  });
});

describe('SchedulePage: lịch tháng', () => {
  it('ô ngày có ghi chú khung trống hoặc lịch đặt', async () => {
    setup();
    expect(await screen.findByRole('gridcell', { name: /17 tháng 10, .*có lịch đặt/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /18 tháng 10, .*có khung trống/ })).toBeInTheDocument();
  });

  it('bấm tháng sau thì tải đúng tháng 11/2026', async () => {
    const mocks = setup();
    await waitCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    await waitFor(() => expect(mocks.getMonth).toHaveBeenLastCalledWith('g1', 2026, 11));
  });

  it('chưa chọn ngày thì hiện gợi ý chọn ngày', async () => {
    setup();
    await waitCalendar();
    expect(screen.getByRole('status')).toHaveTextContent('Chọn một ngày trên lịch');
  });
});

describe('SchedulePage: khung giờ của một ngày', () => {
  it('chọn ngày thì tải khung giờ của đúng ngày đó và hiện các khung', async () => {
    const mocks = setup();
    fireEvent.click(await waitCalendar());
    expect(await screen.findByRole('button', { name: '07:00, còn trống' })).toBeInTheDocument();
    expect(mocks.getDaySlots).toHaveBeenCalledWith('g1', '2026-10-17');
    expect(screen.getByRole('button', { name: '08:00, đã đóng' })).toBeInTheDocument();
  });

  it('khung trống bấm thì đóng bằng setSlotClosed và đổi trạng thái ngay', async () => {
    const mocks = setup();
    fireEvent.click(await waitCalendar());
    fireEvent.click(await screen.findByRole('button', { name: '07:00, còn trống' }));

    expect(mocks.setSlotClosed).toHaveBeenCalledWith('2026-10-17T07:00', true);
    expect(await screen.findByRole('button', { name: '07:00, đã đóng' })).toBeInTheDocument();
  });

  it('khung đã đóng bấm thì mở lại bằng setSlotClosed(false)', async () => {
    const mocks = setup();
    fireEvent.click(await waitCalendar());
    fireEvent.click(await screen.findByRole('button', { name: '08:00, đã đóng' }));

    expect(mocks.setSlotClosed).toHaveBeenCalledWith('2026-10-17T08:00', false);
    expect(await screen.findByRole('button', { name: '08:00, còn trống' })).toBeInTheDocument();
  });

  it('khung đã đặt không bấm được và hiện tên khách', async () => {
    const mocks = setup();
    fireEvent.click(await waitCalendar());
    const booked = await screen.findByRole('button', { name: '09:00, đã đặt, Lan Anh' });
    expect(booked).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(booked);
    expect(mocks.setSlotClosed).not.toHaveBeenCalled();
  });

  it('đổi khung lỗi thì hoàn lại trạng thái cũ và báo lỗi', async () => {
    const mocks = setup({
      setSlotClosed: vi.fn().mockRejectedValue(new AppError('VALIDATION', 'x')),
    });
    fireEvent.click(await waitCalendar());
    fireEvent.click(await screen.findByRole('button', { name: '07:00, còn trống' }));

    expect(mocks.setSlotClosed).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: '07:00, còn trống' })).toBeInTheDocument();
    expect(
      await screen.findByText('Chưa lưu được. Ngày hoặc khung giờ đã có lịch đặt thì không đóng được; giá phải từ 0 đến 5.000.000đ.'),
    ).toBeInTheDocument();
  });

  it('đổi khung thành công thì làm mới lịch tháng nhưng lịch vẫn hiển thị', async () => {
    const mocks = setup();
    fireEvent.click(await waitCalendar());
    fireEvent.click(await screen.findByRole('button', { name: '07:00, còn trống' }));

    await waitFor(() => expect(mocks.getMonth).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('gridcell', { name: /17 tháng 10/ })).toBeInTheDocument();
  });

  it('ngày chưa có khung giờ thì hiện trạng thái rỗng', async () => {
    setup({}, []);
    fireEvent.click(await waitCalendar());
    expect(await screen.findByText('Ngày này chưa có khung giờ.')).toBeInTheDocument();
  });
});
