import { App, SnackbarProvider } from 'zmp-ui';
import 'zmp-ui/zaui.css';
import '@/styles/index.css';
import { env } from '@/config';
import type { Platform } from '@/platform';
import { createFakePlatform } from '@/platform/fake';
import { createZmpPlatform } from '@/platform/zmp';
import { AppProviders } from '@/providers';
import { AppRoutes } from '@/routes';

// Chọn cổng platform theo môi trường, một lần khi module nạp (không tạo lại mỗi lần render).
// Không import zmp-sdk trực tiếp ở đây; việc đó thuộc src/platform/zmp.
const platform: Platform = env.dataSource === 'mock' ? createFakePlatform() : createZmpPlatform();

export default function AppShell() {
  return (
    <App>
      <SnackbarProvider>
        <AppProviders platform={platform}>
          <AppRoutes />
        </AppProviders>
      </SnackbarProvider>
    </App>
  );
}
