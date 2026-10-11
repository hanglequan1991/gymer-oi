// Đầu hồ sơ: avatar, tên, giới tính, tuổi, khu vực và đánh giá tổng. Không hiện khoảng cách (chỉ dùng ở tìm kiếm).
import { GAvatar, RatingStars } from '@/components/ui';
import { vi } from '@/i18n';
import type { Gymer } from '@/types/domain';
import { genderLabel } from '@/utils/format';

export interface GymerHeaderProps {
  gymer: Gymer;
}

export function GymerHeader({ gymer }: GymerHeaderProps) {
  const t = vi.gymerDetail;
  return (
    <section style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16 }} aria-labelledby="gymer-name">
      <GAvatar name={gymer.name} src={gymer.avatarUrl} size="xl" />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 id="gymer-name" style={{ margin: 0, fontSize: 20 }}>
          {gymer.name}
        </h2>
        <p style={{ margin: 0 }}>{`${genderLabel(gymer.gender)}, ${t.ageYears(gymer.age)}`}</p>
        <p style={{ margin: 0 }}>{`${t.areaLabel}: ${gymer.area}`}</p>
        {gymer.reviewCount > 0 ? (
          <RatingStars value={gymer.rating} reviewCount={gymer.reviewCount} size="sm" />
        ) : (
          <p style={{ margin: 0 }}>{t.noReviewsYet}</p>
        )}
      </div>
    </section>
  );
}
