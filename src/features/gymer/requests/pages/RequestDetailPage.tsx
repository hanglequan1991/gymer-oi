// Chi tiết một yêu cầu phía Gymer (plan health-consent-ui, A3). Chỉ đọc: không có Xác nhận/Từ chối ở đây.
// Ghi chú sức khoẻ chỉ tải SAU khi tìm thấy yêu cầu, và nằm trong state của component nên mất khi rời trang.
import { Page, useNavigate, useParams } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { Badge, PriceLabel, STATUS_BADGE } from '@/components/ui/atoms';
import { EmptyState, HealthNoteBlock } from '@/components/ui/feedback';
import { AppHeader } from '@/components/ui/layout';
import { useAsync, useServices } from '@/hooks';
import { vi } from '@/i18n';
import { viewableUntilIso } from '@/config/booking';
import { PATHS } from '@/routes/paths';
import type { BookingRequest } from '@/types/domain';
import { formatVNDeadline } from '@/utils/booking';
import { formatTimeRange } from '@/utils/format';
import { GymerTabsLayout } from '../../GymerTabsLayout';

export function RequestDetailPage() {
  const { requestId = '' } = useParams<{ requestId: string }>();
  const services = useServices();
  const navigate = useNavigate();
  const requests = useAsync(() => services.requests.list(), [services]);

  return (
    <GymerTabsLayout activeKey="requests" title={vi.gymerRequests.title}>
      <Page>
        <AppHeader
          title={vi.health.gymerDetailTitle}
          onBack={() => navigate(PATHS.gymerRequests)}
          data-testid="page-header"
        />
        <AsyncView state={requests}>
          {(list) => {
            const request = list.find((r) => r.id === requestId);
            if (request === undefined) {
              return <EmptyState title={vi.health.gymerRequestNotFound} />;
            }
            return <RequestDetailBody key={request.id} request={request} />;
          }}
        </AsyncView>
      </Page>
    </GymerTabsLayout>
  );
}

/** Nội dung chi tiết của một yêu cầu đã tìm thấy. Chỉ mounted khi có yêu cầu, nên ghi chú chỉ tải lúc đó. */
function RequestDetailBody({ request }: { request: BookingRequest }) {
  const services = useServices();
  const t = vi.health;
  const note = useAsync(() => services.requests.getHealthNote(request.id), [services, request.id]);
  const badge = STATUS_BADGE[request.status];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{request.customerName}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </header>
      <p style={{ margin: 0 }}>{formatTimeRange(request.start, request.end)}</p>
      {request.goal ? <p style={{ margin: 0 }}>{`Mục tiêu: ${request.goal}`}</p> : null}
      <PriceLabel amount={request.price} size="sm" />

      {note.loading ? (
        <HealthNoteBlock status="loading" title={t.gymerSectionTitle} loadingLabel={t.gymerLoading} />
      ) : note.error !== undefined ? (
        <HealthNoteBlock
          status="error"
          title={t.gymerSectionTitle}
          errorText={t.gymerLoadError}
          retryLabel={t.gymerRetry}
          onRetry={note.refetch}
        />
      ) : note.data?.status === 'visible' ? (
        <HealthNoteBlock
          status="visible"
          title={t.gymerSectionTitle}
          note={note.data.note}
          badgeLabel={t.gymerSharedBadge}
          viewableText={t.gymerViewableUntil(formatVNDeadline(viewableUntilIso(request.end)))}
          warningText={t.gymerWarning}
        />
      ) : (
        <HealthNoteBlock
          status="hidden"
          title={t.gymerSectionTitle}
          hiddenText={t.gymerHiddenTitle}
          hiddenHint={t.gymerHiddenHint}
        />
      )}
    </div>
  );
}
