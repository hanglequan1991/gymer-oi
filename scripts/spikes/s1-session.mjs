#!/usr/bin/env node
// Spike S1 (b): kiểm chuỗi cấp phiên Supabase thật cho D4 (không ghi gì vào repo).
// Chuỗi: admin.createUser (email giả) -> admin.generateLink(magiclink) -> anon.verifyOtp
//        -> rpc search_gymers bằng phiên mới -> refreshSession -> rpc lần 2 -> LUÔN xoá user tạm.
// Chạy tay trên máy cá nhân. Không in access_token, refresh_token, service role key, hay hashed_token.
//
// Cách dùng:
//   node scripts/spikes/s1-session.mjs --dry-run   (không gọi mạng, chỉ in kế hoạch)
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/spikes/s1-session.mjs
//
// Lưu ý: script không kiểm được cài đặt "Allow new users to sign up" trên dashboard.
// Người chạy ghi trạng thái cài đặt đó vào bảng kết quả rồi chạy lại khi đổi cài đặt (xem docs/spikes/s1-auth-zalo.md).

import { randomUUID } from 'node:crypto';

const DRY_RUN = process.argv.includes('--dry-run');
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const RPC_NAME = 'search_gymers';
const RPC_ARGS = { p_lat: 10.77, p_lng: 106.7, p_radius_km: 1 };
// Miền .invalid không bao giờ nhận thư thật, phù hợp với user tạm.
const EMAIL_DOMAIN = 'gymer-spike.invalid';

const env = Object.fromEntries(REQUIRED.map((n) => [n, (process.env[n] ?? '').trim()]));
const secretsToRedact = Object.values(env).filter((s) => s.length > 0);

// Mọi chuỗi in ra đi qua hàm này để che bí mật nếu xuất hiện trong thông báo lỗi.
function redact(text) {
  let out = String(text ?? '');
  for (const s of secretsToRedact) out = out.split(s).join('<đã ẩn>');
  return out.length > 160 ? `${out.slice(0, 160)}...` : out;
}

const rows = []; // { cau, ketQua, ghiChu }
function record(cau, ketQua, ghiChu = '') {
  rows.push({ cau, ketQua: redact(ketQua), ghiChu: redact(ghiChu) });
}

function printDryRunPlan() {
  console.log('[S1-b] Kế hoạch (dry-run, không gọi mạng):');
  for (const n of REQUIRED) {
    console.log(`  Biến ${n}: ${env[n] ? 'có' : 'thiếu'}`);
  }
  console.log(`  Email tạm: s1-<uuid>@${EMAIL_DOMAIN}`);
  console.log('  Bước 1: admin.auth.admin.createUser({ email, email_confirm: true })');
  console.log('  Bước 2: admin.auth.admin.generateLink({ type: "magiclink", email }) -> hashed_token');
  console.log('  Bước 3: anon.auth.verifyOtp({ token_hash, type: "magiclink" }) -> access_token, refresh_token, expires_in');
  console.log(`  Bước 4: anon.rpc("${RPC_NAME}", ${JSON.stringify(RPC_ARGS)}) bằng phiên vừa cấp`);
  console.log('  Bước 4b: client không có phiên gọi cùng RPC (đối chứng)');
  console.log('  Bước 5: anon.auth.refreshSession({ refresh_token })');
  console.log('  Bước 6: rpc lần 2 bằng phiên đã refresh');
  console.log('  Cuối cùng: admin.auth.admin.deleteUser(id) (luôn chạy, kể cả khi lỗi)');
}

async function main() {
  if (DRY_RUN) {
    printDryRunPlan();
    return 0;
  }
  const missing = REQUIRED.filter((n) => !env[n]);
  if (missing.length > 0) {
    console.error(`Thiếu biến môi trường: ${missing.join(', ')}. Xem docs/spikes/s1-auth-zalo.md.`);
    return 2;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const opts = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts);
  const control = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts);

  await runChain({ admin, anon, control });

  // In sau khi bước xoá user tạm (trong finally) đã chạy xong.
  return finish(rows.some((r) => r.ketQua === 'LỖI') ? 1 : 0);
}

async function runChain({ admin, anon, control }) {
  const email = `s1-${randomUUID()}@${EMAIL_DOMAIN}`;
  let userId = null;

  try {
    // Bước 1: tạo user tạm.
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) {
      record('(1) createUser với email .invalid', 'LỖI', `${created.error.status ?? ''} ${created.error.code ?? ''} ${created.error.message}`);
      return;
    }
    userId = created.data.user?.id ?? null;
    record('(1) createUser với email .invalid', 'OK', `có user id: ${userId ? 'có' : 'không'}`);

    // Bước 2: sinh magiclink, lấy hashed_token (không in).
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const hashed = link.data?.properties?.hashed_token;
    if (link.error || !hashed) {
      record('(2) generateLink magiclink', 'LỖI', link.error ? `${link.error.status ?? ''} ${link.error.message}` : 'không có hashed_token');
      return;
    }
    record('(2) generateLink magiclink', 'OK', 'có hashed_token');

    // Bước 3: đổi sang phiên bằng client anon.
    const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' });
    const session = verified.data?.session;
    if (verified.error || !session) {
      record('(3) verifyOtp magiclink -> phiên', 'LỖI', verified.error ? `${verified.error.status ?? ''} ${verified.error.message}` : 'không có session');
      return;
    }
    record(
      '(3) verifyOtp magiclink -> phiên',
      'OK',
      `access_token độ dài ${session.access_token.length}; refresh_token có: ${session.refresh_token ? 'có' : 'không'}; expires_in = ${session.expires_in} giây`,
    );

    // Bước 4: RPC bằng phiên vừa cấp (kỳ vọng không lỗi UNAUTHENTICATED).
    const withSession = await anon.rpc(RPC_NAME, RPC_ARGS);
    record(
      `(4) rpc ${RPC_NAME} bằng phiên mới`,
      withSession.error ? 'LỖI' : 'OK',
      withSession.error
        ? `HTTP ${withSession.status ?? '?'}; mã ${withSession.error.code ?? ''}; ${withSession.error.message}`
        : `HTTP ${withSession.status ?? '?'}; số dòng trả về: ${Array.isArray(withSession.data) ? withSession.data.length : 'không phải mảng'}`,
    );

    // Bước 4b: đối chứng không có phiên.
    const noSession = await control.rpc(RPC_NAME, RPC_ARGS);
    record(
      `(4b) rpc ${RPC_NAME} không có phiên (đối chứng)`,
      noSession.error ? 'LỖI' : 'OK',
      noSession.error ? `HTTP ${noSession.status ?? '?'}; mã ${noSession.error.code ?? ''}` : `HTTP ${noSession.status ?? '?'}`,
    );

    // Bước 5: refresh.
    const refreshed = await anon.auth.refreshSession({ refresh_token: session.refresh_token });
    const newSession = refreshed.data?.session;
    if (refreshed.error || !newSession) {
      record('(5) refreshSession', 'LỖI', refreshed.error ? `${refreshed.error.status ?? ''} ${refreshed.error.message}` : 'không có session');
    } else {
      record(
        '(5) refreshSession',
        'OK',
        `có access_token mới: ${newSession.access_token !== session.access_token ? 'có' : 'không'}; có refresh_token mới: ${newSession.refresh_token !== session.refresh_token ? 'có' : 'không'}; expires_in = ${newSession.expires_in}`,
      );
    }

    // Bước 6: RPC lần 2 sau refresh.
    if (newSession) {
      const afterRefresh = await anon.rpc(RPC_NAME, RPC_ARGS);
      record(
        '(6) rpc sau refresh',
        afterRefresh.error ? 'LỖI' : 'OK',
        afterRefresh.error ? `HTTP ${afterRefresh.status ?? '?'}; mã ${afterRefresh.error.code ?? ''}` : `HTTP ${afterRefresh.status ?? '?'}`,
      );
    }
  } catch (err) {
    record('Lỗi không mong đợi', 'LỖI', `${err?.name ?? 'Error'}: ${err?.message ?? err}`);
  } finally {
    // Luôn xoá user tạm, kể cả khi các bước trên lỗi.
    if (userId) {
      const del = await admin.auth.admin.deleteUser(userId);
      if (del.error) {
        record('(7) xoá user tạm', 'LỖI', `CẦN XOÁ TAY user id ${userId}: ${del.error.message}`);
      } else {
        record('(7) xoá user tạm', 'OK', 'đã xoá');
      }
    }
  }
}

function finish(code) {
  console.log('[S1-b] Kết quả (không in token, khoá, hay hashed_token):');
  for (const r of rows) {
    console.log(`- ${r.cau}: ${r.ketQua}${r.ghiChu ? ` | ${r.ghiChu}` : ''}`);
  }
  return code;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`Lỗi không mong đợi: ${redact(err?.message ?? err)}`);
    process.exitCode = 1;
  },
);
