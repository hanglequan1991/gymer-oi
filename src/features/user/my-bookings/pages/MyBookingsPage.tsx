// Lịch của tôi (khách): hai tab Sắp tới và Lịch sử; huỷ lịch qua ConfirmDialog; đánh giá tại chỗ.
import { useState } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { AppHeader, ChipGroup, ConfirmDialog, EmptyState, GButton, useToast } from '@/components/ui';
import { useAsync, useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import type { MyBooking } from '@/types/domain';
import { PATHS, gymerDetail } from '@/routes/paths';
import { isBookingExpired, canCancel, canReview, shouldRefetchAfter, splitBookings, type BookingTab } from '../utils';
import { BookingCard } from '../components/BookingCard';
import { ReviewForm } from '../components/ReviewForm';

const t = vi.myBookings;

export function MyBookingsPage() {
  const { bookings } = useServices();
  const navigate = useNavigate();
  const toast = useToast();
  const state = useAsync(() => bookings.listMine(), []);

  const [tab, setTab] = useState<BookingTab>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<MyBooking | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const now = new Date();

  async function onConfirmCancel() {
    const target = cancelTarget;
    if (target === null) return;
    setCancelBusy(true);
    try {
      await bookings.cancel(target.id);
      setCancelTarget(null);
      toast.success(t.cancelSuccess);
      state.refetch();
    } catch (err) {
      setCancelTarget(null);
      toast.error(messageFromError(err, 'bookingCancel'));
      // Lượt đã đổi trạng thái hoặc không còn là của mình: tải lại để thấy đúng trạng thái.
      if (shouldRefetchAfter(err)) state.refetch();
    } finally {
      setCancelBusy(false);
    }
  }

  async function onSubmitReview(b: MyBooking, input: { rating: number; text: string }) {
    setReviewBusy(true);
    setReviewError(null);
    try {
      // Nhận xét rỗng thì không gửi trường text (server coi là tuỳ chọn).
      await bookings.review(b.id, {
        rating: input.rating,
        ...(input.text === '' ? {} : { text: input.text }),
      });
      setReviewingId(null);
      toast.success(t.reviewSuccess);
      state.refetch();
    } catch (err) {
      const message = messageFromError(err, 'bookingReview');
      if (shouldRefetchAfter(err)) {
        // Lượt không còn đánh giá được: đóng khối đánh giá, báo bằng toast, rồi tải lại.
        setReviewingId(null);
        toast.error(message);
        state.refetch();
      } else {
        setReviewError(message);
      }
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <Page>
      <AppHeader title={t.pageTitle} data-testid="page-header" />
      <AsyncView state={state}>
        {(list) => {
          const { upcoming, history } = splitBookings(list, now);
          const shown = tab === 'upcoming' ? upcoming : history;
          return (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ChipGroup
                aria-label={t.tabGroupLabel}
                options={[
                  { value: 'upcoming', label: t.tabUpcoming },
                  { value: 'history', label: t.tabHistory },
                ]}
                value={tab}
                onChange={(v) => setTab(v === 'history' ? 'history' : 'upcoming')}
              />

              {shown.length === 0 ? (
                <EmptyState
                  title={tab === 'upcoming' ? t.emptyUpcomingTitle : t.emptyHistoryTitle}
                  description={tab === 'upcoming' ? t.emptyUpcomingDescription : t.emptyHistoryDescription}
                  action={
                    tab === 'upcoming' ? (
                      <GButton kind="primary" size="md" onClick={() => navigate(PATHS.search)}>
                        {t.actionFindGymer}
                      </GButton>
                    ) : undefined
                  }
                />
              ) : (
                <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {shown.map((b) => {
                    const reviewOpen = reviewingId === b.id;
                    return (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        status={isBookingExpired(b, now) ? 'expired' : b.status}
                        canCancel={canCancel(b, now)}
                        canReview={canReview(b, now)}
                        reviewOpen={reviewOpen}
                        onOpenGymer={(gymerId) => navigate(gymerDetail(gymerId))}
                        onCancel={setCancelTarget}
                        onReview={(target) => {
                          setReviewError(null);
                          setReviewingId(target.id);
                        }}
                        reviewSlot={
                          reviewOpen ? (
                            <ReviewForm
                              busy={reviewBusy}
                              error={reviewError}
                              onSubmit={(input) => onSubmitReview(b, input)}
                              onClose={() => setReviewingId(null)}
                            />
                          ) : undefined
                        }
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          );
        }}
      </AsyncView>

      <ConfirmDialog
        open={cancelTarget !== null}
        title={t.cancelDialogTitle}
        confirmLabel={t.cancelConfirm}
        cancelLabel={t.cancelKeep}
        tone="danger"
        busy={cancelBusy}
        onConfirm={onConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      >
        {t.cancelDialogBody}
      </ConfirmDialog>
    </Page>
  );
}
