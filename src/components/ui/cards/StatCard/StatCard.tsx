import type { CSSProperties } from 'react';
import { cx } from '@/utils/cx';
import './StatCard.css';

/** Màu của số liệu: primary, ok (xanh) hoặc warn (cam). */
export type StatTone = 'primary' | 'ok' | 'warn';

/** Props của StatCard. */
export interface StatCardProps {
  value: string | number;
  label: string;
  /** Màu của số liệu, mặc định primary. */
  tone?: StatTone;
  /** Có onClick thì thẻ là nút bấm; không có thì là khối chỉ hiển thị. */
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Thẻ số liệu: số lớn ở trên, nhãn mờ ở dưới. */
export function StatCard({ value, label, tone = 'primary', onClick, className, style, 'data-testid': testId }: StatCardProps) {
  const classes = cx('gy-stat-card', onClick && 'gy-stat-card--action', className);
  const content = (
    <>
      <span className={cx('gy-stat-card__value', `gy-stat-card__value--${tone}`)}>{value}</span>
      <span className="gy-stat-card__label">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} style={style} data-testid={testId} onClick={() => onClick()}>
        {content}
      </button>
    );
  }

  return (
    <div className={classes} style={style} data-testid={testId}>
      {content}
    </div>
  );
}
