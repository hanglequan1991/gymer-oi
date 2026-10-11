// Thanh đặt lịch dưới màn: tóm tắt ngày, giờ và giá của NGÀY ĐÃ CHỌN, nút "Đặt lịch" chỉ bật khi đã chọn khung.
import { BottomActionBar, GButton, PriceLabel } from '@/components/ui';
import { vi } from '@/i18n';

export interface BookingBarProps {
  /** Tóm tắt "Thứ 7, 17/10 · 09:00"; null khi chưa chọn đủ ngày và giờ. */
  summary: string | null;
  /** Giá của ngày đã chọn (DayInfo.price từ server). */
  price?: number;
  onBook: () => void;
}

export function BookingBar({ summary, price, onBook }: BookingBarProps) {
  const t = vi.gymerDetail;
  const canBook = summary !== null;
  return (
    <BottomActionBar
      action={
        <GButton kind="primary" size="lg" disabled={!canBook} onClick={onBook}>
          {t.bookingCta}
        </GButton>
      }
    >
      {canBook ? (
        <div data-testid="booking-bar-summary" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>{summary}</span>
          {price !== undefined && <PriceLabel amount={price} suffix={t.pricePerSession} size="sm" />}
        </div>
      ) : (
        <span data-testid="booking-bar-summary">{t.bookingHintEmpty}</span>
      )}
    </BottomActionBar>
  );
}
