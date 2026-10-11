import { useRef, useState } from 'react';
import { Page } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { ChipGroup, ConfirmDialog, EmptyState, useToast } from '@/components/ui';
import { RequestCard } from '@/components/ui/cards';
import { AppHeader } from '@/components/ui/layout';
import { useAsync, useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import type { BookingRequest, RequestStatus } from '@/types/domain';
import { GymerTabsLayout } from '../../GymerTabsLayout';
import { REQUEST_TABS, countByStatus, listForTab } from '../requestList';

/**
 * Mã lỗi sau khi bấm Xác nhận/Từ chối mà danh sách đã cũ: yêu cầu đã hết hạn, đã xử lý hoặc không còn.
 * Với các mã này phải tải lại để thẻ hiện trạng thái thật.
 */
const REFRESH_CODES: ReadonlySet<string> = new Set(['FORBIDDEN', 'BOOKING_EXPIRED', 'NOT_FOUND']);

/**
 * Đọc mã lỗi của AppError. Feature không được import @/services, nên đọc trường `code` trực tiếp.
 * Lỗi không có mã thì trả undefined và không tải lại.
 */
function errorCodeOf(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function RequestsPage() {
  const services = useServices();
  const toast = useToast();
  const requests = useAsync(() => services.requests.list(), [services]);

  const [tab, setTab] = useState<RequestStatus>('pending');
  const [rejectTarget, setRejectTarget] = useState<BookingRequest | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  // Ref chặn bấm đúp đồng bộ. State cập nhật không tức thì nên hai lần bấm sát nhau có thể lọt qua nếu chỉ dựa vào state.
  const inFlight = useRef(new Set<string>());

  async function respond(request: BookingRequest, decision: 'confirmed' | 'rejected') {
    if (inFlight.current.has(request.id)) return;
    inFlight.current.add(request.id);
    setBusyIds(new Set(inFlight.current));
    try {
      await services.requests.respond(request.id, decision);
      toast.success(decision === 'confirmed' ? vi.gymerRequests.toastConfirmed : vi.gymerRequests.toastRejected);
      requests.refetch();
    } catch (err) {
      toast.error(messageFromError(err, 'requestRespond'));
      const code = errorCodeOf(err);
      if (code !== undefined && REFRESH_CODES.has(code)) requests.refetch();
    } finally {
      inFlight.current.delete(request.id);
      setBusyIds(new Set(inFlight.current));
    }
  }

  return (
    <GymerTabsLayout activeKey="requests" title={vi.gymerRequests.title}>
      <Page>
        <AppHeader title={vi.gymerRequests.title} data-testid="page-header" />
        <AsyncView state={requests}>
          {(list) => {
            const counts = countByStatus(list);
            const shown = listForTab(list, tab);
            const empty = vi.gymerRequests.empty[tab];
            return (
              <>
                <ChipGroup
                  aria-label={vi.gymerRequests.tabsLabel}
                  value={tab}
                  onChange={(value) => setTab(value as RequestStatus)}
                  options={REQUEST_TABS.map((status) => ({
                    value: status,
                    label: vi.gymerRequests.tabWithCount(vi.gymerRequests.tabs[status], counts[status]),
                  }))}
                />
                {shown.length === 0 ? (
                  <EmptyState title={empty.title} description={empty.description} />
                ) : (
                  shown.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      compact
                      busy={busyIds.has(r.id)}
                      onConfirm={() => void respond(r, 'confirmed')}
                      onReject={() => setRejectTarget(r)}
                    />
                  ))
                )}
              </>
            );
          }}
        </AsyncView>
        <ConfirmDialog
          open={rejectTarget !== null}
          title={vi.gymerRequests.rejectTitle}
          confirmLabel={vi.gymerRequests.rejectConfirm}
          cancelLabel={vi.gymerRequests.rejectCancel}
          tone="danger"
          onCancel={() => setRejectTarget(null)}
          onConfirm={() => {
            const target = rejectTarget;
            setRejectTarget(null);
            if (target) void respond(target, 'rejected');
          }}
        />
      </Page>
    </GymerTabsLayout>
  );
}
