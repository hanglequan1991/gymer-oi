// @vitest-environment node
// Test các adapter của auth-zalo bằng client giả. Không gọi mạng, không gọi Supabase thật.
import { describe, it, expect } from 'vitest';
import { createZaloVerifier, parseZaloMe } from './zaloVerifier.ts';
import type { FetchFn } from './zaloVerifier.ts';
import { createUserStore, StoreError } from './userStore.ts';
import type { AdminUsersLike, DbError, DbLike } from './userStore.ts';
import { createSessionIssuer, SessionIssueError } from './sessionIssuer.ts';
import type { AnonAuthLike, AdminAuthLike } from './sessionIssuer.ts';
import { ZaloAuthError } from '../ports.ts';

const TOKEN = 'zalo-token-SECRET-value-123';
const APP_SECRET = 'app-secret-VALUE-456';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Lấy lỗi (hoặc undefined) từ một promise, để kiểm tra mã và thông báo. */
async function catchError(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
    return undefined;
  } catch (err) {
    return err;
  }
}

describe('parseZaloMe', () => {
  it('lấy id dạng chuỗi, name và picture.data.url', () => {
    expect(parseZaloMe({ id: 'abc', name: 'An', picture: { data: { url: 'https://x/y.png' } } })).toEqual({
      zaloId: 'abc',
      name: 'An',
      avatarUrl: 'https://x/y.png',
    });
  });

  it('chấp nhận id số nguyên an toàn và picture dạng chuỗi', () => {
    expect(parseZaloMe({ id: 42, name: 'B', picture: 'https://x/z.png' })).toEqual({
      zaloId: '42',
      name: 'B',
      avatarUrl: 'https://x/z.png',
    });
  });

  it('id chuỗi 19 chữ số giữ nguyên từng ký tự', () => {
    expect(parseZaloMe({ id: '9007199254740993', name: 'D' }).zaloId).toBe('9007199254740993');
    expect(parseZaloMe({ id: '12345678901234567890', name: 'D' }).zaloId).toBe('12345678901234567890');
  });

  it('id số lớn hơn 2^53 là UNAVAILABLE (đã mất độ chính xác khi parse)', () => {
    // 2^53 + 1 không biểu diễn chính xác được dưới dạng số: JSON.parse làm tròn về 2^53, và 2^53 không phải safe integer.
    expect(() => parseZaloMe({ id: 2 ** 53, name: 'E' })).toThrow(ZaloAuthError);
    expect(() => parseZaloMe({ id: 2 ** 60, name: 'E' })).toThrow(ZaloAuthError);
    const err = (() => {
      try {
        parseZaloMe({ id: 2 ** 60, name: 'E' });
      } catch (e) {
        return e;
      }
      return undefined;
    })();
    expect((err as ZaloAuthError).code).toBe('UNAVAILABLE');
  });

  it('id số không nguyên hoặc không hữu hạn là UNAVAILABLE', () => {
    expect(() => parseZaloMe({ id: 1.5, name: 'F' })).toThrow(ZaloAuthError);
    expect(() => parseZaloMe({ id: Number.NaN, name: 'F' })).toThrow(ZaloAuthError);
    expect(() => parseZaloMe({ id: Number.POSITIVE_INFINITY, name: 'F' })).toThrow(ZaloAuthError);
  });

  it('id kiểu khác (boolean, object) là UNAVAILABLE', () => {
    expect(() => parseZaloMe({ id: true, name: 'G' })).toThrow(ZaloAuthError);
    expect(() => parseZaloMe({ id: { v: 1 }, name: 'G' })).toThrow(ZaloAuthError);
  });

  it('body có error khác 0 là INVALID_TOKEN', () => {
    const err = (() => {
      try {
        parseZaloMe({ error: -216, message: 'invalid' });
      } catch (e) {
        return e;
      }
      return undefined;
    })();
    expect(err).toBeInstanceOf(ZaloAuthError);
    expect((err as ZaloAuthError).code).toBe('INVALID_TOKEN');
  });

  it('thiếu id là UNAVAILABLE, không ném lỗi trần', () => {
    expect(() => parseZaloMe({ name: 'C' })).toThrow(ZaloAuthError);
  });
});

describe('createZaloVerifier', () => {
  it('gửi access_token và secret_key qua header, và chỉ đọc id/name/picture', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn: FetchFn = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { id: 'z1', name: 'An', picture: 'https://a/b.png', extra: 'bỏ qua' });
    };
    const verifier = createZaloVerifier(fetchFn, { appSecret: APP_SECRET });
    const user = await verifier.verify(TOKEN);

    expect(user).toEqual({ zaloId: 'z1', name: 'An', avatarUrl: 'https://a/b.png' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://graph.zalo.me/v2.0/me?fields=id,name,picture');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.access_token).toBe(TOKEN);
    expect(headers.secret_key).toBe(APP_SECRET);
    expect(JSON.stringify(user)).not.toContain(TOKEN);
  });

  it('HTTP 401 là INVALID_TOKEN', async () => {
    const verifier = createZaloVerifier(async () => jsonResponse(401, { error: -216 }), { appSecret: APP_SECRET });
    const err = await catchError(verifier.verify(TOKEN));
    expect(err).toBeInstanceOf(ZaloAuthError);
    expect((err as ZaloAuthError).code).toBe('INVALID_TOKEN');
  });

  it('HTTP 200 kèm error khác 0 là INVALID_TOKEN', async () => {
    const verifier = createZaloVerifier(async () => jsonResponse(200, { error: -216 }), { appSecret: APP_SECRET });
    const err = await catchError(verifier.verify(TOKEN));
    expect((err as ZaloAuthError).code).toBe('INVALID_TOKEN');
  });

  it('HTTP 500 là UNAVAILABLE', async () => {
    const verifier = createZaloVerifier(async () => jsonResponse(500, {}), { appSecret: APP_SECRET });
    const err = await catchError(verifier.verify(TOKEN));
    expect((err as ZaloAuthError).code).toBe('UNAVAILABLE');
  });

  it('HTTP 429 là UNAVAILABLE', async () => {
    const verifier = createZaloVerifier(async () => jsonResponse(429, {}), { appSecret: APP_SECRET });
    const err = await catchError(verifier.verify(TOKEN));
    expect((err as ZaloAuthError).code).toBe('UNAVAILABLE');
  });

  it('lỗi mạng là UNAVAILABLE và thông báo không chứa token hay secret', async () => {
    const verifier = createZaloVerifier(
      async () => {
        throw new Error(`socket reset khi gọi với ${TOKEN} và ${APP_SECRET}`);
      },
      { appSecret: APP_SECRET },
    );
    const err = await catchError(verifier.verify(TOKEN));
    expect((err as ZaloAuthError).code).toBe('UNAVAILABLE');
    expect((err as Error).message).not.toContain(TOKEN);
    expect((err as Error).message).not.toContain(APP_SECRET);
  });

  it('timeout (quá 8 giây, dùng 10 ms trong test) là UNAVAILABLE', async () => {
    const hang: FetchFn = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const verifier = createZaloVerifier(hang, { appSecret: APP_SECRET, timeoutMs: 10 });
    const err = await catchError(verifier.verify(TOKEN));
    expect((err as ZaloAuthError).code).toBe('UNAVAILABLE');
  });

  it('thân phản hồi treo sau khi header đã về vẫn bị timeout: UNAVAILABLE', async () => {
    // Header 200 về ngay, nhưng res.json() không bao giờ kết thúc cho tới khi signal bị abort (như fetch thật).
    const hangingBody: FetchFn = async (_url, init) => {
      const signal = init?.signal;
      const res = {
        status: 200,
        ok: true,
        json: () =>
          new Promise<unknown>((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('body aborted')));
          }),
      };
      return res as unknown as Response;
    };
    const verifier = createZaloVerifier(hangingBody, { appSecret: APP_SECRET, timeoutMs: 10 });
    const started = Date.now();
    const err = await catchError(verifier.verify(TOKEN));
    expect((err as ZaloAuthError).code).toBe('UNAVAILABLE');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('thân JSON hỏng là UNAVAILABLE', async () => {
    const badJson: FetchFn = async () => new Response('{không phải json', { status: 200 });
    const verifier = createZaloVerifier(badJson, { appSecret: APP_SECRET });
    const err = await catchError(verifier.verify(TOKEN));
    expect((err as ZaloAuthError).code).toBe('UNAVAILABLE');
  });

  it('id số lớn trong thân phản hồi thật là UNAVAILABLE qua verifier', async () => {
    const verifier = createZaloVerifier(
      async () => new Response('{"id": 9007199254740993, "name": "H"}', { status: 200 }),
      { appSecret: APP_SECRET },
    );
    const err = await catchError(verifier.verify(TOKEN));
    expect((err as ZaloAuthError).code).toBe('UNAVAILABLE');
  });
});

/** Ghi lại thứ tự thao tác trên mọi client giả, để kiểm tra thứ tự createUser -> profiles -> zalo_identities. */
function fakeDb(opts: {
  lookups?: Array<string | null>;
  insertErrors?: Record<string, DbError | null>;
  ops: string[];
  inserted: Array<{ table: string; values: Record<string, unknown> }>;
}): DbLike {
  const lookups = [...(opts.lookups ?? [])];
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  opts.ops.push(`lookup:${table}`);
                  const next = lookups.length > 0 ? lookups.shift() : null;
                  return { data: next === null || next === undefined ? null : { user_id: next }, error: null };
                },
              };
            },
          };
        },
        insert(values: Record<string, unknown>) {
          opts.ops.push(`insert:${table}`);
          opts.inserted.push({ table, values });
          return Promise.resolve({ error: opts.insertErrors?.[table] ?? null });
        },
      };
    },
  };
}

function fakeAdmin(opts: { ops: string[]; createdId?: string; createError?: DbError }): AdminUsersLike {
  return {
    async createUser(attrs) {
      opts.ops.push(`createUser:${attrs.email.endsWith('.invalid')}`);
      if (opts.createError) return { data: { user: null }, error: opts.createError };
      return { data: { user: { id: opts.createdId ?? 'uid-new' } }, error: null };
    },
    async deleteUser(id) {
      opts.ops.push(`deleteUser:${id}`);
      return { error: null };
    },
  };
}

describe('createUserStore', () => {
  it('findUserIdByZaloId trả null khi chưa có và user_id khi đã có', async () => {
    const ops: string[] = [];
    const inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
    const store = createUserStore({
      admin: fakeAdmin({ ops }),
      db: fakeDb({ lookups: [null, 'uid-old'], ops, inserted }),
    });
    expect(await store.findUserIdByZaloId('z1')).toBeNull();
    expect(await store.findUserIdByZaloId('z1')).toBe('uid-old');
  });

  it('user mới: createUser rồi insert profiles rồi insert zalo_identities, không cleanup', async () => {
    const ops: string[] = [];
    const inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
    const store = createUserStore({
      admin: fakeAdmin({ ops, createdId: 'uid-1' }),
      db: fakeDb({ ops, inserted }),
    });
    const id = await store.createUserForZalo({ zaloId: 'z1', name: 'An', avatarUrl: 'https://a/b.png' });

    expect(id).toBe('uid-1');
    expect(ops).toEqual(['createUser:true', 'insert:profiles', 'insert:zalo_identities']);
    expect(inserted[0]).toEqual({
      table: 'profiles',
      values: { id: 'uid-1', display_name: 'An', avatar_url: 'https://a/b.png' },
    });
    expect(inserted[1]).toEqual({ table: 'zalo_identities', values: { zalo_id: 'z1', user_id: 'uid-1' } });
  });

  it('không có avatar thì avatar_url là null', async () => {
    const ops: string[] = [];
    const inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
    const store = createUserStore({ admin: fakeAdmin({ ops }), db: fakeDb({ ops, inserted }) });
    await store.createUserForZalo({ zaloId: 'z1', name: 'An' });
    expect(inserted[0].values.avatar_url).toBeNull();
  });

  it('đua 23505 ở zalo_identities: xoá user vừa tạo rồi trả user của bên thắng', async () => {
    const ops: string[] = [];
    const inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
    const store = createUserStore({
      admin: fakeAdmin({ ops, createdId: 'uid-loser' }),
      db: fakeDb({
        ops,
        inserted,
        lookups: ['uid-winner'],
        insertErrors: { zalo_identities: { code: '23505' } },
      }),
    });
    const id = await store.createUserForZalo({ zaloId: 'z1', name: 'An' });

    expect(id).toBe('uid-winner');
    expect(ops).toContain('deleteUser:uid-loser');
    expect(ops.indexOf('deleteUser:uid-loser')).toBeGreaterThan(ops.indexOf('insert:zalo_identities'));
  });

  it('insert profiles lỗi: dọn auth.users rồi ném StoreError không chứa thông báo gốc', async () => {
    const ops: string[] = [];
    const inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
    const store = createUserStore({
      admin: fakeAdmin({ ops, createdId: 'uid-3' }),
      db: fakeDb({ ops, inserted, insertErrors: { profiles: { code: '23514', message: 'check fail' } } }),
    });
    const err = await catchError(store.createUserForZalo({ zaloId: 'z1', name: 'An' }));
    expect(err).toBeInstanceOf(StoreError);
    expect(ops).toContain('deleteUser:uid-3');
    expect(ops).not.toContain('insert:zalo_identities');
    expect((err as Error).message).not.toContain('check fail');
  });

  it('insert zalo_identities lỗi không phải 23505: dọn và ném lỗi', async () => {
    const ops: string[] = [];
    const inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
    const store = createUserStore({
      admin: fakeAdmin({ ops, createdId: 'uid-4' }),
      db: fakeDb({ ops, inserted, insertErrors: { zalo_identities: { code: '08006' } } }),
    });
    const err = await catchError(store.createUserForZalo({ zaloId: 'z1', name: 'An' }));
    expect(err).toBeInstanceOf(StoreError);
    expect(ops).toContain('deleteUser:uid-4');
  });

  it('createUser lỗi: ném StoreError, không ghi bảng nào', async () => {
    const ops: string[] = [];
    const inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
    const store = createUserStore({
      admin: fakeAdmin({ ops, createError: { code: 'over_quota' } }),
      db: fakeDb({ ops, inserted }),
    });
    await expect(store.createUserForZalo({ zaloId: 'z1', name: 'An' })).rejects.toBeInstanceOf(StoreError);
    expect(ops.some((o) => o.startsWith('insert:'))).toBe(false);
  });
});

function fakeAuth(opts: {
  email?: string | null;
  hashedToken?: string | null;
  session?: { access_token: string; refresh_token: string; expires_in: number } | null;
  ops: string[];
}): { admin: AdminAuthLike; anonAuth: AnonAuthLike } {
  return {
    admin: {
      async getUserById(id) {
        opts.ops.push(`getUserById:${id}`);
        return { data: { user: opts.email === null ? null : { email: opts.email ?? 'a@zalo.gymer.invalid' } }, error: null };
      },
      async generateLink(params) {
        opts.ops.push(`generateLink:${params.type}`);
        return { data: { properties: { hashed_token: opts.hashedToken === undefined ? 'hash-1' : opts.hashedToken } }, error: null };
      },
    },
    anonAuth: {
      async verifyOtp(params) {
        opts.ops.push(`verifyOtp:${params.type}`);
        return { data: { session: opts.session === undefined ? { access_token: 'AT-1', refresh_token: 'RT-1', expires_in: 3600 } : opts.session }, error: null };
      },
    },
  };
}

describe('createSessionIssuer', () => {
  it('cấp phiên theo thứ tự getUserById -> generateLink -> verifyOtp', async () => {
    const ops: string[] = [];
    const issuer = createSessionIssuer(fakeAuth({ ops }));
    const session = await issuer.issue('uid-1');
    expect(session).toEqual({ accessToken: 'AT-1', refreshToken: 'RT-1', expiresIn: 3600 });
    expect(ops).toEqual(['getUserById:uid-1', 'generateLink:magiclink', 'verifyOtp:magiclink']);
  });

  it('thiếu hashed_token: ném SessionIssueError và không gọi verifyOtp', async () => {
    const ops: string[] = [];
    const issuer = createSessionIssuer(fakeAuth({ ops, hashedToken: null }));
    const err = await catchError(issuer.issue('uid-1'));
    expect(err).toBeInstanceOf(SessionIssueError);
    expect(ops).not.toContain('verifyOtp:magiclink');
  });

  it('user không có email: ném SessionIssueError', async () => {
    const ops: string[] = [];
    const issuer = createSessionIssuer(fakeAuth({ ops, email: null }));
    await expect(issuer.issue('uid-1')).rejects.toBeInstanceOf(SessionIssueError);
  });

  it('verifyOtp không có session: ném SessionIssueError', async () => {
    const ops: string[] = [];
    const issuer = createSessionIssuer(fakeAuth({ ops, session: null }));
    await expect(issuer.issue('uid-1')).rejects.toBeInstanceOf(SessionIssueError);
  });

  it('thông báo lỗi không chứa token phiên', async () => {
    const ops: string[] = [];
    const issuer = createSessionIssuer(fakeAuth({ ops, session: null }));
    const err = await catchError(issuer.issue('uid-1'));
    expect((err as Error).message).not.toContain('AT-1');
    expect((err as Error).message).not.toContain('RT-1');
  });
});
