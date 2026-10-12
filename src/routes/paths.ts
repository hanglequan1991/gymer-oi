/**
 * Đường dẫn của ứng dụng.
 * PATHS là mẫu cho khai báo <Route path>; các hàm bên dưới dùng để tạo đường dẫn thật khi điều hướng.
 */
export const PATHS = {
  search: '/',
  gymerDetail: '/gymers/:gymerId',
  booking: '/gymers/:gymerId/book',
  bookingSuccess: '/bookings/:bookingId/success',
  myBookings: '/me/bookings',
  gymerRoot: '/gymer',
  gymerOverview: '/gymer/overview',
  gymerSchedule: '/gymer/schedule',
  gymerRequests: '/gymer/requests',
  /** Chi tiết một yêu cầu phía Gymer (chỉ đọc). */
  gymerRequestDetail: '/gymer/requests/:requestId',
  gymerProfile: '/gymer/profile',
  /** Đăng ký trở thành Gymer; khu Gymer chuyển về đây khi tài khoản chưa là Gymer. */
  gymerJoin: '/gymer/join',
  /** Thư viện giao diện, chỉ đăng ký khi chạy dev (xem routes/index.tsx). */
  gallery: '/gallery',
} as const;

/** Đường dẫn trang chi tiết Gymer. */
export function gymerDetail(gymerId: string): string {
  return `/gymers/${encodeURIComponent(gymerId)}`;
}

/** Đường dẫn trang xác nhận đặt lịch với Gymer. */
export function booking(gymerId: string): string {
  return `/gymers/${encodeURIComponent(gymerId)}/book`;
}

/** Đường dẫn trang đặt lịch thành công. */
export function bookingSuccess(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/success`;
}

/** Đường dẫn trang chi tiết yêu cầu phía Gymer. */
export function gymerRequestDetail(requestId: string): string {
  return `/gymer/requests/${encodeURIComponent(requestId)}`;
}
