// Lấy user_id của phiên hiện tại. Đọc phiên cục bộ, không gọi bảng/function (plan 2.2 D5).
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../errors';
import type { Database } from './database.types';

/**
 * Trả user_id của phiên đang có trong client.
 * Đọc phiên cục bộ; có thể refresh nếu access token sắp hết hạn (supabase-js gọi mạng tới GoTrue khi đó).
 * Không gọi bảng hay Edge Function. Không có phiên (hoặc đọc phiên lỗi): ném AppError('UNAUTHENTICATED').
 */
export async function requireUserId(client: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await client.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) {
    throw new AppError('UNAUTHENTICATED', 'Chưa đăng nhập.', error ?? undefined);
  }
  return userId;
}
