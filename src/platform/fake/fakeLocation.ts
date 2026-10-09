// Cài đặt giả của LocationPort: trả token cố định hoặc ném lỗi theo cấu hình.
import type { LocationPort, PlatformError } from '@/platform/ports';

/** Cấu hình cho bản giả vị trí. */
export interface FakeLocationOptions {
  /** Token trả về khi thành công. */
  token?: string;
  /** Nếu có, requestLocationToken ném lỗi này (ví dụ PERMISSION_DENIED). */
  error?: PlatformError;
}

/** Tạo cổng vị trí giả với cấu hình tùy chọn. */
export function createFakeLocation(options: FakeLocationOptions = {}): LocationPort {
  const token = options.token ?? 'fake-location-token';

  return {
    async requestLocationToken(): Promise<{ token: string }> {
      if (options.error) throw options.error;
      return { token };
    },
  };
}
