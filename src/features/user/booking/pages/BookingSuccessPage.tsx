// Màn đặt lịch thành công: tóm tắt lượt vừa gửi và hạn phản hồi của Gymer.
import { Page, useNavigate, useParams } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { AppHeader, GButton, KeyValueRow, Notice, Section, SuccessState } from '@/components/ui';
import { useAsync, useServices } from '@/hooks';
import { vi } from '@/i18n';
import { viewableUntilIso } from '@/config/booking';
import { PATHS } from '@/routes/paths';
import { formatVND } from '@/utils/format';
import { formatVNDeadline, formatVNTime, formatVNWeekdayDate } from '@/utils/booking';

export function BookingSuccessPage() {
  const { bookingId = '' } = useParams<{ bookingId: string }>();
  const { bookings } = useServices();
  const navigate = useNavigate();
  const t = vi.booking;
  const th = vi.health;
  const state = useAsync(() => bookings.getMine(bookingId), [bookingId]);

  return (
    <Page>
      <AppHeader title={t.successTitle} data-testid="page-header" />
      <AsyncView state={state}>
        {(b) => (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SuccessState
              title={t.successHeading}
              description={[
                b.expiresAt !== undefined ? t.deadline(formatVNDeadline(b.expiresAt)) : undefined,
                t.successBody,
              ]
                .filter(Boolean)
                .join(' ')}
              actionLabel={t.actionMyBookings}
              onAction={() => navigate(PATHS.myBookings)}
            />
            <Section>
              <KeyValueRow label={t.rowGymer} value={b.gymerName} />
              <KeyValueRow label={t.rowDate} value={formatVNWeekdayDate(b.start)} />
              <KeyValueRow
                label={t.rowTime}
                value={`${formatVNTime(b.start)} – ${formatVNTime(b.end)}`}
              />
              <KeyValueRow label={t.rowPrice} value={formatVND(b.price)} emphasize />
            </Section>
            {b.healthNoteShared !== undefined && (
              <Notice tone="info">
                <p style={{ margin: 0 }} data-testid="health-note-status">
                  {b.healthNoteShared
                    ? th.successShared(
                        b.gymerName,
                        formatVNDeadline(viewableUntilIso(b.end)),
                      )
                    : th.successNotShared(b.gymerName)}
                </p>
              </Notice>
            )}
            <Notice tone="info">
              <p style={{ margin: 0 }}>{t.successPaymentNotice}</p>
            </Notice>
            <GButton kind="ghost" size="lg" fullWidth onClick={() => navigate(PATHS.search)}>
              {t.actionSearch}
            </GButton>
          </div>
        )}
      </AsyncView>
    </Page>
  );
}
