// Cài đặt thật của StoragePort bằng nativeStorage của zmp-sdk. Giá trị được chuyển qua JSON.
import { nativeStorage } from 'zmp-sdk';
import { PlatformError } from '@/platform/ports';
import type { StoragePort } from '@/platform/ports';

/** Ánh xạ mọi lỗi lưu trữ thành PlatformError UNKNOWN, giữ nguyên PlatformError đã có. */
function toStorageError(error: unknown, message: string): PlatformError {
  if (error instanceof PlatformError) return error;
  return new PlatformError('UNKNOWN', message);
}

/** Tạo kho lưu trữ thật bọc nativeStorage. */
export function createZmpStorage(): StoragePort {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      try {
        // SDK khai báo trả string, nhưng tài liệu ghi là trả null khi khóa không tồn tại.
        const raw: string | null = nativeStorage.getItem(key);
        if (raw === null || raw === '') return undefined;
        return JSON.parse(raw) as T;
      } catch (error) {
        throw toStorageError(error, 'Không thể đọc dữ liệu đã lưu (JSON hỏng hoặc lỗi bộ nhớ Zalo).');
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      try {
        const json: string | undefined = JSON.stringify(value);
        if (json === undefined) {
          throw new PlatformError('UNKNOWN', 'Giá trị không thể lưu dưới dạng JSON.');
        }
        nativeStorage.setItem(key, json);
      } catch (error) {
        throw toStorageError(error, 'Không thể lưu dữ liệu vào bộ nhớ Zalo.');
      }
    },

    async remove(key: string): Promise<void> {
      try {
        nativeStorage.removeItem(key);
      } catch (error) {
        throw toStorageError(error, 'Không thể xóa dữ liệu đã lưu.');
      }
    },
  };
}
