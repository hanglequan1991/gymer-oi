import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { AppRoutes } from './index';
import { booking, bookingSuccess, gymerDetail } from './paths';

// jsdom không có Element.scrollTo; zmp-ui Page gọi hàm này khi mount.
beforeAll(() => {
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
});

/** ZMPRouter mặc định dùng BrowserRouter, nên đặt URL bằng history trước khi render. */
function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<AppRoutes />);
}

function expectPageTitle(title: string) {
  const header = screen.getByTestId('page-header');
  expect(within(header).getByText(title)).toBeInTheDocument();
}

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

describe('AppRoutes', () => {
  it('hiển thị trang tìm kiếm ở /', () => {
    renderAt('/');
    expectPageTitle('Tìm Gymer');
  });

  it('hiển thị trang chi tiết Gymer với tham số gymerId', () => {
    renderAt(gymerDetail('g-01'));
    expect(window.location.pathname).toBe('/gymers/g-01');
    expectPageTitle('Chi tiết Gymer');
  });

  it('hiển thị trang xác nhận đặt lịch ở /gymers/:gymerId/book', () => {
    renderAt(booking('g-01'));
    expectPageTitle('Xác nhận đặt lịch');
  });

  it('hiển thị trang đặt lịch thành công với tham số bookingId', () => {
    renderAt(bookingSuccess('b-07'));
    expectPageTitle('Đặt lịch thành công');
  });

  it.each([
    ['/gymer/schedule', 'Lịch và giá'],
    ['/gymer/requests', 'Yêu cầu'],
    ['/gymer/profile', 'Hồ sơ'],
  ])('hiển thị đúng tiêu đề tại %s', (path, title) => {
    renderAt(path);
    expectPageTitle(title);
  });

  it('chuyển /gymer sang /gymer/overview', async () => {
    renderAt('/gymer');
    await waitFor(() => expect(window.location.pathname).toBe('/gymer/overview'));
    expectPageTitle('Tổng quan');
  });
});

describe('đường dẫn tạo sẵn', () => {
  it('mã hoá tham số động', () => {
    expect(gymerDetail('a/b')).toBe('/gymers/a%2Fb');
    expect(booking('g-01')).toBe('/gymers/g-01/book');
    expect(bookingSuccess('b-07')).toBe('/bookings/b-07/success');
  });
});
