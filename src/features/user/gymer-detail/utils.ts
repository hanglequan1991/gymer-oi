// Tiện ích nhỏ dùng chung trong hồ sơ Gymer.

/** Chuỗi "YYYY-MM-DD" theo ngày lịch địa phương (máy đang ở giờ Việt Nam). */
export function toDateIso(d: Date): string {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Lỗi NOT_FOUND. Không import isAppError từ @/services (ESLint chặn trong features),
 * nên đọc thuộc tính code theo kiểu duck typing.
 */
export function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'NOT_FOUND';
}
