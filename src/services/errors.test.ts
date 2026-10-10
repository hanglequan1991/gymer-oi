import { describe, expect, it } from 'vitest';
import { AppError, appErrorFromRpc, isAppError, mapRpcErrorCode } from './errors';

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

describe('mapRpcErrorCode', () => {
  it.each([
    ['SLOT_TAKEN', 'SLOT_TAKEN'],
    ['SLOT_NOT_OPEN', 'SLOT_NOT_OPEN'],
    ['PRICE_CHANGED', 'PRICE_CHANGED'],
    ['LIMIT_REACHED', 'LIMIT_REACHED'],
    ['BOOKING_EXPIRED', 'BOOKING_EXPIRED'],
    ['VALIDATION', 'VALIDATION'],
    ['SLOT_HAS_BOOKING', 'VALIDATION'],
    ['NOT_FOUND', 'NOT_FOUND'],
    ['FORBIDDEN', 'FORBIDDEN'],
    ['ALREADY_STARTED', 'FORBIDDEN'],
    ['UNAUTHENTICATED', 'UNAUTHENTICATED'],
  ] as const)('mã %s -> %s', (raw, expected) => {
    expect(mapRpcErrorCode(raw)).toBe(expected);
  });

  it('khớp theo tiền tố, bỏ qua phần chi tiết sau dấu hai chấm hoặc CONTEXT', () => {
    expect(mapRpcErrorCode('PRICE_CHANGED: giá mới 220000')).toBe('PRICE_CHANGED');
    expect(mapRpcErrorCode('SLOT_NOT_OPEN CONTEXT: PL/pgSQL function create_booking')).toBe('SLOT_NOT_OPEN');
  });

  it('không khớp khi mã chỉ là tiền tố của một mã dài hơn', () => {
    expect(mapRpcErrorCode('SLOT_TAKENX')).toBe('UNKNOWN');
    expect(mapRpcErrorCode('NOT_FOUNDED')).toBe('UNKNOWN');
  });

  it('mã SQLSTATE, mã lạ, message rỗng và null rơi về UNKNOWN', () => {
    expect(mapRpcErrorCode('23503')).toBe('UNKNOWN');
    expect(mapRpcErrorCode('42501')).toBe('UNKNOWN');
    expect(mapRpcErrorCode('KHONG_CO_MA')).toBe('UNKNOWN');
    expect(mapRpcErrorCode('')).toBe('UNKNOWN');
    expect(mapRpcErrorCode(null)).toBe('UNKNOWN');
    expect(mapRpcErrorCode(undefined)).toBe('UNKNOWN');
  });
});

describe('appErrorFromRpc', () => {
  it('tạo AppError có code đã ánh xạ và giữ nguyên nhân gốc', () => {
    const root = new Error('raw');
    const err = appErrorFromRpc('LIMIT_REACHED: 3 yêu cầu chờ', root);

    expect(isAppError(err)).toBe(true);
    expect(err.code).toBe('LIMIT_REACHED');
    expect(err.message).toBe('LIMIT_REACHED: 3 yêu cầu chờ');
    expect(err.cause).toBe(root);
  });

  it('message null thì vẫn tạo AppError UNKNOWN', () => {
    const err = appErrorFromRpc(null);
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('Lỗi không xác định');
  });
});
