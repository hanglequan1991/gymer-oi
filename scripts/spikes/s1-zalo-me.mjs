#!/usr/bin/env node
// Spike S1 (a): kiểm tra access_token của Zalo Mini App qua Graph API.
// Chạy tay trên máy cá nhân. Không in token, secret key, hay giá trị id/name/ảnh.
// Chỉ in: HTTP status, mã lỗi Zalo, tên trường có mặt, độ dài, kiểu của id trong văn bản thô,
// và "dấu vân tay" SHA-256 rút gọn của id (tính trên chuỗi thô, không qua JSON.parse).
//
// Cách dùng:
//   node scripts/spikes/s1-zalo-me.mjs --dry-run      (không gọi mạng, chỉ in kế hoạch)
//   ZALO_ACCESS_TOKEN=... [ZALO_APP_SECRET=...] node scripts/spikes/s1-zalo-me.mjs
//   ZALO_ACCESS_TOKEN=... ZALO_ACCESS_TOKEN_OTHER_APP=... node scripts/spikes/s1-zalo-me.mjs --other
//     (--other: gọi thêm bằng token của Mini App thứ hai cùng người dùng, so dấu vân tay id với lần chạy chính)
//
// Giả thuyết cần kiểm (chưa khẳng định): GET graph.zalo.me/v2.0/me với header access_token.
// Tên header secret_key ở biến thể B cũng là giả thuyết.

import { createHash } from 'node:crypto';

const ENDPOINT = 'https://graph.zalo.me/v2.0/me';
const FIELDS = 'id,name,picture';
const TIMEOUT_MS = 15000;
const DRY_RUN = process.argv.includes('--dry-run');
const OTHER_APP = process.argv.includes('--other');

// Token giả dùng để xem dạng lỗi khi token sai. Không phải bí mật.
const FAKE_TOKEN = 'token-gia-s1-kiem-loi-0000';

const token = (process.env.ZALO_ACCESS_TOKEN ?? '').trim();
const tokenOther = (process.env.ZALO_ACCESS_TOKEN_OTHER_APP ?? '').trim();
const secretKey = (process.env.ZALO_APP_SECRET ?? '').trim();

// Mọi chuỗi in ra đều đi qua hàm này để che bí mật nếu lỡ xuất hiện trong thông báo lỗi.
const secretsToRedact = [token, tokenOther, secretKey].filter((s) => s.length > 0);
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

// Quét văn bản thô (KHÔNG JSON.parse) để lấy khoá "id" ở cấp trên cùng.
// Trả về danh sách lần xuất hiện: { kind: 'chuỗi' | 'số' | 'khác', raw }.
// raw là đúng chuỗi ký tự trong thân phản hồi (không có dấu nháy bao ngoài).
function findTopLevelId(text) {
  const hits = [];
  const n = text.length;
  const isSpace = (ch) => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
  // Đọc chuỗi JSON bắt đầu tại vị trí start (dấu nháy mở). Trả về [nội dung thô, vị trí sau dấu nháy đóng].
  const readString = (start) => {
    let j = start + 1;
    while (j < n && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
    return [text.slice(start + 1, j), j + 1];
  };
  let depth = 0;
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      const [inner, next] = readString(i);
      if (depth === 1 && inner === 'id') {
        let k = next;
        while (k < n && isSpace(text[k])) k++;
        if (text[k] === ':') {
          k++;
          while (k < n && isSpace(text[k])) k++;
          if (text[k] === '"') {
            const [value] = readString(k);
            hits.push(value.includes('\\')
              ? { kind: 'chuỗi có ký tự thoát', raw: '' }
              : { kind: 'chuỗi', raw: value });
          } else {
            const m = /^-?\d+(?![\d.eE])/.exec(text.slice(k, k + 64));
            hits.push(m ? { kind: 'số', raw: m[0] } : { kind: 'khác', raw: '' });
          }
        }
      }
      i = next;
      continue;
    }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    i++;
  }
  return hits;
}

function idInfo(text) {
  const hits = findTopLevelId(text);
  if (hits.length !== 1) return { count: hits.length };
  const { kind, raw } = hits[0];
  if (raw.length === 0) return { count: 1, kind, fp: null, len: 0 };
  return { count: 1, kind, fp: fingerprint(raw), len: raw.length };
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

const OTHER_APP_CASE = {
  id: 'D',
  name: 'token Mini App thứ hai, so id với biến thể A',
  needsSecret: false,
  tokenVar: 'ZALO_ACCESS_TOKEN_OTHER_APP',
  headers: (t) => ({ access_token: t }),
};

function printDryRunPlan() {
  console.log('[S1-a] Kế hoạch (dry-run, không gọi mạng):');
  console.log(`  Biến ZALO_ACCESS_TOKEN: ${token ? 'có' : 'thiếu (bắt buộc khi chạy thật)'}`);
  console.log(`  Biến ZALO_APP_SECRET: ${secretKey ? 'có' : 'thiếu (tuỳ chọn, biến thể B bị bỏ qua)'}`);
  console.log(`  Endpoint: GET ${ENDPOINT}?fields=${FIELDS}`);
  for (const v of VARIANTS) {
    console.log(`  Biến thể ${v.id}: ${v.name}`);
  }
  console.log(`  Biến thể ${INVALID_CASE.id}: ${INVALID_CASE.name}`);
  console.log('  Gọi lại biến thể A lần thứ 2 để kiểm id có ổn định không.');
  console.log(`  Cờ --other: ${OTHER_APP ? 'BẬT' : 'tắt'}`);
  if (OTHER_APP) {
    console.log(`  Biến ZALO_ACCESS_TOKEN_OTHER_APP: ${tokenOther ? 'có' : 'thiếu (bắt buộc khi có --other)'}`);
    console.log(`  Biến thể ${OTHER_APP_CASE.id}: ${OTHER_APP_CASE.name}`);
    console.log('  So dấu vân tay id giữa biến thể A (app chính) và biến thể D (app thứ hai).');
  }
}

async function callMe(headers) {
  const res = await fetch(`${ENDPOINT}?fields=${FIELDS}`, {
    method: 'GET',
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  return { status: res.status, text };
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
  const { status, text } = outcome;
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  lines.push(`  HTTP status: ${status}`);
  lines.push(`  Body là JSON: ${body !== null ? 'có' : 'không'} (độ dài ${text.length})`);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { line: lines, ok: false, fp: null };

  const keys = Object.keys(body).sort();
  lines.push(`  Tên trường top-level: ${keys.join(', ') || '(trống)'}`);
  if ('error' in body) lines.push(`  Mã lỗi Zalo (error): ${body.error}`);
  if ('message' in body) lines.push(`  Thông điệp Zalo: ${clip(body.message)}`);

  // id lấy từ văn bản thô; body.id (sau JSON.parse) không dùng để tính dấu vân tay.
  const id = idInfo(text);
  if (id.count === 0) lines.push('  Trường id: không tìm thấy ở cấp trên cùng');
  else if (id.count > 1) lines.push(`  Trường id: xuất hiện ${id.count} lần ở cấp trên cùng, không dùng được`);
  else if (id.fp === null) lines.push(`  Trường id: kiểu ${id.kind}, không đọc được giá trị`);
  else {
    lines.push(`  Trường id: có, kiểu trong văn bản thô: ${id.kind}, độ dài ${id.len}, dấu vân tay ${id.fp}`);
    if (id.kind === 'số' && id.len > 15) {
      lines.push('  CẢNH BÁO: id dạng số dài hơn 15 chữ số, JSON.parse sẽ làm tròn. Verifier phải đọc id từ văn bản thô.');
    }
  }
  lines.push(`  Trường name: ${typeof body.name === 'string' ? `có, độ dài ${body.name.length}` : 'không có'}`);
  lines.push(`  Trường picture: ${body.picture && typeof body.picture === 'object' ? 'có (object)' : body.picture ? 'có (kiểu khác)' : 'không có'}`);

  const hasId = id.count === 1 && id.fp !== null;
  const ok = status === 200 && (body.error === 0 || body.error === undefined) && hasId;
  return { line: lines, ok, fp: hasId ? id.fp : null };
}

async function runCase(v, usedToken = token) {
  const varName = v.tokenVar ?? 'ZALO_ACCESS_TOKEN';
  if (v.needsSecret && !secretKey) {
    return summarize(v, { skipped: 'thiếu ZALO_APP_SECRET' });
  }
  if (v.id !== 'C' && !usedToken) {
    return summarize(v, { skipped: `thiếu ${varName}` });
  }
  try {
    const headers = v.headers(v.id === 'C' ? FAKE_TOKEN : usedToken, secretKey);
    const outcome = await callMe(headers);
    return summarize(v, outcome);
  } catch (err) {
    return summarize(v, { networkError: `${err?.name ?? 'Error'}: ${err?.message ?? err}` });
  }
}

// So dấu vân tay id giữa app chính (biến thể A) và app thứ hai. Không in id.
async function compareOtherApp(mainFp) {
  if (tokenOther === token) {
    return {
      line: ['Biến thể D: BỎ QUA, token app thứ hai trùng token chính (không phải hai app).'],
      conclusion: 'KHÔNG KẾT LUẬN: token app thứ hai trùng token chính.',
      concluded: false,
    };
  }
  const d = await runCase(OTHER_APP_CASE, tokenOther);
  let conclusion;
  if (!d.ok || d.fp === null) {
    conclusion = 'KHÔNG KẾT LUẬN: lần gọi với token app thứ hai không thành công (xem dòng trên).';
  } else if (mainFp === null) {
    conclusion = 'KHÔNG KẾT LUẬN: lần chạy chính với biến thể A không lấy được id.';
  } else if (d.fp === mainFp) {
    conclusion = 'Kết luận: id GIỐNG giữa hai app.';
  } else {
    conclusion = 'Kết luận: id KHÁC giữa hai app.';
  }
  return { line: d.line, conclusion, concluded: conclusion.startsWith('Kết luận') };
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
  if (OTHER_APP && !tokenOther) {
    console.error('Cờ --other cần biến ZALO_ACCESS_TOKEN_OTHER_APP (token của Mini App thứ hai). Xem docs/spikes/s1-auth-zalo.md.');
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

  let otherConcluded = false;
  if (OTHER_APP) {
    const cmp = await compareOtherApp(a1.fp);
    for (const line of cmp.line) console.log(line);
    console.log(cmp.conclusion);
    if (cmp.concluded) {
      console.log('Điều kiện: hai token phải là của CÙNG một người dùng. Script không kiểm được việc này.');
    }
    otherConcluded = cmp.concluded;
  } else {
    console.log('Để so id giữa hai Mini App: chạy với --other và đặt ZALO_ACCESS_TOKEN_OTHER_APP (token cùng người dùng).');
  }

  if (OTHER_APP) return otherConcluded ? 0 : 1;
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
