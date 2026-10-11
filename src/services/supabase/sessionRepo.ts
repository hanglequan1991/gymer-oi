// Repository phiên đăng nhập trên Supabase (plan app-supabase-integration, T-A, D1 và D6).
// Luồng signIn: platform.auth.login -> functions.invoke('auth-zalo') -> client.auth.setSession -> { userId }.
// Không bao giờ log hoặc đưa vào thông báo lỗi/cause: zaloAccessToken, access_token, refresh_token.
//
// S1: các chỗ dưới đây là GIẢ THUYẾT chưa xác minh (spike S1 chưa có kết quả):
//   - auth-zalo trả 200 JSON { access_token, refresh_token, expires_in, user_id } (D1);
//   - setSession chỉ cần { access_token, refresh_token } và phiên trả về có user.id trùng user_id;
//   - map HTTP 400/401/502 của function theo D1; mã lỗi Zalo không đổi.
// Khi S1 có kết quả, đối chiếu lại toàn bộ mục có tiền tố "S1:" trong file này.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthPort, LoginResult } from '@/platform/ports';
import { PlatformError } from '@/platform/ports';
import { AppError } from '../errors';
import type { SessionRepository } from '../repositories/sessionRepository';
import type { Database } from './database.types';

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

/** Tokens thành công từ auth-zalo (D1). */
interface AuthZaloTokens {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isResponseLike(value: unknown): value is ResponseLike {
  return isRecord(value) && typeof value.status === 'number' && typeof value.json === 'function';
}

/** Lấy các trường an toàn từ lỗi của supabase-js/functions-js. Đọc mã lỗi trong body của function nếu có. */
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

/** Ánh xạ lỗi của cổng platform (login) theo D1/D6. Không giữ message gốc. */
function mapPlatformError(error: unknown): AppError {
  if (error instanceof PlatformError) {
    if (error.code === 'PERMISSION_DENIED') {
      return new AppError('FORBIDDEN', 'Chưa được cấp quyền đăng nhập.', { name: error.name, code: error.code });
    }
    if (error.code === 'UNAVAILABLE') {
      return new AppError('NETWORK', 'Không kết nối được với Zalo.', { name: error.name, code: error.code });
    }
  }
  return new AppError('UNKNOWN', 'Không lấy được thông tin đăng nhập Zalo.');
}

/** Ánh xạ lỗi của functions.invoke('auth-zalo') theo D1. */
function mapFunctionError(cause: SafeCause): AppError {
  const message = 'Đăng nhập thất bại, vui lòng thử lại.';
  // S1: FunctionsFetchError nghĩa là không gửi được yêu cầu (mạng); FunctionsRelayError để UNKNOWN.
  if (cause.name === 'FunctionsFetchError') return new AppError('NETWORK', message, cause);
  if (cause.status === 400) return new AppError('VALIDATION', message, cause);
  if (cause.status === 401) return new AppError('UNAUTHENTICATED', message, cause);
  if (cause.status === 502) return new AppError('NETWORK', message, cause);
  return new AppError('UNKNOWN', message, cause);
}

/** Kiểm phản hồi 200 của auth-zalo. Thiếu trường hoặc sai kiểu: trả null. */
function parseAuthZaloTokens(data: unknown): AuthZaloTokens | null {
  // S1: phản hồi thành công có access_token, refresh_token, user_id là chuỗi không rỗng.
  if (!isRecord(data)) return null;
  const { access_token, refresh_token, user_id } = data;
  if (typeof access_token !== 'string' || access_token === '') return null;
  if (typeof refresh_token !== 'string' || refresh_token === '') return null;
  if (typeof user_id !== 'string' || user_id === '') return null;
  return { access_token, refresh_token, user_id };
}

/** Lỗi không phải nguyên nhân gốc đáng tin: giữ chỉ tên và mã, không giữ message. */
function safeCauseOf(error: unknown): SafeCause {
  if (!isRecord(error)) return {};
  const cause: SafeCause = {};
  if (typeof error.name === 'string') cause.name = error.name;
  if (typeof error.status === 'number') cause.status = error.status;
  if (typeof error.code === 'string') cause.code = error.code;
  return cause;
}

export function createSessionRepo(client: SupabaseClient<Database>, auth: AuthPort): SessionRepository {
  return {
    async signIn() {
      let login: LoginResult;
      try {
        login = await auth.login();
      } catch (error) {
        throw mapPlatformError(error);
      }

      const { data, error } = await client.functions.invoke('auth-zalo', {
        body: { zaloAccessToken: login.zaloAccessToken },
      });
      if (error) {
        throw mapFunctionError(await describeError(error));
      }

      const tokens = parseAuthZaloTokens(data);
      if (tokens === null) {
        throw new AppError('UNKNOWN', 'Phản hồi đăng nhập không hợp lệ.');
      }

      // S1: setSession chỉ cần access_token và refresh_token (không truyền user_id).
      const session = await client.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (session.error) {
        throw new AppError('UNKNOWN', 'Không thiết lập được phiên đăng nhập.', safeCauseOf(session.error));
      }
      // S1: phiên được thiết lập phải thuộc đúng user mà function trả về.
      if (session.data.session?.user.id !== tokens.user_id) {
        throw new AppError('UNKNOWN', 'Phiên đăng nhập không khớp người dùng.');
      }

      return { userId: tokens.user_id };
    },

    async getSession() {
      // Đọc phiên cục bộ, không gọi functions/bảng. Lỗi đọc phiên coi như chưa đăng nhập (như requireUserId).
      const { data } = await client.auth.getSession();
      const userId = data.session?.user.id;
      return userId ? { userId } : null;
    },

    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      // Chưa có phiên thì không phải lỗi: mục tiêu (không còn phiên) đã đạt.
      if (error && error.name !== 'AuthSessionMissingError') {
        throw new AppError('UNKNOWN', 'Không đăng xuất được.', safeCauseOf(error));
      }
    },
  };
}
