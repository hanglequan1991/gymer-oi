import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { createFakeSupabase } from '@/test/fakeSupabase';
import { createGymerRepo } from './gymerRepo';

const center = { lat: 10.776312, lng: 106.701499 };
const fixedNow = () => new Date('2026-10-10T05:00:00Z');

const searchRow = {
  user_id: 'g-1',
  display_name: 'Minh',
  gender: 'male',
  age: 30,
  area_label: 'Quận 1',
  avatar_url: 'https://example.com/a.png',
  distance_km: 1.2,
  rating_avg: 4.8,
  rating_count: 12,
  price_weekday_vnd: 200000,
  price_weekend_vnd: 250000,
  tags: ['Gym'],
};

const detailData = {
  user_id: 'g-2',
  display_name: 'Lan',
  gender: 'female',
  birth_year: 1995,
  area_label: 'Quận 3',
  avatar_url: null,
  bio: 'Xin chào',
  price_weekday_vnd: 150000,
  price_weekend_vnd: 180000,
  rating_avg: 4.5,
  rating_count: 1,
  gymer_specialties: [{ specialty_name: 'Yoga' }],
  certificates: [{ id: 'c-1', name: 'PT cấp 2' }],
  reviews: [{ id: 'r-1', author_name: 'An', rating: 5, body: null, created_at: '2026-10-10T12:00:00Z' }],
};

describe('gymerRepo.search', () => {
  it('gọi search_gymers với toạ độ làm tròn 3 chữ số và bán kính, không gửi keyword/specialty rỗng', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { search_gymers: { data: [searchRow] } } });
    const repo = createGymerRepo(client, { now: fixedNow });

    const result = await repo.search({ center, radiusKm: 3 });

    expect(calls).toEqual([
      {
        kind: 'rpc',
        name: 'search_gymers',
        args: { p_lat: 10.776, p_lng: 106.701, p_radius_km: 3 },
        filters: [],
      },
    ]);
    expect(calls[0].args).not.toHaveProperty('p_keyword');
    expect(calls[0].args).not.toHaveProperty('p_specialty');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'g-1', name: 'Minh', bio: '', distanceKm: 1.2 });
  });

  it('keyword chỉ có khoảng trắng thì không gửi p_keyword', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { search_gymers: { data: [] } } });
    await createGymerRepo(client).search({ center, radiusKm: 1, keyword: '   ' });

    expect(calls[0].args).toEqual({ p_lat: 10.776, p_lng: 106.701, p_radius_km: 1 });
    expect(calls[0].args).not.toHaveProperty('p_keyword');
  });

  it('keyword được cắt khoảng trắng và tối đa 50 ký tự', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { search_gymers: { data: [] } } });
    const long = `  ${'a'.repeat(60)}  `;
    await createGymerRepo(client).search({ center, radiusKm: 2, keyword: long });

    expect(calls[0].args).toEqual({ p_lat: 10.776, p_lng: 106.701, p_radius_km: 2, p_keyword: 'a'.repeat(50) });
  });

  it('specialty được gửi đúng tên tham số p_specialty', async () => {
    const { client, calls } = createFakeSupabase({ rpc: { search_gymers: { data: [] } } });
    await createGymerRepo(client).search({ center, radiusKm: 5, specialty: 'Yoga' });

    expect(calls[0].args).toEqual({ p_lat: 10.776, p_lng: 106.701, p_radius_km: 5, p_specialty: 'Yoga' });
  });

  it('không có hàng (data null) trả danh sách rỗng', async () => {
    const { client } = createFakeSupabase({ rpc: { search_gymers: { data: null } } });
    await expect(createGymerRepo(client).search({ center, radiusKm: 1 })).resolves.toEqual([]);
  });

  it('lỗi RPC map sang mã của AppError', async () => {
    const { client, calls } = createFakeSupabase({
      rpc: { search_gymers: { error: { code: '42501', message: 'permission denied' } } },
    });

    await expect(createGymerRepo(client).search({ center, radiusKm: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('search_gymers');
  });

  it('lỗi mạng map sang NETWORK', async () => {
    const { client } = createFakeSupabase({
      rpc: { search_gymers: { error: { message: 'TypeError: Failed to fetch' } } },
    });
    await expect(createGymerRepo(client).search({ center, radiusKm: 1 })).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('gymerRepo.getDetail', () => {
  it('truy vấn gymer_profiles theo user_id, embed chuyên môn/chứng chỉ/đánh giá, giới hạn 20 đánh giá mới nhất', async () => {
    const { client, calls } = createFakeSupabase({ from: { gymer_profiles: { data: detailData } } });
    const repo = createGymerRepo(client, { now: fixedNow });

    const detail = await repo.getDetail('g-2');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: 'from', table: 'gymer_profiles', op: 'select' });
    expect(calls[0].filters).toEqual([
      { method: 'select', args: [expect.stringContaining('reviews(id,author_name,rating,body,created_at)')] },
      { method: 'eq', args: ['user_id', 'g-2'] },
      { method: 'order', args: ['created_at', { referencedTable: 'reviews', ascending: false }] },
      { method: 'limit', args: [20, { referencedTable: 'reviews' }] },
      { method: 'maybeSingle', args: [] },
    ]);
    expect(detail.gymer).toMatchObject({ id: 'g-2', name: 'Lan', age: 31, bio: 'Xin chào', tags: ['Yoga'] });
    expect(detail.certificates).toEqual([{ id: 'c-1', name: 'PT cấp 2' }]);
    expect(detail.reviews[0]).toMatchObject({ id: 'r-1', author: 'An', text: '' });
  });

  it('không có hàng (data null) ném NOT_FOUND', async () => {
    const { client, calls } = createFakeSupabase({ from: { gymer_profiles: { data: null } } });

    await expect(createGymerRepo(client, { now: fixedNow }).getDetail('nope')).rejects.toBeInstanceOf(AppError);
    await expect(createGymerRepo(client, { now: fixedNow }).getDetail('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(calls.every((c) => c.kind === 'from' && c.table === 'gymer_profiles')).toBe(true);
  });

  it('lỗi mạng ném NETWORK', async () => {
    const { client } = createFakeSupabase({
      from: { gymer_profiles: { error: { message: 'Failed to fetch' } } },
    });
    await expect(createGymerRepo(client).getDetail('g-2')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('không gọi RPC khi lấy chi tiết', async () => {
    const { client, calls } = createFakeSupabase({ from: { gymer_profiles: { data: detailData } } });
    await createGymerRepo(client, { now: fixedNow }).getDetail('g-2');
    expect(calls.some((c) => c.kind === 'rpc')).toBe(false);
  });
});
