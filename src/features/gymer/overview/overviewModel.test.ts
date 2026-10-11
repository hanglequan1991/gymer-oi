import { describe, expect, it } from 'vitest';
import { buildOverview, vnDayKey, vnDateTimeLabel, vnHhmm, PENDING_PREVIEW_LIMIT } from './overviewModel';
import type { BookingRequest as Req, RequestStatus } from '@/types/domain';

// Mốc "bây giờ" cố định: 11/10/2026 10:00 giờ VN.
const NOW = new Date('2026-10-11T10:00:00+07:00');

function req(id: string, status: RequestStatus, start: string, end: string): Req {
  return { id, customerName: `Khách ${id}`, start, end, price: 200000, status };
}

describe('vnDayKey và vnHhmm: giờ Việt Nam', () => {
  it('23:30 UTC hôm trước là 06:30 hôm nay theo giờ VN', () => {
    expect(vnDayKey('2026-10-10T23:30:00Z')).toBe('2026-10-11');
    expect(vnHhmm('2026-10-10T23:30:00Z')).toBe('06:30');
  });

  it('nửa đêm VN hiện là 00:xx, không phải 24:xx', () => {
    expect(vnHhmm('2026-10-11T00:05:00+07:00')).toBe('00:05');
  });

  it('nhãn ngày giờ dùng giờ VN', () => {
    expect(vnDateTimeLabel('2026-10-12T09:00:00+07:00')).toBe('12/10 · 09:00');
  });
});

describe('buildOverview: số liệu', () => {
  it('chờ duyệt đếm mọi yêu cầu pending', () => {
    const list = [
      req('a', 'pending', '2026-10-12T09:00:00+07:00', '2026-10-12T10:00:00+07:00'),
      req('b', 'pending', '2026-10-13T09:00:00+07:00', '2026-10-13T10:00:00+07:00'),
      req('c', 'rejected', '2026-10-12T11:00:00+07:00', '2026-10-12T12:00:00+07:00'),
    ];
    expect(buildOverview(list, NOW).pendingCount).toBe(2);
  });

  it('sắp tới chỉ đếm buổi đã xác nhận chưa kết thúc', () => {
    const list = [
      req('upcoming', 'confirmed', '2026-10-12T09:00:00+07:00', '2026-10-12T10:00:00+07:00'),
      req('ended', 'confirmed', '2026-10-11T07:00:00+07:00', '2026-10-11T08:00:00+07:00'),
      req('pending', 'pending', '2026-10-12T09:00:00+07:00', '2026-10-12T10:00:00+07:00'),
    ];
    expect(buildOverview(list, NOW).upcomingCount).toBe(1);
  });

  it('danh sách rỗng cho số 0 và mảng rỗng', () => {
    expect(buildOverview([], NOW)).toEqual({ pendingCount: 0, upcomingCount: 0, today: [], pendingPreview: [] });
  });
});

describe('buildOverview: hôm nay', () => {
  it('chỉ lấy buổi đã xác nhận bắt đầu trong ngày VN, sắp theo giờ', () => {
    const list = [
      req('late', 'confirmed', '2026-10-11T18:00:00+07:00', '2026-10-11T19:00:00+07:00'),
      req('early', 'confirmed', '2026-10-11T06:30:00+07:00', '2026-10-11T07:30:00+07:00'),
      req('tomorrow', 'confirmed', '2026-10-12T06:30:00+07:00', '2026-10-12T07:30:00+07:00'),
      req('pendingToday', 'pending', '2026-10-11T12:00:00+07:00', '2026-10-11T13:00:00+07:00'),
    ];
    expect(buildOverview(list, NOW).today.map((r) => r.id)).toEqual(['early', 'late']);
  });

  it('buổi 23:30 UTC hôm trước (06:30 VN hôm nay) được tính là hôm nay', () => {
    const list = [req('edge', 'confirmed', '2026-10-10T23:30:00Z', '2026-10-11T00:30:00Z')];
    expect(buildOverview(list, NOW).today.map((r) => r.id)).toEqual(['edge']);
  });
});

describe('buildOverview: yêu cầu chờ duyệt', () => {
  it('tối đa PENDING_PREVIEW_LIMIT thẻ, sớm nhất trước', () => {
    const list = ['d', 'b', 'e', 'a', 'c'].map((id, i) =>
      req(id, 'pending', `2026-10-${String(12 + i).padStart(2, '0')}T09:00:00+07:00`, `2026-10-${String(12 + i).padStart(2, '0')}T10:00:00+07:00`),
    );
    const preview = buildOverview(list, NOW).pendingPreview;
    expect(PENDING_PREVIEW_LIMIT).toBe(3);
    expect(preview).toHaveLength(3);
    expect(preview.map((r) => r.id)).toEqual(['d', 'b', 'e']);
  });
});

