import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/utils/cx';
import './EmptyState.css';

/** Props của EmptyState. */
export interface EmptyStateProps {
  /** Tiêu đề ngắn của trạng thái rỗng. */
  title: string;
  /** Mô tả thêm, gợi ý bước tiếp theo. */
  description?: string;
  /** Icon tuỳ chọn; mặc định là icon kính lúp. */
  icon?: ReactNode;
  /** Nút hoặc liên kết hành động; chỉ hiển thị khi truyền vào. */
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

const DEFAULT_ICON = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.3-4.3" />
  </svg>
);

/** Trạng thái rỗng canh giữa: tiêu đề, mô tả, icon và hành động tuỳ chọn. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  style,
  'data-testid': testId,
}: EmptyStateProps) {
  const hasAction = action !== undefined && action !== null && action !== false;

  return (
    <div className={cx('gy-empty', className)} style={style} data-testid={testId}>
      <span className="gy-empty__icon" aria-hidden="true">
        {icon ?? DEFAULT_ICON}
      </span>
      <p className="gy-empty__title">{title}</p>
      {description !== undefined && <p className="gy-empty__description">{description}</p>}
      {hasAction && <div className="gy-empty__action">{action}</div>}
    </div>
  );
}
