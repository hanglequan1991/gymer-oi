import { describe, expect, it } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';
import type { FakeCall, FakeScript } from '@/test/fakeSupabase';
import { AppError } from '../errors';
import type { RequestRow } from '../mappers/request';
import { REQUEST_SELECT, createRequestRepo } from './requestRepo';

const NOW = new Date('2026-10-16T09:00:00.000Z');

function row(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: 'b1',
    starts_at: '2026-10-17T01:00:00.000Z',
    ends_at: '2026-10-17T02:00:00.000Z',
    price_vnd: 300000,
    goal: null,
    status: 'pending',
    expires_at: '2026-10-16T10:00:00.000Z',
    profiles: { display_name: 'Lan' },
    booking_health_notes: null,
    ...overrides,
  };
}

/** Lệnh from đầu tiên trong calls, để khẳng định bảng và chuỗi bộ lọc. */
function fromCall(calls: FakeCall[], table: string): FakeCall {
  const found = calls.find((c) => c.kind === 'from' && c.table === table);
  if (!found) throw new Error(`không có lệnh from(${table})`);
  return found;
}

async function catchError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error('kỳ vọng ném lỗi nhưng không ném');
}

const SESSION = { auth: { session: { user: { id: 'u1' } } } } as const;

describe('requestRepo.list', () => {
  it('chưa đăng nhập -> UNAUTHENTICATED và không truy vấn bookings', async () => {
    const { client, calls } = createFakeSupabase({ from: { bookings: { data: [] } } });
    const err = await catchError(createRequestRepo(client, { now: () => NOW }).list());
    expect(err.code).toBe('UNAUTHENTICATED');
    expect(calls.some((c) => c.kind === 'from')).toBe(false);
  });

  it('truy vấn bookings theo gymer_id của phiên, mặc định pending/confirmed/rejected, chỉ buổi chưa kết thúc, sắp tăng dần, tối đa 100', async () => {
    const { client, calls } = createFakeSupabase({
      ...SESSION,
      from: { bookings: { data: [row({ status: 'confirmed', expires_at: '2026-10-16T08:00:00.000Z' })] } },
    });

    await createRequestRepo(client, { now: () => NOW }).list();

    const from = fromCall(calls, 'bookings');
    expect(from.op).toBe('select');
    expect(from.filters).toEqual([
      { method: 'select', args: [REQUEST_SELECT] },
      { method: 'eq', args: ['gymer_id', 'u1'] },
      { method: 'in', args: ['status', ['pending', 'confirmed', 'rejected']] },
      { method: 'gt', args: ['ends_at', NOW.toISOString()] },
      { method: 'order', args: ['starts_at', { ascending: true }] },
      { method: 'limit', args: [100] },
    ]);
  });

  it('filter.status chỉ đưa đúng trạng thái đó vào bộ lọc', async () => {
    const { client, calls } = createFakeSupabase({ ...SESSION, from: { bookings: { data: [] } } });
    await createRequestRepo(client, { now: () => NOW }).list({ status: 'confirmed' });
    expect(fromCall(calls, 'bookings').filters).toContainEqual({
      method: 'in',
      args: ['status', ['confirmed']],
    });
  });

  it('ends_at > mốc now tiêm vào, cùng mốc dùng để lọc pending hết hạn', async () => {
    const later = new Date('2026-10-20T12:34:56.000Z');
    const { client, calls } = createFakeSupabase({ ...SESSION, from: { bookings: { data: [] } } });
    await createRequestRepo(client, { now: () => later }).list();
    expect(fromCall(calls, 'bookings').filters).toContainEqual({
      method: 'gt',
      args: ['ends_at', later.toISOString()],
    });
  });

  it('REQUEST_SELECT embed booking_health_notes(note,shared_with_gymer)', () => {
    expect(REQUEST_SELECT).toContain('booking_health_notes(note,shared_with_gymer)');
  });

  it('loại pending đã quá hạn, giữ pending còn hạn và confirmed dù expires_at đã qua', async () => {
    const { client } = createFakeSupabase({
      ...SESSION,
      from: {
        bookings: {
          data: [
            row({ id: 'expired-pending', expires_at: '2026-10-16T08:00:00.000Z' }),
            row({ id: 'live-pending', expires_at: '2026-10-16T10:00:00.000Z' }),
            row({ id: 'old-confirmed', status: 'confirmed', expires_at: '2026-10-16T08:00:00.000Z' }),
          ],
        },
      },
    });

    const list = await createRequestRepo(client, { now: () => NOW }).list();

    expect(list.map((r) => r.id)).toEqual(['live-pending', 'old-confirmed']);
    expect(list[0].expiresAt).toBe('2026-10-16T10:00:00.000Z');
    expect(list[1]).not.toHaveProperty('expiresAt');
  });

  it('map customerName từ embed profiles và không đặt note', async () => {
    const { client } = createFakeSupabase({
      ...SESSION,
      from: { bookings: { data: [row({ profiles: { display_name: 'Minh' }, goal: 'Tăng cơ' })] } },
    });
    const [item] = await createRequestRepo(client, { now: () => NOW }).list();
    expect(item).toMatchObject({ customerName: 'Minh', goal: 'Tăng cơ', price: 300000 });
    expect(item).not.toHaveProperty('note');
  });

  it('gán note khi embed booking_health_notes có shared_with_gymer = true', async () => {
    const { client } = createFakeSupabase({
      ...SESSION,
      from: {
        bookings: {
          data: [row({ booking_health_notes: { note: 'Đau gối', shared_with_gymer: true } })],
        },
      },
    });
    const [item] = await createRequestRepo(client, { now: () => NOW }).list();
    expect(item.note).toBe('Đau gối');
  });

  it('không gán note khi shared_with_gymer = false hoặc embed null', async () => {
    const { client } = createFakeSupabase({
      ...SESSION,
      from: {
        bookings: {
          data: [
            row({ id: 'not-shared', booking_health_notes: [{ note: 'Đau gối', shared_with_gymer: false }] }),
            row({ id: 'hidden', booking_health_notes: null }),
          ],
        },
      },
    });
    const list = await createRequestRepo(client, { now: () => NOW }).list();
    expect(list.map((r) => r.id)).toEqual(['not-shared', 'hidden']);
    expect(list[0]).not.toHaveProperty('note');
    expect(list[1]).not.toHaveProperty('note');
  });

  it('data null không lỗi -> danh sách rỗng', async () => {
    const { client } = createFakeSupabase({ ...SESSION, from: { bookings: { data: null } } });
    expect(await createRequestRepo(client, { now: () => NOW }).list()).toEqual([]);
  });

  it('lỗi 42501 -> FORBIDDEN', async () => {
    const { client, calls } = createFakeSupabase({
      ...SESSION,
      from: { bookings: { error: { code: '42501', message: 'permission denied' } } },
    });
    const err = await catchError(createRequestRepo(client, { now: () => NOW }).list());
    expect(err.code).toBe('FORBIDDEN');
    expect(calls.filter((c) => c.kind === 'from')).toHaveLength(1);
  });
});

describe('requestRepo.respond', () => {
  it('gọi respond_booking với đúng tham số rồi đọc lại hàng theo id, trả trạng thái mới', async () => {
    const script: FakeScript = {
      ...SESSION,
      rpc: { respond_booking: { data: undefined } },
      from: { bookings: { data: row({ status: 'confirmed', expires_at: '2026-10-16T08:00:00.000Z' }) } },
    };
    const { client, calls } = createFakeSupabase(script);

    const result = await createRequestRepo(client, { now: () => NOW }).respond('b1', 'confirmed');

    expect(result).toMatchObject({ id: 'b1', status: 'confirmed', customerName: 'Lan' });
    expect(result).not.toHaveProperty('expiresAt');
    expect(calls[0]).toMatchObject({
      kind: 'rpc',
      name: 'respond_booking',
      args: { p_booking_id: 'b1', p_decision: 'confirmed' },
    });
    const reread = fromCall(calls, 'bookings');
    expect(reread.op).toBe('select');
    expect(reread.filters).toEqual([
      { method: 'select', args: [REQUEST_SELECT] },
      { method: 'eq', args: ['id', 'b1'] },
      { method: 'maybeSingle', args: [] },
    ]);
    expect(calls.map((c) => c.kind)).toEqual(['rpc', 'from']);
  });

  it('decision rejected được gửi nguyên văn', async () => {
    const { client, calls } = createFakeSupabase({
      ...SESSION,
      rpc: { respond_booking: { data: undefined } },
      from: { bookings: { data: row({ status: 'rejected' }) } },
    });
    const result = await createRequestRepo(client, { now: () => NOW }).respond('b1', 'rejected');
    expect(result.status).toBe('rejected');
    expect(calls[0]).toMatchObject({ args: { p_decision: 'rejected' } });
  });

  it('RPC báo BOOKING_EXPIRED -> BOOKING_EXPIRED và không đọc lại', async () => {
    const { client, calls } = createFakeSupabase({
      ...SESSION,
      rpc: { respond_booking: { error: { code: 'P0001', message: 'BOOKING_EXPIRED' } } },
      from: { bookings: { data: row() } },
    });
    const err = await catchError(createRequestRepo(client, { now: () => NOW }).respond('b1', 'confirmed'));
    expect(err.code).toBe('BOOKING_EXPIRED');
    expect(calls.filter((c) => c.kind === 'from')).toHaveLength(0);
  });

  it('RPC báo FORBIDDEN -> FORBIDDEN', async () => {
    const { client } = createFakeSupabase({
      ...SESSION,
      rpc: { respond_booking: { error: { code: 'P0001', message: 'FORBIDDEN' } } },
    });
    const err = await catchError(createRequestRepo(client, { now: () => NOW }).respond('b1', 'rejected'));
    expect(err.code).toBe('FORBIDDEN');
  });

  it('đọc lại không có hàng -> NOT_FOUND', async () => {
    const { client, calls } = createFakeSupabase({
      ...SESSION,
      rpc: { respond_booking: { data: undefined } },
      from: { bookings: { data: null } },
    });
    const err = await catchError(createRequestRepo(client, { now: () => NOW }).respond('b1', 'confirmed'));
    expect(err.code).toBe('NOT_FOUND');
    expect(calls.filter((c) => c.kind === 'rpc')).toHaveLength(1);
  });

  it('đọc lại lỗi mạng -> NETWORK', async () => {
    const { client } = createFakeSupabase({
      ...SESSION,
      rpc: { respond_booking: { data: undefined } },
      from: { bookings: { error: { message: 'TypeError: Failed to fetch' } } },
    });
    const err = await catchError(createRequestRepo(client, { now: () => NOW }).respond('b1', 'confirmed'));
    expect(err.code).toBe('NETWORK');
  });
});
