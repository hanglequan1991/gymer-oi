// Kiểm thử AuthGate: ba trạng thái, nút theo hành động của phiên, chế độ bypass của mock.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionContext, type SessionApi, type SessionState } from '@/hooks/useSession';
import { AppError } from '@/services/errors';
import { AuthGate } from './AuthGate';

function renderGate(state: SessionState, { bypass = false }: { bypass?: boolean } = {}) {
  const api: SessionApi = {
    state,
    retry: vi.fn(async () => undefined),
    reauthenticate: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
  render(
    <SessionContext.Provider value={api}>
      <AuthGate bypass={bypass}>
        <p>nội dung app</p>
      </AuthGate>
    </SessionContext.Provider>,
  );
  return api;
}

describe('AuthGate', () => {
  it('loading: hiện chữ đăng nhập, chưa hiện nội dung', () => {
    renderGate({ status: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent('Đang đăng nhập...');
    expect(screen.queryByText('nội dung app')).not.toBeInTheDocument();
  });

  it('ready: hiện nội dung', () => {
    renderGate({ status: 'ready', userId: 'u1' });
    expect(screen.getByText('nội dung app')).toBeInTheDocument();
  });

  it('error với hành động retry: nút Thử lại gọi retry', () => {
    const api = renderGate({ status: 'error', error: new AppError('NETWORK', 'x'), action: 'retry' });
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa đăng nhập được');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(api.retry).toHaveBeenCalledTimes(1);
  });

  it('error với hành động relogin: nút Đăng nhập lại gọi reauthenticate', () => {
    const api = renderGate({ status: 'error', error: new AppError('UNAUTHENTICATED', 'x'), action: 'relogin' });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập lại' }));
    expect(api.reauthenticate).toHaveBeenCalledTimes(1);
  });

  it('error với hành động grant: nút Cho phép và thử lại gọi retry và câu lỗi theo ngữ cảnh login', () => {
    const api = renderGate({ status: 'error', error: new AppError('FORBIDDEN', 'x'), action: 'grant' });
    expect(screen.getByRole('alert')).toHaveTextContent('Bạn cần cho phép Gymer ơi');
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép và thử lại' }));
    expect(api.retry).toHaveBeenCalledTimes(1);
  });

  it('bypass: luôn hiện nội dung, kể cả khi phiên lỗi', () => {
    renderGate({ status: 'error', error: new Error('x'), action: 'retry' }, { bypass: true });
    expect(screen.getByText('nội dung app')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
