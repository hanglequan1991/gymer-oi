// Cổng đặt lịch (chỉ interface, chưa có cài đặt).

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
}
