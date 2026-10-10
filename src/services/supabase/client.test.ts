import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '@/config';
import { createFakeStorage } from '@/platform/fake/fakeStorage';
import { AppError } from '../errors';
import { createSupabaseClient } from './client';

const SUPABASE_ENV: AppEnv = {
  dataSource: 'supabase',
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key-thử',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSupabaseClient', () => {
  it('nguồn dữ liệu mock: ném VALIDATION', () => {
    try {
      createSupabaseClient({ dataSource: 'mock' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('VALIDATION');
    }
  });

  it('thiếu URL: ném VALIDATION', () => {
    try {
      createSupabaseClient({ dataSource: 'supabase', supabaseAnonKey: 'k' });
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('VALIDATION');
    }
  });

  it('thiếu khoá anon: ném VALIDATION', () => {
    try {
      createSupabaseClient({ dataSource: 'supabase', supabaseUrl: 'https://example.supabase.co' });
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('VALIDATION');
    }
  });

  it('dựng client không gọi fetch, kể cả khi có kho phiên', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('không được gọi mạng khi khởi tạo');
    });
    vi.stubGlobal('fetch', fetchSpy);

    // Hai client dùng URL khác nhau: cùng URL sẽ in cảnh báo "Multiple GoTrueClient instances".
    const client = createSupabaseClient(SUPABASE_ENV);
    const withStorage = createSupabaseClient({ ...SUPABASE_ENV, supabaseUrl: 'https://other.supabase.co' }, createFakeStorage());

    expect(client).toBeDefined();
    expect(withStorage).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
