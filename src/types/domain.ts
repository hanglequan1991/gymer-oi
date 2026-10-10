// Kiểu miền dùng chung cho core-ui và mock (docs/core-ui-plan.md, mục 4).

export type Gender = 'female' | 'male';
export type Specialty = 'Gym' | 'Giảm mỡ' | 'Tăng cơ' | 'Yoga' | 'Calisthenics' | 'Giãn cơ';
export type SlotState = 'available' | 'booked' | 'closed' | 'selected'; // closed = Gymer chủ động đóng
export type RequestStatus = 'pending' | 'confirmed' | 'rejected';
export type BookingStatus = RequestStatus | 'cancelled' | 'expired'; // phía khách; 'expired' chỉ là nhãn, xem utils/booking.ts

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
  note?: string;
  price: number;
  status: RequestStatus;
  /** Hạn xác nhận (ISO), chỉ có với yêu cầu chờ duyệt; dùng với isExpired để ẩn yêu cầu quá hạn. */
  expiresAt?: string;
  isNew?: boolean;
}

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
