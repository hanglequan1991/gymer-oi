// Adapter SessionIssuer (D4): cấp phiên Supabase thật (có refresh token) cho user đã xác minh.
// Chuỗi: admin.generateLink(magiclink) -> lấy hashed_token -> anon.auth.verifyOtp(token_hash).
// Không import Deno.*, npm:, jsr:. Không log access/refresh token.
import type { IssuedSession, SessionIssuer } from '../ports.ts';
import type { DbError } from './userStore.ts';

/** Tập con của client service role (`client.auth.admin`) mà issuer dùng. */
export interface AdminAuthLike {
  getUserById(id: string): Promise<{
    data: { user: { email?: string | null } | null };
    error: DbError | null;
  }>;
  generateLink(params: { type: 'magiclink'; email: string }): Promise<{
    data: { properties?: { hashed_token?: string | null } | null } | null;
    error: DbError | null;
  }>;
}

/** Tập con của client anon (`client.auth`) mà issuer dùng. Client phải tắt persistSession và autoRefreshToken. */
export interface AnonAuthLike {
  verifyOtp(params: { token_hash: string; type: 'magiclink' }): Promise<{
    data: {
      session: { access_token: string; refresh_token: string; expires_in: number } | null;
    } | null;
    error: DbError | null;
  }>;
}

export interface SessionIssuerConfig {
  admin: AdminAuthLike;
  anonAuth: AnonAuthLike;
}

/** Lỗi cấp phiên. Chỉ mang tên bước và mã lỗi, không mang token hay thông báo gốc. */
export class SessionIssueError extends Error {
  constructor(public step: string, public code?: string) {
    super(`Lỗi cấp phiên (${step}${code ? `, ${code}` : ''}).`);
    this.name = 'SessionIssueError';
  }
}

export function createSessionIssuer(config: SessionIssuerConfig): SessionIssuer {
  return {
    async issue(userId: string): Promise<IssuedSession> {
      // S1: lấy email qua getUserById là cách của plan (D4); chưa xác nhận với GoTrue thật.
      const found = await config.admin.getUserById(userId);
      if (found.error) throw new SessionIssueError('get_user', found.error.code);
      const email = found.data.user?.email;
      if (typeof email !== 'string' || email.length === 0) {
        throw new SessionIssueError('get_user_email');
      }

      const link = await config.admin.generateLink({ type: 'magiclink', email });
      if (link.error) throw new SessionIssueError('generate_link', link.error.code);
      const tokenHash = link.data?.properties?.hashed_token;
      if (typeof tokenHash !== 'string' || tokenHash.length === 0) {
        throw new SessionIssueError('missing_hashed_token');
      }

      // S1: verifyOtp cấp refresh token khi client anon không persist; chưa kiểm trên dự án thật.
      const verified = await config.anonAuth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      if (verified.error) throw new SessionIssueError('verify_otp', verified.error.code);
      const session = verified.data?.session;
      if (!session) throw new SessionIssueError('missing_session');

      return {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in,
      };
    },
  };
}
