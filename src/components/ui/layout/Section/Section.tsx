import type { CSSProperties, ReactNode } from 'react';
import { useId } from 'react';
import { cx } from '@/utils/cx';
import './Section.css';

/** Props của Section. */
export interface SectionProps {
  title?: string;
  /** Nhãn link hành động, ví dụ "Tất cả". Chỉ hiện khi có cả onAction. */
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  /** Có padding quanh nội dung, mặc định true. */
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Thẻ có tiêu đề và link hành động tuỳ chọn. */
export function Section({
  title,
  actionLabel,
  onAction,
  children,
  padded = true,
  className,
  style,
  'data-testid': testId,
}: SectionProps) {
  const titleId = useId();
  const showAction = actionLabel !== undefined && onAction !== undefined;
  const showHead = title !== undefined || showAction;

  return (
    <section
      className={cx('gy-section', className)}
      style={style}
      data-testid={testId}
      aria-labelledby={title !== undefined ? titleId : undefined}
    >
      {showHead && (
        <div className="gy-section__head">
          {title !== undefined && (
            <h2 id={titleId} className="gy-section__title">
              {title}
            </h2>
          )}
          {showAction && (
            <button type="button" className="gy-section__action" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      )}
      <div className={cx('gy-section__body', padded && 'gy-section__body--padded')}>{children}</div>
    </section>
  );
}
