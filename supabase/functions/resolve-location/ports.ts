// Cổng (port) của edge function resolve-location: hợp đồng giữa handler và adapter.
// File này không import gì (không Deno.*, npm:, jsr:) để Vitest (Node) đọc được.

export interface LatLng { lat: number; lng: number }

export interface LocationRequest {
  /** Access token Zalo của người dùng. Chỉ truyền cho adapter, không ghi log. */
  accessToken: string;
  /** Token vị trí Zalo (SDK đưa cho client). Chỉ truyền cho adapter, không ghi log. */
  locationToken: string;
}

export type ZaloLocationErrorCode = 'INVALID_TOKEN' | 'UNAVAILABLE';

export interface ZaloLocationErrorMeta {
  /** Mã `error` của Zalo (số). Chỉ để học ở smoke test, không chứa dữ liệu người dùng. */
  zaloErrorCode?: number;
  /** HTTP status khi Zalo trả lỗi HTTP. */
  httpStatus?: number;
}

/** Lỗi do adapter ném. Thông báo không được chứa token, secret hay toạ độ. */
export class ZaloLocationError extends Error {
  readonly zaloErrorCode?: number;
  readonly httpStatus?: number;

  constructor(public code: ZaloLocationErrorCode, message?: string, meta: ZaloLocationErrorMeta = {}) {
    super(message ?? 'Lỗi lấy vị trí từ Zalo.');
    this.zaloErrorCode = meta.zaloErrorCode;
    this.httpStatus = meta.httpStatus;
  }
}

export interface LocationResolver {
  /** Ném ZaloLocationError khi lỗi đã biết; lỗi khác là lỗi nội bộ (500). */
  resolve(request: LocationRequest): Promise<LatLng>;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
