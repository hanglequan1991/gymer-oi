// Mapper thuần cho lịch và khung giờ của Gymer (plan D7). Không có logic giá: giá lấy nguyên từ server.
import type { DayInfo, Slot, SlotState } from '@/types/domain';
import { AppError } from '../errors';
import type { Database } from '../supabase/database.types';

type Fn = Database['public']['Functions'];

export type MonthCalendarRow = Fn['get_month_calendar']['Returns'][number];
/** booked_by được khai báo là string nhưng thực tế có thể null (khung trống). */
export type DaySlotRow = Omit<Fn['get_day_slots']['Returns'][number], 'booked_by'> & {
  booked_by: string | null;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLOT_ID_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
const SERVER_SLOT_STATES: readonly SlotState[] = ['available', 'booked', 'closed'];

/** Kiểm tra y-m-d có phải một ngày thật (ví dụ loại 2026-02-30). */
function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * Một ô trong lịch tháng. `day` là 'YYYY-MM-DD'; DayInfo.date dựng bằng constructor local
 * (không Date.parse) để không lệch ngày theo múi giờ của máy.
 */
export function toDayInfo(row: MonthCalendarRow): DayInfo {
  const m = DATE_RE.exec(row.day);
  if (!m) throw new AppError('UNKNOWN', 'Ngày trong lịch không hợp lệ.');
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  return {
    date,
    price: row.price_vnd,
    disabled: !row.is_open && !row.has_booked,
    marker: row.has_booked ? 'booked' : row.is_open ? 'open' : 'none',
  };
}

/** Khung giờ: id = "<dateIso>T<HH:mm>" (giờ Việt Nam), time = 'HH:mm' (cắt từ 'HH:MM:SS'). */
export function toSlot(dateIso: string, row: DaySlotRow): Slot {
  const state = row.state as SlotState;
  if (!SERVER_SLOT_STATES.includes(state)) {
    throw new AppError('UNKNOWN', 'Trạng thái khung giờ không hợp lệ.');
  }
  const time = row.start_time.slice(0, 5);

  return {
    id: `${dateIso}T${time}`,
    time,
    state,
    bookedBy: row.booked_by ?? undefined,
  };
}

/** Tách slotId "<dateIso>T<HH:mm>" thành ngày và giờ bắt đầu. Sai định dạng hoặc ngày/giờ không hợp lệ: VALIDATION. */
export function parseSlotId(slotId: string): { day: string; startTime: string } {
  const m = SLOT_ID_RE.exec(slotId);
  if (!m) throw new AppError('VALIDATION', 'Mã khung giờ không hợp lệ.');

  const [, day, hh, mm] = m;
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  if (!isRealDate(year, month, dayOfMonth) || Number(hh) > 23 || Number(mm) > 59) {
    throw new AppError('VALIDATION', 'Mã khung giờ không hợp lệ.');
  }
  return { day, startTime: `${hh}:${mm}` };
}

const SLOT_MINUTES = 60;
const VN_TZ_SUFFIX = '+07:00';

/**
 * Đổi Slot.id "<dateIso>T<HH:mm>" (giờ Việt Nam) sang khoảng ISO có offset +07:00 rõ ràng.
 * Tính trên trục UTC (Date.UTC) để không phụ thuộc múi giờ máy; khung kéo dài SLOT_MINUTES phút,
 * qua nửa đêm/qua tháng/qua năm được xử lý tự nhiên. Sai định dạng: VALIDATION (qua parseSlotId).
 */
export function slotIdToIsoRange(slotId: string): { startIso: string; endIso: string } {
  const { day, startTime } = parseSlotId(slotId);
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const [hh, mm] = startTime.split(':').map(Number);

  const startWall = Date.UTC(year, month - 1, dayOfMonth, hh, mm);
  const endWall = startWall + SLOT_MINUTES * 60 * 1000;

  return {
    startIso: formatWallVN(startWall),
    endIso: formatWallVN(endWall),
  };
}

/** Định dạng mốc "giờ tường" (đã dựng trên trục UTC) thành 'YYYY-MM-DDTHH:mm:00+07:00'. */
function formatWallVN(wallMs: number): string {
  const d = new Date(wallMs);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00${VN_TZ_SUFFIX}`
  );
}
