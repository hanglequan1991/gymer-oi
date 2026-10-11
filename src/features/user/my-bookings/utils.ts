// Quy tắc hiển thị và thao tác của Lịch của tôi (khách). Hàm thuần, nhận `now` từ bên ngoài để kiểm thử được.
import type { MyBooking } from '@/types/domain';
import { isExpired } from '@/utils/booking';

export type BookingTab = 'upcoming' | 'history';

/**
 * Lượt đã hết hạn phản hồi. pending quá expiresAt được coi là hết hạn ngay phía UI,
 * không chờ job phía server đổi trạng thái (xem utils/booking.ts).
 */
export function isBookingExpired(b: MyBooking, now: Date): boolean {
  if (b.expiresAt !== undefined) return isExpired(b.status, b.expiresAt, now);
  return b.status === 'expired';
}

function startMs(b: MyBooking): number {
  return Date.parse(b.start);
}

function endMs(b: MyBooking): number {
  return Date.parse(b.end);
}

/** Tab "Sắp tới": chưa kết thúc và là pending còn hạn hoặc confirmed. Còn lại vào "Lịch sử". */
export function bookingTab(b: MyBooking, now: Date): BookingTab {
  const notEnded = endMs(b) > now.getTime();
  const active = b.status === 'confirmed' || (b.status === 'pending' && !isBookingExpired(b, now));
  return notEnded && active ? 'upcoming' : 'history';
}

/** Được huỷ khi: pending còn hạn, hoặc confirmed và chưa đến giờ bắt đầu (khớp luật server). */
export function canCancel(b: MyBooking, now: Date): boolean {
  if (isBookingExpired(b, now)) return false;
  if (b.status === 'pending') return true;
  if (b.status === 'confirmed') return startMs(b) > now.getTime();
  return false;
}

/** Được đánh giá khi: confirmed, đã kết thúc, và chưa đánh giá (mỗi buổi một lần). */
export function canReview(b: MyBooking, now: Date): boolean {
  return b.status === 'confirmed' && endMs(b) <= now.getTime() && !b.reviewed;
}

/** Mã lỗi nghiệp vụ từ lỗi đã chuẩn hoá của services (có trường code). */
export function errorCodeOf(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Lỗi cho biết lượt đã đổi trạng thái hoặc không còn là của mình: nên tải lại danh sách. */
export function shouldRefetchAfter(err: unknown): boolean {
  const code = errorCodeOf(err);
  return code === 'FORBIDDEN' || code === 'NOT_FOUND';
}

/** Sắp tới: sớm nhất trước. Lịch sử giữ thứ tự server (mới nhất trước). */
export function splitBookings(list: MyBooking[], now: Date): { upcoming: MyBooking[]; history: MyBooking[] } {
  const upcoming: MyBooking[] = [];
  const history: MyBooking[] = [];
  for (const b of list) {
    if (bookingTab(b, now) === 'upcoming') upcoming.push(b);
    else history.push(b);
  }
  upcoming.sort((a, b) => startMs(a) - startMs(b));
  return { upcoming, history };
}
