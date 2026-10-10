// Repository đặt lịch phía khách (plan T-R, D7): create qua RPC create_booking.
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../errors';
import type { BookingCreateInput, BookingRepository } from '../repositories/bookingRepository';
import type { Database } from './database.types';
import { toAppError } from './postgrestError';

const SLOT_MS = 60 * 60 * 1000;

/**
 * Chuỗi thời gian phải có giờ và offset rõ ràng: `Z` hoặc `±hh:mm` / `±hhmm` ở cuối (V4).
 * Thiếu offset thì client (Date.parse) và server (múi giờ phiên Postgres) hiểu khác nhau.
 */
const ISO_WITH_OFFSET = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Tạo BookingRepository.
 * create: kiểm startIso/endIso có offset múi giờ và endIso đúng 60 phút sau startIso, trước khi gọi mạng.
 * Chống đặt trùng nằm ở server (create_booking khoá theo khách và Gymer, slot_states, EXCLUDE bookings_no_overlap);
 * server dịch mọi xung đột thành P0001 SLOT_TAKEN, client chỉ chuyển mã qua toAppError.
 * Gửi đúng 6 tham số của create_booking; expectedPrice lấy từ input, không tính lại.
 */
export function createBookingRepo(client: SupabaseClient<Database>): BookingRepository {
  return {
    async create(input: BookingCreateInput) {
      if (!ISO_WITH_OFFSET.test(input.startIso) || !ISO_WITH_OFFSET.test(input.endIso)) {
        throw new AppError('VALIDATION', 'Thời gian đặt lịch thiếu múi giờ.');
      }
      const start = Date.parse(input.startIso);
      const end = Date.parse(input.endIso);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end - start !== SLOT_MS) {
        throw new AppError('VALIDATION', 'Khung giờ đặt phải dài đúng 60 phút.');
      }

      const { data, error } = await client.rpc('create_booking', {
        p_gymer_id: input.gymerId,
        p_starts_at: input.startIso,
        p_goal: input.goal ?? '',
        p_health_note: input.note ?? '',
        p_expected_price: input.expectedPrice,
        p_share_health_note: input.shareHealthNote ?? false,
      });
      if (error) {
        throw toAppError(error);
      }

      if (typeof data !== 'string' || data === '') {
        throw new AppError('UNKNOWN', 'Máy chủ không trả mã lượt đặt.');
      }
      return { bookingId: data };
    },
  };
}
