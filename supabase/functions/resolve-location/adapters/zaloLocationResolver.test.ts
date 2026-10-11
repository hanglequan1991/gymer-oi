// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createZaloLocationResolver, parseZaloLocationText, ZALO_LOCATION_ENDPOINT } from './zaloLocationResolver.ts';
import { ZaloLocationError, type FetchFn } from '../ports.ts';

const ACCESS = 'AT-secret-zalo-abc-123';
const LOC = 'LOC-secret-token-xyz-789';
const APP_SECRET = 'SECRET-app-do-not-log-000';
const REQ = { accessToken: ACCESS, locationToken: LOC };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function okBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    data: { provider: 'gps', latitude: '10.7769', longitude: '106.7009', timestamp: '1760000000000', ...overrides },
    error: 0,
  };
}

function resolverWith(fetchFn: FetchFn, timeoutMs?: number) {
  return createZaloLocationResolver(fetchFn, { appSecret: APP_SECRET, timeoutMs });
}

async function captureError(p: Promise<unknown>): Promise<ZaloLocationError> {
  try {
    await p;
  } catch (err) {
    if (err instanceof ZaloLocationError) return err;
    throw err;
  }
  throw new Error('kỳ vọng ném lỗi nhưng không ném');
}

describe('zaloLocationResolver: gọi Zalo', () => {
  it('gọi GET đúng endpoint với header access_token, code, secret_key', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => jsonResponse(okBody()));
    await resolverWith(fetchFn).resolve(REQ);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(ZALO_LOCATION_ENDPOINT);
    expect(url).toBe('https://graph.zalo.me/v2.0/me/info');
    expect(init?.method).toBe('GET');
    const headers = init?.headers as Record<string, string>;
    expect(headers.access_token).toBe(ACCESS);
    expect(headers.code).toBe(LOC);
    expect(headers.secret_key).toBe(APP_SECRET);
  });

  it('phản hồi thành công: đọc chuỗi latitude/longitude thành số', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => jsonResponse(okBody({ latitude: '-33.8688', longitude: '151.2093' })));
    const loc = await resolverWith(fetchFn).resolve(REQ);
    expect(loc).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it('chấp nhận toạ độ là số trong JSON', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => jsonResponse(okBody({ latitude: 10.5, longitude: 106.5 })));
    expect(await resolverWith(fetchFn).resolve(REQ)).toEqual({ lat: 10.5, lng: 106.5 });
  });

  it('từ chối cấu hình appSecret rỗng khi tạo resolver', () => {
    expect(() => createZaloLocationResolver(vi.fn<FetchFn>(), { appSecret: '' })).toThrow(TypeError);
  });
});

describe('zaloLocationResolver: phân loại lỗi', () => {
  it('error = 452 trong HTTP 200 -> INVALID_TOKEN', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => jsonResponse({ error: 452, message: 'x' }));
    const err = await captureError(resolverWith(fetchFn).resolve(REQ));
    expect(err.code).toBe('INVALID_TOKEN');
    expect(err.zaloErrorCode).toBe(452);
  });

  it('mã lỗi Zalo khác (không phải 452) -> UNAVAILABLE, mang theo mã số', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => jsonResponse({ error: -124, message: 'x' }));
    const err = await captureError(resolverWith(fetchFn).resolve(REQ));
    expect(err.code).toBe('UNAVAILABLE');
    expect(err.zaloErrorCode).toBe(-124);
  });

  it('HTTP 401 và HTTP 500 đều -> UNAVAILABLE (không suy ra token sai từ HTTP)', async () => {
    for (const status of [401, 500]) {
      const fetchFn = vi.fn<FetchFn>(async () => new Response('lỗi', { status }));
      const err = await captureError(resolverWith(fetchFn).resolve(REQ));
      expect(err.code).toBe('UNAVAILABLE');
      expect(err.httpStatus).toBe(status);
    }
  });

  it('fetch ném lỗi mạng -> UNAVAILABLE, thông báo không chứa token', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => {
      throw new Error(`ECONNRESET ${ACCESS} ${LOC}`);
    });
    const err = await captureError(resolverWith(fetchFn).resolve(REQ));
    expect(err.code).toBe('UNAVAILABLE');
    expect(err.message).not.toContain(ACCESS);
    expect(err.message).not.toContain(LOC);
  });

  it('quá thời gian (timeout) -> UNAVAILABLE sau timeoutMs', async () => {
    const fetchFn: FetchFn = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const started = Date.now();
    const err = await captureError(resolverWith(fetchFn, 20).resolve(REQ));
    expect(err.code).toBe('UNAVAILABLE');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('thân không phải JSON -> UNAVAILABLE', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('{ hỏng', { status: 200 }));
    const err = await captureError(resolverWith(fetchFn).resolve(REQ));
    expect(err.code).toBe('UNAVAILABLE');
  });
});

describe('parseZaloLocationText: kiểm phản hồi (fail-closed)', () => {
  it('thiếu trường error -> UNAVAILABLE (không coi là thành công)', () => {
    expect(() => parseZaloLocationText(JSON.stringify({ data: { latitude: '10.7', longitude: '106.7' } }))).toThrow(ZaloLocationError);
  });

  it('thiếu latitude -> UNAVAILABLE', () => {
    let thrown: unknown;
    try {
      parseZaloLocationText(JSON.stringify({ data: { longitude: '106.7' }, error: 0 }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ZaloLocationError);
    expect((thrown as ZaloLocationError).code).toBe('UNAVAILABLE');
  });

  it('chuỗi toạ độ không phải số (ví dụ "abc", "Infinity", "1e3") -> UNAVAILABLE', () => {
    for (const bad of ['abc', 'Infinity', '1e3', '', ' 10.7']) {
      expect(() => parseZaloLocationText(JSON.stringify(okBody({ latitude: bad })))).toThrow(ZaloLocationError);
    }
  });

  it('toạ độ ngoài biên (lat > 90, lng > 180) -> UNAVAILABLE', () => {
    expect(() => parseZaloLocationText(JSON.stringify(okBody({ latitude: '90.5' })))).toThrow(ZaloLocationError);
    expect(() => parseZaloLocationText(JSON.stringify(okBody({ longitude: '-180.5' })))).toThrow(ZaloLocationError);
  });

  it('data không phải object hoặc phản hồi là mảng -> UNAVAILABLE', () => {
    expect(() => parseZaloLocationText(JSON.stringify({ data: 'x', error: 0 }))).toThrow(ZaloLocationError);
    expect(() => parseZaloLocationText('[1,2]')).toThrow(ZaloLocationError);
  });

  it('mã error không đọc được (chuỗi chữ) -> UNAVAILABLE', () => {
    expect(() => parseZaloLocationText(JSON.stringify({ error: 'abc' }))).toThrow(ZaloLocationError);
  });
});
