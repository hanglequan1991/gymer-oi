import { describe, expect, it } from 'vitest';
import type { MyBooking } from '@/types/domain';
import {
  bookingTab,
  canCancel,
  canReview,
  isBookingExpired,
  shouldRefetchAfter,
  splitBookings,
} from './utils';

// Mốc cố định để các ca không phụ thuộc đồng hồ thật.
const NOW = new Date('2026-10-15T03:00:00Z'); // 10:00 VN ngày 15/10
const HOUR = 60 * 60 * 1000;

function at(offsetHours: number): string {
  return new Date(NOW.getTime() + offsetHours * HOUR).toISOString();
}

/** Lượt đặt mẫu: bắt đầu sau `startH` giờ (âm = đã qua), kéo dài 1 giờ. */
function booking(over: Partial<MyBooking> & { startH?: number } = {}): MyBooking {
  const { startH = 24, ...rest } = over;
  return {
    id: 'b',
    gymerId: 'g1',
    gymerName: 'Minh Hà',
    start: at(startH),
    end: at(startH + 1),
    price: 200000,
    status: 'confirmed',
    reviewed: false,
    ...rest,
  };
}

describe('isBookingExpired', () => {
  it('pending quá expiresAt là hết hạn, dù server chưa đổi trạng thái', () => {
    expect(isBookingExpired(booking({ status: 'pending', expiresAt: at(-1) }), NOW)).toBe(true);
  });

  it('pending còn hạn thì không hết hạn', () => {
    expect(isBookingExpired(booking({ status: 'pending', expiresAt: at(1) }), NOW)).toBe(false);
  });

  it('status expired luôn là hết hạn, kể cả khi không có expiresAt', () => {
    expect(isBookingExpired(booking({ status: 'expired' }), NOW)).toBe(true);
  });
});

describe('bookingTab', () => {
  it('pending còn hạn và chưa kết thúc vào Sắp tới', () => {
    expect(bookingTab(booking({ status: 'pending', expiresAt: at(1) }), NOW)).toBe('upcoming');
  });

  it('pending quá hạn vào Lịch sử', () => {
    expect(bookingTab(booking({ status: 'pending', expiresAt: at(-1), startH: 48 }), NOW)).toBe('history');
  });

  it('confirmed chưa kết thúc vào Sắp tới, đã kết thúc vào Lịch sử', () => {
    expect(bookingTab(booking({ status: 'confirmed', startH: 5 }), NOW)).toBe('upcoming');
    expect(bookingTab(booking({ status: 'confirmed', startH: -3 }), NOW)).toBe('history');
  });

  it('rejected và cancelled luôn vào Lịch sử', () => {
    expect(bookingTab(booking({ status: 'rejected' }), NOW)).toBe('history');
    expect(bookingTab(booking({ status: 'cancelled' }), NOW)).toBe('history');
  });
});

describe('canCancel', () => {
  it.each([
    ['pending còn hạn', booking({ status: 'pending', expiresAt: at(1) }), true],
    ['pending quá hạn', booking({ status: 'pending', expiresAt: at(-1) }), false],
    ['confirmed chưa đến giờ bắt đầu', booking({ status: 'confirmed', startH: 2 }), true],
    ['confirmed đã đến giờ bắt đầu', booking({ status: 'confirmed', startH: -1 }), false],
    ['rejected', booking({ status: 'rejected' }), false],
    ['cancelled', booking({ status: 'cancelled' }), false],
  ])('%s -> %s', (_label, b, expected) => {
    expect(canCancel(b, NOW)).toBe(expected);
  });
});

describe('canReview', () => {
  it.each([
    ['confirmed đã kết thúc, chưa đánh giá', booking({ status: 'confirmed', startH: -3 }), true],
    ['confirmed đã kết thúc, đã đánh giá', booking({ status: 'confirmed', startH: -3, reviewed: true }), false],
    ['confirmed chưa kết thúc', booking({ status: 'confirmed', startH: 2 }), false],
    ['pending quá hạn', booking({ status: 'pending', expiresAt: at(-1), startH: -3 }), false],
    ['cancelled', booking({ status: 'cancelled', startH: -3 }), false],
  ])('%s -> %s', (_label, b, expected) => {
    expect(canReview(b, NOW)).toBe(expected);
  });
});

describe('shouldRefetchAfter', () => {
  it('FORBIDDEN và NOT_FOUND cần tải lại, lỗi khác thì không', () => {
    expect(shouldRefetchAfter({ code: 'FORBIDDEN' })).toBe(true);
    expect(shouldRefetchAfter({ code: 'NOT_FOUND' })).toBe(true);
    expect(shouldRefetchAfter({ code: 'NETWORK' })).toBe(false);
    expect(shouldRefetchAfter(new Error('x'))).toBe(false);
  });
});

describe('splitBookings', () => {
  it('Sắp tới sắp theo giờ bắt đầu tăng dần, Lịch sử giữ thứ tự cũ', () => {
    const later = booking({ id: 'later', status: 'confirmed', startH: 48 });
    const sooner = booking({ id: 'sooner', status: 'confirmed', startH: 5 });
    const past1 = booking({ id: 'past1', status: 'confirmed', startH: -5 });
    const past2 = booking({ id: 'past2', status: 'rejected', startH: -30 });
    const { upcoming, history } = splitBookings([later, past1, sooner, past2], NOW);
    expect(upcoming.map((b) => b.id)).toEqual(['sooner', 'later']);
    expect(history.map((b) => b.id)).toEqual(['past1', 'past2']);
  });
});
