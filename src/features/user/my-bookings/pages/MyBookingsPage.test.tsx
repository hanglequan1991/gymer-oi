import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AnimationRoutes, Route } from 'zmp-ui';
import { MyBookingsPage } from './MyBookingsPage';
import { PATHS } from '@/routes/paths';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { AppError } from '@/services';
import type { MyBooking } from '@/types/domain';

const HOUR = 60 * 60 * 1000;
// Mốc tương đối theo đồng hồ thật: trang tự tính "bây giờ" nên test dùng khoảng cách so với hiện tại.
function at(hours: number): string {
  return new Date(Date.now() + hours * HOUR).toISOString();
}

function make(over: Partial<MyBooking> & { startH?: number } = {}): MyBooking {
  const { startH = 48, ...rest } = over;
  return {
    id: 'b1',
    gymerId: 'g1',
    gymerName: 'Minh Hà',
    start: at(startH),
    end: at(startH + 1),
    price: 220000,
    status: 'confirmed',
    reviewed: false,
    ...rest,
  };
}

function renderMyBookings(listMine: () => Promise<MyBooking[]>, extra: { cancel?: unknown; review?: unknown } = {}) {
  const services = createStubServices({
    bookings: {
      listMine: vi.fn(listMine),
      cancel: vi.fn(async () => undefined),
      review: vi.fn(async () => undefined),
      ...(extra as object),
    },
  });
  renderPage(
    <AnimationRoutes>
      <Route path={PATHS.myBookings} element={<MyBookingsPage />} />
      <Route path={PATHS.search} element={<div>trang tìm kiếm</div>} />
      <Route path={PATHS.gymerDetail} element={<div>trang chi tiết gymer</div>} />
    </AnimationRoutes>,
    { services, route: PATHS.myBookings },
  );
  return services;
}

/** Danh sách lượt đang hiển thị (theo tên Gymer trong từng mục). */
function visibleItems(): HTMLElement[] {
  return screen.queryAllByTestId('booking-item');
}

/** Chờ tải xong rồi mở tab Lịch sử. */
async function openHistory() {
  await waitFor(() => expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('radio', { name: 'Lịch sử' }));
}

afterEach(() => {
  cleanup();
});

describe('MyBookingsPage', () => {
  it('luôn có tiêu đề, kể cả khi đang tải', () => {
    renderMyBookings(() => new Promise(() => undefined));
    expect(screen.getByTestId('page-header')).toHaveTextContent('Lịch của tôi');
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
  });

  it('lỗi tải hiện thông báo lỗi', async () => {
    renderMyBookings(async () => {
      throw new AppError('NETWORK', 'mất mạng');
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('mặc định tab Sắp tới: lượt chưa kết thúc và pending còn hạn; lượt đã qua vào Lịch sử', async () => {
    renderMyBookings(async () => [
      make({ id: 'up-confirmed', gymerName: 'Sắp xác nhận', status: 'confirmed', startH: 48 }),
      make({ id: 'up-pending', gymerName: 'Gymer chờ', status: 'pending', startH: 72, expiresAt: at(2) }),
      make({ id: 'past', gymerName: 'Đã tập', status: 'confirmed', startH: -30, reviewed: true }),
    ]);
    await screen.findByText('Sắp xác nhận');
    expect(visibleItems()).toHaveLength(2);
    expect(screen.getByText('Sắp xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Gymer chờ')).toBeInTheDocument();
    expect(screen.queryByText('Đã tập')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Lịch sử' }));
    expect(visibleItems()).toHaveLength(1);
    expect(screen.getByText('Đã tập')).toBeInTheDocument();
  });

  it('pending quá hạn nằm ở Lịch sử với nhãn Hết hạn, không cần chờ server', async () => {
    renderMyBookings(async () => [
      make({ id: 'stale', gymerName: 'Quá hạn', status: 'pending', startH: 48, expiresAt: at(-1) }),
    ]);
    await waitFor(() => expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument());
    expect(screen.queryByText('Quá hạn')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Lịch sử' }));
    const item = visibleItems()[0];
    expect(item).toHaveTextContent('Quá hạn');
    expect(item).toHaveTextContent('Hết hạn');
    expect(within(item).queryByRole('button', { name: 'Huỷ lịch' })).not.toBeInTheDocument();
  });

  it('tab Sắp tới rỗng hiện EmptyState và nút đi tìm Gymer', async () => {
    renderMyBookings(async () => []);
    expect(await screen.findByText('Chưa có lịch sắp tới')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tìm Gymer' }));
    expect(await screen.findByText('trang tìm kiếm')).toBeInTheDocument();
  });

  it('bấm tên Gymer đi tới trang chi tiết', async () => {
    renderMyBookings(async () => [make({ gymerName: 'Minh Hà' })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem Gymer Minh Hà' }));
    expect(await screen.findByText('trang chi tiết gymer')).toBeInTheDocument();
  });

  it('huỷ lịch phải qua hộp thoại xác nhận rồi gọi cancel đúng id', async () => {
    const services = renderMyBookings(async () => [make({ id: 'b-cancel', status: 'pending', expiresAt: at(2) })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ lịch' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Huỷ lịch này?' });
    expect(services.bookings.cancel).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ lịch' }));
    await waitFor(() => expect(services.bookings.cancel).toHaveBeenCalledWith('b-cancel'));
    expect(await screen.findByText('Đã huỷ lịch.')).toBeInTheDocument();
    // Huỷ xong thì tải lại danh sách.
    await waitFor(() => expect(services.bookings.listMine).toHaveBeenCalledTimes(2));
  });

  it('bấm Giữ lịch trong hộp thoại thì không gọi cancel', async () => {
    const services = renderMyBookings(async () => [make({ status: 'pending', expiresAt: at(2) })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ lịch' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Huỷ lịch này?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Giữ lịch' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(services.bookings.cancel).not.toHaveBeenCalled();
  });

  it('huỷ thất bại (FORBIDDEN) hiện câu lỗi đúng ngữ cảnh và tải lại', async () => {
    const services = renderMyBookings(async () => [make({ status: 'pending', expiresAt: at(2) })], {
      cancel: vi.fn(async () => {
        throw new AppError('FORBIDDEN', 'bị từ chối');
      }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ lịch' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Huỷ lịch này?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ lịch' }));

    expect(await screen.findByText(/Lịch này không còn huỷ được/)).toBeInTheDocument();
    await waitFor(() => expect(services.bookings.listMine).toHaveBeenCalledTimes(2));
  });

  it('đánh giá: nút gửi bị khoá tới khi chọn sao, rồi gọi review với số sao đã chọn', async () => {
    const services = renderMyBookings(async () => [
      make({ id: 'done', status: 'confirmed', startH: -3, reviewed: false }),
    ]);
    await openHistory();
    fireEvent.click(await screen.findByRole('button', { name: 'Đánh giá' }));

    const submit = screen.getByRole('button', { name: 'Gửi đánh giá' });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '4 sao' }));
    expect(screen.getByRole('radio', { name: '4 sao' })).toHaveAttribute('aria-checked', 'true');
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    await waitFor(() => expect(services.bookings.review).toHaveBeenCalledWith('done', { rating: 4 }));
    expect(await screen.findByText('Cảm ơn bạn đã đánh giá.')).toBeInTheDocument();
  });

  it('gửi kèm nhận xét khi có nội dung', async () => {
    const services = renderMyBookings(async () => [make({ id: 'rv', startH: -3 })]);
    await openHistory();
    fireEvent.click(await screen.findByRole('button', { name: 'Đánh giá' }));
    fireEvent.click(screen.getByRole('radio', { name: '5 sao' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Buổi tập tốt  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));
    await waitFor(() =>
      expect(services.bookings.review).toHaveBeenCalledWith('rv', { rating: 5, text: 'Buổi tập tốt' }),
    );
  });

  it('đánh giá thất bại (VALIDATION) hiện lỗi ngay trong khối đánh giá', async () => {
    renderMyBookings(async () => [make({ id: 'rv2', startH: -3 })], {
      review: vi.fn(async () => {
        throw new AppError('VALIDATION', 'sai');
      }),
    });
    await openHistory();
    fireEvent.click(await screen.findByRole('button', { name: 'Đánh giá' }));
    fireEvent.click(screen.getByRole('radio', { name: '3 sao' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));
    expect(await screen.findByText(/Đánh giá chưa hợp lệ/)).toBeInTheDocument();
    expect(screen.getByTestId('review-form')).toBeInTheDocument();
  });

  it('lượt pending còn hạn có nút Huỷ nhưng không có nút Đánh giá', async () => {
    renderMyBookings(async () => [make({ status: 'pending', expiresAt: at(2) })]);
    const item = await screen.findByTestId('booking-item');
    expect(within(item).getByRole('button', { name: 'Huỷ lịch' })).toBeInTheDocument();
    expect(within(item).queryByRole('button', { name: 'Đánh giá' })).not.toBeInTheDocument();
  });

  it('lượt đã đánh giá ở Lịch sử không còn nút nào', async () => {
    renderMyBookings(async () => [make({ status: 'confirmed', startH: -3, reviewed: true })]);
    await openHistory();
    await screen.findByTestId('booking-item');
    const item = visibleItems()[0];
    expect(within(item).queryByRole('button', { name: 'Huỷ lịch' })).not.toBeInTheDocument();
    expect(within(item).queryByRole('button', { name: 'Đánh giá' })).not.toBeInTheDocument();
  });
});
