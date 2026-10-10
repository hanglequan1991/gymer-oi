// Kiểm thử bước khung của createServices: mọi phương thức phải ném NOT_IMPLEMENTED.
import { describe, expect, it } from 'vitest';
import type { DataSource } from '@/config';
import { AppError } from './errors';
import { createServices } from './createServices';
import type { Services } from './index';

/** Mỗi phần tử: tên phương thức và lệnh gọi tương ứng (đối số hợp kiểu, nội dung không quan trọng). */
const calls: Array<[string, (s: Services) => Promise<unknown>]> = [
  ['gymers.search', (s) => s.gymers.search({ center: { lat: 10.77, lng: 106.7 }, radiusKm: 2 })],
  ['gymers.getDetail', (s) => s.gymers.getDetail('g1')],
  ['schedule.getMonth', (s) => s.schedule.getMonth('g1', 2026, 10)],
  ['schedule.getDaySlots', (s) => s.schedule.getDaySlots('g1', '2026-10-09')],
  ['schedule.setPrices', (s) => s.schedule.setPrices({ weekday: 100000, weekend: 150000 })],
  ['schedule.setSlotClosed', (s) => s.schedule.setSlotClosed('slot1', true)],
  ['bookings.create', (s) => s.bookings.create({ gymerId: 'g1', startIso: '2026-10-09T08:00:00Z', endIso: '2026-10-09T09:00:00Z', expectedPrice: 150000 })],
  ['requests.list', (s) => s.requests.list()],
  ['requests.respond', (s) => s.requests.respond('r1', 'confirmed')],
  ['profile.getMine', (s) => s.profile.getMine()],
  ['profile.updateMine', (s) => s.profile.updateMine({ name: 'Quán' })],
  ['session.signIn', (s) => s.session.signIn()],
  ['session.getSession', (s) => s.session.getSession()],
  ['session.signOut', (s) => s.session.signOut()],
];

describe.each<DataSource>(['mock', 'supabase'])('createServices với nguồn "%s"', (dataSource) => {
  it('trả về đủ sáu nhóm repository', () => {
    const services = createServices({ dataSource });

    expect(Object.keys(services).sort()).toEqual(['bookings', 'gymers', 'profile', 'requests', 'schedule', 'session']);
  });

  it.each(calls)('%s ném AppError với mã NOT_IMPLEMENTED', async (_name, call) => {
    const services = createServices({ dataSource });

    await expect(call(services)).rejects.toBeInstanceOf(AppError);
    await expect(call(services)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('thông báo lỗi có nêu nguồn dữ liệu', async () => {
    const services = createServices({ dataSource });

    await expect(services.gymers.getDetail('g1')).rejects.toThrow(dataSource);
  });
});
