import { useEffect, useMemo, type ReactNode } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { AppHeader, GYMER_TABS, TabBar } from '@/components/ui/layout';
import type { GymerTabKey } from '@/components/ui/layout';
import { ErrorView } from '@/components/app';
import { useAsync, useServices } from '@/hooks';
import { GymerStatusContext, type GymerStatusValue } from '@/hooks/useGymerStatus';

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
  const { data, error, refetch } = useAsync(() => services.profile.getMyStatus(), [services]);

  // Đã tải xong và tài khoản chưa là Gymer. replace để nút Quay lại không đưa người dùng về khu Gymer.
  const isNotGymer = data === null && error === undefined;
  useEffect(() => {
    if (isNotGymer) {
      navigate('/gymer/join', { replace: true });
    }
  }, [isNotGymer, navigate]);

  const statusValue = useMemo<GymerStatusValue | null>(
    () => (data ? { status: data, refresh: refetch } : null),
    [data, refetch],
  );

  // Đã có trạng thái thì giữ nguyên nội dung khi tải lại (refresh), không dựng lại trang.
  if (statusValue) {
    return (
      <GymerStatusContext.Provider value={statusValue}>
        {children}
        <TabBar
          items={GYMER_TABS}
          activeKey={activeKey}
          onChange={(key) => navigate(`/gymer/${key}`)}
        />
      </GymerStatusContext.Provider>
    );
  }

  // Chưa có trạng thái: vẫn có tiêu đề để người dùng biết đang ở trang nào.
  return (
    <Page>
      <AppHeader title={title} data-testid="page-header" />
      {error === undefined ? (
        <p role="status">Đang tải...</p>
      ) : (
        <ErrorView error={error} context="profile" onRetry={refetch} />
      )}
    </Page>
  );
}
