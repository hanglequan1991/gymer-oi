// Cài đặt giả của AuthPort, dùng cho Vitest và chạy npm run dev trong trình duyệt thường.
import type { AuthPort, LoginResult, PlatformError, ZaloProfile } from '@/platform/ports';

/** Cấu hình cho bản giả xác thực. */
export interface FakeAuthOptions {
  /** Access token trả về khi login thành công. */
  accessToken?: string;
  /** Hồ sơ trả về khi getProfile. */
  profile?: ZaloProfile;
  /** Nếu có, login và getProfile đều ném lỗi này. */
  error?: PlatformError;
}

const DEFAULT_PROFILE: ZaloProfile = {
  zaloId: 'fake-zalo-id',
  name: 'Người dùng thử',
};

/** Tạo cổng xác thực giả với cấu hình tùy chọn. */
export function createFakeAuth(options: FakeAuthOptions = {}): AuthPort {
  const accessToken = options.accessToken ?? 'fake-access-token';
  const profile = options.profile ?? DEFAULT_PROFILE;

  return {
    async login(): Promise<LoginResult> {
      if (options.error) throw options.error;
      return { zaloAccessToken: accessToken };
    },
    async getProfile(): Promise<ZaloProfile> {
      if (options.error) throw options.error;
      // Trả bản sao để người gọi sửa không ảnh hưởng cấu hình gốc.
      return { ...profile };
    },
  };
}
