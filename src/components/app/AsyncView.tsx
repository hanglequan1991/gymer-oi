// Khung dùng chung cho màn có dữ liệu bất đồng bộ: loading, lỗi, rỗng, có dữ liệu.
// Nằm ở components/app (không phải components/ui) vì dùng hook (plan app-ui-integration, D4).
import type { ReactNode } from 'react';
import type { AsyncState } from '@/hooks';
import { vi, type ErrorContext } from '@/i18n';
import { ErrorView } from './ErrorView';

export interface AsyncViewProps<T> {
  /** Kết quả của useAsync. */
  state: AsyncState<T>;
  /** Ngữ cảnh để chọn câu lỗi đúng (ví dụ 'search'). */
  context?: ErrorContext;
  /** Trả true khi dữ liệu coi như rỗng; khi đó hiện `empty`. */
  isEmpty?: (data: T) => boolean;
  /** Nội dung khi rỗng, thường là EmptyState. */
  empty?: ReactNode;
  /** Render dữ liệu khi đã có và không rỗng. */
  children: (data: T) => ReactNode;
}

function Loading() {
  return (
    <div role="status" style={{ padding: 24, textAlign: 'center' }}>
      {vi.common.loading}
    </div>
  );
}

export function AsyncView<T>({ state, context, isEmpty, empty, children }: AsyncViewProps<T>) {
  if (state.loading) return <Loading />;
  if (state.error !== undefined) {
    return <ErrorView error={state.error} context={context} onRetry={state.refetch} />;
  }
  if (state.data === undefined) return <Loading />;
  if (isEmpty?.(state.data)) return <>{empty ?? null}</>;
  return <>{children(state.data)}</>;
}
