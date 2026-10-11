// Kiểm thử locationRepo: luồng thành công, ánh xạ lỗi của platform và function, kiểm tra phản hồi, không rò token.
import { describe, expect, it, vi } from 'vitest';
import type { AuthPort, LocationPort } from '@/platform/ports';
import { PlatformError } from '@/platform/ports';
import { createFakeSupabase } from '@/test/fakeSupabase';
import type { FakeScript } from '@/test/fakeSupabase';
import { AppError } from '../errors';
import { createLocationRepo } from './locationRepo';

const ZALO_TOKEN = 'zalo-token-SECRET-abcdefghij';
const LOCATION_TOKEN = 'location-token-SECRET-klmnopqrst';

/** Cổng auth giả: login trả token Zalo (hoặc ném lỗi nếu được truyền vào). */
function fakeAuth(login: AuthPort['login'] = async () => ({ zaloAccessToken: ZALO_TOKEN })): AuthPort {
  return {
    login,
    async getProfile() {
      throw new Error('không dùng trong T10');
    },
  };
}

/** Cổng vị trí giả: requestLocationToken trả token vị trí (hoặc ném lỗi nếu được truyền vào). */
function fakeLocation(
  requestLocationToken: LocationPort['requestLocationToken'] = async () => ({ token: LOCATION_TOKEN }),
): LocationPort {
  return { requestLocationToken };
}

/** Lỗi HTTP của functions.invoke: có context là Response với body { error: { code } }. */
function httpError(status: number, code?: string): unknown {
  const body = code === undefined ? {} : { error: { code } };
  return Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    name: 'FunctionsHttpError',
    context: new Response(JSON.stringify(body), { status }),
  });
}

/** Lỗi mạng khi không gửi được yêu cầu tới function. */
function fetchError(): unknown {
  return Object.assign(new Error('Failed to send a request to the Edge Function'), {
    name: 'FunctionsFetchError',
  });
}

/** Kịch bản function resolve-location với một phản hồi cố định. */
function scriptWith(response: { data?: unknown; error?: unknown }): FakeScript {
  return { functions: { 'resolve-location': response } };
}

/** Chờ promise ném AppError và trả về lỗi đó. */
async function catchAppError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('kỳ vọng ném AppError nhưng không ném');
}

describe('locationRepo.getCurrent: luồng thành công', () => {
  it('gọi resolve-location đúng body gồm token Zalo và token vị trí, trả toạ độ', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 10.777, lng: 106.695 } }));
    const repo = createLocationRepo(fake.client, { auth: fakeAuth(), location: fakeLocation() });

    await expect(repo.getCurrent()).resolves.toEqual({ lat: 10.777, lng: 106.695 });

    expect(fake.calls).toContainEqual({
      kind: 'functions',
      name: 'resolve-location',
      args: { body: { zaloAccessToken: ZALO_TOKEN, locationToken: LOCATION_TOKEN } },
    });
  });

  it('làm tròn toạ độ về 3 chữ số thập phân', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 10.7769123, lng: 106.6954999 } }));
    const repo = createLocationRepo(fake.client, { auth: fakeAuth(), location: fakeLocation() });

    await expect(repo.getCurrent()).resolves.toEqual({ lat: 10.777, lng: 106.695 });
  });

  it('gọi login rồi requestLocationToken đúng một lần', async () => {
    const login = vi.fn(async () => ({ zaloAccessToken: ZALO_TOKEN }));
    const requestLocationToken = vi.fn(async () => ({ token: LOCATION_TOKEN }));
    const fake = createFakeSupabase(scriptWith({ data: { lat: 10.777, lng: 106.695 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(login),
      location: fakeLocation(requestLocationToken),
    });

    await repo.getCurrent();

    expect(login).toHaveBeenCalledTimes(1);
    expect(requestLocationToken).toHaveBeenCalledTimes(1);
  });
});

describe('locationRepo.getCurrent: lỗi của cổng platform', () => {
  it('login PERMISSION_DENIED thành FORBIDDEN', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(async () => {
        throw new PlatformError('PERMISSION_DENIED');
      }),
      location: fakeLocation(),
    });

    expect((await catchAppError(repo.getCurrent())).code).toBe('FORBIDDEN');
  });

  it('login UNAVAILABLE thành NETWORK', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(async () => {
        throw new PlatformError('UNAVAILABLE');
      }),
      location: fakeLocation(),
    });

    expect((await catchAppError(repo.getCurrent())).code).toBe('NETWORK');
  });

  it('requestLocationToken PERMISSION_DENIED thành FORBIDDEN', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(),
      location: fakeLocation(async () => {
        throw new PlatformError('PERMISSION_DENIED');
      }),
    });

    expect((await catchAppError(repo.getCurrent())).code).toBe('FORBIDDEN');
  });

  it('requestLocationToken UNAVAILABLE thành NETWORK', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(),
      location: fakeLocation(async () => {
        throw new PlatformError('UNAVAILABLE');
      }),
    });

    expect((await catchAppError(repo.getCurrent())).code).toBe('NETWORK');
  });

  it('lỗi UNKNOWN của platform hoặc lỗi lạ thành UNKNOWN', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(),
      location: fakeLocation(async () => {
        throw new PlatformError('UNKNOWN');
      }),
    });

    expect((await catchAppError(repo.getCurrent())).code).toBe('UNKNOWN');
  });

  it('token vị trí rỗng thành UNKNOWN và không gọi function', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(),
      location: fakeLocation(async () => ({ token: '' })),
    });

    expect((await catchAppError(repo.getCurrent())).code).toBe('UNKNOWN');
    expect(fake.calls.some((c) => c.kind === 'functions')).toBe(false);
  });

  it('access token Zalo rỗng thành UNKNOWN và không gọi function', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(async () => ({ zaloAccessToken: '' })),
      location: fakeLocation(),
    });

    expect((await catchAppError(repo.getCurrent())).code).toBe('UNKNOWN');
    expect(fake.calls.some((c) => c.kind === 'functions')).toBe(false);
  });
});

describe('locationRepo.getCurrent: lỗi của edge function', () => {
  it.each([
    ['400 thành VALIDATION', httpError(400, 'INVALID_REQUEST'), 'VALIDATION'],
    ['401 thành UNAUTHENTICATED', httpError(401, 'ZALO_TOKEN_INVALID'), 'UNAUTHENTICATED'],
    ['502 thành NETWORK', httpError(502, 'ZALO_UNAVAILABLE'), 'NETWORK'],
    ['500 CONFIG_MISSING thành UNKNOWN', httpError(500, 'CONFIG_MISSING'), 'UNKNOWN'],
    ['FunctionsFetchError thành NETWORK', fetchError(), 'NETWORK'],
  ])('%s', async (_name, error, expected) => {
    const fake = createFakeSupabase(scriptWith({ error }));
    const repo = createLocationRepo(fake.client, { auth: fakeAuth(), location: fakeLocation() });

    expect((await catchAppError(repo.getCurrent())).code).toBe(expected);
  });

  it('body lỗi không phải JSON vẫn ánh xạ theo status', async () => {
    const error = Object.assign(new Error('x'), {
      name: 'FunctionsHttpError',
      context: new Response('<html>502</html>', { status: 502 }),
    });
    const fake = createFakeSupabase(scriptWith({ error }));
    const repo = createLocationRepo(fake.client, { auth: fakeAuth(), location: fakeLocation() });

    expect((await catchAppError(repo.getCurrent())).code).toBe('NETWORK');
  });
});

describe('locationRepo.getCurrent: kiểm tra phản hồi', () => {
  it.each([
    ['thiếu lat', { lng: 106.695 }],
    ['lng là chuỗi', { lat: 10.777, lng: '106.695' }],
    ['lat ngoài biên (91)', { lat: 91, lng: 106.695 }],
    ['lng ngoài biên (-181)', { lat: 10.777, lng: -181 }],
    ['lat là NaN', { lat: Number.NaN, lng: 106.695 }],
    ['phản hồi null', null],
  ])('%s thành UNKNOWN', async (_name, data) => {
    const fake = createFakeSupabase(scriptWith({ data }));
    const repo = createLocationRepo(fake.client, { auth: fakeAuth(), location: fakeLocation() });

    expect((await catchAppError(repo.getCurrent())).code).toBe('UNKNOWN');
  });
});

describe('locationRepo.getCurrent: an toàn thông tin', () => {
  it('không đưa token hay message gốc vào lỗi', async () => {
    const fake = createFakeSupabase(scriptWith({ error: httpError(502, 'ZALO_UNAVAILABLE') }));
    const repo = createLocationRepo(fake.client, { auth: fakeAuth(), location: fakeLocation() });

    const error = await catchAppError(repo.getCurrent());
    const serialized = JSON.stringify({ message: error.message, cause: error.cause });

    expect(serialized).not.toContain(ZALO_TOKEN);
    expect(serialized).not.toContain(LOCATION_TOKEN);
    expect(serialized).not.toContain('Edge Function returned');
  });

  it('lỗi platform không giữ message gốc trong cause', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));
    const repo = createLocationRepo(fake.client, {
      auth: fakeAuth(),
      location: fakeLocation(async () => {
        throw new PlatformError('PERMISSION_DENIED', `lộ ${LOCATION_TOKEN}`);
      }),
    });

    const error = await catchAppError(repo.getCurrent());

    expect(JSON.stringify(error.cause)).not.toContain(LOCATION_TOKEN);
    expect(error.message).not.toContain(LOCATION_TOKEN);
  });
});

describe('locationRepo.getCurrent: thiếu cổng', () => {
  it('thiếu auth hoặc location thì getCurrent ném UNKNOWN, không ném khi tạo', async () => {
    const fake = createFakeSupabase(scriptWith({ data: { lat: 1, lng: 1 } }));

    const noAuth = createLocationRepo(fake.client, { location: fakeLocation() });
    const noLocation = createLocationRepo(fake.client, { auth: fakeAuth() });
    const noneGiven = createLocationRepo(fake.client, {});

    expect((await catchAppError(noAuth.getCurrent())).code).toBe('UNKNOWN');
    expect((await catchAppError(noLocation.getCurrent())).code).toBe('UNKNOWN');
    expect((await catchAppError(noneGiven.getCurrent())).code).toBe('UNKNOWN');
  });
});
