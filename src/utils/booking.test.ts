import { describe, expect, it } from 'vitest';
import {
  formatVNDeadline,
  formatVNTime,
  formatVNWeekdayDate,
  isExpired,
  slotIdToIsoRange,
} from './booking';

const now = new Date('2026-10-10T10:00:00Z');
const past = '2026-10-10T09:59:59Z';
const future = '2026-10-10T10:00:01Z';

describe('isExpired', () => {
  it('status expired luôn là hết hạn, dù expiresAt ở đâu', () => {
    expect(isExpired('expired', future, now)).toBe(true);
    expect(isExpired('expired', past, now)).toBe(true);
  });

  it('pending quá hạn (expiresAt trước now) là hết hạn', () => {
    expect(isExpired('pending', past, now)).toBe(true);
  });

  it('pending đúng thời điểm expiresAt bằng now là hết hạn (<=)', () => {
    expect(isExpired('pending', now.toISOString(), now)).toBe(true);
  });

  it('pending còn hạn là chưa hết hạn', () => {
    expect(isExpired('pending', future, now)).toBe(false);
  });

  it('nhận expiresAt dạng Date', () => {
    expect(isExpired('pending', new Date(past), now)).toBe(true);
    expect(isExpired('pending', new Date(future), now)).toBe(false);
  });

  it.each(['confirmed', 'rejected', 'cancelled'] as const)(
    'trạng thái %s không bao giờ là hết hạn, dù expiresAt đã qua',
    (status) => {
      expect(isExpired(status, past, now)).toBe(false);
    },
  );

  it('expiresAt không đọc được thì không coi là hết hạn', () => {
    expect(isExpired('pending', 'khong-phai-ngay', now)).toBe(false);
  });
});

describe('slotIdToIsoRange', () => {
  it('đổi khung giờ VN thành khoảng 60 phút có offset +07:00', () => {
    expect(slotIdToIsoRange('2026-10-17T09:00')).toEqual({
      startIso: '2026-10-17T09:00:00+07:00',
      endIso: '2026-10-17T10:00:00+07:00',
    });
  });

  it('qua nửa đêm vẫn đúng ngày', () => {
    expect(slotIdToIsoRange('2026-10-17T23:00')).toEqual({
      startIso: '2026-10-17T23:00:00+07:00',
      endIso: '2026-10-18T00:00:00+07:00',
    });
  });

  it('cuối tháng và cuối năm chuyển đúng', () => {
    expect(slotIdToIsoRange('2026-10-31T23:00')?.endIso).toBe('2026-11-01T00:00:00+07:00');
    expect(slotIdToIsoRange('2026-12-31T23:00')?.endIso).toBe('2027-01-01T00:00:00+07:00');
  });

  it('ngày nhuận đúng: 29/02/2028 có thật, 29/02/2027 thì không', () => {
    expect(slotIdToIsoRange('2028-02-29T07:00')?.startIso).toBe('2028-02-29T07:00:00+07:00');
    expect(slotIdToIsoRange('2027-02-29T07:00')).toBeNull();
  });

  it('sai định dạng hoặc giá trị không hợp lệ thì trả null', () => {
    expect(slotIdToIsoRange('2026-10-17')).toBeNull();
    expect(slotIdToIsoRange('2026-10-17 09:00')).toBeNull();
    expect(slotIdToIsoRange('2026-10-17T9:00')).toBeNull();
    expect(slotIdToIsoRange('2026-13-01T09:00')).toBeNull();
    expect(slotIdToIsoRange('2026-10-17T24:00')).toBeNull();
    expect(slotIdToIsoRange('2026-10-17T09:60')).toBeNull();
    expect(slotIdToIsoRange('2026-10-17T09:00:00+07:00')).toBeNull();
    expect(slotIdToIsoRange('')).toBeNull();
  });
});

describe('định dạng giờ Việt Nam', () => {
  // Mốc UTC 02:30 là 09:30 giờ VN; chạy đúng bất kể múi giờ của máy.
  const iso = '2026-10-16T23:30:00Z'; // 23:30 UTC thứ 6 = 06:30 VN thứ 7 17/10

  it('formatVNTime lấy giờ Việt Nam, không phải giờ UTC', () => {
    expect(formatVNTime(iso)).toBe('06:30');
  });

  it('formatVNWeekdayDate lấy thứ và ngày theo giờ Việt Nam', () => {
    expect(formatVNWeekdayDate(iso)).toBe('Thứ 7, 17/10');
  });

  it('formatVNDeadline ghép "HH:mm dd/MM"', () => {
    expect(formatVNDeadline(iso)).toBe('06:30 17/10');
  });
});
