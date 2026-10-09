// Gom các Provider của tầng dữ liệu và nền tảng: Platform > Services > children.
// Không chứa App/SnackbarProvider của zmp-ui; các thành phần đó thuộc app.tsx.
import type { ReactNode } from 'react';
import type { Platform } from '@/platform';
import type { Services } from '@/services';
import { PlatformProvider } from './PlatformProvider';
import { ServicesProvider } from './ServicesProvider';

export interface AppProvidersProps {
  /** Bộ services thay thế (test). Không truyền thì dùng mặc định. */
  services?: Services;
  /** Cổng platform thay thế (test). Không truyền thì dùng bản giả. */
  platform?: Platform;
  children: ReactNode;
}

export function AppProviders({ services, platform, children }: AppProvidersProps) {
  return (
    <PlatformProvider platform={platform}>
      <ServicesProvider services={services}>{children}</ServicesProvider>
    </PlatformProvider>
  );
}
