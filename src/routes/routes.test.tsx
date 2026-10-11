import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { SnackbarProvider } from 'zmp-ui';
import { AppRoutes } from './index';
import { PATHS, booking, bookingSuccess, gymerDetail } from './paths';
import { useBookingDraft } from '@/stores';
import { AppProviders } from '@/providers';
import { SessionContext, type SessionApi } from '@/hooks';
import { createFakePlatform } from '@/platform/fake';
import { createStubServices } from '@/test/stubServices';
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
  // Nháp đặt lịch là store toàn cục: xoá để ca sau không thừa hưởng.
  useBookingDraft.getState().clear();
});

/** Nháp đầy đủ cho Gymer g-01, khung giờ hợp lệ theo định dạng "<YYYY-MM-DD>T<HH:mm>". */
function seedBookingDraft(gymerId = 'g-01') {
  useBookingDraft.getState().setDraft({ gymerId, dateIso: '2026-10-17', slotId: '2026-10-17T09:00' });
}

const READY: GymerAccountStatus = { isListed: true, acceptsRequests: true, hasLocation: true };

/** Phiên giả đã đăng nhập: ErrorView cần SessionContext, test không chờ đăng nhập Zalo. */
const READY_SESSION: SessionApi = {
  state: { status: 'ready', userId: 'test-user' },
  retry: async () => undefined,
  reauthenticate: async () => undefined,
  signOut: async () => undefined,
};

/**
 * Render toàn bộ khai báo route. Không dùng renderPage vì AppRoutes đã tự có ZMPRouter
 * (routes/index.tsx là nơi duy nhất ghép router); bọc thêm sẽ lồng hai Router.
 */
function renderRoutes(route: string, services: Services = createStubServices()) {
  // ZMPRouter dùng BrowserRouter, đọc URL lúc mount nên phải đặt trước khi render.
  window.history.pushState({}, '', route);
  return render(
    <SnackbarProvider>
      <AppProviders services={services} platform={createFakePlatform()}>
        <SessionContext.Provider value={READY_SESSION}>
          <AppRoutes />
        </SessionContext.Provider>
      </AppProviders>
    </SnackbarProvider>,
  );
}

/** Stub profile: getMyStatus theo tham số, các hàm khác để mặc định (từ chối NOT_IMPLEMENTED). */
function profileWith(getMyStatus: () => Promise<GymerAccountStatus | null>) {
  return createStubServices({ profile: { getMyStatus: vi.fn(getMyStatus) } });
}

/**
 * Chờ tới khi tiêu đề đúng xuất hiện và (mặc định) trạng thái tải đã biến mất:
 * header tạm lúc tải bị thay bằng header của trang khi có dữ liệu, nên chỉ kiểm tiêu đề là chưa đủ.
 * Ca đang tải truyền loaded: false để chờ đúng lúc còn role="status".
 */
async function expectPageTitle(title: string, { loaded = true }: { loaded?: boolean } = {}) {
  await waitFor(() => {
    const header = screen.getByTestId('page-header');
    expect(within(header).getByText(title)).toBeInTheDocument();
    if (loaded) expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
}

const TABS: ReadonlyArray<readonly [string, string]> = [
  ['/gymer/overview', 'Tổng quan'],
  ['/gymer/schedule', 'Lịch và giá'],
  ['/gymer/requests', 'Yêu cầu'],
  ['/gymer/profile', 'Hồ sơ'],
];

describe('AppRoutes: khu khách (không cần quyền Gymer)', () => {
  it.each([
    ['/', 'Tìm Gymer'],
    [gymerDetail('g-01'), 'Chi tiết Gymer'],
    [bookingSuccess('b-07'), 'Đặt lịch thành công'],
    [PATHS.myBookings, 'Lịch của tôi'],
    [PATHS.gymerJoin, 'Trở thành Gymer'],
  ])('hiển thị đúng tiêu đề tại %s', async (path, title) => {
    renderRoutes(path);
    expect(window.location.pathname).toBe(path);
    await expectPageTitle(title);
  });

  it('hiển thị trang xác nhận đặt lịch khi có nháp khớp Gymer', async () => {
    seedBookingDraft('g-01');
    renderRoutes(booking('g-01'));
    expect(window.location.pathname).toBe('/gymers/g-01/book');
    await expectPageTitle('Xác nhận đặt lịch');
  });

  it('thiếu nháp thì chuyển từ xác nhận đặt lịch về chi tiết Gymer', async () => {
    renderRoutes(booking('g-01'));
    await waitFor(() => expect(window.location.pathname).toBe('/gymers/g-01'));
    await expectPageTitle('Chi tiết Gymer');
  });

  it('hiển thị trang chi tiết Gymer với tham số gymerId', async () => {
    renderRoutes(gymerDetail('g-01'));
    expect(window.location.pathname).toBe('/gymers/g-01');
    await expectPageTitle('Chi tiết Gymer');
  });

  it('trang /gymer/join không đi qua guard khu Gymer: chỉ chính trang gọi getMyStatus một lần', async () => {
    const getMyStatus = vi.fn(async () => null);
    renderRoutes(PATHS.gymerJoin, createStubServices({ profile: { getMyStatus } }));
    await expectPageTitle('Trở thành Gymer');
    expect(getMyStatus).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/gymer/join');
  });

  it('đã là Gymer thì /gymer/join chuyển sang tổng quan', async () => {
    renderRoutes(PATHS.gymerJoin, profileWith(async () => READY));
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/overview'));
    await expectPageTitle('Tổng quan');
  });
});

describe('AppRoutes: khu Gymer khi là Gymer', () => {
  it.each(TABS)('hiển thị tab tại %s', async (path, title) => {
    renderRoutes(path, profileWith(async () => READY));
    await expectPageTitle(title);
    expect(window.location.pathname).toBe(path);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('chuyển /gymer sang /gymer/overview', async () => {
    renderRoutes('/gymer', profileWith(async () => READY));
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/overview'));
    await expectPageTitle('Tổng quan');
  });
});

describe('AppRoutes: khu Gymer khi chưa là Gymer', () => {
  it.each(TABS)('chuyển %s sang /gymer/join', async (path) => {
    renderRoutes(path, profileWith(async () => null));
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/join'));
    await expectPageTitle('Trở thành Gymer');
  });

  it('/gymer đi qua tổng quan rồi tới /gymer/join', async () => {
    renderRoutes('/gymer', profileWith(async () => null));
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/join'));
  });
});

describe('AppRoutes: trạng thái tải và lỗi của khu Gymer vẫn có tiêu đề', () => {
  it.each(TABS)('đang tải tại %s vẫn có tiêu đề', async (path, title) => {
    renderRoutes(path, profileWith(() => new Promise<GymerAccountStatus | null>(() => {})));
    await expectPageTitle(title, { loaded: false });
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
  });

  it.each(TABS)('lỗi tại %s vẫn có tiêu đề và thông báo lỗi', async (path, title) => {
    // Stub mặc định từ chối NOT_IMPLEMENTED: layout phải hiện lỗi, không trắng trang.
    renderRoutes(path);
    await expectPageTitle(title);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('đường dẫn tạo sẵn', () => {
  it('mã hoá tham số động', () => {
    expect(gymerDetail('a/b')).toBe('/gymers/a%2Fb');
    expect(booking('g-01')).toBe('/gymers/g-01/book');
    expect(bookingSuccess('b-07')).toBe('/bookings/b-07/success');
  });
});
