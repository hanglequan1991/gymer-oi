import { describe, expect, it } from 'vitest';
import { AppError, isAppError } from './errors';

describe('AppError', () => {
  it('giữ code, message và cause', () => {
    const root = new Error('mạng lỗi');
    const err = new AppError('NETWORK', 'Không kết nối được', root);

    expect(err.code).toBe('NETWORK');
    expect(err.message).toBe('Không kết nối được');
    expect(err.cause).toBe(root);
  });

  it('là instance của Error', () => {
    const err = new AppError('NOT_FOUND', 'Không tìm thấy');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe('AppError');
    expect(err.cause).toBeUndefined();
  });
});

describe('isAppError', () => {
  it('trả về true với AppError', () => {
    expect(isAppError(new AppError('SLOT_TAKEN', 'Khung giờ đã có người đặt'))).toBe(true);
  });

  it('trả về false với Error thường, chuỗi, null và undefined', () => {
    expect(isAppError(new Error('thường'))).toBe(false);
    expect(isAppError('chuỗi')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});
