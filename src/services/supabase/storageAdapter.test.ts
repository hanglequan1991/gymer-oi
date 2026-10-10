import { describe, expect, it } from 'vitest';
import type { StoragePort } from '@/platform/ports';
import { createFakeStorage } from '@/platform/fake/fakeStorage';
import { toAuthStorage } from './storageAdapter';

/** Kho luôn lỗi, để kiểm tra adapter nuốt lỗi và dùng dự phòng bộ nhớ. */
function brokenStorage(): StoragePort {
  const fail = async (): Promise<never> => {
    throw new Error('nativeStorage hỏng');
  };
  return { get: fail, set: fail, remove: fail };
}

describe('toAuthStorage', () => {
  it('lưu và đọc lại chuỗi qua StoragePort', async () => {
    const storage = createFakeStorage();
    const auth = toAuthStorage(storage);

    await auth.setItem('sb-token', 'abc');
    expect(await auth.getItem('sb-token')).toBe('abc');
    expect(await storage.get<string>('sb-token')).toBe('abc');
  });

  it('khoá chưa có trả null', async () => {
    const auth = toAuthStorage(createFakeStorage());
    expect(await auth.getItem('chưa-có')).toBeNull();
  });

  it('removeItem xoá khỏi StoragePort', async () => {
    const storage = createFakeStorage();
    const auth = toAuthStorage(storage);

    await auth.setItem('k', 'v');
    await auth.removeItem('k');
    expect(await auth.getItem('k')).toBeNull();
    expect(await storage.get<string>('k')).toBeUndefined();
  });

  it('StoragePort lỗi không ném ra ngoài và vẫn đọc được qua bộ nhớ dự phòng', async () => {
    const auth = toAuthStorage(brokenStorage());

    await expect(auth.setItem('k', 'v')).resolves.toBeUndefined();
    expect(await auth.getItem('k')).toBe('v');
    await expect(auth.removeItem('k')).resolves.toBeUndefined();
    expect(await auth.getItem('k')).toBeNull();
  });

  it('ghi lỗi một phần: đọc ra giá trị mới (dự phòng thắng), không phải bản cũ trong StoragePort', async () => {
    // Kịch bản 1: refresh token đã xoay vòng, set lỗi, StoragePort vẫn trả bản cũ.
    const storage: StoragePort = {
      get: async <T>() => 'refresh-cũ' as unknown as T,
      set: async () => {
        throw new Error('nativeStorage hỏng');
      },
      remove: async () => {},
    };
    const auth = toAuthStorage(storage);

    await auth.setItem('sb-token', 'refresh-mới');
    expect(await auth.getItem('sb-token')).toBe('refresh-mới');
  });

  it('xoá lỗi một phần: sau removeItem không đọc lại phiên cũ từ StoragePort', async () => {
    // Kịch bản 2: signOut xoá dự phòng, remove lỗi, StoragePort vẫn còn phiên cũ.
    const storage: StoragePort = {
      get: async <T>() => 'phiên-cũ' as unknown as T,
      set: async () => {},
      remove: async () => {
        throw new Error('nativeStorage hỏng');
      },
    };
    const auth = toAuthStorage(storage);

    await auth.removeItem('sb-token');
    expect(await auth.getItem('sb-token')).toBeNull();
  });

  it('setItem sau removeItem trong cùng lần chạy đọc lại được giá trị mới', async () => {
    const auth = toAuthStorage(brokenStorage());

    await auth.setItem('k', 'v1');
    await auth.removeItem('k');
    await auth.setItem('k', 'v2');
    expect(await auth.getItem('k')).toBe('v2');
  });

  it('giá trị không phải chuỗi trong StoragePort bị coi là không có', async () => {
    const storage = createFakeStorage();
    await storage.set('k', { không: 'phải chuỗi' });
    const auth = toAuthStorage(storage);

    expect(await auth.getItem('k')).toBeNull();
  });
});
