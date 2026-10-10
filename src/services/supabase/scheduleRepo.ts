// Repository lịch và giá của Gymer (plan D7). Không dùng upsert cho khung giờ (xem setSlotClosed).
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../errors';
import { parseSlotId, toDayInfo, toSlot } from '../mappers/schedule';
import type { ScheduleRepository } from '../repositories/scheduleRepository';
import type { Database } from './database.types';
import { toAppError, unwrap } from './postgrestError';
import { requireUserId } from './userId';

const MAX_PRICE_VND = 5_000_000;

/** Giá phải là số nguyên trong 0..5.000.000 VND. Kiểm phía client trước khi gọi mạng. */
function assertPrice(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_PRICE_VND) {
    throw new AppError('VALIDATION', `Giá ${label} phải là số nguyên từ 0 đến 5.000.000 đ.`);
  }
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
  };
}
