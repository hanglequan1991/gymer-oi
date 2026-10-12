// Kiểu miền dùng chung cho core-ui và mock (docs/core-ui-plan.md, mục 4).

export type Gender = 'female' | 'male';
export type Specialty = 'Gym' | 'Giảm mỡ' | 'Tăng cơ' | 'Yoga' | 'Calisthenics' | 'Giãn cơ';
export type SlotState = 'available' | 'booked' | 'closed' | 'selected'; // closed = Gymer chủ động đóng
export type RequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';
export type BookingStatus = RequestStatus | 'expired'; // phía khách; 'expired' chỉ là nhãn, xem utils/booking.ts
/** Người huỷ một lượt đã xác nhận: 'gymer' hoặc 'customer'. Không lộ uuid ra UI. */
export type CancelledBy = 'gymer' | 'customer';

export interface Gymer {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  area: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  priceWeekday: number;
  priceWeekend: number;
  tags: string[];
  bio: string;
  avatarUrl?: string;
}

export interface Slot {
  id: string;
  time: string; // 'HH:mm'
  state: SlotState;
  bookedBy?: string;
}

export interface DayInfo {
  date: Date;
  price?: number;
  disabled?: boolean;
  marker?: 'open' | 'booked' | 'none';
}

export interface BookingRequest {
  id: string;
  customerName: string;
  start: string; // ISO
  end: string; // ISO
  goal?: string;
  price: number;
  status: RequestStatus;
  /** Hạn xác nhận (ISO), chỉ có với yêu cầu chờ duyệt; dùng với isExpired để ẩn yêu cầu quá hạn. */
  expiresAt?: string;
  /** Chỉ có khi status = 'cancelled' và biết người huỷ; hàng huỷ cũ không có khoá này. */
  cancelledBy?: CancelledBy;
  isNew?: boolean;
}

/**
 * Kết quả đọc ghi chú sức khoẻ của một lượt đặt phía Gymer.
 * `hidden` gồm: khách không chia sẻ, ghi chú rỗng, hoặc RLS không cho đọc (không phải lỗi).
 */
export type HealthNoteResult = { status: 'visible'; note: string } | { status: 'hidden' };

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  dateLabel: string;
}

/** Chứng chỉ do Gymer tự khai (v1 không xác minh; UI luôn gắn nhãn "Tự khai"). */
export interface Certificate {
  id: string;
  name: string;
}

/** Danh sách chuyên môn hợp lệ, khớp bảng `specialties`. */
export const SPECIALTIES: readonly Specialty[] = ['Gym', 'Giảm mỡ', 'Tăng cơ', 'Yoga', 'Calisthenics', 'Giãn cơ'];

/** Lượt đặt nhìn từ phía khách. */
export interface MyBooking {
  id: string;
  gymerId: string;
  gymerName: string;
  gymerAvatarUrl?: string;
  start: string; // ISO
  end: string; // ISO
  price: number; // VND
  goal?: string;
  status: BookingStatus;
  expiresAt?: string; // chỉ khi status = 'pending'
  /** Chỉ có khi status = 'cancelled' và biết người huỷ. */
  cancelledBy?: CancelledBy;
  reviewed: boolean; // đã có đánh giá cho lượt này
  /** undefined = không có ghi chú; true/false = có ghi chú và đã/không chia sẻ với Gymer. */
  healthNoteShared?: boolean;
}

/** Trạng thái tài khoản Gymer của chính mình. */
export interface GymerAccountStatus {
  isListed: boolean;
  acceptsRequests: boolean;
  hasLocation: boolean;
}

/** Dữ liệu để đăng ký trở thành Gymer. */
export interface BecomeGymerInput {
  name: string;
  gender: Gender;
  birthYear: number;
  area: string;
  priceWeekday: number;
  priceWeekend: number;
  tags: Specialty[];
  avatarUrl?: string;
}

/** price: số = đặt giá riêng; null = bỏ giá riêng; undefined = không đổi. closed: true đóng cả ngày, false mở lại. */
export interface DayOverridePatch {
  closed?: boolean;
  price?: number | null;
}
