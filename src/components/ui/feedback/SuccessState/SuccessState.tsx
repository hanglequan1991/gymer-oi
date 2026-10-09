import type { CSSProperties } from 'react';
import { GButton } from '@/components/ui/controls';
import { cx } from '@/utils/cx';
import './SuccessState.css';

/** Props của SuccessState. */
export interface SuccessStateProps {
  /** Tiêu đề xác nhận thành công. */
  title: string;
  /** Mô tả thêm sau tiêu đề. */
  description?: string;
  /** Nhãn nút hành động; nút chỉ hiện khi có cả actionLabel và onAction. */
  actionLabel?: string;
  /** Callback khi bấm nút hành động. */
  onAction?: () => void;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Trạng thái thành công: dấu tick trong vòng tròn, tiêu đề, mô tả và nút hành động tuỳ chọn. */
export function SuccessState({
  title,
  description,
  actionLabel,
  onAction,
  className,
  style,
  'data-testid': testId,
}: SuccessStateProps) {
  const showAction = Boolean(actionLabel) && onAction !== undefined;

  return (
    <div role="status" className={cx('gy-success', className)} style={style} data-testid={testId}>
      <span className="gy-success__badge" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <p className="gy-success__title">{title}</p>
      {description !== undefined && <p className="gy-success__description">{description}</p>}
      {showAction && (
        <div className="gy-success__action">
          <GButton kind="ghost" onClick={onAction}>
            {actionLabel}
          </GButton>
        </div>
      )}
    </div>
  );
}
