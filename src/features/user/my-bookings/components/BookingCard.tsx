// Một lượt đặt trong Lịch của tôi: Gymer, khung giờ, giá, nhãn trạng thái và các nút thao tác.
import type { ReactNode } from 'react';
import { Badge, GAvatar, GButton } from '@/components/ui';
import type { BadgeTone } from '@/components/ui/atoms';
import { vi } from '@/i18n';
import type { BookingStatus, MyBooking } from '@/types/domain';
import { formatVNTime, formatVNWeekdayDate } from '@/utils/booking';
import { formatVND } from '@/utils/format';

const t = vi.myBookings;

/** Nhãn và màu theo trạng thái hiển thị. Chữ luôn có, màu chỉ bổ sung. */
const STATUS_VIEW: Record<Exclude<BookingStatus, 'cancelled'>, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'warn', label: t.statusPending },
  confirmed: { tone: 'ok', label: t.statusConfirmed },
  rejected: { tone: 'danger', label: t.statusRejected },
  expired: { tone: 'neutral', label: t.statusExpired },
};

/** Nhãn huỷ theo người huỷ. Dữ liệu cũ không có cancelledBy thì chỉ hiện 'Đã huỷ' chung. */
function cancelledLabel(cancelledBy: MyBooking['cancelledBy']): string {
  if (cancelledBy === 'gymer') return t.statusCancelledByGymer;
  if (cancelledBy === 'customer') return t.statusCancelledByYou;
  return t.statusCancelled;
}

export interface BookingCardProps {
  booking: MyBooking;
  /** Trạng thái đã tính theo thời gian (pending quá hạn hiện Hết hạn). */
  status: BookingStatus;
  canCancel: boolean;
  canReview: boolean;
  /** Đang mở khối đánh giá của lượt này: ẩn nút Đánh giá. */
  reviewOpen: boolean;
  onOpenGymer(gymerId: string): void;
  onCancel(booking: MyBooking): void;
  onReview(booking: MyBooking): void;
  /** Gymer huỷ buổi: mở trang tìm kiếm để khách tìm Gymer khác. */
  onFindGymer(): void;
  /** Khối đánh giá, render ngay dưới lượt khi đang mở. */
  reviewSlot?: ReactNode;
}

export function BookingCard({
  booking: b,
  status,
  canCancel,
  canReview,
  reviewOpen,
  onOpenGymer,
  onCancel,
  onReview,
  onFindGymer,
  reviewSlot,
}: BookingCardProps) {
  const isCancelled = status === 'cancelled';
  const cancelledByGymer = isCancelled && b.cancelledBy === 'gymer';
  const view = isCancelled
    ? { tone: 'neutral' as const, label: cancelledLabel(b.cancelledBy) }
    : STATUS_VIEW[status];
  const showActions = canCancel || cancelledByGymer || (canReview && !reviewOpen);

  return (
    <li
      data-testid="booking-item"
      style={{
        listStyle: 'none',
        background: 'var(--gy-surface, #fff)',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <GAvatar name={b.gymerName} src={b.gymerAvatarUrl} size="sm" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            type="button"
            aria-label={t.openGymer(b.gymerName)}
            onClick={() => onOpenGymer(b.gymerId)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontWeight: 600,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {b.gymerName}
          </button>
          <span style={{ fontSize: 14 }}>
            {formatVNWeekdayDate(b.start)} · {formatVNTime(b.start)} – {formatVNTime(b.end)}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{formatVND(b.price)}</span>
        </div>
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>

      {cancelledByGymer && (
        <span style={{ fontSize: 14, color: 'var(--gy-color-muted)' }}>{t.cancelledByGymerNote}</span>
      )}

      {showActions && (
        <div style={{ display: 'flex', gap: 8 }}>
          {canCancel && (
            <GButton kind="danger-ghost" size="md" onClick={() => onCancel(b)}>
              {t.actionCancel}
            </GButton>
          )}
          {cancelledByGymer && (
            <GButton kind="secondary" size="md" onClick={onFindGymer}>
              {t.actionFindGymer}
            </GButton>
          )}
          {canReview && !reviewOpen && (
            <GButton kind="secondary" size="md" onClick={() => onReview(b)}>
              {t.actionReview}
            </GButton>
          )}
        </div>
      )}

      {reviewOpen && reviewSlot}
    </li>
  );
}
