// Chuỗi tab Yêu cầu của khu Gymer (task G4).
export const gymerRequests = {
  title: 'Yêu cầu',
  tabsLabel: 'Lọc yêu cầu theo trạng thái',
  tabs: {
    pending: 'Chờ duyệt',
    confirmed: 'Đã xác nhận',
    rejected: 'Đã từ chối',
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
  },
  toastConfirmed: 'Đã xác nhận yêu cầu.',
  toastRejected: 'Đã từ chối yêu cầu.',
  rejectTitle: 'Từ chối yêu cầu này?',
  rejectConfirm: 'Từ chối',
  rejectCancel: 'Quay lại',
} as const;
