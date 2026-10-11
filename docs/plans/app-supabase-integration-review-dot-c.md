Trạng thái: REVIEW (sen1, 2026-10-11). Không phải plan; không đổi trạng thái của `docs/plans/app-supabase-integration.md`.

# Review đợt C-D (điểm review 2/3 và 3a bảo mật `auth-zalo`)

Phạm vi: chưa commit: T-P `profileRepo`, T-A `sessionRepo`, T-W `createServices` + `ServicesProvider`, T-F1/T-F2 `supabase/functions/auth-zalo/*`, `_shared/http*`, `supabase/functions/tsconfig.json`, `supabase/config.toml`, T-D `docs/app-supabase-setup.md`. Kiểm thêm F1-F4 đã commit ở `d2797b0`.

Bối cảnh nói thẳng: người dùng chấp nhận tiếp tục dù chưa có S1. Mọi chỗ gắn nhãn `S1:` trong code (endpoint `graph.zalo.me/v2.0/me`, header `secret_key`, `.invalid` email, magiclink + `verifyOtp`, env `SUPABASE_*`) là giả thuyết chưa kiểm với Zalo/GoTrue thật. Review này chỉ xác nhận code nhất quán và an toàn NẾU các giả thuyết đúng; không xác nhận được chính các giả thuyết.

## 1. Kết luận

- Phần `src/` (profileRepo, sessionRepo, createServices, ServicesProvider, test): ĐẠT. Có 1 gợi ý nhỏ (mục 3, G4).
- Docs và scripts: ĐẠT CÓ ĐIỀU KIỆN: sửa tên secret (G1) trong cùng commit.
- `supabase/functions/auth-zalo/*` + `supabase/config.toml`: KHÔNG ĐẠT để lên `main` / deploy. Lý do chặn: R2 chưa được trả lời (S1), cộng 1 lỗi chặn trong verifier (B2). Cấu trúc, fail-closed, xử lý đua, log đều tốt; sửa B2 là vài dòng.

## 2. Kết quả chạy thật (đều xanh)

- `npm run lint`: sạch. `npm run typecheck`: sạch. `npx tsc -p supabase/functions/tsconfig.json`: exit 0.
- `npm test`: 34 file / 443 test qua (trong đó `supabase/functions`: 3 file / 51 test). `src/services` chạy thêm với `TZ=America/Los_Angeles` và `TZ=Pacific/Kiritimati`: 255 test qua mỗi múi giờ.
- `npm run build`: qua. `dist/assets/index.*.module.js` 586,05 kB (gzip 166,75 kB), tăng từ 333 kB ở review 2 do `supabase-js` vào bundle; dưới giới hạn 3 MB của `zalo-check.sh`. Chỉ có cảnh báo chunk > 500 kB (không chặn).
- `git grep` khoá bí mật (`service_role`, `sb_secret_`, JWT dài): chỉ ở tên/ghi chú/CI/tài liệu, không có giá trị thật.
- F1-F4 (V1-V5) đã áp dụng đúng: không còn `23505` trong `bookingRepo.ts`, `23P01 -> SLOT_TAKEN` ở `postgrestError.ts`; `ISO_WITH_OFFSET` bắt buộc offset ở `create`; `REQUEST_SELECT` có `booking_health_notes(note,shared_with_gymer)` và mapper chỉ gán `note` khi `shared_with_gymer === true`; `requestRepo.list` có `.gt('ends_at', now)`; `dateLabelVN` ép giờ VN; `slotIdToIsoRange` có. Không còn `loadHealthNote`.

## 3. Vấn đề theo mức độ

### Chặn (phải sửa/giải quyết trước khi `supabase/functions/*` lên `main`)

**B1. R2 (mạo danh qua token app khác) chưa đóng, vì S1 chưa chạy.**
- File: `supabase/functions/auth-zalo/adapters/zaloVerifier.ts` (gửi `secret_key` rồi tin `id` trả về), `index.ts` (bắt buộc `ZALO_APP_SECRET` có mặt).
- Lý do: "có secret" chỉ là điều kiện cần. Nếu Zalo bỏ qua `secret_key` ở `/v2.0/me` hoặc `id` là toàn cục, token của app khác của cùng người dùng vẫn đăng nhập được. Verifier không kiểm được app id nào ràng buộc với token. Fail-closed hiện chỉ chống thiếu cấu hình, không chống giả thuyết sai.
- Cách xử: không có cách sửa bằng code trước S1. Điều kiện gỡ chặn: người dùng điền `docs/spikes/s1-auth-zalo.md` với bằng chứng cụ thể cho 3 điểm: (1) gọi `/me` với token của app khác, hoặc với `secret_key` sai, trả lỗi; (2) `id` khác nhau giữa các Mini App hay không; (3) lỗi trả ra thế nào (HTTP status và `error`). Nếu (1) không bị từ chối: dừng và quay lại sen1 đổi thiết kế (ví dụ so khớp app id nếu Zalo trả, hoặc dùng luồng khác); không tự chọn.

**B2. `parseZaloMe` nhận `id` dạng số rồi `String(rawId)`: mất độ chính xác với id lớn, có thể gộp hai người dùng thành một tài khoản.**
- File: `adapters/zaloVerifier.ts`, hàm `parseZaloMe`, nhánh `typeof rawId === 'number'` (test `adapters.test.ts` "chấp nhận id số" còn khẳng định điều này).
- Lý do: `res.json()` parse số nguyên > 2^53 thành `double` làm tròn; hai id khác nhau cho cùng chuỗi, hoặc chuỗi không bao giờ khớp lại giữa các lần. Khoá chính `zalo_identities.zalo_id` mà sai thì hoặc hai người dùng chung một `user_id` (rò dữ liệu), hoặc tạo trùng tài khoản. Đây là lỗi toàn vẹn danh tính, không phải thẩm mỹ.
- Cách sửa: chỉ nhận `id` là chuỗi; số chỉ nhận khi `Number.isSafeInteger`, ngược lại ném `ZaloAuthError('UNAVAILABLE')` (hoặc `INVALID_TOKEN`; chọn một, ghi test). Cập nhật ca test. Task G2.

### Nên sửa (trước khi deploy; không chặn việc giữ code trên nhánh)

**N1. Timeout 8 giây không phủ phần đọc thân phản hồi.**
- File: `zaloVerifier.ts`, `finally { clearTimeout(timer) }` chạy ngay sau `fetchFn` trả header, rồi `res.json()` đọc thân không còn timer.
- Lý do: Zalo (hoặc proxy) gửi header rồi trì hoãn thân sẽ giữ yêu cầu đến giới hạn tổng của Edge Function; đây là điểm khuếch đại khi không có rate limit (R3).
- Sửa: giữ timer đến sau `res.json()` (clear trong `finally` của khối bao cả hai), ca test bằng fetch giả trả thân treo. Task G2.

**N2. Tên secret không thống nhất.** `scripts/spikes/s1-zalo-me.mjs` (dòng 8, 24, 63, 119) và `docs/spikes/s1-auth-zalo.md` (dòng 29, 32, 58, 97) dùng `ZALO_SECRET_KEY`; `index.ts`, `handler.test.ts`, `docs/app-supabase-setup.md` (dòng 31-32, 62, 229) dùng `ZALO_APP_SECRET`.
- CHỐT: `ZALO_APP_SECRET` là tên duy nhất (tên secret của Supabase function, đã nằm trong plan D2/T-F2/U4, mã và test; Supabase cấm tiền tố `SUPABASE_` nên `ZALO_` an toàn). Script spike đọc cùng tên này.
- Sửa: Task G1 (đổi tên, bỏ câu "hai tên phải thống nhất" trong setup, không đổi hành vi script: vẫn tuỳ chọn ở S1 để thử biến thể có/không `secret_key`).

**N3. Workflow có thể deploy function từ nhánh khác `main`.** `.github/workflows/deploy.yml` job `functions` (dòng ~187) không kiểm `github.ref`; `workflow_dispatch` chạy trên nhánh `wip/auth-zalo-ports` sẽ `supabase functions deploy auth-zalo` (job `zalo` thì có kiểm `refs/heads/main`). Tức nhánh chờ KHÔNG an toàn nếu ai bấm Run workflow trên nhánh đó.
- Sửa: thêm `github.ref == 'refs/heads/main'` vào `if:` của job `functions` (và `migrate` nếu cùng lý do). Cần người dùng đồng ý riêng vì plan cấm sửa `deploy.yml`; Task G3. Trong lúc chưa sửa: không dispatch workflow trên nhánh wip.

**N4. CI không chạy `tsc -p supabase/functions/tsconfig.json`.** `npm test` chạy test Vitest của function nhưng `npm run typecheck` (`tsc --noEmit`) không bao `supabase/functions`; `build` cũng vậy. Lỗi kiểu trong function sẽ không bị CI bắt. Sửa: thêm bước vào `ci.yml` hoặc script `typecheck:functions` trong `package.json`. Task G3.

**N5. Throttle verifyOtp theo IP (rủi ro mới, R12).** Mọi lần đăng nhập đều gọi `generateLink` + `verifyOtp` từ cùng IP đi ra của Edge Functions; GoTrue có giới hạn kiểm token theo IP (mặc định cỡ vài chục lần / 5 phút / IP, cần xác nhận số trên dashboard Authentication > Rate Limits). Ở quy mô thật, đăng nhập có thể bị giới hạn chung. Không chặn v1 (người dùng ít), nhưng S1 phải đo/đọc giá trị, và nếu cần thì nâng giới hạn hoặc đổi cách cấp phiên. Ghi vào bảng rủi ro của plan khi plan được sửa.

**N6. Phân biệt "Zalo từ chối vì secret sai" với "token sai".** `zaloVerifier` coi 400/401/403 đều là `INVALID_TOKEN`. Nếu `ZALO_APP_SECRET` sai/hết hạn, MỌI người dùng nhận 401 "token không hợp lệ" và log chỉ ghi "token Zalo không hợp lệ": khó chẩn đoán. Sửa nhỏ: verifier nhận `onEvent?(name, { status, zaloError })` (chỉ status và mã lỗi Zalo, không token/secret), handler/`index.ts` log. Nên làm sau S1 (khi biết Zalo phân biệt lỗi thế nào). Gộp vào đợt sửa sau S1.

### Gợi ý

- G-a. `handler.ts`: `405` dùng mã `METHOD_NOT_ALLOWED`, không có trong danh sách D1; vô hại, sửa D1 hoặc bỏ qua.
- G-b. `userStore`: nếu function bị giết (timeout nền tảng) giữa `createUser` và `insert profiles`, `auth.users` mồ côi (email `zalo-*@zalo.gymer.invalid`, không có `zalo_identities`). `cleanupUser` chỉ chạy khi lỗi bắt được. Chấp nhận v1; thêm một truy vấn kiểm kê vào `docs/app-supabase-setup.md` (liệt kê `auth.users` email `%@zalo.gymer.invalid` không có hàng `zalo_identities`).
- G-c. `ServicesProvider.tsx`: `useMemo(() => createServices(env, ...))` luôn chạy dù prop `services` đã truyền; ở `VITE_DATA_SOURCE=supabase` sẽ dựng thừa một client Supabase trong test/gallery. Sửa: chỉ tạo khi `services === undefined` (đặt điều kiện trong `useMemo`). Task G4 (nhỏ, an toàn merge).
- G-d. `sessionRepo.signOut` dùng `scope: 'local'`: token cũ còn hiệu lực đến hết hạn trên server. Chấp nhận v1; nêu trong tài liệu.
- G-e. `avatarUrl` chỉ kiểm `https`, không giới hạn host; UI `<img>` sẽ tải URL do Zalo trả (rủi ro theo dõi, thấp). Chấp nhận; nếu muốn chặt, cho phép danh sách host của Zalo sau S1.
- G-f. CORS `*` + `Allow-Headers: content-type, authorization, apikey, x-client-info`: phù hợp token trong body, không cookie. Smoke test từ webview Zalo thật vẫn là cổng cuối (preflight có thể đòi header khác).

## 4. Kiểm riêng theo trọng tâm bảo mật `auth-zalo`

- Mạo danh qua token app khác (R2): CHƯA ĐÓNG, xem B1.
- Không tin id từ client: ĐẠT. `readToken` chỉ đọc `zaloAccessToken`; `zaloId`, tên, ảnh chỉ đến từ `verifier.verify`. Test khẳng định thân có `zaloId`/`userId` giả bị bỏ qua.
- Fail-closed thiếu secret: ĐẠT. `index.ts` liệt kê biến thiếu, `handler` trả `500 CONFIG_MISSING` trước khi đọc thân hay gọi port; preflight và 405 vẫn trả được. `UNUSED_*` ports đảm bảo không chạm. Giá trị rỗng coi là thiếu. Test phủ.
- Secret/token không vào log/response: ĐẠT. Handler chỉ log tên lỗi (`errorName`), `userId`, `created`, tên biến thiếu; `StoreError`/`SessionIssueError` chỉ mang bước và mã; verifier không nối thông báo gốc; `secret_key` chỉ đi trong header tới Zalo; test khẳng định thân phản hồi và mọi lần `log` không chứa token. Phản hồi thành công có token phiên (đúng hợp đồng), `Cache-Control: no-store`.
- Tạo user đua: ĐẠT. Thua `23505` thì xoá `auth.users` vừa tạo (cascade `profiles`) rồi trả user thắng; có ca `identity_race_unresolved`. Khoá `zalo_identities.user_id unique` khớp.
- Xoá user mồ côi: ĐẠT với lỗi bắt được (profile/identity); chưa phủ trường hợp function bị giết, xem G-b.
- Email giả `zalo-<uuid>@zalo.gymer.invalid`: dùng `crypto.randomUUID()` không đoán được, không gửi email thật (`generateLink` không gửi). `.invalid` có được GoTrue nhận hay không là S1. Không rò rỉ người dùng qua email.
- magiclink + `verifyOtp`: ĐẠT về cấu trúc: admin client và anon client tách biệt, cả hai `persistSession: false`, `autoRefreshToken: false` (phiên anon không nhiễm sang admin); thiếu `hashed_token`/`session` thì ném và handler trả 500. Hành vi thật (cấp refresh token, chạy khi tắt đăng ký, throttle IP) chờ S1/N5.
- Service role chỉ trong function: ĐẠT. Chỉ `index.ts` (Deno) đọc `SUPABASE_SERVICE_ROLE_KEY`; `src/` không có; CI chặn `service_role` trong `dist`. Tên env `SUPABASE_*` là giả định R6 (S1).
- CORS: chấp nhận được, xem G-f. Mọi phản hồi (kể cả 405, lỗi) có CORS qua `json()`.
- Giới hạn thân / timeout: thân ≤ 4 KB kiểm cả `content-length` lẫn đọc luồng có chặn (đúng, không đọc hết thân lớn); token 10-2048; verifier có timeout 8 giây nhưng chưa phủ thân phản hồi, xem N1. Không rate limit (R3, đã chấp nhận).
- `verify_jwt = false`: `config.toml` đúng khối `[functions.auth-zalo]`; hiệu lực qua `supabase functions deploy` đọc `supabase/config.toml`, chưa kiểm thực tế (R1), kiểm ở dashboard sau deploy.

Kiểm riêng nghiệp vụ (phạm vi repository): chống đặt trùng lịch, giá T7/CN, RLS, quyền: không đổi so với review 2; `profileRepo` chỉ ghi cột được phép (`display_name`, `bio`, `area_label`) trên `gymer_profiles` với `.eq('user_id', uid)`, tags chèn thiếu trước rồi xoá thừa, patch rỗng không ghi, không phải Gymer -> `NOT_FOUND`: ĐẠT. `sessionRepo`: token không vào `cause` (chỉ `name/status/code`), không `setSession` khi function lỗi, kiểm `user.id` khớp `user_id`, `getSession` cục bộ: ĐẠT. `createServices`: nhánh `mock` giữ nguyên `NOT_IMPLEMENTED` (cả `session`), thiếu `auth` chỉ làm `signIn` ném `UNKNOWN`, không crash khi khởi tạo: ĐẠT.

## 5. Phán quyết merge

### Được merge lên `main` ngay (không chạm deploy production)
Nội dung này không gọi function nào và chưa màn hình nào dùng `useServices` (trang giữ chỗ), nên không đổi hành vi người dùng:
- `src/services/supabase/profileRepo.ts` + `.test.ts`, `sessionRepo.ts` + `.test.ts`
- `src/services/createServices.ts` + `.test.ts`, `src/providers/ServicesProvider.tsx` + `ServicesProvider.test.tsx`
- `docs/app-supabase-setup.md` (sau G1; tài liệu ghi rõ function chưa deploy)
- `scripts/spikes/*` và `docs/spikes/*` (sau G1)
- `docs/plans/*` (kể cả file này)
Điều kiện: làm G1 trước khi commit (một commit), và đừng đặt `VITE_DATA_SOURCE=supabase` ở production cho đến khi có UI + function (hiện vô hại vì chưa UI gọi, nhưng `signIn` sẽ lỗi nếu có người gọi).

### Phải ở nhánh `wip/auth-zalo-ports` cho đến khi S1 xong và B1/B2 đóng
- `supabase/functions/auth-zalo/*` (handler, ports, adapters, index, test), `supabase/functions/_shared/*`, `supabase/functions/tsconfig.json`
- `supabase/config.toml` (khối `[functions.auth-zalo]` đứng cạnh function mà nó cấu hình; đưa lên một mình thì vô nghĩa, tách thêm không có lợi)
- Lý do: `deploy.yml` deploy MỌI thư mục trong `supabase/functions/` (trừ `_*`) khi push `main`; hôm nay `main` chưa có function nào. Merge sẽ đưa `auth-zalo` chưa được kiểm S1 vào production.
- Lưu ý N3: nhánh wip cũng không an toàn nếu ai đó chạy `workflow_dispatch` trên nhánh đó cho đến khi G3 áp dụng. Nếu chưa muốn sửa `deploy.yml`, giữ nhánh ở local/không đẩy lên remote, hoặc không bấm Run workflow trên nhánh đó.
- Điều kiện merge sau này (kiểm lại bởi sen1, review 3a lần 2): (1) S1 điền xong, R2 trả lời, thay các comment `S1:` bằng sự thật; (2) G2 xong; (3) G3 (ít nhất ref guard) xong; (4) người dùng đặt `ZALO_APP_SECRET` (U4) trước khi push; (5) sau deploy kiểm dashboard `auth-zalo` JWT tắt và chạy smoke test.

## 6. Task sửa nhỏ

Mỗi task tự chứa. Quy ước chung (xem mục 3 của plan): comment tiếng Việt có dấu, không commit/push, không thêm dependency, chạy `npm run lint`, `npm run typecheck`, `npm test`, `npx tsc -p supabase/functions/tsconfig.json`.

**G1 (dev1): thống nhất tên secret `ZALO_APP_SECRET`** (an toàn merge `main`)
- File: `scripts/spikes/s1-zalo-me.mjs`, `docs/spikes/s1-auth-zalo.md`, `docs/app-supabase-setup.md`.
- Việc: đổi mọi `ZALO_SECRET_KEY` thành `ZALO_APP_SECRET` (script: dòng 8, 24, 63, 119; spike doc: 29, 32, 58, 97). Giữ hành vi (biến tuỳ chọn ở S1, biến thể B bỏ qua khi thiếu). Trong setup, xoá câu "Hai tên phải thống nhất" (dòng 31-32), dòng 229 chuyển thành "đã chốt `ZALO_APP_SECRET`; còn lại chờ S1: có cần secret hay không". Thêm vào setup một truy vấn kiểm kê user mồ côi (G-b: `auth.users` email `%@zalo.gymer.invalid` không có hàng `zalo_identities`) và một dòng "không bấm Run workflow trên nhánh chứa function chưa merge".
- Tiêu chí: `git grep ZALO_SECRET_KEY` rỗng; `node --check` hai script sạch; chạy script không biến môi trường vẫn thoát mã khác 0 và không in gì nhạy cảm; lint xanh.
- Phụ thuộc: không.

**G2 (dev2): sửa `zaloVerifier` (B2, N1)** (nhánh wip)
- File: `supabase/functions/auth-zalo/adapters/zaloVerifier.ts`, `supabase/functions/auth-zalo/adapters/adapters.test.ts`.
- Việc: (1) `parseZaloMe`: `id` chuỗi giữ nguyên; `id` số chỉ nhận khi `Number.isSafeInteger`, ngược lại ném `ZaloAuthError('UNAVAILABLE')`; sửa ca test "chấp nhận id số" và thêm ca `9007199254740993` (hoặc số lớn hơn safe integer) bị từ chối, ca chuỗi dài 19 chữ số giữ nguyên. (2) Đưa `clearTimeout` ra sau `res.json()` (khối try/finally bao cả fetch lẫn đọc thân); thêm ca test fetch giả trả `Response` có thân không bao giờ kết thúc, `timeoutMs` nhỏ, kỳ vọng `ZaloAuthError('UNAVAILABLE')`. Không đổi chữ ký export hiện có.
- Tiêu chí: test mới xanh; `tsc -p supabase/functions/tsconfig.json` exit 0; không đọc/ghi file khác.
- Phụ thuộc: không; song song G1, G3, G4.

**G3 (dev3): CI typecheck function và ref guard** (cần người dùng đồng ý vì chạm `deploy.yml`; nên đi cùng nhánh wip hoặc commit riêng lên `main`)
- File: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (chỉ dòng `if:` của job `functions`, và `migrate` nếu cùng điều kiện), `package.json` (chỉ thêm script `typecheck:functions`: `tsc -p supabase/functions/tsconfig.json`).
- Việc: thêm bước CI chạy `npm run typecheck:functions` sau typecheck hiện có (chỉ khi thư mục `supabase/functions/tsconfig.json` tồn tại, để không vỡ khi chạy trên `main` chưa có function); thêm `github.ref == 'refs/heads/main'` vào `if:` job `functions`.
- Tiêu chí: YAML hợp lệ (đọc lại bằng mắt, không chạy được Actions ở đây); không đổi các job `zalo`; báo rõ phần không kiểm được.
- Phụ thuộc: hỏi người dùng trước khi giao (plan cấm sửa `deploy.yml`).

**G4 (dev1): `ServicesProvider` tạo lazy** (an toàn merge `main`)
- File: `src/providers/ServicesProvider.tsx`, `src/providers/ServicesProvider.test.tsx`.
- Việc: trong `useMemo`, trả `undefined` khi prop `services` đã có; chỉ gọi `createServices` khi chưa có (dependency gồm `services` và `platform`). Thêm ca test: truyền `services` thì `createServices` không được gọi (mock module).
- Tiêu chí: 3 lệnh xanh; test cũ không đổi hành vi.
- Phụ thuộc: không.

**G5 (sen1, sau S1): review lại 3a lần 2** — đối chiếu bảng kết quả S1 với từng comment `S1:` (`zaloVerifier` endpoint/header/mã lỗi, `userStore` email `.invalid`, `sessionIssuer` magiclink, `index.ts` tên env, `sessionRepo` hợp đồng), N5 (throttle), N6 (phân biệt lỗi secret). Chỉ khi đó mới đổi phán quyết nhánh wip.

Ma trận file (không trùng): G1 {scripts/spikes/s1-zalo-me.mjs, docs/spikes/s1-auth-zalo.md, docs/app-supabase-setup.md}; G2 {auth-zalo/adapters/zaloVerifier.ts, adapters.test.ts}; G3 {ci.yml, deploy.yml, package.json}; G4 {providers/ServicesProvider*}. Chạy song song được.

## 7. Thứ tự đề xuất

1. G1 + G4 song song -> commit lên `main` phần mục 5 "ngay" (người dùng/PM commit; sen1 không commit).
2. Tạo nhánh `wip/auth-zalo-ports` cho phần functions + `config.toml`; G2 trên nhánh đó; G3 khi người dùng đồng ý.
3. Người dùng chạy S1 -> điền bảng -> G5 -> sửa theo kết quả -> U4 (đặt secret) -> merge nhánh wip -> smoke test (U6).
