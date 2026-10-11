// Cổng đặt lịch (interface). Phía khách: đọc, huỷ, đánh giá lượt đặt của mình.
import type { MyBooking } from '@/types/domain';

/** Dữ liệu gửi lên khi tạo một lượt đặt. */
export interface BookingCreateInput {
  gymerId: string;
  startIso: string; // ISO
  /** ISO. Phải đúng 60 phút sau startIso (server luôn tính +60 phút; repository ném VALIDATION nếu lệch). */
  endIso: string;
  goal?: string;
  note?: string;
  /** Giá VND mà UI đã hiển thị; server so lại và ném PRICE_CHANGED nếu lệch. Repository không tự tính giá. */
  expectedPrice: number;
  /** Khách đồng ý chia sẻ ghi chú sức khoẻ với Gymer. Chỉ có hiệu lực khi có ghi chú sức khoẻ; mặc định false. */
  shareHealthNote?: boolean;
}

export interface BookingRepository {
  /** Tạo lượt đặt. Ném AppError('SLOT_TAKEN') nếu khung giờ đã có người đặt. endIso phải đúng 60 phút sau startIso. */
  create(input: BookingCreateInput): Promise<{ bookingId: string }>;
  /** Một lượt đặt của chính mình. Ném AppError('NOT_FOUND') nếu không phải lượt của mình. */
  getMine(bookingId: string): Promise<MyBooking>;
  /** Mọi trạng thái, mới nhất trước, tối đa 100 lượt. */
  listMine(): Promise<MyBooking[]>;
  /** Huỷ lượt đặt (RPC cancel_booking). */
  cancel(bookingId: string): Promise<void>;
  /** Đánh giá lượt đặt đã hoàn thành (RPC create_review). rating 1..5; text tối đa 500 ký tự. */
  review(bookingId: string, input: { rating: number; text?: string }): Promise<void>;
}
