// Mapper hàng bookings phía khách (kèm tên/ảnh Gymer từ gymer_profiles, số đánh giá từ reviews) sang MyBooking (plan T04).
// Thuần: không gọi mạng, không đọc thời gian hiện tại. Trạng thái, giới hạn số dòng nằm ở bookingRepo.
import type { BookingStatus, MyBooking } from '@/types/domain';
import { AppError } from '../errors';

/** Embed 1-1 (gymer_profiles): PostgREST có thể trả object, mảng hoặc null. */
type OneToOneEmbed<T> = T | T[] | null;

/** Hình dạng một hàng bookings đã chọn bằng MY_BOOKING_SELECT. */
export interface MyBookingRow {
  id: string;
  gymer_id: string;
  starts_at: string;
  ends_at: string;
  price_vnd: number;
  goal: string | null;
  status: BookingStatus;
  expires_at: string;
  /** Người huỷ (uuid), null khi chưa huỷ hoặc hàng huỷ cũ không ghi nhận. */
  cancelled_by: string | null;
  gymer_profiles: OneToOneEmbed<{ display_name: string; avatar_url: string | null }>;
  /** Embed reviews(id): mảng, rỗng khi chưa có đánh giá (RLS chỉ trả đánh giá của chính khách). */
  reviews: { id: string }[] | null;
  /** Embed booking_health_notes(shared_with_gymer): 1-1, null khi không có ghi chú. Không đọc nội dung ghi chú. */
  booking_health_notes?: OneToOneEmbed<{ shared_with_gymer: boolean }>;
}

const BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'rejected', 'cancelled', 'expired'];

function isBookingStatus(status: string): status is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(status);
}

/** Lấy phần tử của embed 1-1 dù PostgREST trả object, mảng hay null. */
function firstOf<T>(embed: OneToOneEmbed<T>): T | undefined {
  const value = Array.isArray(embed) ? embed[0] : embed;
  return value ?? undefined;
}

/**
 * Chuyển một hàng bookings sang MyBooking.
 * - Trạng thái ngoài bộ enum booking_status: ném UNKNOWN.
 * - expiresAt chỉ có khi pending.
 * - goal rỗng hoặc chỉ có khoảng trắng: không có key goal.
 * - gymerAvatarUrl: không có key khi Gymer chưa có ảnh.
 * - reviewed = có ít nhất một đánh giá trong embed.
 * - healthNoteShared: chỉ có key khi có hàng ghi chú (true/false theo shared_with_gymer).
 * - cancelledBy: chỉ có khi cancelled và cancelled_by khác null ('gymer' nếu trùng gymer_id, còn lại 'customer').
 */
export function toMyBooking(row: MyBookingRow): MyBooking {
  if (!isBookingStatus(row.status)) {
    throw new AppError('UNKNOWN', `Trạng thái lượt đặt không hợp lệ: ${row.status}`);
  }

  const gymer = firstOf(row.gymer_profiles);
  const booking: MyBooking = {
    id: row.id,
    gymerId: row.gymer_id,
    gymerName: gymer?.display_name ?? '',
    start: row.starts_at,
    end: row.ends_at,
    price: row.price_vnd,
    status: row.status,
    reviewed: (row.reviews?.length ?? 0) > 0,
  };

  if (gymer?.avatar_url) booking.gymerAvatarUrl = gymer.avatar_url;
  if (row.goal !== null && row.goal.trim() !== '') booking.goal = row.goal;
  if (row.status === 'pending') booking.expiresAt = row.expires_at;
  if (row.status === 'cancelled' && row.cancelled_by !== null) {
    booking.cancelledBy = row.cancelled_by === row.gymer_id ? 'gymer' : 'customer';
  }

  const healthNote = firstOf(row.booking_health_notes);
  if (healthNote) booking.healthNoteShared = healthNote.shared_with_gymer;

  return booking;
}
