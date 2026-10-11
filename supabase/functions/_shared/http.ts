// Tiện ích HTTP dùng chung cho các edge function.
// Không import Deno.*, npm:, jsr: để Vitest (Node) đọc được.

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
};

/** Trả JSON; mọi phản hồi có CORS và không cache (có thể chứa phiên). */
export function json(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

/** Lỗi theo hợp đồng D1: `{ "error": { "code", "message" } }`. */
export function errorJson(status: number, code: string, message: string): Response {
  return json(status, { error: { code, message } });
}

/** Trả lời preflight CORS (OPTIONS). */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
