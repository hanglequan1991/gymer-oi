// Test luồng tổng (plan app-ui-integration, Z1): ghép các trang qua AppRoutes với services giả có trạng thái
// trong bộ nhớ. Không mạng, không Supabase. Mỗi ca có một "backend" nhỏ dùng chung cho các vai trò của ca đó.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SnackbarProvider } from 'zmp-ui';
import { AppRoutes } from './index';
import { AppProviders } from '@/providers';
import { SessionContext, type SessionApi } from '@/hooks';
import { createFakePlatform } from '@/platform/fake';
import { createStubServices } from '@/test/stubServices';
import { AppError, type BookingCreateInput, type Services } from '@/services';
import { useBookingDraft, useSearchFilters, useUserLocation } from '@/stores';
import type {
  BookingRequest,
  BookingStatus,
  DayInfo,
  Gymer,
  GymerAccountStatus,
  MyBooking,
  RequestStatus,
  Slot,
} from '@/types/domain';
import type { GeoPoint } from '@/types/geo';

const READY_SESSION: SessionApi = {
  state: { status: 'ready', userId: 'test-user' },
  retry: async () => undefined,
  reauthenticate: async () => undefined,
  signOut: async () => undefined,
};

/** Người dùng đang đăng nhập trong ca test; là khách khi đặt lịch và là Gymer sau khi đăng ký. */
const CURRENT_USER = 'test-user';
const CUSTOMER_NAME = 'Khách A';
const HEALTH_NOTE = 'đau lưng nhẹ';

const POINT: GeoPoint = { lat: 10.7769, lng: 106.7009 };

const GYMER: Gymer = {
  id: 'g-01',
  name: 'Minh Trần',
  gender: 'male',
  age: 30,
  area: 'Quận 1',
  distanceKm: 1.2,
  rating: 4.8,
  reviewCount: 12,
  priceWeekday: 200_000,
  priceWeekend: 250_000,
  tags: ['Gym'],
  bio: 'Huấn luyện viên tập gym.',
};

/** Khung 09:00 ngày 17/10/2026 (Thứ 7) là khung duy nhất còn trống. */
const SLOT_0900: Slot = { id: '2026-10-17T09:00', time: '09:00', state: 'available' };

/** Giá theo ngày của cả tháng: T7/CN dùng giá cuối tuần. Tháng dùng 1-12. */
function monthDays(year: number, month: number): DayInfo[] {
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, month - 1, i + 1);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return { date, price: weekend ? GYMER.priceWeekend : GYMER.priceWeekday, marker: 'open' as const };
  });
}

/** Một dòng lượt đặt trong bộ nhớ, đủ trường để phía khách và phía Gymer cùng đọc. */
interface FakeBooking {
  id: string;
  customerId: string;
  customerName: string;
  gymerId: string;
  start: string;
  end: string;
  price: number;
  goal?: string;
  healthNote?: string;
  shareHealthNote: boolean;
  status: BookingStatus;
  expiresAt?: string;
}

/** Chỉ cần một khách đặt lịch có ghi chú sức khoẻ không được chia sẻ. */
function seededRequest(id: string, customerName: string, start: string, extra: Partial<FakeBooking> = {}): FakeBooking {
  return {
    id,
    customerId: `customer-${id}`,
    customerName,
    gymerId: GYMER.id,
    start,
    end: start.replace('T07:00', 'T08:00').replace('T18:00', 'T19:00'),
    price: GYMER.priceWeekday,
    shareHealthNote: false,
    status: 'pending',
    expiresAt: '2026-10-12T10:00:00+07:00',
    ...extra,
  };
}

function toMyBooking(b: FakeBooking): MyBooking {
  return {
    id: b.id,
    gymerId: b.gymerId,
    gymerName: GYMER.name,
    start: b.start,
    end: b.end,
    price: b.price,
    goal: b.goal,
    status: b.status,
    expiresAt: b.expiresAt,
    reviewed: false,
  };
}

/**
 * Phía Gymer chỉ thấy ghi chú khi khách đã chia sẻ (shared_with_gymer). Hàm này mô phỏng hợp đồng đó
 * của mapper: nếu chưa chia sẻ thì note là undefined. Lưu ý: đây là hợp đồng của fake, không phải RLS thật.
 */
function toRequest(b: FakeBooking): BookingRequest {
  return {
    id: b.id,
    customerName: b.customerName,
    start: b.start,
    end: b.end,
    goal: b.goal,
    note: b.shareHealthNote ? b.healthNote : undefined,
    price: b.price,
    status: b.status as RequestStatus,
    expiresAt: b.expiresAt,
  };
}

interface BackendSeed {
  bookings?: FakeBooking[];
  /** Trạng thái Gymer ban đầu. null = chưa là Gymer. Có giá trị thì gymerId cũng là g-01. */
  gymerStatus?: GymerAccountStatus | null;
}

/** Backend giả dùng chung cho mọi vai trò trong một ca test. Mỗi method là vi.fn để kiểm lời gọi. */
function createBackend(seed: BackendSeed = {}) {
  const state: {
    gymerStatus: GymerAccountStatus | null;
    gymerId: string | undefined;
    bookings: FakeBooking[];
    seq: number;
  } = {
    gymerStatus: seed.gymerStatus ?? null,
    gymerId: seed.gymerStatus ? GYMER.id : undefined,
    bookings: seed.bookings ?? [],
    seq: 0,
  };

  function findBooking(id: string): FakeBooking {
    const found = state.bookings.find((b) => b.id === id);
    if (!found) throw new AppError('NOT_FOUND', 'Không tìm thấy lượt đặt.');
    return found;
  }

  function requireGymer(): GymerAccountStatus {
    if (!state.gymerStatus) throw new AppError('FORBIDDEN', 'Chưa là Gymer.');
    return state.gymerStatus;
  }

  const fns = {
    getCurrent: vi.fn(async (): Promise<GeoPoint> => POINT),
    search: vi.fn(async () => [GYMER]),
    getDetail: vi.fn(async () => ({ gymer: GYMER, certificates: [], reviews: [] })),
    getMonth: vi.fn(async (_id: string, year: number, month: number) => monthDays(year, month)),
    getDaySlots: vi.fn(async () => [SLOT_0900]),
    create: vi.fn(async (input: BookingCreateInput) => {
      state.seq += 1;
      const id = `b-${state.seq}`;
      state.bookings.push({
        id,
        customerId: CURRENT_USER,
        customerName: CUSTOMER_NAME,
        gymerId: input.gymerId,
        start: input.startIso,
        end: input.endIso,
        price: input.expectedPrice,
        goal: input.goal,
        healthNote: input.note,
        shareHealthNote: input.shareHealthNote ?? false,
        status: 'pending',
        expiresAt: '2026-10-12T10:00:00+07:00',
      });
      return { bookingId: id };
    }),
    getMine: vi.fn(async (id: string) => toMyBooking(findBooking(id))),
    listMine: vi.fn(async () => state.bookings.filter((b) => b.customerId === CURRENT_USER).map(toMyBooking)),
    cancel: vi.fn(async (id: string) => {
      findBooking(id).status = 'cancelled';
    }),
    getMyStatus: vi.fn(async () => (state.gymerStatus ? { ...state.gymerStatus } : null)),
    becomeGymer: vi.fn(async () => {
      state.gymerStatus = { isListed: false, acceptsRequests: false, hasLocation: false };
      state.gymerId = GYMER.id;
    }),
    profileGetMine: vi.fn(async () => ({ gymer: GYMER, certificates: [], reviews: [] })),
    setLocation: vi.fn(async () => {
      requireGymer().hasLocation = true;
    }),
    setVisibility: vi.fn(async (patch: { isListed?: boolean; acceptsRequests?: boolean }) => {
      const s = requireGymer();
      // Luật server: không bật hiển thị khi chưa có vị trí.
      if (patch.isListed && !s.hasLocation) throw new AppError('VALIDATION', 'Hãy đặt vị trí phòng tập trước.');
      Object.assign(s, patch);
    }),
    requestsList: vi.fn(async () =>
      state.bookings.filter((b) => b.gymerId === state.gymerId && b.status !== 'cancelled').map(toRequest),
    ),
    respond: vi.fn(async (id: string, decision: 'confirmed' | 'rejected') => {
      const b = findBooking(id);
      b.status = decision;
      return toRequest(b);
    }),
  };

  const services: Services = createStubServices({
    location: { getCurrent: fns.getCurrent },
    gymers: { search: fns.search, getDetail: fns.getDetail },
    schedule: { getMonth: fns.getMonth, getDaySlots: fns.getDaySlots },
    bookings: { create: fns.create, getMine: fns.getMine, listMine: fns.listMine, cancel: fns.cancel },
    profile: {
      getMyStatus: fns.getMyStatus,
      becomeGymer: fns.becomeGymer,
      getMine: fns.profileGetMine,
      setLocation: fns.setLocation,
      setVisibility: fns.setVisibility,
    },
    requests: { list: fns.requestsList, respond: fns.respond },
  });

  return { services, fns, state };
}

function renderApp(route: string, services: Services) {
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

/** Chờ tiêu đề trang đúng trong header của trang (có thể còn header của trang cũ đang chuyển cảnh). */
async function expectHeader(title: string) {
  await waitFor(() => {
    const headers = screen.getAllByTestId('page-header');
    expect(headers.some((h) => within(h).queryByText(title) !== null)).toBe(true);
  });
}

/** Khách: từ tìm kiếm tới khi màn "Đã gửi yêu cầu" hiện ra, với khung 09:00 Thứ 7 17/10. */
async function bookFromSearch() {
  fireEvent.click(await screen.findByRole('button', { name: 'Cho phép vị trí' }));
  fireEvent.click(await screen.findByRole('button', { name: /Minh Trần/ }));
  await expectHeader('Chi tiết Gymer');
  fireEvent.click(await screen.findByRole('gridcell', { name: /Thứ 7, 17 tháng 10/ }));
  fireEvent.click(await screen.findByRole('button', { name: '09:00, còn trống' }));
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));

  await expectHeader('Xác nhận đặt lịch');
  fireEvent.change(await screen.findByLabelText(/Mục tiêu tập luyện/), { target: { value: 'Giảm 5kg' } });
  fireEvent.change(screen.getByLabelText(/Ghi chú sức khỏe/), { target: { value: HEALTH_NOTE } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
  await screen.findByText('Đã gửi yêu cầu');
}

/** Điền form Trở thành Gymer và gửi. */
async function joinAsGymer() {
  await expectHeader('Trở thành Gymer');
  fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Minh Trần' } });
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Chọn giới tính' })).getByRole('radio', { name: 'Nam' }));
  fireEvent.change(screen.getByLabelText('Năm sinh'), { target: { value: '1995' } });
  fireEvent.change(screen.getByLabelText('Khu vực'), { target: { value: 'Quận 1' } });
  fireEvent.change(screen.getByLabelText('Giá buổi tập ngày thường (T2-T6)'), { target: { value: '200000' } });
  fireEvent.change(screen.getByLabelText('Giá buổi tập cuối tuần (T7-CN)'), { target: { value: '250000' } });
  fireEvent.click(within(screen.getByRole('group', { name: 'Chọn chuyên môn' })).getByRole('button', { name: 'Gym' }));
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký làm Gymer' }));
  await waitFor(() => expect(window.location.pathname).toBe('/gymer/profile'));
}

beforeEach(() => {
  // Ngày cố định để lịch tháng 10/2026 và ngày "hôm nay" ổn định; cùng cách với SchedulePage.test.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T10:00:00+07:00'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.pushState({}, '', '/');
  useBookingDraft.getState().clear();
  useUserLocation.getState().clear();
  useSearchFilters.getState().reset();
});

describe('Luồng 1: khách tìm, đặt lịch, thấy trong Lịch của tôi, rồi huỷ', () => {
  it('đi hết từ tìm kiếm tới huỷ lịch, và gửi đúng dữ liệu đặt', async () => {
    const backend = createBackend();
    renderApp('/', backend.services);

    await bookFromSearch();

    // Giá cuối tuần cho T7 và không chia sẻ ghi chú sức khoẻ với Gymer.
    expect(backend.fns.create).toHaveBeenCalledTimes(1);
    expect(backend.fns.create).toHaveBeenCalledWith(
      expect.objectContaining({
        gymerId: GYMER.id,
        startIso: expect.stringContaining('2026-10-17T09:00'),
        expectedPrice: 250_000,
        goal: 'Giảm 5kg',
        note: HEALTH_NOTE,
        shareHealthNote: false,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xem lịch của tôi' }));
    await expectHeader('Lịch của tôi');
    expect(await screen.findByText('Chờ duyệt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ lịch' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ lịch' }));

    expect(await screen.findByText('Chưa có lịch sắp tới')).toBeInTheDocument();
    expect(backend.fns.cancel).toHaveBeenCalledWith('b-1');
    expect(backend.state.bookings[0]?.status).toBe('cancelled');
  });

  it('huỷ trong hộp thoại "Giữ lịch" thì lịch vẫn còn', async () => {
    const backend = createBackend({
      bookings: [seededRequest('b-keep', CUSTOMER_NAME, '2026-10-18T07:00:00+07:00', { customerId: CURRENT_USER, gymerId: GYMER.id })],
    });
    renderApp('/me/bookings', backend.services);

    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ lịch' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Giữ lịch' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(backend.fns.cancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Huỷ lịch' })).toBeInTheDocument();
  });
});

describe('Luồng 2: người mới trở thành Gymer, đặt vị trí, bật hiển thị', () => {
  it('chưa là Gymer thì /gymer chuyển sang form, gửi xong thì sang hồ sơ và bật hiển thị', async () => {
    const backend = createBackend({ gymerStatus: null });
    renderApp('/gymer', backend.services);

    await joinAsGymer();
    expect(backend.fns.becomeGymer).toHaveBeenCalledTimes(1);

    const location = await screen.findByTestId('profile-location');
    expect(within(location).getByText('Chưa đặt vị trí')).toBeInTheDocument();
    fireEvent.click(within(location).getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' }));
    expect(await within(location).findByText('Đã đặt vị trí (làm tròn khoảng 100 m)')).toBeInTheDocument();
    expect(backend.fns.setLocation).toHaveBeenCalledWith(POINT);
    // Toạ độ không được hiện ở bất kỳ đâu trên màn.
    expect(document.body.textContent).not.toMatch(/10[.,]77|106[.,]70/);

    const listed = screen.getByLabelText(/Hiển thị hồ sơ với khách/);
    expect(listed).not.toBeChecked();
    fireEvent.click(listed);

    await waitFor(() => expect(backend.fns.setVisibility).toHaveBeenCalledWith({ isListed: true }));
    await waitFor(() => expect(screen.getByLabelText(/Hiển thị hồ sơ với khách/)).toBeChecked());
  });

  it('bật hiển thị khi chưa có vị trí thì server từ chối, công tắc không đổi', async () => {
    const backend = createBackend({ gymerStatus: { isListed: false, acceptsRequests: false, hasLocation: false } });
    renderApp('/gymer/profile', backend.services);

    const listed = await screen.findByLabelText(/Hiển thị hồ sơ với khách/);
    fireEvent.click(listed);

    await waitFor(() => expect(backend.fns.setVisibility).toHaveBeenCalledWith({ isListed: true }));
    await waitFor(() => expect(screen.getByLabelText(/Hiển thị hồ sơ với khách/)).not.toBeChecked());
  });
});

describe('Luồng 3: Gymer xem yêu cầu, xác nhận và từ chối; ghi chú sức khoẻ không hiện', () => {
  it('xác nhận một yêu cầu và từ chối một yêu cầu, ghi chú chưa chia sẻ không hiện', async () => {
    const backend = createBackend({
      gymerStatus: { isListed: true, acceptsRequests: true, hasLocation: true },
      bookings: [
        seededRequest('r1', 'Lan Phạm', '2026-10-18T07:00:00+07:00', {
          goal: 'Tăng cơ',
          healthNote: 'Đau gối',
          shareHealthNote: false,
        }),
        seededRequest('r2', 'Hoàng Nguyễn', '2026-10-19T18:00:00+07:00'),
      ],
    });
    renderApp('/gymer/requests', backend.services);

    expect(await screen.findByRole('radio', { name: 'Chờ duyệt (2)' })).toBeInTheDocument();
    // Ghi chú sức khoẻ chưa chia sẻ không được hiện; mục tiêu thì hiện.
    expect(screen.queryByText(/Đau gối/)).not.toBeInTheDocument();
    expect(screen.getByText('Mục tiêu: Tăng cơ')).toBeInTheDocument();

    const lan = screen.getByRole('article', { name: 'Yêu cầu của Lan Phạm' });
    fireEvent.click(within(lan).getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Đã xác nhận yêu cầu.')).toBeInTheDocument();
    expect(backend.fns.respond).toHaveBeenCalledWith('r1', 'confirmed');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Chờ duyệt (1)' })).toBeInTheDocument());

    const hoang = screen.getByRole('article', { name: 'Yêu cầu của Hoàng Nguyễn' });
    fireEvent.click(within(hoang).getByRole('button', { name: 'Từ chối' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));

    expect(await screen.findByText('Đã từ chối yêu cầu.')).toBeInTheDocument();
    expect(backend.fns.respond).toHaveBeenCalledWith('r2', 'rejected');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Chờ duyệt (0)' })).toBeInTheDocument());
    expect(screen.getByRole('radio', { name: 'Đã xác nhận (1)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Đã từ chối (1)' })).toBeInTheDocument();
  });
});

describe('Ghi chú sức khoẻ: trạng thái hiện tại của trang Yêu cầu', () => {
  // G4 luôn render RequestCard ở chế độ compact (ẩn ghi chú), kể cả khi khách đã chia sẻ.
  // Khi Đợt 9-10 mở chia sẻ thì ca này phải được viết lại.
  it('ghi chú đã chia sẻ vẫn bị ẩn ở trang Yêu cầu (compact), chỉ hiện mục tiêu', async () => {
    const backend = createBackend({
      gymerStatus: { isListed: true, acceptsRequests: true, hasLocation: true },
      bookings: [
        seededRequest('r3', 'Mai Lê', '2026-10-20T07:00:00+07:00', {
          goal: 'Giảm mỡ',
          healthNote: 'Đau gối',
          shareHealthNote: true,
        }),
      ],
    });
    renderApp('/gymer/requests', backend.services);

    const card = await screen.findByRole('article', { name: 'Yêu cầu của Mai Lê' });
    expect(within(card).getByText('Mục tiêu: Giảm mỡ')).toBeInTheDocument();
    expect(within(card).queryByText('Đau gối')).not.toBeInTheDocument();
  });
});

describe('Luồng 4: khách đặt lịch rồi chính người đó đăng ký Gymer và xử lý yêu cầu', () => {
  it('ghi chú sức khoẻ khách gửi không xuất hiện ở phía Gymer, và yêu cầu được xác nhận', async () => {
    const backend = createBackend({ gymerStatus: null });
    renderApp('/', backend.services);

    await bookFromSearch();
    expect(backend.fns.create).toHaveBeenCalledWith(expect.objectContaining({ shareHealthNote: false, note: HEALTH_NOTE }));

    fireEvent.click(screen.getByRole('button', { name: 'Về trang tìm kiếm' }));
    await expectHeader('Tìm Gymer');
    fireEvent.click(await screen.findByRole('button', { name: 'Dành cho Gymer' }));

    await joinAsGymer();
    const tabBar = document.querySelector<HTMLElement>('.gy-tab-bar');
    if (!tabBar) throw new Error('Không thấy thanh tab Gymer');
    fireEvent.click(within(tabBar).getByText('Yêu cầu'));
    await expectHeader('Yêu cầu');

    const card = await screen.findByRole('article', { name: `Yêu cầu của ${CUSTOMER_NAME}` });
    expect(within(card).getByText('Mục tiêu: Giảm 5kg')).toBeInTheDocument();
    expect(screen.queryByText(HEALTH_NOTE)).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText('Đã xác nhận yêu cầu.')).toBeInTheDocument();
    expect(backend.fns.respond).toHaveBeenCalledWith('b-1', 'confirmed');
    expect(backend.state.bookings[0]?.status).toBe('confirmed');
  });
});
