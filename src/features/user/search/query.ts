// Ánh xạ bộ lọc trên màn hình sang tham số search_gymers. Hàm thuần, không gọi services.
import type { Gender, Specialty } from '@/types/domain';
import type { GeoPoint, RadiusKm } from '@/types/geo';

/** Số sao tối thiểu của bộ lọc "Từ 4★". */
export const TOP_RATED_MIN = 4;
/** Khoảng tuổi của bộ lọc "20-30 tuổi". */
export const AGE_RANGE = { min: 20, max: 30 } as const;
/** Ngưỡng của bộ lọc "Dưới 200k", so với giá ngày thường (đồng). */
export const UNDER_PRICE_VND = 200_000;
/** Server trả tối đa 50 Gymer mỗi lần tìm (sắp theo khoảng cách). */
export const SEARCH_LIMIT = 50;

/** Các giá trị người dùng đã chọn trên màn hình tìm kiếm. */
export interface SearchCriteria {
  radiusKm: RadiusKm;
  keyword: string;
  specialty?: Specialty;
  gender?: Gender;
  onlyTopRated: boolean;
  age20to30: boolean;
  under200k: boolean;
}

/** Tạo tham số cho services.gymers.search. Không gửi khoá nào khi bộ lọc tắt, để server dùng mặc định. */
export function buildGymerSearch(criteria: SearchCriteria, center: GeoPoint) {
  const keyword = criteria.keyword.trim();
  return {
    center,
    radiusKm: criteria.radiusKm,
    keyword: keyword === '' ? undefined : keyword,
    specialty: criteria.specialty,
    gender: criteria.gender,
    minRating: criteria.onlyTopRated ? TOP_RATED_MIN : undefined,
    ageMin: criteria.age20to30 ? AGE_RANGE.min : undefined,
    ageMax: criteria.age20to30 ? AGE_RANGE.max : undefined,
    maxPrice: criteria.under200k ? UNDER_PRICE_VND : undefined,
  };
}
