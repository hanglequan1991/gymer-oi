// Mapper hàng bookings (kèm tên khách từ profiles) sang BookingRequest phía Gymer (plan T-R, D7). Ghi chú sức khoẻ không đi qua mapper này.
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

/**
 * Chuyển một hàng bookings sang BookingRequest.
 * - Trạng thái ngoài pending/confirmed/rejected: ném UNKNOWN (list không bao giờ trả các trạng thái này).
 * - expiresAt chỉ có khi pending.
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
  return request;
}
