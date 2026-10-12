import { useEffect, useRef, useState } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { ChipGroup, ConfirmDialog, EmptyState, useToast } from '@/components/ui';
import { RequestCard } from '@/components/ui/cards';
import { AppHeader } from '@/components/ui/layout';
import { useAsync, useServices } from '@/hooks';
import { messageFromError, vi } from '@/i18n';
import { gymerRequestDetail } from '@/routes/paths';
import type { BookingRequest, RequestStatus } from '@/types/domain';
import { formatVNTime, formatVNWeekdayDate } from '@/utils/booking';
import { GymerTabsLayout } from '../../GymerTabsLayout';
import { REQUEST_TABS, canGymerCancel, countByStatus, listForTab, withoutStale } from '../requestList';
import { clearRequestsTabIntent, peekRequestsTabIntent } from '../requestsTabIntent';

/**
 * Mã lỗi sau khi bấm Xác nhận/Từ chối/Huỷ buổi mà danh sách đã cũ: yêu cầu đã hết hạn, đã xử lý hoặc không còn.
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
  const navigate = useNavigate();
  const requests = useAsync(() => services.requests.list(), [services]);

  // Chip mở sẵn có thể do Tổng quan truyền sang. Chỉ đọc lúc khởi tạo, xoá ở useEffect bên dưới.
  const [tab, setTab] = useState<RequestStatus>(() => peekRequestsTabIntent() ?? 'pending');
  const [rejectTarget, setRejectTarget] = useState<BookingRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingRequest | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  // Ref chặn bấm đúp đồng bộ. State cập nhật không tức thì nên hai lần bấm sát nhau có thể lọt qua nếu chỉ dựa vào state.
  const inFlight = useRef(new Set<string>());
  const chipsRef = useRef<HTMLDivElement>(null);
  // Đánh dấu cần trả focus về chip sau khi hộp huỷ đóng (thẻ đã huỷ rời DOM nên hộp không tự trả focus được).
  const returnFocusToChip = useRef(false);
  // Sau khi huỷ có tải lại danh sách: AsyncView hiện Loading và gỡ chip, nên chỉ trả focus khi tải xong.
  const awaitingReload = useRef(false);

  useEffect(() => {
    clearRequestsTabIntent();
  }, []);

  useEffect(() => {
    if (cancelTarget !== null || !returnFocusToChip.current) return;
    if (awaitingReload.current) return;
    returnFocusToChip.current = false;
    chipsRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, [cancelTarget]);

  useEffect(() => {
    if (requests.loading || !awaitingReload.current) return;
    awaitingReload.current = false;
    if (!returnFocusToChip.current) return;
    returnFocusToChip.current = false;
    chipsRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, [requests.loading]);

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

  // Hộp huỷ giữ ở trạng thái busy cho tới khi xong, rồi mới đóng (khác hộp Từ chối đóng trước).
  async function cancelBooking(request: BookingRequest) {
    if (inFlight.current.has(request.id)) return;
    inFlight.current.add(request.id);
    setBusyIds(new Set(inFlight.current));
    try {
      await services.requests.cancel(request.id);
      toast.success(vi.gymerRequests.toastCancelled);
      awaitingReload.current = true;
      requests.refetch();
    } catch (err) {
      toast.error(messageFromError(err, 'requestCancel'));
      const code = errorCodeOf(err);
      if (code !== undefined && REFRESH_CODES.has(code)) {
        awaitingReload.current = true;
        requests.refetch();
      }
    } finally {
      inFlight.current.delete(request.id);
      setBusyIds(new Set(inFlight.current));
      returnFocusToChip.current = true;
      setCancelTarget(null);
    }
  }

  return (
    <GymerTabsLayout activeKey="requests" title={vi.gymerRequests.title}>
      <Page>
        <AppHeader title={vi.gymerRequests.title} data-testid="page-header" />
        <AsyncView state={requests}>
          {(list) => {
            // Lọc theo thời điểm render: yêu cầu quá hạn không được đếm và không hiện nút xác nhận/từ chối.
            const now = new Date();
            const visible = withoutStale(list, now);
            const counts = countByStatus(visible);
            const shown = listForTab(visible, tab);
            const empty = vi.gymerRequests.empty[tab];
            return (
              <>
                <div ref={chipsRef}>
                  <ChipGroup
                    aria-label={vi.gymerRequests.tabsLabel}
                    scrollable
                    value={tab}
                    onChange={(value) => setTab(value as RequestStatus)}
                    options={REQUEST_TABS.map((status) => ({
                      value: status,
                      label: vi.gymerRequests.tabWithCount(vi.gymerRequests.tabs[status], counts[status]),
                    }))}
                  />
                </div>
                {shown.length === 0 ? (
                  <EmptyState title={empty.title} description={empty.description} />
                ) : (
                  shown.map((r) => {
                    const isCancelled = r.status === 'cancelled';
                    const cancelable = canGymerCancel(r, now);
                    const showCancel = r.status === 'confirmed' && cancelable;
                    const when = `${formatVNWeekdayDate(r.start)} ${formatVNTime(r.start)}`;
                    let hint: string | undefined;
                    if (isCancelled) hint = vi.gymerRequests.cancelledReopened;
                    else if (r.status === 'confirmed' && !cancelable) hint = vi.gymerRequests.cancelStartedHint;
                    return (
                      <RequestCard
                        key={r.id}
                        request={r}
                        compact
                        busy={busyIds.has(r.id)}
                        onConfirm={() => void respond(r, 'confirmed')}
                        onReject={() => setRejectTarget(r)}
                        onOpen={isCancelled ? undefined : (id) => navigate(gymerRequestDetail(id))}
                        openLabel={isCancelled ? undefined : vi.health.gymerOpenDetail}
                        onCancel={showCancel ? () => setCancelTarget(r) : undefined}
                        cancelLabel={showCancel ? vi.gymerRequests.cancelAction : undefined}
                        cancelAriaLabel={showCancel ? vi.gymerRequests.cancelActionAria(r.customerName, when) : undefined}
                        hint={hint}
                        badgeLabel={isCancelled && r.cancelledBy ? vi.gymerRequests.cancelledBy[r.cancelledBy] : undefined}
                      />
                    );
                  })
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
        <ConfirmDialog
          open={cancelTarget !== null}
          title={cancelTarget ? vi.gymerRequests.cancelTitle(cancelTarget.customerName) : ''}
          confirmLabel={vi.gymerRequests.cancelConfirm}
          cancelLabel={vi.gymerRequests.cancelKeep}
          tone="danger"
          busy={cancelTarget !== null && busyIds.has(cancelTarget.id)}
          onCancel={() => setCancelTarget(null)}
          onConfirm={() => {
            if (cancelTarget) void cancelBooking(cancelTarget);
          }}
        >
          {cancelTarget ? (
            <>
              <p>
                <strong>
                  {vi.gymerRequests.cancelWhen(
                    formatVNWeekdayDate(cancelTarget.start),
                    formatVNTime(cancelTarget.start),
                    formatVNTime(cancelTarget.end),
                  )}
                </strong>
              </p>
              <p>{vi.gymerRequests.cancelBody}</p>
              <p>{vi.gymerRequests.cancelConsequence}</p>
            </>
          ) : null}
        </ConfirmDialog>
      </Page>
    </GymerTabsLayout>
  );
}
