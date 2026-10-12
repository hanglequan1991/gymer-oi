// Chuỗi tab Yêu cầu của khu Gymer (task G4).
export const gymerRequests = {
  title: 'Yêu cầu',
  tabsLabel: 'Lọc yêu cầu theo trạng thái',
  tabs: {
    pending: 'Chờ duyệt',
    confirmed: 'Đã xác nhận',
    rejected: 'Đã từ chối',
    cancelled: 'Đã huỷ',
  },
  /** Nhãn tab kèm số lượng, ví dụ "Chờ duyệt (2)". */
  tabWithCount: (label: string, count: number) => `${label} (${count})`,
  empty: {
    pending: {
      title: 'Chưa có yêu cầu chờ duyệt',
      description: 'Yêu cầu mới từ khách sẽ hiện ở đây.',
    },
    confirmed: {
      title: 'Chưa có yêu cầu đã xác nhận',
      description: 'Các yêu cầu bạn xác nhận sẽ nằm ở đây.',
    },
    rejected: {
      title: 'Chưa có yêu cầu đã từ chối',
      description: 'Các yêu cầu bạn từ chối sẽ nằm ở đây.',
    },
    cancelled: {
      title: 'Chưa có buổi nào bị huỷ',
      description: 'Buổi bạn hoặc khách huỷ sẽ nằm ở đây.',
    },
  },
  toastConfirmed: 'Đã xác nhận yêu cầu.',
  toastRejected: 'Đã từ chối yêu cầu.',
  rejectTitle: 'Từ chối yêu cầu này?',
  rejectConfirm: 'Từ chối',
  rejectCancel: 'Quay lại',

  // Gymer huỷ buổi đã xác nhận (chưa bắt đầu)
  cancelAction: 'Huỷ buổi',
  /** Nhãn đọc màn hình cho nút huỷ buổi, ví dụ "Huỷ buổi với Lan, T7 10/10 · 08:00 – 09:00". */
  cancelActionAria: (name: string, when: string) => `Huỷ buổi với ${name}, ${when}`,
  cancelStartedHint: 'Buổi đã bắt đầu, không thể huỷ',
  cancelTitle: (name: string) => `Huỷ buổi với ${name}?`,
  /** Dòng thời gian trong hộp xác nhận, ví dụ "T7 10/10 · 08:00 – 09:00". */
  cancelWhen: (weekdayDate: string, start: string, end: string) =>
    `${weekdayDate} · ${start} – ${end}`,
  cancelBody: 'Khách sẽ thấy buổi này bị huỷ khi mở app. Bạn không thể hoàn tác.',
  cancelConsequence:
    'Khung giờ này sẽ trống lại và khách khác có thể đặt ngay. Nếu không muốn nhận khách giờ này, hãy đóng khung giờ trong Lịch và giá.',
  cancelConfirm: 'Huỷ buổi',
  cancelKeep: 'Giữ buổi',
  toastCancelled: 'Đã huỷ buổi. Khung giờ này đã trống lại.',
  /** Nhãn người huỷ trên thẻ ở tab Đã huỷ. */
  cancelledBy: {
    gymer: 'Bạn đã huỷ',
    customer: 'Khách đã huỷ',
  },
  /** Dòng dưới thẻ đã huỷ, nói khung giờ đã được mở lại khi huỷ (không khẳng định là còn trống). */
  cancelledReopened: 'Khung giờ này đã được mở lại khi huỷ.',
} as const;
