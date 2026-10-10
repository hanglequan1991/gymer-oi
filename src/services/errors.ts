// Lỗi nghiệp vụ dùng chung cho tầng services (docs/project-structure.md, mục 2.5).
// Repository ném AppError có mã; UI map mã sang câu tiếng Việt (i18n/errors.ts).

/** Mã lỗi có thể gặp ở tầng services. */
export type ErrorCode =
  | 'NOT_FOUND'
  | 'SLOT_TAKEN'
  | 'SLOT_NOT_OPEN'
  | 'PRICE_CHANGED'
  | 'BOOKING_EXPIRED'
  | 'LIMIT_REACHED'
  | 'FORBIDDEN'
  | 'UNAUTHENTICATED'
  | 'NETWORK'
  | 'VALIDATION'
  | 'NOT_IMPLEMENTED'
  | 'UNKNOWN';

/** Lỗi ứng dụng có mã. Giữ nguyên nguyên nhân gốc (cause) nếu có. */
export class AppError extends Error {
  code: ErrorCode;
  cause?: unknown;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
    // Giữ đúng prototype khi biên dịch xuống đích cũ.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** Kiểm tra một giá trị bất kỳ có phải AppError không. */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/**
 * Ánh xạ mã SQL (RAISE trong RPC/trigger) sang ErrorCode, theo docs/plans/schema-v1-review-dot-d2.md, mục 5.
 * Mã ALREADY_STARTED gộp vào FORBIDDEN (plan 2.4A); SLOT_HAS_BOOKING gộp vào VALIDATION (d2, mục 5).
 */
const RPC_ERROR_CODES: ReadonlyMap<string, ErrorCode> = new Map<string, ErrorCode>([
  ['SLOT_TAKEN', 'SLOT_TAKEN'],
  ['SLOT_NOT_OPEN', 'SLOT_NOT_OPEN'],
  ['PRICE_CHANGED', 'PRICE_CHANGED'],
  ['BOOKING_EXPIRED', 'BOOKING_EXPIRED'],
  ['LIMIT_REACHED', 'LIMIT_REACHED'],
  ['VALIDATION', 'VALIDATION'],
  ['SLOT_HAS_BOOKING', 'VALIDATION'],
  ['NOT_FOUND', 'NOT_FOUND'],
  ['FORBIDDEN', 'FORBIDDEN'],
  ['ALREADY_STARTED', 'FORBIDDEN'],
  ['UNAUTHENTICATED', 'UNAUTHENTICATED'],
]);

/**
 * Chuyển message lỗi từ Supabase/Postgres sang ErrorCode.
 * So khớp theo tiền tố: lấy từ in hoa đầu tiên của message (bỏ qua phần ": chi tiết" hoặc " CONTEXT ..."),
 * rồi tra bảng. Mã không biết, SQLSTATE (23503, 42501), lỗi mạng hay message rỗng đều rơi về UNKNOWN.
 */
export function mapRpcErrorCode(message: string | null | undefined): ErrorCode {
  if (!message) return 'UNKNOWN';
  const token = /^[A-Z_]+/.exec(message.trim())?.[0];
  return (token && RPC_ERROR_CODES.get(token)) || 'UNKNOWN';
}

/** Tạo AppError từ message lỗi RPC. Giữ message gốc để ghi log, UI hiển thị theo code (i18n/errors.ts). */
export function appErrorFromRpc(message: string | null | undefined, cause?: unknown): AppError {
  return new AppError(mapRpcErrorCode(message), message ?? 'Lỗi không xác định', cause);
}
