import type { CSSProperties } from 'react';
import { GAvatar, PriceLabel, RatingStars, Tag } from '@/components/ui/atoms';
import type { Gymer } from '@/types/domain';
import { cx } from '@/utils/cx';
import { formatDistance, genderLabel } from '@/utils/format';
import './GymerCard.css';

/** Dữ liệu tối thiểu của một Gymer để vẽ thẻ. */
export type GymerCardInfo = Pick<
  Gymer,
  'id' | 'name' | 'gender' | 'age' | 'distanceKm' | 'rating' | 'reviewCount' | 'tags' | 'priceWeekday' | 'avatarUrl'
>;

/** Props của GymerCard. */
export interface GymerCardProps {
  gymer: GymerCardInfo;
  /** Gọi khi bấm thẻ, truyền id của Gymer. */
  onClick?: (id: string) => void;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Thẻ Gymer trong danh sách: ảnh, tên, giới tính, tuổi, khoảng cách, đánh giá, nhãn và giá ngày thường. Toàn thẻ là một nút bấm. */
export function GymerCard({ gymer, onClick, className, style, 'data-testid': testId }: GymerCardProps) {
  const meta = `${genderLabel(gymer.gender)} · ${gymer.age} tuổi · cách ${formatDistance(gymer.distanceKm)}`;

  return (
    <button
      type="button"
      className={cx('gy-gymer-card', className)}
      style={style}
      data-testid={testId}
      onClick={() => onClick?.(gymer.id)}
    >
      <GAvatar name={gymer.name} src={gymer.avatarUrl} size="md" className="gy-gymer-card__avatar" />
      <span className="gy-gymer-card__main">
        <span className="gy-gymer-card__name">{gymer.name}</span>
        <span className="gy-gymer-card__meta">{meta}</span>
        <RatingStars value={gymer.rating} reviewCount={gymer.reviewCount} size="sm" compact />
        <span className="gy-gymer-card__tags">
          {gymer.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </span>
      </span>
      <PriceLabel amount={gymer.priceWeekday} short size="sm" className="gy-gymer-card__price" />
    </button>
  );
}
