// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleResolveLocation, type ResolveLocationDeps } from './handler.ts';
import { ZaloLocationError, type LatLng, type LocationRequest, type LocationResolver } from './ports.ts';

const ACCESS = 'AT-secret-zalo-abc-123';
const LOC = 'LOC-secret-token-xyz-789';
const APP_SECRET = 'SECRET-app-do-not-log-000';

function makeFakes(opts: { result?: LatLng; error?: unknown; missingConfig?: readonly string[] } = {}) {
  const resolver = {
    resolve: vi.fn<(req: LocationRequest) => Promise<LatLng>>(async () => {
      if (opts.error !== undefined) throw opts.error;
      return opts.result ?? { lat: 10.7769, lng: 106.7009 };
    }),
  };
  const logs: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
  const log = vi.fn((msg: string, meta?: Record<string, unknown>) => {
    logs.push({ msg, meta });
  });
  const deps: ResolveLocationDeps = {
    resolver: resolver as LocationResolver,
    log,
    missingConfig: opts.missingConfig,
  };
  return { deps, resolver, logs };
}

/** JWT giả (không ký): handler chỉ đọc payload, cổng Supabase mới kiểm chữ ký. */
function makeJwt(payload: unknown): string {
  const enc = (v: unknown): string => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.c2lnbmF0dXJl`;
}

const USER_JWT = makeJwt({ role: 'authenticated', sub: '6f1c2a3e-0000-4000-8000-000000000001', aud: 'authenticated' });
const ANON_JWT = makeJwt({ role: 'anon', iss: 'supabase' });
const AUTH_HEADER = `Bearer ${USER_JWT}`;

function post(body: unknown, authorization: string | null = AUTH_HEADER): Request {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authorization !== null) headers.authorization = authorization;
  return new Request('https://x.test/functions/v1/resolve-location', {
    method: 'POST',
    headers,
    body: raw,
  });
}

const VALID = { zaloAccessToken: ACCESS, locationToken: LOC };

describe('resolve-location handler', () => {
  it('thành công: trả { lat, lng } và truyền token đã cắt khoảng trắng cho resolver', async () => {
    const { deps, resolver } = makeFakes({ result: { lat: 10.7769, lng: 106.7009 } });
    const res = await handleResolveLocation(post({ zaloAccessToken: `  ${ACCESS}  `, locationToken: ` ${LOC} ` }), deps);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lat: 10.777, lng: 106.701 });
    expect(resolver.resolve).toHaveBeenCalledWith({ accessToken: ACCESS, locationToken: LOC });
  });

  it('làm tròn toạ độ 3 chữ số và chỉ trả đúng hai khoá lat, lng', async () => {
    const { deps } = makeFakes({ result: { lat: 10.77623456, lng: -106.70098765 } });
    const res = await handleResolveLocation(post(VALID), deps);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toEqual({ lat: 10.776, lng: -106.701 });
    expect(Object.keys(body).sort()).toEqual(['lat', 'lng']);
  });

  it('body không phải JSON -> 400 INVALID_REQUEST, không gọi resolver', async () => {
    const { deps, resolver } = makeFakes();
    const res = await handleResolveLocation(post('{ không phải json'), deps);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_REQUEST');
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('body là mảng hoặc null -> 400', async () => {
    const { deps, resolver } = makeFakes();
    expect((await handleResolveLocation(post([VALID]), deps)).status).toBe(400);
    expect((await handleResolveLocation(post('null'), deps)).status).toBe(400);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('thiếu zaloAccessToken hoặc locationToken -> 400', async () => {
    const { deps, resolver } = makeFakes();
    expect((await handleResolveLocation(post({ locationToken: LOC }), deps)).status).toBe(400);
    expect((await handleResolveLocation(post({ zaloAccessToken: ACCESS }), deps)).status).toBe(400);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('token sai định dạng (quá ngắn, có khoảng trắng bên trong, không phải ASCII, rỗng) -> 400', async () => {
    const { deps, resolver } = makeFakes();
    expect((await handleResolveLocation(post({ zaloAccessToken: 'short', locationToken: LOC }), deps)).status).toBe(400);
    expect((await handleResolveLocation(post({ zaloAccessToken: 'a b c d e f g', locationToken: LOC }), deps)).status).toBe(400);
    expect((await handleResolveLocation(post({ zaloAccessToken: ACCESS, locationToken: 'tôi-là-token' }), deps)).status).toBe(400);
    expect((await handleResolveLocation(post({ zaloAccessToken: ACCESS, locationToken: '   ' }), deps)).status).toBe(400);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('body vượt 4096 byte -> 400, không gọi resolver', async () => {
    const { deps, resolver } = makeFakes();
    const huge = JSON.stringify({ ...VALID, pad: 'x'.repeat(5000) });
    const res = await handleResolveLocation(post(huge), deps);

    expect(res.status).toBe(400);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('token Zalo sai (INVALID_TOKEN) -> 401 ZALO_TOKEN_INVALID', async () => {
    const { deps } = makeFakes({ error: new ZaloLocationError('INVALID_TOKEN', 'Token Zalo không hợp lệ.', { zaloErrorCode: 452 }) });
    const res = await handleResolveLocation(post(VALID), deps);

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('ZALO_TOKEN_INVALID');
  });

  it('Zalo lỗi tạm thời (UNAVAILABLE) -> 502 ZALO_UNAVAILABLE, retryable true', async () => {
    const { deps } = makeFakes({ error: new ZaloLocationError('UNAVAILABLE', 'Zalo trả lỗi tạm thời.', { httpStatus: 503 }) });
    const res = await handleResolveLocation(post(VALID), deps);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe('ZALO_UNAVAILABLE');
    expect(body.error.retryable).toBe(true);
  });

  it('resolver trả toạ độ không hữu hạn hoặc ngoài biên -> 502 (fail-closed)', async () => {
    const cases: LatLng[] = [
      { lat: Number.NaN, lng: 106.7 },
      { lat: 10.7, lng: Number.POSITIVE_INFINITY },
      { lat: 91, lng: 106.7 },
      { lat: 10.7, lng: -181 },
    ];
    for (const result of cases) {
      const { deps } = makeFakes({ result });
      const res = await handleResolveLocation(post(VALID), deps);
      expect(res.status).toBe(502);
      expect((await res.json()).error.code).toBe('ZALO_UNAVAILABLE');
    }
  });

  it('thiếu cấu hình (ZALO_APP_SECRET) -> 500 CONFIG_MISSING, không gọi resolver', async () => {
    const { deps, resolver } = makeFakes({ missingConfig: ['ZALO_APP_SECRET'] });
    const res = await handleResolveLocation(post(VALID), deps);

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('CONFIG_MISSING');
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('phương thức GET -> 405 kèm Allow; OPTIONS -> 204', async () => {
    const { deps, resolver } = makeFakes();
    const get = await handleResolveLocation(new Request('https://x.test/resolve-location', { method: 'GET' }), deps);
    expect(get.status).toBe(405);
    expect(get.headers.get('Allow')).toBe('POST, OPTIONS');

    const opt = await handleResolveLocation(new Request('https://x.test/resolve-location', { method: 'OPTIONS' }), deps);
    expect(opt.status).toBe(204);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('lỗi không mong đợi -> 500 INTERNAL, không lộ thông báo lỗi gốc', async () => {
    const { deps } = makeFakes({ error: new Error(`rò rỉ ${ACCESS} và ${LOC}`) });
    const res = await handleResolveLocation(post(VALID), deps);
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).toContain('INTERNAL');
    expect(text).not.toContain(ACCESS);
    expect(text).not.toContain(LOC);
  });

  it('không log chuỗi nhạy cảm (token, secret, toạ độ) trên mọi nhánh', async () => {
    const scenarios: Array<ReturnType<typeof makeFakes>> = [
      makeFakes({ result: { lat: 10.7769, lng: 106.7009 } }),
      makeFakes({ error: new ZaloLocationError('INVALID_TOKEN', 'x', { zaloErrorCode: 452 }) }),
      makeFakes({ error: new ZaloLocationError('UNAVAILABLE', 'x', { zaloErrorCode: 999 }) }),
      makeFakes({ error: new Error(`${ACCESS} ${LOC} ${APP_SECRET}`) }),
      makeFakes({ missingConfig: ['ZALO_APP_SECRET'] }),
    ];
    for (const s of scenarios) {
      await handleResolveLocation(post(VALID), s.deps);
    }
    const dump = JSON.stringify(scenarios.flatMap((s) => s.logs));
    expect(dump).not.toContain(ACCESS);
    expect(dump).not.toContain(LOC);
    expect(dump).not.toContain(APP_SECRET);
    expect(dump).not.toContain('10.7769');
    expect(dump).not.toContain('106.7009');
  });

  it('ghi mã số lỗi Zalo (zaloErrorCode, httpStatus) để học ở smoke test', async () => {
    const { deps, logs } = makeFakes({ error: new ZaloLocationError('UNAVAILABLE', 'x', { zaloErrorCode: 999 }) });
    await handleResolveLocation(post(VALID), deps);

    const entry = logs.find((l) => l.msg.includes('không lấy được vị trí'));
    expect(entry?.meta).toEqual({ zaloErrorCode: 999, httpStatus: undefined });
  });

  it('N4: JWT anon (role = anon) -> 401 UNAUTHENTICATED, không gọi resolver', async () => {
    const { deps, resolver } = makeFakes();
    const res = await handleResolveLocation(post(VALID, `Bearer ${ANON_JWT}`), deps);

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('N4: thiếu header Authorization -> 401 UNAUTHENTICATED', async () => {
    const { deps, resolver } = makeFakes();
    const res = await handleResolveLocation(post(VALID, null), deps);

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('N4: header sai định dạng (không phải Bearer, JWT thiếu phần, payload hỏng) -> 401', async () => {
    const { deps, resolver } = makeFakes();
    const badHeaders = [
      USER_JWT,
      `Basic ${USER_JWT}`,
      'Bearer abc',
      'Bearer a.b.c.d',
      'Bearer aaa.!!!.ccc',
      'Bearer aaa.bm90LWpzb24.ccc',
      `Bearer ${makeJwt(['authenticated'])}`,
    ];
    for (const header of badHeaders) {
      const res = await handleResolveLocation(post(VALID, header), deps);
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
    }
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('N4: role lấy từ claims JWT, không lấy từ body (body khai role authenticated vẫn bị 401)', async () => {
    const { deps, resolver } = makeFakes();
    const res = await handleResolveLocation(post({ ...VALID, role: 'authenticated', sub: 'x' }, `Bearer ${ANON_JWT}`), deps);

    expect(res.status).toBe(401);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('N4: JWT authenticated nhưng sub rỗng hoặc thiếu -> 401', async () => {
    const { deps, resolver } = makeFakes();
    const noSub = makeJwt({ role: 'authenticated' });
    const emptySub = makeJwt({ role: 'authenticated', sub: '   ' });
    expect((await handleResolveLocation(post(VALID, `Bearer ${noSub}`), deps)).status).toBe(401);
    expect((await handleResolveLocation(post(VALID, `Bearer ${emptySub}`), deps)).status).toBe(401);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('N4: anon bị từ chối trước khi đọc thân (body quá lớn vẫn trả 401, không 400)', async () => {
    const { deps } = makeFakes();
    const huge = JSON.stringify({ ...VALID, pad: 'x'.repeat(5000) });
    const res = await handleResolveLocation(post(huge, `Bearer ${ANON_JWT}`), deps);

    expect(res.status).toBe(401);
  });

  it('N4: từ chối không để lộ chuỗi JWT trong log hay phản hồi', async () => {
    const { deps, logs } = makeFakes();
    const res = await handleResolveLocation(post(VALID, `Bearer ${ANON_JWT}`), deps);
    const text = await res.text();

    expect(text).not.toContain(ANON_JWT);
    expect(JSON.stringify(logs)).not.toContain(ANON_JWT);
  });

  it('N4: người đã đăng nhập (authenticated, sub hợp lệ) đi tiếp đến resolver', async () => {
    const { deps, resolver } = makeFakes();
    const res = await handleResolveLocation(post(VALID, `bearer ${USER_JWT}`), deps);

    expect(res.status).toBe(200);
    expect(resolver.resolve).toHaveBeenCalledTimes(1);
  });

  it('log bị lỗi không làm hỏng phản hồi', async () => {
    const { deps } = makeFakes({ result: { lat: 10.7769, lng: 106.7009 } });
    deps.log = () => {
      throw new Error('log hỏng');
    };
    const res = await handleResolveLocation(post(VALID), deps);
    expect(res.status).toBe(200);
  });
});
