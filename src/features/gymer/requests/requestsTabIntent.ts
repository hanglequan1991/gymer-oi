/**
 * Cầu nối "ý định mở tab" từ Tổng quan sang tab Yêu cầu (chip nào được chọn khi mở).
 *
 * Vì sao là biến cấp module, không dùng query string hay state của router: API router của zmp-ui
 * chưa kiểm được trong code hiện tại; biến cấp module không phụ thuộc router và không lộ ra URL.
 * Vì sao có `peek` tách khỏi `clear`: RequestsPage đọc ý định trong bộ khởi tạo useState, mà
 * StrictMode chạy bộ khởi tạo hai lần. Nếu đọc-và-xoá cùng lúc, lần thứ hai sẽ mất ý định.
 * Vì vậy RequestsPage chỉ `peek` lúc khởi tạo và gọi `clear` trong useEffect khi mount.
 */

export type RequestsTabIntent = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

let intent: RequestsTabIntent | null = null;

/** Đặt chip sẽ được chọn ở lần mở tab Yêu cầu kế tiếp. */
export function setRequestsTabIntent(tab: RequestsTabIntent): void {
  intent = tab;
}

/** Đọc ý định hiện tại mà không xoá. Trả về null nếu không có ý định nào. */
export function peekRequestsTabIntent(): RequestsTabIntent | null {
  return intent;
}

/** Xoá ý định sau khi đã dùng, để lần mở sau không bị chọn lại chip cũ. */
export function clearRequestsTabIntent(): void {
  intent = null;
}
