// Cổng (port) của lớp platform: định nghĩa giao diện để app không phụ thuộc trực tiếp zmp-sdk.
// Chỉ đặt kiểu và lớp lỗi ở đây. Cài đặt thật nằm ở platform/zmp/*, cài đặt giả nằm ở platform/fake/*.
// Mọi cổng đều bất đồng bộ (Promise), kể cả khi SDK gốc dùng callback.

/** Mã lỗi platform để UI chọn thông báo phù hợp. */
export type PlatformErrorCode = 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'UNKNOWN';

/**
 * Lỗi do lớp platform ném ra, đã được ánh xạ từ lỗi SDK.
 * - PERMISSION_DENIED: người dùng từ chối quyền (ví dụ quyền vị trí).
 * - UNAVAILABLE: tính năng không khả dụng hoặc phiên đã hết hạn.
 * - UNKNOWN: lỗi khác.
 */
export class PlatformError extends Error {
  readonly code: PlatformErrorCode;

  constructor(code: PlatformErrorCode, message?: string) {
    super(message ?? 'Đã xảy ra lỗi không xác định khi gọi nền tảng Zalo.');
    this.name = 'PlatformError';
    this.code = code;
  }
}

/** Hồ sơ người dùng Zalo tối thiểu lấy từ SDK. */
export interface ZaloProfile {
  zaloId: string;
  name: string;
  avatarUrl?: string;
}

/** Kết quả đăng nhập: chỉ có access token của Zalo. */
export interface LoginResult {
  zaloAccessToken: string;
}

/** Cổng xác thực: đăng nhập Zalo và lấy hồ sơ người dùng. */
export interface AuthPort {
  /** Yêu cầu quyền và trả về access token của Zalo. */
  login(): Promise<LoginResult>;
  /** Lấy hồ sơ người dùng hiện tại. */
  getProfile(): Promise<ZaloProfile>;
}

/**
 * Cổng vị trí: chỉ trả về token vị trí, đúng như SDK.
 * Việc đổi token thành GeoPoint thuộc về tầng services (gọi edge function).
 */
export interface LocationPort {
  requestLocationToken(): Promise<{ token: string }>;
}

/**
 * Cổng lưu trữ cục bộ theo khóa. Giá trị được chuyển qua JSON.
 * Trả về undefined khi khóa chưa tồn tại.
 */
export interface StoragePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Gom toàn bộ cổng platform. Đây là điểm vào duy nhất cho UI và services. */
export interface Platform {
  auth: AuthPort;
  location: LocationPort;
  storage: StoragePort;
}
