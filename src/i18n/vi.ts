// Chuỗi tiếng Việt của ứng dụng. Chỉ một ngôn ngữ; nhóm theo feature (docs/project-structure.md, mục 2.7).
// Dùng dạng `as const` để kiểu của từng chuỗi được giữ nguyên khi truy cập, ví dụ vi.booking.confirmTitle.

export const vi = {
  common: {
    appName: 'Gymer ơi',
    loading: 'Đang tải...',
    retry: 'Thử lại',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    back: 'Quay lại',
  },
  nav: {
    search: 'Tìm Gymer',
    gymerOverview: 'Tổng quan',
    gymerSchedule: 'Lịch và giá',
    gymerRequests: 'Yêu cầu',
    gymerProfile: 'Hồ sơ',
  },
  search: {
    title: 'Tìm Gymer',
    emptyTitle: 'Chưa tìm thấy Gymer nào',
    emptyDescription: 'Thử mở rộng khoảng cách tìm kiếm.',
  },
  booking: {
    confirmTitle: 'Xác nhận đặt lịch',
    successTitle: 'Đặt lịch thành công',
  },
} as const;

/** Kiểu của toàn bộ từ điển chuỗi. */
export type Vi = typeof vi;
