import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { GymerTabsLayout } from './GymerTabsLayout';
import { useGymerStatus } from '@/hooks/useGymerStatus';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { AppError } from '@/services/errors';
import type { Services } from '@/services';
import type { GymerAccountStatus } from '@/types/domain';

// jsdom không có Element.scrollTo; zmp-ui Page gọi hàm này khi mount.
beforeAll(() => {
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

const READY: GymerAccountStatus = { isListed: true, acceptsRequests: true, hasLocation: true };

type ProfileStub = Partial<Services['profile']>;

/** Nội dung con đọc trạng thái qua hook, để kiểm tra context được cấp. */
function StatusProbe() {
  const { status } = useGymerStatus();
  return <p>{status.isListed ? 'Đang hiện' : 'Đang ẩn'}</p>;
}

/** Nút làm mới gọi refresh() của context. */
function RefreshButton() {
  const { refresh } = useGymerStatus();
  return <button onClick={refresh}>Làm mới</button>;
}

function renderLayout(profile: ProfileStub, children = <p>Nội dung trang</p>, route = '/gymer/overview') {
  const services = createStubServices({ profile });
  return renderPage(
    <GymerTabsLayout activeKey="overview" title="Tổng quan">
      {children}
    </GymerTabsLayout>,
    { services, route },
  );
}

function expectHeader(title: string) {
  const header = screen.getByTestId('page-header');
  expect(within(header).getByText(title)).toBeInTheDocument();
}

describe('GymerTabsLayout: trạng thái tải', () => {
  it('hiển thị tiêu đề và "Đang tải..." khi chưa có trạng thái', () => {
    renderLayout({ getMyStatus: vi.fn(() => new Promise<GymerAccountStatus | null>(() => {})) });
    expectHeader('Tổng quan');
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
    expect(screen.queryByText('Nội dung trang')).not.toBeInTheDocument();
    expect(screen.queryByText('Lịch và giá')).not.toBeInTheDocument();
  });

  it('không chuyển trang khi đang tải', () => {
    renderLayout({ getMyStatus: vi.fn(() => new Promise<GymerAccountStatus | null>(() => {})) });
    expect(window.location.pathname).toBe('/gymer/overview');
  });

  it('gọi getMyStatus đúng một lần khi mount', async () => {
    const getMyStatus = vi.fn(async () => READY);
    renderLayout({ getMyStatus });
    await screen.findByText('Nội dung trang');
    expect(getMyStatus).toHaveBeenCalledTimes(1);
  });
});

describe('GymerTabsLayout: là Gymer', () => {
  it('hiển thị nội dung và thanh tab khi đã là Gymer', async () => {
    renderLayout({ getMyStatus: vi.fn(async () => READY) });
    expect(await screen.findByText('Nội dung trang')).toBeInTheDocument();
    expect(screen.getByText('Lịch và giá')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu')).toBeInTheDocument();
    expect(screen.getByText('Hồ sơ')).toBeInTheDocument();
  });

  it('cấp trạng thái cho nội dung qua useGymerStatus', async () => {
    renderLayout({ getMyStatus: vi.fn(async () => READY) }, <StatusProbe />);
    expect(await screen.findByText('Đang hiện')).toBeInTheDocument();
  });

  it('refresh() tải lại trạng thái và giữ nguyên nội dung', async () => {
    const getMyStatus = vi.fn(async () => READY);
    renderLayout({ getMyStatus }, <><p>Nội dung trang</p><RefreshButton /></>);
    fireEvent.click(await screen.findByRole('button', { name: 'Làm mới' }));
    await waitFor(() => expect(getMyStatus).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Nội dung trang')).toBeInTheDocument();
  });

  it('bấm tab khác chuyển đến /gymer/<khoá tab>', async () => {
    renderLayout({ getMyStatus: vi.fn(async () => READY) });
    fireEvent.click(await screen.findByText('Lịch và giá'));
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/schedule'));
  });
});

describe('GymerTabsLayout: guard khu Gymer', () => {
  it('chuyển sang /gymer/join khi tài khoản chưa là Gymer', async () => {
    renderLayout({ getMyStatus: vi.fn(async () => null) });
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/join'));
    expect(screen.queryByText('Nội dung trang')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lỗi mạng hiện ErrorView kèm tiêu đề và nút Thử lại', async () => {
    const getMyStatus = vi.fn(async () => {
      throw new AppError('NETWORK', 'mất mạng');
    });
    renderLayout({ getMyStatus });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expectHeader('Tổng quan');
    expect(screen.queryByText('Nội dung trang')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/gymer/overview');
  });

  it('bấm Thử lại sau lỗi mạng thì tải lại và hiện nội dung', async () => {
    const getMyStatus = vi
      .fn<() => Promise<GymerAccountStatus | null>>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'mất mạng'))
      .mockResolvedValueOnce(READY);
    renderLayout({ getMyStatus });
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Nội dung trang')).toBeInTheDocument();
    expect(getMyStatus).toHaveBeenCalledTimes(2);
  });

  it('lỗi thì không tự chuyển sang trang đăng ký', async () => {
    renderLayout({ getMyStatus: vi.fn(async () => { throw new AppError('NETWORK', 'mất mạng'); }) });
    await screen.findByRole('alert');
    expect(window.location.pathname).toBe('/gymer/overview');
  });
});

describe('useGymerStatus', () => {
  it('ném lỗi rõ ràng khi dùng ngoài GymerTabsLayout', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderPage(<StatusProbe />)).toThrow('useGymerStatus phải được dùng bên trong GymerTabsLayout.');
    } finally {
      consoleError.mockRestore();
    }
  });
});
