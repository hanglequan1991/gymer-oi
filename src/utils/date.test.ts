import { describe, expect, it } from 'vitest';
import { isPastDay, isSameDay, vnToday, vnTodayDate } from './date';

// Các ca dưới đây dùng mốc UTC cố định và Date local dựng bằng (năm, tháng 0-based, ngày),
// nên kết quả không đổi theo múi giờ của máy (chạy được cả với TZ=America/New_York).

describe('vnToday', () => {
  it('23:30 UTC ngày 16 là ngày 17 theo giờ Việt Nam', () => {
    expect(vnToday(new Date('2026-10-16T23:30:00Z'))).toEqual({ year: 2026, month: 9, day: 17 });
  });

  it('ranh giới nửa đêm VN: 16:59:59 UTC vẫn là ngày 16, 17:00:00 UTC là ngày 17', () => {
    expect(vnToday(new Date('2026-10-16T16:59:59Z'))).toEqual({ year: 2026, month: 9, day: 16 });
    expect(vnToday(new Date('2026-10-16T17:00:00Z'))).toEqual({ year: 2026, month: 9, day: 17 });
  });

  it('qua ranh giới tháng: 18:00 UTC ngày 31/10 là 01/11 theo giờ VN', () => {
    expect(vnToday(new Date('2026-10-31T18:00:00Z'))).toEqual({ year: 2026, month: 10, day: 1 });
  });

  it('qua ranh giới năm: 18:00 UTC ngày 31/12 là 01/01 theo giờ VN', () => {
    expect(vnToday(new Date('2026-12-31T18:00:00Z'))).toEqual({ year: 2027, month: 0, day: 1 });
  });
});

describe('vnTodayDate', () => {
  it('trả Date cùng ngày dương lịch VN, bất kể múi giờ máy', () => {
    const today = vnTodayDate(new Date('2026-10-16T23:30:00Z'));
    expect(isSameDay(today, new Date(2026, 9, 17))).toBe(true);
    expect(isSameDay(today, new Date(2026, 9, 16))).toBe(false);
  });

  it('isPastDay coi ngày 16 là quá khứ khi giờ VN đã sang ngày 17', () => {
    const today = vnTodayDate(new Date('2026-10-16T23:30:00Z'));
    expect(isPastDay(new Date(2026, 9, 16), today)).toBe(true);
    expect(isPastDay(new Date(2026, 9, 17), today)).toBe(false);
    expect(isPastDay(new Date(2026, 9, 18), today)).toBe(false);
  });

  it('tháng mặc định đúng ở ranh giới tháng', () => {
    const today = vnTodayDate(new Date('2026-10-31T18:00:00Z'));
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth()).toBe(10);
    expect(today.getDate()).toBe(1);
  });
});
