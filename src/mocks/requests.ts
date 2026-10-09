// Dữ liệu mock yêu cầu đặt lịch, ngày 17/10/2026 và lân cận. Gồm 3 chờ duyệt, 1 đã xác nhận, 1 đã từ chối.
import type { BookingRequest } from '@/types/domain';

/** Tạo ISO string từ giờ địa phương (month 0-based). */
function localIso(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month, day, hour, minute).toISOString();
}

/** Mỗi buổi kéo dài 1 giờ. */
function oneHourAfter(startIso: string): string {
  return new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
}

const startHoangNam = localIso(2026, 9, 17, 9);
const startThuTrang = localIso(2026, 9, 13, 18);
const startMinhQuan = localIso(2026, 9, 15, 7);
const startDucAnh = localIso(2026, 9, 18, 16);
const startBaoNgoc = localIso(2026, 9, 14, 19);

export const MOCK_REQUESTS: BookingRequest[] = [
  {
    id: 'req-hoang-nam',
    customerName: 'Hoàng Nam',
    start: startHoangNam,
    end: oneHourAfter(startHoangNam),
    goal: 'Tăng cơ',
    note: 'Lần đầu tập với PT, mong được hướng dẫn kỹ thuật cơ bản.',
    price: 220_000,
    status: 'pending',
    isNew: true,
  },
  {
    id: 'req-thu-trang',
    customerName: 'Thu Trang',
    start: startThuTrang,
    end: oneHourAfter(startThuTrang),
    goal: 'Giảm mỡ',
    price: 180_000,
    status: 'pending',
  },
  {
    id: 'req-duc-anh',
    customerName: 'Đức Anh',
    start: startDucAnh,
    end: oneHourAfter(startDucAnh),
    goal: 'Gym',
    note: 'Muốn đổi sang khung giờ chiều nếu được.',
    price: 220_000,
    status: 'pending',
  },
  {
    id: 'req-minh-quan',
    customerName: 'Minh Quân',
    start: startMinhQuan,
    end: oneHourAfter(startMinhQuan),
    goal: 'Gym',
    price: 180_000,
    status: 'confirmed',
  },
  {
    id: 'req-bao-ngoc',
    customerName: 'Bảo Ngọc',
    start: startBaoNgoc,
    end: oneHourAfter(startBaoNgoc),
    goal: 'Yoga',
    price: 180_000,
    status: 'rejected',
  },
];
