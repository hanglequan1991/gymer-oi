import { describe, expect, it } from 'vitest';
import { formatTimeRange, formatDateVN, weekdayVN } from './format';

// formatTimeRange luôn tính theo giờ Việt Nam (UTC+7), nên kết quả không đổi theo TZ của máy.
// Chạy được với mọi TZ, ví dụ: TZ=America/New_York npx vitest run src/utils/format.test.ts
describe('formatTimeRange: giờ Việt Nam', () => {
  it('mốc có offset +07:00 giữ nguyên giờ', () => {
    expect(formatTimeRange('2026-10-17T09:00:00+07:00', '2026-10-17T10:00:00+07:00')).toBe(
      'Thứ 7, 17/10 · 09:00 – 10:00',
    );
  });

  it('mốc UTC được đổi sang giờ Việt Nam', () => {
    // 23:30Z ngày 16/10 là 06:30 ngày 17/10 theo giờ Việt Nam.
    expect(formatTimeRange('2026-10-16T23:30:00Z', '2026-10-17T00:30:00Z')).toBe('Thứ 7, 17/10 · 06:30 – 07:30');
  });

  it('ca qua nửa đêm: ngày lấy theo mốc bắt đầu, giờ kết thúc chỉ là HH:mm', () => {
    expect(formatTimeRange('2026-10-17T23:00:00+07:00', '2026-10-18T00:30:00+07:00')).toBe(
      'Thứ 7, 17/10 · 23:00 – 00:30',
    );
  });

  it('qua năm mới: 22:00Z ngày 31/12 là 05:00 ngày 01/01 (Thứ 6)', () => {
    expect(formatTimeRange('2026-12-31T22:00:00Z', '2026-12-31T23:00:00Z')).toBe('Thứ 6, 01/01 · 05:00 – 06:00');
  });

  it('Chủ nhật hiển thị "CN" và ngày có số 0 đứng đầu', () => {
    expect(formatTimeRange('2026-10-18T10:00:00+07:00', '2026-10-18T11:00:00+07:00')).toBe(
      'CN, 18/10 · 10:00 – 11:00',
    );
  });

  it('thứ Hai, ngày một chữ số có số 0 đứng đầu', () => {
    expect(formatTimeRange('2026-10-05T08:00:00+07:00', '2026-10-05T09:00:00+07:00')).toBe(
      'Thứ 2, 05/10 · 08:00 – 09:00',
    );
  });

  it('cùng một mốc UTC cho cùng kết quả bất kể giờ máy (không phụ thuộc Date local)', () => {
    const iso = '2026-10-16T17:00:00Z'; // 00:00 ngày 17/10 theo giờ Việt Nam
    const endIso = '2026-10-16T18:00:00Z';
    expect(formatTimeRange(iso, endIso)).toBe('Thứ 7, 17/10 · 00:00 – 01:00');
  });
});

// weekdayVN và formatDateVN nhận Date lịch địa phương, nên dựng bằng new Date(y, m, d).
describe('weekdayVN và formatDateVN: ngày lịch địa phương', () => {
  it('đọc đúng thứ và ngày từ Date địa phương', () => {
    const d = new Date(2026, 9, 17); // 17/10/2026 là Thứ 7
    expect(weekdayVN(d)).toBe('Thứ 7');
    expect(formatDateVN(d)).toBe('17/10');
  });

  it('Chủ nhật và ngày một chữ số', () => {
    expect(weekdayVN(new Date(2026, 9, 18))).toBe('CN');
    expect(formatDateVN(new Date(2026, 0, 3))).toBe('03/01');
  });
});
