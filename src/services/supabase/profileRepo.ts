// Repository hồ sơ của chính Gymer trên Supabase (plan app-supabase-integration, T-P, D7): getMine và updateMine.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Gymer, Specialty } from '@/types/domain';
import { AppError } from '../errors';
import type { GymerDetail, GymerRepository } from '../repositories/gymerRepository';
import type { ProfileRepository } from '../repositories/profileRepository';
import type { Database } from './database.types';
import { assertOk, unwrapOrNull } from './postgrestError';
import { requireUserId } from './userId';

type ProfilePatch = Parameters<ProfileRepository['updateMine']>[0];

/** Ràng buộc độ dài khớp migration (display_name 1-50, area_label 1-100, bio tối đa 1000 ký tự). */
const NAME_MAX = 50;
const AREA_MAX = 100;
const BIO_MAX = 1000;

/** Danh sách chuyên môn hợp lệ (khớp bảng `specialties`). */
const SPECIALTIES: readonly Specialty[] = ['Gym', 'Giảm mỡ', 'Tăng cơ', 'Yoga', 'Calisthenics', 'Giãn cơ'];
const SPECIALTY_SET: ReadonlySet<string> = new Set<string>(SPECIALTIES);

/** Đếm theo ký tự (code point), giống cách server đếm char_length. */
function charLength(s: string): number {
  return Array.from(s).length;
}

function invalid(message: string): AppError {
  return new AppError('VALIDATION', message);
}

interface ValidPatch {
  /** Cột của gymer_profiles cần ghi (chỉ các cột client được phép). */
  scalar: { display_name?: string; bio?: string; area_label?: string };
  /** Danh sách chuyên môn mong muốn sau khi cập nhật; undefined nghĩa là không đổi. */
  tags?: string[];
}

/** Kiểm đầu vào ngay tại client, trước mọi lệnh mạng. Ném VALIDATION khi sai. */
function validatePatch(patch: ProfilePatch): ValidPatch {
  const scalar: ValidPatch['scalar'] = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    const len = charLength(name);
    if (len < 1 || len > NAME_MAX) throw invalid('Tên hiển thị phải từ 1 đến 50 ký tự.');
    scalar.display_name = name;
  }
  if (patch.area !== undefined) {
    const area = patch.area.trim();
    const len = charLength(area);
    if (len < 1 || len > AREA_MAX) throw invalid('Khu vực phải từ 1 đến 100 ký tự.');
    scalar.area_label = area;
  }
  if (patch.bio !== undefined) {
    const bio = patch.bio.trim();
    if (charLength(bio) > BIO_MAX) throw invalid('Giới thiệu tối đa 1000 ký tự.');
    scalar.bio = bio;
  }

  let tags: string[] | undefined;
  if (patch.tags !== undefined) {
    tags = [...new Set(patch.tags)];
    if (tags.some((t) => !SPECIALTY_SET.has(t))) throw invalid('Chuyên môn không hợp lệ.');
  }

  return { scalar, tags };
}

export function createProfileRepo(client: SupabaseClient<Database>, gymers: GymerRepository): ProfileRepository {
  /** Đồng bộ gymer_specialties: chèn các chuyên môn còn thiếu trước, rồi xoá các chuyên môn thừa sau. */
  async function syncSpecialties(uid: string, desired: string[]): Promise<void> {
    const currentRows =
      unwrapOrNull(await client.from('gymer_specialties').select('specialty_name').eq('gymer_id', uid)) ?? [];
    const current = new Set(currentRows.map((r) => r.specialty_name));
    const want = new Set(desired);

    const missing = desired.filter((name) => !current.has(name));
    const extra = [...current].filter((name) => !want.has(name));

    if (missing.length > 0) {
      assertOk(
        await client
          .from('gymer_specialties')
          .insert(missing.map((name) => ({ gymer_id: uid, specialty_name: name }))),
      );
    }
    if (extra.length > 0) {
      assertOk(await client.from('gymer_specialties').delete().eq('gymer_id', uid).in('specialty_name', extra));
    }
  }

  return {
    async getMine(): Promise<GymerDetail> {
      const uid = await requireUserId(client);
      return gymers.getDetail(uid);
    },

    async updateMine(patch) {
      // Kiểm đầu vào trước: lỗi VALIDATION không gọi mạng (kể cả không gọi getSession).
      const input = validatePatch(patch);
      const uid = await requireUserId(client);
      const hasScalar = Object.keys(input.scalar).length > 0;

      if (hasScalar) {
        // Chỉ dòng của chính mình được ghi (RLS). Không có dòng nào nghĩa là không phải Gymer.
        const res = await client
          .from('gymer_profiles')
          .update(input.scalar)
          .eq('user_id', uid)
          .select('user_id');
        assertOk(res);
        if (!res.data || res.data.length === 0) {
          throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ Gymer.');
        }
      } else if (input.tags !== undefined) {
        // Chỉ đổi chuyên môn: vẫn phải xác nhận có hồ sơ Gymer, vì khoá ngoại không báo lỗi nghiệp vụ rõ ràng.
        const exists = unwrapOrNull(
          await client.from('gymer_profiles').select('user_id').eq('user_id', uid).maybeSingle(),
        );
        if (exists === null) {
          throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ Gymer.');
        }
      }

      if (input.tags !== undefined) {
        await syncSpecialties(uid, input.tags);
      }

      // Đọc lại hồ sơ đầy đủ để trả về đúng dữ liệu server đang giữ (kể cả khi patch rỗng).
      const detail = await gymers.getDetail(uid);
      return detail.gymer satisfies Gymer;
    },
  };
}
