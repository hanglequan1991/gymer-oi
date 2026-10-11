import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ProfilePage } from './ProfilePage';
import { renderPage } from '@/test/renderWithProviders';
import { createStubServices } from '@/test/stubServices';
import { AppError } from '@/services/errors';
import type { Services } from '@/services';
import type { Certificate, GymerAccountStatus } from '@/types/domain';
import type { GymerDetail } from '@/services/repositories/gymerRepository';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

const READY: GymerAccountStatus = { isListed: true, acceptsRequests: true, hasLocation: true };
const NO_LOCATION: GymerAccountStatus = { isListed: false, acceptsRequests: true, hasLocation: false };

function detail(overrides: Partial<GymerDetail['gymer']> = {}, certificates: Certificate[] = []): GymerDetail {
  return {
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
      bio: 'Huấn luyện viên sức mạnh.',
      ...overrides,
    },
    certificates,
    reviews: [],
  };
}

interface SetupOptions {
  status?: GymerAccountStatus;
  detailValue?: GymerDetail;
  getMine?: ReturnType<typeof vi.fn>;
  setVisibility?: ReturnType<typeof vi.fn>;
  updateMine?: ReturnType<typeof vi.fn>;
  addCertificate?: ReturnType<typeof vi.fn>;
  removeCertificate?: ReturnType<typeof vi.fn>;
}

function setup(opts: SetupOptions = {}) {
  const getMyStatus = vi.fn().mockResolvedValue(opts.status ?? READY);
  const getMine = opts.getMine ?? vi.fn().mockResolvedValue(opts.detailValue ?? detail());
  const setVisibility = opts.setVisibility ?? vi.fn().mockResolvedValue(undefined);
  const updateMine = opts.updateMine ?? vi.fn().mockResolvedValue(detail().gymer);
  const addCertificate =
    opts.addCertificate ?? vi.fn().mockResolvedValue({ id: 'new', name: 'PT Level 1' } satisfies Certificate);
  const removeCertificate = opts.removeCertificate ?? vi.fn().mockResolvedValue(undefined);
  const services: Services = createStubServices({
    profile: { getMyStatus, getMine, setVisibility, updateMine, addCertificate, removeCertificate },
  });
  renderPage(<ProfilePage />, { services, route: '/gymer/profile' });
  return { getMyStatus, getMine, setVisibility, updateMine, addCertificate, removeCertificate };
}

describe('ProfilePage (G5a)', () => {
  it('hiện trạng thái loading trước khi có dữ liệu', () => {
    setup({ getMine: vi.fn(() => new Promise(() => {})) });
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
    expect(screen.getByTestId('page-header')).toHaveTextContent('Hồ sơ');
  });

  it('hiện lỗi khi không tải được hồ sơ', async () => {
    setup({ getMine: vi.fn().mockRejectedValue(new AppError('NETWORK', 'x')) });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('ghép đủ các mục theo thứ tự: tóm tắt, hiển thị, thông tin, chuyên môn, chứng chỉ', async () => {
    setup();
    await screen.findByTestId('profile-summary');
    const order = ['profile-summary', 'profile-visibility', 'profile-info', 'profile-specialties', 'profile-certificates'];
    const nodes = order.map((id) => screen.getByTestId(id));
    for (let i = 1; i < nodes.length; i += 1) {
      expect(nodes[i - 1].compareDocumentPosition(nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('chưa có vị trí thì công tắc hiển thị bị vô hiệu và có lý do trong DOM', async () => {
    setup({ status: NO_LOCATION });
    const listed = await screen.findByRole('checkbox', { name: /Hiển thị hồ sơ với khách/ });
    expect(listed).toBeDisabled();
    expect(screen.getByText('Hãy đặt vị trí phòng tập trước')).toBeInTheDocument();
  });

  it('bật hiển thị gọi setVisibility rồi tải lại trạng thái', async () => {
    const mocks = setup({ status: { ...READY, isListed: false } });
    const listed = await screen.findByRole('checkbox', { name: /Hiển thị hồ sơ với khách/ });
    fireEvent.click(listed);
    await waitFor(() => expect(mocks.setVisibility).toHaveBeenCalledWith({ isListed: true }));
    await waitFor(() => expect(mocks.getMyStatus).toHaveBeenCalledTimes(2));
  });

  it('lỗi khi đổi công tắc thì báo lỗi và không tải lại trạng thái', async () => {
    const mocks = setup({
      setVisibility: vi.fn().mockRejectedValue(new AppError('VALIDATION', 'x')),
    });
    const requests = await screen.findByRole('checkbox', { name: /Nhận yêu cầu đặt lịch/ });
    fireEvent.click(requests);
    expect(await screen.findByText(/Thông tin chưa hợp lệ/)).toBeInTheDocument();
    expect(mocks.getMyStatus).toHaveBeenCalledTimes(1);
  });

  it('tắt nhận yêu cầu gọi setVisibility đúng patch', async () => {
    const mocks = setup();
    const requests = await screen.findByRole('checkbox', { name: /Nhận yêu cầu đặt lịch/ });
    fireEvent.click(requests);
    await waitFor(() => expect(mocks.setVisibility).toHaveBeenCalledWith({ acceptsRequests: false }));
  });

  it('nút lưu thông tin chỉ bật khi có thay đổi', async () => {
    setup();
    await screen.findByTestId('profile-info');
    const save = screen.getByRole('button', { name: 'Lưu thông tin' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Tên hiển thị/), { target: { value: 'Minh Anh Pro' } });
    expect(save).toBeEnabled();
  });

  it('lưu thông tin chỉ gửi trường đã đổi', async () => {
    const mocks = setup();
    await screen.findByTestId('profile-info');
    fireEvent.change(screen.getByLabelText(/Khu vực/), { target: { value: 'Quận 3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));
    await waitFor(() => expect(mocks.updateMine).toHaveBeenCalledWith({ area: 'Quận 3' }));
  });

  it('tên quá 50 ký tự báo lỗi và khoá nút lưu', async () => {
    setup();
    await screen.findByTestId('profile-info');
    fireEvent.change(screen.getByLabelText(/Tên hiển thị/), { target: { value: 'a'.repeat(51) } });
    expect(screen.getByText('Tên tối đa 50 ký tự')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu thông tin' })).toBeDisabled();
  });

  it('giới thiệu hiện bộ đếm ký tự và quá 1000 ký tự thì báo lỗi', async () => {
    setup();
    await screen.findByTestId('profile-info');
    expect(screen.getByText(/\/1000 ký tự/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Giới thiệu/), { target: { value: 'b'.repeat(1001) } });
    expect(screen.getByText('Giới thiệu tối đa 1000 ký tự')).toBeInTheDocument();
  });

  it('lỗi VALIDATION khi lưu thông tin hiện đúng câu ngữ cảnh hồ sơ', async () => {
    setup({ updateMine: vi.fn().mockRejectedValue(new AppError('VALIDATION', 'x')) });
    await screen.findByTestId('profile-info');
    fireEvent.change(screen.getByLabelText(/Tên hiển thị/), { target: { value: 'Mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));
    expect(await screen.findByText(/Tên 1-50 ký tự, khu vực 1-100 ký tự/)).toBeInTheDocument();
  });

  it('đổi chuyên môn rồi lưu gửi đúng tags', async () => {
    const mocks = setup();
    await screen.findByTestId('profile-specialties');
    const save = screen.getByRole('button', { name: 'Lưu chuyên môn' });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Yoga' }));
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateMine).toHaveBeenCalledWith({ tags: ['Gym', 'Yoga'] }));
  });

  it('chứng chỉ có nhãn "Tự khai" và không có chữ "xác minh"', async () => {
    setup({ detailValue: detail({}, [{ id: 'c1', name: 'HLV Gym cấp 1' }]) });
    const section = await screen.findByTestId('profile-certificates');
    expect(within(section).getByText('HLV Gym cấp 1')).toBeInTheDocument();
    expect(within(section).getByText('Tự khai')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/xác minh/i);
  });

  it('thêm chứng chỉ: để trống thì báo lỗi, nhập tên thì gọi addCertificate', async () => {
    const mocks = setup();
    await screen.findByTestId('profile-certificates');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm chứng chỉ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    expect(screen.getByText('Hãy nhập tên chứng chỉ')).toBeInTheDocument();
    expect(mocks.addCertificate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Tên chứng chỉ/), { target: { value: 'PT Level 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng chỉ' }));
    await waitFor(() => expect(mocks.addCertificate).toHaveBeenCalledWith('PT Level 1'));
  });

  it('xoá chứng chỉ phải qua hộp thoại xác nhận rồi mới gọi removeCertificate', async () => {
    const mocks = setup({ detailValue: detail({}, [{ id: 'c1', name: 'HLV Gym cấp 1' }]) });
    await screen.findByText('HLV Gym cấp 1');
    fireEvent.click(screen.getByRole('button', { name: 'Xoá HLV Gym cấp 1' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Xoá chứng chỉ này?' });
    expect(mocks.removeCertificate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xoá' }));
    await waitFor(() => expect(mocks.removeCertificate).toHaveBeenCalledWith('c1'));
  });

  it('đủ 10 chứng chỉ thì không thêm được và có lý do', async () => {
    const certs: Certificate[] = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `Chứng chỉ ${i}` }));
    setup({ detailValue: detail({}, certs) });
    await screen.findByTestId('profile-certificates');
    expect(screen.getByRole('button', { name: 'Thêm chứng chỉ' })).toBeDisabled();
    expect(screen.getByText('Bạn đã có đủ 10 chứng chỉ, hãy xoá bớt để thêm mới.')).toBeInTheDocument();
  });
});
