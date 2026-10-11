// Quy tắc nghiệp vụ đặt lịch dùng ở phía UI (docs/plans/schema-v1-review-dot-d2.md, mục 5; plan T10).
import type { BookingStatus } from '@/types/domain';

/**
 * Yêu cầu có coi là hết hạn không.
 * Công thức: status === 'expired' || (status === 'pending' && expiresAt <= now).
 * Hàng 'pending' quá hạn có thể tồn tại trong DB đến khi job quét đổi trạng thái, nên UI phải tự kiểm.
 * expiresAt không đọc được (chuỗi không phải ngày) thì không coi là hết hạn.
 */
export function isExpired(status: BookingStatus, expiresAt: string | Date, now: Date): boolean {
  if (status === 'expired') return true;
  if (status !== 'pending') return false;
  const expiresMs = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return expiresMs <= now.getTime();
}

// Múi giờ Việt Nam là UTC+7 cố định (không có giờ mùa hè). Tính bằng số học trên UTC để kết quả
// không phụ thuộc múi giờ của máy chạy app hay máy chạy test.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const SLOT_MINUTES = 60;
const VN_SUFFIX = '+07:00';
const SLOT_ID_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const WEEKDAYS_VN = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'] as const;

/** Chuyển mốc UTC (ms) thành chuỗi ISO có offset +07:00, ví dụ "2026-10-17T09:00:00+07:00". */
function wallVNToIso(wallMs: number): string {
  // wallMs là giờ tường VN đã đếm như thể UTC; cộng offset để lấy giờ tường thật rồi cắt phần .sss và Z.
  const d = new Date(wallMs);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${VN_SUFFIX}`
  );
}

/**
 * Khung giờ "YYYY-MM-DDTHH:mm" (giờ Việt Nam) thành khoảng ISO 60 phút có offset +07:00.
 * Trả null nếu chuỗi sai định dạng hoặc không phải ngày có thật (ví dụ 30/02).
 * Qua nửa đêm, cuối tháng, cuối năm đều đúng vì tính trên trục thời gian UTC.
 */
export function slotIdToIsoRange(slotId: string): { startIso: string; endIso: string } | null {
  const m = SLOT_ID_RE.exec(slotId);
  if (m === null) return null;
  const [year, month, day, hh, mm] = m.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || hh > 23 || mm > 59) return null;
  // Kiểm tra ngày có thật: Date.UTC tự cuộn 30/02 sang tháng sau, nên so lại các trường.
  const startWall = Date.UTC(year, month - 1, day, hh, mm);
  const check = new Date(startWall);
  if (check.getUTCDate() !== day || check.getUTCMonth() !== month - 1) return null;
  const endWall = startWall + SLOT_MINUTES * 60 * 1000;
  return {
    startIso: wallVNToIso(startWall),
    endIso: wallVNToIso(endWall),
  };
}

/** Giờ tường Việt Nam (đã cộng offset) của một chuỗi ISO có offset. */
function vnWall(iso: string): Date {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS);
}

/** "HH:mm" theo giờ Việt Nam. */
export function formatVNTime(iso: string): string {
  const d = vnWall(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "Thứ 7, 17/10" theo giờ Việt Nam. */
export function formatVNWeekdayDate(iso: string): string {
  const d = vnWall(iso);
  return `${WEEKDAYS_VN[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "HH:mm dd/MM" theo giờ Việt Nam, dùng cho hạn phản hồi. */
export function formatVNDeadline(iso: string): string {
  const d = vnWall(iso);
  return `${formatVNTime(iso)} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
