// Mapper thuần từ hàng Supabase sang kiểu miền Gymer (plan app-supabase-integration, T-G, D7). Không gọi mạng.
import type { Certificate, Gymer, Review } from '@/types/domain';
import type { GymerDetail } from '@/services/repositories/gymerRepository';
import type { Database } from '@/services/supabase/database.types';

/** Một hàng trả về của RPC search_gymers. */
export type SearchGymerRow = Database['public']['Functions']['search_gymers']['Returns'][number];

/** Hàng gymer_profiles kèm embed gymer_specialties, certificates, reviews (đúng chuỗi select trong gymerRepo). */
export interface GymerDetailRow {
  user_id: string;
  display_name: string;
  gender: Gymer['gender'];
  birth_year: number;
  area_label: string;
  avatar_url: string | null;
  bio: string | null;
  price_weekday_vnd: number;
  price_weekend_vnd: number;
  rating_avg: number;
  rating_count: number;
  gymer_specialties: { specialty_name: string }[];
  certificates: { id: string; name: string }[];
  reviews: { id: string; author_name: string; rating: number; body: string | null; created_at: string }[];
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Nhãn ngày 'dd/MM' theo giờ Việt Nam (UTC+7) của mốc ISO. Ép giờ VN ở mapper nên không phụ thuộc
 * múi giờ máy. Chuỗi không đọc được thì trả ''.
 */
function dateLabelVN(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const vn = new Date(ms + VN_OFFSET_MS);
  const dd = String(vn.getUTCDate()).padStart(2, '0');
  const mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** Năm dương lịch ở Việt Nam (UTC+7) tại thời điểm now. */
export function yearVN(now: Date): number {
  return new Date(now.getTime() + VN_OFFSET_MS).getUTCFullYear();
}

/** Tuổi theo năm sinh và năm hiện tại giờ Việt Nam. Không âm. */
export function ageFromBirthYear(birthYear: number, now: Date): number {
  return Math.max(0, yearVN(now) - birthYear);
}

/** Ánh xạ một hàng search_gymers. RPC không trả bio nên bio = ''. */
export function toGymerFromSearchRow(row: SearchGymerRow): Gymer {
  return {
    id: row.user_id,
    name: row.display_name,
    gender: row.gender,
    age: Math.max(0, row.age),
    area: row.area_label,
    distanceKm: row.distance_km,
    rating: row.rating_avg,
    reviewCount: row.rating_count,
    priceWeekday: row.price_weekday_vnd,
    priceWeekend: row.price_weekend_vnd,
    tags: row.tags ?? [],
    bio: '',
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
  };
}

/**
 * Ánh xạ chi tiết Gymer. distanceKm = 0 (không có nguồn, plan Q5).
 * Review.dateLabel theo giờ VN (dateLabelVN); text rỗng khi body null.
 */
export function toGymerDetail(row: GymerDetailRow, now: Date): GymerDetail {
  const gymer: Gymer = {
    id: row.user_id,
    name: row.display_name,
    gender: row.gender,
    age: ageFromBirthYear(row.birth_year, now),
    area: row.area_label,
    distanceKm: 0,
    rating: row.rating_avg,
    reviewCount: row.rating_count,
    priceWeekday: row.price_weekday_vnd,
    priceWeekend: row.price_weekend_vnd,
    tags: row.gymer_specialties.map((s) => s.specialty_name),
    bio: row.bio ?? '',
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
  };

  const certificates: Certificate[] = row.certificates.map((c) => ({ id: c.id, name: c.name }));

  const reviews: Review[] = row.reviews.map((r) => ({
    id: r.id,
    author: r.author_name,
    rating: r.rating,
    text: r.body ?? '',
    dateLabel: dateLabelVN(r.created_at),
  }));

  return { gymer, certificates, reviews };
}
