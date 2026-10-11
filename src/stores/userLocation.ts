// Vị trí hiện tại của khách (plan app-ui-integration, T10, D8).
// Chỉ giữ TRONG BỘ NHỚ: không persist, không lưu nativeStorage/localStorage (riêng tư: toạ độ không được lưu).
import { create } from 'zustand';
import type { GeoPoint } from '@/types/geo';

/** Nguồn vị trí: GPS qua Zalo hoặc khu vực người dùng tự chọn (dự phòng, task C1b). */
export type LocationSource = 'gps' | 'manual';

/** Dữ liệu vị trí. Chưa có vị trí thì cả hai trường không xác định. */
export interface UserLocationData {
  point?: GeoPoint;
  source?: LocationSource;
}

export interface UserLocationState extends UserLocationData {
  /** Ghi vị trí và nguồn của nó. */
  setPoint: (point: GeoPoint, source: LocationSource) => void;
  /** Xoá vị trí (ví dụ khi đăng xuất). */
  clear: () => void;
}

export const useUserLocation = create<UserLocationState>()((set) => ({
  setPoint: (point, source) => set({ point, source }),
  clear: () => set({ point: undefined, source: undefined }),
}));
