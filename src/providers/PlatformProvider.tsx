// Cấp cổng platform cho cây React. Truyền `platform` để thay thế (test, gallery).
// Mặc định là bản giả: chưa có adapter zmp (src/platform/zmp) ở bước khung. Khi có adapter, mặc định phải chọn theo môi trường.
import { useMemo, type ReactNode } from 'react';
import { PlatformContext } from '@/hooks/usePlatform';
import type { Platform } from '@/platform';
import { createFakePlatform } from '@/platform/fake';

export interface PlatformProviderProps {
  /** Cổng platform thay thế. Nếu không truyền, dùng bản giả mặc định. */
  platform?: Platform;
  children: ReactNode;
}

export function PlatformProvider({ platform, children }: PlatformProviderProps) {
  const fallback = useMemo(() => createFakePlatform(), []);
  return <PlatformContext.Provider value={platform ?? fallback}>{children}</PlatformContext.Provider>;
}
