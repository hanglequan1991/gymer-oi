// Cổng yêu cầu đặt lịch, phía Gymer (chỉ interface, chưa có cài đặt).
import type { BookingRequest, RequestStatus } from '@/types/domain';

export interface RequestRepository {
  /** Danh sách yêu cầu, có thể lọc theo trạng thái. */
  list(filter?: { status?: RequestStatus }): Promise<BookingRequest[]>;
  /** Gymer xác nhận hoặc từ chối một yêu cầu. */
  respond(requestId: string, decision: 'confirmed' | 'rejected'): Promise<BookingRequest>;
}
