// Cầu nối StoragePort (nativeStorage của Zalo, hoặc bản giả) sang SupportedStorage của supabase-js.
// Phiên đăng nhập Supabase được lưu qua đây để giữ phiên giữa các lần mở app (plan 2.2 D6, Q8).
import type { SupportedStorage } from '@supabase/supabase-js';
import type { StoragePort } from '@/platform/ports';

/**
 * Tạo kho phiên cho supabase-js từ StoragePort.
 * - Giá trị là chuỗi; StoragePort tự serialize qua JSON.
 * - Lỗi của StoragePort KHÔNG ném ra ngoài: nuốt lỗi và dùng Map trong bộ nhớ làm dự phòng,
 *   để phiên vẫn chạy trong phiên làm việc hiện tại dù nativeStorage hỏng.
 * - Thứ tự ưu tiên trong một lần chạy: giá trị trong dự phòng luôn thắng (đó là lần ghi gần nhất),
 *   kể cả khi StoragePort vẫn trả bản cũ do ghi lỗi một phần. Khoá đã xoá (removeItem) được ghi
 *   vào tập `removed` để không đọc lại bản cũ từ StoragePort (tránh phiên "sống lại" sau signOut).
 */
export function toAuthStorage(storage: StoragePort): SupportedStorage {
  const fallback = new Map<string, string>();
  const removed = new Set<string>();

  return {
    async getItem(key: string): Promise<string | null> {
      if (fallback.has(key)) return fallback.get(key) ?? null;
      if (removed.has(key)) return null;
      try {
        const value = await storage.get<unknown>(key);
        if (typeof value === 'string') return value;
      } catch {
        // Bỏ qua: không có giá trị nào đáng tin.
      }
      return null;
    },
    async setItem(key: string, value: string): Promise<void> {
      fallback.set(key, value);
      removed.delete(key);
      try {
        await storage.set<string>(key, value);
      } catch {
        // Bỏ qua: giá trị vẫn còn trong dự phòng bộ nhớ.
      }
    },
    async removeItem(key: string): Promise<void> {
      fallback.delete(key);
      removed.add(key);
      try {
        await storage.remove(key);
      } catch {
        // Bỏ qua: khoá đã nằm trong tập removed nên không đọc lại bản cũ.
      }
    },
  };
}
