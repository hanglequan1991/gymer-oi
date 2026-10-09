// Cổng truy cập dữ liệu Gymer (chỉ interface, chưa có cài đặt).
import type { Certificate, Gymer, Review, Specialty } from '@/types/domain';
import type { GeoPoint, RadiusKm } from '@/types/geo';

/** Tham số tìm Gymer quanh một điểm. */
export interface GymerSearchQuery {
  center: GeoPoint;
  radiusKm: RadiusKm;
  keyword?: string;
  specialty?: Specialty;
}

/** Thông tin chi tiết một Gymer kèm chứng chỉ và đánh giá. */
export interface GymerDetail {
  gymer: Gymer;
  certificates: Certificate[];
  reviews: Review[];
}

export interface GymerRepository {
  /** Tìm Gymer trong bán kính quanh điểm trung tâm. */
  search(query: GymerSearchQuery): Promise<Gymer[]>;
  /** Lấy chi tiết một Gymer. Ném AppError('NOT_FOUND') nếu không có. */
  getDetail(gymerId: string): Promise<GymerDetail>;
}
