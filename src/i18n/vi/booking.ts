// Chuỗi đặt lịch và màn thành công (khách). Câu lỗi theo ngữ cảnh 'bookingCreate' nằm trong i18n/errors.ts.
export const booking = {
  confirmTitle: 'Xác nhận đặt lịch',
  successTitle: 'Đặt lịch thành công',

  // Màn xác nhận
  rowGymer: 'Gymer',
  rowDate: 'Ngày',
  rowTime: 'Giờ',
  rowDuration: 'Thời lượng',
  durationValue: '60 phút',
  rowPrice: 'Tổng tạm tính',
  goalLabel: 'Mục tiêu tập luyện',
  goalPlaceholder: 'VD: giảm 5kg trong 3 tháng',
  goalCounter: (count: number, max: number) => `${count}/${max}`,
  healthLabel: 'Ghi chú sức khỏe',
  healthPlaceholder: 'VD: đau lưng nhẹ',
  optionalLabel: '(không bắt buộc)',
  /** Hiện dưới ô ghi chú sức khoẻ: ghi chú chưa được chia sẻ với Gymer (D12). */
  healthNotShared: 'Gymer ơi chưa chia sẻ ghi chú này cho Gymer.',
  paymentNotice:
    'Thanh toán nằm ngoài ứng dụng. Sau khi đặt, bạn sẽ thỏa thuận và thanh toán trực tiếp với Gymer. Gymer ơi không thu tiền.',
  submitLabel: 'Gửi yêu cầu',
  unpaidHint: 'Chưa thanh toán',
  noPrice: 'Ngày này chưa có giá. Hãy quay lại chọn ngày khác.',
  slotTakenAction: 'Chọn giờ khác',
  priceChanged: (oldPrice: string, newPrice: string) =>
    `Giá đã đổi từ ${oldPrice} thành ${newPrice}. Hãy xem lại rồi bấm gửi lần nữa.`,
  priceRefreshFailed: 'Chưa tải được giá mới. Hãy thử lại sau.',
  limitAction: 'Xem lịch của tôi',

  // Màn thành công
  successHeading: 'Đã gửi yêu cầu',
  deadline: (deadline: string) => `Hạn phản hồi: ${deadline}`,
  successBody: 'Bạn có thể xem yêu cầu trong mục Lịch của tôi.',
  successPaymentNotice: 'Nhớ thanh toán trực tiếp cho Gymer. Gymer ơi không thu tiền.',
  actionMyBookings: 'Xem lịch của tôi',
  actionSearch: 'Về trang tìm kiếm',
} as const;
