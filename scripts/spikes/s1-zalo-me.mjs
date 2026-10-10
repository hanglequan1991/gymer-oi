#!/usr/bin/env node
// Spike S1 (a): kiểm tra access_token của Zalo Mini App qua Graph API.
// Chạy tay trên máy cá nhân. Không in token, secret key, hay giá trị id/name/ảnh.
// Chỉ in: HTTP status, mã lỗi Zalo, tên trường có mặt, độ dài, và "dấu vân tay" SHA-256 rút gọn của id.
//
// Cách dùng:
//   node scripts/spikes/s1-zalo-me.mjs --dry-run      (không gọi mạng, chỉ in kế hoạch)
//   ZALO_ACCESS_TOKEN=... [ZALO_SECRET_KEY=...] node scripts/spikes/s1-zalo-me.mjs
//
// Giả thuyết cần kiểm (chưa khẳng định): GET graph.zalo.me/v2.0/me với header access_token.
// Tên header secret_key ở biến thể B cũng là giả thuyết.

import { createHash } from 'node:crypto';

const ENDPOINT = 'https://graph.zalo.me/v2.0/me';
const FIELDS = 'id,name,picture';
const TIMEOUT_MS = 15000;
const DRY_RUN = process.argv.includes('--dry-run');

// Token giả dùng để xem dạng lỗi khi token sai. Không phải bí mật.
const FAKE_TOKEN = 'token-gia-s1-kiem-loi-0000';

const token = (process.env.ZALO_ACCESS_TOKEN ?? '').trim();
const secretKey = (process.env.ZALO_SECRET_KEY ?? '').trim();

// Mọi chuỗi in ra đều đi qua hàm này để che bí mật nếu lỡ xuất hiện trong thông báo lỗi.
const secretsToRedact = [token, secretKey].filter((s) => s.length > 0);
function redact(text) {
  let out = String(text);
  for (const s of secretsToRedact) out = out.split(s).join('<đã ẩn>');
  return out;
}

function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function clip(text, max = 120) {
  const s = redact(text);
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

const VARIANTS = [
  {
    id: 'A',
    name: 'chỉ header access_token',
    needsSecret: false,
    headers: (t) => ({ access_token: t }),
  },
  {
    id: 'B',
    name: 'access_token + secret_key (giả thuyết tên header)',
    needsSecret: true,
    headers: (t, s) => ({ access_token: t, secret_key: s }),
  },
];

const INVALID_CASE = { id: 'C', name: 'token giả (xem dạng lỗi)', headers: () => ({ access_token: FAKE_TOKEN }) };

function printDryRunPlan() {
  console.log('[S1-a] Kế hoạch (dry-run, không gọi mạng):');
  console.log(`  Biến ZALO_ACCESS_TOKEN: ${token ? 'có' : 'thiếu (bắt buộc khi chạy thật)'}`);
  console.log(`  Biến ZALO_SECRET_KEY: ${secretKey ? 'có' : 'thiếu (tuỳ chọn, biến thể B bị bỏ qua)'}`);
  console.log(`  Endpoint: GET ${ENDPOINT}?fields=${FIELDS}`);
  for (const v of VARIANTS) {
    console.log(`  Biến thể ${v.id}: ${v.name}`);
  }
  console.log(`  Biến thể ${INVALID_CASE.id}: ${INVALID_CASE.name}`);
  console.log('  Gọi lại biến thể A lần thứ 2 để kiểm id có ổn định không.');
}

async function callMe(headers) {
  const res = await fetch(`${ENDPOINT}?fields=${FIELDS}`, {
    method: 'GET',
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: res.status, body, bodyLength: text.length };
}

function summarize(v, outcome) {
  const lines = [`Biến thể ${v.id} (${v.name}):`];
  if (outcome.skipped) {
    lines.push(`  BỎ QUA: ${outcome.skipped}`);
    return { line: lines, ok: false, fp: null };
  }
  if (outcome.networkError) {
    lines.push(`  Lỗi mạng: ${clip(outcome.networkError)}`);
    return { line: lines, ok: false, fp: null };
  }
  const { status, body, bodyLength } = outcome;
  lines.push(`  HTTP status: ${status}`);
  lines.push(`  Body là JSON: ${body !== null ? 'có' : 'không'} (độ dài ${bodyLength})`);
  if (body === null) return { line: lines, ok: false, fp: null };

  const keys = Object.keys(body).sort();
  lines.push(`  Tên trường top-level: ${keys.join(', ') || '(trống)'}`);
  if ('error' in body) lines.push(`  Mã lỗi Zalo (error): ${body.error}`);
  if ('message' in body) lines.push(`  Thông điệp Zalo: ${clip(body.message)}`);

  const hasId = typeof body.id === 'string' || typeof body.id === 'number';
  const fp = hasId ? fingerprint(body.id) : null;
  if (hasId) lines.push(`  Trường id: có, độ dài ${String(body.id).length}, dấu vân tay ${fp}`);
  lines.push(`  Trường name: ${typeof body.name === 'string' ? `có, độ dài ${body.name.length}` : 'không có'}`);
  lines.push(`  Trường picture: ${body.picture && typeof body.picture === 'object' ? 'có (object)' : body.picture ? 'có (kiểu khác)' : 'không có'}`);
  const ok = status === 200 && (body.error === 0 || body.error === undefined) && hasId;
  return { line: lines, ok, fp };
}

async function runCase(v) {
  if (v.needsSecret && !secretKey) {
    return summarize(v, { skipped: 'thiếu ZALO_SECRET_KEY' });
  }
  if (v.id !== 'C' && !token) {
    return summarize(v, { skipped: 'thiếu ZALO_ACCESS_TOKEN' });
  }
  try {
    const headers = v.headers(v.id === 'C' ? FAKE_TOKEN : token, secretKey);
    const outcome = await callMe(headers);
    return summarize(v, outcome);
  } catch (err) {
    return summarize(v, { networkError: `${err?.name ?? 'Error'}: ${err?.message ?? err}` });
  }
}

async function main() {
  if (DRY_RUN) {
    printDryRunPlan();
    return 0;
  }
  if (!token) {
    console.error('Thiếu biến môi trường ZALO_ACCESS_TOKEN. Xem docs/spikes/s1-auth-zalo.md.');
    return 2;
  }

  const results = [];
  for (const v of VARIANTS) results.push({ v, r: await runCase(v) });
  results.push({ v: INVALID_CASE, r: await runCase(INVALID_CASE) });

  // Gọi lại biến thể A để kiểm id có ổn định giữa các lần gọi không.
  const a1 = results.find((x) => x.v.id === 'A').r;
  let stability = 'không chạy được (biến thể A chưa thành công)';
  if (a1.ok) {
    const again = await runCase(VARIANTS[0]);
    stability = again.fp && again.fp === a1.fp ? 'ổn định (cùng dấu vân tay)' : 'KHÔNG ổn định hoặc lỗi ở lần 2';
  }

  console.log('[S1-a] Kết quả Zalo Graph API (không in giá trị nhạy cảm):');
  for (const { r } of results) {
    for (const line of r.line) console.log(line);
  }
  console.log(`Id ổn định giữa 2 lần gọi biến thể A: ${stability}`);
  console.log('Lưu ý: so sánh id giữa các Mini App bằng cách chạy lại với token của Mini App khác cùng người dùng, rồi so dấu vân tay.');

  const anyOk = results.some((x) => x.r.ok);
  return anyOk ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`Lỗi không mong đợi: ${clip(err?.message ?? err)}`);
    process.exitCode = 1;
  },
);
