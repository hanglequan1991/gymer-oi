// Adapter LocationResolver: đổi token vị trí Zalo thành toạ độ qua Graph API (plan T09, hợp đồng 3.1).
// Không import Deno.*, npm:, jsr: để tsc và Vitest (Node) đọc được. Nhận fetch qua tham số.
import { ZaloLocationError } from '../ports.ts';
import type { FetchFn, LatLng, LocationRequest, LocationResolver } from '../ports.ts';

// S2: endpoint, tên header (access_token, code, secret_key) và cấu trúc phản hồi
// { data: { latitude, longitude }, error } là hiểu biết của sen1 về API Zalo, CHƯA kiểm chứng với Zalo thật.
export const ZALO_LOCATION_ENDPOINT = 'https://graph.zalo.me/v2.0/me/info';
const DEFAULT_TIMEOUT_MS = 5000;

// S2: mã 452 = token sai. Cùng giả thuyết với auth-zalo (đã quan sát ở S1). Mã khác đi vào UNAVAILABLE và được log để học.
export const ZALO_INVALID_TOKEN_CODES: readonly number[] = [452];

export interface ZaloLocationResolverConfig {
  /** Mặc định ZALO_LOCATION_ENDPOINT. Chỉ đổi khi S2 xác nhận endpoint khác. */
  endpoint?: string;
  /** Secret của Mini App, gửi qua header secret_key. Bắt buộc (index.ts kiểm trước). */
  appSecret: string;
  timeoutMs?: number;
}

/**
 * Tạo resolver. Không bao giờ đưa token hay secret vào thông báo lỗi.
 * - error = 452 trong thân HTTP 200 -> ZaloLocationError('INVALID_TOKEN').
 * - HTTP lỗi, timeout, lỗi mạng, thân hỏng, thiếu/sai toạ độ, mã lỗi khác -> ZaloLocationError('UNAVAILABLE') (fail-closed).
 */
export function createZaloLocationResolver(fetchFn: FetchFn, config: ZaloLocationResolverConfig): LocationResolver {
  if (config.appSecret.length === 0) throw new TypeError('appSecret rỗng');
  const endpoint = config.endpoint ?? ZALO_LOCATION_ENDPOINT;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async resolve(request: LocationRequest): Promise<LatLng> {
      const headers: Record<string, string> = {
        access_token: request.accessToken,
        code: request.locationToken,
        secret_key: config.appSecret,
        Accept: 'application/json',
      };
      const controller = new AbortController();
      // Timer phủ cả lúc gọi fetch lẫn lúc đọc thân phản hồi: chỉ clear khi xong hẳn.
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let res: Response;
        try {
          res = await fetchFn(endpoint, { method: 'GET', headers, signal: controller.signal });
        } catch {
          // Lỗi mạng hoặc timeout. Không nối thông báo gốc để tránh lộ URL/header.
          throw new ZaloLocationError('UNAVAILABLE', 'Không kết nối được Zalo.');
        }

        // HTTP không OK không phải bằng chứng token sai: map UNAVAILABLE (fail-closed).
        if (!res.ok) {
          throw new ZaloLocationError('UNAVAILABLE', 'Zalo trả lỗi tạm thời.', { httpStatus: res.status });
        }

        let text: string;
        try {
          text = await res.text();
        } catch {
          throw new ZaloLocationError('UNAVAILABLE', 'Phản hồi Zalo không đọc được.');
        }
        return parseZaloLocationText(text);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Đọc thân phản hồi định vị. Chỉ tin `error` và `data.latitude/longitude`.
 * `error` phải có mặt và là số nguyên (S2: thiếu `error` coi là không hợp lệ, không coi là thành công).
 */
export function parseZaloLocationText(text: string): LatLng {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ZaloLocationError('UNAVAILABLE', 'Phản hồi Zalo không đọc được.');
  }
  if (!isPlainObject(parsed)) {
    throw new ZaloLocationError('UNAVAILABLE', 'Phản hồi Zalo sai định dạng.');
  }

  const errorCode = readErrorCode(parsed.error);
  if (errorCode === undefined) {
    throw new ZaloLocationError('UNAVAILABLE', 'Phản hồi Zalo có mã lỗi không đọc được.');
  }
  if (errorCode !== 0) {
    if (ZALO_INVALID_TOKEN_CODES.includes(errorCode)) {
      throw new ZaloLocationError('INVALID_TOKEN', 'Token Zalo không hợp lệ.', { zaloErrorCode: errorCode });
    }
    throw new ZaloLocationError('UNAVAILABLE', 'Zalo trả lỗi tạm thời.', { zaloErrorCode: errorCode });
  }

  const data = parsed.data;
  if (!isPlainObject(data)) {
    throw new ZaloLocationError('UNAVAILABLE', 'Phản hồi Zalo thiếu dữ liệu vị trí.');
  }
  return {
    lat: parseCoordinate(data.latitude, 90),
    lng: parseCoordinate(data.longitude, 180),
  };
}

/** Trả mã số của `error`; không phải số nguyên (hoặc chuỗi số) thì undefined. */
function readErrorCode(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^-?\d+$/.test(raw)) return Number(raw);
  return undefined;
}

/**
 * Đọc một toạ độ. Zalo trả chuỗi (S2); số cũng được chấp nhận. Không phải số hữu hạn hoặc ngoài biên -> UNAVAILABLE.
 */
function parseCoordinate(raw: unknown, limit: number): number {
  let value: number;
  if (typeof raw === 'string' && /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(raw)) {
    value = Number(raw);
  } else if (typeof raw === 'number') {
    value = raw;
  } else {
    throw new ZaloLocationError('UNAVAILABLE', 'Toạ độ Zalo không phải số.');
  }
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new ZaloLocationError('UNAVAILABLE', 'Toạ độ Zalo ngoài biên.');
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
