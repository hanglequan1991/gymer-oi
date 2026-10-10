// Quy tắc nghiệp vụ đặt lịch dùng ở phía UI (docs/plans/schema-v1-review-dot-d2.md, mục 5; plan T10).
import type { BookingStatus } from '@/types/domain';

/**
 * Yêu cầu có coi là hết hạn không.
 * Công thức: status === 'expired' || (status === 'pending' && expiresAt <= now).
 * Hàng 'pending' quá hạn có thể tồn tại trong DB đến khi job quét đổi trạng thái, nên UI phải tự kiểm.
 * expiresAt không đọc được (chuỗi không phải ngày) thì không coi là hết hạn.
 */
export function isExpired(status: BookingStatus, expiresAt: string | Date, now: Date): boolean {
  if (status === 'expired') return true;
  if (status !== 'pending') return false;
  const expiresMs = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return expiresMs <= now.getTime();
}
