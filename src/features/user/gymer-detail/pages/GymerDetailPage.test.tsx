import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AnimationRoutes, Route } from 'zmp-ui';
import { GymerDetailPage } from './GymerDetailPage';
import { PATHS } from '@/routes/paths';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { useBookingDraft } from '@/stores';
import type { GymerDetail, Services } from '@/services';
import type { Certificate, DayInfo, Gymer, Review, Slot } from '@/types/domain';
import { AppError } from '@/services';

// Tháng hiện tại của máy test: các ngày trong tháng luôn có ít nhất một ngày không quá khứ (ngày cuối tháng).
const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth() + 1;
const LAST_DAY = new Date(YEAR, MONTH, 0);
const LAST_DAY_ISO = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(LAST_DAY.getDate()).padStart(2, '0')}`;
const LAST_DAY_PRICE = 250_000; // khác giá cuối tuần mặc định, để chứng minh thanh đặt lịch dùng DayInfo.price

const gymer: Gymer = {
  id: 'g1',
  name: 'Minh Hà',
  gender: 'female',
  age: 27,
  area: 'Quận 3',
  distanceKm: 1.2,
  rating: 4.8,
  reviewCount: 12,
  priceWeekday: 180_000,
  priceWeekend: 220_000,
  tags: ['Gym', 'Yoga'],
  bio: 'Huấn luyện viên giàu kinh nghiệm.',
};

const certificates: Certificate[] = [{ id: 'c1', name: 'Chứng chỉ PT quốc tế' }];

const reviews: Review[] = [1, 2, 3, 4, 5].map((i) => ({
  id: `r${i}`,
  author: `Khách ${i}`,
  rating: 5,
  text: `Nhận xét ${i}`,
  dateLabel: `0${i}/10`,
}));

function monthDays(): DayInfo[] {
  const days: DayInfo[] = [];
  for (let d = 1; d <= LAST_DAY.getDate(); d++) {
    const date = new Date(YEAR, MONTH - 1, d);
    days.push({ date, price: d === LAST_DAY.getDate() ? LAST_DAY_PRICE : undefined });
  }
  return days;
}

function daySlots(): Slot[] {
  return [
    { id: `${LAST_DAY_ISO}T07:00`, time: '07:00', state: 'available' },
    { id: `${LAST_DAY_ISO}T09:00`, time: '09:00', state: 'booked', bookedBy: 'Hoàng N.' },
    { id: `${LAST_DAY_ISO}T14:00`, time: '14:00', state: 'closed' },
  ];
}

interface Overrides {
  getDetail?: () => Promise<GymerDetail>;
  getMonth?: () => Promise<DayInfo[]>;
  getDaySlots?: () => Promise<Slot[]>;
}

function makeServices(over: Overrides = {}) {
  const getDetail = vi.fn(over.getDetail ?? (async (): Promise<GymerDetail> => ({ gymer, certificates, reviews })));
  const getMonth = vi.fn(over.getMonth ?? (async () => monthDays()));
  const getDaySlots = vi.fn(over.getDaySlots ?? (async () => daySlots()));
  const services: Services = createStubServices({
    gymers: { getDetail },
    schedule: { getMonth, getDaySlots },
  });
  return { services, getDetail, getMonth, getDaySlots };
}

function renderDetail(services: Services, route = '/gymers/g1') {
  return renderPage(
    <AnimationRoutes>
      <Route path={PATHS.gymerDetail} element={<GymerDetailPage />} />
      <Route path={PATHS.booking} element={<div>trang đặt lịch</div>} />
      <Route path={PATHS.search} element={<div>trang tìm kiếm</div>} />
    </AnimationRoutes>,
    { services, route },
  );
}

/** Nút ngày cuối tháng (luôn không quá khứ). Nhãn có dạng "Thứ X, N tháng M, ...". */
const LAST_DAY_NAME = new RegExp(`, ${LAST_DAY.getDate()} tháng ${MONTH}`);
function lastDayButton(): HTMLElement {
  return screen.getByRole('gridcell', { name: LAST_DAY_NAME });
}
function findLastDayButton(): Promise<HTMLElement> {
  return screen.findByRole('gridcell', { name: LAST_DAY_NAME });
}

/** Chờ hồ sơ hiện xong (tên Gymer xuất hiện) rồi trả về. */
async function waitForProfile() {
  await screen.findByRole('heading', { name: 'Minh Hà' });
}

beforeEach(() => {
  useBookingDraft.getState().clear();
});

afterEach(() => {
  cleanup();
});

describe('GymerDetailPage', () => {
  it('luôn có tiêu đề trang và hiện "Đang tải..." khi chưa có dữ liệu', () => {
    const { services } = makeServices({ getDetail: () => new Promise(() => undefined) });
    renderDetail(services);

    expect(screen.getByTestId('page-header')).toHaveTextContent('Chi tiết Gymer');
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
  });

  it('lỗi tải hồ sơ hiện ErrorView kèm nút thử lại, tiêu đề vẫn còn', async () => {
    const { services, getDetail } = makeServices({
      getDetail: async () => {
        throw new AppError('NETWORK', 'mất mạng');
      },
    });
    renderDetail(services);

    expect(await screen.findByTestId('error-view')).toBeInTheDocument();
    expect(screen.getByTestId('page-header')).toHaveTextContent('Chi tiết Gymer');
    expect(getDetail).toHaveBeenCalledWith('g1');
  });

  it('NOT_FOUND hiện thông báo và nút về tìm kiếm', async () => {
    const { services } = makeServices({
      getDetail: async () => {
        throw new AppError('NOT_FOUND', 'không có');
      },
    });
    renderDetail(services);

    const back = await screen.findByRole('button', { name: 'Về tìm kiếm' });
    expect(screen.queryByTestId('error-view')).not.toBeInTheDocument();
    fireEvent.click(back);
    expect(await screen.findByText('trang tìm kiếm')).toBeInTheDocument();
  });

  it('hiện thông tin chung, giới thiệu, chuyên môn và chứng chỉ "Tự khai"', async () => {
    const { services } = makeServices();
    renderDetail(services);
    await waitForProfile();

    expect(screen.getByText('Huấn luyện viên giàu kinh nghiệm.')).toBeInTheDocument();
    expect(screen.getByText('Gym')).toBeInTheDocument();
    expect(screen.getByText('Yoga')).toBeInTheDocument();
    expect(screen.getByText('Chứng chỉ PT quốc tế')).toBeInTheDocument();
    expect(screen.getByText('Tự khai')).toBeInTheDocument();
    expect(screen.queryByText(/xác minh/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/km/)).not.toBeInTheDocument(); // không hiện khoảng cách
  });

  it('bảng giá hai dòng T2-T6 và T7-CN đúng số tiền', async () => {
    const { services } = makeServices();
    renderDetail(services);
    await waitForProfile();

    const weekdayRow = screen.getByText('T2-T6').closest('div') as HTMLElement;
    const weekendRow = screen.getByText('T7-CN').closest('div') as HTMLElement;
    expect(weekdayRow).toHaveTextContent('180.000đ/buổi');
    expect(weekendRow).toHaveTextContent('220.000đ/buổi');
  });

  it('đánh giá: mặc định 3 mục, "Xem thêm" mở đủ danh sách', async () => {
    const { services } = makeServices();
    renderDetail(services);
    await waitForProfile();

    expect(screen.getByText('Nhận xét 1')).toBeInTheDocument();
    expect(screen.getByText('Nhận xét 3')).toBeInTheDocument();
    expect(screen.queryByText('Nhận xét 4')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(screen.getByText('Nhận xét 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).not.toBeInTheDocument();
  });

  it('tải lịch đúng gymer và tháng (month 1-12), đổi tháng gọi lại đúng', async () => {
    const { services, getMonth } = makeServices();
    renderDetail(services);
    await waitForProfile();

    await waitFor(() => expect(getMonth).toHaveBeenCalledWith('g1', YEAR, MONTH));
    fireEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    const next = MONTH === 12 ? [YEAR + 1, 1] : [YEAR, MONTH + 1];
    await waitFor(() => expect(getMonth).toHaveBeenLastCalledWith('g1', next[0], next[1]));
  });

  it('chọn ngày thì tải khung giờ đúng ngày; chỉ khung trống chọn được', async () => {
    const { services, getDaySlots } = makeServices();
    renderDetail(services);
    await waitForProfile();

    fireEvent.click(await findLastDayButton());
    await waitFor(() => expect(getDaySlots).toHaveBeenCalledWith('g1', LAST_DAY_ISO));

    const booked = await screen.findByRole('button', { name: /09:00, đã đặt/ });
    const closed = screen.getByRole('button', { name: /14:00, đã đóng/ });
    const free = screen.getByRole('button', { name: /07:00, còn trống/ });
    expect(booked).toHaveAttribute('aria-disabled', 'true');
    expect(closed).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(booked);
    expect(booked).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Đặt lịch' })).toBeDisabled();
    fireEvent.click(free);
    expect(free).toHaveAttribute('aria-pressed', 'true');
  });

  it('nút Đặt lịch bị vô hiệu đến khi chọn khung; thanh dưới dùng đúng giá DayInfo của ngày đã chọn', async () => {
    const { services } = makeServices();
    renderDetail(services);
    await waitForProfile();

    const bookBtn = screen.getByRole('button', { name: 'Đặt lịch' });
    expect(bookBtn).toBeDisabled();
    expect(screen.getByText('Chọn ngày và giờ để đặt lịch')).toBeInTheDocument();

    fireEvent.click(lastDayButton());
    fireEvent.click(await screen.findByRole('button', { name: /07:00, còn trống/ }));

    expect(bookBtn).toBeEnabled();
    const summary = screen.getByTestId('booking-bar-summary');
    expect(summary).toHaveTextContent('07:00');
    // Giá ngày đã chọn (250.000đ) khác giá cuối tuần mặc định (220.000đ)
    expect(summary).toHaveTextContent('250.000đ');
    expect(summary).not.toHaveTextContent('220.000đ');
  });

  it('bấm Đặt lịch ghi bản nháp đúng và chuyển sang /gymers/<id>/book', async () => {
    const { services } = makeServices();
    renderDetail(services);
    await waitForProfile();

    fireEvent.click(lastDayButton());
    fireEvent.click(await screen.findByRole('button', { name: /07:00, còn trống/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));

    expect(await screen.findByText('trang đặt lịch')).toBeInTheDocument();
    expect(useBookingDraft.getState()).toMatchObject({
      gymerId: 'g1',
      dateIso: LAST_DAY_ISO,
      slotId: `${LAST_DAY_ISO}T07:00`,
    });
    expect(window.location.pathname).toBe('/gymers/g1/book');
  });

  it('lỗi tải khung giờ hiện ngay tại khu lịch, hồ sơ phía trên vẫn hiển thị', async () => {
    const { services } = makeServices({
      getDaySlots: async () => {
        throw new AppError('NETWORK', 'mất mạng');
      },
    });
    renderDetail(services);
    await waitForProfile();

    fireEvent.click(lastDayButton());
    expect(await screen.findByTestId('error-view')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Minh Hà' })).toBeInTheDocument();
    expect(screen.getByText('Chứng chỉ PT quốc tế')).toBeInTheDocument();
  });

  it('ngày không có khung giờ hiện trạng thái rỗng', async () => {
    const { services } = makeServices({ getDaySlots: async () => [] });
    renderDetail(services);
    await waitForProfile();

    fireEvent.click(lastDayButton());
    expect(await screen.findByText('Ngày này chưa có khung giờ.')).toBeInTheDocument();
  });

  it('bản nháp của Gymer khác bị xoá khi mở hồ sơ mới', async () => {
    useBookingDraft.getState().setDraft({ gymerId: 'other', dateIso: '2026-01-01', slotId: 'x' });
    const { services } = makeServices();
    renderDetail(services);
    await waitForProfile();

    expect(useBookingDraft.getState().gymerId).toBeUndefined();
    expect(useBookingDraft.getState().slotId).toBeUndefined();
  });
});

describe('GymerDetailPage: vùng lịch', () => {
  it('lưới khung giờ có nhãn nhóm "Khung giờ"', async () => {
    const { services } = makeServices();
    renderDetail(services);
    await waitForProfile();

    fireEvent.click(lastDayButton());
    const grid = await screen.findByRole('group', { name: 'Khung giờ' });
    expect(within(grid).getAllByRole('button')).toHaveLength(3);
  });
});
