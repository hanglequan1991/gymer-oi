// Danh sách khu vực dự phòng cho khách khi không lấy được GPS (plan app-ui-integration, D9, task C1b).
// Chỉ TP.HCM (Q2 mặc định). Danh sách cố định, không lấy từ server.
//
// CẢNH BÁO: toạ độ trung tâm từng quận là XẤP XỈ, do sen1 nhập từ trí nhớ, CHƯA đối chiếu bản đồ (R13).
// Trước khi phát hành, PM/người dùng phải đối chiếu từng toạ độ trên bản đồ. Không tự đổi số ở đây khi chưa đối chiếu.
import type { GeoPoint } from '@/types/geo';

export interface AreaOption {
  /** Mã ổn định, dùng làm giá trị chip và khoá React. */
  id: string;
  /** Nhãn hiển thị tiếng Việt. */
  label: string;
  /** Toạ độ trung tâm xấp xỉ của khu vực (chưa đối chiếu bản đồ). */
  center: GeoPoint;
}

export const AREAS: readonly AreaOption[] = [
  { id: 'q1', label: 'Quận 1', center: { lat: 10.7769, lng: 106.7009 } },
  { id: 'q3', label: 'Quận 3', center: { lat: 10.784, lng: 106.6844 } },
  { id: 'q4', label: 'Quận 4', center: { lat: 10.7578, lng: 106.7013 } },
  { id: 'q5', label: 'Quận 5', center: { lat: 10.754, lng: 106.6634 } },
  { id: 'q7', label: 'Quận 7', center: { lat: 10.734, lng: 106.722 } },
  { id: 'q10', label: 'Quận 10', center: { lat: 10.7727, lng: 106.667 } },
  { id: 'binh-thanh', label: 'Bình Thạnh', center: { lat: 10.8106, lng: 106.7091 } },
  { id: 'phu-nhuan', label: 'Phú Nhuận', center: { lat: 10.7991, lng: 106.6802 } },
  { id: 'tan-binh', label: 'Tân Bình', center: { lat: 10.8014, lng: 106.6526 } },
  { id: 'go-vap', label: 'Gò Vấp', center: { lat: 10.8386, lng: 106.6652 } },
  { id: 'thu-duc', label: 'TP Thủ Đức', center: { lat: 10.8494, lng: 106.7537 } },
];

/** Tìm khu vực có đúng toạ độ trung tâm đã cho (dùng để hiện tên khu vực khi vị trí đặt thủ công). */
export function findAreaByCenter(point: GeoPoint): AreaOption | undefined {
  return AREAS.find((a) => a.center.lat === point.lat && a.center.lng === point.lng);
}
