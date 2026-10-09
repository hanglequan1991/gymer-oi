import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/utils/cx';
import './KeyValueRow.css';

/** Props của KeyValueRow. */
export interface KeyValueRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Làm đậm giá trị, ví dụ tổng tiền. */
  emphasize?: boolean;
  /** Gạch ngang giá trị, ví dụ giá gốc đã giảm. */
  strikeValue?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Một hàng nhãn trái (màu phụ) và giá trị phải. */
export function KeyValueRow({
  label,
  value,
  emphasize = false,
  strikeValue = false,
  className,
  style,
  'data-testid': testId,
}: KeyValueRowProps) {
  return (
    <div
      className={cx('gy-kv', emphasize && 'gy-kv--emphasize', className)}
      style={style}
      data-testid={testId}
    >
      <span className="gy-kv__label">{label}</span>
      <span className={cx('gy-kv__value', strikeValue && 'gy-kv__value--strike')}>{value}</span>
    </div>
  );
}

/** Props của KeyValueList. */
export interface KeyValueListProps {
  rows: { label: ReactNode; value: ReactNode }[];
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Nhóm các hàng nhãn-giá trị, dùng thẻ dl để đọc đúng ngữ nghĩa. */
export function KeyValueList({ rows, className, style, 'data-testid': testId }: KeyValueListProps) {
  return (
    <dl className={cx('gy-kv-list', className)} style={style} data-testid={testId}>
      {rows.map((row, index) => (
        <div key={index} className="gy-kv">
          <dt className="gy-kv__label">{row.label}</dt>
          <dd className="gy-kv__value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
