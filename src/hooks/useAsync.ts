// Hook nhỏ lấy dữ liệu bất đồng bộ: loading, data, error, refetch. Chưa có cache (docs/project-structure.md, mục 2.4).
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/** Trạng thái trả về của useAsync. */
export interface AsyncState<T> {
  /** Dữ liệu của lần gọi thành công gần nhất. Lần gọi lỗi thì là undefined. */
  data: T | undefined;
  /** Lỗi của lần gọi gần nhất; undefined khi không lỗi. */
  error: unknown;
  /** true khi đang chờ kết quả (kể cả lúc gọi lại). */
  loading: boolean;
  /** Gọi lại hàm lấy dữ liệu với deps hiện tại. */
  refetch: () => void;
}

interface InternalState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * Chạy `fn` khi mount và mỗi khi `deps` đổi hoặc gọi `refetch`.
 * Kết quả của lần gọi cũ (đã bị thay thế hoặc unmount) bị bỏ qua, không ghi đè trạng thái mới.
 * `deps` do người gọi quyết định, giống useEffect.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<InternalState<T>>({ data: undefined, error: undefined, loading: true });
  const [version, setVersion] = useState(0);
  // Luôn gọi bản `fn` mới nhất mà không đưa `fn` vào deps.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let active = true;
    setState((prev) => ({ data: prev.data, error: undefined, loading: true }));
    fnRef.current().then(
      (data) => {
        if (active) setState({ data, error: undefined, loading: false });
      },
      (error: unknown) => {
        if (active) setState({ data: undefined, error, loading: false });
      },
    );
    return () => {
      active = false;
    };
    // deps là của người gọi; version đổi khi refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  return { data: state.data, error: state.error, loading: state.loading, refetch };
}
