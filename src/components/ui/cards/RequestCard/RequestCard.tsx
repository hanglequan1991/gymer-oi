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
  /** Thẻ gọn: ẩn ghi chú của khách. */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/**
 * Thẻ yêu cầu đặt lịch: tên khách, nhãn trạng thái, thời gian, mục tiêu, ghi chú, giá.
 * Chỉ yêu cầu đang chờ mới có nút Xác nhận và Từ chối. Khi `busy` đang bật, bấm không gọi callback;
 * việc chống bấm đúp phụ thuộc vào cha đặt `busy` (xem prop `busy`).
 */
export function RequestCard({
  request,
  onConfirm,
  onReject,
  busy = false,
  compact = false,
  className,
  style,
  'data-testid': testId,
}: RequestCardProps) {
  const isPending = request.status === 'pending';
  const badge: { tone: BadgeTone; label: string } =
    isPending && request.isNew ? { tone: 'warn', label: 'Mới' } : STATUS_BADGE[request.status];

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
      {!compact && request.note ? <p className="gy-request-card__note">{request.note}</p> : null}
      <footer className="gy-request-card__foot">
        <PriceLabel amount={request.price} size="sm" />
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
