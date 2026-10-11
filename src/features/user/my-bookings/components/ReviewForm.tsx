// Khối đánh giá mở tại chỗ dưới một lượt đã kết thúc: chọn 1-5 sao, nhận xét tuỳ chọn (<= 500 ký tự).
import { useId, useState } from 'react';
import { GButton, Notice, TextField } from '@/components/ui';
import { vi } from '@/i18n';

const t = vi.myBookings;
const RATINGS = [1, 2, 3, 4, 5] as const;
/** Giới hạn nhận xét, khớp server (create_review). */
const TEXT_MAX = 500;

export interface ReviewFormProps {
  busy: boolean;
  /** Câu lỗi của lần gửi gần nhất; null khi không có lỗi. */
  error: string | null;
  onSubmit(input: { rating: number; text: string }): void;
  onClose(): void;
}

export function ReviewForm({ busy, error, onSubmit, onClose }: ReviewFormProps) {
  const titleId = useId();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  return (
    <section
      aria-labelledby={titleId}
      data-testid="review-form"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}
    >
      <h3 id={titleId} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
        {t.reviewTitle}
      </h3>

      <div role="radiogroup" aria-label={t.ratingGroupLabel} style={{ display: 'flex', gap: 4 }}>
        {RATINGS.map((n) => {
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t.ratingLabel(n)}
              disabled={busy}
              onClick={() => setRating(n)}
              style={{
                minWidth: 44,
                minHeight: 44,
                border: 'none',
                background: 'transparent',
                fontSize: 28,
                lineHeight: 1,
                padding: 0,
                color: n <= rating ? '#f5a524' : '#9ca3af',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              <span aria-hidden="true">{n <= rating ? '★' : '☆'}</span>
            </button>
          );
        })}
      </div>

      <TextField
        label={t.reviewTextLabel}
        optionalLabel={t.reviewOptional}
        value={text}
        onChange={setText}
        placeholder={t.reviewTextPlaceholder}
        helper={t.reviewCounter(text.length, TEXT_MAX)}
        multiline
        rows={3}
        maxLength={TEXT_MAX}
        disabled={busy}
      />

      {error !== null && (
        <Notice tone="danger">
          <p style={{ margin: 0 }}>{error}</p>
        </Notice>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <GButton kind="ghost" size="md" onClick={onClose} disabled={busy}>
          {t.reviewClose}
        </GButton>
        <GButton
          kind="primary"
          size="md"
          fullWidth
          loading={busy}
          disabled={rating === 0 || busy}
          onClick={() => onSubmit({ rating, text: text.trim() })}
        >
          {t.reviewSubmit}
        </GButton>
      </div>
    </section>
  );
}
