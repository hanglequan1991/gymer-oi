import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { createFakeSupabase } from '@/test/fakeSupabase';
import type { FakeCall, FakeResponder, FakeResult, FakeScript } from '@/test/fakeSupabase';
import { createScheduleRepo } from './scheduleRepo';

/** Mã lỗi AppError của một promise; undefined nếu không ném. */
async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof AppError ? e.code : 'NOT_APP_ERROR';
  }
}

/** Các lệnh gọi tới bảng (bỏ lệnh auth). */
const fromCalls = (calls: FakeCall[]): FakeCall[] => calls.filter((c) => c.kind === 'from');

/** Giá trị của các bộ lọc eq, dạng { cột: giá trị }. */
const eqs = (call: FakeCall): Record<string, unknown> =>
  Object.fromEntries((call.filters ?? []).filter((s) => s.method === 'eq').map((s) => [s.args[0], s.args[1]]));

const SESSION = { user: { id: 'u1' } };

const slotError = (code: string, message: string): FakeResult => ({ error: { code, message } });

describe('scheduleRepo.getMonth', () => {
  it('gọi get_month_calendar với p_month 1-12 và map lịch, giữ giá server', async () => {
    const script: FakeScript = {
      rpc: {
        get_month_calendar: {
          data: [
            { day: '2026-10-17', price_vnd: 350000, is_open: true, has_booked: false },
            { day: '2026-10-18', price_vnd: 420000, is_open: true, has_booked: true },
          ],
        },
      },
    };
    const { client, calls } = createFakeSupabase(script);

    const days = await createScheduleRepo(client).getMonth('g1', 2026, 10);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: 'rpc',
      name: 'get_month_calendar',
      args: { p_gymer_id: 'g1', p_year: 2026, p_month: 10 },
    });
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ price: 350000, marker: 'open', disabled: false });
    expect(days[0].date.getDate()).toBe(17);
    expect(days[1]).toMatchObject({ price: 420000, marker: 'booked' });
  });

  it('không có mạng: NETWORK', async () => {
    const { client, calls } = createFakeSupabase({
      rpc: { get_month_calendar: { error: { message: 'TypeError: Failed to fetch' } } },
    });
    expect(await codeOf(createScheduleRepo(client).getMonth('g1', 2026, 10))).toBe('NETWORK');
    expect(calls).toHaveLength(1);
  });
});

describe('scheduleRepo.getDaySlots', () => {
  it('gọi get_day_slots và map slot: id, time cắt HH:mm, booked_by null thành undefined', async () => {
    const { client, calls } = createFakeSupabase({
      rpc: {
        get_day_slots: {
          data: [
            { start_time: '07:00:00', state: 'available', booked_by: null },
            { start_time: '08:00:00', state: 'booked', booked_by: 'u9' },
            { start_time: '09:00:00', state: 'closed', booked_by: null },
          ],
        },
      },
    });

    const slots = await createScheduleRepo(client).getDaySlots('g1', '2026-10-17');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: 'rpc',
      name: 'get_day_slots',
      args: { p_gymer_id: 'g1', p_day: '2026-10-17' },
    });
    expect(slots).toEqual([
      { id: '2026-10-17T07:00', time: '07:00', state: 'available', bookedBy: undefined },
      { id: '2026-10-17T08:00', time: '08:00', state: 'booked', bookedBy: 'u9' },
      { id: '2026-10-17T09:00', time: '09:00', state: 'closed', bookedBy: undefined },
    ]);
  });
});

describe('scheduleRepo.setPrices', () => {
  it('update gymer_profiles theo user_id của phiên, đúng hai cột giá', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: { gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });

    await expect(createScheduleRepo(client).setPrices({ weekday: 300000, weekend: 400000 })).resolves.toBeUndefined();

    const from = fromCalls(calls);
    expect(from).toHaveLength(1);
    expect(from[0]).toMatchObject({
      table: 'gymer_profiles',
      op: 'update',
      payload: { price_weekday_vnd: 300000, price_weekend_vnd: 400000 },
    });
    expect(eqs(from[0])).toEqual({ user_id: 'u1' });
    expect(from.some((c) => c.op === 'upsert')).toBe(false);
  });

  it.each([0, 5_000_000])('biên %i được chấp nhận', async (price) => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: { gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    await createScheduleRepo(client).setPrices({ weekday: price, weekend: price });
    expect(fromCalls(calls)[0].payload).toEqual({ price_weekday_vnd: price, price_weekend_vnd: price });
  });

  it.each([5_000_001, -1, 100.5, Number.NaN])('giá %s: VALIDATION, không gọi gì', async (price) => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: { gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    expect(await codeOf(createScheduleRepo(client).setPrices({ weekday: price, weekend: 300000 }))).toBe('VALIDATION');
    expect(await codeOf(createScheduleRepo(client).setPrices({ weekday: 300000, weekend: price }))).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('không có hàng (không phải Gymer): NOT_FOUND', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: { gymer_profiles: { data: [] } },
    });
    expect(await codeOf(createScheduleRepo(client).setPrices({ weekday: 300000, weekend: 400000 }))).toBe('NOT_FOUND');
    expect(fromCalls(calls)).toHaveLength(1);
  });

  it('chưa đăng nhập: UNAUTHENTICATED, không gọi bảng', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session: null } });
    expect(await codeOf(createScheduleRepo(client).setPrices({ weekday: 300000, weekend: 400000 }))).toBe(
      'UNAUTHENTICATED',
    );
    expect(fromCalls(calls)).toHaveLength(0);
  });
});

describe('scheduleRepo.setSlotClosed', () => {
  const SLOT = '2026-10-17T07:00';

  it('đóng khung đã có hàng: chỉ update is_open=false, không insert, không upsert', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: { gymer_slot_overrides: { data: [{ gymer_id: 'u1' }] } },
    });

    await createScheduleRepo(client).setSlotClosed(SLOT, true);

    const from = fromCalls(calls);
    expect(from).toHaveLength(1);
    expect(from[0]).toMatchObject({ table: 'gymer_slot_overrides', op: 'update', payload: { is_open: false } });
    expect(eqs(from[0])).toEqual({ gymer_id: 'u1', day: '2026-10-17', start_time: '07:00' });
    expect(from.some((c) => c.op === 'upsert' || c.op === 'insert')).toBe(false);
  });

  it('mở khung chưa có hàng: update 0 hàng rồi insert is_open=true, không upsert', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: {
        gymer_slot_overrides: (c) => (c.op === 'insert' ? { data: null } : { data: [] }),
      },
    });

    await createScheduleRepo(client).setSlotClosed(SLOT, false);

    const from = fromCalls(calls);
    expect(from.map((c) => c.op)).toEqual(['update', 'insert']);
    expect(from[0].payload).toEqual({ is_open: true });
    expect(eqs(from[0])).toEqual({ gymer_id: 'u1', day: '2026-10-17', start_time: '07:00' });
    expect(from[1].payload).toEqual({ gymer_id: 'u1', day: '2026-10-17', start_time: '07:00', is_open: true });
    expect(from.some((c) => c.op === 'upsert')).toBe(false);
  });

  it('insert báo trùng 23505 thì update lại đúng một lần', async () => {
    let updates = 0;
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: {
        gymer_slot_overrides: (c) => {
          if (c.op === 'insert') return slotError('23505', 'duplicate key value violates unique constraint');
          updates++;
          return updates === 1 ? { data: [] } : { data: [{ gymer_id: 'u1' }] };
        },
      },
    });

    await expect(createScheduleRepo(client).setSlotClosed(SLOT, true)).resolves.toBeUndefined();

    const from = fromCalls(calls);
    expect(from.map((c) => c.op)).toEqual(['update', 'insert', 'update']);
    expect(from[0].payload).toEqual({ is_open: false });
    expect(from[2].payload).toEqual({ is_open: false });
    expect(from.some((c) => c.op === 'upsert')).toBe(false);
  });

  it('insert trùng 23505 nhưng update lại vẫn 0 hàng: NOT_FOUND', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: {
        gymer_slot_overrides: (c) =>
          c.op === 'insert' ? slotError('23505', 'duplicate key value') : { data: [] },
      },
    });

    expect(await codeOf(createScheduleRepo(client).setSlotClosed(SLOT, true))).toBe('NOT_FOUND');
    expect(fromCalls(calls).map((c) => c.op)).toEqual(['update', 'insert', 'update']);
  });

  it('insert lỗi quyền 42501 (không phải 23505): FORBIDDEN, không update lại', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: {
        gymer_slot_overrides: (c) => (c.op === 'insert' ? slotError('42501', 'permission denied') : { data: [] }),
      },
    });

    expect(await codeOf(createScheduleRepo(client).setSlotClosed(SLOT, true))).toBe('FORBIDDEN');
    expect(fromCalls(calls).map((c) => c.op)).toEqual(['update', 'insert']);
  });

  it('trigger SLOT_HAS_BOOKING khi update: VALIDATION, không insert', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: {
        gymer_slot_overrides: slotError('P0001', 'SLOT_HAS_BOOKING'),
      },
    });

    expect(await codeOf(createScheduleRepo(client).setSlotClosed(SLOT, true))).toBe('VALIDATION');
    expect(fromCalls(calls).map((c) => c.op)).toEqual(['update']);
  });

  it('slotId sai định dạng: VALIDATION, không gọi gì', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: SESSION },
      from: { gymer_slot_overrides: { data: [] } },
    });

    expect(await codeOf(createScheduleRepo(client).setSlotClosed('2026-10-17 07:00', true))).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('chưa đăng nhập: UNAUTHENTICATED, không gọi bảng', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session: null },
      from: { gymer_slot_overrides: { data: [] } },
    });

    expect(await codeOf(createScheduleRepo(client).setSlotClosed(SLOT, true))).toBe('UNAUTHENTICATED');
    expect(fromCalls(calls)).toHaveLength(0);
  });
});

describe('scheduleRepo.setDayOverrides', () => {
  type Row = { is_open: boolean; price_vnd: number | null };

  /**
   * Kịch bản gymer_day_overrides: select trả dòng trong `rows` theo ngày;
   * update trả [] khi ngày chưa có dòng (để repo đi tiếp sang insert); `failWrite` gây lỗi ghi theo ngày.
   */
  function overrideTable(rows: Record<string, Row> = {}, failWrite: Record<string, FakeResult> = {}): FakeResponder {
    return (call) => {
      const day = String(eqs(call).day);
      if (call.op === 'select') return { data: rows[day] ?? null };
      if (call.op === 'delete') return { data: null };
      const fail = failWrite[day];
      if (fail) return fail;
      if (call.op === 'update') return { data: rows[day] ? [{}] : [] };
      return { data: null };
    };
  }

  const authed = (table: FakeResponder): FakeScript => ({
    auth: { session: SESSION },
    from: { gymer_day_overrides: table },
  });

  /** Các thao tác ghi (update/insert/delete) theo thứ tự, bỏ select. */
  const writeOps = (calls: FakeCall[]) => fromCalls(calls).filter((c) => c.op !== 'select');

  it('đặt giá riêng cho ngày chưa có dòng: update 0 hàng rồi insert đúng giá, không upsert', async () => {
    const { client, calls } = createFakeSupabase(authed(overrideTable()));

    const result = await createScheduleRepo(client).setDayOverrides(['2026-10-17'], { price: 300000 });

    expect(result).toEqual({ applied: ['2026-10-17'], skipped: [] });
    expect(writeOps(calls).map((c) => c.op)).toEqual(['update', 'insert']);
    expect(writeOps(calls)[1].payload).toEqual({
      gymer_id: 'u1',
      day: '2026-10-17',
      is_open: true,
      price_vnd: 300000,
    });
  });

  it('bỏ giá riêng (price null) khi ngày mở: xoá dòng, không update hay insert', async () => {
    const { client, calls } = createFakeSupabase(
      authed(overrideTable({ '2026-10-17': { is_open: true, price_vnd: 300000 } })),
    );

    const result = await createScheduleRepo(client).setDayOverrides(['2026-10-17'], { price: null });

    expect(result.applied).toEqual(['2026-10-17']);
    expect(writeOps(calls).map((c) => c.op)).toEqual(['delete']);
    expect(eqs(writeOps(calls)[0])).toEqual({ gymer_id: 'u1', day: '2026-10-17' });
  });

  it('đóng cả ngày chưa có dòng: insert is_open=false, giá null', async () => {
    const { client, calls } = createFakeSupabase(authed(overrideTable()));

    await createScheduleRepo(client).setDayOverrides(['2026-10-17'], { closed: true });

    expect(writeOps(calls).map((c) => c.op)).toEqual(['update', 'insert']);
    expect(writeOps(calls)[1].payload).toMatchObject({ is_open: false, price_vnd: null });
  });

  it('mở lại ngày đang đóng không giá riêng: xoá dòng (trở về mặc định)', async () => {
    const { client, calls } = createFakeSupabase(
      authed(overrideTable({ '2026-10-17': { is_open: false, price_vnd: null } })),
    );

    await createScheduleRepo(client).setDayOverrides(['2026-10-17'], { closed: false });

    expect(writeOps(calls).map((c) => c.op)).toEqual(['delete']);
  });

  it('mở lại ngày đang đóng nhưng còn giá riêng: update is_open=true và giữ giá', async () => {
    const { client, calls } = createFakeSupabase(
      authed(overrideTable({ '2026-10-17': { is_open: false, price_vnd: 280000 } })),
    );

    await createScheduleRepo(client).setDayOverrides(['2026-10-17'], { closed: false });

    expect(writeOps(calls).map((c) => c.op)).toEqual(['update']);
    expect(writeOps(calls)[0].payload).toEqual({ is_open: true, price_vnd: 280000 });
  });

  it('patch rỗng giữ nguyên dòng hiện có (không đổi giá, không đổi đóng mở)', async () => {
    const { client, calls } = createFakeSupabase(
      authed(overrideTable({ '2026-10-17': { is_open: false, price_vnd: 280000 } })),
    );

    await createScheduleRepo(client).setDayOverrides(['2026-10-17'], {});

    expect(writeOps(calls)[0].payload).toEqual({ is_open: false, price_vnd: 280000 });
  });

  it('ngày có lịch đặt không đóng được: vào skipped, các ngày khác vẫn áp dụng', async () => {
    const { client } = createFakeSupabase(
      authed(overrideTable({}, { '2026-10-18': slotError('P0001', 'SLOT_HAS_BOOKING') })),
    );

    const result = await createScheduleRepo(client).setDayOverrides(
      ['2026-10-17', '2026-10-18', '2026-10-19'],
      { closed: true },
    );

    expect(result).toEqual({ applied: ['2026-10-17', '2026-10-19'], skipped: ['2026-10-18'] });
  });

  it('lỗi VALIDATION khi MỞ ngày (không phải đóng): không vào skipped, ném ngay', async () => {
    const { client, calls } = createFakeSupabase(
      authed(overrideTable({ '2026-10-17': { is_open: false, price_vnd: null } }, {
        '2026-10-17': slotError('P0001', 'SLOT_HAS_BOOKING'),
      })),
    );

    expect(
      await codeOf(createScheduleRepo(client).setDayOverrides(['2026-10-17'], { closed: false, price: 300000 })),
    ).toBe(
      'VALIDATION',
    );
    expect(writeOps(calls)).toHaveLength(1);
  });

  it('lỗi khác (không phải VALIDATION khi đóng) ném ngay, không xử lý các ngày sau', async () => {
    const { client, calls } = createFakeSupabase(
      authed(overrideTable({}, { '2026-10-17': { error: { code: '42501', message: 'denied' } } })),
    );

    expect(
      await codeOf(createScheduleRepo(client).setDayOverrides(['2026-10-17', '2026-10-18'], { closed: true })),
    ).toBe('FORBIDDEN');
    expect(writeOps(calls).some((c) => eqs(c).day === '2026-10-18')).toBe(false);
  });

  it('63 ngày: VALIDATION, không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase(authed(overrideTable()));
    const days = Array.from({ length: 63 }, (_, i) => `2026-10-${String((i % 28) + 1).padStart(2, '0')}`);

    expect(await codeOf(createScheduleRepo(client).setDayOverrides(days, { closed: true }))).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('đúng 62 ngày được chấp nhận', async () => {
    const { client } = createFakeSupabase(authed(overrideTable()));
    const days = Array.from({ length: 62 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      return d.toISOString().slice(0, 10);
    });

    const result = await createScheduleRepo(client).setDayOverrides(days, { closed: true });
    expect(result.applied).toHaveLength(62);
  });

  it.each([-1, 5_000_001, 1.5, Number.NaN])('giá %s sai: VALIDATION, không gọi gì', async (price) => {
    const { client, calls } = createFakeSupabase(authed(overrideTable()));

    expect(await codeOf(createScheduleRepo(client).setDayOverrides(['2026-10-17'], { price }))).toBe('VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it.each(['2026-10-1', '17/10/2026', '2026-02-30', '2026-13-01', '2026-10-17T07:00'])(
    'ngày "%s" sai định dạng hoặc không tồn tại: VALIDATION, không gọi gì',
    async (day) => {
      const { client, calls } = createFakeSupabase(authed(overrideTable()));

      expect(await codeOf(createScheduleRepo(client).setDayOverrides([day], { closed: true }))).toBe('VALIDATION');
      expect(calls).toHaveLength(0);
    },
  );

  it('chưa đăng nhập: UNAUTHENTICATED, không đọc hay ghi bảng', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session: null }, from: { gymer_day_overrides: overrideTable() } });

    expect(await codeOf(createScheduleRepo(client).setDayOverrides(['2026-10-17'], { closed: true }))).toBe(
      'UNAUTHENTICATED',
    );
    expect(fromCalls(calls)).toHaveLength(0);
  });
});
