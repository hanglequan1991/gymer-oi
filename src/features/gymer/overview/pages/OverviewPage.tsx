import { Page, useNavigate } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { EmptyState } from '@/components/ui';
import { GButton } from '@/components/ui/controls';
import { StatCard } from '@/components/ui/cards';
import { Notice } from '@/components/ui/feedback';
import { AppHeader, Section } from '@/components/ui/layout';
import { useAsync, useServices } from '@/hooks';
import { useGymerStatus } from '@/hooks/useGymerStatus';
import { vi } from '@/i18n';
import { PATHS } from '@/routes/paths';
import type { BookingRequest, Gymer } from '@/types/domain';
import { formatVND } from '@/utils/format';
import { GymerTabsLayout } from '../../GymerTabsLayout';
import { buildOverview, vnDateTimeLabel, vnHhmm } from '../overviewModel';
import './OverviewPage.css';

/**
 * Một yêu cầu chờ duyệt, chỉ đọc. Không dùng RequestCard vì thẻ đó luôn hiện nút Xác nhận/Từ chối
 * khi đang chờ; tổng quan chỉ xem, việc duyệt làm ở tab Yêu cầu.
 */
function PendingPreviewItem({ request }: { request: BookingRequest }) {
  return (
    <li className="gy-overview-pending__item" aria-label={vi.gymerOverview.pending.itemLabel(request.customerName)}>
      <div className="gy-overview-pending__who">{request.customerName}</div>
      <div className="gy-overview-pending__meta">
        <time dateTime={request.start}>{vnDateTimeLabel(request.start)}</time>
        <span>{formatVND(request.price)}</span>
      </div>
    </li>
  );
}

function OverviewContent() {
  const services = useServices();
  const navigate = useNavigate();
  const { status } = useGymerStatus();
  const state = useAsync(
    () => Promise.all([services.requests.list(), services.profile.getMine()]),
    [services],
  );

  return (
    <Page>
      <AppHeader title={vi.gymerOverview.title} data-testid="page-header" />
      <AsyncView state={state} context="profile">
        {([list, detail]) => {
          const gymer: Gymer = detail.gymer;
          const summary = buildOverview(list, new Date());
          // Đánh giá chưa có khi reviewCount = 0; không hiển thị 0.0 gây hiểu nhầm.
          const ratingValue =
            gymer.reviewCount === 0
              ? vi.gymerOverview.stats.ratingNone
              : `${gymer.rating.toFixed(1)} (${gymer.reviewCount})`;

          return (
            <>
              <section className="gy-overview-greeting">
                <h2 className="gy-overview-greeting__text">{vi.gymerOverview.greeting(gymer.name)}</h2>
              </section>

              <div className="gy-overview-stats">
                <StatCard
                  value={summary.pendingCount}
                  label={vi.gymerOverview.stats.pending}
                  tone="warn"
                  data-testid="stat-pending"
                />
                <StatCard
                  value={summary.upcomingCount}
                  label={vi.gymerOverview.stats.upcoming}
                  tone="primary"
                  data-testid="stat-upcoming"
                />
                <StatCard
                  value={ratingValue}
                  label={vi.gymerOverview.stats.rating}
                  tone="ok"
                  data-testid="stat-rating"
                />
              </div>

              {!status.isListed && (
                <div className="gy-overview-notice">
                  <Notice tone="warn">
                    <p>{vi.gymerOverview.notices.hidden}</p>
                    <GButton kind="ghost" onClick={() => navigate(PATHS.gymerProfile)}>
                      {vi.gymerOverview.notices.openProfile}
                    </GButton>
                  </Notice>
                </div>
              )}
              {!status.hasLocation && (
                <div className="gy-overview-notice">
                  <Notice tone="warn">
                    <p>{vi.gymerOverview.notices.noLocation}</p>
                    <GButton kind="ghost" onClick={() => navigate(PATHS.gymerProfile)}>
                      {vi.gymerOverview.notices.openProfile}
                    </GButton>
                  </Notice>
                </div>
              )}

              <Section title={vi.gymerOverview.today.title}>
                {summary.today.length === 0 ? (
                  <p className="gy-overview-empty">{vi.gymerOverview.today.empty}</p>
                ) : (
                  <ul className="gy-overview-today">
                    {summary.today.map((b) => (
                      <li key={b.id} className="gy-overview-today__item">
                        <time dateTime={b.start} className="gy-overview-today__time">
                          {vnHhmm(b.start)}
                        </time>
                        <div>
                          <div className="gy-overview-today__name">{b.customerName}</div>
                          {b.goal && <div className="gy-overview-today__goal">{b.goal}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title={vi.gymerOverview.pending.title}
                actionLabel={vi.gymerOverview.pending.viewAll}
                onAction={() => navigate(PATHS.gymerRequests)}
              >
                {summary.pendingPreview.length === 0 ? (
                  <EmptyState title={vi.gymerOverview.pending.empty} />
                ) : (
                  <ul className="gy-overview-pending">
                    {summary.pendingPreview.map((r) => (
                      <PendingPreviewItem key={r.id} request={r} />
                    ))}
                  </ul>
                )}
              </Section>
            </>
          );
        }}
      </AsyncView>
    </Page>
  );
}

export function OverviewPage() {
  return (
    <GymerTabsLayout activeKey="overview" title={vi.gymerOverview.title}>
      <OverviewContent />
    </GymerTabsLayout>
  );
}
