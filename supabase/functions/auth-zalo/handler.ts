// Hàm thuần của edge function auth-zalo (hợp đồng D1-D4 trong docs/plans/app-supabase-integration.md).
// Chỉ phụ thuộc các port trong ports.ts. Không import Deno.*, npm:, jsr:.
import { ZaloAuthError } from './ports.ts';
import type { SessionIssuer, UserStore, ZaloUser, ZaloVerifier } from './ports.ts';
import { errorJson, json, preflight } from '../_shared/http.ts';

export interface AuthZaloDeps {
  verifier: ZaloVerifier;
  store: UserStore;
  issuer: SessionIssuer;
  /** Tên biến môi trường bắt buộc còn thiếu (index.ts truyền vào). Khác rỗng -> 500 CONFIG_MISSING. */
  missingConfig?: readonly string[];
  /** Chỉ nhận msg và meta đã làm sạch; tuyệt đối không chứa token hay phiên. */
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

const MAX_BODY_BYTES = 4096;
const TOKEN_MIN_LEN = 10;
const TOKEN_MAX_LEN = 2048;
// S1: giới hạn độ dài zaloId (khoá chính zalo_identities.zalo_id) là giả định của plan, chưa kiểm với Zalo thật.
const ZALO_ID_MAX_LEN = 64;
// Cột profiles.display_name giới hạn 1-50 ký tự.
const NAME_MAX_CHARS = 50;
const NAME_FALLBACK = 'Người dùng Zalo';
// S1: giới hạn độ dài và yêu cầu https của avatar là giả định của plan.
const AVATAR_MAX_LEN = 500;

const INVALID_REQUEST_MSG = 'Yêu cầu không hợp lệ.';

export async function handleAuthZalo(req: Request, deps: AuthZaloDeps): Promise<Response> {
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

    // Fail-closed: thiếu cấu hình bắt buộc thì không làm gì thêm.
    if (deps.missingConfig && deps.missingConfig.length > 0) {
      log('auth-zalo: thiếu cấu hình bắt buộc', { missing: [...deps.missingConfig] });
      return errorJson(500, 'CONFIG_MISSING', 'Máy chủ chưa được cấu hình.');
    }

    // Kiểm đầu vào rẻ trước khi gọi Zalo hay Supabase.
    const raw = await readBoundedText(req, MAX_BODY_BYTES);
    if (raw === null) return errorJson(400, 'INVALID_REQUEST', 'Thân yêu cầu quá lớn.');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return errorJson(400, 'INVALID_REQUEST', INVALID_REQUEST_MSG);
    }

    // Không đọc user_id/zaloId từ thân yêu cầu: chỉ lấy token.
    const token = readToken(parsed);
    if (token === null) return errorJson(400, 'INVALID_REQUEST', INVALID_REQUEST_MSG);

    // S1: ánh xạ INVALID_TOKEN/UNAVAILABLE phụ thuộc cách adapter zaloVerifier phân loại phản hồi Zalo.
    let zaloUser: ZaloUser;
    try {
      zaloUser = await deps.verifier.verify(token);
    } catch (err) {
      if (err instanceof ZaloAuthError && err.code === 'INVALID_TOKEN') {
        log('auth-zalo: token Zalo không hợp lệ');
        return errorJson(401, 'ZALO_TOKEN_INVALID', 'Token Zalo không hợp lệ.');
      }
      if (err instanceof ZaloAuthError && err.code === 'UNAVAILABLE') {
        log('auth-zalo: không xác minh được với Zalo');
        return errorJson(502, 'ZALO_UNAVAILABLE', 'Không kết nối được Zalo, thử lại sau.');
      }
      throw err;
    }

    const identity = sanitizeZaloUser(zaloUser);

    // Chỉ chạm store/issuer sau khi Zalo đã xác minh token.
    let userId = await deps.store.findUserIdByZaloId(identity.zaloId);
    let created = false;
    if (userId === null) {
      userId = await deps.store.createUserForZalo(identity);
      created = true;
    }
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new Error('store trả user_id rỗng');
    }

    const issued = await deps.issuer.issue(userId);
    if (
      !isNonEmptyString(issued.accessToken) ||
      !isNonEmptyString(issued.refreshToken) ||
      !Number.isFinite(issued.expiresIn) ||
      issued.expiresIn <= 0
    ) {
      throw new Error('issuer trả phiên không hợp lệ');
    }

    log('auth-zalo: đăng nhập thành công', { userId, created });
    return json(200, {
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
      expires_in: issued.expiresIn,
      user_id: userId,
    });
  } catch (err) {
    // Chỉ ghi tên lỗi: thông báo lỗi có thể chứa dữ liệu nhạy cảm.
    log('auth-zalo: lỗi nội bộ', { errorName: err instanceof Error ? err.name : typeof err });
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

function readToken(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).zaloAccessToken;
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return token.length >= TOKEN_MIN_LEN && token.length <= TOKEN_MAX_LEN ? token : null;
}

/**
 * Làm sạch dữ liệu từ verifier trước khi ghi DB.
 * zaloId không hợp lệ là lỗi phía máy chủ (ném lỗi -> 500 INTERNAL), không phải lỗi của client.
 */
function sanitizeZaloUser(user: ZaloUser): ZaloUser {
  const zaloId = typeof user.zaloId === 'string' ? user.zaloId : '';
  if (zaloId.trim().length === 0 || zaloId.length > ZALO_ID_MAX_LEN) {
    throw new Error('zaloId từ verifier không hợp lệ');
  }
  const rawName = typeof user.name === 'string' ? user.name.trim() : '';
  const name = Array.from(rawName).slice(0, NAME_MAX_CHARS).join('');
  return {
    zaloId,
    name: name.length > 0 ? name : NAME_FALLBACK,
    avatarUrl: safeAvatarUrl(user.avatarUrl),
  };
}

/** Chỉ giữ avatar https, tối đa 500 ký tự; còn lại bỏ qua. */
function safeAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > AVATAR_MAX_LEN) return undefined;
  try {
    return new URL(value).protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
