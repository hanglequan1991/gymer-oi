// Context và hook trạng thái đăng nhập. Đặt ở hooks (không ở providers) để feature import được mà không chạm services.
// SessionProvider (src/providers) là nơi cấp giá trị cho context này.
import { createContext, useContext } from 'react';

/** Hành động người dùng cần làm khi đăng nhập thất bại. */
export type SessionAction = 'retry' | 'relogin' | 'grant';

/** Trạng thái phiên: đang đăng nhập, đã có userId, hoặc lỗi kèm hành động gợi ý. */
export type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; userId: string }
  | { status: 'error'; error: unknown; action: SessionAction };

/** Giá trị context: trạng thái và các thao tác điều khiển phiên. */
export interface SessionApi {
  state: SessionState;
  /** Đặt lại bộ đếm tự thử và đăng nhập lại từ đầu. */
  retry(): Promise<void>;
  /** Xoá phiên cục bộ rồi đăng nhập lại (lấy token Zalo mới). */
  reauthenticate(): Promise<void>;
  /** Xoá phiên cục bộ; trạng thái chuyển sang lỗi cần đăng nhập lại. */
  signOut(): Promise<void>;
}

/** Context phiên. Giá trị null nghĩa là chưa có SessionProvider bao quanh. */
export const SessionContext = createContext<SessionApi | null>(null);

/** Lấy trạng thái phiên hiện tại. Ném lỗi rõ ràng nếu gọi ngoài SessionProvider. */
export function useSession(): SessionApi {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error('useSession phải được dùng bên trong SessionProvider.');
  }
  return session;
}
