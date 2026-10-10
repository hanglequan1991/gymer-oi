import { describe, expect, it } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';
import { AppError } from '../errors';
import type { BookingCreateInput } from '../repositories/bookingRepository';
import { createBookingRepo } from './bookingRepo';

const VALID: BookingCreateInput = {
  gymerId: 'g1',
  startIso: '2026-10-17T01:00:00.000Z',
  endIso: '2026-10-17T02:00:00.000Z',
  goal: 'Giảm mỡ',
  note: 'Đau gối',
  expectedPrice: 300000,
  shareHealthNote: true,
};

async function catchError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error('kỳ vọng ném lỗi nhưng không ném');
}

describe('bookingRepo.create', () => {
  it('gọi create_booking đúng 6 tham số và trả bookingId', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'booking-uuid' } } });
    const repo = createBookingRepo(client);

    const result = await repo.create(VALID);

    expect(result).toEqual({ bookingId: 'booking-uuid' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: 'rpc',
      name: 'create_booking',
      args: {
        p_gymer_id: 'g1',
        p_starts_at: '2026-10-17T01:00:00.000Z',
        p_goal: 'Giảm mỡ',
        p_health_note: 'Đau gối',
        p_expected_price: 300000,
        p_share_health_note: true,
      },
    });
    expect(Object.keys((calls[0] as { args: object }).args)).toHaveLength(6);
  });

  it('truyền expectedPrice của input nguyên văn, không tính lại giá', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'b2' } } });
    await createBookingRepo(client).create({ ...VALID, expectedPrice: 123456 });
    expect(calls[0]).toMatchObject({ kind: 'rpc', args: { p_expected_price: 123456 } });
  });

  it('thiếu goal/note/shareHealthNote thì gửi chuỗi rỗng và false', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'b3' } } });
    const minimal: BookingCreateInput = {
      gymerId: 'g1',
      startIso: VALID.startIso,
      endIso: VALID.endIso,
      expectedPrice: 300000,
    };
    await createBookingRepo(client).create(minimal);
    expect(calls[0]).toMatchObject({
      args: { p_goal: '', p_health_note: '', p_share_health_note: false },
    });
  });

  it('endIso lệch khỏi 60 phút -> VALIDATION và không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'x' } } });
    const err = await catchError(
      createBookingRepo(client).create({ ...VALID, endIso: '2026-10-17T02:30:00.000Z' }),
    );
    expect(err.code).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('ngày không hợp lệ -> VALIDATION và không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'x' } } });
    const err = await catchError(createBookingRepo(client).create({ ...VALID, startIso: 'không-phải-ngày' }));
    expect(err.code).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('startIso thiếu offset múi giờ -> VALIDATION và không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'x' } } });
    const err = await catchError(
      createBookingRepo(client).create({ ...VALID, startIso: '2026-10-17T07:00:00', endIso: '2026-10-17T08:00:00' }),
    );
    expect(err.code).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('endIso thiếu offset múi giờ -> VALIDATION và không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'x' } } });
    const err = await catchError(
      createBookingRepo(client).create({
        ...VALID,
        startIso: '2026-10-17T07:00:00+07:00',
        endIso: '2026-10-17T08:00:00',
      }),
    );
    expect(err.code).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('offset +07:00 hợp lệ: gửi đúng chuỗi nhập cho p_starts_at, không đổi định dạng', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'b4' } } });
    const result = await createBookingRepo(client).create({
      ...VALID,
      startIso: '2026-10-17T07:00:00+07:00',
      endIso: '2026-10-17T08:00:00+07:00',
    });
    expect(result).toEqual({ bookingId: 'b4' });
    expect(calls[0]).toMatchObject({
      kind: 'rpc',
      name: 'create_booking',
      args: { p_starts_at: '2026-10-17T07:00:00+07:00' },
    });
  });

  it('offset dạng ±hhmm (không có dấu hai chấm) cũng được chấp nhận', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: 'b5' } } });
    await createBookingRepo(client).create({
      ...VALID,
      startIso: '2026-10-17T07:00:00+0700',
      endIso: '2026-10-17T08:00:00+0700',
    });
    expect(calls[0]).toMatchObject({ args: { p_starts_at: '2026-10-17T07:00:00+0700' } });
  });

  it('23505 (unique_violation) không phải xung đột đặt lịch: trả UNKNOWN, không SLOT_TAKEN', async () => {
    const raw = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { error: raw } } });
    const err = await catchError(createBookingRepo(client).create(VALID));
    expect(err.code).toBe('UNKNOWN');
    expect(err.cause).toBe(raw);
    expect(calls).toHaveLength(1);
  });

  it.each([
    ['SLOT_TAKEN', 'SLOT_TAKEN'],
    ['SLOT_NOT_OPEN', 'SLOT_NOT_OPEN'],
    ['PRICE_CHANGED', 'PRICE_CHANGED'],
    ['LIMIT_REACHED', 'LIMIT_REACHED'],
    ['FORBIDDEN', 'FORBIDDEN'],
    ['NOT_FOUND', 'NOT_FOUND'],
    ['VALIDATION', 'VALIDATION'],
  ])('RPC báo %s -> %s, gọi đúng một lần', async (message, expected) => {
    const { client, calls } = createFakeSupabase({
      rpc: { create_booking: { error: { code: 'P0001', message } } },
    });
    const err = await catchError(createBookingRepo(client).create(VALID));
    expect(err.code).toBe(expected);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: 'rpc', name: 'create_booking' });
  });

  it('lỗi mạng -> NETWORK', async () => {
    const { client, calls } = createFakeSupabase({
      rpc: { create_booking: { error: { message: 'TypeError: Failed to fetch' } } },
    });
    const err = await catchError(createBookingRepo(client).create(VALID));
    expect(err.code).toBe('NETWORK');
    expect(calls).toHaveLength(1);
  });

  it('không có data và không có lỗi -> UNKNOWN', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_booking: { data: null } } });
    const err = await catchError(createBookingRepo(client).create(VALID));
    expect(err.code).toBe('UNKNOWN');
    expect(calls).toHaveLength(1);
  });
});
