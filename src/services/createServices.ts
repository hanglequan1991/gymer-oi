// Composition root của tầng services: gom các repository thành bộ Services cho app.
// Bước khung: mọi repository chưa có cài đặt thật, mọi phương thức ném AppError('NOT_IMPLEMENTED')
// (cả khi dataSource là 'mock' lẫn 'supabase'). Khi có cài đặt thật, đây là chỗ duy nhất chọn theo env.dataSource
// (docs/project-structure.md, mục 2.6).
import type { AppEnv, DataSource } from '@/config';
import { AppError } from './errors';
import type { Services } from './index';

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
export function createServices(env: AppEnv): Services {
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
  };
}
