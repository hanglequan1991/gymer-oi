import { createElement, useEffect, useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNavigate } from 'zmp-ui';
import { useServices } from '@/hooks';
import { useToast } from '@/components/ui/feedback';
import { AppError } from '@/services';
import { renderPage } from './renderWithProviders';
import { createStubServices } from './stubServices';

describe('createStubServices', () => {
  it('method chưa ghi đè ném AppError NOT_IMPLEMENTED', async () => {
    const services = createStubServices();
    const err = await services.bookings.listMine().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('NOT_IMPLEMENTED');
  });

  it('method được ghi đè chạy đúng, các method khác vẫn ném NOT_IMPLEMENTED', async () => {
    const listMine = vi.fn().mockResolvedValue([]);
    const services = createStubServices({ bookings: { listMine } });

    await expect(services.bookings.listMine()).resolves.toEqual([]);
    expect(listMine).toHaveBeenCalledTimes(1);

    await expect(services.bookings.cancel('b-1')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('cùng một method trả về cùng một tham chiếu (để so sánh hoặc spy)', () => {
    const services = createStubServices();
    expect(services.gymers.search).toBe(services.gymers.search);
  });

  it('không làm treo await khi await chính đối tượng services', async () => {
    const services = createStubServices();
    await expect(Promise.resolve(services)).resolves.toBe(services);
  });

  it('ghi đè một repository không làm ảnh hưởng repository khác', async () => {
    const services = createStubServices({ profile: { getMyStatus: vi.fn().mockResolvedValue(null) } });
    await expect(services.profile.getMyStatus()).resolves.toBeNull();
    await expect(services.schedule.setDayOverrides([], {})).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });
});

/**
 * Thành phần thử: một nút chuyển trang và một nút hiện toast, dùng đúng hai hook của app.
 * Viết bằng createElement vì file này là .ts (tên theo plan), không có JSX.
 */
function Probe() {
  const navigate = useNavigate();
  const toast = useToast();
  return createElement(
    'div',
    null,
    createElement(
      'button',
      { type: 'button', onClick: () => navigate('/gymer/requests') },
      'Chuyển trang',
    ),
    createElement(
      'button',
      { type: 'button', onClick: () => toast.success('Đã lưu thành công') },
      'Hiện thông báo',
    ),
  );
}

describe('renderPage', () => {
  it('đặt URL theo route trước khi render', () => {
    renderPage(createElement(Probe), { route: '/search' });
    expect(window.location.pathname).toBe('/search');
  });

  it('cung cấp router, toast và services để useNavigate, useToast chạy được', async () => {
    renderPage(createElement(Probe), { route: '/search' });

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển trang' }));
    expect(window.location.pathname).toBe('/gymer/requests');

    fireEvent.click(screen.getByRole('button', { name: 'Hiện thông báo' }));
    expect(await screen.findByText('Đã lưu thành công')).toBeInTheDocument();
  });

  it('đưa services giả vào context: useServices() lấy được và method chưa cài báo NOT_IMPLEMENTED', async () => {
    function ServicesProbe() {
      const services = useServices();
      const [code, setCode] = useState('đang gọi');
      useEffect(() => {
        services.bookings
          .listMine()
          .then(() => setCode('thành công'))
          .catch((e: AppError) => setCode(e.code));
      }, [services]);
      return createElement('p', null, code);
    }
    renderPage(createElement(ServicesProbe));
    await waitFor(() => expect(screen.getByText('NOT_IMPLEMENTED')).toBeInTheDocument());
  });

  it('URL được đưa về "/" sau ca trước', () => {
    expect(window.location.pathname).toBe('/');
  });
});
