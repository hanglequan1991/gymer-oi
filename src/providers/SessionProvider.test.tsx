// Kiểm thử máy trạng thái đăng nhập: chính sách thử lại (D7), chống gọi đôi khi StrictMode, retry/reauth/signOut.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ServicesContext } from '@/hooks/useServices';
import { useSession } from '@/hooks/useSession';
import { AppError } from '@/services/errors';
import { createStubServices } from '@/test/stubServices';
import { SessionProvider } from './SessionProvider';

function Probe() {
  const { state, retry, reauthenticate, signOut } = useSession();
  return (
    <div>
      <p data-testid="status">{state.status}</p>
      {state.status === 'error' && <p data-testid="action">{state.action}</p>}
      {state.status === 'ready' && <p data-testid="user">{state.userId}</p>}
      <button onClick={() => void retry()}>retry</button>
      <button onClick={() => void reauthenticate()}>reauth</button>
      <button onClick={() => void signOut()}>signout</button>
    </div>
  );
}

interface Setup {
  getSession?: ReturnType<typeof vi.fn>;
  signIn: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
  strict?: boolean;
}

function renderProvider({ getSession = vi.fn(async () => null), signIn, signOut = vi.fn(async () => undefined), strict = false }: Setup) {
  const services = createStubServices({ session: { getSession, signIn, signOut } });
  const tree = (
    <ServicesContext.Provider value={services}>
      <SessionProvider retryDelaysMs={[0, 0]}>
        <Probe />
      </SessionProvider>
    </ServicesContext.Provider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const network = () => new AppError('NETWORK', 'mất mạng');
const unauth = () => new AppError('UNAUTHENTICATED', 'token hỏng');

describe('SessionProvider', () => {
  it('có phiên cục bộ thì sẵn sàng ngay và không gọi signIn', async () => {
    const signIn = vi.fn();
    renderProvider({ getSession: vi.fn(async () => ({ userId: 'u1' })), signIn });
    expect(await screen.findByTestId('user')).toHaveTextContent('u1');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('chưa có phiên thì signIn đúng một lần, kể cả khi StrictMode mount hai lần', async () => {
    const signIn = vi.fn(async () => ({ userId: 'u2' }));
    renderProvider({ signIn, strict: true });
    expect(await screen.findByTestId('user')).toHaveTextContent('u2');
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('getSession ném lỗi thì vẫn đi đường đăng nhập', async () => {
    const signIn = vi.fn(async () => ({ userId: 'u3' }));
    renderProvider({ getSession: vi.fn(async () => { throw new Error('hỏng'); }), signIn });
    expect(await screen.findByTestId('user')).toHaveTextContent('u3');
  });

  it('NETWORK tự thử đúng 2 lần rồi dừng ở hành động retry', async () => {
    const signIn = vi.fn(async () => { throw network(); });
    renderProvider({ signIn });
    expect(await screen.findByTestId('action')).toHaveTextContent('retry');
    expect(signIn).toHaveBeenCalledTimes(3);
  });

  it('NETWORK thành công ở lần tự thử thứ hai thì sẵn sàng', async () => {
    const signIn = vi.fn().mockRejectedValueOnce(network()).mockResolvedValueOnce({ userId: 'u4' });
    renderProvider({ signIn });
    expect(await screen.findByTestId('user')).toHaveTextContent('u4');
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it('UNAUTHENTICATED tự đăng nhập lại đúng 1 lần rồi dừng ở relogin', async () => {
    const signIn = vi.fn(async () => { throw unauth(); });
    renderProvider({ signIn });
    expect(await screen.findByTestId('action')).toHaveTextContent('relogin');
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it('FORBIDDEN không tự thử và chuyển sang grant', async () => {
    const signIn = vi.fn(async () => { throw new AppError('FORBIDDEN', 'từ chối'); });
    renderProvider({ signIn });
    expect(await screen.findByTestId('action')).toHaveTextContent('grant');
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('lỗi không xác định không tự thử và chuyển sang retry', async () => {
    const signIn = vi.fn(async () => { throw new Error('lạ'); });
    renderProvider({ signIn });
    expect(await screen.findByTestId('action')).toHaveTextContent('retry');
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('retry đặt lại bộ đếm tự thử', async () => {
    const signIn = vi.fn(async () => { throw network(); });
    renderProvider({ signIn });
    await screen.findByTestId('action');
    expect(signIn).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(6));
    expect(await screen.findByTestId('action')).toHaveTextContent('retry');
  });

  it('reauthenticate xoá phiên rồi đăng nhập lại', async () => {
    const signIn = vi
      .fn()
      .mockRejectedValueOnce(unauth())
      .mockRejectedValueOnce(unauth())
      .mockResolvedValueOnce({ userId: 'u5' });
    const signOut = vi.fn(async () => undefined);
    renderProvider({ signIn, signOut });
    await screen.findByTestId('action');
    fireEvent.click(screen.getByRole('button', { name: 'reauth' }));
    expect(await screen.findByTestId('user')).toHaveTextContent('u5');
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('signOut chuyển sang lỗi cần đăng nhập lại', async () => {
    const signIn = vi.fn(async () => ({ userId: 'u6' }));
    const signOut = vi.fn(async () => undefined);
    renderProvider({ signIn, signOut });
    await screen.findByTestId('user');
    fireEvent.click(screen.getByRole('button', { name: 'signout' }));
    expect(await screen.findByTestId('action')).toHaveTextContent('relogin');
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SessionProvider: đăng nhập lại (N1)', () => {
  it('đang ready: reauthenticate giữ trạng thái ready trong lúc chờ, không chuyển sang loading', async () => {
    const pending = deferred<{ userId: string }>();
    const signIn = vi.fn(() => pending.promise);
    renderProvider({ getSession: vi.fn(async () => ({ userId: 'u1' })), signIn });
    expect(await screen.findByTestId('user')).toHaveTextContent('u1');

    fireEvent.click(screen.getByRole('button', { name: 'reauth' }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('user')).toHaveTextContent('u1');

    pending.resolve({ userId: 'u2' });
    expect(await screen.findByText('u2')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
  });

  it('đang ready: reauthenticate xoá phiên cục bộ trước khi đăng nhập lại', async () => {
    const order: string[] = [];
    const signOut = vi.fn(async () => {
      order.push('signOut');
    });
    const signIn = vi.fn(async () => {
      order.push('signIn');
      return { userId: 'u2' };
    });
    renderProvider({ getSession: vi.fn(async () => ({ userId: 'u1' })), signIn, signOut });
    expect(await screen.findByTestId('user')).toHaveTextContent('u1');

    fireEvent.click(screen.getByRole('button', { name: 'reauth' }));
    expect(await screen.findByText('u2')).toBeInTheDocument();
    expect(order).toEqual(['signOut', 'signIn']);
  });

  it('đang ready: đăng nhập lại thất bại UNAUTHENTICATED thì chuyển sang error với hành động relogin', async () => {
    const signIn = vi.fn(async () => {
      throw unauth();
    });
    renderProvider({ getSession: vi.fn(async () => ({ userId: 'u1' })), signIn });
    expect(await screen.findByTestId('user')).toHaveTextContent('u1');

    fireEvent.click(screen.getByRole('button', { name: 'reauth' }));
    expect(await screen.findByTestId('action')).toHaveTextContent('relogin');
    expect(screen.getByTestId('status')).toHaveTextContent('error');
  });

  it('đang ready: đăng nhập lại thất bại NETWORK hết lượt tự thử thì chuyển sang error với hành động retry', async () => {
    const signIn = vi.fn(async () => {
      throw network();
    });
    renderProvider({ getSession: vi.fn(async () => ({ userId: 'u1' })), signIn });
    expect(await screen.findByTestId('user')).toHaveTextContent('u1');

    fireEvent.click(screen.getByRole('button', { name: 'reauth' }));
    expect(await screen.findByTestId('action')).toHaveTextContent('retry');
    // 1 lần đầu + 2 lần tự thử (retryDelaysMs có 2 phần tử).
    expect(signIn).toHaveBeenCalledTimes(3);
  });

  it('đang error: reauthenticate chuyển sang loading rồi sang ready', async () => {
    const pending = deferred<{ userId: string }>();
    const signIn = vi
      .fn()
      .mockRejectedValueOnce(new AppError('FORBIDDEN', 'chưa cấp quyền'))
      .mockImplementationOnce(() => pending.promise);
    renderProvider({ signIn });
    expect(await screen.findByTestId('action')).toHaveTextContent('grant');

    fireEvent.click(screen.getByRole('button', { name: 'reauth' }));
    expect(await screen.findByTestId('status')).toHaveTextContent('loading');

    pending.resolve({ userId: 'u9' });
    expect(await screen.findByTestId('user')).toHaveTextContent('u9');
  });

  it('đang ready: retry không giữ ready, vẫn chuyển sang loading như cũ', async () => {
    const pending = deferred<{ userId: string }>();
    const signIn = vi.fn(() => pending.promise);
    renderProvider({ getSession: vi.fn(async () => ({ userId: 'u1' })), signIn });
    expect(await screen.findByTestId('user')).toHaveTextContent('u1');

    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    expect(await screen.findByTestId('status')).toHaveTextContent('loading');
    pending.resolve({ userId: 'u3' });
    expect(await screen.findByTestId('user')).toHaveTextContent('u3');
  });
});
