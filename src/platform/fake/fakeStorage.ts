// Cài đặt giả của StoragePort: lưu trong bộ nhớ (Map), giá trị đi qua JSON như bản thật.
import { PlatformError } from '@/platform/ports';
import type { StoragePort } from '@/platform/ports';

/** Tạo kho lưu trữ giả. Mỗi lần tạo là một kho riêng, không dùng chung trạng thái. */
export function createFakeStorage(): StoragePort {
  // Lưu chuỗi JSON để mô phỏng việc serialize; đọc lại luôn parse thành bản sao mới.
  const store = new Map<string, string>();

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const raw = store.get(key);
      if (raw === undefined) return undefined;
      return JSON.parse(raw) as T;
    },
    async set<T>(key: string, value: T): Promise<void> {
      const json: string | undefined = JSON.stringify(value);
      if (json === undefined) {
        // Giá trị như undefined hoặc hàm không có dạng JSON, giống hành vi lưu trữ thật.
        throw new PlatformError('UNKNOWN', 'Giá trị không thể lưu dưới dạng JSON.');
      }
      store.set(key, json);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
  };
}
