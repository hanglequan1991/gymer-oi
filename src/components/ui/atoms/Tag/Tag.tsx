import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/utils/cx';
import './Tag.css';

export type TagTone = 'default' | 'primary' | 'ok';

export interface TagProps {
  /** Màu nền và chữ; mặc định default. */
  tone?: TagTone;
  /** Vẽ dấu tích trước chữ, dùng cho nhãn đã chọn hoặc đã xác nhận. */
  leadingCheck?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Thẻ nhãn nhỏ bo tròn, chỉ hiển thị. */
export function Tag({ tone = 'default', leadingCheck = false, children, className, style, 'data-testid': testId }: TagProps) {
  return (
    <span className={cx('gy-tag', `gy-tag--${tone}`, className)} style={style} data-testid={testId}>
      {leadingCheck && (
        <svg
          className="gy-tag__check"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3.5 8.5l3 3 6-6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {children}
    </span>
  );
}
