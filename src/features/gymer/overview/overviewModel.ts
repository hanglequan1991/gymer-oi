// Xử lý thuần cho tab Tổng quan: đếm, lọc theo ngày giờ Việt Nam. Không gọi service, không đụng DOM.
import type { BookingRequest } from '@/types/domain';

/** Số yêu cầu chờ duyệt tối đa hiện trên tổng quan; phần còn lại xem ở tab Yêu cầu. */
export const PENDING_PREVIEW_LIMIT = 3;

const VN_TZ = 'Asia/Ho_Chi_Minh';

// Dựng một lần: DateTimeFormat khởi tạo tốn kém, và dùng lại được cho mọi lần gọi.
// hourCycle h23 tránh trường hợp nửa đêm bị ra "24" ở một số môi trường.
const vnFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: VN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface VnParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

/**
 * Tách một thời điểm thành các phần theo giờ Việt Nam, bất kể múi giờ của thiết bị.
 * Vì sao không dùng getDate/getHours: Mini App có thể chạy trên thiết bị ở múi giờ khác.
 */
function vnParts(instant: Date | string): VnParts {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  const parts: Partial<VnParts> = {};
  for (const part of vnFormatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type as keyof VnParts] = part.value;
  }
  return parts as VnParts;
}

/** Khoá ngày theo giờ Việt Nam, dạng "YYYY-MM-DD". Hai thời điểm cùng ngày VN thì khoá bằng nhau. */
export function vnDayKey(instant: Date | string): string {
  const p = vnParts(instant);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Giờ bắt đầu theo giờ Việt Nam, dạng "HH:mm". */
export function vnHhmm(iso: string): string {
  const p = vnParts(iso);
  return `${p.hour}:${p.minute}`;
}

/** Ngày và giờ bắt đầu theo giờ Việt Nam, dạng "17/10 · 09:00". */
export function vnDateTimeLabel(iso: string): string {
  const p = vnParts(iso);
  return `${p.day}/${p.month} · ${p.hour}:${p.minute}`;
}

/** Dữ liệu đã tính cho màn Tổng quan. */
export interface OverviewSummary {
  /** Số yêu cầu đang chờ duyệt (tất cả, không chỉ phần hiển thị). */
  pendingCount: number;
  /** Số buổi đã xác nhận chưa kết thúc. */
  upcomingCount: number;
  /** Buổi đã xác nhận bắt đầu trong ngày hôm nay (VN), sắp theo giờ tăng dần. */
  today: BookingRequest[];
  /** Tối đa PENDING_PREVIEW_LIMIT yêu cầu chờ duyệt, sớm nhất trước. */
  pendingPreview: BookingRequest[];
}

/** Tính số liệu và danh sách hiển thị từ một lần list() và thời điểm `now`. */
export function buildOverview(list: readonly BookingRequest[], now: Date): OverviewSummary {
  const nowMs = now.getTime();
  const todayKey = vnDayKey(now);

  let pendingCount = 0;
  let upcomingCount = 0;
  const today: BookingRequest[] = [];
  const pending: BookingRequest[] = [];

  for (const r of list) {
    if (r.status === 'pending') {
      pendingCount += 1;
      pending.push(r);
    } else if (r.status === 'confirmed') {
      if (Date.parse(r.end) > nowMs) upcomingCount += 1;
      if (vnDayKey(r.start) === todayKey) today.push(r);
    }
  }

  const byStart = (a: BookingRequest, b: BookingRequest) => Date.parse(a.start) - Date.parse(b.start);
  today.sort(byStart);
  pending.sort(byStart);

  return {
    pendingCount,
    upcomingCount,
    today,
    pendingPreview: pending.slice(0, PENDING_PREVIEW_LIMIT),
  };
}
