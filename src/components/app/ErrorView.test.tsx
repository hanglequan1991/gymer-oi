// Kiểm thử ErrorView: chọn nút theo loại lỗi, nút đăng nhập lại gọi reauthenticate rồi onRetry.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ServicesContext } from '@/hooks/useServices';
import { SessionContext, type SessionApi } from '@/hooks/useSession';
import { AuthGate } from '@/features/auth/AuthGate';
import { SessionProvider } from '@/providers/SessionProvider';
import { AppError } from '@/services/errors';
import { createStubServices } from '@/test/stubServices';
import { ErrorView } from './ErrorView';

function makeSession(reauthenticate = vi.fn(async () => undefined)): SessionApi {
  return {
    state: { status: 'ready', userId: 'u1' },
    retry: async () => undefined,
    reauthenticate,
    signOut: async () => undefined,
  };
}

function wrapWith(api: SessionApi) {
  return ({ children }: { children: ReactNode }) => (
    <SessionContext.Provider value={api}>{children}</SessionContext.Provider>
  );
}

describe('ErrorView', () => {
  it('NETWORK có onRetry: hiện nút Thử lại và gọi onRetry', () => {
    const onRetry = vi.fn();
    render(<ErrorView error={new AppError('NETWORK', 'x')} onRetry={onRetry} />, {
      wrapper: wrapWith(makeSession()),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('NETWORK không có onRetry: không có nút nào', () => {
    render(<ErrorView error={new AppError('NETWORK', 'x')} />, { wrapper: wrapWith(makeSession()) });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('NOT_FOUND: có câu lỗi nhưng không có nút thử lại', () => {
    render(<ErrorView error={new AppError('NOT_FOUND', 'x')} onRetry={vi.fn()} />, {
      wrapper: wrapWith(makeSession()),
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy nội dung');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('UNAUTHENTICATED: nút Đăng nhập lại gọi reauthenticate rồi onRetry, không hiện Thử lại', async () => {
    const reauthenticate = vi.fn(async () => undefined);
    const onRetry = vi.fn();
    render(<ErrorView error={new AppError('UNAUTHENTICATED', 'x')} onRetry={onRetry} />, {
      wrapper: wrapWith(makeSession(reauthenticate)),
    });
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập lại' }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
    expect(reauthenticate).toHaveBeenCalledTimes(1);
  });

  it('FORBIDDEN theo ngữ cảnh login: dùng câu riêng và không có nút', () => {
    render(<ErrorView error={new AppError('FORBIDDEN', 'x')} context="login" onRetry={vi.fn()} />, {
      wrapper: wrapWith(makeSession()),
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Bạn cần cho phép Gymer ơi');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// Tích hợp N1: màn xác nhận đặt lịch có ô nhập; lỗi UNAUTHENTICATED rồi bấm "Đăng nhập lại" không được xoá nội dung ô.
describe('ErrorView trong AuthGate với SessionProvider thật (N1)', () => {
  function renderConfirm(signIn: () => Promise<{ userId: string }>, onRetry = vi.fn()) {
    const services = createStubServices({
      session: {
        getSession: vi.fn(async () => ({ userId: 'u1' })),
        signIn,
        signOut: vi.fn(async () => undefined),
      },
    });
    function Confirm() {
      return (
        <div>
          <input aria-label="mục tiêu" />
          <ErrorView error={new AppError('UNAUTHENTICATED', 'token hỏng')} onRetry={onRetry} />
        </div>
      );
    }
    render(
      <ServicesContext.Provider value={services}>
        <SessionProvider retryDelaysMs={[0, 0]}>
          <AuthGate>
            <Confirm />
          </AuthGate>
        </SessionProvider>
      </ServicesContext.Provider>,
    );
    return onRetry;
  }

  it('đăng nhập lại thành công: ô nhập giữ nội dung và onRetry được gọi', async () => {
    const signIn = vi.fn(async () => ({ userId: 'u2' }));
    const onRetry = renderConfirm(signIn);

    const input = (await screen.findByLabelText('mục tiêu')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'giảm 5 kg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập lại' }));

    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('mục tiêu')).toBe(input);
    expect(input.value).toBe('giảm 5 kg');
  });

  it('đăng nhập lại thất bại: AuthGate thay bằng màn lỗi, không gọi onRetry', async () => {
    const signIn = vi.fn(async () => {
      throw new AppError('UNAUTHENTICATED', 'token hỏng');
    });
    const onRetry = renderConfirm(signIn);

    await screen.findByLabelText('mục tiêu');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập lại' }));
    expect(await screen.findByTestId('auth-gate-error')).toBeInTheDocument();
    expect(onRetry).not.toHaveBeenCalled();
  });
});
