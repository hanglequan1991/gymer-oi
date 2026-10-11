import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { BecomeGymerPage } from './BecomeGymerPage';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { createFakePlatform } from '@/platform/fake';
import { createFakeAuth } from '@/platform/fake/fakeAuth';
import { AppError } from '@/services/errors';
import type { Services } from '@/services';
import type { BecomeGymerInput, GymerAccountStatus } from '@/types/domain';
import { PATHS } from '@/routes/paths';
import { currentYearVN } from '../validation';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

const READY: GymerAccountStatus = { isListed: true, acceptsRequests: true, hasLocation: true };
const WEEKDAY = 'Giá buổi tập ngày thường (T2-T6)';
const WEEKEND = 'Giá buổi tập cuối tuần (T7-CN)';

/** Services giả: getMyStatus theo tham số, becomeGymer mặc định thành công. */
function servicesWith(opts: {
  getMyStatus?: () => Promise<GymerAccountStatus | null>;
  becomeGymer?: (input: BecomeGymerInput) => Promise<void>;
} = {}): Services {
  return createStubServices({
    profile: {
      getMyStatus: vi.fn(opts.getMyStatus ?? (async () => null)),
      becomeGymer: vi.fn(opts.becomeGymer ?? (async () => undefined)),
    },
  });
}

/** Platform với hồ sơ Zalo có tên và ảnh cố định. */
function zaloPlatform() {
  return createFakePlatform({
    auth: createFakeAuth({ profile: { zaloId: '42', name: 'Gymer An', avatarUrl: 'https://example.com/a.png' } }),
  });
}

function renderJoin(services: Services, platform = zaloPlatform()) {
  return renderPage(<BecomeGymerPage />, { services, platform, route: PATHS.gymerJoin });
}

/** Điền đủ form hợp lệ (trừ tên, để test giữ tên lấy từ Zalo hoặc tự nhập). */
function fillRest() {
  fireEvent.click(screen.getByRole('radio', { name: 'Nam' }));
  fireEvent.change(screen.getByLabelText('Năm sinh'), { target: { value: '1995' } });
  fireEvent.change(screen.getByLabelText('Khu vực'), { target: { value: 'Quận 3' } });
  fireEvent.change(screen.getByLabelText(WEEKDAY), { target: { value: '300000' } });
  fireEvent.change(screen.getByLabelText(WEEKEND), { target: { value: '400000' } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký làm Gymer' }));
}

describe('BecomeGymerPage: chuyển hướng và trạng thái tải', () => {
  it('đã là Gymer thì chuyển sang tổng quan và không hiện form', async () => {
    renderJoin(servicesWith({ getMyStatus: async () => READY }));
    await waitFor(() => expect(window.location.pathname).toBe(PATHS.gymerOverview));
    expect(screen.queryByLabelText('Năm sinh')).not.toBeInTheDocument();
  });

  it('đang kiểm tra trạng thái thì hiện "Đang tải..." và tiêu đề', async () => {
    renderJoin(servicesWith({ getMyStatus: () => new Promise<null>(() => {}) }));
    expect(within(screen.getByTestId('page-header')).getByText('Trở thành Gymer')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
  });

  it('lỗi tải trạng thái hiện thông báo lỗi và không hiện form', async () => {
    renderJoin(servicesWith({ getMyStatus: async () => Promise.reject(new AppError('NETWORK', 'x')) }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByLabelText('Năm sinh')).not.toBeInTheDocument();
  });
});

describe('BecomeGymerPage: điền sẵn từ Zalo', () => {
  it('điền sẵn tên hiển thị từ hồ sơ Zalo', async () => {
    renderJoin(servicesWith());
    const name = await screen.findByLabelText('Tên hiển thị');
    // Hồ sơ Zalo tới sau lần render đầu nên chờ giá trị được điền.
    await waitFor(() => expect(name).toHaveValue('Gymer An'));
  });

  it('lỗi lấy hồ sơ Zalo không chặn form: ô tên để trống và vẫn nhập được', async () => {
    const platform = createFakePlatform({
      auth: { login: async () => ({ zaloAccessToken: 't' }), getProfile: async () => Promise.reject(new Error('x')) },
    });
    renderJoin(servicesWith(), platform);
    const name = await screen.findByLabelText('Tên hiển thị');
    expect(name).toHaveValue('');
    fireEvent.change(name, { target: { value: 'Tự nhập' } });
    expect(name).toHaveValue('Tự nhập');
  });
});

describe('BecomeGymerPage: kiểm đầu vào', () => {
  it('tên rỗng báo lỗi sau khi bấm gửi và không gọi becomeGymer', async () => {
    const services = servicesWith();
    renderJoin(services);
    const name = await screen.findByLabelText('Tên hiển thị');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Khu vực'), { target: { value: 'Quận 3' } });
    fillRest();
    submit();
    expect(await screen.findByText('Vui lòng nhập tên hiển thị.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(services.profile.becomeGymer).not.toHaveBeenCalled();
  });

  it('chưa bấm gửi thì chưa hiện lỗi', async () => {
    renderJoin(servicesWith());
    await screen.findByLabelText('Tên hiển thị');
    expect(screen.queryByText('Vui lòng nhập tên hiển thị.')).not.toBeInTheDocument();
  });

  it('chưa chọn giới tính báo lỗi', async () => {
    renderJoin(servicesWith());
    await screen.findByLabelText('Tên hiển thị');
    submit();
    expect(await screen.findByText('Vui lòng chọn giới tính.')).toBeInTheDocument();
  });

  it('18 tuổi hợp lệ nhưng 17 tuổi bị báo "Bạn cần từ 18 tuổi trở lên."', async () => {
    renderJoin(servicesWith());
    const birth = await screen.findByLabelText('Năm sinh');
    fireEvent.change(birth, { target: { value: String(currentYearVN() - 17) } });
    submit();
    expect(await screen.findByText('Bạn cần từ 18 tuổi trở lên.')).toBeInTheDocument();

    fireEvent.change(birth, { target: { value: String(currentYearVN() - 18) } });
    await waitFor(() => expect(screen.queryByText('Bạn cần từ 18 tuổi trở lên.')).not.toBeInTheDocument());
  });

  it('năm sinh trước 1940 bị báo không hợp lệ', async () => {
    renderJoin(servicesWith());
    fireEvent.change(await screen.findByLabelText('Năm sinh'), { target: { value: '1939' } });
    submit();
    expect(await screen.findByText('Năm sinh không hợp lệ.')).toBeInTheDocument();
  });

  it('giá để trống báo lỗi', async () => {
    renderJoin(servicesWith());
    await screen.findByLabelText('Tên hiển thị');
    submit();
    expect(await screen.findAllByText('Vui lòng nhập giá.')).toHaveLength(2);
  });

  it('giá vượt 5.000.000 đ bị báo lỗi khoảng giá', async () => {
    renderJoin(servicesWith());
    fireEvent.change(await screen.findByLabelText(WEEKDAY), { target: { value: '5000001' } });
    submit();
    expect(await screen.findByText('Giá phải từ 0 đến 5.000.000 đ.')).toBeInTheDocument();
  });

  it('khu vực quá 100 ký tự bị báo lỗi', async () => {
    renderJoin(servicesWith());
    fireEvent.change(await screen.findByLabelText('Khu vực'), { target: { value: 'a'.repeat(101) } });
    submit();
    expect(await screen.findByText('Khu vực tối đa 100 ký tự.')).toBeInTheDocument();
  });
});

describe('BecomeGymerPage: gửi đăng ký', () => {
  it('form hợp lệ gọi becomeGymer đúng đối số kèm ảnh Zalo, rồi sang hồ sơ', async () => {
    const services = servicesWith();
    renderJoin(services);
    await screen.findByLabelText('Tên hiển thị');
    fillRest();
    fireEvent.click(screen.getByRole('radio', { name: 'Nữ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yoga' }));
    submit();

    await waitFor(() => expect(window.location.pathname).toBe(PATHS.gymerProfile));
    expect(services.profile.becomeGymer).toHaveBeenCalledTimes(1);
    expect(services.profile.becomeGymer).toHaveBeenCalledWith({
      name: 'Gymer An',
      gender: 'female',
      birthYear: 1995,
      area: 'Quận 3',
      priceWeekday: 300000,
      priceWeekend: 400000,
      tags: ['Yoga'],
      avatarUrl: 'https://example.com/a.png',
    });
  });

  it('bấm đúp chỉ gọi becomeGymer một lần', async () => {
    let finish: () => void = () => {};
    const services = servicesWith({
      becomeGymer: () => new Promise<void>((resolve) => (finish = resolve)),
    });
    renderJoin(services);
    await screen.findByLabelText('Tên hiển thị');
    fillRest();
    const button = screen.getByRole('button', { name: 'Đăng ký làm Gymer' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(services.profile.becomeGymer).toHaveBeenCalledTimes(1);
    finish();
  });

  it('lỗi VALIDATION từ server hiện đúng câu thông báo và ở lại form', async () => {
    const services = servicesWith({
      becomeGymer: async () => {
        throw new AppError('VALIDATION', 'x');
      },
    });
    renderJoin(services);
    await screen.findByLabelText('Tên hiển thị');
    fillRest();
    submit();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Thông tin chưa hợp lệ. Tên 1-50 ký tự, khu vực 1-100 ký tự, giới thiệu tối đa 1000 ký tự, và bạn phải từ 18 tuổi.');
    expect(window.location.pathname).toBe(PATHS.gymerJoin);
    expect(screen.getByRole('button', { name: 'Đăng ký làm Gymer' })).not.toBeDisabled();
  });
});
