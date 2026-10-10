import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { createFakeSupabase } from '@/test/fakeSupabase';
import { requireUserId } from './userId';

describe('requireUserId', () => {
  it('trả user_id của phiên hiện tại', async () => {
    const { client } = createFakeSupabase({ auth: { session: { user: { id: 'user-1' } } } });
    await expect(requireUserId(client)).resolves.toBe('user-1');
  });

  it('không có phiên: ném UNAUTHENTICATED', async () => {
    const { client } = createFakeSupabase({ auth: { session: null } });
    await expect(requireUserId(client)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('đọc phiên lỗi: ném UNAUTHENTICATED và giữ nguyên nhân', async () => {
    const cause = { message: 'auth lỗi' };
    const { client } = createFakeSupabase({ auth: { session: null, error: cause } });

    try {
      await requireUserId(client);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('UNAUTHENTICATED');
      expect((e as AppError).cause).toBe(cause);
    }
  });

  it('chỉ đọc phiên cục bộ, không gọi bảng hay RPC', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session: { user: { id: 'user-1' } } } });
    await requireUserId(client);

    expect(calls).toEqual([{ kind: 'auth', name: 'getSession', args: [] }]);
  });
});
