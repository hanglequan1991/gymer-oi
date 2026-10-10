import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { parseSlotId, slotIdToIsoRange, toDayInfo, toSlot } from './schedule';

describe('toDayInfo', () => {
  it('dựng date theo ngày local, không lệch ngày theo múi giờ', () => {
    const info = toDayInfo({ day: '2026-10-17', price_vnd: 350000, is_open: true, has_booked: false });
    expect(info.date.getFullYear()).toBe(2026);
    expect(info.date.getMonth()).toBe(9); // tháng 10 (0-11)
    expect(info.date.getDate()).toBe(17);
  });

  it('giữ nguyên giá server trả cho T7 (2026-10-17) và CN (2026-10-18); mapper không tự tính giá', () => {
    const sat = toDayInfo({ day: '2026-10-17', price_vnd: 350000, is_open: true, has_booked: false });
    const sun = toDayInfo({ day: '2026-10-18', price_vnd: 420000, is_open: true, has_booked: false });
    expect(sat.date.getDay()).toBe(6);
    expect(sat.price).toBe(350000);
    expect(sun.date.getDay()).toBe(0);
    expect(sun.price).toBe(420000);
  });

  it('marker và disabled theo is_open / has_booked', () => {
    expect(toDayInfo({ day: '2026-10-19', price_vnd: 1, is_open: true, has_booked: false })).toMatchObject({
      marker: 'open',
      disabled: false,
    });
    expect(toDayInfo({ day: '2026-10-19', price_vnd: 1, is_open: true, has_booked: true })).toMatchObject({
      marker: 'booked',
      disabled: false,
    });
    expect(toDayInfo({ day: '2026-10-19', price_vnd: 1, is_open: false, has_booked: false })).toMatchObject({
      marker: 'none',
      disabled: true,
    });
    // Có khách đặt dù đã đóng: vẫn hiện là đã đặt, không vô hiệu hoá.
    expect(toDayInfo({ day: '2026-10-19', price_vnd: 1, is_open: false, has_booked: true })).toMatchObject({
      marker: 'booked',
      disabled: false,
    });
  });

  it('ngày sai định dạng: UNKNOWN', () => {
    expect(() => toDayInfo({ day: '17/10/2026', price_vnd: 1, is_open: true, has_booked: false })).toThrow(AppError);
  });
});

describe('toSlot', () => {
  it('id là "<dateIso>T<HH:mm>", time cắt từ HH:MM:SS', () => {
    const slot = toSlot('2026-10-17', { start_time: '07:00:00', state: 'available', booked_by: null });
    expect(slot).toEqual({ id: '2026-10-17T07:00', time: '07:00', state: 'available', bookedBy: undefined });
  });

  it('booked_by null thì bookedBy undefined; có giá trị thì giữ nguyên', () => {
    const open = toSlot('2026-10-17', { start_time: '08:00:00', state: 'closed', booked_by: null });
    expect(open.bookedBy).toBeUndefined();
    const booked = toSlot('2026-10-17', { start_time: '09:00:00', state: 'booked', booked_by: 'user-9' });
    expect(booked).toMatchObject({ state: 'booked', bookedBy: 'user-9' });
  });

  it('trạng thái ngoài available/booked/closed: UNKNOWN', () => {
    expect(() => toSlot('2026-10-17', { start_time: '07:00:00', state: 'selected', booked_by: null })).toThrow(
      AppError,
    );
  });
});

describe('parseSlotId', () => {
  it('tách ngày và giờ bắt đầu', () => {
    expect(parseSlotId('2026-10-17T07:00')).toEqual({ day: '2026-10-17', startTime: '07:00' });
    expect(parseSlotId('2026-10-18T23:59')).toEqual({ day: '2026-10-18', startTime: '23:59' });
  });

  it.each([
    ['sai dấu phân cách', '2026-10-17 07:00'],
    ['thiếu giờ', '2026-10-17T07'],
    ['chuỗi rỗng', ''],
    ['giờ 24', '2026-10-17T24:00'],
    ['phút 60', '2026-10-17T07:60'],
    ['tháng 13', '2026-13-01T07:00'],
    ['ngày 30/2', '2026-02-30T07:00'],
  ])('%s: VALIDATION', (_label, slotId) => {
    try {
      parseSlotId(slotId);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('VALIDATION');
    }
  });
});

describe('slotIdToIsoRange', () => {
  it('đổi 07:00 thành khoảng 07:00-08:00 có offset +07:00', () => {
    expect(slotIdToIsoRange('2026-10-17T07:00')).toEqual({
      startIso: '2026-10-17T07:00:00+07:00',
      endIso: '2026-10-17T08:00:00+07:00',
    });
  });

  it('23:00 qua sang ngày kế tiếp (00:00 +07:00)', () => {
    expect(slotIdToIsoRange('2026-10-17T23:00')).toEqual({
      startIso: '2026-10-17T23:00:00+07:00',
      endIso: '2026-10-18T00:00:00+07:00',
    });
  });

  it('qua tháng và qua năm', () => {
    expect(slotIdToIsoRange('2026-10-31T23:00').endIso).toBe('2026-11-01T00:00:00+07:00');
    expect(slotIdToIsoRange('2026-12-31T23:00').endIso).toBe('2027-01-01T00:00:00+07:00');
  });

  it('qua năm nhuận', () => {
    expect(slotIdToIsoRange('2028-02-28T23:00').endIso).toBe('2028-02-29T00:00:00+07:00');
  });

  it.each([
    ['sai định dạng', '2026-10-17 07:00'],
    ['chuỗi rỗng', ''],
    ['ngày 30/2', '2026-02-30T07:00'],
  ])('%s: VALIDATION', (_label, slotId) => {
    try {
      slotIdToIsoRange(slotId);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('VALIDATION');
    }
  });
});
