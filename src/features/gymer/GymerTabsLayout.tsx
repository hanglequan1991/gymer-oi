import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { AppHeader, GYMER_TABS, TabBar } from '@/components/ui/layout';
import type { GymerTabKey } from '@/components/ui/layout';
import { ErrorView } from '@/components/app';
import { useToast } from '@/components/ui';
import { useAsync, useServices } from '@/hooks';
import { GymerStatusContext, type GymerStatusValue } from '@/hooks/useGymerStatus';
import { messageFromError, vi } from '@/i18n';
import { PATHS } from '@/routes/paths';
import type { GymerAccountStatus } from '@/types/domain';

export interface GymerTabsLayoutProps {
  /** Tab đang hiển thị. */
  activeKey: GymerTabKey;
  /** Tiêu đề của trang, dùng cho thanh tiêu đề tạm khi đang tải hoặc lỗi. */
  title: string;
  children: ReactNode;
}

/**
 * Khung chung của 4 tab Gymer, đồng thời là guard khu `/gymer/*` (D14).
 * Tài khoản chưa là Gymer (getMyStatus trả null) bị chuyển sang trang đăng ký.
 * Chỉ là lớp UX: quyền thật do RLS phía server quyết định.
 */
export function GymerTabsLayout({ activeKey, title, children }: GymerTabsLayoutProps) {
  const navigate = useNavigate();
  const services = useServices();
  const toast = useToast();
  const { data, error, refetch } = useAsync(() => services.profile.getMyStatus(), [services]);

  // Bản trạng thái thành công gần nhất. Khi làm mới lỗi, useAsync xoá data, nhưng trang vẫn giữ bản này.
  const lastKnownRef = useRef<GymerAccountStatus | null>(null);
  if (data) lastKnownRef.current = data;
  // data === null nghĩa là chưa là Gymer (không phải đang thiếu dữ liệu), nên chỉ fallback khi data là undefined.
  const status = data !== undefined ? data : lastKnownRef.current;

  // Đã tải xong và tài khoản chưa là Gymer. replace để nút Quay lại không đưa người dùng về khu Gymer.
  const isNotGymer = data === null && error === undefined;
  useEffect(() => {
    if (isNotGymer) {
      navigate(PATHS.gymerJoin, { replace: true });
    }
  }, [isNotGymer, navigate]);

  // Làm mới lỗi khi đã có trạng thái: giữ trang, chỉ báo bằng toast. Lỗi lần đầu vẫn hiện ErrorView.
  useEffect(() => {
    if (error !== undefined && lastKnownRef.current !== null) {
      toast.error(messageFromError(error, 'profile'));
    }
    // Chỉ phản ứng khi có lỗi mới; toast ổn định theo vòng đời của provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const statusValue = useMemo<GymerStatusValue | null>(
    () => (status ? { status, refresh: refetch } : null),
    [status, refetch],
  );

  // Đã có trạng thái thì giữ nguyên nội dung khi tải lại (refresh), không dựng lại trang.
  if (statusValue) {
    return (
      <GymerStatusContext.Provider value={statusValue}>
        {children}
        <TabBar
          items={GYMER_TABS}
          activeKey={activeKey}
          onChange={(key) => navigate(`${PATHS.gymerRoot}/${key}`)}
        />
      </GymerStatusContext.Provider>
    );
  }

  // Chưa có trạng thái: vẫn có tiêu đề để người dùng biết đang ở trang nào.
  return (
    <Page>
      <AppHeader title={title} data-testid="page-header" />
      {error === undefined ? (
        <p role="status">{vi.common.loading}</p>
      ) : (
        <ErrorView error={error} context="profile" onRetry={refetch} />
      )}
    </Page>
  );
}
