// Adapter ZaloVerifier: xác minh access token Zalo qua Graph API (D2).
// Không import Deno.*, npm:, jsr: để tsc và Vitest (Node) đọc được. Nhận fetch qua tham số.
import { ZaloAuthError } from '../ports.ts';
import type { ZaloUser, ZaloVerifier } from '../ports.ts';

// S1: endpoint và tên header là giả thuyết của plan (docs/spikes/s1-auth-zalo.md), chưa kiểm với Zalo thật.
export const ZALO_ME_ENDPOINT = 'https://graph.zalo.me/v2.0/me';
const ZALO_ME_FIELDS = 'id,name,picture';
const DEFAULT_TIMEOUT_MS = 8000;

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface ZaloVerifierConfig {
  /** Mặc định ZALO_ME_ENDPOINT. Chỉ đổi khi S1 xác nhận endpoint khác. */
  endpoint?: string;
  /** Secret key của Mini App, gửi qua header secret_key. S1: có bắt buộc hay không chưa xác nhận. */
  appSecret: string;
  timeoutMs?: number;
}

/**
 * Tạo verifier. Không bao giờ đưa token hay secret vào thông báo lỗi.
 * - Token sai/hết hạn -> ZaloAuthError('INVALID_TOKEN').
 * - Zalo lỗi tạm thời, timeout, lỗi mạng, phản hồi không đọc được -> ZaloAuthError('UNAVAILABLE').
 */
export function createZaloVerifier(fetchFn: FetchFn, config: ZaloVerifierConfig): ZaloVerifier {
  const endpoint = config.endpoint ?? ZALO_ME_ENDPOINT;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async verify(accessToken: string): Promise<ZaloUser> {
      const url = `${endpoint}?fields=${ZALO_ME_FIELDS}`;
      const controller = new AbortController();
      // Timer phủ cả lúc gọi fetch lẫn lúc đọc thân phản hồi (N1): chỉ clear khi xong hẳn.
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let res: Response;
        try {
          res = await fetchFn(url, {
            method: 'GET',
            headers: {
              access_token: accessToken,
              secret_key: config.appSecret,
              Accept: 'application/json',
            },
            signal: controller.signal,
          });
        } catch {
          // Lỗi mạng hoặc timeout (abort). Không nối thông báo gốc để tránh lộ URL/header.
          throw new ZaloAuthError('UNAVAILABLE', 'Không kết nối được Zalo.');
        }

        // S1: 401/403/400 là token không hợp lệ; 5xx và 429 là lỗi phía Zalo, thử lại được.
        if (res.status === 401 || res.status === 403 || res.status === 400) {
          throw new ZaloAuthError('INVALID_TOKEN', 'Token Zalo không hợp lệ.');
        }
        if (!res.ok) {
          throw new ZaloAuthError('UNAVAILABLE', 'Zalo trả lỗi tạm thời.');
        }

        let body: unknown;
        try {
          body = await res.json();
        } catch {
          // Thân treo bị abort bởi timer, hoặc thân hỏng: đều là lỗi tạm thời.
          throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo không đọc được.');
        }
        return parseZaloMe(body);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Đọc phản hồi /v2.0/me. Chỉ tin các trường id, name, picture.
 * S1: Zalo có thể trả HTTP 200 kèm `error != 0` khi token sai; coi là INVALID_TOKEN.
 * S1: `picture` có thể là chuỗi hoặc `{ data: { url } }`; chấp nhận cả hai.
 */
export function parseZaloMe(body: unknown): ZaloUser {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo sai định dạng.');
  }
  const obj = body as Record<string, unknown>;

  if (obj.error !== undefined && obj.error !== 0 && obj.error !== null) {
    // S1: mã lỗi cụ thể của Zalo chưa xác nhận; mọi mã khác 0 trong body được coi là token không dùng được.
    throw new ZaloAuthError('INVALID_TOKEN', 'Token Zalo không hợp lệ.');
  }

  // B2: id chỉ nhận chuỗi, hoặc số nguyên an toàn. Số lớn hơn 2^53 đã mất độ chính xác khi JSON.parse,
  // nên không được dùng làm khoá định danh (có thể gộp hai người dùng khác nhau).
  const rawId = obj.id;
  let zaloId = '';
  if (typeof rawId === 'string') {
    zaloId = rawId;
  } else if (typeof rawId === 'number') {
    if (!Number.isSafeInteger(rawId)) {
      throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo có id không an toàn.');
    }
    zaloId = String(rawId);
  }
  if (zaloId.length === 0) {
    throw new ZaloAuthError('UNAVAILABLE', 'Phản hồi Zalo thiếu id.');
  }

  const name = typeof obj.name === 'string' ? obj.name : '';
  const avatarUrl = extractPictureUrl(obj.picture);

  return avatarUrl === undefined ? { zaloId, name } : { zaloId, name, avatarUrl };
}

function extractPictureUrl(picture: unknown): string | undefined {
  if (typeof picture === 'string') return picture;
  if (typeof picture !== 'object' || picture === null) return undefined;
  const data = (picture as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null) return undefined;
  const url = (data as Record<string, unknown>).url;
  return typeof url === 'string' ? url : undefined;
}
