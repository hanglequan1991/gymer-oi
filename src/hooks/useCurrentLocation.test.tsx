// Kiểm thử hook useCurrentLocation: đổi trạng thái, chặn gọi chồng, ánh xạ lỗi, setManual.
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Services } from '@/services';
import { AppError } from '@/services/errors';
import { useUserLocation } from '@/stores/userLocation';
import { createStubServices } from '@/test/stubServices';
import { ServicesContext } from './useServices';
import { useCurrentLocation } from './useCurrentLocation';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  useUserLocation.getState().clear();
});

/** Bọc hook bằng ServicesContext giả, không cần ServicesProvider đầy đủ. */
function wrapperFor(services: Services) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
  };
}

/** Promise điều khiển từ bên ngoài, để kiểm tra trạng thái loading. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useCurrentLocation', () => {
  it('ban đầu idle khi chưa có vị trí', () => {
    const services = createStubServices();
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    expect(result.current.status).toBe('idle');
    expect(result.current.point).toBeUndefined();
  });

  it('ban đầu ready khi store đã có vị trí trong phiên', () => {
    useUserLocation.getState().setPoint({ lat: 10.777, lng: 106.695 }, 'gps');
    const services = createStubServices();
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    expect(result.current.status).toBe('ready');
    expect(result.current.point).toEqual({ lat: 10.777, lng: 106.695 });
  });

  it('request: chuyển loading rồi ready, ghi store với nguồn gps', async () => {
    const pending = deferred<{ lat: number; lng: number }>();
    const getCurrent = vi.fn(() => pending.promise);
    const services = createStubServices({ location: { getCurrent } });
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    let call!: Promise<void>;
    act(() => {
      call = result.current.request();
    });
    expect(result.current.status).toBe('loading');

    await act(async () => {
      pending.resolve({ lat: 10.777, lng: 106.695 });
      await call;
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.source).toBe('gps');
    expect(result.current.point).toEqual({ lat: 10.777, lng: 106.695 });
    expect(useUserLocation.getState().point).toEqual({ lat: 10.777, lng: 106.695 });
  });

  it('request khi đang loading không gọi getCurrent lần hai', async () => {
    const pending = deferred<{ lat: number; lng: number }>();
    const getCurrent = vi.fn(() => pending.promise);
    const services = createStubServices({ location: { getCurrent } });
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.request();
      second = result.current.request();
    });

    await act(async () => {
      pending.resolve({ lat: 10.777, lng: 106.695 });
      await Promise.all([first, second]);
    });

    expect(getCurrent).toHaveBeenCalledTimes(1);
  });

  it('FORBIDDEN chuyển sang denied và lưu lỗi AppError', async () => {
    const services = createStubServices({
      location: { getCurrent: vi.fn().mockRejectedValue(new AppError('FORBIDDEN', 'từ chối')) },
    });
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.status).toBe('denied');
    expect(result.current.error?.code).toBe('FORBIDDEN');
  });

  it('NETWORK chuyển sang error; request tiếp theo xoá lỗi cũ', async () => {
    const getCurrent = vi
      .fn()
      .mockRejectedValueOnce(new AppError('NETWORK', 'mất mạng'))
      .mockResolvedValueOnce({ lat: 10.777, lng: 106.695 });
    const services = createStubServices({ location: { getCurrent } });
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    await act(async () => {
      await result.current.request();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('NETWORK');

    await act(async () => {
      await result.current.request();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.error).toBeUndefined();
  });

  it('lỗi không phải AppError được chuẩn hoá thành UNKNOWN', async () => {
    const services = createStubServices({
      location: { getCurrent: vi.fn().mockRejectedValue(new TypeError('lạ')) },
    });
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(AppError);
    expect(result.current.error?.code).toBe('UNKNOWN');
  });

  it('lỗi thất bại không xoá vị trí cũ đã có', async () => {
    useUserLocation.getState().setPoint({ lat: 10.777, lng: 106.695 }, 'gps');
    const services = createStubServices({
      location: { getCurrent: vi.fn().mockRejectedValue(new AppError('NETWORK', 'mất mạng')) },
    });
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.point).toEqual({ lat: 10.777, lng: 106.695 });
  });

  it('setManual ghi nguồn manual, chuyển ready và xoá lỗi', async () => {
    const services = createStubServices({
      location: { getCurrent: vi.fn().mockRejectedValue(new AppError('NETWORK', 'mất mạng')) },
    });
    const { result } = renderHook(() => useCurrentLocation(), { wrapper: wrapperFor(services) });

    await act(async () => {
      await result.current.request();
    });
    act(() => {
      result.current.setManual({ lat: 10.8, lng: 106.7 });
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.source).toBe('manual');
    expect(result.current.point).toEqual({ lat: 10.8, lng: 106.7 });
    expect(result.current.error).toBeUndefined();
  });
});
