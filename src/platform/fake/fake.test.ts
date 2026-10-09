// Kiểm thử các cài đặt giả của platform.
import { describe, expect, it } from 'vitest';
import { PlatformError } from '@/platform/ports';
import { createFakeAuth, createFakeLocation, createFakePlatform, createFakeStorage } from './index';

describe('createFakeStorage', () => {
  it('lưu và đọc lại giá trị object qua JSON, trả về bản sao', async () => {
    const storage = createFakeStorage();
    const value = { name: 'Quán', tags: ['Gym'] };

    await storage.set('profile', value);
    const loaded = await storage.get<typeof value>('profile');

    expect(loaded).toEqual(value);
    expect(loaded).not.toBe(value);
  });

  it('trả về undefined khi khóa chưa tồn tại', async () => {
    const storage = createFakeStorage();

    expect(await storage.get('khong-co')).toBeUndefined();
  });

  it('remove xóa khóa, các khóa khác không bị ảnh hưởng', async () => {
    const storage = createFakeStorage();
    await storage.set('a', 1);
    await storage.set('b', 2);

    await storage.remove('a');

    expect(await storage.get('a')).toBeUndefined();
    expect(await storage.get<number>('b')).toBe(2);
  });

  it('ném PlatformError UNKNOWN khi giá trị không serialize được', async () => {
    const storage = createFakeStorage();

    await expect(storage.set('x', undefined)).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('mỗi kho giả là một kho riêng, không dùng chung dữ liệu', async () => {
    const first = createFakeStorage();
    const second = createFakeStorage();
    await first.set('key', 'chỉ ở kho một');

    expect(await second.get('key')).toBeUndefined();
  });
});

describe('createFakeLocation', () => {
  it('trả về token mặc định khi không cấu hình', async () => {
    const location = createFakeLocation();

    await expect(location.requestLocationToken()).resolves.toEqual({
      token: 'fake-location-token',
    });
  });

  it('ném PERMISSION_DENIED khi được cấu hình lỗi', async () => {
    const location = createFakeLocation({
      error: new PlatformError('PERMISSION_DENIED', 'Người dùng từ chối quyền vị trí.'),
    });

    await expect(location.requestLocationToken()).rejects.toMatchObject({
      name: 'PlatformError',
      code: 'PERMISSION_DENIED',
    });
  });
});

describe('createFakeAuth', () => {
  it('login và getProfile trả về giá trị mặc định', async () => {
    const auth = createFakeAuth();

    await expect(auth.login()).resolves.toEqual({ zaloAccessToken: 'fake-access-token' });
    await expect(auth.getProfile()).resolves.toMatchObject({
      zaloId: 'fake-zalo-id',
      name: 'Người dùng thử',
    });
  });

  it('dùng token và hồ sơ đã cấu hình', async () => {
    const auth = createFakeAuth({
      accessToken: 'token-tuy-chinh',
      profile: { zaloId: '42', name: 'Gymer An', avatarUrl: 'https://example.com/a.png' },
    });

    await expect(auth.login()).resolves.toEqual({ zaloAccessToken: 'token-tuy-chinh' });
    await expect(auth.getProfile()).resolves.toEqual({
      zaloId: '42',
      name: 'Gymer An',
      avatarUrl: 'https://example.com/a.png',
    });
  });

  it('ném lỗi đã cấu hình cho cả login và getProfile', async () => {
    const auth = createFakeAuth({ error: new PlatformError('UNAVAILABLE') });

    await expect(auth.login()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await expect(auth.getProfile()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});

describe('createFakePlatform', () => {
  it('ghi đè một phần: cổng được thay thế, các cổng còn lại vẫn là bản giả mặc định', async () => {
    const platform = createFakePlatform({
      location: createFakeLocation({ token: 'token-thay-the' }),
    });

    await expect(platform.location.requestLocationToken()).resolves.toEqual({
      token: 'token-thay-the',
    });
    await expect(platform.auth.login()).resolves.toEqual({
      zaloAccessToken: 'fake-access-token',
    });
    await platform.storage.set('k', 'v');
    expect(await platform.storage.get('k')).toBe('v');
  });
});
