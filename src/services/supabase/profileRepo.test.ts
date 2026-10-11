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

/** Năm hiện tại theo giờ Việt Nam, như cách repo tính; dùng để kiểm biên năm sinh. */
function currentYearVN(): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date()));
}

const validBecome = {
  name: 'Lan',
  gender: 'female' as const,
  birthYear: 1995,
  area: 'Quận 3',
  priceWeekday: 150000,
  priceWeekend: 180000,
  tags: ['Yoga' as const],
};

describe('profileRepo.getMyStatus', () => {
  it('chưa là Gymer (không có gymer_profiles) thì trả null và không đọc gymer_locations', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: null } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expect(repo.getMyStatus()).resolves.toBeNull();
    expect(calls.some((c) => c.table === 'gymer_locations')).toBe(false);
  });

  it('là Gymer có vị trí thì trả đủ ba trường', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_profiles: { data: { is_listed: true, accepts_requests: false } },
        gymer_locations: { data: { user_id: 'u1' } },
      },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expect(repo.getMyStatus()).resolves.toEqual({ isListed: true, acceptsRequests: false, hasLocation: true });
  });

  it('là Gymer chưa có vị trí thì hasLocation là false', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_profiles: { data: { is_listed: false, accepts_requests: true } },
        gymer_locations: { data: null },
      },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expect(repo.getMyStatus()).resolves.toEqual({ isListed: false, acceptsRequests: true, hasLocation: false });
  });

  it('chưa đăng nhập thì ném UNAUTHENTICATED', async () => {
    const { client } = createFakeSupabase({});
    await expectAppError(createProfileRepo(client, stubGymers().gymers).getMyStatus(), 'UNAUTHENTICATED');
  });
});

describe('profileRepo.becomeGymer', () => {
  it('đầu vào sai thì ném VALIDATION trước mọi lệnh mạng', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session } });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expectAppError(repo.becomeGymer({ ...validBecome, name: '   ' }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, name: 'a'.repeat(51) }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, area: 'a'.repeat(101) }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, gender: 'other' as never }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, birthYear: 1939 }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, birthYear: currentYearVN() - 17 }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, priceWeekday: -1 }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, priceWeekend: 5_000_001 }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, priceWeekend: 1.5 }), 'VALIDATION');
    await expectAppError(repo.becomeGymer({ ...validBecome, tags: ['Boxing' as never] }), 'VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('năm sinh đúng biên (năm VN hiện tại - 18) được nhận', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: null }, gymer_specialties: (c) => (c.op === 'select' ? { data: [] } : { data: null }) },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expect(repo.becomeGymer({ ...validBecome, birthYear: currentYearVN() - 18 })).resolves.toBeUndefined();
  });

  it('thành công: insert hồ sơ chưa hiển thị, gửi đúng cột, rồi đồng bộ chuyên môn', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_profiles: { data: null },
        gymer_specialties: (c) => (c.op === 'select' ? { data: [] } : { data: null }),
      },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await repo.becomeGymer({ ...validBecome, name: ' Lan ', tags: ['Yoga', 'Gym', 'Yoga'] });

    const insert = calls.find((c) => c.table === 'gymer_profiles' && c.op === 'insert')!;
    expect(insert.payload).toEqual({
      user_id: 'u1',
      display_name: 'Lan',
      gender: 'female',
      birth_year: 1995,
      area_label: 'Quận 3',
      avatar_url: null,
      price_weekday_vnd: 150000,
      price_weekend_vnd: 180000,
      is_listed: false,
      accepts_requests: true,
    });
    const specInsert = calls.find((c) => c.table === 'gymer_specialties' && c.op === 'insert')!;
    expect(specInsert.payload).toEqual([
      { gymer_id: 'u1', specialty_name: 'Yoga' },
      { gymer_id: 'u1', specialty_name: 'Gym' },
    ]);
  });

  it('truyền avatarUrl khi có', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: null }, gymer_specialties: (c) => (c.op === 'select' ? { data: [] } : { data: null }) },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await repo.becomeGymer({ ...validBecome, avatarUrl: 'https://cdn.example/a.png' });

    const insert = calls.find((c) => c.table === 'gymer_profiles' && c.op === 'insert')!;
    expect((insert.payload as { avatar_url: string }).avatar_url).toBe('https://cdn.example/a.png');
  });

  it('đã là Gymer (23505) thì ném VALIDATION "Bạn đã là Gymer."', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: null, error: { code: '23505', message: 'duplicate key' } } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    const err = await repo.becomeGymer(validBecome).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('VALIDATION');
    expect((err as AppError).message).toBe('Bạn đã là Gymer.');
  });

  it('lỗi khác của insert đi qua toAppError (42501 -> FORBIDDEN)', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: null, error: { code: '42501', message: 'permission denied' } } },
    });
    await expectAppError(createProfileRepo(client, stubGymers().gymers).becomeGymer(validBecome), 'FORBIDDEN');
  });

  it('chưa đăng nhập thì ném UNAUTHENTICATED và không insert', async () => {
    const { client, calls } = createFakeSupabase({});
    await expectAppError(createProfileRepo(client, stubGymers().gymers).becomeGymer(validBecome), 'UNAUTHENTICATED');
    expect(calls.filter((c) => c.kind === 'from')).toHaveLength(0);
  });
});

describe('profileRepo.setVisibility', () => {
  it('bật hiển thị khi chưa có vị trí thì ném VALIDATION và không update', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_locations: { data: null }, gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expectAppError(repo.setVisibility({ isListed: true }), 'VALIDATION');
    expect(writes(calls)).toHaveLength(0);
  });

  it('bật hiển thị khi đã có vị trí thì update is_listed đúng dòng của mình', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_locations: { data: { user_id: 'u1' } }, gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await repo.setVisibility({ isListed: true });

    const upd = writes(calls).find((c) => c.op === 'update')!;
    expect(upd.table).toBe('gymer_profiles');
    expect(upd.payload).toEqual({ is_listed: true });
    expect(upd.filters!.find((s) => s.method === 'eq')?.args).toEqual(['user_id', 'u1']);
  });

  it('tắt hiển thị không cần vị trí, và chỉ gửi cột được đổi', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await repo.setVisibility({ isListed: false });

    expect(calls.some((c) => c.table === 'gymer_locations')).toBe(false);
    expect(writes(calls)[0].payload).toEqual({ is_listed: false });
  });

  it('chỉ đổi acceptsRequests thì không kèm is_listed', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: [{ user_id: 'u1' }] } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await repo.setVisibility({ acceptsRequests: false });

    expect(writes(calls)[0].payload).toEqual({ accepts_requests: false });
  });

  it('không có hàng được cập nhật thì ném NOT_FOUND', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { gymer_profiles: { data: [] } },
    });
    await expectAppError(createProfileRepo(client, stubGymers().gymers).setVisibility({ acceptsRequests: true }), 'NOT_FOUND');
  });
});

describe('profileRepo.setLocation', () => {
  it('làm tròn 3 chữ số trước khi ghi', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { gymer_locations: { data: [{ user_id: 'u1' }] } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await repo.setLocation({ lat: 10.776543, lng: 106.700449 });

    const upd = writes(calls).find((c) => c.op === 'update')!;
    expect(upd.table).toBe('gymer_locations');
    expect(upd.payload).toEqual({ lat: 10.777, lng: 106.7 });
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('chưa có dòng vị trí thì update không khớp hàng rồi insert', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_locations: (c) => (c.op === 'update' ? { data: [] } : { data: null }),
      },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await repo.setLocation({ lat: 10.5, lng: 106.5 });

    const ops = calls.filter((c) => c.table === 'gymer_locations').map((c) => c.op);
    expect(ops).toEqual(['update', 'insert']);
    expect(calls.find((c) => c.op === 'insert')!.payload).toEqual({ user_id: 'u1', lat: 10.5, lng: 106.5 });
  });

  it('chưa là Gymer (insert bị khoá ngoại 23503) thì ném NOT_FOUND', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: {
        gymer_locations: (c) =>
          c.op === 'update' ? { data: [] } : { data: null, error: { code: '23503', message: 'fk violation' } },
      },
    });
    await expectAppError(createProfileRepo(client, stubGymers().gymers).setLocation({ lat: 10.5, lng: 106.5 }), 'NOT_FOUND');
  });

  it('toạ độ ngoài biên thì ném VALIDATION và không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session } });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expectAppError(repo.setLocation({ lat: 91, lng: 106 }), 'VALIDATION');
    await expectAppError(repo.setLocation({ lat: 10, lng: -181 }), 'VALIDATION');
    await expectAppError(repo.setLocation({ lat: Number.NaN, lng: 106 }), 'VALIDATION');
    expect(calls).toHaveLength(0);
  });
});

describe('profileRepo.addCertificate / removeCertificate', () => {
  it('thêm chứng chỉ: cắt khoảng trắng, gắn gymer_id của mình, trả { id, name }', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { certificates: { data: { id: 'c1', name: 'PT cơ bản' } } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expect(repo.addCertificate('  PT cơ bản ')).resolves.toEqual({ id: 'c1', name: 'PT cơ bản' });
    const ins = calls.find((c) => c.table === 'certificates' && c.op === 'insert')!;
    expect(ins.payload).toEqual({ gymer_id: 'u1', name: 'PT cơ bản' });
  });

  it('tên rỗng hoặc quá 100 ký tự thì ném VALIDATION và không gọi mạng', async () => {
    const { client, calls } = createFakeSupabase({ auth: { session } });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await expectAppError(repo.addCertificate('   '), 'VALIDATION');
    await expectAppError(repo.addCertificate('a'.repeat(101)), 'VALIDATION');
    expect(calls).toHaveLength(0);
  });

  it('chạm giới hạn 10 chứng chỉ (trigger raise LIMIT_REACHED) thì ném LIMIT_REACHED', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { certificates: { data: null, error: { code: 'P0001', message: 'LIMIT_REACHED' } } },
    });
    await expectAppError(createProfileRepo(client, stubGymers().gymers).addCertificate('Yoga'), 'LIMIT_REACHED');
  });

  it('chưa là Gymer (khoá ngoại 23503) thì ném NOT_FOUND', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { certificates: { data: null, error: { code: '23503', message: 'fk violation' } } },
    });
    await expectAppError(createProfileRepo(client, stubGymers().gymers).addCertificate('Yoga'), 'NOT_FOUND');
  });

  it('xoá chứng chỉ lọc theo id và gymer_id của mình', async () => {
    const { client, calls } = createFakeSupabase({
      auth: { session },
      from: { certificates: { data: [{ id: 'c1' }] } },
    });
    const repo = createProfileRepo(client, stubGymers().gymers);

    await repo.removeCertificate('c1');

    const del = calls.find((c) => c.table === 'certificates' && c.op === 'delete')!;
    const eqs = del.filters!.filter((s) => s.method === 'eq').map((s) => s.args);
    expect(eqs).toEqual([
      ['id', 'c1'],
      ['gymer_id', 'u1'],
    ]);
  });

  it('không có hàng để xoá (không phải của mình hoặc không tồn tại) thì ném NOT_FOUND', async () => {
    const { client } = createFakeSupabase({
      auth: { session },
      from: { certificates: { data: [] } },
    });
    await expectAppError(createProfileRepo(client, stubGymers().gymers).removeCertificate('cX'), 'NOT_FOUND');
  });
});
