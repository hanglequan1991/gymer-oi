import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';
import type { ErrorCode } from '@/services/errors';

// Khai báo dạng Record để TypeScript báo lỗi nếu thêm/bớt ErrorCode mà quên cập nhật danh sách này.
const ALL_CODES: Record<ErrorCode, true> = {
  NOT_FOUND: true,
  SLOT_TAKEN: true,
  FORBIDDEN: true,
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
});
