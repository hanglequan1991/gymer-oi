import { describe, expect, it } from 'vitest';
import { isExpired } from './booking';

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
