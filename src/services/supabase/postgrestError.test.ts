import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { assertOk, toAppError, unwrap, unwrapOrNull } from './postgrestError';

/** Tạo lỗi có tên và status như supabase-js (không dùng lớp thật để test không phụ thuộc phiên bản). */
function namedError(name: string, message: string, status?: number): Error & { status?: number } {
  const err = new Error(message) as Error & { status?: number };
  err.name = name;
  if (status !== undefined) err.status = status;
  return err;
}

describe('toAppError (bảng D8)', () => {
  it('giữ nguyên AppError đã có', () => {
    const err = new AppError('SLOT_TAKEN', 'Khung giờ đã có người đặt');
    expect(toAppError(err)).toBe(err);
  });

  it('lỗi fetch (TypeError, không code, không status) là NETWORK', () => {
    const cause = new TypeError('Failed to fetch');
    const result = toAppError(cause);
    expect(result.code).toBe('NETWORK');
    expect(result.cause).toBe(cause);
  });

  it('lỗi mạng dạng PostgREST (code rỗng, không status) là NETWORK', () => {
    expect(toAppError({ message: 'TypeError: Failed to fetch', code: '' }).code).toBe('NETWORK');
  });

  it('status 0 (AuthRetryableFetchError của GoTrue) là NETWORK, không phải UNKNOWN', () => {
    const cause = namedError('AuthRetryableFetchError', 'Failed to fetch', 0);
    const result = toAppError(cause);
    expect(result.code).toBe('NETWORK');
    expect(result.cause).toBe(cause);
  });

  it('AuthRetryableFetchError không có status vẫn là NETWORK theo tên', () => {
    expect(toAppError(namedError('AuthRetryableFetchError', 'máy chủ không phản hồi')).code).toBe('NETWORK');
  });

  it('FunctionsFetchError (không gửi được tới Edge Function) là NETWORK', () => {
    const cause = namedError('FunctionsFetchError', 'Failed to send a request to the Edge Function');
    const result = toAppError(cause);
    expect(result.code).toBe('NETWORK');
    expect(result.cause).toBe(cause);
  });

  it('lỗi có status HTTP thật (500) không bị coi là NETWORK dù tên là TypeError', () => {
    expect(toAppError(namedError('TypeError', 'lỗi máy chủ', 500)).code).toBe('UNKNOWN');
  });

  it('JWT hết hạn hoặc thiếu (PGRST301) là UNAUTHENTICATED', () => {
    expect(toAppError({ code: 'PGRST301', message: 'JWT expired' }).code).toBe('UNAUTHENTICATED');
  });

  it('PGRST302 (anonymous không được phép) là UNAUTHENTICATED', () => {
    expect(toAppError({ code: 'PGRST302', message: 'Anonymous access is disabled' }).code).toBe('UNAUTHENTICATED');
  });

  it('PGRST303 (JWT không hợp lệ) là UNAUTHENTICATED', () => {
    expect(toAppError({ code: 'PGRST303', message: 'JWT issued at future' }).code).toBe('UNAUTHENTICATED');
  });

  it('HTTP 401 là UNAUTHENTICATED', () => {
    expect(toAppError({ status: 401, message: 'Unauthorized' }).code).toBe('UNAUTHENTICATED');
  });

  it('RAISE P0001 mang mã nghiệp vụ được ánh xạ đúng và giữ message gốc', () => {
    const raw = { code: 'P0001', message: 'SLOT_TAKEN: khung giờ đã được đặt' };
    const result = toAppError(raw);
    expect(result.code).toBe('SLOT_TAKEN');
    expect(result.message).toBe(raw.message);
    expect(result.cause).toBe(raw);
  });

  it('mã SLOT_HAS_BOOKING gộp vào VALIDATION', () => {
    expect(toAppError({ code: 'P0001', message: 'SLOT_HAS_BOOKING' }).code).toBe('VALIDATION');
  });

  it('mã ALREADY_STARTED gộp vào FORBIDDEN', () => {
    expect(toAppError({ code: 'P0001', message: 'ALREADY_STARTED' }).code).toBe('FORBIDDEN');
  });

  it('message có tiền tố mã đã biết (không có code) vẫn được ánh xạ', () => {
    expect(toAppError({ message: 'PRICE_CHANGED: giá đã đổi' }).code).toBe('PRICE_CHANGED');
  });

  it('P0001 với message không biết là UNKNOWN', () => {
    expect(toAppError({ code: 'P0001', message: 'Lỗi lạ' }).code).toBe('UNKNOWN');
  });

  it('42501 (không đủ quyền / RLS) là FORBIDDEN', () => {
    const result = toAppError({ code: '42501', message: 'new row violates row-level security policy' });
    expect(result.code).toBe('FORBIDDEN');
    expect(result.message).toBe('new row violates row-level security policy');
  });

  it('23514, 23503 và lớp 22xxx (check, khoá ngoại, kiểu) là VALIDATION', () => {
    expect(toAppError({ code: '23514', message: 'check violated' }).code).toBe('VALIDATION');
    expect(toAppError({ code: '23503', message: 'fk violated' }).code).toBe('VALIDATION');
    expect(toAppError({ code: '22P02', message: 'invalid input syntax' }).code).toBe('VALIDATION');
  });

  it('PGRST116 (mong một hàng nhưng không có) là NOT_FOUND', () => {
    expect(toAppError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }).code).toBe(
      'NOT_FOUND',
    );
  });

  it('23P01 (exclusion_violation, lưới phòng thủ) là SLOT_TAKEN', () => {
    const raw = { code: '23P01', message: 'conflicting key value violates exclusion constraint' };
    const result = toAppError(raw);
    expect(result.code).toBe('SLOT_TAKEN');
    expect(result.cause).toBe(raw);
  });

  it('SQLSTATE không thuộc bảng (23505) là UNKNOWN', () => {
    expect(toAppError({ code: '23505', message: 'duplicate key' }).code).toBe('UNKNOWN');
  });

  it('chuỗi lỗi thường là UNKNOWN với message gốc', () => {
    const result = toAppError('boom');
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('boom');
  });

  it('null, undefined và giá trị lạ là UNKNOWN với câu mặc định', () => {
    expect(toAppError(null)).toMatchObject({ code: 'UNKNOWN', message: 'Lỗi không xác định' });
    expect(toAppError(undefined)).toMatchObject({ code: 'UNKNOWN', message: 'Lỗi không xác định' });
    expect(toAppError(42).code).toBe('UNKNOWN');
  });
});

describe('unwrap và unwrapOrNull', () => {
  it('unwrap trả data khi không có lỗi', () => {
    expect(unwrap({ data: { id: 'g1' }, error: null })).toEqual({ id: 'g1' });
  });

  it('unwrap ném AppError đã ánh xạ khi có lỗi', () => {
    expect(() => unwrap({ data: null, error: { code: 'P0001', message: 'SLOT_NOT_OPEN' } })).toThrow(AppError);
    try {
      unwrap({ data: null, error: { code: 'P0001', message: 'SLOT_NOT_OPEN' } });
    } catch (e) {
      expect((e as AppError).code).toBe('SLOT_NOT_OPEN');
    }
  });

  it('unwrap ném NOT_FOUND khi data null và không có lỗi', () => {
    try {
      unwrap({ data: null, error: null });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('NOT_FOUND');
    }
  });

  it('unwrapOrNull trả null khi data null và không có lỗi', () => {
    expect(unwrapOrNull({ data: null, error: null })).toBeNull();
  });

  it('assertOk không ném khi không có lỗi, kể cả data null (RPC trả void)', () => {
    expect(() => assertOk({ error: null })).not.toThrow();
  });

  it('assertOk ném AppError đã ánh xạ khi có lỗi', () => {
    try {
      assertOk({ error: { code: 'P0001', message: 'SLOT_NOT_OPEN' } });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('SLOT_NOT_OPEN');
    }
  });

  it('unwrapOrNull vẫn ném khi có lỗi', () => {
    try {
      unwrapOrNull({ data: null, error: { code: '42501', message: 'denied' } });
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('FORBIDDEN');
    }
  });
});
