// Ánh xạ mã lỗi nghiệp vụ sang câu tiếng Việt hiển thị cho người dùng.
// Repository ném AppError có mã (services/errors.ts); UI gọi errorMessage(code).
import type { ErrorCode } from '@/services/errors';

/** Bảng câu thông báo. Kiểu Record bắt buộc đủ mọi ErrorCode: thiếu mã nào thì lỗi biên dịch. */
const MESSAGES: Record<ErrorCode, string> = {
  NOT_FOUND: 'Không tìm thấy nội dung bạn cần. Có thể đã bị xóa.',
  SLOT_TAKEN: 'Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.',
  SLOT_NOT_OPEN: 'Gymer không nhận khung giờ này. Vui lòng chọn giờ khác.',
  PRICE_CHANGED: 'Giá đã thay đổi. Vui lòng xem lại giá mới trước khi đặt.',
  BOOKING_EXPIRED: 'Yêu cầu đã hết hạn.',
  LIMIT_REACHED: 'Bạn đang có quá nhiều yêu cầu chờ duyệt. Hãy đợi phản hồi hoặc huỷ bớt rồi thử lại.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NETWORK: 'Không thể kết nối. Kiểm tra mạng rồi thử lại.',
  VALIDATION: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  NOT_IMPLEMENTED: 'Tính năng này chưa sẵn sàng.',
  UNKNOWN: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
};

/** Trả về câu tiếng Việt cho một mã lỗi. Mã lạ (không có trong bảng) rơi về UNKNOWN. */
export function errorMessage(code: ErrorCode): string {
  return MESSAGES[code] ?? MESSAGES.UNKNOWN;
}
