import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { toMyBooking } from './booking';
import type { MyBookingRow } from './booking';

function row(overrides: Partial<MyBookingRow> = {}): MyBookingRow {
  return {
    id: 'b1',
    gymer_id: 'g1',
    starts_at: '2026-10-17T01:00:00.000Z',
    ends_at: '2026-10-17T02:00:00.000Z',
    price_vnd: 300000,
    goal: 'Giảm mỡ',
    status: 'confirmed',
    expires_at: '2026-10-16T01:00:00.000Z',
    gymer_profiles: { display_name: 'Minh', avatar_url: 'https://cdn.example/a.jpg' },
    reviews: [],
    ...overrides,
  };
}

describe('toMyBooking', () => {
  it('map đủ trường của lượt đã xác nhận, chưa đánh giá, không có expiresAt', () => {
    expect(toMyBooking(row())).toEqual({
      id: 'b1',
      gymerId: 'g1',
      gymerName: 'Minh',
      gymerAvatarUrl: 'https://cdn.example/a.jpg',
      start: '2026-10-17T01:00:00.000Z',
      end: '2026-10-17T02:00:00.000Z',
      price: 300000,
      goal: 'Giảm mỡ',
      status: 'confirmed',
      reviewed: false,
    });
  });

  it('pending: có expiresAt lấy từ expires_at', () => {
    const b = toMyBooking(row({ status: 'pending', expires_at: '2026-10-16T09:00:00.000Z' }));
    expect(b.status).toBe('pending');
    expect(b.expiresAt).toBe('2026-10-16T09:00:00.000Z');
  });

  it.each(['confirmed', 'rejected', 'cancelled', 'expired'] as const)(
    '%s: không có expiresAt',
    (status) => {
      const b = toMyBooking(row({ status }));
      expect(b.status).toBe(status);
      expect(b).not.toHaveProperty('expiresAt');
    },
  );

  it('cancelled và expired được giữ nguyên trạng thái', () => {
    expect(toMyBooking(row({ status: 'cancelled' })).status).toBe('cancelled');
    expect(toMyBooking(row({ status: 'expired' })).status).toBe('expired');
  });

  it('có đánh giá trong embed -> reviewed true', () => {
    expect(toMyBooking(row({ reviews: [{ id: 'r1' }] })).reviewed).toBe(true);
  });

  it('reviews null (không có embed) -> reviewed false', () => {
    expect(toMyBooking(row({ reviews: null })).reviewed).toBe(false);
  });

  it('gymer_profiles là mảng (PostgREST) vẫn lấy được tên và ảnh', () => {
    const b = toMyBooking(row({ gymer_profiles: [{ display_name: 'Lan', avatar_url: 'https://cdn.example/l.jpg' }] }));
    expect(b.gymerName).toBe('Lan');
    expect(b.gymerAvatarUrl).toBe('https://cdn.example/l.jpg');
  });

  it('thiếu avatar: không có key gymerAvatarUrl', () => {
    const b = toMyBooking(row({ gymer_profiles: { display_name: 'Lan', avatar_url: null } }));
    expect(b).not.toHaveProperty('gymerAvatarUrl');
  });

  it('thiếu gymer_profiles: gymerName rỗng, không có avatar', () => {
    const b = toMyBooking(row({ gymer_profiles: null }));
    expect(b.gymerName).toBe('');
    expect(b).not.toHaveProperty('gymerAvatarUrl');
  });

  it('goal null hoặc chỉ khoảng trắng: không có key goal', () => {
    expect(toMyBooking(row({ goal: null }))).not.toHaveProperty('goal');
    expect(toMyBooking(row({ goal: '   ' }))).not.toHaveProperty('goal');
  });

  it('trạng thái ngoài enum: ném UNKNOWN', () => {
    expect(() => toMyBooking(row({ status: 'lạ' as MyBookingRow['status'] }))).toThrow(AppError);
    try {
      toMyBooking(row({ status: 'lạ' as MyBookingRow['status'] }));
    } catch (e) {
      expect((e as AppError).code).toBe('UNKNOWN');
    }
  });
});
