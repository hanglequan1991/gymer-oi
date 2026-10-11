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
  // Giá riêng và đóng/mở cả ngày, áp dụng cho ngày đang chọn (G3b).
  override: {
    priceLabel: 'Giá riêng cho ngày này',
    priceHint: 'Để trống rồi lưu để bỏ giá riêng và dùng giá mặc định.',
    current: (price: string) => `Ngày này đang có giá riêng ${price}.`,
    openLabel: 'Nhận lịch cả ngày',
    openHint: 'Tắt để đóng cả ngày. Khung đã có khách đặt vẫn giữ nguyên.',
    save: 'Lưu cho ngày này',
    saved: 'Đã lưu cho ngày này',
    skipped: 'Ngày này đã có lịch đặt nên chưa đóng được.',
  },
  // Áp dụng hàng loạt cho các ngày trong tháng đang xem (G3b).
  bulk: {
    open: 'Áp dụng hàng loạt',
    title: 'Áp dụng hàng loạt',
    hint: 'Chỉ áp dụng cho các ngày từ hôm nay trở đi trong tháng đang xem. Ngày đã qua không đổi.',
    groupLabel: 'Nhóm ngày',
    groups: { weekday: 'Ngày thường (T2-T6)', weekend: 'Cuối tuần (T7-CN)', all: 'Tất cả' },
    actionLabel: 'Hành động',
    actions: { setPrice: 'Đặt giá riêng', clearPrice: 'Bỏ giá riêng', close: 'Đóng ngày', open: 'Mở ngày' },
    priceLabel: 'Giá riêng',
    summary: (n: number) => `Áp dụng cho ${n} ngày`,
    noDays: 'Không có ngày nào từ hôm nay trở đi trong nhóm này.',
    apply: 'Áp dụng',
    confirmTitle: 'Xác nhận áp dụng hàng loạt?',
    confirmBody: (what: string, n: number) => `${what} cho ${n} ngày.`,
    closeNote: 'Ngày đã có lịch đặt sẽ được bỏ qua.',
    done: (applied: number, skipped: number) => `Đã áp dụng ${applied} ngày, bỏ qua ${skipped} ngày đã có lịch`,
    confirm: 'Xác nhận',
    close: 'Đóng',
  },
} as const;
