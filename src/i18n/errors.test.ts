import { describe, expect, it } from 'vitest';
import { errorMessage, isAuthError, isRetryableError, messageFromError } from './errors';
import { vi } from './vi';
import { AppError, type ErrorCode } from '@/services/errors';

// Khai báo dạng Record để TypeScript báo lỗi nếu thêm/bớt ErrorCode mà quên cập nhật danh sách này.
const ALL_CODES: Record<ErrorCode, true> = {
  NOT_FOUND: true,
  SLOT_TAKEN: true,
  SLOT_NOT_OPEN: true,
  PRICE_CHANGED: true,
  BOOKING_EXPIRED: true,
  LIMIT_REACHED: true,
  FORBIDDEN: true,
  UNAUTHENTICATED: true,
  NETWORK: true,
  VALIDATION: true,
  NOT_IMPLEMENTED: true,
  UNKNOWN: true,
};

const codes = Object.keys(ALL_CODES) as ErrorCode[];

describe('errorMessage', () => {
  it.each(codes)('mã %s có câu tiếng Việt không rỗng', (code) => {
    const message = errorMessage(code);
    expect(typeof message).toBe('string');
    expect(message.trim()).not.toBe('');
    expect(message).not.toBe(code);
  });

  it('mã lạ rơi về câu UNKNOWN', () => {
    expect(errorMessage('KHONG_CO' as ErrorCode)).toBe(errorMessage('UNKNOWN'));
  });

  it('khoá của Object.prototype không lọt ra ngoài bảng', () => {
    expect(errorMessage('toString' as ErrorCode)).toBe(errorMessage('UNKNOWN'));
    expect(errorMessage('constructor' as ErrorCode, 'login')).toBe(errorMessage('UNKNOWN'));
  });

  it('ngữ cảnh login ghi đè FORBIDDEN, còn mã không ghi đè thì dùng câu mặc định', () => {
    expect(errorMessage('FORBIDDEN', 'login')).toBe(
      'Bạn cần cho phép Gymer ơi dùng tài khoản Zalo để đăng nhập.',
    );
    expect(errorMessage('SLOT_TAKEN', 'login')).toBe(errorMessage('SLOT_TAKEN'));
  });

  it('ngữ cảnh bookingCancel và bookingReview cho FORBIDDEN hai câu khác nhau', () => {
    const cancel = errorMessage('FORBIDDEN', 'bookingCancel');
    const review = errorMessage('FORBIDDEN', 'bookingReview');
    expect(cancel).not.toBe(errorMessage('FORBIDDEN'));
    expect(review).not.toBe(errorMessage('FORBIDDEN'));
    expect(cancel).not.toBe(review);
  });

  it('ngữ cảnh location ghi đè UNKNOWN và NETWORK', () => {
    expect(errorMessage('UNKNOWN', 'location')).toBe('Không lấy được vị trí của bạn.');
    expect(errorMessage('NETWORK', 'location')).toBe(
      'Chưa lấy được vị trí. Kiểm tra mạng rồi thử lại.',
    );
  });

  it('profile và onboarding dùng chung câu VALIDATION và LIMIT_REACHED', () => {
    expect(errorMessage('VALIDATION', 'profile')).toBe(errorMessage('VALIDATION', 'onboarding'));
    expect(errorMessage('LIMIT_REACHED', 'onboarding')).toBe(
      'Bạn đã đạt số chứng chỉ tối đa (10).',
    );
  });

  it('ngữ cảnh default giống hệt khi không truyền ngữ cảnh', () => {
    expect(errorMessage('FORBIDDEN', 'default')).toBe(errorMessage('FORBIDDEN'));
  });
});

describe('messageFromError', () => {
  it('AppError dùng mã của nó, theo ngữ cảnh', () => {
    const err = new AppError('FORBIDDEN', 'raw');
    expect(messageFromError(err, 'requestRespond')).toBe(errorMessage('FORBIDDEN', 'requestRespond'));
  });

  it('AppError không ghi đè thì rơi về câu mặc định của mã', () => {
    expect(messageFromError(new AppError('SLOT_TAKEN', 'raw'), 'bookingCancel')).toBe(
      errorMessage('SLOT_TAKEN'),
    );
  });

  it('lỗi JS thường, undefined và chuỗi đều rơi về UNKNOWN', () => {
    const unknown = errorMessage('UNKNOWN');
    expect(messageFromError(new Error('boom'))).toBe(unknown);
    expect(messageFromError(undefined)).toBe(unknown);
    expect(messageFromError('lỗi chuỗi', 'login')).toBe(errorMessage('UNKNOWN', 'login'));
  });

  it('không lộ message gốc của AppError ra câu hiển thị', () => {
    expect(messageFromError(new AppError('NETWORK', 'Failed to fetch'))).not.toContain('Failed');
  });
});

describe('isRetryableError', () => {
  it('NETWORK và UNKNOWN thử lại được', () => {
    expect(isRetryableError(new AppError('NETWORK', ''))).toBe(true);
    expect(isRetryableError(new AppError('UNKNOWN', ''))).toBe(true);
    expect(isRetryableError(new Error('x'))).toBe(true);
  });

  it('các mã nghiệp vụ không tự thử lại', () => {
    const notRetryable: ErrorCode[] = [
      'NOT_FOUND',
      'SLOT_TAKEN',
      'SLOT_NOT_OPEN',
      'PRICE_CHANGED',
      'BOOKING_EXPIRED',
      'LIMIT_REACHED',
      'FORBIDDEN',
      'UNAUTHENTICATED',
      'VALIDATION',
      'NOT_IMPLEMENTED',
    ];
    for (const code of notRetryable) {
      expect(isRetryableError(new AppError(code, ''))).toBe(false);
    }
  });
});

describe('isAuthError', () => {
  it('chỉ UNAUTHENTICATED là lỗi phiên', () => {
    expect(isAuthError(new AppError('UNAUTHENTICATED', ''))).toBe(true);
    expect(isAuthError(new AppError('FORBIDDEN', ''))).toBe(false);
    expect(isAuthError(new Error('x'))).toBe(false);
  });
});

describe('vi (ghép từ các nhóm)', () => {
  it('giữ nguyên đường dẫn chuỗi cũ dùng trong test và màn hình', () => {
    expect(vi.common.retry).toBe('Thử lại');
    expect(vi.booking.confirmTitle).toBe('Xác nhận đặt lịch');
    expect(vi.nav.gymerProfile).toBe('Hồ sơ');
    expect(vi.search.title).toBe('Tìm Gymer');
  });
});
