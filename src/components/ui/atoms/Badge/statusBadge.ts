import type { RequestStatus } from '@/types/domain';
import type { BadgeTone } from './Badge';

/** Nhãn và màu hiển thị cho từng trạng thái yêu cầu đặt lịch. */
export const STATUS_BADGE: Record<RequestStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'warn', label: 'Chờ duyệt' },
  confirmed: { tone: 'ok', label: 'Đã xác nhận' },
  rejected: { tone: 'danger', label: 'Đã từ chối' },
};
