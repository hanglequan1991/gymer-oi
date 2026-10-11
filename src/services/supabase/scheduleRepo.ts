// Repository lịch và giá của Gymer (plan D7). Không dùng upsert cho khung giờ (xem setSlotClosed).
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../errors';
import { parseSlotId, toDayInfo, toSlot } from '../mappers/schedule';
import type { ScheduleRepository } from '../repositories/scheduleRepository';
import type { Database } from './database.types';
import { toAppError, unwrap, unwrapOrNull } from './postgrestError';
import { requireUserId } from './userId';

const MAX_PRICE_VND = 5_000_000;
/** Số ngày tối đa mỗi lần đặt/bỏ giá riêng; khớp giới hạn server, chặn sớm để khỏi gửi nhiều lượt. */
const MAX_OVERRIDE_DAYS = 62;

/** Giá phải là số nguyên trong 0..5.000.000 VND. Kiểm phía client trước khi gọi mạng. */
function assertPrice(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_PRICE_VND) {
    throw new AppError('VALIDATION', `Giá ${label} phải là số nguyên từ 0 đến 5.000.000 đ.`);
  }
}

/** Ngày dạng 'YYYY-MM-DD' và là ngày có thật (chặn 2026-02-30). Không dùng Date.parse vì dễ lệch múi giờ. */
function assertDateIso(value: string): void {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m === null) {
    throw new AppError('VALIDATION', `Ngày "${value}" không đúng dạng YYYY-MM-DD.`);
  }
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new AppError('VALIDATION', `Ngày "${value}" không tồn tại.`);
  }
}

/** Trạng thái một ngày trong gymer_day_overrides. Không có hàng nghĩa là mở với giá mặc định. */
interface DayOverrideRow {
  is_open: boolean;
  price_vnd: number | null;
}

async function readDayOverride(
  client: SupabaseClient<Database>,
  uid: string,
  day: string,
): Promise<DayOverrideRow | null> {
  const res = await client
    .from('gymer_day_overrides')
    .select('is_open,price_vnd')
    .eq('gymer_id', uid)
    .eq('day', day)
    .maybeSingle();
  return unwrapOrNull(res);
}

/** Cập nhật rồi thêm, không upsert (client không có quyền insert đủ cột như upsert cần; xem setSlotClosed). */
async function writeDayOverride(
  client: SupabaseClient<Database>,
  uid: string,
  day: string,
  row: DayOverrideRow,
): Promise<void> {
  const updateRow = async (): Promise<number> => {
    const res = await client
      .from('gymer_day_overrides')
      .update({ is_open: row.is_open, price_vnd: row.price_vnd })
      .eq('gymer_id', uid)
      .eq('day', day)
      .select();
    return unwrap(res).length;
  };

  if ((await updateRow()) > 0) return;

  const inserted = await client
    .from('gymer_day_overrides')
    .insert({ gymer_id: uid, day, is_open: row.is_open, price_vnd: row.price_vnd });
  if (!inserted.error) return;

  // Đọc SQLSTATE thô trước khi toAppError (toAppError đưa 23505 về UNKNOWN).
  const code = (inserted.error as { code?: string }).code;
  if (code !== '23505') throw toAppError(inserted.error);

  // Hàng vừa được tạo bởi lượt khác: cập nhật lại đúng một lần.
  if ((await updateRow()) === 0) {
    throw new AppError('NOT_FOUND', 'Không tìm thấy lịch của ngày này.');
  }
}

async function deleteDayOverride(client: SupabaseClient<Database>, uid: string, day: string): Promise<void> {
  const res = await client.from('gymer_day_overrides').delete().eq('gymer_id', uid).eq('day', day);
  unwrapOrNull(res);
}

export function createScheduleRepo(client: SupabaseClient<Database>): ScheduleRepository {
  return {
    async getMonth(gymerId, year, month) {
      const res = await client.rpc('get_month_calendar', {
        p_gymer_id: gymerId,
        p_year: year,
        p_month: month,
      });
      return unwrap(res).map(toDayInfo);
    },

    async getDaySlots(gymerId, dateIso) {
      const res = await client.rpc('get_day_slots', { p_gymer_id: gymerId, p_day: dateIso });
      return unwrap(res).map((row) => toSlot(dateIso, row));
    },

    async setPrices({ weekday, weekend }) {
      assertPrice('ngày thường', weekday);
      assertPrice('cuối tuần', weekend);
      const uid = await requireUserId(client);

      const res = await client
        .from('gymer_profiles')
        .update({ price_weekday_vnd: weekday, price_weekend_vnd: weekend })
        .eq('user_id', uid)
        .select();
      // Không có hàng: tài khoản này chưa phải Gymer.
      if (unwrap(res).length === 0) {
        throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ Gymer.');
      }
    },

    async setSlotClosed(slotId, closed) {
      const { day, startTime } = parseSlotId(slotId);
      const uid = await requireUserId(client);
      const isOpen = !closed;

      // Cập nhật có điều kiện khoá: trả số hàng đã đổi. Lỗi trigger (SLOT_HAS_BOOKING) đi qua toAppError.
      const updateSlot = async (): Promise<number> => {
        const res = await client
          .from('gymer_slot_overrides')
          .update({ is_open: isOpen })
          .eq('gymer_id', uid)
          .eq('day', day)
          .eq('start_time', startTime)
          .select();
        return unwrap(res).length;
      };

      if ((await updateSlot()) > 0) return;

      // Chưa có hàng: thêm mới. Không dùng upsert vì client chỉ có quyền cập nhật is_open (42501).
      const inserted = await client
        .from('gymer_slot_overrides')
        .insert({ gymer_id: uid, day, start_time: startTime, is_open: isOpen });
      if (!inserted.error) return;

      // Đọc SQLSTATE thô trước khi toAppError (toAppError đưa 23505 về UNKNOWN).
      const code = (inserted.error as { code?: string }).code;
      if (code !== '23505') throw toAppError(inserted.error);

      // Hàng vừa được tạo bởi lượt khác: cập nhật lại đúng một lần.
      if ((await updateSlot()) === 0) {
        throw new AppError('NOT_FOUND', 'Không tìm thấy khung giờ.');
      }
    },

    async setDayOverrides(dateIsos, patch) {
      if (dateIsos.length > MAX_OVERRIDE_DAYS) {
        throw new AppError('VALIDATION', `Chỉ đặt tối đa ${MAX_OVERRIDE_DAYS} ngày mỗi lần.`);
      }
      dateIsos.forEach(assertDateIso);
      if (typeof patch.price === 'number') assertPrice('riêng', patch.price);
      const uid = await requireUserId(client);

      const applied: string[] = [];
      const skipped: string[] = [];
      // Tuần tự: mỗi ngày đọc dòng hiện có rồi mới ghi, để kết quả tính đúng từng ngày.
      for (const day of dateIsos) {
        const current = await readDayOverride(client, uid, day);
        const next: DayOverrideRow = {
          is_open: patch.closed === undefined ? (current?.is_open ?? true) : !patch.closed,
          price_vnd: patch.price === undefined ? (current?.price_vnd ?? null) : patch.price,
        };

        try {
          // Mở và không giá riêng là trạng thái mặc định: xoá dòng cho gọn.
          if (next.is_open && next.price_vnd === null) {
            await deleteDayOverride(client, uid, day);
          } else {
            await writeDayOverride(client, uid, day, next);
          }
          applied.push(day);
        } catch (err) {
          // Trigger chặn đóng ngày đã có lịch đặt (VALIDATION): bỏ qua ngày này, các ngày khác vẫn chạy.
          if (!next.is_open && err instanceof AppError && err.code === 'VALIDATION') {
            skipped.push(day);
            continue;
          }
          throw err;
        }
      }
      return { applied, skipped };
    },
  };
}
