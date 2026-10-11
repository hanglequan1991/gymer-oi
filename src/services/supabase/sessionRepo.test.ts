import { describe, expect, it } from 'vitest';
import type { AuthPort } from '@/platform/ports';
import { PlatformError } from '@/platform/ports';
import { createFakeSupabase } from '@/test/fakeSupabase';
import type { FakeScript } from '@/test/fakeSupabase';
import { AppError } from '../errors';
import { createSessionRepo } from './sessionRepo';

const TOKEN = 'zalo-token-SECRET-abcdefghij';

/** Cổng auth giả: login trả token Zalo cố định (hoặc ném lỗi nếu được truyền vào). */
function fakeAuth(login: () => Promise<{ zaloAccessToken: string }> = async () => ({ zaloAccessToken: TOKEN })): AuthPort {
  return {
    login,
    async getProfile() {
      throw new Error('không dùng trong T-A');
    },
  };
}

/** Lỗi HTTP của functions.invoke, dựng theo review-dot-a mục 5.3. */
function httpError(status: number, code: string): unknown {
  return Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    name: 'FunctionsHttpError',
    context: new Response(JSON.stringify({ error: { code } }), { status }),
  });
}

const successBody = { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, user_id: 'u-1' };

/** Kịch bản thành công: function trả tokens, setSession thiết lập phiên đúng user. */
function okScript(): FakeScript {
  return {
    functions: { 'auth-zalo': { data: successBody } },
    auth: { setSessionResult: { session: { user: { id: 'u-1' } } } },
  };
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

describe('sessionRepo.signIn', () => {
  it('thành công: gọi auth-zalo đúng body, setSession bằng 2 token, trả userId', async () => {
    const fake = createFakeSupabase(okScript());
    const repo = createSessionRepo(fake.client, fakeAuth());

    await expect(repo.signIn()).resolves.toEqual({ userId: 'u-1' });

    expect(fake.calls).toContainEqual({
      kind: 'functions',
      name: 'auth-zalo',
      args: { body: { zaloAccessToken: TOKEN } },
    });
    // setSession chỉ nhận đúng hai token, không kèm trường khác.
    expect(fake.calls).toContainEqual({
      kind: 'auth',
      name: 'setSession',
      args: [{ access_token: 'at-1', refresh_token: 'rt-1' }],
    });
  });

  it('sau signIn thành công, getSession (cục bộ) trả đúng userId', async () => {
    const fake = createFakeSupabase({
      ...okScript(),
      auth: { setSessionResult: { session: { user: { id: 'u-1' } } } },
    });
    const repo = createSessionRepo(fake.client, fakeAuth());

    await repo.signIn();
    await expect(repo.getSession()).resolves.toEqual({ userId: 'u-1' });
  });

  it.each([
    [400, 'INVALID_REQUEST', 'VALIDATION'],
    [401, 'ZALO_TOKEN_INVALID', 'UNAUTHENTICATED'],
    [502, 'ZALO_UNAVAILABLE', 'NETWORK'],
    [500, 'CONFIG_MISSING', 'UNKNOWN'],
    [500, 'INTERNAL', 'UNKNOWN'],
  ])('HTTP %i (%s) -> %s; không gọi setSession', async (status, code, expected) => {
    const fake = createFakeSupabase({
      functions: { 'auth-zalo': { error: httpError(status, code) } },
    });
    const repo = createSessionRepo(fake.client, fakeAuth());

    const error = await catchAppError(repo.signIn());

    expect(error.code).toBe(expected);
    expect(fake.calls.some((c) => c.kind === 'auth' && c.name === 'setSession')).toBe(false);
  });

  it('lỗi mạng khi gọi function (FunctionsFetchError) -> NETWORK', async () => {
    const networkError = Object.assign(new Error('Failed to send a request to the Edge Function'), {
      name: 'FunctionsFetchError',
    });
    const fake = createFakeSupabase({ functions: { 'auth-zalo': { error: networkError } } });
    const repo = createSessionRepo(fake.client, fakeAuth());

    const error = await catchAppError(repo.signIn());

    expect(error.code).toBe('NETWORK');
  });

  it.each([
    ['PERMISSION_DENIED', 'FORBIDDEN'],
    ['UNAVAILABLE', 'NETWORK'],
    ['UNKNOWN', 'UNKNOWN'],
  ])('PlatformError %s -> %s; không gọi function', async (platformCode, expected) => {
    const fake = createFakeSupabase(okScript());
    const repo = createSessionRepo(
      fake.client,
      fakeAuth(async () => {
        throw new PlatformError(platformCode as 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'UNKNOWN');
      }),
    );

    const error = await catchAppError(repo.signIn());

    expect(error.code).toBe(expected);
    expect(fake.calls.some((c) => c.kind === 'functions')).toBe(false);
    expect(fake.calls.some((c) => c.kind === 'auth')).toBe(false);
  });

  it.each([
    ['thiếu refresh_token', { access_token: 'at-1', user_id: 'u-1' }],
    ['thiếu user_id', { access_token: 'at-1', refresh_token: 'rt-1' }],
    ['access_token rỗng', { access_token: '', refresh_token: 'rt-1', user_id: 'u-1' }],
    ['body null', null],
    ['body là chuỗi', 'not-json-object'],
  ])('phản hồi không hợp lệ (%s) -> UNKNOWN; không gọi setSession', async (_label, body) => {
    const fake = createFakeSupabase({
      functions: { 'auth-zalo': { data: body } },
    });
    const repo = createSessionRepo(fake.client, fakeAuth());

    const error = await catchAppError(repo.signIn());

    expect(error.code).toBe('UNKNOWN');
    expect(fake.calls.some((c) => c.kind === 'auth' && c.name === 'setSession')).toBe(false);
  });

  it('setSession lỗi -> UNKNOWN', async () => {
    const fake = createFakeSupabase({
      functions: { 'auth-zalo': { data: successBody } },
      auth: { setSessionResult: { session: null, error: { name: 'AuthError', status: 400, message: 'bad' } } },
    });
    const repo = createSessionRepo(fake.client, fakeAuth());

    const error = await catchAppError(repo.signIn());

    expect(error.code).toBe('UNKNOWN');
  });

  it('phiên thiết lập thuộc user khác với user_id trả về -> UNKNOWN', async () => {
    const fake = createFakeSupabase({
      functions: { 'auth-zalo': { data: successBody } },
      auth: { setSessionResult: { session: { user: { id: 'u-khac' } } } },
    });
    const repo = createSessionRepo(fake.client, fakeAuth());

    const error = await catchAppError(repo.signIn());

    expect(error.code).toBe('UNKNOWN');
  });

  it('token không xuất hiện trong message hay cause của mọi lỗi', async () => {
    const leaky = { name: 'AuthError', status: 500, message: `lộ ${TOKEN} và at-1 và rt-1` };
    const scenarios: Array<{ script: FakeScript; platform?: unknown }> = [
      { script: { functions: { 'auth-zalo': { error: httpError(401, 'ZALO_TOKEN_INVALID') } } } },
      { script: { functions: { 'auth-zalo': { data: { access_token: 'at-1' } } } } },
      { script: { functions: { 'auth-zalo': { data: successBody } }, auth: { setSessionResult: { session: null, error: leaky } } } },
      { script: okScript(), platform: new PlatformError('UNKNOWN', `lỗi ${TOKEN}`) },
    ];

    for (const scenario of scenarios) {
      const fake = createFakeSupabase(scenario.script);
      const repo = createSessionRepo(
        fake.client,
        fakeAuth(async () => {
          if (scenario.platform !== undefined) throw scenario.platform;
          return { zaloAccessToken: TOKEN };
        }),
      );

      const error = await catchAppError(repo.signIn());

      expect(error.message).not.toContain(TOKEN);
      expect(error.message).not.toContain('at-1');
      expect(JSON.stringify(error.cause ?? null)).not.toContain(TOKEN);
      expect(JSON.stringify(error.cause ?? null)).not.toContain('rt-1');
    }
  });
});

describe('sessionRepo.getSession', () => {
  it('chưa có phiên -> null, không gọi functions', async () => {
    const fake = createFakeSupabase({ auth: { session: null } });
    const repo = createSessionRepo(fake.client, fakeAuth());

    await expect(repo.getSession()).resolves.toBeNull();
    expect(fake.calls.some((c) => c.kind === 'functions')).toBe(false);
  });

  it('có phiên -> trả userId, chỉ đọc cục bộ (không gọi functions)', async () => {
    const fake = createFakeSupabase({ auth: { session: { user: { id: 'u-9' } } } });
    const repo = createSessionRepo(fake.client, fakeAuth());

    await expect(repo.getSession()).resolves.toEqual({ userId: 'u-9' });
    expect(fake.calls.some((c) => c.kind === 'functions')).toBe(false);
    expect(fake.calls.some((c) => c.kind === 'from' || c.kind === 'rpc')).toBe(false);
  });
});

describe('sessionRepo.signOut', () => {
  it('gọi signOut với scope local', async () => {
    const fake = createFakeSupabase({ auth: { session: { user: { id: 'u-1' } } } });
    const repo = createSessionRepo(fake.client, fakeAuth());

    await repo.signOut();

    expect(fake.calls).toContainEqual({ kind: 'auth', name: 'signOut', args: [] });
  });

  it('không có phiên (AuthSessionMissingError) thì không ném', async () => {
    const fake = createFakeSupabase({
      auth: { session: null, signOutError: { name: 'AuthSessionMissingError', message: 'Auth session missing' } },
    });
    const repo = createSessionRepo(fake.client, fakeAuth());

    await expect(repo.signOut()).resolves.toBeUndefined();
  });

  it('lỗi khác khi signOut -> UNKNOWN', async () => {
    const fake = createFakeSupabase({
      auth: { session: { user: { id: 'u-1' } }, signOutError: { name: 'AuthError', status: 500 } },
    });
    const repo = createSessionRepo(fake.client, fakeAuth());

    const error = await catchAppError(repo.signOut());

    expect(error.code).toBe('UNKNOWN');
  });
});
