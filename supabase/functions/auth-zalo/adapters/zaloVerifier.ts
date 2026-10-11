// Adapter ZaloVerifier: xác minh access token Zalo qua Graph API (D2).
// Không import Deno.*, npm:, jsr: để tsc và Vitest (Node) đọc được. Nhận fetch qua tham số.
import { ZaloAuthError } from '../ports.ts';
import type { ZaloUser, ZaloVerifier } from '../ports.ts';

// S1: endpoint và tên header là giả thuyết của plan (docs/spikes/s1-auth-zalo.md), chưa kiểm với Zalo thật.
export const ZALO_ME_ENDPOINT = 'https://graph.zalo.me/v2.0/me';
const ZALO_ME_FIELDS = 'id,name,picture';
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Mã `error` trong body HTTP 200 nghĩa là token sai (S1, đã quan sát: 452).
 * Chỉ thêm mã khi đã quan sát được từ Zalo thật; không suy đoán mã mới.
 */
export const ZALO_INVALID_TOKEN_CODES: readonly number[] = [452];

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface ZaloVerifierConfig {
  /** Mặc định ZALO_ME_ENDPOINT. Chỉ đổi khi S1 xác nhận endpoint khác. */
  endpoint?: string;
  /**
   * Secret key của Mini App, gửi qua header secret_key khi có giá trị.
   * S1: chưa xác nhận Zalo có yêu cầu header này; khi không cấu hình thì không gửi.
   */
  appSecret?: string;
  timeoutMs?: number;
}

/**
 * Tạo verifier. Không bao giờ đưa token hay secret vào thông báo lỗi.
 * - Token sai/hết hạn (error = 452 trong thân HTTP 200) -> ZaloAuthError('INVALID_TOKEN').
 * - HTTP lỗi (400/401/403/5xx/429), timeout, lỗi mạng, phản hồi không đọc được -> ZaloAuthError('UNAVAILABLE').
 */
export function createZaloVerifier(fetchFn: FetchFn, config: ZaloVerifierConfig): ZaloVerifier {
  const endpoint = config.endpoint ?? ZALO_ME_ENDPOINT;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async verify(accessToken: string): Promise<ZaloUser> {
      const url = `${endpoint}?fields=${ZALO_ME_FIELDS}`;
      const headers: Record<string, string> = {
        access_token: accessToken,
        Accept: 'application/json',
      };
      if (config.appSecret !== undefined && config.appSecret !== '') {
        headers.secret_key = config.appSecret;
      }
      const controller = new AbortController();
      // Timer phủ cả lúc gọi fetch lẫn lúc đọc thân phản hồi (N1): chỉ clear khi xong hẳn.
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let res: Response;
        try {
          res = await fetchFn(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });
        } catch {
          // Lỗi mạng hoặc timeout (abort). Không nối thông báo gốc để tránh lộ URL/header.
          throw new ZaloAuthError('UNAVAILABLE', 'Không kết nối được Zalo.');
        }

        // HTTP không OK (400/401/403/5xx/429...) không phải bằng chứng token sai: map UNAVAILABLE (fail-closed).
        // Token sai chỉ được xác định bởi error = 452 trong thân HTTP 200. Chỉ log status, không log token.
        if (!res.ok) {
          console.warn('[auth-zalo] Zalo trả HTTP lỗi', res.status);
          throw new ZaloAuthError('UNAVAILABLE', 'Zalo trả lỗi tạm thời.');
        }

        let text: string;
        try {
          // Đọc dạng text để giữ nguyên chữ số của id (xem parseZaloMeText).
          text = await res.text();
        } catch {
          // Thân treo bị abort bởi timer, hoặc thân hỏng: đều là lỗi tạm thời.
          throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo không đọc được.');
        }
        return parseZaloMeText(text);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Đọc thân phản hồi /v2.0/me dạng text. Chỉ tin các trường id, name, picture.
 *
 * - `error` vắng mặt/null/0: thành công. `error` trong ZALO_INVALID_TOKEN_CODES: INVALID_TOKEN.
 *   Mã khác: UNAVAILABLE (fail-closed, không cấp phiên).
 * - `id` lấy bằng regex từ văn bản gốc, thành chuỗi, KHÔNG qua JSON.parse: id 19 chữ số vượt 2^53
 *   sẽ bị làm tròn nếu đi qua số. Chấp nhận id là chuỗi hoặc số trong JSON; phải đúng một khoá "id"
 *   trong toàn thân (nhiều khoá "id" -> UNAVAILABLE, không đoán).
 * - Các trường còn lại (name, picture) lấy từ JSON.parse.
 * - `picture` có thể là chuỗi hoặc `{ data: { url } }`; chấp nhận cả hai.
 */
export function parseZaloMeText(text: string): ZaloUser {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo không đọc được.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo sai định dạng.');
  }
  const obj = parsed as Record<string, unknown>;

  const errorCode = readErrorCode(obj.error);
  if (errorCode === undefined) {
    throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo có mã lỗi không đọc được.');
  }
  if (errorCode !== 0) {
    if (ZALO_INVALID_TOKEN_CODES.includes(errorCode)) {
      throw new ZaloAuthError('INVALID_TOKEN', 'Token Zalo không hợp lệ.');
    }
    throw new ZaloAuthError('UNAVAILABLE', 'Zalo trả lỗi tạm thời.');
  }

  const zaloId = extractRawId(text, obj.id);
  const name = typeof obj.name === 'string' ? obj.name : '';
  const avatarUrl = extractPictureUrl(obj.picture);

  return avatarUrl === undefined ? { zaloId, name } : { zaloId, name, avatarUrl };
}

/** Trả về mã số của `error`; vắng mặt hoặc null là 0; không đọc được là undefined. */
function readErrorCode(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^-?\d+$/.test(raw)) return Number(raw);
  return undefined;
}

/**
 * Trích id từ văn bản gốc thành chuỗi chữ số. `jsonId` (đã parse) chỉ để kiểm tra chéo:
 * nếu là chuỗi thì phải trùng; nếu là số an toàn thì phải trùng String(n). Số không an toàn không kiểm
 * chéo được, nhưng chuỗi chữ số lấy từ văn bản gốc vẫn giữ đúng từng chữ số.
 */
function extractRawId(text: string, jsonId: unknown): string {
  const keyCount = (text.match(/"id"\s*:/g) ?? []).length;
  if (keyCount !== 1) {
    throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo thiếu id hoặc có nhiều id.');
  }
  const match = /"id"\s*:\s*("?)(\d{1,40})\1\s*[,}]/.exec(text);
  if (match === null) {
    throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo có id không hợp lệ.');
  }
  const digits = match[2];
  if (typeof jsonId === 'string') {
    if (jsonId !== digits) throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo có id không hợp lệ.');
  } else if (typeof jsonId === 'number') {
    if (Number.isSafeInteger(jsonId) && String(jsonId) !== digits) {
      throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo có id không hợp lệ.');
    }
  } else {
    throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo thiếu id.');
  }
  return digits;
}

function extractPictureUrl(picture: unknown): string | undefined {
  if (typeof picture === 'string') return picture;
  if (typeof picture !== 'object' || picture === null) return undefined;
  const data = (picture as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null) return undefined;
  const url = (data as Record<string, unknown>).url;
  return typeof url === 'string' ? url : undefined;
}
