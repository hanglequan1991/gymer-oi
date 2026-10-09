import type { CSSProperties } from 'react';
import { useId } from 'react';
import { cx } from '@/utils/cx';
import './RatingStars.css';

export interface RatingStarsProps {
  /** Điểm đánh giá; bị kẹp vào [0, 5]. Sao hiển thị làm tròn tới 0,5. */
  value: number;
  /** Số lượt đánh giá, hiển thị trong ngoặc và đọc trong aria-label khi có. */
  reviewCount?: number;
  size?: 'sm' | 'md';
  /** Hiện số điểm, mặc định true. */
  showNumber?: boolean;
  /** Chỉ một sao kèm số và số lượt: "★ 4.9 (38 đánh giá)". */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

const STAR_PATH =
  'M12 2.5l2.94 6.02 6.64.96-4.8 4.68 1.13 6.6L12 17.5l-5.91 3.26 1.13-6.6-4.8-4.68 6.64-.96L12 2.5z';

function clampValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}

interface StarProps {
  /** Tỉ lệ tô của sao: 0, 0.5 hoặc 1. */
  fill: number;
  clipId: string;
}

function Star({ fill, clipId }: StarProps) {
  return (
    <svg className="gy-rating__star" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="gy-rating__star-base" d={STAR_PATH} />
      {fill > 0 && (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={24 * fill} height="24" />
            </clipPath>
          </defs>
          <path className="gy-rating__star-fill" d={STAR_PATH} clipPath={`url(#${clipId})`} />
        </>
      )}
    </svg>
  );
}

/** Sao đánh giá vẽ bằng SVG, hỗ trợ nửa sao. Phần tử ngoài có aria-label đọc được. */
export function RatingStars({
  value,
  reviewCount,
  size = 'md',
  showNumber = true,
  compact = false,
  className,
  style,
  'data-testid': testId,
}: RatingStarsProps) {
  const uid = useId().replace(/:/g, '');
  const clamped = clampValue(value);
  const half = Math.round(clamped * 2) / 2;
  const starCount = compact ? 1 : 5;
  const fractionFor = (i: number) => (compact ? 1 : Math.min(1, Math.max(0, half - i)));

  const hasCount = reviewCount !== undefined;
  const ariaLabel = `Đánh giá ${clamped.toFixed(1).replace('.', ',')} trên 5${hasCount ? `, ${reviewCount} đánh giá` : ''}`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cx('gy-rating', `gy-rating--${size}`, compact && 'gy-rating--compact', className)}
      style={style}
      data-testid={testId}
    >
      <span className="gy-rating__stars" aria-hidden="true">
        {Array.from({ length: starCount }, (_, i) => (
          <Star key={i} fill={fractionFor(i)} clipId={`${uid}-${i}`} />
        ))}
      </span>
      {showNumber && <span className="gy-rating__value">{clamped.toFixed(1)}</span>}
      {hasCount && <span className="gy-rating__count">({reviewCount} đánh giá)</span>}
    </span>
  );
}
