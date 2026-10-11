import { describe, expect, it } from 'vitest';
import { findSubmittedMatch, priceOfDay, readyDraft } from './utils';
import type { DayInfo, MyBooking } from '@/types/domain';

const draft = (patch: Record<string, unknown>) =>
  ({ gymerId: 'g1', dateIso: '2026-10-17', slotId: '2026-10-17T09:00', ...patch }) as never;

describe('readyDraft', () => {
  it('đủ dữ liệu và khớp Gymer thì trả về khoảng ISO', () => {
    expect(readyDraft(draft({}), 'g1')).toEqual({
      gymerId: 'g1',
      dateIso: '2026-10-17',
      slotId: '2026-10-17T09:00',
      startIso: '2026-10-17T09:00:00+07:00',
      endIso: '2026-10-17T10:00:00+07:00',
    });
  });

  it('thiếu gymerId, dateIso hoặc slotId thì null', () => {
    expect(readyDraft(draft({ gymerId: undefined }), 'g1')).toBeNull();
    expect(readyDraft(draft({ dateIso: undefined }), 'g1')).toBeNull();
    expect(readyDraft(draft({ slotId: undefined }), 'g1')).toBeNull();
  });

  it('Gymer trong nháp khác tham số route thì null', () => {
    expect(readyDraft(draft({ gymerId: 'g2' }), 'g1')).toBeNull();
  });

  it('slotId sai định dạng thì null', () => {
    expect(readyDraft(draft({ slotId: 'abc' }), 'g1')).toBeNull();
  });
});

describe('findSubmittedMatch', () => {
  const base: MyBooking = {
    id: 'b1',
    gymerId: 'g1',
    gymerName: 'Minh Hà',
    start: '2026-10-17T02:00:00Z', // 09:00 VN
    end: '2026-10-17T03:00:00Z',
    price: 220000,
    status: 'pending',
    reviewed: false,
  };

  it('khớp cùng Gymer, cùng giờ bắt đầu (so theo thời điểm) và đang chờ', () => {
    // Cùng thời điểm nhưng viết theo offset +07:00 khác cách.
    expect(findSubmittedMatch([base], 'g1', '2026-10-17T09:00:00+07:00')?.id).toBe('b1');
  });

  it('khác Gymer, khác giờ, hoặc không còn pending thì không khớp', () => {
    expect(findSubmittedMatch([base], 'g2', '2026-10-17T09:00:00+07:00')).toBeUndefined();
    expect(findSubmittedMatch([base], 'g1', '2026-10-17T10:00:00+07:00')).toBeUndefined();
    expect(
      findSubmittedMatch([{ ...base, status: 'cancelled' }], 'g1', '2026-10-17T09:00:00+07:00'),
    ).toBeUndefined();
  });

  it('khớp lượt đã confirmed (Gymer xác nhận trước khi khách thử lại)', () => {
    const confirmed = { ...base, id: 'b2', status: 'confirmed' as const };
    expect(findSubmittedMatch([confirmed], 'g1', '2026-10-17T09:00:00+07:00')?.id).toBe('b2');
  });

  it('không khớp rejected, expired, và khi có nhiều lượt thì chọn lượt cùng Gymer và giờ', () => {
    const iso = '2026-10-17T09:00:00+07:00';
    expect(findSubmittedMatch([{ ...base, status: 'rejected' }], 'g1', iso)).toBeUndefined();
    expect(findSubmittedMatch([{ ...base, status: 'expired' }], 'g1', iso)).toBeUndefined();
    const other = { ...base, id: 'b3', gymerId: 'g2', status: 'confirmed' as const };
    const match = { ...base, id: 'b4', status: 'confirmed' as const };
    expect(findSubmittedMatch([other, match], 'g1', iso)?.id).toBe('b4');
  });
});

describe('priceOfDay', () => {
  it('lấy giá đúng ngày, bỏ qua ngày không có giá', () => {
    const days: DayInfo[] = [
      { date: new Date(2026, 9, 16), price: 180000 },
      { date: new Date(2026, 9, 17), price: 220000 },
      { date: new Date(2026, 9, 18) },
    ];
    expect(priceOfDay(days, '2026-10-17')).toBe(220000);
    expect(priceOfDay(days, '2026-10-18')).toBeUndefined();
    expect(priceOfDay(days, '2026-10-30')).toBeUndefined();
  });
});
