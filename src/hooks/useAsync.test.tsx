// Kiểm thử useAsync, và các hook/provider lấy services và platform (không có file test riêng trong danh sách T6).
import { cleanup, render, renderHook, screen, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakePlatform } from '@/platform/fake';
import { AppProviders, PlatformProvider, ServicesProvider } from '@/providers';
import { createServices } from '@/services/createServices';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useAsync } from './useAsync';
import { usePlatform } from './usePlatform';
import { useServices } from './useServices';

// setup.ts không bật tự động cleanup của RTL (vitest globals chưa bật), nên dọn thủ công.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Promise có thể resolve/reject từ bên ngoài, để điều khiển thứ tự kết quả. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsync', () => {
  it('ban đầu đang tải và chưa có data', () => {
    const { result } = renderHook(() => useAsync(() => new Promise<number>(() => {}), []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('chuyển từ loading sang data khi thành công', async () => {
    const { result } = renderHook(() => useAsync(async () => 42, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeUndefined();
  });

  it('khi lỗi thì trả error, không có data, loading tắt', async () => {
    const boom = new Error('mất mạng');
    const { result } = renderHook(() => useAsync(() => Promise.reject(boom), []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toBeUndefined();
  });

  it('refetch gọi lại hàm và cập nhật data', async () => {
    let count = 0;
    const { result } = renderHook(() => useAsync(async () => ++count, []));

    await waitFor(() => expect(result.current.data).toBe(1));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(count).toBe(2);
  });

  it('đổi deps thì gọi lại hàm với giá trị mới', async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useAsync(async () => id * 10, [id]),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => expect(result.current.data).toBe(10));
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe(20));
  });

  it('kết quả của lần gọi cũ đến muộn không ghi đè kết quả mới', async () => {
    const calls = [deferred<string>(), deferred<string>()];
    let index = 0;
    const { result } = renderHook(() => useAsync(() => calls[index++].promise, []));

    act(() => result.current.refetch());
    await act(async () => {
      calls[1].resolve('mới');
      await calls[1].promise;
      calls[0].resolve('cũ');
      await calls[0].promise;
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('mới');
  });
});

describe('useServices', () => {
  it('ném lỗi khi dùng ngoài ServicesProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useServices())).toThrow('ServicesProvider');
  });

  it('trả về đúng bộ services được truyền vào ServicesProvider', () => {
    const services = createServices({ dataSource: 'mock' });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );

    const { result } = renderHook(() => useServices(), { wrapper });

    expect(result.current).toBe(services);
  });
});

describe('usePlatform', () => {
  it('ném lỗi khi dùng ngoài PlatformProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => usePlatform())).toThrow('PlatformProvider');
  });

  it('trả về đúng cổng platform được truyền vào PlatformProvider', () => {
    const platform = createFakePlatform();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PlatformProvider platform={platform}>{children}</PlatformProvider>
    );

    const { result } = renderHook(() => usePlatform(), { wrapper });

    expect(result.current).toBe(platform);
  });

  it('PlatformProvider không truyền platform thì vẫn có cổng mặc định', () => {
    const { result } = renderHook(() => usePlatform(), {
      wrapper: ({ children }: { children: ReactNode }) => <PlatformProvider>{children}</PlatformProvider>,
    });

    expect(typeof result.current.storage.get).toBe('function');
    expect(typeof result.current.auth.login).toBe('function');
  });
});

describe('AppProviders và renderWithProviders', () => {
  it('cấp đúng services và platform cho component con', () => {
    const services = createServices({ dataSource: 'mock' });
    const platform = createFakePlatform();

    function Probe() {
      const s = useServices();
      const p = usePlatform();
      return <span>{s === services && p === platform ? 'đúng' : 'sai'}</span>;
    }

    renderWithProviders(<Probe />, { services, platform });

    expect(screen.getByText('đúng')).toBeInTheDocument();
  });

  it('AppProviders không truyền gì vẫn render được con và cấp services mặc định', () => {
    function Probe() {
      const s = useServices();
      return <span>{typeof s.gymers.search === 'function' ? 'có services' : 'thiếu'}</span>;
    }

    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    expect(screen.getByText('có services')).toBeInTheDocument();
  });
});
