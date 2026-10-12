// Chuỗi tab Tổng quan của khu Gymer (task G2).
export const gymerOverview = {
  title: 'Tổng quan',
  greeting: (name: string) => `Xin chào, ${name}`,
  stats: {
    pending: 'Chờ duyệt',
    upcoming: 'Sắp tới',
    rating: 'Đánh giá',
    /** Hiện khi chưa có đánh giá nào (reviewCount = 0), thay cho điểm trung bình. */
    ratingNone: 'Chưa có',
  },
  today: {
    title: 'Hôm nay',
    empty: 'Hôm nay bạn chưa có lịch.',
    /** Nhãn đọc màn hình cho một buổi hôm nay (bấm để mở tab Yêu cầu). */
    itemLabel: (time: string, name: string) => `Xem buổi ${time} với ${name} trong tab Yêu cầu`,
  },
  pending: {
    title: 'Yêu cầu chờ duyệt',
    viewAll: 'Xem tất cả',
    empty: 'Chưa có yêu cầu chờ duyệt.',
    /** Nhãn đọc màn hình cho một yêu cầu chờ duyệt trên tổng quan. */
    itemLabel: (name: string) => `Yêu cầu của ${name}`,
  },
  notices: {
    /** Hồ sơ đang ẩn: khách không tìm thấy Gymer. */
    hidden: 'Hồ sơ của bạn đang ẩn, khách chưa tìm thấy bạn.',
    /** Chưa có vị trí phòng tập: không hiện trong kết quả tìm kiếm theo khoảng cách. */
    noLocation: 'Bạn chưa đặt vị trí phòng tập.',
    openProfile: 'Mở hồ sơ',
  },
} as const;
