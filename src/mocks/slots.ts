// Dữ liệu mock khung giờ trong ngày và lịch tháng.
import type { DayInfo, Slot } from '@/types/domain';
import { isPastDay } from '@/utils/date';

/** "Hôm nay" cố định cho mock: 09/10/2026 (month 0-based). */
export const MOCK_TODAY = new Date(2026, 9, 9);

const MOCK_WEEKDAY_PRICE = 180_000;
const MOCK_WEEKEND_PRICE = 220_000;

export const MOCK_SLOTS: Slot[] = [
  { id: 'slot-0700', time: '07:00', state: 'available' },
  { id: 'slot-0900', time: '09:00', state: 'booked', bookedBy: 'Hoàng Nam' },
  { id: 'slot-1000', time: '10:00', state: 'available' },
  { id: 'slot-1400', time: '14:00', state: 'closed' },
  { id: 'slot-1600', time: '16:00', state: 'available' },
  { id: 'slot-1700', time: '17:00', state: 'booked', bookedBy: 'Minh Quân' },
  { id: 'slot-1800', time: '18:00', state: 'available' },
  { id: 'slot-1900', time: '19:00', state: 'available' },
];

/**
 * Trả về thông tin mọi ngày của tháng cho lịch mock.
 * - Giá: 180k ngày thường, 220k T7 và CN.
 * - Ngày trước MOCK_TODAY: disabled.
 * - Marker xen kẽ theo ngày để trông như có dữ liệu thật.
 * month là 0-based.
 */
export function mockDays(year: number, month: number): DayInfo[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: DayInfo[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const disabled = isPastDay(date, MOCK_TODAY);
    const cycle = d % 5;
    let marker: DayInfo['marker'] = 'none';
    if (!disabled) {
      if (cycle === 0) marker = 'booked';
      else if (cycle === 1 || cycle === 3) marker = 'open';
    }
    result.push({
      date,
      price: isWeekend ? MOCK_WEEKEND_PRICE : MOCK_WEEKDAY_PRICE,
      disabled,
      marker,
    });
  }
  return result;
}
