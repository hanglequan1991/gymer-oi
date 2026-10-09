import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Input } from 'zmp-ui';
import { cx } from '@/utils/cx';
import './PriceInput.css';

export interface PriceInputProps {
  /** Số tiền (đồng) hoặc null khi chưa nhập. */
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  unit?: string;
  placeholder?: string;
  /** Giá trị nhỏ nhất; khi rời ô mà nhỏ hơn thì đặt lại bằng min. */
  min?: number;
  /** Bước gợi ý. Hiện chưa áp dụng (xem báo cáo). */
  step?: number;
  disabled?: boolean;
  error?: string;
}

/** Nhóm chữ số hàng nghìn bằng dấu chấm: 180000 -> "180.000". */
function groupThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Ô nhập giá tiền. Khi đang nhập hiện số thô, khi rời ô hiện có dấu chấm nghìn.
 * Chỉ nhận chữ số; rỗng thì trả về null; không bao giờ trả NaN.
 */
export function PriceInput({
  value,
  onChange,
  label,
  unit = 'đ/buổi',
  placeholder,
  min,
  disabled = false,
  error,
}: PriceInputProps) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;

  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const display = !hasValue
    ? ''
    : focused
      ? String(Math.round(value))
      : groupThousands(value);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (digits === '') {
      onChange(null);
      return;
    }
    const next = Number(digits);
    if (!Number.isSafeInteger(next)) return;
    onChange(next);
  };

  const handleBlur = () => {
    setFocused(false);
    if (hasValue && min !== undefined && value < min) {
      onChange(min);
    }
  };

  return (
    <div className={cx('gy-price-input', error && 'gy-price-input--error', disabled && 'gy-price-input--disabled')}>
      {label && (
        <label className="gy-price-input__label" htmlFor={id}>
          {label}
        </label>
      )}
      <Input
        id={id}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        status={error ? 'error' : undefined}
        inputMode="numeric"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        suffix={<span className="gy-price-input__unit">{unit}</span>}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onChange={handleChange}
      />
      {error && (
        <p id={errorId} className="gy-price-input__error">
          {error}
        </p>
      )}
    </div>
  );
}
