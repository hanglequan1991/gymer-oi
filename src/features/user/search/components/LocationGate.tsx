// Màn xin vị trí khi khách chưa có toạ độ (D8). Thay toàn bộ phần kết quả cho đến khi có vị trí.
import { GButton, Notice } from '@/components/ui';
import type { CurrentLocationStatus } from '@/hooks';
import { messageFromError, vi } from '@/i18n';

export interface LocationGateProps {
  status: CurrentLocationStatus;
  /** Lỗi gần nhất (AppError) khi status là denied hoặc error. */
  error?: unknown;
  onRequest: () => void;
}

export function LocationGate({ status, error, onRequest }: LocationGateProps) {
  const t = vi.location;
  const loading = status === 'loading';
  const failed = status === 'denied' || status === 'error';

  return (
    <div data-testid="location-gate" style={{ padding: 16, display: 'grid', gap: 12 }}>
      {failed && <Notice tone="danger">{messageFromError(error, 'location')}</Notice>}
      <p style={{ margin: 0, fontWeight: 600 }}>{t.gateTitle}</p>
      <p style={{ margin: 0 }}>{t.gateDescription}</p>
      <GButton kind="primary" size="lg" fullWidth loading={loading} disabled={loading} onClick={onRequest}>
        {loading ? t.locatingButton : failed ? t.retryButton : t.allowButton}
      </GButton>
    </div>
  );
}
