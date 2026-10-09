import { useEffect, useMemo, useRef } from 'react';
import { useSnackbar } from 'zmp-ui';

/** API thông báo nhanh (snackbar) trả về bởi useToast. */
export interface ToastApi {
  /** Hiện thông báo thành công. */
  success(msg: string): void;
  /** Hiện thông báo lỗi. */
  error(msg: string): void;
  /** Hiện thông báo thông tin. */
  info(msg: string): void;
}

const TOAST_DURATION_MS = 2000;

/**
 * Hook bọc useSnackbar của zmp-ui để hiện thông báo ngắn ở phía dưới.
 * Yêu cầu app đã bọc SnackbarProvider (đã có trong app.tsx).
 *
 * Đối tượng trả về không đổi giữa các lần render. Lý do dùng ref: useSnackbar của zmp-ui
 * tạo lại hàm openSnackbar ở mỗi lần render, nên đưa nó vào deps của useMemo sẽ làm object
 * bị tạo lại liên tục. Thay vào đó, hàm mới nhất được giữ trong ref (cập nhật sau mỗi lần
 * render) và các phương thức đọc ref tại thời điểm gọi, nên useMemo chỉ chạy một lần.
 */
export function useToast(): ToastApi {
  const { openSnackbar } = useSnackbar();
  const openRef = useRef(openSnackbar);

  useEffect(() => {
    openRef.current = openSnackbar;
  });

  return useMemo<ToastApi>(() => {
    const show = (text: string, type: 'success' | 'error' | 'info') => {
      openRef.current({ text, type, position: 'bottom', duration: TOAST_DURATION_MS });
    };

    return {
      success: (msg) => show(msg, 'success'),
      error: (msg) => show(msg, 'error'),
      info: (msg) => show(msg, 'info'),
    };
  }, []);
}
