// Cổng yêu cầu đặt lịch, phía Gymer (chỉ interface, chưa có cài đặt).
import type { BookingRequest, HealthNoteResult, RequestStatus } from '@/types/domain';

export interface RequestRepository {
  /** Danh sách yêu cầu, có thể lọc theo trạng thái. Không kèm ghi chú sức khoẻ. */
  list(filter?: { status?: RequestStatus }): Promise<BookingRequest[]>;
  /** Gymer xác nhận hoặc từ chối một yêu cầu. */
  respond(requestId: string, decision: 'confirmed' | 'rejected'): Promise<BookingRequest>;
  /**
   * Gymer huỷ một buổi đã xác nhận chưa bắt đầu (RPC cancel_booking). Không trả dữ liệu; UI tải lại danh sách.
   * Buổi đã bắt đầu, hoặc không thuộc Gymer này => FORBIDDEN (gồm ALREADY_STARTED).
   */
  cancel(requestId: string): Promise<void>;
  /**
   * Ghi chú sức khoẻ của một lượt đặt, chỉ khi khách đã chia sẻ và RLS cho phép đọc.
   * Không có quyền đọc hoặc chưa chia sẻ => hidden (không ném lỗi); lỗi mạng/DB => ném AppError.
   */
  getHealthNote(bookingId: string): Promise<HealthNoteResult>;
}
