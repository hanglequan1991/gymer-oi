// Repository hồ sơ của chính Gymer trên Supabase (plan app-supabase-integration, T-P, D7; plan app-ui-integration, T05).
import type { SupabaseClient } from '@supabase/supabase-js';
import { SPECIALTIES, type BecomeGymerInput, type Certificate, type Gymer, type GymerAccountStatus } from '@/types/domain';
import type { GeoPoint } from '@/types/geo';
import { AppError } from '../errors';
import type { GymerDetail, GymerRepository } from '../repositories/gymerRepository';
import type { ProfileRepository } from '../repositories/profileRepository';
import type { Database } from './database.types';
import { assertOk, toAppError, unwrap, unwrapOrNull } from './postgrestError';
import { requireUserId } from './userId';

type ProfilePatch = Parameters<ProfileRepository['updateMine']>[0];

/** Ràng buộc độ dài khớp migration (display_name 1-50, area_label 1-100, bio tối đa 1000 ký tự). */
const NAME_MAX = 50;
const AREA_MAX = 100;
const BIO_MAX = 1000;
const CERT_NAME_MAX = 100;

/** Giá VND: số nguyên 0..5.000.000 (khớp check của gymer_profiles). */
const MAX_PRICE_VND = 5_000_000;
/** Tuổi Gymer tối thiểu (trigger gymer_profiles_check_age). */
const MIN_AGE = 18;
/** Năm sinh sớm nhất cho phép (khớp check birth_year của gymer_profiles). */
const MIN_BIRTH_YEAR = 1940;
/** Hệ số làm tròn toạ độ: 3 chữ số thập phân (~110 m), khớp quyết định riêng tư của schema. */
const ROUND_FACTOR = 1000;

const SPECIALTY_SET: ReadonlySet<string> = new Set<string>(SPECIALTIES);
const GENDERS: ReadonlySet<string> = new Set<string>(['female', 'male']);

/** Đếm theo ký tự (code point), giống cách server đếm char_length. */
function charLength(s: string): number {
  return Array.from(s).length;
}

function invalid(message: string): AppError {
  return new AppError('VALIDATION', message);
}

/** Năm hiện tại theo giờ Việt Nam: tuổi và năm sinh tính theo múi giờ này (trigger cũng dùng Asia/Ho_Chi_Minh). */
function currentYearVN(): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date()));
}

function roundCoord(n: number): number {
  return Math.round(n * ROUND_FACTOR) / ROUND_FACTOR;
}

function assertPrice(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_PRICE_VND) {
    throw invalid(`Giá ${label} phải là số nguyên từ 0 đến 5.000.000 đ.`);
  }
}

/** Kiểm đầu vào đăng ký Gymer ngay tại client, trước mọi lệnh mạng. Ném VALIDATION khi sai. */
function validateBecomeGymer(input: BecomeGymerInput): BecomeGymerInput {
  const name = input.name.trim();
  const nameLen = charLength(name);
  if (nameLen < 1 || nameLen > NAME_MAX) throw invalid('Tên hiển thị phải từ 1 đến 50 ký tự.');

  const area = input.area.trim();
  const areaLen = charLength(area);
  if (areaLen < 1 || areaLen > AREA_MAX) throw invalid('Khu vực phải từ 1 đến 100 ký tự.');

  if (!GENDERS.has(input.gender)) throw invalid('Giới tính không hợp lệ.');

  const maxBirthYear = currentYearVN() - MIN_AGE;
  if (!Number.isInteger(input.birthYear) || input.birthYear < MIN_BIRTH_YEAR || input.birthYear > maxBirthYear) {
    throw invalid(`Năm sinh phải từ ${MIN_BIRTH_YEAR} đến ${maxBirthYear}.`);
  }

  assertPrice('ngày thường', input.priceWeekday);
  assertPrice('cuối tuần', input.priceWeekend);

  if (input.tags.some((t) => !SPECIALTY_SET.has(t))) throw invalid('Chuyên môn không hợp lệ.');

  return { ...input, name, area, tags: [...new Set(input.tags)] };
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

    async getMyStatus(): Promise<GymerAccountStatus | null> {
      const uid = await requireUserId(client);
      const profileRes = await client
        .from('gymer_profiles')
        .select('is_listed, accepts_requests')
        .eq('user_id', uid)
        .maybeSingle();
      const profile = unwrapOrNull(profileRes);
      if (profile === null) return null;

      const locationRes = await client.from('gymer_locations').select('user_id').eq('user_id', uid).maybeSingle();
      const location = unwrapOrNull(locationRes);
      return {
        isListed: profile.is_listed,
        acceptsRequests: profile.accepts_requests,
        hasLocation: location !== null,
      };
    },

    async becomeGymer(rawInput) {
      // Kiểm đầu vào trước: lỗi VALIDATION không gọi mạng.
      const input = validateBecomeGymer(rawInput);
      const uid = await requireUserId(client);

      const inserted = await client.from('gymer_profiles').insert({
        user_id: uid,
        display_name: input.name,
        gender: input.gender,
        birth_year: input.birthYear,
        area_label: input.area,
        avatar_url: input.avatarUrl ?? null,
        price_weekday_vnd: input.priceWeekday,
        price_weekend_vnd: input.priceWeekend,
        // Đăng ký xong chưa hiển thị: Gymer chủ động bật sau khi có vị trí.
        is_listed: false,
        accepts_requests: true,
      });
      if (inserted.error != null) {
        // Đọc SQLSTATE thô trước khi toAppError (toAppError đưa 23505 về UNKNOWN): 23505 = đã có hồ sơ.
        const code = (inserted.error as { code?: string }).code;
        if (code === '23505') throw invalid('Bạn đã là Gymer.');
        throw toAppError(inserted.error);
      }

      await syncSpecialties(uid, input.tags);
    },

    async setVisibility(patch) {
      const uid = await requireUserId(client);

      // Bật hiển thị khi chưa có vị trí: chặn ở client, không gọi update (server không có ràng buộc này).
      if (patch.isListed === true) {
        const location = unwrapOrNull(
          await client.from('gymer_locations').select('user_id').eq('user_id', uid).maybeSingle(),
        );
        if (location === null) throw invalid('Cần đặt vị trí trước khi hiển thị.');
      }

      const fields: { is_listed?: boolean; accepts_requests?: boolean } = {};
      if (patch.isListed !== undefined) fields.is_listed = patch.isListed;
      if (patch.acceptsRequests !== undefined) fields.accepts_requests = patch.acceptsRequests;
      if (Object.keys(fields).length === 0) return;

      const res = await client.from('gymer_profiles').update(fields).eq('user_id', uid).select('user_id');
      assertOk(res);
      if (!res.data || res.data.length === 0) {
        throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ Gymer.');
      }
    },

    async setLocation(point: GeoPoint) {
      if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) {
        throw invalid('Vĩ độ không hợp lệ.');
      }
      if (!Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) {
        throw invalid('Kinh độ không hợp lệ.');
      }
      const uid = await requireUserId(client);
      const coords = { lat: roundCoord(point.lat), lng: roundCoord(point.lng) };

      // Client không có quyền upsert: cập nhật trước, không có hàng thì chèn (mẫu của setSlotClosed).
      const updated = await client.from('gymer_locations').update(coords).eq('user_id', uid).select('user_id');
      assertOk(updated);
      if (updated.data && updated.data.length > 0) return;

      const inserted = await client.from('gymer_locations').insert({ user_id: uid, ...coords });
      if (inserted.error != null) {
        const code = (inserted.error as { code?: string }).code;
        // 23503: chưa có gymer_profiles (chưa là Gymer) nên khoá ngoại chặn việc chèn.
        if (code === '23503') throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ Gymer.');
        throw toAppError(inserted.error);
      }
    },

    async addCertificate(rawName: string): Promise<Certificate> {
      const name = rawName.trim();
      const len = charLength(name);
      if (len < 1 || len > CERT_NAME_MAX) throw invalid('Tên chứng chỉ phải từ 1 đến 100 ký tự.');
      const uid = await requireUserId(client);

      // Trigger giới hạn 10 chứng chỉ raise LIMIT_REACHED (đi qua toAppError -> appErrorFromRpc).
      const res = await client
        .from('certificates')
        .insert({ gymer_id: uid, name })
        .select('id,name')
        .single();
      if (res.error != null) {
        const code = (res.error as { code?: string }).code;
        // 23503: chưa là Gymer (không có gymer_profiles để gắn chứng chỉ).
        if (code === '23503') throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ Gymer.');
        throw toAppError(res.error);
      }
      const row = unwrap(res);
      return { id: row.id, name: row.name };
    },

    async removeCertificate(id: string) {
      const uid = await requireUserId(client);
      // Lọc theo gymer_id của chính mình: không xoá được chứng chỉ người khác.
      const res = await client.from('certificates').delete().eq('id', id).eq('gymer_id', uid).select('id');
      assertOk(res);
      if (!res.data || res.data.length === 0) {
        throw new AppError('NOT_FOUND', 'Không tìm thấy chứng chỉ.');
      }
    },
  };
}
