/**
 * Đường dẫn của ứng dụng.
 * PATHS là mẫu cho khai báo <Route path>; các hàm bên dưới dùng để tạo đường dẫn thật khi điều hướng.
 */
export const PATHS = {
  search: '/',
  gymerDetail: '/gymers/:gymerId',
  booking: '/gymers/:gymerId/book',
  bookingSuccess: '/bookings/:bookingId/success',
  gymerRoot: '/gymer',
  gymerOverview: '/gymer/overview',
  gymerSchedule: '/gymer/schedule',
  gymerRequests: '/gymer/requests',
  gymerProfile: '/gymer/profile',
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
