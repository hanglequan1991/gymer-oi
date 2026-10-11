import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { AnimationRoutes, Route } from 'zmp-ui';
import { BookingSuccessPage } from './BookingSuccessPage';
import { PATHS } from '@/routes/paths';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { AppError } from '@/services';
import type { MyBooking } from '@/types/domain';

const booking: MyBooking = {
  id: 'b-1',
  gymerId: 'g1',
  gymerName: 'Minh Hà',
  start: '2026-10-17T02:00:00Z', // 09:00 VN thứ 7
  end: '2026-10-17T03:00:00Z',
  price: 220000,
  status: 'pending',
  expiresAt: '2026-10-16T23:30:00Z', // 06:30 VN ngày 17/10
  reviewed: false,
};

function renderSuccess(getMine: () => Promise<MyBooking>) {
  const services = createStubServices({ bookings: { getMine: vi.fn(getMine) } });
  renderPage(
    <AnimationRoutes>
      <Route path={PATHS.bookingSuccess} element={<BookingSuccessPage />} />
      <Route path={PATHS.myBookings} element={<div>trang lịch của tôi</div>} />
      <Route path={PATHS.search} element={<div>trang tìm kiếm</div>} />
    </AnimationRoutes>,
    { services, route: '/bookings/b-1/success' },
  );
  return services;
}

afterEach(() => {
  cleanup();
});

describe('BookingSuccessPage', () => {
  it('luôn có tiêu đề, kể cả khi đang tải', () => {
    renderSuccess(() => new Promise(() => undefined));
    expect(screen.getByTestId('page-header')).toHaveTextContent('Đặt lịch thành công');
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
  });

  it('hiển thị xác nhận, hạn phản hồi theo giờ VN và tóm tắt lượt đặt', async () => {
    renderSuccess(async () => booking);
    expect(await screen.findByText('Đã gửi yêu cầu')).toBeInTheDocument();
    expect(screen.getByText(/Hạn phản hồi: 06:30 17\/10/)).toBeInTheDocument();
    expect(screen.getByText('Minh Hà')).toBeInTheDocument();
    expect(screen.getByText('Thứ 7, 17/10')).toBeInTheDocument();
    expect(screen.getByText('09:00 – 10:00')).toBeInTheDocument();
    expect(screen.getByText('220.000đ')).toBeInTheDocument();
    expect(screen.getByText(/Nhớ thanh toán trực tiếp cho Gymer/)).toBeInTheDocument();
  });

  it('không có hạn phản hồi thì không hiện dòng hạn', async () => {
    renderSuccess(async () => ({ ...booking, expiresAt: undefined }));
    await screen.findByText('Đã gửi yêu cầu');
    expect(screen.queryByText(/Hạn phản hồi/)).not.toBeInTheDocument();
  });

  it('nút Xem lịch của tôi đi tới Lịch của tôi', async () => {
    renderSuccess(async () => booking);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem lịch của tôi' }));
    await screen.findByText('trang lịch của tôi');
  });

  it('nút Về trang tìm kiếm đi tới tìm kiếm', async () => {
    renderSuccess(async () => booking);
    fireEvent.click(await screen.findByRole('button', { name: 'Về trang tìm kiếm' }));
    await screen.findByText('trang tìm kiếm');
  });

  it('NOT_FOUND hiện câu lỗi chung và vẫn có tiêu đề', async () => {
    renderSuccess(async () => {
      throw new AppError('NOT_FOUND', 'nf');
    });
    expect(await screen.findByText('Không tìm thấy nội dung bạn cần. Có thể đã bị xóa.')).toBeInTheDocument();
    expect(screen.getByTestId('page-header')).toHaveTextContent('Đặt lịch thành công');
  });
});
