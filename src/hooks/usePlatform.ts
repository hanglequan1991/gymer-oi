// Truy cập cổng platform qua Context. Context đặt ở file này (không ở file Provider) để file Provider chỉ export component.
import { createContext, useContext } from 'react';
import type { Platform } from '@/platform';

/** Context cấp platform. Giá trị null nghĩa là chưa có PlatformProvider bao quanh. */
export const PlatformContext = createContext<Platform | null>(null);

/** Lấy cổng platform hiện tại. Ném lỗi rõ ràng nếu gọi ngoài PlatformProvider. */
export function usePlatform(): Platform {
  const platform = useContext(PlatformContext);
  if (platform === null) {
    throw new Error('usePlatform phải được dùng bên trong PlatformProvider.');
  }
  return platform;
}
