// Hàm thuần của tab Lịch và giá (không có JSX, dễ test). Đặt riêng để file component chỉ export component.
import { vi } from '@/i18n';

/** Giá tối đa theo luật server (0..5.000.000đ). Kiểm ở UI để báo sớm, server vẫn là nơi quyết định. */
export const MAX_PRICE = 5_000_000;

/** Câu lỗi cho một giá nhập; undefined khi giá hợp lệ. */
export function priceError(value: number | null): string | undefined {
  if (value === null) return vi.gymerSchedule.prices.required;
  if (value < 0 || value > MAX_PRICE) return vi.gymerSchedule.prices.range;
  return undefined;
}

/** Ngày theo giờ địa phương dạng 'YYYY-MM-DD'. Không dùng toISOString (lệch ngày theo múi giờ). */
export function toDateIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
