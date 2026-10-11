// Hàm thuần của edge function resolve-location (plan app-ui-integration.md, mục 3.1 và T09).
// Chỉ phụ thuộc các port trong ports.ts. Không import Deno.*, npm:, jsr:.
import { ZaloLocationError } from './ports.ts';
import type { LatLng, LocationResolver } from './ports.ts';
import { errorJson, json, preflight } from '../_shared/http.ts';

export interface ResolveLocationDeps {
  resolver: LocationResolver;
  /** Tên biến môi trường bắt buộc còn thiếu (index.ts truyền vào). Khác rỗng -> 500 CONFIG_MISSING. */
  missingConfig?: readonly string[];
  /** Chỉ nhận msg và meta đã làm sạch (số, không chuỗi nhạy cảm). */
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

const MAX_BODY_BYTES = 4096;
// Access token: cùng giới hạn với auth-zalo.
const ACCESS_TOKEN_MIN_LEN = 10;
const ACCESS_TOKEN_MAX_LEN = 2048;
// S2: độ dài token vị trí chưa biết; chỉ yêu cầu không rỗng và không quá dài.
const LOCATION_TOKEN_MIN_LEN = 1;
const LOCATION_TOKEN_MAX_LEN = 2048;
// Token Zalo là chuỗi ASCII không khoảng trắng. Chặn sớm để không ném lỗi khi đặt header (S2).
const PRINTABLE_ASCII = /^[\x21-\x7E]+$/;
// Toạ độ làm tròn 3 chữ số (~110 m) trước khi trả, theo rủi ro R10.
const COORD_DECIMALS = 1000;

const INVALID_REQUEST_MSG = 'Yêu cầu không hợp lệ.';

export async function handleResolveLocation(req: Request, deps: ResolveLocationDeps): Promise<Response> {
  const log = (msg: string, meta?: Record<string, unknown>): void => {
    try {
      deps.log?.(msg, meta);
    } catch {
      // Log lỗi không được làm hỏng phản hồi.
    }
  };

  try {
    if (req.method === 'OPTIONS') return preflight();
    if (req.method !== 'POST') {
      return json(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Chỉ hỗ trợ POST.' } }, {
        Allow: 'POST, OPTIONS',
      });
    }

    // Fail-closed: thiếu cấu hình (ZALO_APP_SECRET) thì không chạm Zalo.
    if (deps.missingConfig && deps.missingConfig.length > 0) {
      log('resolve-location: thiếu cấu hình bắt buộc', { missing: [...deps.missingConfig] });
      return errorJson(500, 'CONFIG_MISSING', 'Máy chủ chưa được cấu hình.');
    }

    // Kiểm đầu vào rẻ trước khi gọi Zalo.
    const raw = await readBoundedText(req, MAX_BODY_BYTES);
    if (raw === null) return errorJson(400, 'INVALID_REQUEST', 'Thân yêu cầu quá lớn.');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return errorJson(400, 'INVALID_REQUEST', INVALID_REQUEST_MSG);
    }

    const input = readInput(parsed);
    if (input === null) return errorJson(400, 'INVALID_REQUEST', INVALID_REQUEST_MSG);

    let location: LatLng;
    try {
      location = await deps.resolver.resolve(input);
    } catch (err) {
      if (err instanceof ZaloLocationError && err.code === 'INVALID_TOKEN') {
        log('resolve-location: token Zalo không hợp lệ', { zaloErrorCode: err.zaloErrorCode });
        return errorJson(401, 'ZALO_TOKEN_INVALID', 'Token Zalo không hợp lệ.');
      }
      if (err instanceof ZaloLocationError && err.code === 'UNAVAILABLE') {
        // Chỉ ghi mã số để học ở smoke test; không ghi message có thể chứa dữ liệu.
        log('resolve-location: không lấy được vị trí từ Zalo', {
          zaloErrorCode: err.zaloErrorCode,
          httpStatus: err.httpStatus,
        });
        // Lỗi tạm thời phía Zalo: retryable, KHÔNG yêu cầu đăng nhập lại.
        return json(502, {
          error: { code: 'ZALO_UNAVAILABLE', message: 'Không lấy được vị trí từ Zalo, thử lại sau.', retryable: true },
        });
      }
      throw err;
    }

    // Fail-closed: resolver trả giá trị không hợp lệ thì coi như Zalo lỗi, không trả toạ độ rác.
    if (!isValidLatLng(location)) {
      log('resolve-location: toạ độ từ resolver không hợp lệ');
      return json(502, {
        error: { code: 'ZALO_UNAVAILABLE', message: 'Không lấy được vị trí từ Zalo, thử lại sau.', retryable: true },
      });
    }

    // Không ghi toạ độ vào log (plan T09 và R10).
    return json(200, { lat: roundCoord(location.lat), lng: roundCoord(location.lng) });
  } catch (err) {
    // Chỉ ghi tên lỗi: thông báo lỗi có thể chứa dữ liệu nhạy cảm.
    log('resolve-location: lỗi nội bộ', { errorName: err instanceof Error ? err.name : typeof err });
    return errorJson(500, 'INTERNAL', 'Lỗi nội bộ, thử lại sau.');
  }
}

/** Đọc thân tối đa `max` byte. Trả null nếu vượt giới hạn (không đọc hết thân lớn). */
async function readBoundedText(req: Request, max: number): Promise<string | null> {
  const declared = req.headers.get('content-length');
  if (declared !== null && Number(declared) > max) return null;
  if (req.body === null) return '';

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Lấy hai token từ thân. Không đọc các trường khác (ví dụ user_id) từ client. */
function readInput(body: unknown): { accessToken: string; locationToken: string } | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const accessToken = readToken(record.zaloAccessToken, ACCESS_TOKEN_MIN_LEN, ACCESS_TOKEN_MAX_LEN);
  const locationToken = readToken(record.locationToken, LOCATION_TOKEN_MIN_LEN, LOCATION_TOKEN_MAX_LEN);
  if (accessToken === null || locationToken === null) return null;
  return { accessToken, locationToken };
}

function readToken(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  if (token.length < min || token.length > max) return null;
  return PRINTABLE_ASCII.test(token) ? token : null;
}

function isValidLatLng(value: LatLng): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 &&
    Math.abs(value.lng) <= 180
  );
}

function roundCoord(value: number): number {
  return Math.round(value * COORD_DECIMALS) / COORD_DECIMALS;
}
