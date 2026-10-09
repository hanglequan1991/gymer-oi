// Điểm xuất của bản giả platform, dùng cho test và chạy dev trong trình duyệt thường.
// Không được import từ code production trừ khi đã chọn chế độ giả.
import type { Platform } from '@/platform/ports';
import { createFakeAuth } from './fakeAuth';
import { createFakeLocation } from './fakeLocation';
import { createFakeStorage } from './fakeStorage';

export { createFakeAuth } from './fakeAuth';
export type { FakeAuthOptions } from './fakeAuth';
export { createFakeLocation } from './fakeLocation';
export type { FakeLocationOptions } from './fakeLocation';
export { createFakeStorage } from './fakeStorage';

/**
 * Tạo Platform giả đầy đủ. Có thể truyền một phần để thay thế từng cổng,
 * các cổng còn lại dùng cài đặt giả mặc định.
 */
export function createFakePlatform(overrides: Partial<Platform> = {}): Platform {
  return {
    auth: createFakeAuth(),
    location: createFakeLocation(),
    storage: createFakeStorage(),
    ...overrides,
  };
}
