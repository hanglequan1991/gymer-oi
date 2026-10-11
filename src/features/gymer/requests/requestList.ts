// Xử lý thuần cho tab Yêu cầu: đếm theo trạng thái và lọc/sắp xếp cho từng tab.
import type { BookingRequest, RequestStatus } from '@/types/domain';

/** Thứ tự các tab, khớp thứ tự chip trên màn. */
export const REQUEST_TABS: readonly RequestStatus[] = ['pending', 'confirmed', 'rejected'];

/** Số yêu cầu theo từng trạng thái. Đếm từ một lần list() nên ba số luôn khớp dữ liệu. */
export function countByStatus(list: readonly BookingRequest[]): Record<RequestStatus, number> {
  const counts: Record<RequestStatus, number> = { pending: 0, confirmed: 0, rejected: 0 };
  for (const r of list) counts[r.status] += 1;
  return counts;
}

/** Yêu cầu của một tab, sắp theo giờ bắt đầu tăng dần. Chuỗi ISO có offset nên Date.parse đúng. */
export function listForTab(list: readonly BookingRequest[], status: RequestStatus): BookingRequest[] {
  return list
    .filter((r) => r.status === status)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
