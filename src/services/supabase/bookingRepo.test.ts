import { describe, expect, it } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';
import type { FakeCall, FakeScript } from '@/test/fakeSupabase';
import { AppError } from '../errors';
import type { BookingCreateInput } from '../repositories/bookingRepository';
import type { MyBookingRow } from '../mappers/booking';
import { MY_BOOKING_SELECT, createBookingRepo } from './bookingRepo';

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

/** Chỉ các lệnh RPC; requireUserId cũng ghi lệnh auth.getSession. */
function rpcCalls(calls: FakeCall[]): FakeCall[] {
  return calls.filter((c) => c.kind === 'rpc');
}

const SIGNED_IN = { auth: { session: { user: { id: 'u1' } } } } satisfies FakeScript;

function bookingRow(overrides: Partial<MyBookingRow> = {}): MyBookingRow {
  return {
    id: 'b1',
    gymer_id: 'g1',
    starts_at: '2026-10-17T01:00:00.000Z',
    ends_at: '2026-10-17T02:00:00.000Z',
    price_vnd: 300000,
    goal: 'Giảm mỡ',
    status: 'confirmed',
    expires_at: '2026-10-16T01:00:00.000Z',
    cancelled_by: null,
    gymer_profiles: { display_name: 'Minh', avatar_url: null },
    reviews: [],
    ...overrides,
  };
}

/** Tên các bước chuỗi builder của lệnh from đầu tiên, theo thứ tự gọi. */
function methodsOf(call: FakeCall): string[] {
  return (call.filters ?? []).map((step) => step.method);
}

describe('bookingRepo.getMine', () => {
  it('chưa đăng nhập -> UNAUTHENTICATED và không truy vấn bookings', async () => {
    const { client, calls } = createFakeSupabase({ from: { bookings: { data: null } } });
    const err = await catchError(createBookingRepo(client).getMine('b1'));
    expect(err.code).toBe('UNAUTHENTICATED');
    expect(calls.some((c) => c.kind === 'from')).toBe(false);
  });

  it('lọc theo customer_id = uid và id, maybeSingle, chọn đúng embed; map kết quả', async () => {
    const { client, calls } = createFakeSupabase({
      ...SIGNED_IN,
      from: { bookings: { data: bookingRow({ reviews: [{ id: 'r1' }] }) } },
    });
    const result = await createBookingRepo(client).getMine('b1');

    const call = calls.find((c) => c.kind === 'from' && c.table === 'bookings');
    expect(call).toBeDefined();
    expect(methodsOf(call as FakeCall)).toEqual(['select', 'eq', 'eq', 'maybeSingle']);
    expect((call as FakeCall).filters?.[0].args).toEqual([MY_BOOKING_SELECT]);
    expect((call as FakeCall).filters?.slice(1, 3).map((s) => s.args)).toEqual([
      ['customer_id', 'u1'],
      ['id', 'b1'],
    ]);
    expect(MY_BOOKING_SELECT).toContain('gymer_profiles!bookings_gymer_id_fkey(display_name, avatar_url)');
    expect(MY_BOOKING_SELECT).toContain('reviews(id)');

    expect(result).toMatchObject({ id: 'b1', gymerId: 'g1', gymerName: 'Minh', reviewed: true, status: 'confirmed' });
  });

  it('không có dòng (không phải lượt của mình) -> NOT_FOUND', async () => {
    const { client } = createFakeSupabase({ ...SIGNED_IN, from: { bookings: { data: null } } });
    const err = await catchError(createBookingRepo(client).getMine('b-khac'));
    expect(err.code).toBe('NOT_FOUND');
  });

  it('lỗi mạng -> NETWORK', async () => {
    const { client } = createFakeSupabase({
      ...SIGNED_IN,
      from: { bookings: { error: { message: 'TypeError: Failed to fetch' } } },
    });
    const err = await catchError(createBookingRepo(client).getMine('b1'));
    expect(err.code).toBe('NETWORK');
  });
});

describe('bookingRepo.listMine', () => {
  it('chưa đăng nhập -> UNAUTHENTICATED và không truy vấn', async () => {
    const { client, calls } = createFakeSupabase({ from: { bookings: { data: [] } } });
    const err = await catchError(createBookingRepo(client).listMine());
    expect(err.code).toBe('UNAUTHENTICATED');
    expect(calls.some((c) => c.kind === 'from')).toBe(false);
  });

  it('lọc customer_id, sắp starts_at giảm dần, tối đa 100 dòng; giữ thứ tự server trả', async () => {
    const rows = [
      bookingRow({ id: 'b-moi', starts_at: '2026-10-20T01:00:00.000Z', ends_at: '2026-10-20T02:00:00.000Z' }),
      bookingRow({ id: 'b-cu', starts_at: '2026-10-10T01:00:00.000Z', ends_at: '2026-10-10T02:00:00.000Z', status: 'cancelled' }),
    ];
    const { client, calls } = createFakeSupabase({ ...SIGNED_IN, from: { bookings: { data: rows } } });
    const result = await createBookingRepo(client).listMine();

    const call = calls.find((c) => c.kind === 'from') as FakeCall;
    expect(methodsOf(call)).toEqual(['select', 'eq', 'order', 'limit']);
    expect(call.filters?.[1].args).toEqual(['customer_id', 'u1']);
    expect(call.filters?.[2].args).toEqual(['starts_at', { ascending: false }]);
    expect(call.filters?.[3].args).toEqual([100]);

    expect(result.map((b) => b.id)).toEqual(['b-moi', 'b-cu']);
    expect(result[1].status).toBe('cancelled');
  });

  it('data null -> mảng rỗng', async () => {
    const { client } = createFakeSupabase({ ...SIGNED_IN, from: { bookings: { data: null } } });
    await expect(createBookingRepo(client).listMine()).resolves.toEqual([]);
  });

  it('lỗi mạng -> NETWORK', async () => {
    const { client } = createFakeSupabase({
      ...SIGNED_IN,
      from: { bookings: { error: { message: 'TypeError: Failed to fetch' } } },
    });
    const err = await catchError(createBookingRepo(client).listMine());
    expect(err.code).toBe('NETWORK');
  });
});

describe('bookingRepo.cancel', () => {
  it('gọi cancel_booking đúng p_booking_id, không trả gì', async () => {
    const { client, calls } = createFakeSupabase({ ...SIGNED_IN, rpc: { cancel_booking: { data: null } } });
    await expect(createBookingRepo(client).cancel('b1')).resolves.toBeUndefined();
    expect(rpcCalls(calls)).toHaveLength(1);
    expect(rpcCalls(calls)[0]).toMatchObject({ kind: 'rpc', name: 'cancel_booking', args: { p_booking_id: 'b1' } });
  });

  it('chưa đăng nhập -> UNAUTHENTICATED và không gọi RPC', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { cancel_booking: { data: null } } });
    const err = await catchError(createBookingRepo(client).cancel('b1'));
    expect(err.code).toBe('UNAUTHENTICATED');
    expect(calls.some((c) => c.kind === 'rpc')).toBe(false);
  });

  it('RPC báo FORBIDDEN (không phải lượt của mình / đã bắt đầu) -> FORBIDDEN', async () => {
    const { client } = createFakeSupabase({
      ...SIGNED_IN,
      rpc: { cancel_booking: { error: { code: 'P0001', message: 'FORBIDDEN' } } },
    });
    const err = await catchError(createBookingRepo(client).cancel('b1'));
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('bookingRepo.review', () => {
  it('gọi create_review với p_rating và p_body đã cắt khoảng trắng, trả void', async () => {
    const { client, calls } = createFakeSupabase({ ...SIGNED_IN, rpc: { create_review: { data: 'r1' } } });
    await expect(createBookingRepo(client).review('b1', { rating: 5, text: '  Tốt  ' })).resolves.toBeUndefined();
    expect(rpcCalls(calls)).toHaveLength(1);
    expect(rpcCalls(calls)[0]).toMatchObject({
      kind: 'rpc',
      name: 'create_review',
      args: { p_booking_id: 'b1', p_rating: 5, p_body: 'Tốt' },
    });
  });

  it('không có text -> p_body là chuỗi rỗng', async () => {
    const { client, calls } = createFakeSupabase({ ...SIGNED_IN, rpc: { create_review: { data: 'r2' } } });
    await createBookingRepo(client).review('b1', { rating: 4 });
    expect(rpcCalls(calls)[0]).toMatchObject({ args: { p_rating: 4, p_body: '' } });
  });

  it.each([
    ['rating 0', { rating: 0 }],
    ['rating 6', { rating: 6 }],
    ['rating không nguyên', { rating: 3.5 }],
    ['rating NaN', { rating: Number.NaN }],
  ])('%s -> VALIDATION và không gọi mạng', async (_label, input) => {
    const { client, calls } = createFakeSupabase({ ...SIGNED_IN, rpc: { create_review: { data: 'x' } } });
    const err = await catchError(createBookingRepo(client).review('b1', input));
    expect(err.code).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('text 501 ký tự -> VALIDATION và không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ ...SIGNED_IN, rpc: { create_review: { data: 'x' } } });
    const err = await catchError(createBookingRepo(client).review('b1', { rating: 5, text: 'a'.repeat(501) }));
    expect(err.code).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('text 500 ký tự (đếm theo ký tự, không theo UTF-16) được chấp nhận', async () => {
    const { client, calls } = createFakeSupabase({ ...SIGNED_IN, rpc: { create_review: { data: 'r3' } } });
    // Mỗi emoji là hai đơn vị UTF-16 nhưng một ký tự (code point) với char_length của Postgres.
    const text = '😀'.repeat(500);
    await createBookingRepo(client).review('b1', { rating: 5, text });
    expect(rpcCalls(calls)).toHaveLength(1);
  });

  it('chưa đăng nhập -> UNAUTHENTICATED và không gọi RPC', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { create_review: { data: 'r4' } } });
    const err = await catchError(createBookingRepo(client).review('b1', { rating: 5 }));
    expect(err.code).toBe('UNAUTHENTICATED');
    expect(calls.some((c) => c.kind === 'rpc')).toBe(false);
  });

  it('RPC báo VALIDATION (server kiểm lại) -> VALIDATION', async () => {
    const { client } = createFakeSupabase({
      ...SIGNED_IN,
      rpc: { create_review: { error: { code: 'P0001', message: 'VALIDATION' } } },
    });
    const err = await catchError(createBookingRepo(client).review('b1', { rating: 5 }));
    expect(err.code).toBe('VALIDATION');
  });
});
