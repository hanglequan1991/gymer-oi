// Cổng đặt lịch (chỉ interface, chưa có cài đặt).

/** Dữ liệu gửi lên khi tạo một lượt đặt. */
export interface BookingCreateInput {
  gymerId: string;
  startIso: string; // ISO
  endIso: string; // ISO
  goal?: string;
  note?: string;
}

export interface BookingRepository {
  /** Tạo lượt đặt. Ném AppError('SLOT_TAKEN') nếu khung giờ đã có người đặt. */
  create(input: BookingCreateInput): Promise<{ bookingId: string }>;
}
