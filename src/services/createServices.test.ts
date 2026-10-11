// Kiểm thử composition root: nhánh mock giữ NOT_IMPLEMENTED; nhánh supabase nối đúng từng repository.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '@/config';
import type { AuthPort } from '@/platform/ports';
import { AppError } from './errors';
import { createServices, type AppSupabaseClient } from './createServices';
import type { Services } from './index';

// Mỗi repository được thay bằng bản giả trả về tên phương thức, để kiểm tra việc nối dây.
const fakes = vi.hoisted(() => ({
  gymers: { search: async () => 'gymers.search', getDetail: async () => 'gymers.getDetail' },
  schedule: {
    getMonth: async () => 'schedule.getMonth',
    getDaySlots: async () => 'schedule.getDaySlots',
    setPrices: async () => 'schedule.setPrices',
    setSlotClosed: async () => 'schedule.setSlotClosed',
  },
  bookings: { create: async () => 'bookings.create' },
  requests: { list: async () => 'requests.list', respond: async () => 'requests.respond' },
  profile: { getMine: async () => 'profile.getMine', updateMine: async () => 'profile.updateMine' },
  session: {
    signIn: async () => 'session.signIn',
    getSession: async () => 'session.getSession',
    signOut: async () => 'session.signOut',
  },
  client: { marker: 'built-client' },
}));

vi.mock('./supabase/client', () => ({ createSupabaseClient: vi.fn(() => fakes.client) }));
vi.mock('./supabase/gymerRepo', () => ({ createGymerRepo: vi.fn(() => fakes.gymers) }));
vi.mock('./supabase/scheduleRepo', () => ({ createScheduleRepo: vi.fn(() => fakes.schedule) }));
vi.mock('./supabase/bookingRepo', () => ({ createBookingRepo: vi.fn(() => fakes.bookings) }));
vi.mock('./supabase/requestRepo', () => ({ createRequestRepo: vi.fn(() => fakes.requests) }));
vi.mock('./supabase/profileRepo', () => ({ createProfileRepo: vi.fn(() => fakes.profile) }));
vi.mock('./supabase/sessionRepo', () => ({ createSessionRepo: vi.fn(() => fakes.session) }));

import { createGymerRepo } from './supabase/gymerRepo';
import { createScheduleRepo } from './supabase/scheduleRepo';
import { createBookingRepo } from './supabase/bookingRepo';
import { createRequestRepo } from './supabase/requestRepo';
import { createProfileRepo } from './supabase/profileRepo';
import { createSessionRepo } from './supabase/sessionRepo';
import { createSupabaseClient } from './supabase/client';

/** Mỗi phần tử: tên phương thức, lệnh gọi, và tên kết quả mong đợi ở nhánh supabase. */
const calls: Array<[string, (s: Services) => Promise<unknown>, string]> = [
  ['gymers.search', (s) => s.gymers.search({ center: { lat: 10.77, lng: 106.7 }, radiusKm: 2 }), 'gymers.search'],
  ['gymers.getDetail', (s) => s.gymers.getDetail('g1'), 'gymers.getDetail'],
  ['schedule.getMonth', (s) => s.schedule.getMonth('g1', 2026, 10), 'schedule.getMonth'],
  ['schedule.getDaySlots', (s) => s.schedule.getDaySlots('g1', '2026-10-09'), 'schedule.getDaySlots'],
  ['schedule.setPrices', (s) => s.schedule.setPrices({ weekday: 100000, weekend: 150000 }), 'schedule.setPrices'],
  ['schedule.setSlotClosed', (s) => s.schedule.setSlotClosed('slot1', true), 'schedule.setSlotClosed'],
  [
    'bookings.create',
    (s) => s.bookings.create({ gymerId: 'g1', startIso: '2026-10-09T08:00:00Z', endIso: '2026-10-09T09:00:00Z', expectedPrice: 150000 }),
    'bookings.create',
  ],
  ['requests.list', (s) => s.requests.list(), 'requests.list'],
  ['requests.respond', (s) => s.requests.respond('r1', 'confirmed'), 'requests.respond'],
  ['profile.getMine', (s) => s.profile.getMine(), 'profile.getMine'],
  ['profile.updateMine', (s) => s.profile.updateMine({ name: 'Quán' }), 'profile.updateMine'],
  ['session.signIn', (s) => s.session.signIn(), 'session.signIn'],
  ['session.getSession', (s) => s.session.getSession(), 'session.getSession'],
  ['session.signOut', (s) => s.session.signOut(), 'session.signOut'],
];

const FAKE_CLIENT = { marker: 'client' } as unknown as AppSupabaseClient;
const FAKE_AUTH = { login: vi.fn(), getProfile: vi.fn() } as unknown as AuthPort;
const SUPABASE_ENV: AppEnv = { dataSource: 'supabase', supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'anon-key' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createServices với nguồn "mock"', () => {
  it.each(calls)('%s ném AppError với mã NOT_IMPLEMENTED', async (_name, call) => {
    const services = createServices({ dataSource: 'mock' });

    await expect(call(services)).rejects.toBeInstanceOf(AppError);
    await expect(call(services)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('thông báo lỗi có nêu nguồn dữ liệu', async () => {
    const services = createServices({ dataSource: 'mock' });

    await expect(services.gymers.getDetail('g1')).rejects.toThrow('mock');
  });

  it('không dựng client Supabase và không tạo repository thật', () => {
    createServices({ dataSource: 'mock' });

    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(createGymerRepo).not.toHaveBeenCalled();
    expect(createSessionRepo).not.toHaveBeenCalled();
  });
});

describe('createServices với nguồn "supabase"', () => {
  it('trả về đủ sáu nhóm repository', () => {
    const services = createServices(SUPABASE_ENV, { client: FAKE_CLIENT, auth: FAKE_AUTH });

    expect(Object.keys(services).sort()).toEqual(['bookings', 'gymers', 'profile', 'requests', 'schedule', 'session']);
  });

  it.each(calls)('%s gọi đúng repository thật', async (_name, call, expected) => {
    const services = createServices(SUPABASE_ENV, { client: FAKE_CLIENT, auth: FAKE_AUTH });

    await expect(call(services)).resolves.toBe(expected);
  });

  it('dùng client được truyền vào và không tạo client mới', () => {
    createServices(SUPABASE_ENV, { client: FAKE_CLIENT, auth: FAKE_AUTH });

    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(createGymerRepo).toHaveBeenCalledWith(FAKE_CLIENT, { now: undefined });
    expect(createScheduleRepo).toHaveBeenCalledWith(FAKE_CLIENT);
    expect(createBookingRepo).toHaveBeenCalledWith(FAKE_CLIENT);
    expect(createRequestRepo).toHaveBeenCalledWith(FAKE_CLIENT, { now: undefined });
    expect(createSessionRepo).toHaveBeenCalledWith(FAKE_CLIENT, FAKE_AUTH);
  });

  it('không có deps.client thì dựng client từ env và storage', () => {
    const storage = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
    createServices(SUPABASE_ENV, { storage, auth: FAKE_AUTH });

    expect(createSupabaseClient).toHaveBeenCalledWith(SUPABASE_ENV, storage);
    expect(createGymerRepo).toHaveBeenCalledWith(fakes.client, { now: undefined });
  });

  it('profile nhận đúng repository gymers đã dựng', () => {
    createServices(SUPABASE_ENV, { client: FAKE_CLIENT, auth: FAKE_AUTH });

    expect(createProfileRepo).toHaveBeenCalledWith(FAKE_CLIENT, fakes.gymers);
  });

  it('truyền now xuống repository cần thời điểm hiện tại', () => {
    const now = () => new Date('2026-10-11T00:00:00Z');
    createServices(SUPABASE_ENV, { client: FAKE_CLIENT, auth: FAKE_AUTH, now });

    expect(createGymerRepo).toHaveBeenCalledWith(FAKE_CLIENT, { now });
    expect(createRequestRepo).toHaveBeenCalledWith(FAKE_CLIENT, { now });
  });

  it('không gọi fetch khi dựng services', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    createServices(SUPABASE_ENV, { client: FAKE_CLIENT, auth: FAKE_AUTH });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('thiếu deps.auth: dựng được, session.signIn ném UNKNOWN có thông báo rõ, các phương thức khác vẫn chạy', async () => {
    const services = createServices(SUPABASE_ENV, { client: FAKE_CLIENT });

    await expect(services.session.signIn()).rejects.toMatchObject({ code: 'UNKNOWN' });
    await expect(services.session.signIn()).rejects.toThrow('AuthPort');
    await expect(services.session.getSession()).resolves.toBe('session.getSession');
    await expect(services.gymers.search({ center: { lat: 10.77, lng: 106.7 }, radiusKm: 2 })).resolves.toBe('gymers.search');
  });
});
