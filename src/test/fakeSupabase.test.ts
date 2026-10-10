import { describe, expect, it } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';
import type { FakeOutcome, FakeQuery, FakeSupabase } from './fakeSupabase';

/**
 * Kiểu lỏng cho test: tên bảng/RPC tuỳ ý, không bị ràng buộc bởi Database.
 * Ép một lần ở đây để các ca test ngắn gọn; test của repository dùng client đã kiểu hoá.
 */
interface LooseClient {
  from(table: string): FakeQuery;
  rpc(name: string, args?: unknown): FakeQuery;
  auth: Pick<FakeSupabase['client']['auth'], 'getSession' | 'setSession' | 'signOut'>;
  functions: { invoke(name: string, options?: unknown): Promise<FakeOutcome> };
}

function looseFake(script: Parameters<typeof createFakeSupabase>[0]): { client: LooseClient; calls: FakeSupabase['calls'] } {
  const fake = createFakeSupabase(script);
  return { client: fake.client as unknown as LooseClient, calls: fake.calls };
}

describe('createFakeSupabase: from', () => {
  it('ghi bảng, các bước chuỗi và trả kịch bản', async () => {
    const { client, calls } = looseFake({
      from: { gymer_profiles: { data: [{ user_id: 'g1' }] } },
    });

    const res = await client.from('gymer_profiles').select('user_id').eq('user_id', 'g1').limit(1);

    expect(res).toEqual({ data: [{ user_id: 'g1' }], error: null });
    expect(calls).toEqual([
      {
        kind: 'from',
        table: 'gymer_profiles',
        op: 'select',
        filters: [
          { method: 'select', args: ['user_id'] },
          { method: 'eq', args: ['user_id', 'g1'] },
          { method: 'limit', args: [1] },
        ],
      },
    ]);
  });

  it('insert, update, upsert và delete ghi op và payload đúng', async () => {
    const { client, calls } = looseFake({ from: { t: { data: null } } });

    await client.from('t').insert({ a: 1 });
    await client.from('t').update({ b: 2 }).eq('id', 'x').select();
    await client.from('t').upsert({ c: 3 });
    await client.from('t').delete().eq('id', 'y');

    expect(calls.map((c) => c.op)).toEqual(['insert', 'update', 'upsert', 'delete']);
    expect(calls[0].payload).toEqual({ a: 1 });
    expect(calls[1].payload).toEqual({ b: 2 });
    expect(calls[2].payload).toEqual({ c: 3 });
  });

  it('kịch bản lỗi trả error và data null', async () => {
    const { client } = looseFake({
      from: { t: { error: { code: '42501', message: 'denied' } } },
    });

    const res = await client.from('t').select('*');
    expect(res.data).toBeNull();
    expect(res.error).toEqual({ code: '42501', message: 'denied' });
  });

  it('kịch bản dạng hàm nhận được lệnh gọi để kiểm tra đối số', async () => {
    const { client } = looseFake({
      from: {
        t: (call) => ({ data: call.filters?.length ?? 0 }),
      },
    });

    const res = await client.from('t').select('*').eq('a', 1);
    expect(res.data).toBe(2);
  });

  it('bảng không có kịch bản: await bị từ chối với lỗi rõ ràng', async () => {
    const { client } = looseFake({});
    await expect(Promise.resolve(client.from('không_có').select('*'))).rejects.toThrow(
      'chưa có kịch bản cho from("không_có")',
    );
  });

  it('kịch bản mảng: mỗi await lấy phần tử tiếp theo, hết mảng lặp lại phần tử cuối', async () => {
    const { client } = looseFake({
      from: {
        t: [{ data: 'một' }, { error: { code: '23505', message: 'duplicate' } }, { data: 'ba' }],
      },
    });

    expect((await client.from('t').select('*')).data).toBe('một');
    expect((await client.from('t').select('*')).error).toEqual({ code: '23505', message: 'duplicate' });
    expect((await client.from('t').select('*')).data).toBe('ba');
    expect((await client.from('t').select('*')).data).toBe('ba');
  });

  it('kịch bản mảng: mỗi khoá có vị trí đọc riêng (from và rpc)', async () => {
    const { client } = looseFake({
      from: { t: [{ data: 1 }, { data: 2 }] },
      rpc: { f: [{ data: 'x' }] },
    });

    expect((await client.from('t').select('*')).data).toBe(1);
    expect((await client.rpc('f')).data).toBe('x');
    expect((await client.from('t').select('*')).data).toBe(2);
  });

  it('kịch bản mảng rỗng: await bị từ chối', async () => {
    const { client } = looseFake({ from: { t: [] } });
    await expect(Promise.resolve(client.from('t').select('*'))).rejects.toThrow('kịch bản mảng rỗng cho from("t")');
  });

  it('ghi lại đủ các bước lọc mới: neq gt gte lt lte is not or range', async () => {
    const { client, calls } = looseFake({ from: { t: { data: [] } } });

    await client
      .from('t')
      .select('*')
      .neq('a', 1)
      .gt('b', 2)
      .gte('c', 3)
      .lt('d', 4)
      .lte('e', 5)
      .is('f', null)
      .not('g', 'is', null)
      .or('h.eq.1,h.eq.2')
      .range(0, 9);

    expect(calls[0].filters).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'neq', args: ['a', 1] },
      { method: 'gt', args: ['b', 2] },
      { method: 'gte', args: ['c', 3] },
      { method: 'lt', args: ['d', 4] },
      { method: 'lte', args: ['e', 5] },
      { method: 'is', args: ['f', null] },
      { method: 'not', args: ['g', 'is', null] },
      { method: 'or', args: ['h.eq.1,h.eq.2'] },
      { method: 'range', args: [0, 9] },
    ]);
  });
});

describe('createFakeSupabase: rpc', () => {
  it('ghi tên RPC và đối số, trả kịch bản', async () => {
    const { client, calls } = looseFake({
      rpc: { search_gymers: { data: [{ user_id: 'g1' }] } },
    });

    const res = await client.rpc('search_gymers', { p_lat: 10.77, p_lng: 106.7 });

    expect(res.data).toEqual([{ user_id: 'g1' }]);
    expect(calls).toEqual([{ kind: 'rpc', name: 'search_gymers', args: { p_lat: 10.77, p_lng: 106.7 }, filters: [] }]);
  });

  it('RPC không có kịch bản: từ chối', async () => {
    const { client } = looseFake({});
    await expect(Promise.resolve(client.rpc('thiếu'))).rejects.toThrow('chưa có kịch bản cho rpc("thiếu")');
  });
});

describe('createFakeSupabase: auth và functions', () => {
  it('getSession trả phiên từ kịch bản; signOut xoá phiên và được ghi lại', async () => {
    const { client, calls } = looseFake({ auth: { session: { user: { id: 'u1' } } } });
    const before = await client.auth.getSession();
    expect(before.data.session?.user.id).toBe('u1');

    await client.auth.signOut();
    const after = await client.auth.getSession();
    expect(after.data.session).toBeNull();

    expect(calls.map((c) => c.name)).toEqual(['getSession', 'signOut', 'getSession']);
    expect(calls[0].kind).toBe('auth');
  });

  it('setSession cập nhật phiên: getSession sau đó trả đúng user', async () => {
    const { client, calls } = looseFake({
      auth: { setSessionResult: { session: { user: { id: 'u9' } } } },
    });

    const set = await client.auth.setSession({ access_token: 'a', refresh_token: 'r' });
    expect(set.data.session?.user.id).toBe('u9');
    expect(set.error).toBeNull();

    const after = await client.auth.getSession();
    expect(after.data.session?.user.id).toBe('u9');
    expect(calls[0]).toEqual({ kind: 'auth', name: 'setSession', args: [{ access_token: 'a', refresh_token: 'r' }] });
  });

  it('setSession lỗi: trả lỗi và giữ nguyên phiên cũ', async () => {
    const { client } = looseFake({
      auth: { session: { user: { id: 'cũ' } }, setSessionResult: { session: null, error: { message: 'bad token' } } },
    });

    const set = await client.auth.setSession({ access_token: 'a', refresh_token: 'r' });
    expect(set.error).toEqual({ message: 'bad token' });
    expect(set.data.session).toBeNull();

    const after = await client.auth.getSession();
    expect(after.data.session?.user.id).toBe('cũ');
  });

  it('signOut trả signOutError nhưng vẫn xoá phiên', async () => {
    const { client } = looseFake({
      auth: { session: { user: { id: 'u1' } }, signOutError: { message: 'mạng lỗi' } },
    });

    const out = await client.auth.signOut();
    expect(out.error).toEqual({ message: 'mạng lỗi' });
    expect((await client.auth.getSession()).data.session).toBeNull();
  });

  it('functions.invoke ghi tên và tham số, trả kịch bản', async () => {
    const { client, calls } = looseFake({
      functions: { 'auth-zalo': { data: { ok: true } } },
    });

    const res = await client.functions.invoke('auth-zalo', { body: { token: 'x' } });

    expect(res).toEqual({ data: { ok: true }, error: null });
    expect(calls).toEqual([{ kind: 'functions', name: 'auth-zalo', args: { body: { token: 'x' } } }]);
  });
});
