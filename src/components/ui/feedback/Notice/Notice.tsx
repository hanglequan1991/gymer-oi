import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/utils/cx';
import './Notice.css';

/** Tông màu của thông báo. */
export type NoticeTone = 'warn' | 'info' | 'danger' | 'ok';

/** Props của Notice. */
export interface NoticeProps {
  /** Tông màu, mặc định warn. Danger dùng role alert, các tông khác dùng role note. */
  tone?: NoticeTone;
  /** Tiêu đề đậm, hiển thị phía trên nội dung. */
  title?: string;
  /** Icon tuỳ chọn; mặc định là icon SVG theo tông. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

const DEFAULT_ICON: Record<NoticeTone, ReactNode> = {
  warn: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  ),
  danger: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  ),
  ok: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  ),
};

/** Khối thông báo nhiều tông màu, có tiêu đề và icon tuỳ chọn. */
export function Notice({
  tone = 'warn',
  title,
  icon,
  children,
  className,
  style,
  'data-testid': testId,
}: NoticeProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cx('gy-notice', `gy-notice--${tone}`, className)}
      style={style}
      data-testid={testId}
    >
      <span className="gy-notice__icon" aria-hidden="true">
        {icon ?? DEFAULT_ICON[tone]}
      </span>
      <div className="gy-notice__content">
        {title !== undefined && <p className="gy-notice__title">{title}</p>}
        <div className="gy-notice__body">{children}</div>
      </div>
    </div>
  );
}
