import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { AnimationRoutes, Route } from 'zmp-ui';
import { BookingConfirmPage } from './BookingConfirmPage';
import { PATHS } from '@/routes/paths';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { useBookingDraft } from '@/stores';
import { AppError, type GymerDetail, type Services } from '@/services';
import type { DayInfo, Gymer, MyBooking } from '@/types/domain';

// Cờ bật ô ghi chú sức khoẻ, đọc lúc dùng (không cố định khi import) để một ca có thể tắt cờ.
const flags = vi.hoisted(() => ({ healthNote: true }));
vi.mock('../config', () => ({
  get HEALTH_NOTE_FIELD_ENABLED() {
    return flags.healthNote;
  },
}));

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
  tags: ['Gym'],
  bio: '',
};

const detail: GymerDetail = { gymer, certificates: [], reviews: [] };

// Ngày 17/10/2026 có giá riêng 220.000đ.
const days = (price: number | undefined): DayInfo[] => [{ date: new Date(2026, 9, 17), price }];

const pending: MyBooking = {
  id: 'b-old',
  gymerId: 'g1',
  gymerName: 'Minh Hà',
  start: '2026-10-17T02:00:00Z', // 09:00 VN
  end: '2026-10-17T03:00:00Z',
  price: 220000,
  status: 'pending',
  reviewed: false,
};

interface Setup {
  create?: Services['bookings']['create'];
  listMine?: Services['bookings']['listMine'];
  getMonth?: Services['schedule']['getMonth'];
  getDetail?: Services['gymers']['getDetail'];
}

function renderConfirm(setup: Setup = {}) {
  const services = createStubServices({
    gymers: { getDetail: setup.getDetail ?? vi.fn(async () => detail) },
    schedule: { getMonth: setup.getMonth ?? vi.fn(async () => days(220_000)) },
    bookings: {
      create: setup.create ?? vi.fn(async () => ({ bookingId: 'b-new' })),
      listMine: setup.listMine ?? vi.fn(async () => []),
    },
  });
  renderPage(
    <AnimationRoutes>
      <Route path={PATHS.booking} element={<BookingConfirmPage />} />
      <Route path={PATHS.gymerDetail} element={<div>trang chi tiết</div>} />
      <Route path={PATHS.search} element={<div>trang tìm kiếm</div>} />
      <Route path={PATHS.bookingSuccess} element={<div>trang thành công</div>} />
      <Route path={PATHS.myBookings} element={<div>trang lịch của tôi</div>} />
    </AnimationRoutes>,
    { services, route: '/gymers/g1/book' },
  );
  return services;
}

beforeEach(() => {
  flags.healthNote = true;
  useBookingDraft.setState({ gymerId: 'g1', dateIso: '2026-10-17', slotId: '2026-10-17T09:00' });
});

afterEach(() => {
  cleanup();
  useBookingDraft.getState().clear();
});

async function waitLoaded() {
  await screen.findByText('Minh Hà');
}

describe('BookingConfirmPage', () => {
  it('luôn có tiêu đề, kể cả khi đang tải', () => {
    renderConfirm();
    expect(screen.getByTestId('page-header')).toHaveTextContent('Xác nhận đặt lịch');
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
  });

  it('hiển thị tóm tắt đúng: Gymer, ngày, giờ, 60 phút và giá của ngày', async () => {
    renderConfirm();
    await waitLoaded();
    expect(screen.getByText('Thứ 7, 17/10')).toBeInTheDocument();
    expect(screen.getByText('09:00 – 10:00')).toBeInTheDocument();
    expect(screen.getByText('60 phút')).toBeInTheDocument();
    expect(screen.getAllByText('220.000đ').length).toBeGreaterThan(0);
    expect(screen.getByText(/Thanh toán nằm ngoài ứng dụng/)).toBeInTheDocument();
  });

  it('gửi đúng một lần với khoảng ISO có +07:00, giá đang hiển thị và shareHealthNote false', async () => {
    const services = renderConfirm();
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => expect(services.bookings.create).toHaveBeenCalledTimes(1));
    expect(services.bookings.create).toHaveBeenCalledWith(
      expect.objectContaining({
        gymerId: 'g1',
        startIso: '2026-10-17T09:00:00+07:00',
        endIso: '2026-10-17T10:00:00+07:00',
        expectedPrice: 220000,
        shareHealthNote: false,
      }),
    );
  });

  it('ô trống thì không gửi goal và note; ô có chữ thì gửi bản đã trim', async () => {
    const services = renderConfirm();
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => expect(services.bookings.create).toHaveBeenCalledTimes(1));
    const first = vi.mocked(services.bookings.create).mock.calls[0][0];
    expect(first.goal).toBeUndefined();
    expect(first.note).toBeUndefined();
    cleanup();
    // Lượt gửi trên đã thành công và xoá nháp; khôi phục nháp cho lượt kiểm tra tiếp theo.
    useBookingDraft.setState({ gymerId: 'g1', dateIso: '2026-10-17', slotId: '2026-10-17T09:00' });

    const again = renderConfirm();
    await waitLoaded();
    fireEvent.change(screen.getByLabelText(/Mục tiêu tập luyện/), { target: { value: '  giảm mỡ  ' } });
    fireEvent.change(screen.getByLabelText(/Ghi chú sức khoẻ/), { target: { value: ' đau lưng ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => expect(again.bookings.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(again.bookings.create).mock.calls[0][0]).toMatchObject({
      goal: 'giảm mỡ',
      note: 'đau lưng',
      shareHealthNote: false,
    });
  });

  it('bấm đúp chỉ gọi create một lần', async () => {
    let resolve: (v: { bookingId: string }) => void = () => undefined;
    const create = vi.fn(
      () => new Promise<{ bookingId: string }>((r) => (resolve = r)),
    );
    renderConfirm({ create });
    await waitLoaded();
    const button = screen.getByRole('button', { name: 'Gửi yêu cầu' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(create).toHaveBeenCalledTimes(1);
    resolve({ bookingId: 'b-new' });
    await screen.findByText('trang thành công');
  });

  it('thành công: sang màn thành công và xoá nháp', async () => {
    renderConfirm();
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await screen.findByText('trang thành công');
    expect(useBookingDraft.getState().slotId).toBeUndefined();
  });

  it('SLOT_TAKEN: báo lỗi, giữ nội dung đã nhập, nút chọn giờ khác xoá khung và về chi tiết', async () => {
    const create = vi.fn(async () => {
      throw new AppError('SLOT_TAKEN', 'taken');
    });
    renderConfirm({ create });
    await waitLoaded();
    fireEvent.change(screen.getByLabelText(/Mục tiêu tập luyện/), { target: { value: 'tăng cơ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText(/vừa có người đặt/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mục tiêu tập luyện/)).toHaveValue('tăng cơ');
    fireEvent.click(screen.getByRole('button', { name: 'Chọn giờ khác' }));
    await screen.findByText('trang chi tiết');
    expect(useBookingDraft.getState().slotId).toBeUndefined();
  });

  it('SLOT_NOT_OPEN dùng cùng nút chọn giờ khác', async () => {
    const create = vi.fn(async () => {
      throw new AppError('SLOT_NOT_OPEN', 'closed');
    });
    renderConfirm({ create });
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText(/không nhận khung giờ này/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chọn giờ khác' })).toBeInTheDocument();
  });

  it('PRICE_CHANGED: hiện giá mới, không tự gửi lại; gửi lần nữa dùng giá mới', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new AppError('PRICE_CHANGED', 'price'))
      .mockResolvedValueOnce({ bookingId: 'b-new' });
    const getMonth = vi
      .fn()
      .mockResolvedValueOnce(days(220_000))
      .mockResolvedValueOnce(days(250_000));
    renderConfirm({ create, getMonth });
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(
      await screen.findByText('Giá đã đổi từ 220.000đ thành 250.000đ. Hãy xem lại rồi bấm gửi lần nữa.'),
    ).toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('250.000đ').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await screen.findByText('trang thành công');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ expectedPrice: 250000 }));
  });

  it('LIMIT_REACHED: có liên kết xem lịch của tôi', async () => {
    const create = vi.fn(async () => {
      throw new AppError('LIMIT_REACHED', 'limit');
    });
    renderConfirm({ create });
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xem lịch của tôi' }));
    await screen.findByText('trang lịch của tôi');
  });

  it('lỗi mạng: nút thử lại đối chiếu listMine; nếu đã có lượt thì sang thành công, không gọi create lần hai', async () => {
    const create = vi.fn(async () => {
      throw new AppError('NETWORK', 'net');
    });
    const listMine = vi.fn(async () => [pending]);
    renderConfirm({ create, listMine });
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    await screen.findByText('trang thành công');
    expect(listMine).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('lỗi mạng và listMine không thấy lượt nào thì thử lại mới gọi create', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new AppError('NETWORK', 'net'))
      .mockResolvedValueOnce({ bookingId: 'b-new' });
    const listMine = vi.fn(async () => []);
    renderConfirm({ create, listMine });
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    await screen.findByText('trang thành công');
    expect(listMine).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('ghi chú sức khoẻ có câu chưa chia sẻ cho Gymer', async () => {
    renderConfirm();
    await waitLoaded();
    expect(screen.getByText('Chia sẻ ghi chú sức khoẻ')).toBeInTheDocument();
    expect(screen.getByText('Không')).toBeInTheDocument();
  });

  it('cờ tắt thì ô ghi chú sức khoẻ biến mất', async () => {
    flags.healthNote = false;
    renderConfirm();
    await waitLoaded();
    expect(screen.queryByLabelText(/Ghi chú sức khoẻ/)).not.toBeInTheDocument();
    expect(screen.queryByText('Chia sẻ ghi chú sức khoẻ')).not.toBeInTheDocument();
  });

  it('ngày không có giá thì không cho gửi', async () => {
    renderConfirm({ getMonth: vi.fn(async () => days(undefined)) });
    await waitLoaded();
    expect(screen.getByText('Ngày này chưa có giá. Hãy quay lại chọn ngày khác.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeDisabled();
  });

  it('lỗi tải Gymer NOT_FOUND hiện câu lỗi và vẫn có tiêu đề', async () => {
    renderConfirm({
      getDetail: vi.fn(async () => {
        throw new AppError('NOT_FOUND', 'nf');
      }),
    });
    expect(await screen.findByText('Hồ sơ Gymer này không còn hiển thị.')).toBeInTheDocument();
    expect(screen.getByTestId('page-header')).toHaveTextContent('Xác nhận đặt lịch');
  });

  it('đặt xong thì sang thành công và nháp bị xoá không đẩy về chi tiết Gymer', async () => {
    renderConfirm();
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await screen.findByText('trang thành công');
    // Chờ một vòng effect để chắc chắn không có chuyển hướng muộn.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByText('trang thành công')).toBeInTheDocument();
    expect(screen.queryByText('trang chi tiết')).not.toBeInTheDocument();
    expect(useBookingDraft.getState().slotId).toBeUndefined();
  });

  it('lỗi mạng rồi đối chiếu thấy lượt sẵn có: sang thành công và không về chi tiết Gymer', async () => {
    const create = vi.fn(async () => {
      throw new AppError('NETWORK', 'net');
    });
    renderConfirm({ create, listMine: vi.fn(async () => [pending]) });
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    await screen.findByText('trang thành công');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('trang chi tiết')).not.toBeInTheDocument();
  });

  it('lỗi mạng và lượt đã được Gymer xác nhận: không gọi create lần hai, sang thành công', async () => {
    const create = vi.fn(async () => {
      throw new AppError('NETWORK', 'net');
    });
    const confirmed: MyBooking = { ...pending, id: 'b-conf', status: 'confirmed' };
    renderConfirm({ create, listMine: vi.fn(async () => [confirmed]) });
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    await screen.findByText('trang thành công');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('không có nháp thì chuyển về chi tiết Gymer', async () => {
    useBookingDraft.getState().clear();
    renderConfirm();
    await screen.findByText('trang chi tiết');
  });

  it('nháp của Gymer khác tham số route thì chuyển về chi tiết Gymer', async () => {
    useBookingDraft.setState({ gymerId: 'g2' });
    renderConfirm();
    await screen.findByText('trang chi tiết');
  });
});
