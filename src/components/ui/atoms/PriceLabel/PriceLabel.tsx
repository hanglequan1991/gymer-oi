import type { CSSProperties } from 'react';
import { cx } from '@/utils/cx';
import { formatVND, formatVNDShort } from '@/utils/format';
import './PriceLabel.css';

export interface PriceLabelProps {
  /** Số tiền VND, không âm. */
  amount: number;
  /** Hậu tố sau số tiền, mặc định "/buổi". Truyền chuỗi rỗng để ẩn. */
  suffix?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Rút gọn kiểu "180k" thay vì "180.000đ". */
  short?: boolean;
  /** Gạch ngang, dùng cho giá gốc; đọc được là "giá gốc". */
  strike?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Giá tiền VND với hậu tố nhỏ, dùng định dạng từ @/utils/format. */
export function PriceLabel({
  amount,
  suffix = '/buổi',
  size = 'md',
  short = false,
  strike = false,
  className,
  style,
  'data-testid': testId,
}: PriceLabelProps) {
  const amountText = short ? formatVNDShort(amount) : formatVND(amount);
  const fullText = suffix ? `${amountText}${suffix}` : amountText;

  return (
    <span
      role={strike ? 'group' : undefined}
      aria-label={strike ? `Giá gốc ${fullText}` : undefined}
      className={cx('gy-price', `gy-price--${size}`, strike && 'gy-price--strike', className)}
      style={style}
      data-testid={testId}
    >
      <span className="gy-price__amount">{amountText}</span>
      {suffix && <span className="gy-price__suffix">{suffix}</span>}
    </span>
  );
}
