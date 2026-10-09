import type { MouseEvent, ReactNode } from 'react';
import { Button } from 'zmp-ui';
import { cx } from '@/utils/cx';
import './GButton.css';

export type GButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger-ghost' | 'danger';

export interface GButtonProps {
  /** Kiểu nút; ánh xạ sang variant/type của zmp-ui. */
  kind?: GButtonKind;
  /** Đang xử lý: hiện spinner và chặn click. */
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
  leftIcon?: ReactNode;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  htmlType?: 'button' | 'submit' | 'reset';
  className?: string;
  'aria-label'?: string;
}

interface ButtonMapping {
  variant: 'primary' | 'secondary' | 'tertiary';
  type: 'highlight' | 'danger';
}

const KIND_MAP: Record<GButtonKind, ButtonMapping> = {
  primary: { variant: 'primary', type: 'highlight' },
  secondary: { variant: 'secondary', type: 'highlight' },
  ghost: { variant: 'tertiary', type: 'highlight' },
  'danger-ghost': { variant: 'tertiary', type: 'danger' },
  danger: { variant: 'primary', type: 'danger' },
};

/** Nút bấm của Gymer ơi, bọc zmp-ui Button. Loading hoặc disabled thì không gọi onClick. */
export function GButton({
  kind = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  size = 'md',
  leftIcon,
  children,
  onClick,
  htmlType = 'button',
  className,
  'aria-label': ariaLabel,
}: GButtonProps) {
  const mapping = KIND_MAP[kind];

  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (loading || disabled) return;
    onClick?.(e);
  };

  return (
    <Button
      className={cx('gy-btn', className)}
      variant={mapping.variant}
      type={mapping.type}
      size={size === 'lg' ? 'large' : 'medium'}
      fullWidth={fullWidth}
      loading={loading}
      disabled={disabled}
      prefixIcon={leftIcon}
      htmlType={htmlType}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      {children}
    </Button>
  );
}
