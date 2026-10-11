// Chuỗi tab Lịch và giá của khu Gymer (task G3a, G3b).
export const gymerSchedule = {
  title: 'Lịch và giá',
  prices: {
    title: 'Giá mặc định',
    hint: 'Giá này áp dụng cho các ngày chưa có giá riêng.',
    weekday: 'Ngày thường (T2-T6)',
    weekend: 'Cuối tuần (T7-CN)',
    save: 'Lưu giá',
    saved: 'Đã lưu giá mặc định',
    required: 'Hãy nhập giá',
    range: 'Giá phải từ 0 đến 5.000.000đ',
  },
  calendar: {
    title: 'Lịch tháng',
    pickHint: 'Chọn một ngày trên lịch để xem và đóng hoặc mở khung giờ.',
  },
  day: {
    hint: 'Chạm khung giờ để đóng hoặc mở. Khung đã có khách đặt không đóng được.',
    empty: 'Ngày này chưa có khung giờ.',
  },
} as const;
