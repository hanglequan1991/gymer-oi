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
  setDayOverrides: ReturnType<typeof vi.fn>;
}

function setup(overrides: Partial<Mocks> = {}, slots: Slot[] = SLOTS_17) {
  const mocks: Mocks = {
    getMine: vi.fn().mockResolvedValue(detail()),
    getMonth: vi.fn().mockResolvedValue(MONTH_DAYS),
    getDaySlots: vi.fn().mockResolvedValue(slots),
    setPrices: vi.fn().mockResolvedValue(undefined),
    setSlotClosed: vi.fn().mockResolvedValue(undefined),
    setDayOverrides: vi.fn(async (dates: string[]) => ({ applied: dates, skipped: [] })),
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
      setDayOverrides: mocks.setDayOverrides,
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

// Tháng 10/2026 cho nhóm test giá riêng. Hôm nay là 11/10 (CN): ngày 12 là T2 có giá = mặc định T2-T6 (350.000),
// ngày 13 là T3 có giá riêng 999.000, ngày 17 (T7) có lịch đặt, ngày 1 là ngày đã qua.
const OVERRIDE_DAYS: DayInfo[] = [
  { date: new Date(2026, 9, 1), price: 350000, marker: 'none' },
  { date: new Date(2026, 9, 12), price: 350000, marker: 'open' },
  { date: new Date(2026, 9, 13), price: 999000, marker: 'open' },
  { date: new Date(2026, 9, 17), price: 420000, marker: 'booked' },
  { date: new Date(2026, 9, 18), price: 420000, marker: 'open' },
];

/** Mở ô ngày trên lịch (tháng đang xem) và đợi khung giờ hiện ra. */
async function selectDay(name: RegExp) {
  fireEvent.click(await screen.findByRole('gridcell', { name }));
}

describe('SchedulePage: giá riêng cho ngày', () => {
  it('ngày chưa có giá riêng thì ô trống, nút lưu chưa bật', async () => {
    setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    await selectDay(/12 tháng 10/);
    expect(await screen.findByTestId('day-override-editor')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Giá riêng cho ngày này' })).toHaveValue('');
    expect(screen.queryByText(/đang có giá riêng/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu cho ngày này' })).toBeDisabled();
  });

  it('ngày đang có giá riêng thì hiện giá đó và ghi rõ là giá riêng', async () => {
    setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    await selectDay(/13 tháng 10/);
    expect(await screen.findByRole('textbox', { name: 'Giá riêng cho ngày này' })).toHaveValue('999.000');
    expect(screen.getByText(/đang có giá riêng/)).toBeInTheDocument();
  });

  it('đặt giá riêng rồi lưu thì gọi setDayOverrides đúng đối số, báo thành công và tải lại lịch', async () => {
    const mocks = setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    await selectDay(/12 tháng 10/);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Giá riêng cho ngày này' }), {
      target: { value: '300000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho ngày này' }));

    expect(await screen.findByText('Đã lưu cho ngày này')).toBeInTheDocument();
    expect(mocks.setDayOverrides).toHaveBeenCalledWith(['2026-10-12'], { price: 300000, closed: false });
    await waitFor(() => expect(mocks.getMonth).toHaveBeenCalledTimes(2));
  });

  it('xoá ô giá rồi lưu thì gửi price null để bỏ giá riêng', async () => {
    const mocks = setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    await selectDay(/13 tháng 10/);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Giá riêng cho ngày này' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho ngày này' }));

    await waitFor(() =>
      expect(mocks.setDayOverrides).toHaveBeenCalledWith(['2026-10-13'], { price: null, closed: false }),
    );
  });

  it('tắt nhận lịch cả ngày rồi lưu thì gửi closed true', async () => {
    const mocks = setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    await selectDay(/12 tháng 10/);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Nhận lịch cả ngày/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho ngày này' }));

    await waitFor(() =>
      expect(mocks.setDayOverrides).toHaveBeenCalledWith(['2026-10-12'], { price: null, closed: true }),
    );
  });

  it('ngày có lịch đặt không đóng được thì báo đúng lý do và giữ nội dung đang nhập', async () => {
    const mocks = setup({
      getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS),
      setDayOverrides: vi.fn(async (dates: string[]) => ({ applied: [], skipped: dates })),
    });
    await waitCalendar();
    await selectDay(/12 tháng 10/);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Nhận lịch cả ngày/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho ngày này' }));

    expect(await screen.findByText('Ngày này đã có lịch đặt nên chưa đóng được.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Nhận lịch cả ngày/ })).not.toBeChecked();
    expect(mocks.getMonth).toHaveBeenCalledTimes(1);
  });

  it('lưu lỗi thì báo lỗi, nút bật lại để thử lại', async () => {
    const mocks = setup({
      getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS),
      setDayOverrides: vi.fn().mockRejectedValue(new AppError('NETWORK', 'x')),
    });
    await waitCalendar();
    await selectDay(/12 tháng 10/);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Giá riêng cho ngày này' }), {
      target: { value: '300000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho ngày này' }));

    await waitFor(() => expect(mocks.setDayOverrides).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Lưu cho ngày này' })).toBeEnabled();
    expect(mocks.getMonth).toHaveBeenCalledTimes(1);
  });

  it('ngày đã qua không chọn được nên không hiện form giá riêng', async () => {
    setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    const past = await waitCalendar().then(() => screen.getByRole('gridcell', { name: /, 1 tháng 10/ }));
    expect(past).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(past);
    expect(screen.queryByTestId('day-override-editor')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chọn một ngày trên lịch');
  });

  it('sau khi đổi giá mặc định, ngày đang theo giá mặc định mới không bị coi là giá riêng', async () => {
    const newDefaults = { ...detail(), gymer: { ...detail().gymer, priceWeekday: 360000 } };
    const getMonth = vi
      .fn()
      .mockResolvedValueOnce(OVERRIDE_DAYS)
      .mockResolvedValue(OVERRIDE_DAYS.map((d) => (d.date.getDate() === 12 ? { ...d, price: 360000 } : d)));
    const getMine = vi.fn().mockResolvedValueOnce(detail()).mockResolvedValue(newDefaults);
    setup({ getMonth, getMine });
    await waitCalendar();

    fireEvent.change(priceInput('Ngày thường (T2-T6)'), { target: { value: '360000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá' }));
    await waitFor(() => expect(getMine).toHaveBeenCalledTimes(2));

    await selectDay(/12 tháng 10/);
    expect(await screen.findByTestId('day-override-editor')).toBeInTheDocument();
    expect(screen.queryByText(/đang có giá riêng/)).not.toBeInTheDocument();
  });
});

describe('SchedulePage: áp dụng hàng loạt', () => {
  it('bấm nút thì mở bảng áp dụng, bấm lại thì đóng', async () => {
    setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    expect(screen.queryByTestId('bulk-apply-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng hàng loạt' }));
    expect(await screen.findByTestId('bulk-apply-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByTestId('bulk-apply-panel')).not.toBeInTheDocument();
  });

  it('đếm đúng số ngày từ hôm nay trở đi theo từng nhóm (tháng 10/2026: 21 ngày, 15 T2-T6, 6 T7-CN)', async () => {
    setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng hàng loạt' }));
    const status = await screen.findByText('Áp dụng cho 21 ngày');
    expect(status).toHaveAttribute('role', 'status');

    fireEvent.click(screen.getByRole('radio', { name: 'Ngày thường (T2-T6)' }));
    expect(screen.getByText('Áp dụng cho 15 ngày')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Cuối tuần (T7-CN)' }));
    expect(screen.getByText('Áp dụng cho 6 ngày')).toBeInTheDocument();
  });

  it('đặt giá riêng mà chưa nhập giá thì không cho áp dụng', async () => {
    setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng hàng loạt' }));
    expect(await screen.findByRole('button', { name: 'Áp dụng' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Giá riêng' }), { target: { value: '250000' } });
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeEnabled();
  });

  it('đặt giá riêng: chỉ gọi sau khi xác nhận, đúng ngày và đúng patch, rồi báo kết quả và tải lại lịch', async () => {
    const mocks = setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng hàng loạt' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Giá riêng' }), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Ngày thường (T2-T6)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    expect(mocks.setDayOverrides).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Đã áp dụng 15 ngày, bỏ qua 0 ngày đã có lịch')).toBeInTheDocument();
    const [dates, patch] = mocks.setDayOverrides.mock.calls[0];
    expect(dates).toHaveLength(15);
    expect(dates[0]).toBe('2026-10-12');
    expect(dates).not.toContain('2026-10-10');
    expect(dates).not.toContain('2026-10-17');
    expect(patch).toEqual({ price: 250000 });
    await waitFor(() => expect(mocks.getMonth).toHaveBeenCalledTimes(2));
  });

  it('đóng ngày: báo số ngày bị bỏ qua vì đã có lịch đặt', async () => {
    const mocks = setup({
      getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS),
      setDayOverrides: vi.fn(async (dates: string[]) => ({
        applied: dates.filter((d) => d !== '2026-10-17'),
        skipped: ['2026-10-17'],
      })),
    });
    await waitCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng hàng loạt' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Đóng ngày' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Đã áp dụng 20 ngày, bỏ qua 1 ngày đã có lịch')).toBeInTheDocument();
    expect(mocks.setDayOverrides).toHaveBeenCalledWith(expect.any(Array), { closed: true });
  });

  it('bỏ giá riêng gửi price null, mở ngày gửi closed false', async () => {
    const mocks = setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng hàng loạt' }));

    fireEvent.click(await screen.findByRole('radio', { name: 'Bỏ giá riêng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(mocks.setDayOverrides).toHaveBeenCalledTimes(1));
    expect(mocks.setDayOverrides.mock.calls[0][1]).toEqual({ price: null });

    fireEvent.click(screen.getByRole('radio', { name: 'Mở ngày' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(mocks.setDayOverrides).toHaveBeenCalledTimes(2));
    expect(mocks.setDayOverrides.mock.calls[1][1]).toEqual({ closed: false });
  });

  it('bấm Hủy trong hộp thoại xác nhận thì không gọi setDayOverrides', async () => {
    const mocks = setup({ getMonth: vi.fn().mockResolvedValue(OVERRIDE_DAYS) });
    await waitCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng hàng loạt' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Đóng ngày' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }));

    expect(mocks.setDayOverrides).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).not.toBeInTheDocument();
  });
});
