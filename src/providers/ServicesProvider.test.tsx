// Kiểm thử ServicesProvider: không ném lỗi khi thiếu PlatformProvider; lấy storage/auth từ PlatformContext; tạo một lần.
import { render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformContext } from '@/hooks/usePlatform';
import { ServicesContext } from '@/hooks/useServices';
import type { Platform } from '@/platform';
import { createServices } from '@/services/createServices';
import { ServicesProvider } from './ServicesProvider';

vi.mock('@/services/createServices', () => ({
  createServices: vi.fn(() => ({ marker: 'default-services' })),
}));

function Probe() {
  const services = useContext(ServicesContext);
  return <p>{services ? (services as unknown as { marker: string }).marker : 'không có services'}</p>;
}

function fakePlatform(): Platform {
  return {
    auth: { login: vi.fn(), getProfile: vi.fn() },
    location: { getLocation: vi.fn() },
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  } as unknown as Platform;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ServicesProvider', () => {
  it('không ném lỗi khi thiếu PlatformProvider và truyền storage/auth là undefined', () => {
    render(
      <ServicesProvider>
        <Probe />
      </ServicesProvider>,
    );

    expect(screen.getByText('default-services')).toBeTruthy();
    expect(createServices).toHaveBeenCalledWith(expect.anything(), { storage: undefined, auth: undefined });
  });

  it('lấy storage và auth từ PlatformContext', () => {
    const platform = fakePlatform();
    render(
      <PlatformContext.Provider value={platform}>
        <ServicesProvider>
          <Probe />
        </ServicesProvider>
      </PlatformContext.Provider>,
    );

    expect(createServices).toHaveBeenCalledWith(expect.anything(), { storage: platform.storage, auth: platform.auth });
  });

  it('tạo services một lần khi render lại với cùng platform', () => {
    const platform = fakePlatform();
    const tree = (
      <PlatformContext.Provider value={platform}>
        <ServicesProvider>
          <Probe />
        </ServicesProvider>
      </PlatformContext.Provider>
    );
    const { rerender } = render(tree);
    rerender(tree);

    expect(createServices).toHaveBeenCalledTimes(1);
  });

  it('dùng services truyền vào thay cho bản mặc định', () => {
    const custom = { marker: 'custom' } as never;
    render(
      <ServicesProvider services={custom}>
        <Probe />
      </ServicesProvider>,
    );

    expect(screen.getByText('custom')).toBeTruthy();
  });

  it('không gọi createServices khi đã truyền services', () => {
    const custom = { marker: 'custom' } as never;
    render(
      <ServicesProvider services={custom}>
        <Probe />
      </ServicesProvider>,
    );

    expect(createServices).not.toHaveBeenCalled();
  });
});
