import { describe, expect, it } from 'vitest';
import { countByStatus, isStaleRequest, listForTab, withoutStale } from './requestList';
import type { BookingRequest } from '@/types/domain';

const base = { customerName: 'Khách', price: 0 } as const;

describe('requestList', () => {
  it('đếm đúng theo trạng thái, kể cả khi không có yêu cầu nào', () => {
    const list: BookingRequest[] = [
      { ...base, id: '1', start: '2026-10-12T09:00:00+07:00', end: '', status: 'pending' },
      { ...base, id: '2', start: '2026-10-12T09:00:00+07:00', end: '', status: 'confirmed' },
    ];
    expect(countByStatus(list)).toEqual({ pending: 1, confirmed: 1, rejected: 0 });
    expect(countByStatus([])).toEqual({ pending: 0, confirmed: 0, rejected: 0 });
  });

  it('listForTab lọc đúng trạng thái và sắp theo giờ bắt đầu, không đổi mảng gốc', () => {
    const list: BookingRequest[] = [
      { ...base, id: 'late', start: '2026-10-12T18:00:00+07:00', end: '', status: 'pending' },
      { ...base, id: 'other', start: '2026-10-12T07:00:00+07:00', end: '', status: 'rejected' },
      { ...base, id: 'early', start: '2026-10-12T07:30:00+07:00', end: '', status: 'pending' },
    ];
    const snapshot = list.map((r) => r.id);
    expect(listForTab(list, 'pending').map((r) => r.id)).toEqual(['early', 'late']);
    expect(list.map((r) => r.id)).toEqual(snapshot);
  });
});

describe('requestList: yêu cầu chờ duyệt quá hạn', () => {
  const NOW = new Date('2026-10-11T10:00:00+07:00');

  it('withoutStale bỏ pending đã quá hạn, giữ pending còn hạn, confirmed và rejected', () => {
    const list: BookingRequest[] = [
      { ...base, id: 'stale', start: '2026-10-12T09:00:00+07:00', end: '', status: 'pending', expiresAt: '2026-10-11T09:59:59+07:00' },
      { ...base, id: 'fresh', start: '2026-10-12T09:00:00+07:00', end: '', status: 'pending', expiresAt: '2026-10-11T10:00:01+07:00' },
      { ...base, id: 'confirmedOld', start: '2026-10-12T09:00:00+07:00', end: '', status: 'confirmed', expiresAt: '2026-10-11T09:00:00+07:00' },
      { ...base, id: 'rejected', start: '2026-10-12T09:00:00+07:00', end: '', status: 'rejected' },
    ];
    expect(withoutStale(list, NOW).map((r) => r.id)).toEqual(['fresh', 'confirmedOld', 'rejected']);
    expect(list).toHaveLength(4);
  });

  it('pending quá hạn đúng tại mốc expiresAt (<=) và không có expiresAt thì không bị coi là quá hạn', () => {
    const atBoundary: BookingRequest = { ...base, id: 'b', start: '', end: '', status: 'pending', expiresAt: NOW.toISOString() };
    const noExpiry: BookingRequest = { ...base, id: 'n', start: '', end: '', status: 'pending' };
    expect(isStaleRequest(atBoundary, NOW)).toBe(true);
    expect(isStaleRequest(noExpiry, NOW)).toBe(false);
  });

  it('đếm theo countByStatus sau khi đã lọc không tính pending quá hạn', () => {
    const list: BookingRequest[] = [
      { ...base, id: '1', start: '', end: '', status: 'pending', expiresAt: '2026-10-11T09:00:00+07:00' },
      { ...base, id: '2', start: '', end: '', status: 'pending', expiresAt: '2026-10-12T09:00:00+07:00' },
    ];
    expect(countByStatus(withoutStale(list, NOW))).toEqual({ pending: 1, confirmed: 0, rejected: 0 });
  });
});
