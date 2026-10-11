// Điểm vào edge function resolve-location (Deno). Đây là file DUY NHẤT dùng Deno.*,
// nên KHÔNG nằm trong tsconfig của supabase/functions. Logic nằm trong handler.ts và adapters/.
import { handleResolveLocation } from './handler.ts';
import type { ResolveLocationDeps } from './handler.ts';
import type { LocationResolver } from './ports.ts';
import { createZaloLocationResolver } from './adapters/zaloLocationResolver.ts';

// ZALO_APP_SECRET là BẮT BUỘC cho function này: thiếu thì handler trả 500 CONFIG_MISSING trước khi chạm Zalo.
const REQUIRED_ENV = ['ZALO_APP_SECRET'] as const;

function readEnv(name: string): string | undefined {
  try {
    const value = Deno.env.get(name);
    return value !== undefined && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

// Chỉ ghi msg và meta đã làm sạch. Handler không truyền token, secret hay toạ độ vào đây.
function log(msg: string, meta?: Record<string, unknown>): void {
  console.log(JSON.stringify({ msg, ...meta }));
}

const appSecret = readEnv('ZALO_APP_SECRET');
const missingConfig = REQUIRED_ENV.filter((name) => readEnv(name) === undefined);

// Khi thiếu cấu hình, handler trả 500 trước khi gọi resolver này (fail-closed).
const UNUSED_RESOLVER: LocationResolver = {
  resolve: () => Promise.reject(new Error('cấu hình thiếu')),
};

function buildDeps(): ResolveLocationDeps {
  if (appSecret === undefined) {
    return { resolver: UNUSED_RESOLVER, missingConfig, log };
  }
  return {
    resolver: createZaloLocationResolver((input, init) => fetch(input, init), { appSecret }),
    missingConfig,
    log,
  };
}

const deps = buildDeps();

Deno.serve((req: Request) => handleResolveLocation(req, deps));
