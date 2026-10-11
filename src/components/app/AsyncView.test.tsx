// Kiểm thử AsyncView: bốn trạng thái (loading, lỗi, rỗng, có dữ liệu) và nút thử lại nối với refetch.
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SessionContext, type SessionApi } from '@/hooks/useSession';
import type { AsyncState } from '@/hooks';
import { AppError } from '@/services/errors';
import { AsyncView } from './AsyncView';

const session: SessionApi = {
  state: { status: 'ready', userId: 'u1' },
  retry: async () => undefined,
  reauthenticate: async () => undefined,
  signOut: async () => undefined,
};

function Wrap({ children }: { children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

function state<T>(partial: Partial<AsyncState<T>>): AsyncState<T> {
  return { data: undefined, error: undefined, loading: false, refetch: vi.fn(), ...partial };
}

describe('AsyncView', () => {
  it('loading: hiện chữ đang tải, không gọi children', () => {
    const children = vi.fn();
    render(<AsyncView state={state({ loading: true })}>{children}</AsyncView>, { wrapper: Wrap });
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
    expect(children).not.toHaveBeenCalled();
  });

  it('lỗi: hiện ErrorView theo ngữ cảnh và nút thử lại gọi refetch', () => {
    const refetch = vi.fn();
    const children = vi.fn();
    render(
      <AsyncView
        state={state({ error: new AppError('NETWORK', 'x'), refetch })}
        context="search"
      >
        {children}
      </AsyncView>,
      { wrapper: Wrap },
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được danh sách Gymer');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(children).not.toHaveBeenCalled();
  });

  it('rỗng: hiện nội dung rỗng, không gọi children', () => {
    const children = vi.fn();
    render(
      <AsyncView
        state={state({ data: [] as string[] })}
        isEmpty={(d) => d.length === 0}
        empty={<p>Chưa có gì</p>}
      >
        {children}
      </AsyncView>,
      { wrapper: Wrap },
    );
    expect(screen.getByText('Chưa có gì')).toBeInTheDocument();
    expect(children).not.toHaveBeenCalled();
  });

  it('có dữ liệu: gọi children với dữ liệu', () => {
    render(
      <AsyncView state={state({ data: ['a', 'b'] })} isEmpty={(d) => d.length === 0}>
        {(d) => <p>{d.join(',')}</p>}
      </AsyncView>,
      { wrapper: Wrap },
    );
    expect(screen.getByText('a,b')).toBeInTheDocument();
  });
});
