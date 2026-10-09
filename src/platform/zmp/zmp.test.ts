// Kiểm thử cài đặt zmp-sdk của platform bằng cách mock toàn bộ module 'zmp-sdk'.
import * as sdk from 'zmp-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createZmpLocation } from './zmpLocation';
import { createZmpAuth } from './zmpAuth';
import { createZmpStorage } from './zmpStorage';
import { createZmpPlatform } from './index';

vi.mock('zmp-sdk', () => ({
  login: vi.fn(),
  getAccessToken: vi.fn(),
  getUserInfo: vi.fn(),
  getSetting: vi.fn(),
  authorize: vi.fn(),
  getLocation: vi.fn(),
  nativeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

/** Kho giả cho nativeStorage: mô phỏng việc lưu chuỗi theo khóa. */
let store = new Map<string, string>();

/** Tạo lỗi có mã số giống AppError của SDK. */
function sdkError(code: number): Error {
  return Object.assign(new Error(`SDK lỗi ${code}`), { code });
}

beforeEach(() => {
  // Xóa cả implementation lẫn lịch sử gọi để mỗi ca bắt đầu sạch.
  vi.resetAllMocks();
  store = new Map<string, string>();
  // SDK khai báo getItem trả string nhưng thực tế trả null khi khóa không tồn tại.
  vi.mocked(sdk.nativeStorage.getItem).mockImplementation(
    (key: string) => store.get(key) ?? (null as unknown as string),
  );
  vi.mocked(sdk.nativeStorage.setItem).mockImplementation((key: string, value: string) => {
    store.set(key, value);
  });
  vi.mocked(sdk.nativeStorage.removeItem).mockImplementation((key: string) => {
    store.delete(key);
  });
});

describe('createZmpAuth.login', () => {
  it('gọi login rồi getAccessToken và trả về zaloAccessToken', async () => {
    vi.mocked(sdk.login).mockResolvedValue('auth-code');
    vi.mocked(sdk.getAccessToken).mockResolvedValue('access-abc');

    await expect(createZmpAuth().login()).resolves.toEqual({ zaloAccessToken: 'access-abc' });
    expect(sdk.login).toHaveBeenCalledTimes(1);
    expect(sdk.getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('người dùng từ chối (-201) -> PERMISSION_DENIED', async () => {
    vi.mocked(sdk.login).mockRejectedValue(sdkError(-201));

    await expect(createZmpAuth().login()).rejects.toMatchObject({
      name: 'PlatformError',
      code: 'PERMISSION_DENIED',
    });
  });

  it('lỗi lạ -> UNKNOWN', async () => {
    vi.mocked(sdk.login).mockResolvedValue('auth-code');
    vi.mocked(sdk.getAccessToken).mockRejectedValue(new Error('mạng hỏng'));

    await expect(createZmpAuth().login()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});

describe('createZmpAuth.getProfile', () => {
  it('ánh xạ userInfo của SDK sang ZaloProfile và yêu cầu quyền tự động', async () => {
    vi.mocked(sdk.getUserInfo).mockResolvedValue({
      userInfo: { id: '42', name: 'Gymer An', avatar: 'https://example.com/a.png' },
    } as Awaited<ReturnType<typeof sdk.getUserInfo>>);

    await expect(createZmpAuth().getProfile()).resolves.toEqual({
      zaloId: '42',
      name: 'Gymer An',
      avatarUrl: 'https://example.com/a.png',
    });
    expect(sdk.getUserInfo).toHaveBeenCalledWith({ autoRequestPermission: true });
  });

  it('người dùng từ chối thông tin (-1401) -> PERMISSION_DENIED', async () => {
    vi.mocked(sdk.getUserInfo).mockRejectedValue(sdkError(-1401));

    await expect(createZmpAuth().getProfile()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});

describe('createZmpLocation.requestLocationToken', () => {
  it('quyền đã cấp thì trả token, không gọi authorize', async () => {
    vi.mocked(sdk.getSetting).mockResolvedValue({
      authSetting: { 'scope.userLocation': true },
    } as Awaited<ReturnType<typeof sdk.getSetting>>);
    vi.mocked(sdk.getLocation).mockResolvedValue({ token: 'loc-token' });

    await expect(createZmpLocation().requestLocationToken()).resolves.toEqual({ token: 'loc-token' });
    expect(sdk.authorize).not.toHaveBeenCalled();
  });

  it('chưa cấp quyền và người dùng từ chối khi authorize -> PERMISSION_DENIED', async () => {
    vi.mocked(sdk.getSetting).mockResolvedValue({
      authSetting: {},
    } as Awaited<ReturnType<typeof sdk.getSetting>>);
    vi.mocked(sdk.authorize).mockResolvedValue({ 'scope.userLocation': false } as Awaited<
      ReturnType<typeof sdk.authorize>
    >);

    await expect(createZmpLocation().requestLocationToken()).rejects.toMatchObject({
      name: 'PlatformError',
      code: 'PERMISSION_DENIED',
    });
    expect(sdk.getLocation).not.toHaveBeenCalled();
  });

  it('authorize ném -201 (người dùng từ chối) -> PERMISSION_DENIED', async () => {
    vi.mocked(sdk.getSetting).mockResolvedValue({
      authSetting: {},
    } as Awaited<ReturnType<typeof sdk.getSetting>>);
    vi.mocked(sdk.authorize).mockRejectedValue(sdkError(-201));

    await expect(createZmpLocation().requestLocationToken()).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('lỗi lạ khi lấy vị trí -> UNKNOWN', async () => {
    vi.mocked(sdk.getSetting).mockResolvedValue({
      authSetting: { 'scope.userLocation': true },
    } as Awaited<ReturnType<typeof sdk.getSetting>>);
    vi.mocked(sdk.getLocation).mockRejectedValue(new Error('GPS tắt'));

    await expect(createZmpLocation().requestLocationToken()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});

describe('createZmpStorage', () => {
  it('lưu object qua JSON rồi đọc lại được bản sao giống hệt', async () => {
    const storage = createZmpStorage();
    const value = { name: 'Quán', tags: ['Gym'], radius: 2 };

    await storage.set('profile', value);
    const loaded = await storage.get<typeof value>('profile');

    expect(loaded).toEqual(value);
    expect(loaded).not.toBe(value);
    expect(sdk.nativeStorage.setItem).toHaveBeenCalledWith('profile', JSON.stringify(value));
  });

  it('khóa chưa tồn tại (SDK trả null) -> undefined', async () => {
    await expect(createZmpStorage().get('khong-co')).resolves.toBeUndefined();
  });

  it('remove xóa khóa đã lưu', async () => {
    const storage = createZmpStorage();
    await storage.set('a', 1);

    await storage.remove('a');

    await expect(storage.get('a')).resolves.toBeUndefined();
  });

  it('giá trị không serialize được -> UNKNOWN', async () => {
    await expect(createZmpStorage().set('x', undefined)).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});

describe('createZmpPlatform', () => {
  it('trả về đủ ba cổng auth, location, storage', () => {
    const platform = createZmpPlatform();

    expect(typeof platform.auth.login).toBe('function');
    expect(typeof platform.auth.getProfile).toBe('function');
    expect(typeof platform.location.requestLocationToken).toBe('function');
    expect(typeof platform.storage.get).toBe('function');
    expect(typeof platform.storage.set).toBe('function');
    expect(typeof platform.storage.remove).toBe('function');
  });
});
