// Cổng vị trí của khách trên nhánh Supabase (plan app-ui-integration, T10, D8).
// Luồng getCurrent: auth.login -> location.requestLocationToken -> functions.invoke('resolve-location') -> { lat, lng }.
// Secret Zalo chỉ nằm ở server; client không tự gọi Zalo.
// Không bao giờ log hoặc đưa vào thông báo lỗi/cause: zaloAccessToken, locationToken, toạ độ.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthPort, LocationPort } from '@/platform/ports';
import { PlatformError } from '@/platform/ports';
import type { GeoPoint } from '@/types/geo';
import { AppError } from '../errors';
import type { LocationRepository } from '../repositories/locationRepository';
import type { Database } from './database.types';

/**
 * Cổng cần để lấy vị trí. Có thể thiếu: createServices không ép đủ cổng lúc khởi tạo,
 * nên thiếu thì getCurrent ném UNKNOWN (giống cách xử lý MISSING_AUTH ở composition root).
 */
export interface LocationDeps {
  auth?: AuthPort;
  location?: LocationPort;
}

/** Phần thông tin an toàn để giữ trong `cause`: không có message gốc (có thể chứa dữ liệu nhạy cảm). */
interface SafeCause {
  name?: string;
  status?: number;
  code?: string;
}

/** Hình dạng Response tối thiểu (duck typing, không phụ thuộc lớp Response toàn cục). */
interface ResponseLike {
  status: number;
  json: () => Promise<unknown>;
}

const MSG_FORBIDDEN = 'Chưa được cấp quyền truy cập vị trí.';
const MSG_NETWORK = 'Không lấy được vị trí, kiểm tra kết nối rồi thử lại.';
const MSG_UNKNOWN = 'Không lấy được vị trí, vui lòng thử lại.';
const MSG_MISSING_PORT = 'Thiếu cổng vị trí hoặc đăng nhập Zalo khi tạo services.';

// Giữ 3 chữ số thập phân (khoảng 100 m), khớp với server và repository tìm kiếm.
const ROUND_FACTOR = 1000;

function roundCoord(n: number): number {
  return Math.round(n * ROUND_FACTOR) / ROUND_FACTOR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isResponseLike(value: unknown): value is ResponseLike {
  return isRecord(value) && typeof value.status === 'number' && typeof value.json === 'function';
}

/** Lấy các trường an toàn từ lỗi của functions-js. Đọc mã lỗi trong body của function nếu có. */
async function describeError(error: unknown): Promise<SafeCause> {
  const info: SafeCause = {};
  if (!isRecord(error)) return info;
  if (typeof error.name === 'string') info.name = error.name;
  if (typeof error.status === 'number') info.status = error.status;

  const context = error.context;
  if (isResponseLike(context)) {
    info.status = context.status;
    try {
      const body = await context.json();
      if (isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string') {
        info.code = body.error.code;
      }
    } catch {
      // Body không phải JSON: giữ chỉ status.
    }
  }
  return info;
}

/** Ánh xạ lỗi của cổng platform (login hoặc requestLocationToken). Không giữ message gốc. */
function mapPlatformError(error: unknown): AppError {
  if (error instanceof PlatformError) {
    const cause: SafeCause = { name: error.name, code: error.code };
    if (error.code === 'PERMISSION_DENIED') return new AppError('FORBIDDEN', MSG_FORBIDDEN, cause);
    if (error.code === 'UNAVAILABLE') return new AppError('NETWORK', MSG_NETWORK, cause);
  }
  return new AppError('UNKNOWN', MSG_UNKNOWN);
}

/** Ánh xạ lỗi của functions.invoke('resolve-location'). */
function mapFunctionError(cause: SafeCause): AppError {
  // FunctionsFetchError nghĩa là không gửi được yêu cầu (mạng).
  if (cause.name === 'FunctionsFetchError') return new AppError('NETWORK', MSG_NETWORK, cause);
  if (cause.status === 400) return new AppError('VALIDATION', MSG_UNKNOWN, cause);
  if (cause.status === 401) return new AppError('UNAUTHENTICATED', MSG_UNKNOWN, cause);
  // 502 ZALO_UNAVAILABLE: Zalo tạm thời không trả vị trí, coi như lỗi mạng và cho thử lại.
  if (cause.status === 502) return new AppError('NETWORK', MSG_NETWORK, cause);
  // 500 CONFIG_MISSING và các lỗi khác: không đoán nguyên nhân.
  return new AppError('UNKNOWN', MSG_UNKNOWN, cause);
}

/** Kiểm phản hồi 200 { lat, lng }. Thiếu, sai kiểu, không hữu hạn hoặc ngoài biên: trả null. */
function parseGeoPoint(data: unknown): GeoPoint | null {
  if (!isRecord(data)) return null;
  const { lat, lng } = data;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

export function createLocationRepo(client: SupabaseClient<Database>, deps: LocationDeps): LocationRepository {
  return {
    async getCurrent() {
      const { auth, location } = deps;
      if (!auth || !location) {
        throw new AppError('UNKNOWN', MSG_MISSING_PORT);
      }

      // Bọc cả truy cập thuộc tính: cổng trả hình dạng sai thì vẫn ra AppError, không lộ TypeError gốc.
      let zaloAccessToken: string;
      try {
        zaloAccessToken = (await auth.login()).zaloAccessToken;
      } catch (error) {
        throw mapPlatformError(error);
      }

      let locationToken: string;
      try {
        locationToken = (await location.requestLocationToken()).token;
      } catch (error) {
        throw mapPlatformError(error);
      }

      // Token rỗng nghĩa là SDK không trả được vị trí (ngoài Zalo); không gọi server vô ích.
      if (!zaloAccessToken || !locationToken) {
        throw new AppError('UNKNOWN', MSG_UNKNOWN);
      }

      const { data, error } = await client.functions.invoke('resolve-location', {
        body: { zaloAccessToken, locationToken },
      });
      if (error) {
        throw mapFunctionError(await describeError(error));
      }

      const point = parseGeoPoint(data);
      if (point === null) {
        throw new AppError('UNKNOWN', MSG_UNKNOWN);
      }
      return point;
    },
  };
}
