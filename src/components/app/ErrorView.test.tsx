// Kiểm thử ErrorView: chọn nút theo loại lỗi, nút đăng nhập lại gọi reauthenticate rồi onRetry.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SessionContext, type SessionApi } from '@/hooks/useSession';
import { AppError } from '@/services/errors';
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
