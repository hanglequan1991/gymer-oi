import { Badge, GAvatar, PriceLabel, RatingStars, STATUS_BADGE, Tag } from '@/components/ui/atoms';
import type { BadgeTone, GAvatarSize } from '@/components/ui/atoms';
import { Section } from '@/components/ui/layout';

const AVATAR_SIZES: GAvatarSize[] = ['sm', 'md', 'lg', 'xl'];

const BADGE_TONES: { tone: BadgeTone; label: string }[] = [
  { tone: 'ok', label: 'Thành công' },
  { tone: 'warn', label: 'Cảnh báo' },
  { tone: 'danger', label: 'Lỗi' },
  { tone: 'info', label: 'Thông tin' },
  { tone: 'neutral', label: 'Trung tính' },
];

/** Các thành phần nhỏ: avatar, badge, tag, sao đánh giá và giá tiền. */
export function AtomsSection() {
  return (
    <Section className="gy-gallery__section" title="Thành phần nhỏ">
      <div className="gy-gallery__stack">
        <h3 className="gy-gallery__sub">GAvatar (4 cỡ, một màu nền)</h3>
        <div className="gy-gallery__row">
          {AVATAR_SIZES.map((size) => (
            <GAvatar key={size} name="Hoàng Nam" size={size} />
          ))}
        </div>
        <h3 className="gy-gallery__sub">GAvatar (ảnh lỗi quay về chữ cái đầu)</h3>
        <div className="gy-gallery__row">
          {/* Đường dẫn không tồn tại để thử nhánh ảnh lỗi. */}
          <GAvatar name="Minh Hà" src="/gallery-missing-avatar.png" size="lg" />
        </div>

        <h3 className="gy-gallery__sub">Badge</h3>
        <div className="gy-gallery__row">
          {BADGE_TONES.map(({ tone, label }) => (
            <Badge key={tone} tone={tone}>
              {label}
            </Badge>
          ))}
        </div>
        <h3 className="gy-gallery__sub">Badge theo trạng thái yêu cầu</h3>
        <div className="gy-gallery__row">
          {Object.entries(STATUS_BADGE).map(([status, { tone, label }]) => (
            <Badge key={status} tone={tone}>
              {label}
            </Badge>
          ))}
        </div>

        <h3 className="gy-gallery__sub">Tag</h3>
        <div className="gy-gallery__row">
          <Tag tone="default">Gym</Tag>
          <Tag tone="primary">Giảm mỡ</Tag>
          <Tag tone="default">Tự khai</Tag>
          <Tag tone="primary" leadingCheck>
            Đã chọn
          </Tag>
        </div>

        <h3 className="gy-gallery__sub">RatingStars</h3>
        <div className="gy-gallery__row">
          <RatingStars value={0} />
          <RatingStars value={3.5} reviewCount={12} />
          <RatingStars value={4.9} reviewCount={38} />
          <RatingStars value={4.9} reviewCount={38} compact />
        </div>

        <h3 className="gy-gallery__sub">PriceLabel</h3>
        <div className="gy-gallery__row">
          <PriceLabel amount={180000} />
          <PriceLabel amount={180000} short />
          <PriceLabel amount={220000} strike />
        </div>
      </div>
    </Section>
  );
}
