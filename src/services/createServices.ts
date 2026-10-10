// Composition root của tầng services: gom các repository thành bộ Services cho app.
// Bước khung: mọi repository chưa có cài đặt thật, mọi phương thức ném AppError('NOT_IMPLEMENTED')
// (cả khi dataSource là 'mock' lẫn 'supabase'). Khi có cài đặt thật, đây là chỗ duy nhất chọn theo env.dataSource
// (docs/project-structure.md, mục 2.6).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv, DataSource } from '@/config';
import type { AuthPort, StoragePort } from '@/platform/ports';
import { AppError } from './errors';
import type { Services } from './index';

/**
 * Phụ thuộc có thể tiêm vào composition root (để test và để chọn nền tảng thật).
 * Ở bước khung chưa được dùng; cài đặt thật sẽ đọc các trường này ở đợt sau.
 * client không khai báo SupabaseClient<Database>: database.types.ts chỉ được import trong src/services/supabase/* và mappers.
 */
export interface CreateServicesDeps {
  storage?: StoragePort;
  auth?: AuthPort;
  client?: SupabaseClient;
  now?: () => Date;
}

/**
 * Tạo hàm bất đồng bộ luôn từ chối với mã NOT_IMPLEMENTED.
 * Dùng Promise bị từ chối (không ném đồng bộ) để khớp với chữ ký Promise của repository.
 */
function notImplemented(dataSource: DataSource, method: string): () => Promise<never> {
  return async () => {
    throw new AppError('NOT_IMPLEMENTED', `Chưa cài đặt "${method}" (nguồn dữ liệu: ${dataSource}).`);
  };
}

/** Tạo bộ Services từ cấu hình môi trường. Ở bước khung, mọi phương thức đều chưa được cài đặt. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- _deps chưa dùng ở bước khung (xem CreateServicesDeps)
export function createServices(env: AppEnv, _deps?: CreateServicesDeps): Services {
  const ds = env.dataSource;

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
