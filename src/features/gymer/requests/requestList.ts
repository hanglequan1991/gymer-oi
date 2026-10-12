// Xử lý thuần cho tab Yêu cầu: đếm theo trạng thái và lọc/sắp xếp cho từng tab.
import type { BookingRequest, RequestStatus } from '@/types/domain';
import { isExpired } from '@/utils/booking';

/** Thứ tự các tab, khớp thứ tự chip trên màn. */
export const REQUEST_TABS: readonly RequestStatus[] = ['pending', 'confirmed', 'rejected', 'cancelled'];

/**
 * Yêu cầu chờ duyệt đã quá hạn xác nhận tại thời điểm `now`.
 * Server chỉ đổi trạng thái khi có tác động, nên màn mở lâu vẫn còn các thẻ này; phải ẩn khi hiển thị và khi đếm.
 */
export function isStaleRequest(r: BookingRequest, now: Date): boolean {
  return r.status === 'pending' && r.expiresAt !== undefined && isExpired(r.status, r.expiresAt, now);
}

/** Bỏ các yêu cầu chờ duyệt đã quá hạn. Không đổi mảng gốc. */
export function withoutStale(list: readonly BookingRequest[], now: Date): BookingRequest[] {
  return list.filter((r) => !isStaleRequest(r, now));
}

/**
 * Gymer có thể huỷ buổi khi buổi đã xác nhận và chưa bắt đầu tại `now`.
 * Khớp luật phía server (RPC cancel_booking): không huỷ buổi đã bắt đầu.
 */
export function canGymerCancel(r: BookingRequest, now: Date): boolean {
  return r.status === 'confirmed' && Date.parse(r.start) > now.getTime();
}

/** Số yêu cầu theo từng trạng thái. Đếm từ một lần list() nên ba số luôn khớp dữ liệu. */
export function countByStatus(list: readonly BookingRequest[]): Record<RequestStatus, number> {
  const counts: Record<RequestStatus, number> = { pending: 0, confirmed: 0, rejected: 0, cancelled: 0 };
  for (const r of list) counts[r.status] += 1;
  return counts;
}

/** Yêu cầu của một tab, sắp theo giờ bắt đầu tăng dần. Chuỗi ISO có offset nên Date.parse đúng. */
export function listForTab(list: readonly BookingRequest[], status: RequestStatus): BookingRequest[] {
  return list
    .filter((r) => r.status === status)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
