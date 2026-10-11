// Cổng truy cập dữ liệu Gymer (chỉ interface, chưa có cài đặt).
import type { Certificate, Gender, Gymer, Review, Specialty } from '@/types/domain';
import type { GeoPoint, RadiusKm } from '@/types/geo';

/** Tham số tìm Gymer quanh một điểm. */
export interface GymerSearchQuery {
  center: GeoPoint;
  radiusKm: RadiusKm;
  keyword?: string;
  specialty?: Specialty;
  /** Các bộ lọc dưới đây được ánh xạ sang search_gymers ở T06; T01 chỉ khai báo chữ ký. */
  gender?: Gender;
  minRating?: number;
  ageMin?: number;
  ageMax?: number;
  /** So với GIÁ NGÀY THƯỜNG (priceWeekday), theo server. */
  maxPrice?: number;
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
