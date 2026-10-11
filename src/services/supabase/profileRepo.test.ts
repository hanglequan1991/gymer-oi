import { describe, expect, it, vi } from 'vitest';
import type { GymerDetail, GymerRepository } from '../repositories/gymerRepository';
import { AppError } from '../errors';
import { createFakeSupabase, type FakeCall } from '@/test/fakeSupabase';
import { createProfileRepo } from './profileRepo';

const session = { user: { id: 'u1' } };

const detail: GymerDetail = {
  gymer: {
    id: 'u1',
    name: 'Lan',
    gender: 'female',
    age: 30,
    area: 'Quận 3',
    distanceKm: 0,
    rating: 4.5,
    reviewCount: 1,
    priceWeekday: 150000,
    priceWeekend: 180000,
    tags: ['Yoga'],
    bio: 'Xin chào',
  },
  certificates: [],
  reviews: [],
};

function stubGymers(): { gymers: GymerRepository; getDetail: ReturnType<typeof vi.fn> } {
  const getDetail = vi.fn(async () => detail);
  const gymers: GymerRepository = { search: vi.fn(async () => []), getDetail: getDetail as GymerRepository['getDetail'] };
  return { gymers, getDetail };
}

/** Các lệnh ghi (insert/update/delete/upsert) đã gửi. */
function writes(calls: FakeCall[]): FakeCall[] {
  return calls.filter((c) => c.kind === 'from' && c.op !== 'select');
}

async function expectAppError(p: Promise<unknown>, code: string): Promise<void> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
}

describe('profileRepo.getMine', () => {
  it('trả chi tiết Gymer của người đang đăng nhập qua gymers.getDetail', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session } });
    const { gymers, getDetail } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expect(repo.getMine()).resolves.toEqual(detail);
    expect(getDetail).toHaveBeenCalledWith('u1');
    expect(writes(calls)).toHaveLength(0);
  });

  it('chưa đăng nhập thì ném UNAUTHENTICATED và không gọi getDetail', async () => {
    const { client } = createFakeSupabase({});
    const { gymers, getDetail } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expectAppError(repo.getMine(), 'UNAUTHENTICATED');
    expect(getDetail).not.toHaveBeenCalled();
  });
});

describe('profileRepo.updateMine: cột và kiểm đầu vào', () => {
  it('patch rỗng không gửi lệnh ghi nào và trả hồ sơ hiện tại', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session } });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expect(repo.updateMine({})).resolves.toEqual(detail.gymer);
    expect(writes(calls)).toHaveLength(0);
  });

  it('ánh xạ name/area/bio sang display_name/area_label/bio, cắt khoảng trắng, eq theo user_id', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await repo.updateMine({ name: '  Lan Nguyễn ', area: ' Quận 1 ', bio: ' Chào ' });

    const upd = calls.find((c) => c.kind === 'from' && c.op === 'update')!;
    expect(upd.table).toBe('gymer_profiles');
    expect(upd.payload).toEqual({ display_name: 'Lan Nguyễn', area_label: 'Quận 1', bio: 'Chào' });
    expect(upd.filters!.find((s) => s.method === 'eq')?.args).toEqual(['user_id', 'u1']);
    // Không có lệnh nào ghi cột ngoài danh sách cho phép.
    expect(Object.keys(upd.payload as object).sort()).toEqual(['area_label', 'bio', 'display_name']);
    expect(calls.some((c) => c.kind === 'from' && c.table === 'gymer_specialties')).toBe(false);
  });

  it('chỉ đổi bio thì không kèm cột nào khác trong payload', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await repo.updateMine({ bio: '' });

    const upd = calls.find((c) => c.kind === 'from' && c.op === 'update')!;
    expect(upd.payload).toEqual({ bio: '' });
  });

  it('name rỗng hoặc quá 50 ký tự -> VALIDATION, không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session } });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expectAppError(repo.updateMine({ name: '   ' }), 'VALIDATION');
    await expectAppError(repo.updateMine({ name: 'a'.repeat(51) }), 'VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('name đúng 50 ký tự được chấp nhận (đếm theo ký tự, không theo UTF-16)', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expect(repo.updateMine({ name: 'ệ'.repeat(50) })).resolves.toEqual(detail.gymer);
  });

  it('area rỗng hoặc quá 100 ký tự, bio quá 1000 ký tự -> VALIDATION, không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session } });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expectAppError(repo.updateMine({ area: '' }), 'VALIDATION');
    await expectAppError(repo.updateMine({ area: 'a'.repeat(101) }), 'VALIDATION');
    await expectAppError(repo.updateMine({ bio: 'b'.repeat(1001) }), 'VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('tag lạ -> VALIDATION, không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session } });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expectAppError(repo.updateMine({ tags: ['Yoga', 'Bóng rổ'] }), 'VALIDATION');
    expect(calls).toHaveLength(0);
  });
});

describe('profileRepo.updateMine: không phải Gymer và lỗi server', () => {
  it('update không trả hàng nào (không phải Gymer hoặc RLS ẩn) -> NOT_FOUND', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: [] } },
    });
    const { gymers, getDetail } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expectAppError(repo.updateMine({ name: 'Lan' }), 'NOT_FOUND');
    expect(getDetail).not.toHaveBeenCalled();
    expect(calls.some((c) => c.kind === 'from' && c.table === 'gymer_specialties')).toBe(false);
  });

  it('chỉ đổi tags mà không có hồ sơ Gymer -> NOT_FOUND, không chèn chuyên môn', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: null } },
    });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expectAppError(repo.updateMine({ tags: ['Gym'] }), 'NOT_FOUND');
    expect(writes(calls).filter((c) => c.table === 'gymer_specialties')).toHaveLength(0);
  });

  it('lỗi quyền từ update (42501) được ánh xạ qua toAppError, không đọc lại hồ sơ', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: null, error: { code: '42501', message: 'permission denied' } } },
    });
    const { gymers, getDetail } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expectAppError(repo.updateMine({ name: 'Lan' }), 'FORBIDDEN');
    expect(getDetail).not.toHaveBeenCalled();
  });
});

describe('profileRepo.updateMine: đồng bộ chuyên môn (tags)', () => {
  it('chèn thiếu trước, xoá thừa sau; thứ tự kiểm trong calls', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_profiles: { data: [{ user_id: 'u1' }] },
        gymer_specialties: (c) =>
          c.op === 'select'
            ? { data: [{ specialty_name: 'Yoga' }, { specialty_name: 'Gym' }] }
            : { data: null },
      },
    });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await repo.updateMine({ tags: ['Gym', 'Tăng cơ'] });

    const specCalls = calls.filter((c) => c.kind === 'from' && c.table === 'gymer_specialties');
    const ops = specCalls.map((c) => c.op);
    expect(ops).toEqual(['select', 'insert', 'delete']);

    const insert = specCalls.find((c) => c.op === 'insert')!;
    expect(insert.payload).toEqual([{ gymer_id: 'u1', specialty_name: 'Tăng cơ' }]);

    const del = specCalls.find((c) => c.op === 'delete')!;
    expect(del.filters!.find((s) => s.method === 'eq')?.args).toEqual(['gymer_id', 'u1']);
    expect(del.filters!.find((s) => s.method === 'in')?.args).toEqual(['specialty_name', ['Yoga']]);
  });

  it('bỏ trùng trong tags và không gửi insert/delete khi đã khớp', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_profiles: { data: [{ user_id: 'u1' }] },
        gymer_specialties: (c) =>
          c.op === 'select' ? { data: [{ specialty_name: 'Yoga' }] } : { data: null },
      },
    });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await repo.updateMine({ tags: ['Yoga', 'Yoga'] });

    const specOps = calls.filter((c) => c.kind === 'from' && c.table === 'gymer_specialties').map((c) => c.op);
    expect(specOps).toEqual(['select']);
  });

  it('tags rỗng xoá hết chuyên môn', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_profiles: { data: [{ user_id: 'u1' }] },
        gymer_specialties: (c) =>
          c.op === 'select' ? { data: [{ specialty_name: 'Yoga' }] } : { data: null },
      },
    });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await repo.updateMine({ tags: [] });

    const del = calls.find((c) => c.kind === 'from' && c.op === 'delete')!;
    expect(del.filters!.find((s) => s.method === 'in')?.args).toEqual(['specialty_name', ['Yoga']]);
  });

  it('lỗi insert chuyên môn -> ném AppError đã ánh xạ, không xoá chuyên môn thừa', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_profiles: { data: [{ user_id: 'u1' }] },
        gymer_specialties: (c) => {
          if (c.op === 'select') return { data: [{ specialty_name: 'Yoga' }] };
          if (c.op === 'insert') return { data: null, error: { code: '42501', message: 'permission denied' } };
          return { data: null };
        },
      },
    });
    const { gymers } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await expectAppError(repo.updateMine({ name: 'Lan', tags: ['Gym'] }), 'FORBIDDEN');
    expect(calls.some((c) => c.kind === 'from' && c.op === 'delete')).toBe(false);
  });

  it('có cả chữ và tags thì cập nhật hồ sơ trước, đồng bộ chuyên môn sau, rồi đọc lại', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_profiles: { data: [{ user_id: 'u1' }] },
        gymer_specialties: (c) => (c.op === 'select' ? { data: [] } : { data: null }),
      },
    });
    const { gymers, getDetail } = stubGymers();
    const repo = createProfileRepo(client, gymers);

    await repo.updateMine({ bio: 'Mới', tags: ['Gym'] });

    const order = calls.filter((c) => c.kind === 'from').map((c) => `${c.table}:${c.op}`);
    expect(order).toEqual(['gymer_profiles:update', 'gymer_specialties:select', 'gymer_specialties:insert']);
    expect(getDetail).toHaveBeenCalledWith('u1');
  });
});
