// Ánh xạ lỗi của PostgREST/GoTrue/fetch sang AppError (plan 2.2 D8).
// Chỉ dựa trên cấu trúc lỗi (message, code, status, name), không phụ thuộc lớp lỗi cụ thể của thư viện.
import { AppError, appErrorFromRpc, mapRpcErrorCode } from '../errors';
import type { ErrorCode } from '../errors';

/** Hình dạng lỗi tối thiểu mà toAppError nhận. */
export interface PostgrestLikeError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

const NETWORK_HINT = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network/i;

/** Tên lỗi của supabase-js/fetch cho việc không gửi được yêu cầu (không có HTTP status). */
const NETWORK_NAMES = new Set(['TypeError', 'AuthRetryableFetchError', 'FunctionsFetchError']);

/** Mã PostgREST của JWT thiếu/hết hạn/sai (PostgREST 12 dùng cả ba). */
const JWT_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Đọc các trường đã biết từ một giá trị bất kỳ. Trường rỗng coi như không có. */
function readShape(error: unknown): PostgrestLikeError {
  if (typeof error === 'string') return { message: error };
  if (!isObject(error)) return {};
  const message = typeof error.message === 'string' && error.message !== '' ? error.message : undefined;
  const code = typeof error.code === 'string' && error.code !== '' ? error.code : undefined;
  const status = typeof error.status === 'number' ? error.status : undefined;
  const name = typeof error.name === 'string' && error.name !== '' ? error.name : undefined;
  return { message, code, status, name };
}

/**
 * Xác định mã lỗi nghiệp vụ theo SQLSTATE hoặc mã PostgREST, không theo message.
 * 23P01 (exclusion_violation) được coi là SLOT_TAKEN: lưới phòng thủ, vì create_booking đã dịch
 * EXCLUDE bookings_no_overlap thành P0001 SLOT_TAKEN; nếu một RPC khác để lộ 23P01 thì vẫn đúng nghĩa.
 */
function codeFromSqlState(code: string): ErrorCode {
  if (code === '42501') return 'FORBIDDEN';
  if (code === '23P01') return 'SLOT_TAKEN';
  if (code === 'PGRST116') return 'NOT_FOUND';
  if (code === '23514' || code === '23503' || code.startsWith('22')) return 'VALIDATION';
  return 'UNKNOWN';
}

/**
 * Chuyển lỗi bất kỳ sang AppError. Thứ tự:
 * 1. Đã là AppError: trả nguyên.
 * 2. Lỗi mạng/fetch (không có code; status 0, hoặc tên thuộc NETWORK_NAMES, hoặc không có status và
 *    message/tên khớp dấu hiệu mạng): NETWORK. Gồm AuthRetryableFetchError (status 0), FunctionsFetchError.
 * 3. JWT hết hạn hoặc thiếu (PGRST301/302/303, HTTP 401): UNAUTHENTICATED.
 * 4. Lỗi RAISE trong RPC/trigger (P0001) hoặc message có tiền tố mã đã biết: appErrorFromRpc.
 * 5. SQLSTATE/PostgREST: 42501 FORBIDDEN, 23P01 SLOT_TAKEN, 23514/23503/22xxx VALIDATION, PGRST116 NOT_FOUND.
 * 6. Còn lại: UNKNOWN (kể cả 23505 unique_violation: không ánh xạ ở đây; repo nào cần nghĩa riêng
 *    phải đọc res.error.code thô trước khi gọi hàm này, như scheduleRepo.setSlotClosed).
 * Message gốc giữ ở `cause` để ghi log; UI chỉ hiện câu theo `code`.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const { message, code, status, name } = readShape(error);
  const text = message ?? 'Lỗi không xác định';

  if (code === undefined) {
    const networkName = name !== undefined && NETWORK_NAMES.has(name);
    const networkHint = status === undefined && message !== undefined && NETWORK_HINT.test(message);
    if (status === 0 || (status === undefined && (networkName || networkHint))) {
      return new AppError('NETWORK', text, error);
    }
  }

  if ((code !== undefined && JWT_CODES.has(code)) || status === 401) {
    return new AppError('UNAUTHENTICATED', text, error);
  }

  if (code === 'P0001' || mapRpcErrorCode(message) !== 'UNKNOWN') {
    return appErrorFromRpc(message, error);
  }

  if (code !== undefined) {
    return new AppError(codeFromSqlState(code), text, error);
  }

  return new AppError('UNKNOWN', text, error);
}

/**
 * Kiểm tra lỗi của một lệnh không trả dữ liệu (RPC trả void như respond_booking, cancel_booking).
 * Có lỗi thì ném AppError đã ánh xạ; không có lỗi thì trả về, bỏ qua `data` (luôn null ở đây).
 * Không dùng `unwrap` cho các RPC này: `data === null` sẽ bị coi là NOT_FOUND.
 */
export function assertOk(res: { error: unknown }): void {
  if (res.error != null) {
    throw toAppError(res.error);
  }
}

/** Lấy data hoặc ném AppError khi có lỗi. Data null không có lỗi: ném NOT_FOUND (dùng unwrapOrNull nếu được phép null). */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error != null) {
    throw toAppError(res.error);
  }
  if (res.data === null) {
    throw new AppError('NOT_FOUND', 'Không tìm thấy dữ liệu.');
  }
  return res.data;
}

/** Như unwrap, nhưng data null (không có hàng) trả về null thay vì ném NOT_FOUND. Lỗi vẫn ném. */
export function unwrapOrNull<T>(res: { data: T | null; error: unknown }): T | null {
  if (res.error != null) {
    throw toAppError(res.error);
  }
  return res.data ?? null;
}
