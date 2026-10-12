// Repository yêu cầu đặt lịch phía Gymer (plan T-R, D7): list và respond.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HealthNoteResult, RequestStatus } from '@/types/domain';
import { isExpired } from '@/utils/booking';
import { AppError } from '../errors';
import type { RequestRepository } from '../repositories/requestRepository';
import { toBookingRequest } from '../mappers/request';
import type { RequestRow } from '../mappers/request';
import type { Database } from './database.types';
import { toAppError } from './postgrestError';
import { requireUserId } from './userId';

/**
 * Chuỗi select dùng chung cho list và đọc lại sau respond.
 * Không nhúng ghi chú sức khoẻ: ghi chú chỉ tải khi Gymer mở chi tiết (getHealthNote), plan 2.5A.
 */
export const REQUEST_SELECT = 'id, starts_at, ends_at, price_vnd, goal, status, expires_at, profiles!bookings_customer_id_fkey(display_name)' as const;

const DEFAULT_STATUSES: RequestStatus[] = ['pending', 'confirmed', 'rejected'];
const LIST_LIMIT = 100;

/**
 * Tạo RequestRepository. `now` dùng để lọc buổi đã kết thúc (ends_at > now, phía server) và pending quá hạn (isExpired, phía client); mặc định là thời điểm hiện tại.
 * list: chỉ đọc theo gymer_id = uid của phiên, chỉ buổi chưa kết thúc, sắp tăng dần, tối đa LIST_LIMIT dòng.
 * respond: gọi RPC respond_booking (trả undefined, nên kiểm res.error thủ công), rồi đọc lại hàng để trả trạng thái mới.
 * getHealthNote: đọc booking_health_notes theo booking_id; 0 dòng (RLS chặn) hoặc chưa chia sẻ hoặc rỗng => hidden, không phải lỗi.
 */
export function createRequestRepo(client: SupabaseClient<Database>, deps?: { now?: () => Date }): RequestRepository {
  const now = deps?.now ?? (() => new Date());

  return {
    async list(filter) {
      const uid = await requireUserId(client);
      const statuses: RequestStatus[] = filter?.status ? [filter.status] : DEFAULT_STATUSES;
      const at = now();

      const { data, error } = await client
        .from('bookings')
        .select(REQUEST_SELECT)
        .eq('gymer_id', uid)
        .in('status', statuses)
        .gt('ends_at', at.toISOString())
        .order('starts_at', { ascending: true })
        .limit(LIST_LIMIT);
      if (error) throw toAppError(error);

      const rows = (data ?? []) as RequestRow[];
      return rows
        .filter((row) => !isExpired(row.status, row.expires_at, at))
        .map((row) => toBookingRequest(row));
    },

    async respond(requestId, decision) {
      const { error } = await client.rpc('respond_booking', { p_booking_id: requestId, p_decision: decision });
      if (error) throw toAppError(error);

      const { data, error: readError } = await client
        .from('bookings')
        .select(REQUEST_SELECT)
        .eq('id', requestId)
        .maybeSingle();
      if (readError) throw toAppError(readError);
      if (!data) throw new AppError('NOT_FOUND', 'Không tìm thấy yêu cầu.');

      return toBookingRequest(data as RequestRow);
    },

    async getHealthNote(bookingId) {
      const { data, error } = await client
        .from('booking_health_notes')
        .select('note,shared_with_gymer')
        .eq('booking_id', bookingId)
        .maybeSingle();
      if (error) throw toAppError(error);

      if (!data || data.shared_with_gymer !== true) return { status: 'hidden' } satisfies HealthNoteResult;
      if (typeof data.note !== 'string' || data.note.trim() === '') return { status: 'hidden' } satisfies HealthNoteResult;
      return { status: 'visible', note: data.note } satisfies HealthNoteResult;
    },
  };
}
