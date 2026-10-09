import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

export interface ChipProps {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** 'radio' cho đơn chọn (role radio), 'toggle' cho đa chọn (aria-pressed). */
  mode?: 'radio' | 'toggle';
  size?: 'md' | 'sm';
  className?: string;
}

/** Một chip chọn. Vùng chạm 44px; phần nhìn thấy cao tối thiểu 36px. */
export function Chip({
  selected = false,
  disabled = false,
  onClick,
  children,
  mode = 'toggle',
  size = 'md',
  className,
}: ChipProps) {
  const handleClick = () => {
    if (disabled) return;
    onClick?.();
  };

  const ariaProps =
    mode === 'radio'
      ? { role: 'radio', 'aria-checked': selected }
      : { 'aria-pressed': selected };

  return (
    <button
      type="button"
      className={cx('gy-chip', size === 'sm' && 'gy-chip--sm', selected && 'gy-chip--selected', className)}
      disabled={disabled}
      onClick={handleClick}
      {...ariaProps}
    >
      <span className="gy-chip__body">{children}</span>
    </button>
  );
}
