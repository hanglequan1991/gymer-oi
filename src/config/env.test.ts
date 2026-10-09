import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('mặc định dùng mock khi không khai báo VITE_DATA_SOURCE', () => {
    expect(parseEnv({})).toEqual({ dataSource: 'mock' });
  });

  it('đọc đủ biến khi dataSource là supabase', () => {
    expect(
      parseEnv({
        VITE_DATA_SOURCE: 'supabase',
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      dataSource: 'supabase',
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'anon-key',
    });
  });

  it('ném lỗi tiếng Việt nêu tên biến khi supabase thiếu URL', () => {
    expect(() =>
      parseEnv({ VITE_DATA_SOURCE: 'supabase', VITE_SUPABASE_ANON_KEY: 'anon-key' }),
    ).toThrowError(/VITE_SUPABASE_URL/);
  });

  it('ném lỗi tiếng Việt nêu tên biến khi supabase thiếu key', () => {
    expect(() =>
      parseEnv({ VITE_DATA_SOURCE: 'supabase', VITE_SUPABASE_URL: 'https://abc.supabase.co' }),
    ).toThrowError(/VITE_SUPABASE_ANON_KEY/);
  });

  it('liệt kê đủ cả hai biến khi supabase thiếu cả URL lẫn key, kể cả chuỗi rỗng', () => {
    expect(() =>
      parseEnv({ VITE_DATA_SOURCE: 'supabase', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '  ' }),
    ).toThrowError(/VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY/);
  });

  it('ném lỗi khi VITE_DATA_SOURCE có giá trị lạ', () => {
    expect(() => parseEnv({ VITE_DATA_SOURCE: 'firebase' })).toThrowError(/VITE_DATA_SOURCE/);
  });

  it('bỏ qua biến Supabase khi dataSource là mock', () => {
    expect(
      parseEnv({
        VITE_DATA_SOURCE: 'mock',
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({ dataSource: 'mock' });
  });
});
