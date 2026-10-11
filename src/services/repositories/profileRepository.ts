// Cổng hồ sơ của chính Gymer (chỉ interface, chưa có cài đặt).
import type { BecomeGymerInput, Certificate, Gymer, GymerAccountStatus } from '@/types/domain';
import type { GeoPoint } from '@/types/geo';
import type { GymerDetail } from './gymerRepository';

export interface ProfileRepository {
  /** Hồ sơ đầy đủ của Gymer đang đăng nhập. */
  getMine(): Promise<GymerDetail>;
  /** Cập nhật một phần hồ sơ của chính mình. */
  updateMine(patch: Partial<Pick<Gymer, 'name' | 'bio' | 'tags' | 'area'>>): Promise<Gymer>;
  /** Trạng thái Gymer của chính mình. null = chưa là Gymer. */
  getMyStatus(): Promise<GymerAccountStatus | null>;
  /** Đăng ký làm Gymer (chưa hiển thị). */
  becomeGymer(input: BecomeGymerInput): Promise<void>;
  /** isListed = true mà chưa có vị trí thì ném VALIDATION. */
  setVisibility(patch: { isListed?: boolean; acceptsRequests?: boolean }): Promise<void>;
  /** Làm tròn 3 chữ số phía client; chỉ Gymer. */
  setLocation(point: GeoPoint): Promise<void>;
  addCertificate(name: string): Promise<Certificate>;
  removeCertificate(id: string): Promise<void>;
}
