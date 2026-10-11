// Máy trạng thái đăng nhập (không có UI). Mở app: có phiên cục bộ thì dùng luôn, chưa có thì signIn().
// Chính sách thử lại theo plan app-ui-integration, D7:
// - NETWORK: tự thử tối đa retryDelaysMs.length lần rồi dừng ở hành động 'retry'.
// - UNAUTHENTICATED: tự đăng nhập lại đúng 1 lần (signIn luôn xin token Zalo mới), rồi dừng ở 'relogin'.
// - FORBIDDEN: không tự thử, hành động 'grant' (người dùng phải cho phép quyền).
// - Mã khác: không tự thử, hành động 'retry'.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SessionContext, type SessionAction, type SessionApi, type SessionState } from '@/hooks/useSession';
import { useServices } from '@/hooks/useServices';
import { AppError, isAppError } from '@/services/errors';

export interface SessionProviderProps {
  /**
   * Độ trễ (ms) trước mỗi lần tự thử khi NETWORK. Độ dài mảng là số lần tự thử.
   * Test truyền [0, 0] để không chờ thật.
   */
  retryDelaysMs?: readonly number[];
  children: ReactNode;
}

const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [1000, 3000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(err: unknown): boolean {
  return isAppError(err) && err.code === 'NETWORK';
}

function isReloginError(err: unknown): boolean {
  return isAppError(err) && err.code === 'UNAUTHENTICATED';
}

/** Hành động gợi ý cho người dùng khi đăng nhập thất bại (sau khi đã hết lượt tự thử). */
function actionFor(err: unknown): SessionAction {
  if (isReloginError(err)) return 'relogin';
  if (isAppError(err) && err.code === 'FORBIDDEN') return 'grant';
  return 'retry';
}

export function SessionProvider({ retryDelaysMs = DEFAULT_RETRY_DELAYS_MS, children }: SessionProviderProps) {
  const session = useServices().session;
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  // Mỗi luồng đăng nhập có một số riêng. Luồng cũ thấy số đã đổi thì bỏ kết quả, không ghi đè trạng thái.
  // Nhờ đó StrictMode (mount hai lần) không gọi signIn hai lần từ luồng đầu tiên.
  const runRef = useRef(0);
  const delaysRef = useRef(retryDelaysMs);
  delaysRef.current = retryDelaysMs;

  const isCurrent = useCallback((runId: number) => runRef.current === runId, []);

  // Gọi signIn theo chính sách thử lại. Mọi nhánh đều kết thúc bằng setState (trừ khi luồng đã bị thay thế).
  const signInWithPolicy = useCallback(
    async (runId: number): Promise<void> => {
      const delays = delaysRef.current;
      let networkRetries = 0;
      let reloginDone = false;
      for (;;) {
        try {
          const { userId } = await session.signIn();
          if (isCurrent(runId)) setState({ status: 'ready', userId });
          return;
        } catch (err) {
          if (!isCurrent(runId)) return;
          if (isNetworkError(err) && networkRetries < delays.length) {
            await delay(delays[networkRetries] ?? 0);
            networkRetries += 1;
            if (!isCurrent(runId)) return;
            continue;
          }
          if (isReloginError(err) && !reloginDone) {
            reloginDone = true;
            continue;
          }
          setState({ status: 'error', error: err, action: actionFor(err) });
          return;
        }
      }
    },
    [session, isCurrent],
  );

  // Mở app: đọc phiên cục bộ trước, không có mới gọi đăng nhập. Lỗi đọc phiên coi như chưa có phiên.
  const bootstrap = useCallback(
    async (runId: number): Promise<void> => {
      try {
        const existing = await session.getSession();
        if (!isCurrent(runId)) return;
        if (existing !== null) {
          setState({ status: 'ready', userId: existing.userId });
          return;
        }
      } catch {
        // Không có phiên đọc được: đi tiếp sang đăng nhập.
      }
      if (!isCurrent(runId)) return;
      await signInWithPolicy(runId);
    },
    [session, isCurrent, signInWithPolicy],
  );

  useEffect(() => {
    const runId = ++runRef.current;
    void bootstrap(runId);
    // Khi unmount (hoặc StrictMode chạy lại effect) tăng số để vô hiệu hoá luồng đang chờ.
    return () => {
      runRef.current += 1;
    };
  }, [bootstrap]);

  const retry = useCallback(async () => {
    const runId = ++runRef.current;
    setState({ status: 'loading' });
    await signInWithPolicy(runId);
  }, [signInWithPolicy]);

  const reauthenticate = useCallback(async () => {
    const runId = ++runRef.current;
    setState({ status: 'loading' });
    try {
      await session.signOut();
    } catch {
      // Bỏ qua lỗi xoá phiên cục bộ: vẫn thử đăng nhập lại.
    }
    if (!isCurrent(runId)) return;
    await signInWithPolicy(runId);
  }, [session, isCurrent, signInWithPolicy]);

  const signOut = useCallback(async () => {
    runRef.current += 1;
    await session.signOut();
    setState({
      status: 'error',
      error: new AppError('UNAUTHENTICATED', 'Người dùng đã đăng xuất.'),
      action: 'relogin',
    });
  }, [session]);

  const api = useMemo<SessionApi>(
    () => ({ state, retry, reauthenticate, signOut }),
    [state, retry, reauthenticate, signOut],
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}
