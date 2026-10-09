// Dữ liệu mock đánh giá, dùng cho màn hồ sơ Gymer.
import type { Review } from '@/types/domain';

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'review-1',
    author: 'Hoàng Nam',
    rating: 5,
    text: 'Buổi tập rất có kế hoạch, chị hướng dẫn kỹ thuật từng động tác và nhắc nhở đúng lúc.',
    dateLabel: '2 tuần trước',
  },
  {
    id: 'review-2',
    author: 'Thu Trang',
    rating: 5,
    text: 'Đúng giờ, theo sát mục tiêu giảm mỡ. Mình thấy rõ tiến bộ sau một tháng.',
    dateLabel: '1 tháng trước',
  },
  {
    id: 'review-3',
    author: 'Minh Quân',
    rating: 4,
    text: 'Lịch linh hoạt, dễ đặt. Chỉ tiếc phòng tập hơi xa nơi mình ở.',
    dateLabel: '2 tháng trước',
  },
];
