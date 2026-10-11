// Ánh xạ mã lỗi nghiệp vụ sang câu tiếng Việt hiển thị cho người dùng, theo ngữ cảnh màn hình/thao tác.
// Repository ném AppError có mã (services/errors.ts). UI gọi messageFromError(err, ngữ cảnh) hoặc errorMessage(code, ngữ cảnh).
// Không thêm mã lỗi ở đây: mã mới là thay đổi hợp đồng services (plan app-ui-integration, D3).
import { isAppError, type ErrorCode } from '@/services/errors';

/**
 * Ngữ cảnh của thao tác. Cùng một mã (vd FORBIDDEN) có thể cần câu khác nhau tuỳ thao tác.
 * 'default' dùng bảng chung; ngữ cảnh khác chỉ ghi đè những mã cần câu riêng.
 */
export type ErrorContext =
  | 'default'
  | 'login'
  | 'location'
  | 'search'
  | 'bookingCreate'
  | 'bookingCancel'
  | 'bookingReview'
  | 'requestRespond'
  | 'schedule'
  | 'profile'
  | 'onboarding';

/** Bảng câu thông báo mặc định. Kiểu Record bắt buộc đủ mọi ErrorCode: thiếu mã nào thì lỗi biên dịch. */
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

/** Bảng ghi đè theo ngữ cảnh. Mã không có trong bảng ghi đè thì dùng câu mặc định. */
type Overrides = Partial<Record<ErrorCode, string>>;

const LOGIN: Overrides = {
  FORBIDDEN: 'Bạn cần cho phép Gymer ơi dùng tài khoản Zalo để đăng nhập.',
  UNAUTHENTICATED: 'Zalo chưa xác nhận được phiên của bạn. Hãy đăng nhập lại.',
  NETWORK: 'Không kết nối được Zalo hoặc máy chủ. Hãy thử lại sau ít phút.',
};

const LOCATION: Overrides = {
  FORBIDDEN: 'Chưa có quyền vị trí. Hãy cho phép Gymer ơi dùng vị trí trong cài đặt Zalo rồi thử lại.',
  UNKNOWN: 'Không lấy được vị trí của bạn.',
  NETWORK: 'Chưa lấy được vị trí. Kiểm tra mạng rồi thử lại.',
};

const SEARCH: Overrides = {
  NETWORK: 'Không tải được danh sách Gymer. Kiểm tra mạng rồi thử lại.',
};

const BOOKING_CREATE: Overrides = {
  VALIDATION:
    'Chưa gửi được yêu cầu. Cần đặt trước giờ tập ít nhất 2 giờ và không quá 60 ngày; mục tiêu tối đa 200 ký tự, ghi chú tối đa 1000 ký tự.',
  FORBIDDEN: 'Gymer này hiện không nhận yêu cầu, hoặc bạn không thể đặt lịch với chính mình.',
  NOT_FOUND: 'Hồ sơ Gymer này không còn hiển thị.',
};

const BOOKING_CANCEL: Overrides = {
  FORBIDDEN:
    'Lịch này không còn huỷ được. Có thể đã được huỷ, bị từ chối, hết hạn hoặc đã bắt đầu.',
};

const BOOKING_REVIEW: Overrides = {
  FORBIDDEN:
    'Chưa thể đánh giá. Chỉ đánh giá được buổi đã xác nhận và đã kết thúc, mỗi buổi một lần.',
  VALIDATION: 'Đánh giá chưa hợp lệ. Hãy chọn từ 1 đến 5 sao; nội dung tối đa 500 ký tự.',
};

const REQUEST_RESPOND: Overrides = {
  FORBIDDEN:
    'Yêu cầu này không còn chờ duyệt. Có thể khách đã huỷ hoặc yêu cầu đã được xử lý.',
};

const SCHEDULE: Overrides = {
  VALIDATION:
    'Chưa lưu được. Ngày hoặc khung giờ đã có lịch đặt thì không đóng được; giá phải từ 0 đến 5.000.000đ.',
  NOT_FOUND: 'Không tìm thấy hồ sơ Gymer của bạn.',
};

// Hồ sơ và đăng ký Gymer dùng chung luật nhập liệu nên chung một bảng.
const PROFILE_AND_ONBOARDING: Overrides = {
  VALIDATION:
    'Thông tin chưa hợp lệ. Tên 1-50 ký tự, khu vực 1-100 ký tự, giới thiệu tối đa 1000 ký tự, và bạn phải từ 18 tuổi.',
  NOT_FOUND: 'Bạn chưa là Gymer.',
  LIMIT_REACHED: 'Bạn đã đạt số chứng chỉ tối đa (10).',
};

const OVERRIDES: Record<Exclude<ErrorContext, 'default'>, Overrides> = {
  login: LOGIN,
  location: LOCATION,
  search: SEARCH,
  bookingCreate: BOOKING_CREATE,
  bookingCancel: BOOKING_CANCEL,
  bookingReview: BOOKING_REVIEW,
  requestRespond: REQUEST_RESPOND,
  schedule: SCHEDULE,
  profile: PROFILE_AND_ONBOARDING,
  onboarding: PROFILE_AND_ONBOARDING,
};

/** Đọc khoá của đối tượng chỉ khi khoá là thuộc tính riêng, để mã lạ như "toString" không lọt ra ngoài bảng. */
function ownMessage(table: Partial<Record<string, string>>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/**
 * Trả về câu tiếng Việt cho một mã lỗi trong ngữ cảnh.
 * Thứ tự tra: bảng ghi đè của ngữ cảnh, rồi bảng mặc định. Mã lạ rơi về UNKNOWN.
 */
export function errorMessage(code: ErrorCode, context: ErrorContext = 'default'): string {
  const overrides = context === 'default' ? undefined : OVERRIDES[context];
  return (
    (overrides && ownMessage(overrides, code)) ||
    ownMessage(MESSAGES, code) ||
    MESSAGES.UNKNOWN
  );
}

/** Lấy mã lỗi từ một giá trị bất kỳ. Không phải AppError (lỗi JS thường, undefined...) thì coi là UNKNOWN. */
function codeOf(err: unknown): ErrorCode {
  return isAppError(err) ? err.code : 'UNKNOWN';
}

/** Câu tiếng Việt cho một lỗi bất kỳ, theo ngữ cảnh thao tác. Dùng trong catch của hook/màn hình. */
export function messageFromError(err: unknown, context: ErrorContext = 'default'): string {
  return errorMessage(codeOf(err), context);
}

/** Lỗi có thể thử lại: mất mạng hoặc lỗi không xác định (ví dụ lỗi từ Zalo SDK). Các mã nghiệp vụ không tự thử lại. */
export function isRetryableError(err: unknown): boolean {
  const code = codeOf(err);
  return code === 'NETWORK' || code === 'UNKNOWN';
}

/** Lỗi phiên đăng nhập (cần đăng nhập lại). */
export function isAuthError(err: unknown): boolean {
  return codeOf(err) === 'UNAUTHENTICATED';
}
