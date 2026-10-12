// Mapper hàng bookings (kèm tên khách từ profiles) sang BookingRequest phía Gymer (plan T-R, D7). Ghi chú sức khoẻ không đi qua mapper này.
// Thuần: không gọi mạng, không đọc thời gian hiện tại. Lọc hết hạn và giới hạn số dòng nằm ở requestRepo.
import type { BookingRequest, BookingStatus, CancelledBy, RequestStatus } from '@/types/domain';
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
  /** Gymer của hàng; so với cancelled_by để biết ai huỷ (không trả uuid ra domain). */
  gymer_id: string;
  /** Người huỷ (uuid), null khi chưa huỷ hoặc hàng huỷ cũ không ghi nhận. */
  cancelled_by: string | null;
  profiles: OneToOneEmbed<{ display_name: string }>;
}

const REQUEST_STATUSES: readonly RequestStatus[] = ['pending', 'confirmed', 'rejected', 'cancelled'];

function isRequestStatus(status: BookingStatus): status is RequestStatus {
  return (REQUEST_STATUSES as readonly BookingStatus[]).includes(status);
}

/** Ai huỷ: so cancelled_by với gymer_id của chính hàng; trùng thì Gymer huỷ, còn lại là khách. */
function cancelledByOf(row: RequestRow): CancelledBy {
  return row.cancelled_by === row.gymer_id ? 'gymer' : 'customer';
}

/** Lấy phần tử của embed 1-1 dù PostgREST trả object, mảng hay null. */
function firstOf<T>(embed: OneToOneEmbed<T>): T | undefined {
  const value = Array.isArray(embed) ? embed[0] : embed;
  return value ?? undefined;
}

function customerNameOf(profiles: RequestRow['profiles']): string {
  return firstOf(profiles)?.display_name ?? '';
}

/**
 * Chuyển một hàng bookings sang BookingRequest.
 * - Trạng thái ngoài pending/confirmed/rejected/cancelled (ví dụ expired): ném UNKNOWN (list không bao giờ trả các trạng thái này).
 * - expiresAt chỉ có khi pending.
 * - cancelledBy chỉ có khi cancelled và cancelled_by khác null: 'gymer' nếu trùng gymer_id, còn lại là 'customer'.
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
  if (row.status === 'cancelled' && row.cancelled_by !== null) {
    request.cancelledBy = cancelledByOf(row);
  }
  return request;
}
