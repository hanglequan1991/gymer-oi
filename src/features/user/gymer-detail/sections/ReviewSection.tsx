// Đánh giá gần đây: mặc định 3 mục, "Xem thêm" mở hết danh sách đã tải.
import { useState } from 'react';
import { GButton, RatingStars, Section } from '@/components/ui';
import { vi } from '@/i18n';
import type { Review } from '@/types/domain';

const RECENT_COUNT = 3;

export interface ReviewSectionProps {
  reviews: Review[];
}

export function ReviewSection({ reviews }: ReviewSectionProps) {
  const t = vi.gymerDetail;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? reviews : reviews.slice(0, RECENT_COUNT);

  return (
    <Section title={t.reviewsTitle}>
      {reviews.length === 0 ? (
        <p style={{ margin: 0 }}>{t.noReviews}</p>
      ) : (
        <>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shown.map((r) => (
              <li key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{r.author}</strong>
                  <span style={{ opacity: 0.7, fontSize: 13 }}>{r.dateLabel}</span>
                </div>
                <RatingStars value={r.rating} size="sm" />
                {r.text.trim().length > 0 && <p style={{ margin: 0 }}>{r.text}</p>}
              </li>
            ))}
          </ul>
          {!expanded && reviews.length > RECENT_COUNT && (
            <div style={{ marginTop: 12 }}>
              <GButton kind="ghost" size="md" fullWidth onClick={() => setExpanded(true)}>
                {t.showMoreReviews}
              </GButton>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
