import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/utils/cx';
import './Badge.css';

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  /** Màu theo ngữ nghĩa; mặc định neutral. */
  tone?: BadgeTone;
  /** Biểu tượng đặt trước chữ, trang trí. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Nhãn trạng thái nhỏ. Chữ luôn hiển thị, màu chỉ là phần bổ sung. */
export function Badge({ tone = 'neutral', icon, children, className, style, 'data-testid': testId }: BadgeProps) {
  return (
    <span className={cx('gy-badge', `gy-badge--${tone}`, className)} style={style} data-testid={testId}>
      {icon !== undefined && icon !== null && (
        <span className="gy-badge__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="gy-badge__label">{children}</span>
    </span>
  );
}
