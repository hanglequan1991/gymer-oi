// Repository đặt lịch phía khách (plan T-R, D7): create qua RPC create_booking.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MyBooking } from '@/types/domain';
import { AppError } from '../errors';
import type { BookingCreateInput, BookingRepository } from '../repositories/bookingRepository';
import { toMyBooking } from '../mappers/booking';
import type { MyBookingRow } from '../mappers/booking';
import type { Database } from './database.types';
import { toAppError } from './postgrestError';
import { requireUserId } from './userId';

const SLOT_MS = 60 * 60 * 1000;

/**
 * Chuỗi select cho lượt đặt phía khách. Embed gymer_profiles qua khoá ngoại bookings_gymer_id_fkey (tên, ảnh);
 * embed reviews(id) chỉ để biết đã đánh giá chưa (RLS trả các đánh giá của chính khách);
 * embed booking_health_notes(shared_with_gymer) để nhắc lại lựa chọn chia sẻ (chỉ cờ, không đọc nội dung ghi chú);
 * cancelled_by để biết ai huỷ (so với gymer_id trong mapper).
 */
export const MY_BOOKING_SELECT =
  'id, gymer_id, starts_at, ends_at, price_vnd, goal, status, expires_at, cancelled_by, gymer_profiles!bookings_gymer_id_fkey(display_name, avatar_url), reviews(id), booking_health_notes(shared_with_gymer)' as const;

const LIST_LIMIT = 100;
/** Giới hạn ký tự nhận đánh giá; khớp create_review (char_length sau btrim). */
const REVIEW_MAX_CHARS = 500;

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

    async getMine(bookingId: string): Promise<MyBooking> {
      const uid = await requireUserId(client);
      const { data, error } = await client
        .from('bookings')
        .select(MY_BOOKING_SELECT)
        .eq('customer_id', uid)
        .eq('id', bookingId)
        .maybeSingle();
      if (error) throw toAppError(error);
      if (!data) throw new AppError('NOT_FOUND', 'Không tìm thấy lượt đặt.');
      return toMyBooking(data as MyBookingRow);
    },

    async listMine(): Promise<MyBooking[]> {
      const uid = await requireUserId(client);
      const { data, error } = await client
        .from('bookings')
        .select(MY_BOOKING_SELECT)
        .eq('customer_id', uid)
        .order('starts_at', { ascending: false })
        .limit(LIST_LIMIT);
      if (error) throw toAppError(error);
      return ((data ?? []) as MyBookingRow[]).map((row) => toMyBooking(row));
    },

    async cancel(bookingId: string): Promise<void> {
      await requireUserId(client);
      const { error } = await client.rpc('cancel_booking', { p_booking_id: bookingId });
      if (error) throw toAppError(error);
    },

    async review(bookingId, input): Promise<void> {
      // Kiểm đầu vào trước khi gọi mạng; server kiểm lại (RLS và create_review là hàng rào thật).
      if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        throw new AppError('VALIDATION', 'Số sao phải là số nguyên từ 1 đến 5.');
      }
      // Cắt khoảng trắng và đếm theo ký tự (code point), đúng cách create_review kiểm.
      const body = (input.text ?? '').trim();
      if (Array.from(body).length > REVIEW_MAX_CHARS) {
        throw new AppError('VALIDATION', `Nhận xét không quá ${REVIEW_MAX_CHARS} ký tự.`);
      }

      await requireUserId(client);
      const { error } = await client.rpc('create_review', {
        p_booking_id: bookingId,
        p_rating: input.rating,
        p_body: body,
      });
      if (error) throw toAppError(error);
    },
  };
}
