// Cổng phiên đăng nhập (chỉ interface, chưa có cài đặt).

/** Phiên đăng nhập của người dùng Supabase, lấy qua auth-zalo. */
export interface SessionRepository {
  /** platform.auth.login -> auth-zalo -> setSession. Ném AppError khi thất bại. */
  signIn(): Promise<{ userId: string }>;
  /** Đọc phiên cục bộ, không gọi mạng. Trả null nếu chưa đăng nhập. */
  getSession(): Promise<{ userId: string } | null>;
  /** Xoá phiên cục bộ. */
  signOut(): Promise<void>;
}
