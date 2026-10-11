/**
 * Định dạng hiển thị tiếng Việt. Quy ước:
 * - formatVND: có dấu chấm phân nhóm nghìn, đuôi "đ". 180000 -> "180.000đ".
 * - formatVNDShort: dưới 1.000 -> "950đ"; từ 1.000 đến dưới 999.500 -> làm tròn nghìn, "180k";
 *   từ 999.500 trở lên -> triệu, tối đa 2 chữ số thập phân, dấu phẩy thập phân: 1650000 -> "1,65tr".
 * - formatDistance: 1 chữ số thập phân, bỏ ".0"; dưới 0,1 km -> "<100 m".
 * - Số tiền âm không được hỗ trợ (giá luôn không âm).
 */

import type { Gender } from '@/types/domain';
import { VN_WEEKDAYS } from '@/utils/date';
import { formatVNTime, formatVNWeekdayDate } from '@/utils/booking';

const GENDER_LABEL: Record<Gender, string> = {
  female: 'Nữ',
  male: 'Nam',
};

/** Nhóm chữ số hàng nghìn bằng dấu chấm: 1234567 -> "1.234.567". */
function groupThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatVND(n: number): string {
  return `${groupThousands(n)}đ`;
}

export function formatVNDShort(n: number): string {
  if (n < 1000) return `${Math.round(n)}đ`;
  if (n < 999_500) return `${Math.round(n / 1000)}k`;
  const millions = Math.round(n / 10_000) / 100; // 2 chữ số thập phân
  return `${String(millions).replace('.', ',')}tr`;
}

export function formatDistance(km: number): string {
  if (km < 0.1) return '<100 m';
  const rounded = Math.round(km * 10) / 10;
  return `${rounded} km`;
}

export function genderLabel(g: Gender): string {
  return GENDER_LABEL[g];
}

/**
 * "Thứ 7" hoặc "CN" theo lịch địa phương của `d`.
 * Chỉ dùng cho ngày lịch (đối tượng Date đã là ngày cần hiển thị, ví dụ ô lịch).
 * KHÔNG dùng cho thời điểm tuyệt đối (ISO từ server): dùng formatVNWeekdayDate trong utils/booking.ts.
 */
export function weekdayVN(d: Date): string {
  return VN_WEEKDAYS[d.getDay()];
}

/**
 * "17/10" (ngày/tháng, có số 0 đứng đầu) theo lịch địa phương của `d`.
 * Chỉ dùng cho ngày lịch, KHÔNG dùng cho thời điểm tuyệt đối (xem ghi chú của weekdayVN).
 */
export function formatDateVN(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/**
 * "Thứ 7, 17/10 · 09:00 – 10:00" từ hai chuỗi ISO, theo giờ Việt Nam (UTC+7) bất kể giờ máy.
 * Mốc bắt đầu quyết định ngày hiển thị; giờ kết thúc chỉ lấy HH:mm.
 */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatVNWeekdayDate(startIso)} · ${formatVNTime(startIso)} – ${formatVNTime(endIso)}`;
}

/** "Tháng 10/2026" với month 0-based. */
export function monthLabelVN(year: number, month: number): string {
  return `Tháng ${month + 1}/${year}`;
}
