// Cài đặt thật của LocationPort bằng zmp-sdk. Chỉ trả token vị trí, đổi sang toạ độ là việc của services.
import { authorize, getLocation, getSetting } from 'zmp-sdk';
import { PlatformError } from '@/platform/ports';
import type { LocationPort } from '@/platform/ports';

/** Mã lỗi SDK khi người dùng từ chối cấp quyền (theo tài liệu zmp-sdk: -201). */
const CODE_USER_REFUSED = -201;

/** Quyền vị trí theo tên scope của SDK. */
const LOCATION_SCOPE = 'scope.userLocation';

/** Lấy mã số của lỗi SDK (AppError có trường code) mà không phụ thuộc lớp runtime. */
function sdkErrorCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number') {
    return error.code;
  }
  return undefined;
}

/** Ánh xạ lỗi thành PlatformError. Người dùng từ chối -> PERMISSION_DENIED, còn lại -> UNKNOWN. */
function toLocationError(error: unknown): PlatformError {
  if (error instanceof PlatformError) return error;
  if (sdkErrorCode(error) === CODE_USER_REFUSED) {
    return new PlatformError('PERMISSION_DENIED', 'Người dùng đã từ chối quyền truy cập vị trí.');
  }
  return new PlatformError('UNKNOWN', 'Không thể lấy token vị trí từ Zalo.');
}

/** Tạo cổng vị trí thật bọc zmp-sdk. */
export function createZmpLocation(): LocationPort {
  return {
    async requestLocationToken(): Promise<{ token: string }> {
      try {
        // Nếu quyền chưa được cấp thì yêu cầu người dùng cho phép trước khi lấy vị trí.
        const setting = await getSetting();
        if (setting.authSetting[LOCATION_SCOPE] !== true) {
          const granted = await authorize({ scopes: [LOCATION_SCOPE] });
          if (granted[LOCATION_SCOPE] !== true) {
            throw new PlatformError('PERMISSION_DENIED', 'Người dùng đã từ chối quyền truy cập vị trí.');
          }
        }

        const { token } = await getLocation();
        // Ngoài Zalo (môi trường phát triển) SDK trả token rỗng, đó là hành vi đã tài liệu hóa nên giữ nguyên.
        if (token === undefined) {
          throw new PlatformError('UNKNOWN', 'SDK không trả về token vị trí.');
        }
        return { token };
      } catch (error) {
        throw toLocationError(error);
      }
    },
  };
}
