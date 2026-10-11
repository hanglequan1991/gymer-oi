import { useRef, useState } from 'react';
import { GButton } from '@/components/ui/controls';
import { Notice, useToast } from '@/components/ui/feedback';
import { Section } from '@/components/ui/layout';
import { useServices } from '@/hooks';
import { useGymerStatus } from '@/hooks/useGymerStatus';
import { messageFromError, vi } from '@/i18n';
import type { GeoPoint } from '@/types/geo';

/**
 * Lỗi có mã (AppError). Không import isAppError từ @/services (ESLint chặn trong features),
 * nên đọc thuộc tính code theo kiểu duck typing.
 */
function errorCodeOf(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
}

/**
 * Vị trí phòng tập của Gymer: lấy vị trí hiện tại qua services.location, rồi lưu qua profile.setLocation.
 * Toạ độ chỉ đi qua biến cục bộ, KHÔNG hiện ra giao diện, không ghi vào storage.
 */
export function LocationSection() {
  const services = useServices();
  const toast = useToast();
  const { status, refresh } = useGymerStatus();
  const [busy, setBusy] = useState(false);
  // Từ chối quyền vị trí hiện ngay trong mục (kèm nút thử lại), vì người dùng cần đi cấp quyền.
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);
  // Cờ đồng bộ chặn bấm đúp: setState chưa kịp cập nhật giữa hai lần bấm liên tiếp.
  const inFlight = useRef(false);

  /** Lấy toạ độ từ thiết bị. Lỗi đã được báo trong hàm này; trả null khi không có toạ độ. */
  const fetchPoint = async (): Promise<GeoPoint | null> => {
    try {
      return await services.location.getCurrent();
    } catch (e) {
      if (errorCodeOf(e) === 'FORBIDDEN') {
        setDeniedMessage(messageFromError(e, 'location'));
      } else {
        toast.error(messageFromError(e, 'location'));
      }
      return null;
    }
  };

  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setDeniedMessage(null);
    try {
      const point = await fetchPoint();
      if (!point) return;
      // Lỗi lưu dùng ngữ cảnh hồ sơ, khác với lỗi lấy vị trí.
      try {
        await services.profile.setLocation(point);
      } catch (e) {
        toast.error(messageFromError(e, 'profile'));
        return;
      }
      toast.success(vi.gymerProfile.location.saved);
      // Tải lại trạng thái để công tắc Hiển thị được mở khoá.
      refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const t = vi.gymerProfile.location;

  return (
    <Section title={t.title} data-testid="profile-location">
      <Notice tone="warn" title={t.warnTitle}>
        {t.warnBody}
      </Notice>
      <p style={{ margin: '12px 0' }} role="status">
        {status.hasLocation ? t.statusSet : t.statusUnset}
      </p>
      {deniedMessage && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <Notice tone="danger">{deniedMessage}</Notice>
          <GButton kind="secondary" fullWidth disabled={busy} onClick={() => void save()}>
            {t.deniedRetry}
          </GButton>
        </div>
      )}
      <GButton
        kind={status.hasLocation ? 'secondary' : 'primary'}
        fullWidth
        loading={busy}
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? t.locating : status.hasLocation ? t.resetButton : t.setButton}
      </GButton>
    </Section>
  );
}
