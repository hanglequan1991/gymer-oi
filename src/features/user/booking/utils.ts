// Tiện ích nhỏ của đặt lịch phía khách. Feature không import @/services (ESLint), nên đọc mã lỗi theo duck typing.
import type { DayInfo, MyBooking } from '@/types/domain';
import { useBookingDraft } from '@/stores';
import { slotIdToIsoRange } from '@/utils/booking';
import { isSameDay } from '@/utils/date';

type DraftState = ReturnType<typeof useBookingDraft.getState>;

/** Bản nháp đủ để đặt lịch: có Gymer, ngày, khung giờ hợp lệ, và Gymer khớp tham số route. */
export interface ReadyDraft {
  gymerId: string;
  dateIso: string;
  slotId: string;
  startIso: string;
  endIso: string;
}

/** Trả về bản nháp đã đủ dữ liệu, hoặc null nếu phải chuyển hướng. */
export function readyDraft(draft: DraftState, routeGymerId: string): ReadyDraft | null {
  const { gymerId, dateIso, slotId } = draft;
  if (!gymerId || !dateIso || !slotId) return null;
  if (gymerId !== routeGymerId) return null;
  const range = slotIdToIsoRange(slotId);
  if (range === null) return null;
  return { gymerId, dateIso, slotId, ...range };
}

/** Mã lỗi nghiệp vụ của một lỗi bất kỳ (AppError có thuộc tính code); không có thì trả null. */
export function errorCodeOf(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/**
 * Tìm lượt đã gửi trước đó khớp với lần gửi vừa lỗi mạng: cùng Gymer, cùng giờ bắt đầu,
 * đang chờ duyệt hoặc đã được xác nhận (Gymer có thể xác nhận ngay trước khi khách thử lại).
 * So sánh theo thời điểm (getTime) để không lệch vì khác cách viết offset.
 */
export function findSubmittedMatch(
  mine: MyBooking[],
  gymerId: string,
  startIso: string,
): MyBooking | undefined {
  const target = new Date(startIso).getTime();
  return mine.find(
    (b) =>
      b.gymerId === gymerId &&
      (b.status === 'pending' || b.status === 'confirmed') &&
      new Date(b.start).getTime() === target,
  );
}

/** Tách "YYYY-MM-DD" thành năm, tháng (1-based, như getMonth của services) và ngày. */
export function parseDateIso(dateIso: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateIso.split('-').map(Number);
  return { year, month, day };
}

/** Giá của đúng ngày `dateIso` trong danh sách tháng trả về từ schedule.getMonth; undefined nếu không có. */
export function priceOfDay(days: DayInfo[], dateIso: string): number | undefined {
  const { year, month, day } = parseDateIso(dateIso);
  const target = new Date(year, month - 1, day);
  return days.find((d) => isSameDay(d.date, target))?.price;
}
