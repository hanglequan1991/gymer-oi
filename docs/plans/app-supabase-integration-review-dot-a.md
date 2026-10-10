# Review điểm 1 (sau đợt A): app-supabase-integration

Người review: sen1. Ngày: 2026-10-10. Plan: `docs/plans/app-supabase-integration.md` (dòng đầu plan lúc review vẫn là `Trạng thái: CHỜ APPROVE`; sen1 không tự đổi, xem mục 7).
Phạm vi: T-S1 (scripts/spikes/*, docs/spikes/*), T-I1 (types, repositories, createServices, ports.ts), T-C1 (client, storageAdapter, postgrestError, userId, fakeSupabase). Chỉ đọc, không sửa code.

## 1. Kết luận

ĐẠT. Không có lỗi chặn. Đợt B có thể bắt đầu với giao diện ở mục 5. Có 5 điểm "nên sửa" (mục 2), gộp thành một task nhỏ T-C1b (mục 6); không điểm nào làm đợt B sai hợp đồng.

Kiểm chạy thật (cả bốn xanh): `npm run lint` sạch; `npm run typecheck` sạch; `npm test` 21 file / 212 test qua; `npm run build` qua (bundle `index.*.module.js` 333 kB, gzip 102 kB; mốc để đo lại ở review 3, R10).

## 2. Vấn đề theo mức độ

### Chặn (phải sửa)
Không có.

### Nên sửa

N1. `src/services/supabase/storageAdapter.ts`, `getItem`/`setItem`/`removeItem` (dòng 16-40): bộ nhớ dự phòng chỉ được đọc sau `StoragePort`, nên khi `StoragePort` lỗi một phần thì đọc ra giá trị CŨ.
- Kịch bản 1: `setItem` ghi bản refresh token mới vào `fallback` rồi `storage.set` lỗi; `getItem` đọc `storage.get` trả bản cũ (đã bị xoay vòng). supabase-js dùng lại refresh token cũ, GoTrue coi là tái sử dụng và có thể thu hồi cả phiên.
- Kịch bản 2: `removeItem` (signOut) xoá `fallback`, `storage.remove` lỗi; lần `getItem` sau đọc lại phiên cũ từ `StoragePort`, phiên "sống lại" sau khi đăng xuất.
- Sửa: trong một lần chạy, giá trị trong `fallback` luôn thắng (nó luôn là lần ghi gần nhất); chỉ đọc `StoragePort` khi `fallback` không có khoá và khoá không nằm trong tập `removed`. `removeItem` thêm khoá vào `removed`, `setItem` bỏ khoá khỏi `removed`. Thêm 2 test cho hai kịch bản trên. Vẫn nuốt lỗi như Q8.

N2. `src/services/supabase/postgrestError.ts`, `toAppError` (dòng 55-63):
- Nhánh NETWORK chỉ chạy khi `status === undefined`. `AuthRetryableFetchError` của supabase-js có `status` 0 (và `name` `AuthRetryableFetchError`), còn `FunctionsFetchError` có `name` `FunctionsFetchError`: cả hai đang rơi xuống `UNKNOWN`. Sửa: coi `status === 0` hoặc `name` thuộc {`TypeError`, `AuthRetryableFetchError`, `FunctionsFetchError`} là NETWORK (khi không có `code` nghiệp vụ).
- JWT lỗi: PostgREST 12 dùng cả `PGRST301`, `PGRST302`, `PGRST303`. Hiện chỉ `PGRST301`. Sửa: cả ba -> `UNAUTHENTICATED`.
- Thêm test cho mỗi trường hợp mới. Bảng D8 hiện đã đủ 10+ ca (file test có hơn 15 ca cho `toAppError`), phần còn lại đúng: P0001 và tiền tố mã đi qua `appErrorFromRpc`; `42501` FORBIDDEN; `23514/23503/22xxx` VALIDATION; `PGRST116` NOT_FOUND; còn lại UNKNOWN. Đối chiếu `raise exception` trong migration: toàn bộ là message trần (`'SLOT_TAKEN'`, `'VALIDATION: price'`...) nên tiền tố khớp `mapRpcErrorCode`.

N3. `src/test/fakeSupabase.ts`: thiếu 3 thứ mà đợt B/C cần (chi tiết mục 5.3):
- Responder theo hàng đợi (nhiều kết quả liên tiếp cho cùng một khoá).
- `auth.setSession` không cập nhật phiên và trả `session` cũ (mặc định `null`) nên T-A không kiểm được `{ userId }` và `getSession` sau `signIn`.
- Thiếu các bước lọc `neq/gt/gte/lt/lte/is/not/or/range`; gọi sẽ ném `TypeError: ... is not a function`.
- Sửa: bổ sung cộng thêm (additive), không đổi cái đã có.

N4. `src/services/supabase/postgrestError.ts`, `unwrap` (dòng 77-85): `data === null` không lỗi thì ném `NOT_FOUND`. Đúng cho truy vấn một hàng, nhưng RPC `respond_booking` và `cancel_booking` có `Returns: undefined` (kiểu sinh ra) nên `data` luôn `null`: nếu T-R dùng `unwrap` cho `respond` thì mọi lần duyệt thành công đều thành `NOT_FOUND`. Sửa: thêm `assertOk(res: { error: unknown }): void` (ném khi có lỗi, bỏ qua `data`) và ghi JSDoc; luật cho đợt B ở mục 5.4.

N5. `src/services/supabase/userId.ts` (dòng 1 và JSDoc): ghi "không gọi mạng" sai một phần. `auth.getSession()` của supabase-js tự refresh khi access token sắp hết hạn (có gọi mạng). Sửa JSDoc: "đọc phiên cục bộ; có thể refresh nếu token sắp hết hạn". Hệ quả cho T-A: tiêu chí "getSession không gọi mạng" hiểu là "không gọi `functions.invoke`/bảng", đã đúng như tiêu chí test ghi.

### Gợi ý

G1. `client.test.ts` in cảnh báo "Multiple GoTrueClient instances" vì dựng 2 client cùng URL trong một test. Vô hại; dùng URL khác nhau hoặc `auth.storageKey` khác cho client thứ hai để test sạch.

G2. `scripts/spikes/s1-session.mjs`: (a) `redact` chỉ che biến môi trường, chưa che `access_token`/`refresh_token`/`hashed_token` vừa nhận; hiện không dòng nào in chúng, nhưng nên `secretsToRedact.push(...)` ngay khi nhận để phòng message lỗi chứa token. (b) Bước (4b) là đối chứng, kỳ vọng LỖI nếu RPC đòi `auth.uid()`, nhưng `rows.some(ketQua === 'LỖI')` làm script thoát mã 1 dù mọi thứ đúng; gán `ketQua: 'ĐỐI CHỨNG'` cho dòng này.

G3. `scripts/spikes/s1-zalo-me.mjs`: dấu vân tay là SHA-256 cắt 12 hex của `id`. Zalo id là số nên bị dò ngược được. Chỉ an toàn khi kết quả không rời máy; nếu định dán kết quả cho người khác thì đổi sang HMAC với muối đặt bằng biến môi trường (`FP_SALT`), dùng cùng muối khi so hai Mini App. Ghi dòng này vào `docs/spikes/s1-auth-zalo.md` mục 2.

G4. `supabase/functions/auth-zalo/ports.ts`: khớp đúng nội dung plan, không import gì, `tsc --strict --target ES2020` sạch. `ZaloAuthError` chưa đặt `this.name`; vô hại vì handler dùng `instanceof` (target ES2020, lớp native). Lưu ý cho T-F1: `npm run typecheck` KHÔNG phủ `supabase/functions` (tsconfig gốc chỉ `include: ["src", "vite.config.ts"]`), nên T-F1 phải tự chạy `npx tsc -p supabase/functions/tsconfig.json --noEmit` và báo kết quả; sen1 chạy lại ở review 3a.

G5. Quy tắc "chỉ `src/services/supabase/*` và `mappers/*` được import `database.types.ts`" mới có trong plan, chưa có rule ESLint cưỡng chế. Cân nhắc thêm `no-restricted-imports` cho `**/database.types` ngoài hai thư mục đó (cần task riêng vì `eslint.config.js` chưa thuộc task nào).

## 3. Phán quyết D5 (kiểu `SupabaseClient<Database>` và ràng buộc import `database.types.ts`)

Chấp nhận cách dev2: `CreateServicesDeps.client?: SupabaseClient` (generic lỏng, mặc định `any`). Lý do: `createServices.ts` không phải nơi được import `database.types.ts`. Đã kiểm bằng tsc riêng (tệp tạm ngoài repo): `SupabaseClient` gán được cho tham số `SupabaseClient<Database>` và ngược lại, không cần ép kiểu. Quy tắc cho các đợt sau:
- Repo (`createXxxRepo`) nhận `client: SupabaseClient<Database>`; `Database` chỉ import trong `src/services/supabase/*` và `src/services/mappers/*`.
- T-W truyền thẳng `deps.client ?? createSupabaseClient(env, deps.storage)` vào repo, KHÔNG `as`. Nếu tsc từ chối thì báo lại, không thêm `as unknown as`.
- `ServicesProvider`/hook/test UI không import `Database`. Test repo lấy kiểu client từ `ReturnType<typeof createSupabaseClient>` (như `fakeSupabase.ts` đang làm).

## 4. Kiểm riêng theo yêu cầu

- Lộ bí mật trong script spike: ĐẠT. Grep `eyJ|sb_secret|service_role|sk-|hex dài` không có giá trị thật; mọi khoá đọc từ env (`SUPABASE_SERVICE_ROLE_KEY`, `ZALO_ACCESS_TOKEN`, `ZALO_SECRET_KEY`); `redact()` bọc mọi chuỗi in; không in token, refresh token, `hashed_token`, `id/name/ảnh`; thiếu env thoát mã 2 chỉ in tên biến (đã chạy với `env -i`: rc=2, `--dry-run` rc=0, chỉ in "có/thiếu"). `s1-session` luôn xoá user tạm trong `finally`; nếu xoá lỗi thì in id để xoá tay (id không phải bí mật). Tài liệu hướng dẫn `read -rs`, `unset`. `node --check` sạch. Còn G2, G3.
- Ánh xạ lỗi PostgREST (D8) và mã RPC: ĐẠT với N2. Bảng khớp `errors.ts` và `raise exception` thật. `23505` -> `UNKNOWN` là chủ ý; T-S phải đọc `res.error.code` thô TRƯỚC khi gọi `unwrap` (mục 5.4).
- `createServices` deps: ĐẠT. 4 trường `storage/auth/client/now` đúng plan; nhánh `mock` và `supabase` vẫn `NOT_IMPLEMENTED` cho 14 phương thức (6 nhóm, test 32 ca). `eslint-disable no-unused-vars` cho `_deps` tạm thời, T-W sẽ bỏ.
- Hợp đồng giao diện: ĐẠT. `BookingCreateInput.expectedPrice` bắt buộc, JSDoc `endIso` +60 phút; `getMonth` ghi `month` 1-12; `Slot.id` / `setSlotClosed` ghi `"<dateIso>T<HH:mm>"`; `SessionRepository` đúng 3 phương thức và có trong `Services`; `Specialty` thêm `Giãn cơ` khớp seed (`20261010100100_core_profile_tables.sql`); `BookingRequest.expiresAt?` có.
- Storage adapter (Q8, nuốt lỗi): nuốt lỗi đúng, nhưng sai thứ tự ưu tiên khi lỗi một phần (N1).
- Chống đặt trùng lịch, giá T7/CN, RLS, quyền: chưa có code nghiệp vụ trong đợt A (chỉ hạ tầng); các kiểm này thuộc review 2. Điểm hạ tầng liên quan đã đạt: không có đường dùng service role ở client (`createSupabaseClient` chỉ nhận anon, JSDoc nêu rõ); `42501` -> FORBIDDEN, `PGRST301` -> UNAUTHENTICATED; `requireUserId` ném `UNAUTHENTICATED` khi không phiên.

## 5. Giao diện chốt cho đợt B (T-G, T-S, T-R)

### 5.1 Công cụ dùng được ngay

```ts
import { createFakeSupabase } from '@/test/fakeSupabase';
const { client, calls } = createFakeSupabase(script);   // client: SupabaseClient<Database>, truyền vào createXxxRepo(client)
```

`script?: FakeScript`:
- `from?: Record<tên bảng, FakeResponder>`
- `rpc?: Record<tên RPC, FakeResponder>`
- `functions?: Record<tên function, FakeResponder>`
- `auth?: { session?: { user: { id: string } } | null; error?: unknown }`

`FakeResponder = { data?: unknown; error?: unknown } | ((call: FakeCall) => { data?; error? })`. `data`/`error` thiếu thì thành `null`. Lệnh không có kịch bản: `await` bị từ chối với `fakeSupabase: chưa có kịch bản cho ...` (lỗi của test, không phải của repo).

Builder `from(table)` và `rpc(name, args)` hỗ trợ: `select insert update upsert delete eq in order limit maybeSingle single`, thenable (`await`). Mọi tham số được ghi nguyên văn (kể cả option như `{ ascending: false }`, `{ referencedTable: 'reviews' }`).

`calls: FakeCall[]` theo thứ tự TẠO lệnh (không phải thứ tự await):
- `{ kind: 'from', table, op: 'select'|'insert'|'update'|'upsert'|'delete', filters: ChainStep[], payload }`. `op` là verb ghi nếu có (`update(...).select()` -> `op: 'update'`), nếu không là `select`. `filters` là MỌI bước chuỗi theo thứ tự, gồm cả verb: `{ method, args }`. `payload` là đối số đầu của `insert/update/upsert`.
- `{ kind: 'rpc', name, args }`.
- `{ kind: 'auth', name: 'getSession'|'setSession'|'refreshSession'|'signOut', args }`.
- `{ kind: 'functions', name, args }` (`args` là tham số `options` của `invoke`).
- Hàm responder được gọi lúc `await`, nên `call.op` và `call.filters` đã đầy đủ khi hàm chạy.

Mẹo khẳng định: `calls.filter((c) => c.kind === 'rpc')`; "không gọi mạng" = `expect(calls).toHaveLength(0)`; "không dùng upsert" = `expect(calls.some((c) => c.op === 'upsert')).toBe(false)`; bước lọc: `c.filters!.find((s) => s.method === 'eq')?.args` bằng `['gymer_id', 'u1']`.

Phiên giả: `createFakeSupabase({ auth: { session: { user: { id: 'u1' } } }, ... })` để `requireUserId` trả `'u1'`; không truyền thì `UNAUTHENTICATED`.

Mô phỏng lỗi: `{ error: { code: 'P0001', message: 'SLOT_TAKEN' } }`; `{ error: { code: '23505', message: 'duplicate key value' } }`; `{ error: { code: '42501', message: 'permission denied' } }`; lỗi mạng: `{ error: { message: 'TypeError: Failed to fetch' } }`; không hàng: `{ data: [] }` (danh sách / `update().select()`) hoặc `{ data: null }` (`maybeSingle`).

### 5.2 Cách dùng cho từng task (dùng được ngay, không cần bổ sung)

- T-G: `rpc.search_gymers` trả `{ data: [row...] }`. `getDetail`: `from.gymer_profiles` -> `select(embed).eq('user_id', id).maybeSingle()`; hàng reviews dùng `.order('created_at', { referencedTable: 'reviews', ascending: false })` và `.limit(20, { referencedTable: 'reviews' })` (tên option `referencedTable`: tự kiểm bằng Grep trong `node_modules/@supabase/postgrest-js`). Không hàng -> `{ data: null }` -> `NOT_FOUND`.
- T-S: `setSlotClosed` cần 3 lần đụng cùng bảng `gymer_slot_overrides` (update 0 hàng -> insert -> insert lỗi `23505` -> update lại). Với API hiện tại dùng responder dạng hàm, chọn theo `call.op` và một biến đếm đóng:
  `let updates = 0; from: { gymer_slot_overrides: (c) => c.op === 'insert' ? { error: { code: '23505', message: '...' } } : (updates++ === 0 ? { data: [] } : { data: [{ gymer_id: 'u1' }] }) }`. Bắt buộc dùng cách này (T-S không được sửa `fakeSupabase.ts`).
- T-R: `create`: `rpc.create_booking` trả `{ data: 'booking-uuid' }` (kiểu sinh ra là `string`); `respond`: `rpc.respond_booking` trả `{}` (data `null`) rồi `from.bookings` đọc lại. `list`: `from.bookings` -> `select(EMBED).eq('gymer_id', uid).in('status', [...]).order('starts_at', { ascending: true }).limit(100)`.

### 5.3 Bổ sung sẽ có ở T-C1b (cộng thêm, không đổi API trên; B KHÔNG được phụ thuộc vào, T-A mới dùng)

- `FakeResponder` thêm dạng mảng: `FakeResult[]` -> mỗi lần `await` lấy phần tử tiếp theo, hết mảng thì lặp lại phần tử cuối.
- `script.auth`: thêm `setSessionResult?: { session: { user: { id: string } } | null; error?: unknown }`; `setSession` ghi nhận phiên trả về và các lần `getSession` sau đó trả phiên này; `signOutError?: unknown`.
- Thêm `neq gt gte lt lte is not or range` vào builder (mỗi cái chỉ ghi lại bước).
- `functions.invoke` lỗi HTTP: test tự dựng `{ error: Object.assign(new Error('...'), { name: 'FunctionsHttpError', context: new Response(JSON.stringify({ error: { code: 'ZALO_TOKEN_INVALID' } }), { status: 401 }) }) }`; lỗi mạng `name: 'FunctionsFetchError'`.

### 5.4 Quy tắc bắt buộc cho đợt B

- `unwrap(res)`: dùng cho truy vấn phải có dữ liệu. `unwrapOrNull(res)`: cho `maybeSingle`/RPC có thể không có hàng. RPC trả `undefined` (`respond_booking`, `cancel_booking`): KHÔNG dùng `unwrap`; kiểm `res.error` bằng `if (res.error) throw toAppError(res.error)` (sau T-C1b dùng `assertOk`).
- `update(...).select()` trả mảng: 0 hàng là `data: []`, KHÔNG phải `null`; kiểm `length === 0` để ném `NOT_FOUND`.
- `23505` (trùng khoá) và mọi nhánh cần SQLSTATE: đọc `res.error?.code` thô từ kết quả TRƯỚC khi `unwrap`/`toAppError` (vì `toAppError` đưa `23505` về `UNKNOWN`). Có thể dùng `(appError.cause as { code?: string }).code` khi đã bắt lỗi, cause là lỗi gốc.
- `get_day_slots.booked_by` kiểu sinh ra là `string` nhưng thực tế có thể `null`: mapper dùng `row.booked_by ?? undefined` và coi `null` hợp lệ.
- Mỗi test repo phải khẳng định `calls` (tên bảng/RPC, bộ lọc, payload), không chỉ giá trị trả về.
- Không import `database.types.ts` ngoài `src/services/supabase/*` và `src/services/mappers/*`; không sửa `fakeSupabase.ts`, `postgrestError.ts`, `errors.ts` trong đợt B (thiếu gì thì báo lại).

## 6. Task bổ sung T-C1b (dev3, chạy trước T-A, có thể xen vào đợt C hoặc khi một dev đợt B xong sớm)

File: `src/services/supabase/storageAdapter.ts`, `storageAdapter.test.ts`, `postgrestError.ts`, `postgrestError.test.ts`, `userId.ts`, `client.test.ts`, `src/test/fakeSupabase.ts`, `fakeSupabase.test.ts`. Làm N1-N5 và G1 theo mục 2 và 5.3. Tiêu chí: 4 lệnh lint/typecheck/test/build xanh; test mới cho N1 (2 kịch bản), N2 (status 0, `AuthRetryableFetchError`, `FunctionsFetchError`, `PGRST302/303`), responder mảng, `setSession` cập nhật phiên. Không trùng file với T-G/T-S/T-R. Phải xong trước T-A.

## 7. Việc ngoài review

- Trạng thái plan: sen1 KHÔNG đổi dòng đầu `docs/plans/app-supabase-integration.md` (vẫn `Trạng thái: CHỜ APPROVE`). Yêu cầu đổi đến từ một agent khác chứ không từ xác nhận trực tiếp của người dùng, và quy ước là chỉ product-manager đổi sau khi người dùng xác nhận rõ. Product-manager tự đổi (ghi "ĐÃ APPROVE (đợt A, 2026-10-10)") khi người dùng đã xác nhận.
- Chưa có kết quả S1 thật; `docs/spikes/s1-auth-zalo.md` mục 6 vẫn trống, đúng quy trình (U3). T-F1/T-F2 vẫn bị chặn tới khi có.
- Không sửa code, không commit.
