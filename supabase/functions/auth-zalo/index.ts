// Điểm vào edge function auth-zalo (Deno). Đây là file DUY NHẤT dùng Deno.* và npm:,
// nên KHÔNG nằm trong tsconfig của supabase/functions. Logic nằm trong handler.ts và adapters/.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { handleAuthZalo } from './handler.ts';
import type { AuthZaloDeps } from './handler.ts';
import type { SessionIssuer, UserStore, ZaloVerifier } from './ports.ts';
import { createZaloVerifier } from './adapters/zaloVerifier.ts';
import { createUserStore } from './adapters/userStore.ts';
import { createSessionIssuer } from './adapters/sessionIssuer.ts';

// S1: tên biến SUPABASE_* do hosted tự cấp; khoá mới (sb_secret_/sb_publishable_) có thể đổi tên (R6).
// ZALO_APP_SECRET: đặt bằng `supabase secrets set` (U4). Bắt buộc theo fail-closed; S1 chưa xác nhận có cần thật không.
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ZALO_APP_SECRET'] as const;

function readEnv(name: string): string | undefined {
  try {
    const value = Deno.env.get(name);
    return value !== undefined && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

// Chỉ ghi msg và meta đã làm sạch. Handler không truyền token hay phiên vào đây.
function log(msg: string, meta?: Record<string, unknown>): void {
  console.log(JSON.stringify({ msg, ...meta }));
}

const url = readEnv('SUPABASE_URL');
const anonKey = readEnv('SUPABASE_ANON_KEY');
const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
const appSecret = readEnv('ZALO_APP_SECRET');
const missingConfig = REQUIRED_ENV.filter((name) => readEnv(name) === undefined);

// Client không lưu phiên và không tự làm mới: function chỉ cần verifyOtp rồi trả token cho client.
const NO_SESSION_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

// Khi thiếu cấu hình, handler trả 500 CONFIG_MISSING trước khi chạm các port này (fail-closed).
const UNUSED_VERIFIER: ZaloVerifier = { verify: () => Promise.reject(new Error('cấu hình thiếu')) };
const UNUSED_STORE: UserStore = {
  findUserIdByZaloId: () => Promise.reject(new Error('cấu hình thiếu')),
  createUserForZalo: () => Promise.reject(new Error('cấu hình thiếu')),
};
const UNUSED_ISSUER: SessionIssuer = { issue: () => Promise.reject(new Error('cấu hình thiếu')) };

function buildDeps(): AuthZaloDeps {
  if (url === undefined || anonKey === undefined || serviceKey === undefined || appSecret === undefined) {
    return { verifier: UNUSED_VERIFIER, store: UNUSED_STORE, issuer: UNUSED_ISSUER, missingConfig, log };
  }
  const admin = createClient(url, serviceKey, NO_SESSION_OPTIONS);
  const anon = createClient(url, anonKey, NO_SESSION_OPTIONS);
  return {
    // S1: endpoint graph.zalo.me/v2.0/me và header secret_key là giả thuyết của plan.
    verifier: createZaloVerifier((input, init) => fetch(input, init), { appSecret }),
    store: createUserStore({ admin: admin.auth.admin, db: admin, log }),
    issuer: createSessionIssuer({ admin: admin.auth.admin, anonAuth: anon.auth }),
    missingConfig,
    log,
  };
}

const deps = buildDeps();

Deno.serve((req: Request) => handleAuthZalo(req, deps));
