// Thông báo lỗi tải dữ liệu kèm nút phù hợp: "Đăng nhập lại" với lỗi phiên, "Thử lại" với lỗi tạm thời.
// Lỗi NOT_FOUND và lỗi nghiệp vụ không có nút (không thử lại được).
import { useEffect, useRef, useState } from 'react';
import { GButton, Notice } from '@/components/ui';
import { useSession } from '@/hooks';
import { isAuthError, isRetryableError, messageFromError, vi, type ErrorContext } from '@/i18n';

export interface ErrorViewProps {
  error: unknown;
  context?: ErrorContext;
  /** Hàm tải lại dữ liệu của màn. Thiếu thì không hiện nút "Thử lại". */
  onRetry?: () => void;
}

export function ErrorView({ error, context, onRetry }: ErrorViewProps) {
  const { reauthenticate } = useSession();
  const [busy, setBusy] = useState(false);
  // Đăng nhập lại thất bại làm AuthGate gỡ màn này: không gọi setBusy trên component đã unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const authError = isAuthError(error);
  const canRetry = !authError && isRetryableError(error) && onRetry !== undefined;

  async function onRelogin() {
    setBusy(true);
    try {
      await reauthenticate();
      if (mountedRef.current) onRetry?.();
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  return (
    <Notice tone="danger" data-testid="error-view">
      <p style={{ margin: 0 }}>{messageFromError(error, context)}</p>
      {authError && (
        <div style={{ marginTop: 8 }}>
          <GButton kind="primary" size="md" loading={busy} onClick={() => void onRelogin()}>
            {vi.auth.actionRelogin}
          </GButton>
        </div>
      )}
      {canRetry && (
        <div style={{ marginTop: 8 }}>
          <GButton kind="primary" size="md" onClick={() => onRetry?.()}>
            {vi.common.retry}
          </GButton>
        </div>
      )}
    </Notice>
  );
}
