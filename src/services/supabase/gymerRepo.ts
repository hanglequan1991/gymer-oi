// Repository Gymer trên Supabase (plan app-supabase-integration, T-G, D7): gymers.search và gymers.getDetail.
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../errors';
import { toGymerDetail, toGymerFromSearchRow } from '../mappers/gymer';
import type { GymerRepository } from '../repositories/gymerRepository';
import type { Database } from './database.types';
import { unwrapOrNull } from './postgrestError';

export interface GymerRepoDeps {
  now?: () => Date;
}

const ROUND_FACTOR = 1000; // làm tròn toạ độ 3 chữ số trước khi gửi (quyết định riêng tư, plan schema 2.3)
const KEYWORD_MAX_CHARS = 50;
const REVIEW_LIMIT = 20;

const DETAIL_SELECT = 'user_id,display_name,gender,birth_year,area_label,avatar_url,bio,price_weekday_vnd,price_weekend_vnd,rating_avg,rating_count,gymer_specialties(specialty_name),certificates(id,name),reviews(id,author_name,rating,body,created_at)';

function roundCoord(n: number): number {
  return Math.round(n * ROUND_FACTOR) / ROUND_FACTOR;
}

/** Từ khoá đã cắt khoảng trắng và tối đa 50 ký tự (đếm theo ký tự, không theo đơn vị UTF-16). */
function normalizeKeyword(raw: string | undefined): string {
  return Array.from((raw ?? '').trim()).slice(0, KEYWORD_MAX_CHARS).join('');
}

export function createGymerRepo(client: SupabaseClient<Database>, deps?: GymerRepoDeps): GymerRepository {
  const now = deps?.now ?? (() => new Date());

  return {
    async search(query) {
      const args: Database['public']['Functions']['search_gymers']['Args'] = {
        p_lat: roundCoord(query.center.lat),
        p_lng: roundCoord(query.center.lng),
        p_radius_km: query.radiusKm,
      };
      const keyword = normalizeKeyword(query.keyword);
      if (keyword !== '') args.p_keyword = keyword;
      if (query.specialty) args.p_specialty = query.specialty;

      const res = await client.rpc('search_gymers', args);
      const rows = unwrapOrNull(res) ?? [];
      return rows.map(toGymerFromSearchRow);
    },

    async getDetail(gymerId) {
      const res = await client
        .from('gymer_profiles')
        .select(DETAIL_SELECT)
        .eq('user_id', gymerId)
        .order('created_at', { referencedTable: 'reviews', ascending: false })
        .limit(REVIEW_LIMIT, { referencedTable: 'reviews' })
        .maybeSingle();

      const row = unwrapOrNull(res);
      if (row === null) {
        // Không có hàng: không tồn tại hoặc RLS ẩn.
        throw new AppError('NOT_FOUND', 'Không tìm thấy Gymer.');
      }
      return toGymerDetail(row, now());
    },
  };
}
