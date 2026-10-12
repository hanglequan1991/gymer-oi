// Hằng số dùng chung cho luồng đặt lịch và ghi chú sức khoẻ (plan health-consent-ui, A2).
// Giá trị phải khớp quy tắc phía server (migration 20261010100650). Đổi một chỗ thì đổi cả server.

/** Thời lượng một buổi tập (phút). */
export const SESSION_MINUTES = 60;

/** Ghi chú sức khoẻ được xem đến hết N giờ sau khi buổi tập kết thúc. */
export const HEALTH_NOTE_GRACE_HOURS = 24;

/** Số yêu cầu đang chờ tối đa mỗi khách. */
export const MAX_PENDING_PER_CUSTOMER = 3;

/** Yêu cầu đang chờ tự hết hạn sau N giờ. */
export const PENDING_TTL_HOURS = 24;

/** Độ dài tối đa của ghi chú sức khoẻ (ký tự). */
export const HEALTH_NOTE_MAX = 1000;

/** Độ dài tối đa của mục tiêu tập luyện (ký tự). */
export const GOAL_MAX = 200;

const HOUR_MS = 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * HOUR_MS;

/**
 * Mốc cuối cùng Gymer được xem ghi chú sức khoẻ: endIso + HEALTH_NOTE_GRACE_HOURS.
 * Trả ISO 8601 theo múi giờ Việt Nam (+07:00). Hàm thuần, không đọc đồng hồ hệ thống.
 */
export function viewableUntilIso(endIso: string): string {
  const untilMs = new Date(endIso).getTime() + HEALTH_NOTE_GRACE_HOURS * HOUR_MS;
  const wall = new Date(untilMs + VN_OFFSET_MS).toISOString(); // dạng YYYY-MM-DDTHH:mm:ss.sssZ theo giờ VN
  return `${wall.slice(0, -1)}+07:00`;
}
