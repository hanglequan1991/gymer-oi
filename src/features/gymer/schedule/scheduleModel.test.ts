import { describe, expect, it } from 'vitest';
import { MAX_PRICE, priceError, toDateIso } from './scheduleModel';

describe('priceError', () => {
  it('giá từ 0 đến 5.000.000 là hợp lệ, biên gồm cả hai đầu', () => {
    expect(priceError(0)).toBeUndefined();
    expect(priceError(MAX_PRICE)).toBeUndefined();
  });

  it('giá âm hoặc vượt 5.000.000 báo lỗi khoảng giá; để trống báo lỗi cần nhập', () => {
    expect(priceError(-1)).toBe('Giá phải từ 0 đến 5.000.000đ');
    expect(priceError(MAX_PRICE + 1)).toBe('Giá phải từ 0 đến 5.000.000đ');
    expect(priceError(null)).toBe('Hãy nhập giá');
  });
});

describe('toDateIso', () => {
  it('lấy ngày theo giờ địa phương, có số 0 đầu', () => {
    expect(toDateIso(new Date(2026, 9, 7))).toBe('2026-10-07');
  });
});
