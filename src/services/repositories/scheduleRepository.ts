// Cổng lịch và giá của Gymer (chỉ interface, chưa có cài đặt).
import type { DayInfo, Slot } from '@/types/domain';

export interface ScheduleRepository {
  /** Lịch theo tháng; `month` là 1-12 (không phải 0-11). Giá đã được tính ở server. */
  getMonth(gymerId: string, year: number, month: number): Promise<DayInfo[]>;
  /** Các khung giờ trong một ngày. Slot.id = "<dateIso>T<HH:mm>" theo giờ Việt Nam, ví dụ "2026-10-17T07:00". */
  getDaySlots(gymerId: string, dateIso: string): Promise<Slot[]>;

  // Phía Gymer
  /** Đặt giá ngày thường và cuối tuần. */
  setPrices(input: { weekday: number; weekend: number }): Promise<void>;
  /** Gymer chủ động đóng hoặc mở một khung giờ. slotId theo định dạng "<dateIso>T<HH:mm>" (giờ Việt Nam), như Slot.id. */
  setSlotClosed(slotId: string, closed: boolean): Promise<void>;
}
