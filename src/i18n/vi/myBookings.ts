// Chuỗi màn Lịch của tôi (khách, task C4). Câu lỗi theo ngữ cảnh 'bookingCancel' và 'bookingReview' nằm trong i18n/errors.ts.
export const myBookings = {
  pageTitle: 'Lịch của tôi',
  tabGroupLabel: 'Chọn danh sách lịch',
  tabUpcoming: 'Sắp tới',
  tabHistory: 'Lịch sử',

  // Nhãn trạng thái
  statusPending: 'Chờ duyệt',
  statusConfirmed: 'Đã xác nhận',
  statusRejected: 'Đã từ chối',
  statusCancelled: 'Đã huỷ',
  statusCancelledByGymer: 'Gymer đã huỷ',
  statusCancelledByYou: 'Bạn đã huỷ',
  /** Dòng giải thích dưới thẻ khi Gymer huỷ buổi của khách. */
  cancelledByGymerNote: 'Gymer đã huỷ buổi này. Bạn có thể tìm Gymer khác.',
  statusExpired: 'Hết hạn',

  // Trạng thái rỗng
  emptyUpcomingTitle: 'Chưa có lịch sắp tới',
  emptyUpcomingDescription: 'Tìm một Gymer gần bạn và gửi yêu cầu đặt lịch.',
  emptyHistoryTitle: 'Chưa có lịch trong lịch sử',
  emptyHistoryDescription: 'Buổi đã tập, lịch bị từ chối, đã huỷ hoặc hết hạn sẽ hiện ở đây.',
  actionFindGymer: 'Tìm Gymer',

  // Mỗi lượt
  openGymer: (name: string) => `Xem Gymer ${name}`,
  actionCancel: 'Huỷ lịch',
  actionReview: 'Đánh giá',

  // Hộp thoại huỷ
  cancelDialogTitle: 'Huỷ lịch này?',
  cancelDialogBody: 'Sau khi huỷ, khung giờ này sẽ được mở lại cho khách khác.',
  cancelConfirm: 'Huỷ lịch',
  cancelKeep: 'Giữ lịch',
  cancelSuccess: 'Đã huỷ lịch.',

  // Khối đánh giá
  reviewTitle: 'Đánh giá buổi tập',
  ratingGroupLabel: 'Số sao',
  ratingLabel: (n: number) => `${n} sao`,
  reviewTextLabel: 'Nhận xét',
  reviewOptional: '(không bắt buộc)',
  reviewTextPlaceholder: 'Chia sẻ trải nghiệm của bạn với Gymer',
  reviewCounter: (count: number, max: number) => `${count}/${max}`,
  reviewSubmit: 'Gửi đánh giá',
  reviewClose: 'Đóng',
  reviewSuccess: 'Cảm ơn bạn đã đánh giá.',
} as const;
