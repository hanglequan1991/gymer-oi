// Hạ tầng test: render một component kèm AppProviders. Mặc định dùng bản giả của platform.
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SnackbarProvider, ZMPRouter } from 'zmp-ui';
import type { Platform } from '@/platform';
import { createFakePlatform } from '@/platform/fake';
import { AppProviders } from '@/providers';
import { SessionContext, type SessionApi } from '@/hooks';
import type { Services } from '@/services';
import { createStubServices } from './stubServices';

/** Phiên giả ở trạng thái đã đăng nhập: màn test không phải chờ đăng nhập Zalo. */
const READY_SESSION: SessionApi = {
  state: { status: 'ready', userId: 'test-user' },
  retry: async () => undefined,
  reauthenticate: async () => undefined,
  signOut: async () => undefined,
};

export interface RenderWithProvidersOptions {
  /** Bộ services thay thế. Không truyền thì dùng mặc định của AppProviders. */
  services?: Services;
  /** Cổng platform thay thế. Không truyền thì dùng bản giả. */
  platform?: Platform;
}

/** Render `ui` bên trong AppProviders để test feature mà không cần Zalo. */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult {
  const { services, platform = createFakePlatform() } = options;
  return render(
    <AppProviders services={services} platform={platform}>
      {ui}
    </AppProviders>,
  );
}

/** Tuỳ chọn của renderPage. */
export interface RenderPageOptions extends RenderWithProvidersOptions {
  /** Đường dẫn ban đầu (ví dụ '/gymer/requests'). Đặt bằng history trước khi render. */
  route?: string;
}

/**
 * Render một trang kèm đủ ngữ cảnh ứng dụng: ZMPRouter, SnackbarProvider (cho useToast) và AppProviders.
 * Mặc định dùng createStubServices() để test không bao giờ chạm Supabase thật.
 * URL được đưa về '/' sau mỗi ca bởi src/test/setup.ts.
 */
export function renderPage(ui: ReactElement, options: RenderPageOptions = {}): RenderResult {
  const { services = createStubServices(), platform = createFakePlatform(), route } = options;
  // ZMPRouter dùng BrowserRouter, đọc URL hiện tại khi mount nên phải đặt trước khi render.
  if (route !== undefined) {
    window.history.pushState({}, '', route);
  }
  return render(
    <ZMPRouter>
      <SnackbarProvider>
        <AppProviders services={services} platform={platform}>
          <SessionContext.Provider value={READY_SESSION}>{ui}</SessionContext.Provider>
        </AppProviders>
      </SnackbarProvider>
    </ZMPRouter>,
  );
}
