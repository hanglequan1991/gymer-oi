// Composition root của tầng services: gom các repository thành bộ Services cho app.
// Đây là chỗ duy nhất chọn theo env.dataSource (docs/project-structure.md, mục 2.6):
// - 'mock': mọi repository chưa có cài đặt thật, mọi phương thức ném AppError('NOT_IMPLEMENTED').
// - 'supabase': dựng SupabaseClient một lần và nối đủ sáu repository thật.
import type { AppEnv } from '@/config';
import type { AuthPort, StoragePort } from '@/platform/ports';
import { AppError } from './errors';
import type { Services } from './index';
import type { SessionRepository } from './repositories/sessionRepository';
import { createBookingRepo } from './supabase/bookingRepo';
import { createGymerRepo } from './supabase/gymerRepo';
import { createProfileRepo } from './supabase/profileRepo';
import { createRequestRepo } from './supabase/requestRepo';
import { createScheduleRepo } from './supabase/scheduleRepo';
import { createSessionRepo } from './supabase/sessionRepo';
import { createSupabaseClient } from './supabase/client';

/** Kiểu SupabaseClient đã gắn Database. Lấy qua ReturnType để không import database.types ra ngoài src/services/supabase/*. */
export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;

/**
 * Phụ thuộc có thể tiêm vào composition root (để test và để chọn nền tảng thật).
 * - storage: lưu phiên đăng nhập của supabase-js (lấy từ PlatformContext).
 * - auth: cổng đăng nhập Zalo; thiếu thì session.signIn ném UNKNOWN, các phương thức khác vẫn dùng được.
 * - client: client Supabase có sẵn (test); thiếu thì dựng từ env và storage.
 * - now: đồng hồ dùng chung cho repository cần thời điểm hiện tại.
 */
export interface CreateServicesDeps {
  storage?: StoragePort;
  auth?: AuthPort;
  client?: AppSupabaseClient;
  now?: () => Date;
}

const MISSING_AUTH_MESSAGE = 'Thiếu cổng đăng nhập Zalo (AuthPort) khi tạo services.';

/**
 * Tạo hàm bất đồng bộ luôn từ chối với mã NOT_IMPLEMENTED.
 * Dùng Promise bị từ chối (không ném đồng bộ) để khớp với chữ ký Promise của repository.
 */
function notImplemented(dataSource: AppEnv['dataSource'], method: string): () => Promise<never> {
  return async () => {
    throw new AppError('NOT_IMPLEMENTED', `Chưa cài đặt "${method}" (nguồn dữ liệu: ${dataSource}).`);
  };
}

/** Bộ services nhánh mock: toàn bộ phương thức chưa cài đặt. */
function createMockServices(ds: AppEnv['dataSource']): Services {
  return {
    gymers: {
      search: notImplemented(ds, 'gymers.search'),
      getDetail: notImplemented(ds, 'gymers.getDetail'),
    },
    schedule: {
      getMonth: notImplemented(ds, 'schedule.getMonth'),
      getDaySlots: notImplemented(ds, 'schedule.getDaySlots'),
      setPrices: notImplemented(ds, 'schedule.setPrices'),
      setSlotClosed: notImplemented(ds, 'schedule.setSlotClosed'),
    },
    bookings: {
      create: notImplemented(ds, 'bookings.create'),
    },
    requests: {
      list: notImplemented(ds, 'requests.list'),
      respond: notImplemented(ds, 'requests.respond'),
    },
    profile: {
      getMine: notImplemented(ds, 'profile.getMine'),
      updateMine: notImplemented(ds, 'profile.updateMine'),
    },
    session: {
      signIn: notImplemented(ds, 'session.signIn'),
      getSession: notImplemented(ds, 'session.getSession'),
      signOut: notImplemented(ds, 'session.signOut'),
    },
  };
}

/** Cổng auth giả khi thiếu deps.auth: mọi lệnh đều ném lỗi rõ ràng (không crash lúc khởi tạo). */
const MISSING_AUTH = {
  login: async () => {
    throw new AppError('UNKNOWN', MISSING_AUTH_MESSAGE);
  },
  getProfile: async () => {
    throw new AppError('UNKNOWN', MISSING_AUTH_MESSAGE);
  },
};

/** Bộ services nhánh supabase: nối sáu repository thật với một client dùng chung. */
function createSupabaseServices(env: AppEnv, deps: CreateServicesDeps): Services {
  const client = deps.client ?? createSupabaseClient(env, deps.storage);
  const now = deps.now;

  const gymers = createGymerRepo(client, { now });
  const sessionRepo = createSessionRepo(client, deps.auth ?? MISSING_AUTH);
  // getSession và signOut không cần cổng auth; chỉ signIn cần, nên thiếu thì thay riêng signIn.
  const session: SessionRepository = deps.auth
    ? sessionRepo
    : {
        ...sessionRepo,
        signIn: async () => {
          throw new AppError('UNKNOWN', MISSING_AUTH_MESSAGE);
        },
      };

  return {
    gymers,
    schedule: createScheduleRepo(client),
    bookings: createBookingRepo(client),
    requests: createRequestRepo(client, { now }),
    profile: createProfileRepo(client, gymers),
    session,
  };
}

/** Tạo bộ Services từ cấu hình môi trường. Nhánh mock giữ nguyên trạng thái chưa cài đặt. */
export function createServices(env: AppEnv, deps: CreateServicesDeps = {}): Services {
  if (env.dataSource === 'supabase') {
    return createSupabaseServices(env, deps);
  }
  return createMockServices(env.dataSource);
}
