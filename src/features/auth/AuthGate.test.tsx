// Kiểm thử AuthGate: ba trạng thái, nút theo hành động của phiên, chế độ bypass của mock.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServicesContext } from '@/hooks/useServices';
import { SessionContext, useSession, type SessionApi, type SessionState } from '@/hooks/useSession';
import { SessionProvider } from '@/providers/SessionProvider';
import { AppError } from '@/services/errors';
import { createStubServices } from '@/test/stubServices';
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

// Tích hợp N1: đăng nhập lại khi đang ready không được gỡ cây, ô nhập giữ nội dung.
describe('AuthGate với SessionProvider thật (N1)', () => {
  function renderWithProvider(signIn: () => Promise<{ userId: string }>, signOut = vi.fn(async () => undefined)) {
    const services = createStubServices({
      session: { getSession: vi.fn(async () => ({ userId: 'u1' })), signIn, signOut },
    });
    function Screen() {
      const { reauthenticate } = useSession();
      return (
        <div>
          <input aria-label="ghi chú" />
          <button onClick={() => void reauthenticate()}>đăng nhập lại</button>
        </div>
      );
    }
    render(
      <ServicesContext.Provider value={services}>
        <SessionProvider retryDelaysMs={[0, 0]}>
          <AuthGate>
            <Screen />
          </AuthGate>
        </SessionProvider>
      </ServicesContext.Provider>,
    );
  }

  it('ô nhập giữ nguyên nội dung và không bị remount khi đăng nhập lại thành công', async () => {
    let finish!: (v: { userId: string }) => void;
    const signIn = vi.fn(() => new Promise<{ userId: string }>((resolve) => (finish = resolve)));
    renderWithProvider(signIn);

    const input = (await screen.findByLabelText('ghi chú')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'đau gối trái' } });
    fireEvent.click(screen.getByRole('button', { name: 'đăng nhập lại' }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    // Đang chờ đăng nhập: vẫn là cùng một ô, nội dung còn nguyên.
    expect(screen.getByLabelText('ghi chú')).toBe(input);
    expect(input.value).toBe('đau gối trái');

    finish({ userId: 'u2' });
    await waitFor(() => expect(signIn).toHaveReturnedTimes(1));
    expect(screen.getByLabelText('ghi chú')).toBe(input);
    expect(input.value).toBe('đau gối trái');
  });

  it('đăng nhập lại thất bại: AuthGate hiện màn lỗi thay cho nội dung', async () => {
    const signIn = vi.fn(async () => {
      throw new AppError('UNAUTHENTICATED', 'token hỏng');
    });
    renderWithProvider(signIn);

    await screen.findByLabelText('ghi chú');
    fireEvent.click(screen.getByRole('button', { name: 'đăng nhập lại' }));
    expect(await screen.findByTestId('auth-gate-error')).toBeInTheDocument();
    expect(screen.queryByLabelText('ghi chú')).not.toBeInTheDocument();
  });
});
