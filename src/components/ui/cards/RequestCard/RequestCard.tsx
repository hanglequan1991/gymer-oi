import type { CSSProperties } from 'react';
import { Badge, PriceLabel, STATUS_BADGE } from '@/components/ui/atoms';
import type { BadgeTone } from '@/components/ui/atoms';
import { GButton } from '@/components/ui/controls';
import type { BookingRequest } from '@/types/domain';
import { cx } from '@/utils/cx';
import { formatTimeRange } from '@/utils/format';
import './RequestCard.css';

/** Props của RequestCard. */
export interface RequestCardProps {
  request: BookingRequest;
  /** Gọi khi bấm "Xác nhận", truyền id yêu cầu. */
  onConfirm?: (id: string) => void;
  /** Gọi khi bấm "Từ chối", truyền id yêu cầu. */
  onReject?: (id: string) => void;
  /**
   * Đang xử lý: hai nút hiện trạng thái đang tải và chặn bấm.
   * Cha PHẢI đặt `busy` = true ngay khi bắt đầu xử lý để chặn bấm đúp,
   * và đặt lại false khi xong hoặc khi lỗi.
   */
  busy?: boolean;
  /** Thẻ gọn (giữ cho tương thích; thẻ không còn hiện ghi chú sức khoẻ). */
  compact?: boolean;
  /** Gọi khi bấm nút mở chi tiết, truyền id yêu cầu. Nút chỉ hiện khi có cả onOpen và openLabel. */
  onOpen?: (id: string) => void;
  /** Nhãn nút mở chi tiết. */
  openLabel?: string;
  /** Gọi khi bấm "Huỷ buổi", truyền id yêu cầu. Chỉ hiện với thẻ confirmed khi có cả `cancelLabel`. */
  onCancel?: (id: string) => void;
  /** Nhãn nút huỷ buổi. */
  cancelLabel?: string;
  /** Nhãn đọc màn hình của nút huỷ buổi (thay cho nhãn hiển thị khi cần chi tiết hơn). */
  cancelAriaLabel?: string;
  /** Dòng nhỏ ở chân thẻ thay cho nút huỷ (ví dụ "Buổi đã bắt đầu, không thể huỷ"). */
  hint?: string;
  /** Nhãn huy hiệu thay cho nhãn mặc định của trạng thái (ví dụ "Bạn đã huỷ"). Tone vẫn theo trạng thái. */
  badgeLabel?: string;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/**
 * Thẻ yêu cầu đặt lịch: tên khách, nhãn trạng thái, thời gian, mục tiêu, giá. Ghi chú sức khoẻ không hiển thị ở đây (tải riêng khi mở chi tiết).
 * Chỉ yêu cầu đang chờ mới có nút Xác nhận và Từ chối. Thẻ confirmed có nút Huỷ buổi khi cha truyền `onCancel`;
 * nếu không có nút huỷ mà có `hint` thì hiện dòng `hint` ở chỗ đó. Thẻ không tự biết luật thời gian hay i18n: mọi chữ và điều kiện do cha truyền vào.
 * Khi `busy` đang bật, bấm không gọi callback; việc chống bấm đúp phụ thuộc vào cha đặt `busy` (xem prop `busy`).
 */
export function RequestCard({
  request,
  onConfirm,
  onReject,
  busy = false,
  compact = false,
  onOpen,
  openLabel,
  onCancel,
  cancelLabel,
  cancelAriaLabel,
  hint,
  badgeLabel,
  className,
  style,
  'data-testid': testId,
}: RequestCardProps) {
  const isPending = request.status === 'pending';
  const badge: { tone: BadgeTone; label: string } =
    isPending && request.isNew
      ? { tone: 'warn', label: 'Mới' }
      : { tone: STATUS_BADGE[request.status].tone, label: badgeLabel ?? STATUS_BADGE[request.status].label };
  const showCancel = request.status === 'confirmed' && Boolean(onCancel && cancelLabel);

  const guard = (callback?: (id: string) => void) => () => {
    if (busy || !callback) return;
    callback(request.id);
  };

  return (
    <article
      className={cx('gy-request-card', compact && 'gy-request-card--compact', className)}
      style={style}
      data-testid={testId}
      aria-label={`Yêu cầu của ${request.customerName}`}
      aria-busy={busy || undefined}
    >
      <header className="gy-request-card__head">
        <span className="gy-request-card__name">{request.customerName}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </header>
      <p className="gy-request-card__time">{formatTimeRange(request.start, request.end)}</p>
      {request.goal ? <p className="gy-request-card__goal">{`Mục tiêu: ${request.goal}`}</p> : null}
      <footer className="gy-request-card__foot">
        <PriceLabel amount={request.price} size="sm" />
        {onOpen && openLabel ? (
          <GButton kind="ghost" onClick={() => onOpen(request.id)}>
            {openLabel}
          </GButton>
        ) : null}
        {showCancel ? (
          <GButton
            kind="danger-ghost"
            loading={busy}
            aria-label={cancelAriaLabel}
            onClick={guard(onCancel)}
          >
            {cancelLabel}
          </GButton>
        ) : hint ? (
          <p className="gy-request-card__hint">{hint}</p>
        ) : null}
        {isPending && (
          <div className="gy-request-card__actions">
            <GButton kind="danger-ghost" loading={busy} onClick={guard(onReject)}>
              Từ chối
            </GButton>
            <GButton kind="primary" loading={busy} onClick={guard(onConfirm)}>
              Xác nhận
            </GButton>
          </div>
        )}
      </footer>
    </article>
  );
}
