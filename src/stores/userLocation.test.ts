// Kiểm thử store vị trí: chỉ trong bộ nhớ, không ghi ra bất kỳ storage nào.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useUserLocation } from './userLocation';

beforeEach(() => {
  useUserLocation.getState().clear();
});

afterEach(() => {
  useUserLocation.getState().clear();
});

describe('useUserLocation', () => {
  it('ban đầu chưa có vị trí', () => {
    const state = useUserLocation.getState();

    expect(state.point).toBeUndefined();
    expect(state.source).toBeUndefined();
  });

  it('setPoint ghi toạ độ và nguồn', () => {
    useUserLocation.getState().setPoint({ lat: 10.777, lng: 106.695 }, 'gps');

    expect(useUserLocation.getState().point).toEqual({ lat: 10.777, lng: 106.695 });
    expect(useUserLocation.getState().source).toBe('gps');
  });

  it('setPoint với nguồn manual thay thế nguồn gps trước đó', () => {
    const { setPoint } = useUserLocation.getState();
    setPoint({ lat: 10.777, lng: 106.695 }, 'gps');
    setPoint({ lat: 10.8, lng: 106.7 }, 'manual');

    expect(useUserLocation.getState().point).toEqual({ lat: 10.8, lng: 106.7 });
    expect(useUserLocation.getState().source).toBe('manual');
  });

  it('clear xoá cả toạ độ lẫn nguồn', () => {
    useUserLocation.getState().setPoint({ lat: 10.777, lng: 106.695 }, 'gps');
    useUserLocation.getState().clear();

    expect(useUserLocation.getState().point).toBeUndefined();
    expect(useUserLocation.getState().source).toBeUndefined();
  });

  it('không persist: không ghi gì ra localStorage hay sessionStorage', () => {
    const local = window.localStorage.length;
    const session = window.sessionStorage.length;

    useUserLocation.getState().setPoint({ lat: 10.777, lng: 106.695 }, 'gps');

    expect(window.localStorage.length).toBe(local);
    expect(window.sessionStorage.length).toBe(session);
    // Store không có middleware persist (không có API persist).
    expect('persist' in useUserLocation).toBe(false);
  });
});
