// Kiểu địa lý dùng chung cho platform (cổng vị trí), services và stores.
// Chỉ khai báo kiểu và hằng, không có logic (docs/project-structure.md, mục 6).

/** Tọa độ địa lý theo độ thập phân (WGS84). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Bán kính tìm kiếm, đơn vị km. Chỉ các giá trị được phép chọn trên màn hình. */
export type RadiusKm = 1 | 2 | 3 | 5;

/** Danh sách bán kính hợp lệ, theo thứ tự tăng dần, để hiển thị bộ chọn. */
export const RADIUS_OPTIONS: readonly RadiusKm[] = [1, 2, 3, 5];
