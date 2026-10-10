// Mapper hàng bookings (kèm tên khách từ profiles, ghi chú sức khoẻ từ booking_health_notes) sang BookingRequest phía Gymer (plan T-R, D7).
// Thuần: không gọi mạng, không đọc thời gian hiện tại. Lọc hết hạn và giới hạn số dòng nằm ở requestRepo.
import type { BookingRequest, BookingStatus, RequestStatus } from '@/types/domain';
import { AppError } from '../errors';

/** Embed 1-1 (profiles, booking_health_notes): PostgREST có thể trả object, mảng hoặc null. */
type OneToOneEmbed<T> = T | T[] | null;

/** Hình dạng một hàng bookings đã chọn bằng REQUEST_SELECT. */
export interface RequestRow {
  id: string;
  starts_at: string;
  ends_at: string;
  price_vnd: number;
  goal: string | null;
  status: BookingStatus;
  expires_at: string;
  profiles: OneToOneEmbed<{ display_name: string }>;
  /** Embed booking_health_notes(note,shared_with_gymer). RLS trả null khi Gymer không được đọc. */
  booking_health_notes: OneToOneEmbed<{ note: string; shared_with_gymer: boolean }>;
}

const REQUEST_STATUSES: readonly RequestStatus[] = ['pending', 'confirmed', 'rejected'];

function isRequestStatus(status: BookingStatus): status is RequestStatus {
  return (REQUEST_STATUSES as readonly BookingStatus[]).includes(status);
}

/** Lấy phần tử của embed 1-1 dù PostgREST trả object, mảng hay null. */
function firstOf<T>(embed: OneToOneEmbed<T>): T | undefined {
  const value = Array.isArray(embed) ? embed[0] : embed;
  return value ?? undefined;
}

function customerNameOf(profiles: RequestRow['profiles']): string {
  return firstOf(profiles)?.display_name ?? '';
}

/** Ghi chú chỉ được gán khi khách đã đồng ý chia sẻ (shared_with_gymer === true) và không rỗng. */
function sharedNoteOf(notes: RequestRow['booking_health_notes']): string | undefined {
  const embed = firstOf(notes);
  if (embed?.shared_with_gymer !== true) return undefined;
  if (typeof embed.note !== 'string' || embed.note.trim() === '') return undefined;
  return embed.note;
}

/**
 * Chuyển một hàng bookings sang BookingRequest.
 * - Trạng thái ngoài pending/confirmed/rejected: ném UNKNOWN (list không bao giờ trả các trạng thái này).
 * - expiresAt chỉ có khi pending.
 * - note chỉ có khi shared_with_gymer === true và ghi chú không rỗng; các trường hợp khác không có key note.
 */
export function toBookingRequest(row: RequestRow): BookingRequest {
  if (!isRequestStatus(row.status)) {
    throw new AppError('UNKNOWN', `Trạng thái yêu cầu không hợp lệ: ${row.status}`);
  }

  const request: BookingRequest = {
    id: row.id,
    customerName: customerNameOf(row.profiles),
    start: row.starts_at,
    end: row.ends_at,
    price: row.price_vnd,
    status: row.status,
  };
  if (row.goal) request.goal = row.goal;
  if (row.status === 'pending') request.expiresAt = row.expires_at;
  const note = sharedNoteOf(row.booking_health_notes);
  if (note !== undefined) request.note = note;
  return request;
}
