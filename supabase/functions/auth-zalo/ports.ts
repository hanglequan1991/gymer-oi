// Cổng (port) của edge function auth-zalo: hợp đồng giữa handler và các adapter.
// File này không import gì (không Deno.*, npm:, jsr:) để Vitest (Node) đọc được.

export interface ZaloUser { zaloId: string; name: string; avatarUrl?: string }
export type ZaloAuthErrorCode = 'INVALID_TOKEN' | 'UNAVAILABLE';
export class ZaloAuthError extends Error {
  constructor(public code: ZaloAuthErrorCode, message?: string) {
    super(message ?? 'Lỗi xác minh token Zalo.');
  }
}
export interface ZaloVerifier { verify(accessToken: string): Promise<ZaloUser>; } // ném ZaloAuthError
export interface UserStore {
  findUserIdByZaloId(zaloId: string): Promise<string | null>;
  createUserForZalo(user: ZaloUser): Promise<string>; // an toàn khi đua: trả user_id của bên thắng
}
export interface IssuedSession { accessToken: string; refreshToken: string; expiresIn: number }
export interface SessionIssuer { issue(userId: string): Promise<IssuedSession>; }
