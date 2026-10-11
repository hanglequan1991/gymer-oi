// Cổng đăng nhập toàn màn: chặn nội dung cho tới khi có phiên. Dùng SessionProvider đã bọc phía trên.
// bypass = true (chế độ mock) thì luôn hiện nội dung, vì backend giả không có Zalo.
import type { ReactNode } from 'react';
import { GButton, Notice } from '@/components/ui';
import { useSession } from '@/hooks';
import { messageFromError, vi } from '@/i18n';

export interface AuthGateProps {
  bypass?: boolean;
  children: ReactNode;
}

const FULL_PAGE_STYLE = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 12,
  padding: 16,
} as const;

export function AuthGate({ bypass = false, children }: AuthGateProps) {
  const { state, retry, reauthenticate } = useSession();

  if (bypass || state.status === 'ready') return <>{children}</>;

  if (state.status === 'loading') {
    return (
      <div role="status" style={{ ...FULL_PAGE_STYLE, textAlign: 'center' }}>
        {vi.auth.loading}
      </div>
    );
  }

  // Lỗi: hành động của nút lấy từ trạng thái, không đoán từ mã lỗi tại đây.
  const onAction = state.action === 'relogin' ? reauthenticate : retry;
  const label =
    state.action === 'relogin'
      ? vi.auth.actionRelogin
      : state.action === 'grant'
        ? vi.auth.actionGrant
        : vi.common.retry;

  return (
    <div style={FULL_PAGE_STYLE} data-testid="auth-gate-error">
      <Notice tone="danger" title={vi.auth.errorTitle}>
        {messageFromError(state.error, 'login')}
      </Notice>
      <GButton kind="primary" size="lg" fullWidth onClick={() => void onAction()}>
        {label}
      </GButton>
    </div>
  );
}
