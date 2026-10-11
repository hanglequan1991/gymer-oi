// Cổng vị trí của khách (interface). Đổi token vị trí sang toạ độ qua edge function resolve-location.
import type { GeoPoint } from '@/types/geo';

export interface LocationRepository {
  /** Xin quyền (nếu cần), lấy token vị trí, đổi sang toạ độ qua edge function `resolve-location`. Làm tròn 3 chữ số.
   *  Lỗi: FORBIDDEN (từ chối quyền), NETWORK (Zalo/máy chủ không khả dụng), UNAUTHENTICATED, UNKNOWN (token rỗng, phản hồi sai). */
  getCurrent(): Promise<GeoPoint>;
}
