// Cài đặt thật của AuthPort bằng zmp-sdk. Chỉ file trong src/platform/zmp/ được import zmp-sdk.
import { getAccessToken, getUserInfo, login } from 'zmp-sdk';
import { PlatformError } from '@/platform/ports';
import type { AuthPort, LoginResult, ZaloProfile } from '@/platform/ports';

/** Mã lỗi SDK khi người dùng từ chối đăng nhập (theo tài liệu zmp-sdk, ví dụ followOA/authorize: -201). */
const CODE_USER_REFUSED = -201;
/** Mã lỗi SDK khi người dùng từ chối cung cấp tên và ảnh đại diện (getUserInfo: -1401). */
const CODE_USER_INFO_REFUSED = -1401;

/** Lấy mã số của lỗi SDK (AppError có trường code) mà không phụ thuộc lớp runtime. */
function sdkErrorCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number') {
    return error.code;
  }
  return undefined;
}

/** Ánh xạ lỗi SDK sang PlatformError. Mã từ chối cho trước -> PERMISSION_DENIED, còn lại -> UNKNOWN. */
function toAuthError(error: unknown, refusedCode: number, message: string): PlatformError {
  if (error instanceof PlatformError) return error;
  if (sdkErrorCode(error) === refusedCode) {
    return new PlatformError('PERMISSION_DENIED', 'Người dùng đã từ chối quyền truy cập tài khoản Zalo.');
  }
  return new PlatformError('UNKNOWN', message);
}

/** Tạo cổng xác thực thật bọc zmp-sdk. */
export function createZmpAuth(): AuthPort {
  return {
    async login(): Promise<LoginResult> {
      try {
        // Mở luồng đăng nhập Zalo. Tài liệu SDK không mô tả giá trị trả về của login(), nên bỏ qua.
        await login();
        // Access token được lấy riêng qua getAccessToken, theo tài liệu SDK.
        const zaloAccessToken = await getAccessToken();
        return { zaloAccessToken };
      } catch (error) {
        throw toAuthError(error, CODE_USER_REFUSED, 'Không thể đăng nhập Zalo.');
      }
    },

    async getProfile(): Promise<ZaloProfile> {
      try {
        // autoRequestPermission: true để SDK tự hiện form xin quyền thông tin người dùng.
        const { userInfo } = await getUserInfo({ autoRequestPermission: true });
        return {
          zaloId: userInfo.id,
          name: userInfo.name,
          avatarUrl: userInfo.avatar || undefined,
        };
      } catch (error) {
        throw toAuthError(error, CODE_USER_INFO_REFUSED, 'Không thể lấy hồ sơ người dùng Zalo.');
      }
    },
  };
}
