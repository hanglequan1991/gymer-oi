// Lỗi nghiệp vụ dùng chung cho tầng services (docs/project-structure.md, mục 2.5).
// Repository ném AppError có mã; UI map mã sang câu tiếng Việt (i18n/errors.ts).

/** Mã lỗi có thể gặp ở tầng services. */
export type ErrorCode =
  | 'NOT_FOUND'
  | 'SLOT_TAKEN'
  | 'FORBIDDEN'
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
