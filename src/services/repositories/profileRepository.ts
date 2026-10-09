// Cổng hồ sơ của chính Gymer (chỉ interface, chưa có cài đặt).
import type { Gymer } from '@/types/domain';
import type { GymerDetail } from './gymerRepository';

export interface ProfileRepository {
  /** Hồ sơ đầy đủ của Gymer đang đăng nhập. */
  getMine(): Promise<GymerDetail>;
  /** Cập nhật một phần hồ sơ của chính mình. */
  updateMine(patch: Partial<Pick<Gymer, 'name' | 'bio' | 'tags' | 'area'>>): Promise<Gymer>;
}
