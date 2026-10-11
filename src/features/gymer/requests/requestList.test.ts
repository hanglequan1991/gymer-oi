import { describe, expect, it } from 'vitest';
import { countByStatus, listForTab } from './requestList';
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
