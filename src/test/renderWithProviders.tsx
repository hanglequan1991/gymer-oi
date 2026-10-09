// Hạ tầng test: render một component kèm AppProviders. Mặc định dùng bản giả của platform.
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { Platform } from '@/platform';
import { createFakePlatform } from '@/platform/fake';
import { AppProviders } from '@/providers';
import type { Services } from '@/services';

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
