// Chuỗi hồ sơ Gymer nhìn từ phía khách (task C2).
export const gymerDetail = {
  pageTitle: 'Chi tiết Gymer',
  // Không tìm thấy hoặc lỗi tải hồ sơ đầu trang.
  backToSearch: 'Về tìm kiếm',

  // Thông tin chung
  ageYears: (age: number) => `${age} tuổi`,
  areaLabel: 'Khu vực',
  noReviewsYet: 'Chưa có đánh giá',

  // Giới thiệu và chuyên môn
  aboutTitle: 'Giới thiệu',
  noBio: 'Gymer chưa có phần giới thiệu.',
  specialtiesTitle: 'Chuyên môn',
  noSpecialties: 'Gymer chưa khai chuyên môn.',
  certificatesTitle: 'Chứng chỉ',
  selfDeclared: 'Tự khai',
  noCertificates: 'Gymer chưa khai chứng chỉ nào.',

  // Bảng giá mặc định
  pricesTitle: 'Bảng giá',
  priceWeekdayRow: 'T2-T6',
  priceWeekendRow: 'T7-CN',
  pricePerSession: '/buổi',

  // Lịch và khung giờ
  scheduleTitle: 'Lịch đặt',
  scheduleHint: 'Chọn một ngày để xem khung giờ.',
  slotsTitle: 'Khung giờ',
  slotsHint: 'Chỉ khung còn trống mới chọn được.',
  noSlots: 'Ngày này chưa có khung giờ.',
  // Ghép thứ, ngày và giờ đã chọn: "Thứ 7, 17/10 · 09:00"
  selectedSummary: (weekday: string, dateLabel: string, time: string) => `${weekday}, ${dateLabel} · ${time}`,
  bookingHintEmpty: 'Chọn ngày và giờ để đặt lịch',
  bookingCta: 'Đặt lịch',

  // Đánh giá
  reviewsTitle: 'Đánh giá gần đây',
  noReviews: 'Gymer chưa có đánh giá nào.',
  showMoreReviews: 'Xem thêm',
} as const;
