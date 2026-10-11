// Hook vị trí hiện tại của khách (plan app-ui-integration, T10, D8).
// Gọi services.location.getCurrent() rồi ghi vào store useUserLocation; cũng cho phép chọn khu vực thủ công (C1b).
import { useCallback, useRef, useState } from 'react';
import { AppError } from '@/services/errors';
import { useUserLocation, type LocationSource } from '@/stores/userLocation';
import type { GeoPoint } from '@/types/geo';
import { useServices } from './useServices';

/** Trạng thái lấy vị trí: idle chưa thử, loading đang lấy, denied bị từ chối quyền, error lỗi khác, ready có vị trí. */
export type CurrentLocationStatus = 'idle' | 'loading' | 'denied' | 'error' | 'ready';

export interface CurrentLocation {
  point?: GeoPoint;
  source?: LocationSource;
  status: CurrentLocationStatus;
  /** Lỗi gần nhất (AppError), có khi status là denied hoặc error. */
  error?: AppError;
  /** Lấy vị trí GPS. Khi đang loading, lời gọi thêm bị bỏ qua (chặn gọi chồng). */
  request: () => Promise<void>;
  /** Đặt vị trí thủ công (khu vực dự phòng). */
  setManual: (point: GeoPoint) => void;
}

/** Chuẩn hoá lỗi bắt được về AppError, không để lộ lỗi lạ ra UI. */
function toAppError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('UNKNOWN', 'Không lấy được vị trí, vui lòng thử lại.');
}

export function useCurrentLocation(): CurrentLocation {
  const services = useServices();
  const point = useUserLocation((s) => s.point);
  const source = useUserLocation((s) => s.source);
  const setPoint = useUserLocation((s) => s.setPoint);

  // Đã có vị trí từ trước (cùng phiên) thì bắt đầu ở trạng thái ready.
  const [status, setStatus] = useState<CurrentLocationStatus>(() => (point ? 'ready' : 'idle'));
  const [error, setError] = useState<AppError | undefined>(undefined);
  // Cờ đồng bộ: setState không chặn gọi chồng ngay lập tức, nên dùng ref.
  const inFlight = useRef(false);

  const request = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('loading');
    setError(undefined);
    try {
      const next = await services.location.getCurrent();
      setPoint(next, 'gps');
      setStatus('ready');
    } catch (err) {
      const appError = toAppError(err);
      setError(appError);
      // Không xoá vị trí cũ khi lần lấy mới thất bại: vẫn dùng được nếu còn hợp lệ.
      setStatus(appError.code === 'FORBIDDEN' ? 'denied' : 'error');
    } finally {
      inFlight.current = false;
    }
  }, [services, setPoint]);

  const setManual = useCallback(
    (next: GeoPoint) => {
      setPoint(next, 'manual');
      setError(undefined);
      setStatus('ready');
    },
    [setPoint],
  );

  return { point, source, status, error, request, setManual };
}
