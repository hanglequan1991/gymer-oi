// Nội dung màn xác nhận đặt lịch: tóm tắt, ô nhập tuỳ chọn, và nút gửi có chống bấm đúp.
import { useRef, useState } from 'react';
import { useNavigate } from 'zmp-ui';
import { AsyncView, ErrorView } from '@/components/app';
import {
  BottomActionBar,
  GButton,
  KeyValueRow,
  Notice,
  Section,
  TextField,
} from '@/components/ui';
import { useAsync, useServices } from '@/hooks';
import { isAuthError, isRetryableError, messageFromError, vi } from '@/i18n';
import { PATHS, bookingSuccess, gymerDetail } from '@/routes/paths';
import { useBookingDraft } from '@/stores';
import { formatVND } from '@/utils/format';
import { formatVNTime, formatVNWeekdayDate } from '@/utils/booking';
import { HEALTH_NOTE_FIELD_ENABLED } from './config';
import { errorCodeOf, findSubmittedMatch, parseDateIso, priceOfDay, type ReadyDraft } from './utils';

const GOAL_MAX = 200;
const HEALTH_NOTE_MAX = 1000;

/** Phản hồi sau một lần gửi thất bại, hiển thị ngay dưới nội dung đã nhập. */
type Feedback =
  | { type: 'error'; error: unknown }
  | { type: 'priceChanged'; oldPrice: number; newPrice: number }
  | { type: 'priceRefreshFailed' };

export interface BookingConfirmBodyProps {
  draft: ReadyDraft;
  /** Gọi đúng lúc đặt xong, trước khi xoá nháp, để trang cha không chuyển hướng về chi tiết Gymer. */
  onCompleted?: () => void;
}

export function BookingConfirmBody({ draft, onCompleted }: BookingConfirmBodyProps) {
  const { gymers, schedule, bookings } = useServices();
  const navigate = useNavigate();
  const t = vi.booking;
  const { gymerId, dateIso, startIso, endIso } = draft;

  // Nội dung nhập nằm ở đây (ngoài AsyncView) để không mất khi màn tải lại; không lưu ra storage.
  const [goal, setGoal] = useState('');
  const [healthNote, setHealthNote] = useState('');
  const [priceOverride, setPriceOverride] = useState<number | undefined>(undefined);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Sau lỗi mạng, lần gửi tiếp theo phải đối chiếu listMine trước để tránh tạo lượt trùng.
  const [needsRecheck, setNeedsRecheck] = useState(false);
  // Cờ ref chặn bấm đúp ngay trong cùng một lượt xử lý, trước khi React kịp cập nhật state.
  const submittingRef = useRef(false);

  const state = useAsync(async () => {
    const { year, month } = parseDateIso(dateIso);
    const [detail, days] = await Promise.all([
      gymers.getDetail(gymerId),
      schedule.getMonth(gymerId, year, month),
    ]);
    return { gymer: detail.gymer, price: priceOfDay(days, dateIso) };
  }, [gymerId, dateIso]);

  /**
   * Chuyển sang màn thành công rồi mới xoá nháp. Báo trang cha trước (đồng bộ) để effect chuyển hướng
   * của trang đó bỏ qua khi nháp bị xoá, tránh ghi đè màn thành công.
   */
  function finish(bookingId: string) {
    onCompleted?.();
    navigate(bookingSuccess(bookingId), { replace: true });
    useBookingDraft.getState().clear();
  }

  async function refreshPrice(oldPrice: number) {
    try {
      const { year, month } = parseDateIso(dateIso);
      const days = await schedule.getMonth(gymerId, year, month);
      const newPrice = priceOfDay(days, dateIso);
      if (newPrice === undefined) {
        setFeedback({ type: 'priceRefreshFailed' });
        return;
      }
      setPriceOverride(newPrice);
      setFeedback({ type: 'priceChanged', oldPrice, newPrice });
    } catch {
      setFeedback({ type: 'priceRefreshFailed' });
    }
  }

  async function onSubmit(price: number) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (needsRecheck) {
        const mine = await bookings.listMine();
        const submitted = findSubmittedMatch(mine, gymerId, startIso);
        if (submitted) {
          finish(submitted.id);
          return;
        }
      }
      const { bookingId } = await bookings.create({
        gymerId,
        startIso,
        endIso,
        goal: goal.trim() || undefined,
        // Ô ghi chú sức khoẻ chỉ gửi khi ô đang bật; nội dung không bao giờ được chia sẻ (shareHealthNote: false).
        note: HEALTH_NOTE_FIELD_ENABLED ? healthNote.trim() || undefined : undefined,
        expectedPrice: price,
        shareHealthNote: false,
      });
      setNeedsRecheck(false);
      finish(bookingId);
    } catch (err) {
      const code = errorCodeOf(err);
      if (isRetryableError(err)) setNeedsRecheck(true);
      if (code === 'PRICE_CHANGED') {
        // Không tự gửi lại: người dùng xem giá mới rồi bấm gửi lần nữa.
        await refreshPrice(price);
      } else {
        setFeedback({ type: 'error', error: err });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function onPickOtherSlot() {
    useBookingDraft.getState().setDraft({ slotId: undefined });
    navigate(gymerDetail(gymerId), { replace: true });
  }

  return (
    <AsyncView state={state} context="bookingCreate">
      {(data) => {
        const price = priceOverride ?? data.price;
        const canSubmit = price !== undefined && !submitting;
        return (
          <>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Section>
                <KeyValueRow label={t.rowGymer} value={data.gymer.name} />
                <KeyValueRow label={t.rowDate} value={formatVNWeekdayDate(startIso)} />
                <KeyValueRow
                  label={t.rowTime}
                  value={`${formatVNTime(startIso)} – ${formatVNTime(endIso)}`}
                />
                <KeyValueRow label={t.rowDuration} value={t.durationValue} />
                <KeyValueRow
                  label={t.rowPrice}
                  value={price !== undefined ? formatVND(price) : '—'}
                  emphasize
                />
              </Section>

              <Section>
                <TextField
                  label={t.goalLabel}
                  value={goal}
                  onChange={setGoal}
                  placeholder={t.goalPlaceholder}
                  multiline
                  rows={2}
                  maxLength={GOAL_MAX}
                  helper={t.goalCounter(goal.length, GOAL_MAX)}
                  optionalLabel={t.optionalLabel}
                />
                {HEALTH_NOTE_FIELD_ENABLED && (
                  <TextField
                    label={t.healthLabel}
                    value={healthNote}
                    onChange={setHealthNote}
                    placeholder={t.healthPlaceholder}
                    multiline
                    rows={2}
                    maxLength={HEALTH_NOTE_MAX}
                    helper={t.healthNotShared}
                    optionalLabel={t.optionalLabel}
                  />
                )}
              </Section>

              <Notice tone="info">
                <p style={{ margin: 0 }}>{t.paymentNotice}</p>
              </Notice>

              {price === undefined && <Notice tone="warn">{t.noPrice}</Notice>}
              {feedback !== null && renderFeedback(feedback, price)}
            </div>

            <BottomActionBar
              action={
                <GButton
                  kind="primary"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  disabled={!canSubmit}
                  onClick={() => {
                    if (price !== undefined) void onSubmit(price);
                  }}
                >
                  {t.submitLabel}
                </GButton>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <b>{price !== undefined ? formatVND(price) : '—'}</b>
                <span>{t.unpaidHint}</span>
              </div>
            </BottomActionBar>
          </>
        );
      }}
    </AsyncView>
  );

  function renderFeedback(f: Feedback, price: number | undefined) {
    if (f.type === 'priceChanged') {
      return (
        <Notice tone="warn">
          <p style={{ margin: 0 }}>{t.priceChanged(formatVND(f.oldPrice), formatVND(f.newPrice))}</p>
        </Notice>
      );
    }
    if (f.type === 'priceRefreshFailed') {
      return (
        <Notice tone="danger">
          <p style={{ margin: 0 }}>{t.priceRefreshFailed}</p>
        </Notice>
      );
    }
    const { error } = f;
    const code = errorCodeOf(error);
    if (isAuthError(error)) {
      return <ErrorView error={error} context="bookingCreate" />;
    }
    return (
      <Notice tone="danger">
        <p style={{ margin: 0 }}>{messageFromError(error, 'bookingCreate')}</p>
        {(code === 'SLOT_TAKEN' || code === 'SLOT_NOT_OPEN') && (
          <div style={{ marginTop: 8 }}>
            <GButton kind="primary" size="md" onClick={onPickOtherSlot}>
              {t.slotTakenAction}
            </GButton>
          </div>
        )}
        {code === 'LIMIT_REACHED' && (
          <div style={{ marginTop: 8 }}>
            <GButton kind="secondary" size="md" onClick={() => navigate(PATHS.myBookings)}>
              {t.limitAction}
            </GButton>
          </div>
        )}
        {isRetryableError(error) && (
          <div style={{ marginTop: 8 }}>
            <GButton
              kind="primary"
              size="md"
              onClick={() => {
                if (price !== undefined) void onSubmit(price);
              }}
            >
              {vi.common.retry}
            </GButton>
          </div>
        )}
      </Notice>
    );
  }
}
