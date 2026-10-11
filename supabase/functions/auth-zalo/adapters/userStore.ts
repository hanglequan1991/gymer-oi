// Adapter UserStore (D3): tìm/tạo tài khoản theo zalo_id bằng service role.
// Không import Deno.*, npm:, jsr:. Kiểu admin/db là cấu trúc tối thiểu để test bằng client giả.
import type { UserStore, ZaloUser } from '../ports.ts';

/** Lỗi tối thiểu từ supabase-js (PostgrestError hoặc AuthError). Chỉ dùng `code`, không dùng `message`. */
export interface DbError { code?: string; message?: string }

export interface AdminUsersLike {
  createUser(attrs: { email: string; email_confirm: boolean }): Promise<{
    data: { user: { id: string } | null };
    error: DbError | null;
  }>;
  deleteUser(id: string): Promise<{ error: DbError | null }>;
}

/** Tập con của PostgREST builder mà store dùng. */
export interface DbLike {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: unknown; error: DbError | null }>;
      };
    };
    insert(values: Record<string, unknown>): PromiseLike<{ error: DbError | null }>;
  };
}

/** Lỗi của store. Chỉ mang mã bước và mã lỗi Postgres/Auth, không mang thông báo gốc. */
export class StoreError extends Error {
  constructor(public step: string, public code?: string) {
    super(`Lỗi lưu tài khoản (${step}${code ? `, ${code}` : ''}).`);
    this.name = 'StoreError';
  }
}

export interface UserStoreConfig {
  /** Là `client.auth.admin` của service role client. */
  admin: AdminUsersLike;
  db: DbLike;
  /** Chỉ nhận msg và meta đã làm sạch (không token, không zaloId đầy đủ). */
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

const UNIQUE_VIOLATION = '23505';
// S1: domain email giả cho user Zalo là giả định của plan; GoTrue có nhận `.invalid` chưa xác nhận.
const PLACEHOLDER_EMAIL_DOMAIN = 'zalo.gymer.invalid';

export function createUserStore(config: UserStoreConfig): UserStore {
  const users = config.admin;
  const db = config.db;
  const log = (msg: string, meta?: Record<string, unknown>): void => {
    try {
      config.log?.(msg, meta);
    } catch {
      // Log lỗi không được làm hỏng luồng đăng nhập.
    }
  };

  async function findUserIdByZaloId(zaloId: string): Promise<string | null> {
    const { data, error } = await db
      .from('zalo_identities')
      .select('user_id')
      .eq('zalo_id', zaloId)
      .maybeSingle();
    if (error) throw new StoreError('lookup', error.code);
    if (data === null || data === undefined) return null;
    const userId = (data as { user_id?: unknown }).user_id;
    return typeof userId === 'string' && userId.length > 0 ? userId : null;
  }

  /** Dọn auth.users vừa tạo (profiles xoá theo cascade). Best effort: lỗi chỉ được log. */
  async function cleanupUser(userId: string, reason: string): Promise<void> {
    try {
      const { error } = await users.deleteUser(userId);
      if (error) log('auth-zalo: không dọn được user mồ côi', { reason, errorCode: error.code });
    } catch {
      log('auth-zalo: không dọn được user mồ côi', { reason });
    }
  }

  async function createUserForZalo(user: ZaloUser): Promise<string> {
    const email = `zalo-${crypto.randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
    const created = await users.createUser({ email, email_confirm: true });
    if (created.error || !created.data.user) {
      throw new StoreError('create_user', created.error?.code);
    }
    const userId = created.data.user.id;

    const profile = await db.from('profiles').insert({
      id: userId,
      display_name: user.name,
      avatar_url: user.avatarUrl ?? null,
    });
    if (profile.error) {
      await cleanupUser(userId, 'profile_insert');
      throw new StoreError('profile_insert', profile.error.code);
    }

    const identity = await db.from('zalo_identities').insert({
      zalo_id: user.zaloId,
      user_id: userId,
    });
    if (identity.error) {
      await cleanupUser(userId, 'identity_insert');
      if (identity.error.code === UNIQUE_VIOLATION) {
        // Đua: lần đăng nhập khác đã ghi zalo_id trước; dùng user của bên thắng.
        const winner = await findUserIdByZaloId(user.zaloId);
        if (winner !== null) {
          log('auth-zalo: đua tạo tài khoản, dùng user đã có');
          return winner;
        }
        throw new StoreError('identity_race_unresolved', identity.error.code);
      }
      throw new StoreError('identity_insert', identity.error.code);
    }

    return userId;
  }

  return { findUserIdByZaloId, createUserForZalo };
}
