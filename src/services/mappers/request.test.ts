import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { toBookingRequest } from './request';
import type { RequestRow } from './request';

function row(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: 'b1',
    starts_at: '2026-10-17T01:00:00.000Z',
    ends_at: '2026-10-17T02:00:00.000Z',
    price_vnd: 300000,
    goal: 'Giảm mỡ',
    status: 'pending',
    expires_at: '2026-10-16T01:00:00.000Z',
    profiles: { display_name: 'Lan' },
    booking_health_notes: null,
    ...overrides,
  };
}

describe('toBookingRequest', () => {
  it('map đủ trường của yêu cầu chờ duyệt, có expiresAt', () => {
    expect(toBookingRequest(row())).toEqual({
      id: 'b1',
      customerName: 'Lan',
      start: '2026-10-17T01:00:00.000Z',
      end: '2026-10-17T02:00:00.000Z',
      goal: 'Giảm mỡ',
      price: 300000,
      status: 'pending',
      expiresAt: '2026-10-16T01:00:00.000Z',
    });
  });

  it('không đặt expiresAt cho yêu cầu đã xác nhận hoặc từ chối', () => {
    const confirmed = toBookingRequest(row({ status: 'confirmed' }));
    const rejected = toBookingRequest(row({ status: 'rejected' }));
    expect(confirmed).not.toHaveProperty('expiresAt');
    expect(rejected).not.toHaveProperty('expiresAt');
    expect(confirmed.status).toBe('confirmed');
    expect(rejected.status).toBe('rejected');
  });

  it('chấp nhận embed profiles dạng mảng', () => {
    expect(toBookingRequest(row({ profiles: [{ display_name: 'Minh' }] })).customerName).toBe('Minh');
  });

  it('customerName rỗng khi profiles null hoặc mảng rỗng', () => {
    expect(toBookingRequest(row({ profiles: null })).customerName).toBe('');
    expect(toBookingRequest(row({ profiles: [] })).customerName).toBe('');
  });

  it('không có key goal khi goal null hoặc rỗng', () => {
    expect(toBookingRequest(row({ goal: null }))).not.toHaveProperty('goal');
    expect(toBookingRequest(row({ goal: '' }))).not.toHaveProperty('goal');
  });

  it('embed booking_health_notes là object và shared_with_gymer = true -> gán note', () => {
    const r = toBookingRequest(row({ booking_health_notes: { note: 'Đau gối', shared_with_gymer: true } }));
    expect(r.note).toBe('Đau gối');
  });

  it('embed là mảng và shared_with_gymer = true -> gán note từ phần tử đầu', () => {
    const r = toBookingRequest(row({ booking_health_notes: [{ note: 'Đau lưng', shared_with_gymer: true }] }));
    expect(r.note).toBe('Đau lưng');
  });

  it('embed null hoặc mảng rỗng -> không có key note', () => {
    expect(toBookingRequest(row({ booking_health_notes: null }))).not.toHaveProperty('note');
    expect(toBookingRequest(row({ booking_health_notes: [] }))).not.toHaveProperty('note');
  });

  it('shared_with_gymer = false -> không gán note, kể cả khi note có chữ', () => {
    const object = toBookingRequest(row({ booking_health_notes: { note: 'Đau gối', shared_with_gymer: false } }));
    const array = toBookingRequest(row({ booking_health_notes: [{ note: 'Đau gối', shared_with_gymer: false }] }));
    expect(object).not.toHaveProperty('note');
    expect(array).not.toHaveProperty('note');
  });

  it('note rỗng hoặc chỉ khoảng trắng dù được chia sẻ -> không có key note', () => {
    expect(toBookingRequest(row({ booking_health_notes: { note: '', shared_with_gymer: true } }))).not.toHaveProperty('note');
    expect(toBookingRequest(row({ booking_health_notes: { note: '   ', shared_with_gymer: true } }))).not.toHaveProperty('note');
  });

  it('ném UNKNOWN với trạng thái ngoài pending/confirmed/rejected', () => {
    for (const status of ['cancelled', 'expired'] as const) {
      let caught: unknown;
      try {
        toBookingRequest(row({ status }));
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AppError);
      expect((caught as AppError).code).toBe('UNKNOWN');
    }
  });
});
