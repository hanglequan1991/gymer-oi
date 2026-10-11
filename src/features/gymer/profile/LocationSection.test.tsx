import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { LocationSection } from './LocationSection';
import { ProfilePage } from './pages/ProfilePage';
import { GymerStatusContext } from '@/hooks/useGymerStatus';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { AppError } from '@/services/errors';
import type { GymerAccountStatus } from '@/types/domain';
import type { GeoPoint } from '@/types/geo';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

const NO_LOCATION: GymerAccountStatus = { isListed: false, acceptsRequests: true, hasLocation: false };
const HAS_LOCATION: GymerAccountStatus = { isListed: false, acceptsRequests: true, hasLocation: true };
const POINT: GeoPoint = { lat: 10.776, lng: 106.701 };

interface SetupOptions {
  status?: GymerAccountStatus;
  getCurrent?: ReturnType<typeof vi.fn>;
  setLocation?: ReturnType<typeof vi.fn>;
}

/** Dựng mục vị trí trong context trạng thái giả; trả về các mock để kiểm tra. */
function setup(opts: SetupOptions = {}) {
  const getCurrent = opts.getCurrent ?? vi.fn().mockResolvedValue(POINT);
  const setLocation = opts.setLocation ?? vi.fn().mockResolvedValue(undefined);
  const refresh = vi.fn();
  const services = createStubServices({ location: { getCurrent }, profile: { setLocation } });
  renderPage(
    <GymerStatusContext.Provider value={{ status: opts.status ?? NO_LOCATION, refresh }}>
      <LocationSection />
    </GymerStatusContext.Provider>,
    { services },
  );
  return { getCurrent, setLocation, refresh };
}

describe('LocationSection (G5b)', () => {
  it('chưa đặt vị trí: hiện trạng thái chưa đặt, nút đặt lần đầu và lưu ý nhà riêng', () => {
    setup({ status: NO_LOCATION });
    expect(screen.getByText('Chưa đặt vị trí')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' })).toBeEnabled();
    expect(screen.getByText('Không nhập địa chỉ nhà riêng')).toBeInTheDocument();
  });

  it('đã đặt vị trí: hiện trạng thái đã đặt (làm tròn) và nút Đặt lại', () => {
    setup({ status: HAS_LOCATION });
    expect(screen.getByText('Đã đặt vị trí (làm tròn khoảng 100 m)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đặt lại' })).toBeInTheDocument();
  });

  it('thành công: lấy vị trí rồi gọi setLocation đúng điểm, báo đã lưu và tải lại trạng thái', async () => {
    const mocks = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' }));
    await waitFor(() => expect(mocks.setLocation).toHaveBeenCalledWith(POINT));
    expect(mocks.getCurrent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setLocation.mock.invocationCallOrder[0],
    );
    expect(await screen.findByText('Đã lưu địa điểm')).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('chặn bấm đúp: lúc đang lấy vị trí chỉ gọi getCurrent một lần và nút hiện trạng thái đang lấy', async () => {
    const getCurrent = vi.fn(() => new Promise<GeoPoint>(() => {}));
    setup({ getCurrent });
    const button = screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' });
    fireEvent.click(button);
    fireEvent.click(button);
    const busy = await screen.findByRole('button', { name: 'Đang lấy vị trí...' });
    expect(busy).toBeDisabled();
    expect(getCurrent).toHaveBeenCalledTimes(1);
  });

  it('từ chối quyền vị trí: hiện lỗi danger kèm nút Thử lại, không gọi setLocation', async () => {
    const mocks = setup({ getCurrent: vi.fn().mockRejectedValue(new AppError('FORBIDDEN', 'x')) });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa có quyền vị trí');
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
    expect(mocks.setLocation).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('bấm Thử lại sau khi bị từ chối sẽ gọi lại getCurrent', async () => {
    const getCurrent = vi
      .fn()
      .mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'))
      .mockResolvedValueOnce(POINT);
    const mocks = setup({ getCurrent });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(mocks.setLocation).toHaveBeenCalledWith(POINT));
    expect(getCurrent).toHaveBeenCalledTimes(2);
  });

  it('lỗi mạng khi lấy vị trí: báo toast theo ngữ cảnh vị trí, không lưu, nút bấm lại được', async () => {
    const mocks = setup({ getCurrent: vi.fn().mockRejectedValue(new AppError('NETWORK', 'x')) });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' }));
    expect(await screen.findByText('Chưa lấy được vị trí. Kiểm tra mạng rồi thử lại.')).toBeInTheDocument();
    expect(mocks.setLocation).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' })).toBeEnabled();
  });

  it('lỗi khi lưu vị trí: báo toast theo ngữ cảnh hồ sơ và không tải lại trạng thái', async () => {
    const mocks = setup({ setLocation: vi.fn().mockRejectedValue(new AppError('UNKNOWN', 'x')) });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' }));
    expect(await screen.findByText('Đã có lỗi xảy ra. Vui lòng thử lại sau.')).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('DOM không chứa toạ độ sau khi lưu', async () => {
    const mocks = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' }));
    await screen.findByText('Đã lưu địa điểm');
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('10.776');
    expect(text).not.toContain('106.701');
    expect(document.body.innerHTML).not.toContain('10.776');
  });

  it('sau khi lưu, công tắc Hiển thị trên trang hồ sơ được mở khoá (tải lại trạng thái)', async () => {
    const getMyStatus = vi
      .fn()
      .mockResolvedValueOnce(NO_LOCATION)
      .mockResolvedValue(HAS_LOCATION);
    const services = createStubServices({
      profile: {
        getMyStatus,
        getMine: vi.fn().mockResolvedValue({
          gymer: {
            id: 'g1',
            name: 'Minh Anh',
            gender: 'female',
            age: 28,
            area: 'Quận 1',
            distanceKm: 0.5,
            rating: 4.8,
            reviewCount: 12,
            priceWeekday: 350000,
            priceWeekend: 420000,
            tags: ['Gym'],
            bio: '',
          },
          certificates: [],
          reviews: [],
        }),
        setLocation: vi.fn().mockResolvedValue(undefined),
      },
      location: { getCurrent: vi.fn().mockResolvedValue(POINT) },
    });
    renderPage(<ProfilePage />, { services, route: '/gymer/profile' });
    const listed = await screen.findByRole('checkbox', { name: /Hiển thị hồ sơ với khách/ });
    expect(listed).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt vị trí hiện tại làm vị trí phòng tập' }));
    await waitFor(() => expect(getMyStatus).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Hiển thị hồ sơ với khách/ })).toBeEnabled(),
    );
  });
});
