// Tạo SupabaseClient duy nhất cho tầng services (plan 2.2 D5).
// Hàm này không gọi mạng: chỉ dựng đối tượng client từ cấu hình.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv } from '@/config';
import type { StoragePort } from '@/platform/ports';
import { AppError } from '../errors';
import type { Database } from './database.types';
import { toAuthStorage } from './storageAdapter';

/**
 * Tạo client Supabase từ cấu hình môi trường.
 * - `env.dataSource` không phải 'supabase', hoặc thiếu URL/khoá anon: ném AppError('VALIDATION').
 * - `storage` (nếu có) dùng để lưu phiên đăng nhập; không có thì supabase-js dùng bộ nhớ mặc định.
 * Chỉ dùng khoá anon/publishable; không bao giờ nhận service-role key.
 */
export function createSupabaseClient(env: AppEnv, storage?: StoragePort): SupabaseClient<Database> {
  if (env.dataSource !== 'supabase') {
    throw new AppError('VALIDATION', 'Không thể tạo client Supabase khi nguồn dữ liệu không phải supabase.');
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new AppError('VALIDATION', 'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.');
  }

  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: storage ? toAuthStorage(storage) : undefined,
    },
  });
}
