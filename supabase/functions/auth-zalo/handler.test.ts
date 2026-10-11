// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleAuthZalo, type AuthZaloDeps } from './handler.ts';
import { ZaloAuthError, type IssuedSession, type ZaloUser } from './ports.ts';

const TOKEN = 'zalo-token-abcdef-123456';
const ACCESS = 'AT-secret-xyz-123';
const REFRESH = 'RT-secret-xyz-456';

function makeFakes(overrides: { verifyUser?: ZaloUser; verifyError?: unknown; existingUserId?: string | null } = {}) {
  const verifier = {
    verify: vi.fn<(token: string) => Promise<ZaloUser>>(async () => {
      if (overrides.verifyError !== undefined) throw overrides.verifyError;
      return overrides.verifyUser ?? { zaloId: 'zalo-1', name: 'Quân', avatarUrl: 'https://cdn.example/a.png' };
    }),
  };
  const store = {
    findUserIdByZaloId: vi.fn<(zaloId: string) => Promise<string | null>>(async () =>
      overrides.existingUserId === undefined ? 'user-1' : overrides.existingUserId,
    ),
    createUserForZalo: vi.fn<(user: ZaloUser) => Promise<string>>(async () => 'user-new'),
  };
  const issuer = {
    issue: vi.fn<(userId: string) => Promise<IssuedSession>>(async () => ({ accessToken: ACCESS, refreshToken: REFRESH, expiresIn: 3600 })),
  };
  const logs: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
  const log = vi.fn((msg: string, meta?: Record<string, unknown>) => {
    logs.push({ msg, meta });
  });
  const deps: AuthZaloDeps = { verifier, store, issuer, log };
  return { deps, verifier, store, issuer, logs };
}

function post(body: unknown): Request {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://x.test/functions/v1/auth-zalo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw,
  });
}

describe('handleAuthZalo: phương thức và cấu hình', () => {
  it('OPTIONS trả 204 kèm CORS', async () => {
    const { deps, verifier } = makeFakes();
    const res = await handleAuthZalo(new Request('https://x.test', { method: 'OPTIONS' }), deps);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('GET trả 405 và không gọi verifier', async () => {
    const { deps, verifier } = makeFakes();
    const res = await handleAuthZalo(new Request('https://x.test', { method: 'GET' }), deps);
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST, OPTIONS');
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('thiếu cấu hình bắt buộc trả 500 CONFIG_MISSING, không chạy tiếp', async () => {
    const f = makeFakes();
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), {
      ...f.deps,
      missingConfig: ['ZALO_APP_SECRET'],
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIG_MISSING');
    expect(JSON.stringify(body)).not.toContain('ZALO_APP_SECRET');
    expect(f.verifier.verify).not.toHaveBeenCalled();
    expect(f.store.findUserIdByZaloId).not.toHaveBeenCalled();
    expect(f.issuer.issue).not.toHaveBeenCalled();
  });
});

describe('handleAuthZalo: kiểm đầu vào', () => {
  it('thân không phải JSON -> 400 INVALID_REQUEST, verifier không được gọi', async () => {
    const f = makeFakes();
    const res = await handleAuthZalo(post('{không-phải-json'), f.deps);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_REQUEST');
    expect(f.verifier.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['thiếu token', {}],
    ['token không phải chuỗi', { zaloAccessToken: 12345678901234 }],
    ['token ngắn (9 ký tự)', { zaloAccessToken: '123456789' }],
    ['token quá dài (2049 ký tự)', { zaloAccessToken: 'a'.repeat(2049) }],
    ['mảng thay vì object', ['x']],
    ['null', null],
  ])('%s -> 400 và verifier không được gọi', async (_label, body) => {
    const f = makeFakes();
    const res = await handleAuthZalo(post(body), f.deps);
    expect(res.status).toBe(400);
    expect(f.verifier.verify).not.toHaveBeenCalled();
  });

  it('thân lớn hơn 4 KB -> 400 và verifier không được gọi', async () => {
    const f = makeFakes();
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN, pad: 'x'.repeat(5000) }), f.deps);
    expect(res.status).toBe(400);
    expect(f.verifier.verify).not.toHaveBeenCalled();
  });

  it('client gửi user_id/zaloId bị bỏ qua: id lấy từ store', async () => {
    const f = makeFakes();
    const res = await handleAuthZalo(
      post({ zaloAccessToken: TOKEN, user_id: 'attacker', zaloId: 'attacker-zalo' }),
      f.deps,
    );
    expect(res.status).toBe(200);
    expect(f.store.findUserIdByZaloId).toHaveBeenCalledWith('zalo-1');
    expect(f.issuer.issue).toHaveBeenCalledWith('user-1');
    expect((await res.json()).user_id).toBe('user-1');
  });
});

describe('handleAuthZalo: lỗi xác minh Zalo', () => {
  it('token Zalo sai -> 401 ZALO_TOKEN_INVALID, store/issuer không được gọi', async () => {
    const f = makeFakes({ verifyError: new ZaloAuthError('INVALID_TOKEN') });
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('ZALO_TOKEN_INVALID');
    expect(f.store.findUserIdByZaloId).not.toHaveBeenCalled();
    expect(f.store.createUserForZalo).not.toHaveBeenCalled();
    expect(f.issuer.issue).not.toHaveBeenCalled();
  });

  it('Zalo sập -> 502 ZALO_UNAVAILABLE', async () => {
    const f = makeFakes({ verifyError: new ZaloAuthError('UNAVAILABLE') });
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('ZALO_UNAVAILABLE');
    expect(f.issuer.issue).not.toHaveBeenCalled();
  });

  it('lỗi không xác định từ verifier -> 500 INTERNAL, không lộ thông báo gốc', async () => {
    const f = makeFakes({ verifyError: new Error(`lộ ${TOKEN}`) });
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('INTERNAL');
    expect(text).not.toContain(TOKEN);
    expect(f.issuer.issue).not.toHaveBeenCalled();
  });
});

describe('handleAuthZalo: tạo và ghép tài khoản', () => {
  it('user mới: gọi createUserForZalo rồi cấp phiên, trả đủ trường', async () => {
    const f = makeFakes({ existingUserId: null });
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(res.status).toBe(200);
    expect(f.store.createUserForZalo).toHaveBeenCalledWith({
      zaloId: 'zalo-1',
      name: 'Quân',
      avatarUrl: 'https://cdn.example/a.png',
    });
    expect(f.issuer.issue).toHaveBeenCalledWith('user-new');
    expect(await res.json()).toEqual({
      access_token: ACCESS,
      refresh_token: REFRESH,
      expires_in: 3600,
      user_id: 'user-new',
    });
  });

  it('user cũ: không gọi createUserForZalo', async () => {
    const f = makeFakes({ existingUserId: 'user-1' });
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(res.status).toBe(200);
    expect(f.store.createUserForZalo).not.toHaveBeenCalled();
    expect(f.issuer.issue).toHaveBeenCalledWith('user-1');
  });

  it('name rỗng dùng tên mặc định; name dài cắt còn 50 ký tự', async () => {
    const empty = makeFakes({ existingUserId: null, verifyUser: { zaloId: 'z', name: '   ' } });
    await handleAuthZalo(post({ zaloAccessToken: TOKEN }), empty.deps);
    expect(empty.store.createUserForZalo).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Người dùng Zalo' }),
    );

    const long = makeFakes({ existingUserId: null, verifyUser: { zaloId: 'z', name: 'a'.repeat(80) } });
    await handleAuthZalo(post({ zaloAccessToken: TOKEN }), long.deps);
    const created = long.store.createUserForZalo.mock.calls[0][0];
    expect(created.name).toHaveLength(50);
  });

  it('avatar http:// bị bỏ, avatar không hợp lệ bị bỏ', async () => {
    const f = makeFakes({ existingUserId: null, verifyUser: { zaloId: 'z', name: 'Q', avatarUrl: 'http://cdn.example/a.png' } });
    await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(f.store.createUserForZalo.mock.calls[0][0].avatarUrl).toBeUndefined();

    const bad = makeFakes({ existingUserId: null, verifyUser: { zaloId: 'z', name: 'Q', avatarUrl: 'not a url' } });
    await handleAuthZalo(post({ zaloAccessToken: TOKEN }), bad.deps);
    expect(bad.store.createUserForZalo.mock.calls[0][0].avatarUrl).toBeUndefined();
  });

  it.each([
    ['zaloId rỗng', ''],
    ['zaloId quá dài (65 ký tự)', 'z'.repeat(65)],
  ])('%s từ verifier -> 500 INTERNAL, store không được gọi', async (_label, zaloId) => {
    const f = makeFakes({ verifyUser: { zaloId, name: 'Q' } });
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL');
    expect(f.store.findUserIdByZaloId).not.toHaveBeenCalled();
  });

  it('store ném lỗi -> 500 INTERNAL, thân không chứa thông báo gốc hay token', async () => {
    const f = makeFakes();
    f.store.findUserIdByZaloId.mockRejectedValueOnce(new Error(`db hỏng ${TOKEN} ${ACCESS}`));
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('INTERNAL');
    expect(text).not.toContain('db hỏng');
    expect(text).not.toContain(TOKEN);
  });

  it('issuer trả phiên thiếu trường -> 500 INTERNAL', async () => {
    const f = makeFakes();
    f.issuer.issue.mockResolvedValueOnce({ accessToken: '', refreshToken: REFRESH, expiresIn: 3600 });
    const res = await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL');
  });
});

describe('handleAuthZalo: không rò bí mật', () => {
  it('không phản hồi và không log nào chứa token nhận vào hoặc phiên cấp', async () => {
    const scenarios: Array<() => Promise<{ res: Response; f: ReturnType<typeof makeFakes> }>> = [
      async () => {
        const f = makeFakes();
        return { res: await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps), f };
      },
      async () => {
        const f = makeFakes({ existingUserId: null });
        return { res: await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps), f };
      },
      async () => {
        const f = makeFakes({ verifyError: new ZaloAuthError('INVALID_TOKEN') });
        return { res: await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps), f };
      },
      async () => {
        const f = makeFakes();
        f.store.findUserIdByZaloId.mockRejectedValueOnce(new Error(TOKEN));
        return { res: await handleAuthZalo(post({ zaloAccessToken: TOKEN }), f.deps), f };
      },
    ];

    for (const run of scenarios) {
      const { res, f } = await run();
      const text = await res.text();
      expect(text).not.toContain(TOKEN);
      const logText = JSON.stringify(f.logs);
      expect(logText).not.toContain(TOKEN);
      expect(logText).not.toContain(ACCESS);
      expect(logText).not.toContain(REFRESH);
    }
  });
});
