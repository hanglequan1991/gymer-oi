import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/atoms';
import { GButton } from '@/components/ui/controls';
import { cx } from '@/utils/cx';
import './HealthNoteBlock.css';

/** Trạng thái của khối ghi chú sức khoẻ phía Gymer (mục 3.4 và 4.1). */
export type HealthNoteBlockStatus = 'loading' | 'visible' | 'hidden' | 'error';

/**
 * Props của HealthNoteBlock. Component không import i18n hay services:
 * mọi chữ do bên gọi truyền vào. Ghi chú hiển thị là văn bản thuần.
 */
export interface HealthNoteBlockProps {
  /** Trạng thái hiện tại. */
  status: HealthNoteBlockStatus;
  /** Tiêu đề khối, ví dụ "Ghi chú sức khoẻ". */
  title: string;
  /** Nội dung ghi chú (văn bản thuần); chỉ dùng khi status là visible. */
  note?: string;
  /** Nhãn Badge info, ví dụ "Khách chia sẻ". */
  badgeLabel?: string;
  /** Dòng quyền xem, ví dụ "Bạn xem được ghi chú này đến ...". */
  viewableText?: string;
  /** Dòng cảnh báo thường trực dưới ghi chú. */
  warningText?: string;
  /** Dòng 1 khi hidden (15px). */
  hiddenText?: string;
  /** Dòng 2 khi hidden (13px, muted). */
  hiddenHint?: string;
  /** Chữ lỗi khi tải thất bại. */
  errorText?: string;
  /** Nhãn nút thử lại. */
  retryLabel?: string;
  /** Gọi khi bấm thử lại. Nút chỉ hiện khi có cả retryLabel và onRetry. */
  onRetry?: () => void;
  /** Chữ đọc cho trình đọc màn hình khi đang tải. */
  loadingLabel?: string;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Khối "Ghi chú sức khoẻ" của Gymer: loading, visible, hidden, error. */
export function HealthNoteBlock({
  status,
  title,
  note,
  badgeLabel,
  viewableText,
  warningText,
  hiddenText,
  hiddenHint,
  errorText,
  retryLabel,
  onRetry,
  loadingLabel,
  className,
  style,
  'data-testid': testId,
}: HealthNoteBlockProps) {
  const header = (
    <div className="gy-health-note__header">
      <h3 className="gy-health-note__title">{title}</h3>
      {status === 'visible' && badgeLabel !== undefined && <Badge tone="info">{badgeLabel}</Badge>}
    </div>
  );

  if (status === 'loading') {
    return (
      <section
        className={cx('gy-health-note', className)}
        style={style}
        data-testid={testId}
        aria-busy="true"
      >
        {header}
        <div className="gy-health-note__skeleton" aria-hidden="true">
          <span className="gy-health-note__skeleton-line" />
          <span className="gy-health-note__skeleton-line" />
          <span className="gy-health-note__skeleton-line gy-health-note__skeleton-line--short" />
        </div>
        {loadingLabel !== undefined && <span className="gy-health-note__sr-only">{loadingLabel}</span>}
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className={cx('gy-health-note', className)} style={style} data-testid={testId}>
        {header}
        <div className="gy-health-note__error" role="alert">
          <p className="gy-health-note__error-text">{errorText}</p>
          {retryLabel !== undefined && onRetry !== undefined && (
            <GButton kind="ghost" onClick={onRetry}>
              {retryLabel}
            </GButton>
          )}
        </div>
      </section>
    );
  }

  if (status === 'hidden') {
    return (
      <section className={cx('gy-health-note', className)} style={style} data-testid={testId}>
        {header}
        {hiddenText !== undefined && <p className="gy-health-note__hidden-text">{hiddenText}</p>}
        {hiddenHint !== undefined && <p className="gy-health-note__hidden-hint">{hiddenHint}</p>}
      </section>
    );
  }

  return (
    <section className={cx('gy-health-note', className)} style={style} data-testid={testId}>
      {header}
      <div className="gy-health-note__box">
        <p className="gy-health-note__text">{note}</p>
      </div>
      {viewableText !== undefined && <p className="gy-health-note__meta">{viewableText}</p>}
      {warningText !== undefined && <p className="gy-health-note__meta">{warningText}</p>}
    </section>
  );
}
