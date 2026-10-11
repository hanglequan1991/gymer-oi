// Kiểm thử màn Tìm Gymer: cổng vị trí, bộ lọc, trạng thái tải/lỗi/rỗng, điều hướng.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { SearchPage } from './SearchPage';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { useSearchFilters, useUserLocation } from '@/stores';
import { AppError } from '@/services';
import type { Gymer } from '@/types/domain';

const CENTER = { lat: 10.776, lng: 106.7 };

function makeGymer(overrides: Partial<Gymer> = {}): Gymer {
  return {
    id: 'g-01',
    name: 'Minh An',
    gender: 'male',
    age: 25,
    area: 'Quận 1',
    distanceKm: 0.8,
    rating: 4.8,
    reviewCount: 12,
    priceWeekday: 150_000,
    priceWeekend: 200_000,
    tags: ['Gym'],
    bio: '',
    ...overrides,
  };
}

const GYMERS = [makeGymer(), makeGymer({ id: 'g-02', name: 'Thu Hà', gender: 'female', age: 28 })];

beforeEach(() => {
  useSearchFilters.getState().reset();
  useUserLocation.getState().clear();
});

afterEach(() => {
  cleanup();
});

describe('SearchPage: cổng vị trí', () => {
  it('chưa có vị trí: hiện màn xin vị trí và không gọi tìm kiếm', () => {
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });

    expect(screen.getByText('Gymer ơi cần vị trí của bạn để tìm Gymer quanh bạn')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cho phép vị trí' })).toBeTruthy();
    expect(search).not.toHaveBeenCalled();
  });

  it('bấm cho phép: lấy vị trí, lưu vào store và tìm với bán kính 2 km', async () => {
    const getCurrent = vi.fn().mockResolvedValue(CENTER);
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, {
      services: createStubServices({ location: { getCurrent }, gymers: { search } }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cho phép vị trí' }));

    expect(await screen.findByText('Tìm thấy 2 Gymer')).toBeTruthy();
    expect(getCurrent).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({ center: CENTER, radiusKm: 2 });
    expect(useUserLocation.getState().point).toEqual(CENTER);
    expect(useUserLocation.getState().source).toBe('gps');
  });

  it('từ chối quyền: hiện thông báo theo ngữ cảnh vị trí và Thử lại gọi lại việc lấy vị trí', async () => {
    const getCurrent = vi
      .fn()
      .mockRejectedValueOnce(new AppError('FORBIDDEN', 'denied'))
      .mockResolvedValueOnce(CENTER);
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, {
      services: createStubServices({ location: { getCurrent }, gymers: { search } }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cho phép vị trí' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Chưa có quyền vị trí/)).toBeTruthy();
    expect(search).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Tìm thấy 2 Gymer')).toBeTruthy();
    expect(getCurrent).toHaveBeenCalledTimes(2);
  });

  it('có vị trí sẵn trong store: tìm ngay, không hiện cổng vị trí', async () => {
    useUserLocation.getState().setPoint(CENTER, 'gps');
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });

    expect(await screen.findByText('Tìm thấy 2 Gymer')).toBeTruthy();
    expect(screen.queryByTestId('location-gate')).toBeNull();
    expect(search).toHaveBeenCalledWith({ center: CENTER, radiusKm: 2 });
  });
});

describe('SearchPage: khu vực dự phòng (C1b)', () => {
  const Q1 = { lat: 10.7769, lng: 106.7009 };

  it('chưa thử GPS (idle) thì chưa hiện lối chọn khu vực', () => {
    renderPage(<SearchPage />, { services: createStubServices() });

    expect(screen.queryByRole('radiogroup', { name: 'Chọn khu vực TP.HCM' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Quận 1' })).toBeNull();
  });

  it('từ chối quyền: hiện lối chọn khu vực; chọn quận thì tìm đúng toạ độ trung tâm và đánh dấu nguồn thủ công', async () => {
    const getCurrent = vi.fn().mockRejectedValue(new AppError('FORBIDDEN', 'denied'));
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, {
      services: createStubServices({ location: { getCurrent }, gymers: { search } }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cho phép vị trí' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Chọn khu vực TP.HCM' })).toBeTruthy();
    expect(search).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'Quận 1' }));

    expect(await screen.findByText('Tìm thấy 2 Gymer')).toBeTruthy();
    expect(search).toHaveBeenCalledWith({ center: Q1, radiusKm: 2 });
    expect(useUserLocation.getState().source).toBe('manual');
    expect(screen.getByText('Đang tìm quanh Quận 1')).toBeTruthy();
    expect(screen.queryByTestId('location-gate')).toBeNull();
  });

  it('lỗi GPS (không phải từ chối quyền) cũng hiện lối chọn khu vực', async () => {
    const getCurrent = vi.fn().mockRejectedValue(new AppError('NETWORK', 'offline'));
    renderPage(<SearchPage />, {
      services: createStubServices({ location: { getCurrent } }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cho phép vị trí' }));

    expect(await screen.findByRole('radio', { name: 'Gò Vấp' })).toBeTruthy();
  });

  it('đang đặt thủ công: "Dùng vị trí hiện tại" gọi lại lấy GPS và đổi nguồn sang gps', async () => {
    useUserLocation.getState().setPoint(Q1, 'manual');
    const getCurrent = vi.fn().mockResolvedValue(CENTER);
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, {
      services: createStubServices({ location: { getCurrent }, gymers: { search } }),
    });

    await screen.findByText('Tìm thấy 2 Gymer');
    fireEvent.click(screen.getByRole('button', { name: 'Dùng vị trí hiện tại' }));

    await waitFor(() => expect(useUserLocation.getState().source).toBe('gps'));
    expect(getCurrent).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Đang tìm quanh/)).toBeNull();
  });

  it('đang đặt thủ công và GPS lỗi: giữ khu vực đã chọn, báo lỗi và vẫn tìm được', async () => {
    useUserLocation.getState().setPoint(Q1, 'manual');
    const getCurrent = vi.fn().mockRejectedValue(new AppError('FORBIDDEN', 'denied'));
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, {
      services: createStubServices({ location: { getCurrent }, gymers: { search } }),
    });

    await screen.findByText('Tìm thấy 2 Gymer');
    fireEvent.click(screen.getByRole('button', { name: 'Dùng vị trí hiện tại' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Đang tìm quanh Quận 1')).toBeTruthy();
    expect(useUserLocation.getState().point).toEqual(Q1);
    expect(useUserLocation.getState().source).toBe('manual');
  });
});

describe('SearchPage: bộ lọc gửi đúng tham số', () => {
  beforeEach(() => {
    useUserLocation.getState().setPoint(CENTER, 'gps');
  });

  it('"Từ 4★", "20-30 tuổi", "Dưới 200k" gửi đúng minRating, ageMin/ageMax, maxPrice', async () => {
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });
    await screen.findByText('Tìm thấy 2 Gymer');

    fireEvent.click(screen.getByRole('button', { name: 'Từ 4★' }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ minRating: 4 })));

    fireEvent.click(screen.getByRole('button', { name: '20-30 tuổi' }));
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ ageMin: 20, ageMax: 30, minRating: 4 })),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dưới 200k' }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ maxPrice: 200_000 })));
  });

  it('chọn giới tính Nữ gửi gender female; bấm lại thì bỏ lọc', async () => {
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });
    await screen.findByText('Tìm thấy 2 Gymer');

    fireEvent.click(screen.getByRole('radio', { name: 'Nữ' }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ gender: 'female' })));

    fireEvent.click(screen.getByRole('radio', { name: 'Nữ' }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith({ center: CENTER, radiusKm: 2 }));
  });

  it('đổi bán kính sang 5 km gọi lại với radiusKm 5', async () => {
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });
    await screen.findByText('Tìm thấy 2 Gymer');

    fireEvent.click(screen.getByRole('radio', { name: '5 km' }));

    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ radiusKm: 5 })));
    expect(screen.getByText('Trong 5 km')).toBeTruthy();
  });

  it('từ khoá được gõ rồi mới tìm sau khoảng trễ, không tìm theo từng ký tự', async () => {
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });
    await screen.findByText('Tìm thấy 2 Gymer');
    search.mockClear();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm Gymer' }), { target: { value: 'yoga' } });

    expect(search).not.toHaveBeenCalled();
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'yoga' })));
    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe('SearchPage: trạng thái và điều hướng', () => {
  beforeEach(() => {
    useUserLocation.getState().setPoint(CENTER, 'gps');
  });

  it('không có kết quả: hiện trạng thái rỗng và "Tăng bán kính" tìm lại với bán kính kế tiếp', async () => {
    const search = vi.fn().mockResolvedValue([]);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });

    expect(await screen.findByText('Chưa tìm thấy Gymer phù hợp')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tăng bán kính' }));

    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ radiusKm: 3 })));
  });

  it('ở 5 km thì không còn nút "Tăng bán kính"', async () => {
    useSearchFilters.getState().setRadius(5);
    const search = vi.fn().mockResolvedValue([]);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });

    expect(await screen.findByText('Chưa tìm thấy Gymer phù hợp')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tăng bán kính' })).toBeNull();
  });

  it('lỗi tải: hiện ErrorView và Thử lại gọi lại tìm kiếm', async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new AppError('NETWORK', 'x'))
      .mockResolvedValueOnce(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Không tải được danh sách Gymer. Kiểm tra mạng rồi thử lại.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Tìm thấy 2 Gymer')).toBeTruthy();
  });

  it('có 50 kết quả thì hiện ghi chú chỉ hiển thị 50 Gymer gần nhất', async () => {
    const many = Array.from({ length: 50 }, (_, i) => makeGymer({ id: `g-${i}`, name: `Gymer ${i}` }));
    const search = vi.fn().mockResolvedValue(many);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });

    expect(await screen.findByText('Tìm thấy 50 Gymer')).toBeTruthy();
    expect(screen.getByText('Chỉ hiển thị 50 Gymer gần nhất')).toBeTruthy();
  });

  it('bấm thẻ Gymer chuyển sang hồ sơ Gymer', async () => {
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });
    await screen.findByText('Tìm thấy 2 Gymer');

    fireEvent.click(screen.getByRole('button', { name: /Thu Hà/ }));

    await waitFor(() => expect(window.location.pathname).toBe('/gymers/g-02'));
  });

  it('nút "Lịch của tôi" và "Dành cho Gymer" điều hướng đúng', async () => {
    const search = vi.fn().mockResolvedValue(GYMERS);
    renderPage(<SearchPage />, { services: createStubServices({ gymers: { search } }) });
    await screen.findByText('Tìm thấy 2 Gymer');

    fireEvent.click(screen.getByRole('button', { name: 'Lịch của tôi' }));
    await waitFor(() => expect(window.location.pathname).toBe('/me/bookings'));

    fireEvent.click(screen.getByRole('button', { name: 'Dành cho Gymer' }));
    await waitFor(() => expect(window.location.pathname).toBe('/gymer'));
  });
});
