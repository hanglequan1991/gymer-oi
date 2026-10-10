import { describe, expect, it } from 'vitest';
import { ageFromBirthYear, toGymerDetail, toGymerFromSearchRow, yearVN } from './gymer';
import type { GymerDetailRow, SearchGymerRow } from './gymer';

const searchRow: SearchGymerRow = {
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
  tags: ['Gym', 'Yoga'],
};

const detailRow: GymerDetailRow = {
  user_id: 'g-2',
  display_name: 'Lan',
  gender: 'female',
  birth_year: 1995,
  area_label: 'Quận 3',
  avatar_url: null,
  bio: null,
  price_weekday_vnd: 150000,
  price_weekend_vnd: 180000,
  rating_avg: 4.5,
  rating_count: 2,
  gymer_specialties: [{ specialty_name: 'Giảm mỡ' }],
  certificates: [{ id: 'c-1', name: 'PT cấp 2' }],
  reviews: [
    { id: 'r-1', author_name: 'An', rating: 5, body: 'Tốt', created_at: '2026-10-10T12:00:00Z' },
    { id: 'r-2', author_name: 'Bình', rating: 4, body: null, created_at: '2026-10-09T12:00:00Z' },
  ],
};

describe('yearVN', () => {
  it('tính năm theo giờ Việt Nam, không theo UTC', () => {
    // 18:00 UTC ngày 31/12 là 01:00 ngày 01/01 ở Việt Nam.
    expect(yearVN(new Date('2026-12-31T18:00:00Z'))).toBe(2027);
  });
});

describe('ageFromBirthYear', () => {
  it('dùng năm giờ Việt Nam và không âm', () => {
    expect(ageFromBirthYear(2000, new Date('2026-12-31T18:00:00Z'))).toBe(27);
    expect(ageFromBirthYear(2030, new Date('2026-10-10T00:00:00Z'))).toBe(0);
  });
});

describe('toGymerFromSearchRow', () => {
  it('ánh xạ đúng tên trường, bio rỗng, giữ số liệu', () => {
    const g = toGymerFromSearchRow(searchRow);
    expect(g).toEqual({
      id: 'g-1',
      name: 'Minh',
      gender: 'male',
      age: 30,
      area: 'Quận 1',
      distanceKm: 1.2,
      rating: 4.8,
      reviewCount: 12,
      priceWeekday: 200000,
      priceWeekend: 250000,
      tags: ['Gym', 'Yoga'],
      bio: '',
      avatarUrl: 'https://example.com/a.png',
    });
  });

  it('avatar_url rỗng thì không có khoá avatarUrl', () => {
    const g = toGymerFromSearchRow({ ...searchRow, avatar_url: null as unknown as string });
    expect(g).not.toHaveProperty('avatarUrl');
  });

  it('tuổi không âm', () => {
    expect(toGymerFromSearchRow({ ...searchRow, age: -3 }).age).toBe(0);
  });
});

describe('toGymerDetail', () => {
  const now = new Date('2026-10-10T05:00:00Z');

  it('tính tuổi theo năm VN, distanceKm = 0, bio rỗng khi null', () => {
    const { gymer } = toGymerDetail(detailRow, now);
    expect(gymer.age).toBe(31);
    expect(gymer.distanceKm).toBe(0);
    expect(gymer.bio).toBe('');
    expect(gymer).not.toHaveProperty('avatarUrl');
    expect(gymer.tags).toEqual(['Giảm mỡ']);
    expect(gymer.rating).toBe(4.5);
  });

  it('không có chuyên môn thì tags rỗng', () => {
    const { gymer } = toGymerDetail({ ...detailRow, gymer_specialties: [] }, now);
    expect(gymer.tags).toEqual([]);
  });

  it('ánh xạ chứng chỉ và đánh giá; body null thành text rỗng', () => {
    const { certificates, reviews } = toGymerDetail(detailRow, now);
    expect(certificates).toEqual([{ id: 'c-1', name: 'PT cấp 2' }]);
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({ id: 'r-1', author: 'An', rating: 5, text: 'Tốt' });
    expect(reviews[1].text).toBe('');
    expect(reviews[0].dateLabel).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('dateLabel theo giờ VN, không theo múi giờ máy (qua nửa đêm VN)', () => {
    // 20:00Z = 03:00 ngày 18/10 giờ VN; máy LA còn ở 17/10, máy Kiritimati đã sang 18/10.
    const row = {
      ...detailRow,
      reviews: [
        { id: 'r-a', author_name: 'An', rating: 5, body: 'a', created_at: '2026-10-17T20:00:00Z' },
        { id: 'r-b', author_name: 'Bình', rating: 4, body: 'b', created_at: '2026-10-17T16:59:59Z' },
        { id: 'r-c', author_name: 'Cường', rating: 3, body: 'c', created_at: '2026-12-31T17:00:00Z' },
      ],
    };
    const { reviews } = toGymerDetail(row, now);
    expect(reviews.map((r) => r.dateLabel)).toEqual(['18/10', '17/10', '01/01']);
  });

  it('created_at không đọc được thì dateLabel là chuỗi rỗng, không NaN', () => {
    const row = {
      ...detailRow,
      reviews: [{ id: 'r-x', author_name: 'Dũng', rating: 5, body: null, created_at: 'không-phải-ngày' }],
    };
    const { reviews } = toGymerDetail(row, now);
    expect(reviews[0].dateLabel).toBe('');
  });

  it('không để undefined hay null lọt vào kiểu miền', () => {
    const { gymer, certificates, reviews } = toGymerDetail(detailRow, now);
    const values = [...Object.values(gymer), ...certificates.flatMap(Object.values), ...reviews.flatMap(Object.values)];
    expect(values.some((v) => v === undefined || v === null)).toBe(false);
  });
});
