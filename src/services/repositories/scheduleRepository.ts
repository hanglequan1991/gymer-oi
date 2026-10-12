// Cổng lịch và giá của Gymer (chỉ interface, chưa có cài đặt).
import type { DayInfo, DayOverridePatch, Slot } from '@/types/domain';

export interface ScheduleRepository {
  /** Lịch theo tháng; `month` là 1-12 (không phải 0-11). Giá đã được tính ở server. */
  getMonth(gymerId: string, year: number, month: number): Promise<DayInfo[]>;
  /** Các khung giờ trong một ngày. Slot.id = "<dateIso>T<HH:mm>" theo giờ Việt Nam, ví dụ "2026-10-17T07:00". */
  getDaySlots(gymerId: string, dateIso: string): Promise<Slot[]>;
  /** Ngày đóng của chính Gymer trong tháng (có gymer_day_overrides.is_open = false), dạng 'YYYY-MM-DD'. `month` là 1-12. */
  getClosedDays(year: number, month: number): Promise<string[]>;

  // Phía Gymer
  /** Đặt giá ngày thường và cuối tuần. */
  setPrices(input: { weekday: number; weekend: number }): Promise<void>;
  /** Gymer chủ động đóng hoặc mở một khung giờ. slotId theo định dạng "<dateIso>T<HH:mm>" (giờ Việt Nam), như Slot.id. */
  setSlotClosed(slotId: string, closed: boolean): Promise<void>;
  /** Đặt/bỏ giá riêng và đóng/mở theo ngày. dateIsos là 'YYYY-MM-DD', tối đa 62 ngày (quá: VALIDATION).
   *  Ngày đã có lịch đặt không đóng được (server báo VALIDATION): ngày đó vào `skipped`, các ngày khác vẫn áp dụng.
   *  Lỗi khác: ném. */
  setDayOverrides(dateIsos: string[], patch: DayOverridePatch): Promise<{ applied: string[]; skipped: string[] }>;
}
