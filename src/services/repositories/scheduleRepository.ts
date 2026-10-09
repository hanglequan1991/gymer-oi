// Cổng lịch và giá của Gymer (chỉ interface, chưa có cài đặt).
import type { DayInfo, Slot } from '@/types/domain';

export interface ScheduleRepository {
  /** Lịch theo tháng; giá đã được tính ở server. */
  getMonth(gymerId: string, year: number, month: number): Promise<DayInfo[]>;
  /** Các khung giờ trong một ngày. */
  getDaySlots(gymerId: string, dateIso: string): Promise<Slot[]>;

  // Phía Gymer
  /** Đặt giá ngày thường và cuối tuần. */
  setPrices(input: { weekday: number; weekend: number }): Promise<void>;
  /** Gymer chủ động đóng hoặc mở một khung giờ. */
  setSlotClosed(slotId: string, closed: boolean): Promise<void>;
}
