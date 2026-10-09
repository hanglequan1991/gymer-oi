import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/utils/cx';
import './BottomActionBar.css';

/**
 * Chiều cao phần nội dung của BottomActionBar, không tính safe-area.
 * Trang chừa chỗ bằng calc(BOTTOM_ACTION_BAR_HEIGHT px + var(--gy-safe-bottom)).
 * Giá trị 72 trong BottomActionBar.css phải khớp với hằng này.
 */
export const BOTTOM_ACTION_BAR_HEIGHT = 72;

/** Props của BottomActionBar. */
export interface BottomActionBarProps {
  /** Nội dung bên trái, ví dụ giá tiền. */
  children: ReactNode;
  /** Nút hành động bên phải. */
  action: ReactNode;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Thanh hành động cố định ở đáy màn hình, có chừa safe-area iOS. */
export function BottomActionBar({
  children,
  action,
  className,
  style,
  'data-testid': testId,
}: BottomActionBarProps) {
  return (
    <div className={cx('gy-bottom-bar', className)} style={style} data-testid={testId}>
      <div className="gy-bottom-bar__content">{children}</div>
      <div className="gy-bottom-bar__action">{action}</div>
    </div>
  );
}
