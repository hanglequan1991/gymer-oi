Trạng thái: ĐÃ APPROVE (người dùng chấp nhận Q2, Q8, Q9, Q10 mặc định, 2026-10-10)

# Plan: nối app với backend Supabase thật (auth-zalo + repository Supabase)

Người lập: sen1. Ngày: 2026-10-10. Căn cứ: `docs/plans/supabase-schema-v1.md` (mục 2.1 auth, 2.3 tìm theo bán kính), `docs/plans/schema-v1-review-dot-d2.md` (mục 5, mã lỗi RPC), `docs/project-structure.md` (2.5 DTO/mapper, 2.6 env, 3.3 edge function), `docs/supabase-migrations.md` (mục function), `.github/workflows/deploy.yml`, migration M1-M9/M7b, `src/services/*`, `src/platform/*`, `src/services/supabase/database.types.ts`.

Điều đã kiểm trong repo khi lập plan (để dev không phải đoán):
- `src/features/*/pages/*` hiện chỉ là trang giữ chỗ (10-13 dòng, chỉ có `AppHeader`). Chưa có màn hình nào gọi `useServices`. Plan này vì vậy chỉ làm tầng services + auth; KHÔNG nối UI.
- `createServices(env)` hiện trả `NOT_IMPLEMENTED` cho cả `mock` lẫn `supabase`. `Services` có 5 nhóm: `gymers, schedule, bookings, requests, profile`. Chưa có chỗ nào giữ phiên đăng nhập.
- `AuthPort.login()` trả `{ zaloAccessToken }` (zmp-sdk `login` rồi `getAccessToken`). `StoragePort` là JSON bất đồng bộ bọc `nativeStorage`.
- DB: slot không có id (khoá là `(gymer, day, start_time)`, giờ Việt Nam, đúng giờ chẵn, 60 phút); RPC `create_booking` BẮT BUỘC `p_expected_price` nhưng `BookingCreateInput` hiện KHÔNG có trường giá; `get_month_calendar` nhận `p_month` 1-12 (khớp `MonthCalendar`, không khớp `utils/date` 0-based); `search_gymers` không trả `bio`, `get_day_slots` chỉ trả tên khách cho chính Gymer.
- Quyền ghi trực tiếp (grant theo cột, M6): client chỉ `update` được `price_*`, `bio`, `display_name`, `area_label`... của hồ sơ mình; `gymer_slot_overrides` chỉ có `insert(gymer_id, day, start_time, is_open)` và `update(is_open)`. Hệ quả cho upsert: xem quyết định D7.

## 1. Mục tiêu và phạm vi

Mục tiêu: app chạy với `VITE_DATA_SOURCE=supabase` có đăng nhập Zalo thật và mọi repository đã có giao diện (`gymers`, `schedule`, `bookings`, `requests`, `profile`) hoạt động trên DB thật, đúng quy tắc nghiệp vụ đã chốt ở server (chống trùng lịch, giá T7/CN, RLS).

Làm:
1. Spike S1 (xác minh token Zalo + cấp phiên Supabase) và edge function `auth-zalo`, deploy qua job `functions` đã có.
2. Cài đặt `SupabaseClient` có kiểu (`Database`), adapter lưu phiên, dịch vụ phiên (`session`), và 5 repository Supabase thay cho `NOT_IMPLEMENTED`; mapper lỗi (`appErrorFromRpc`) và `isExpired` được dùng đúng chỗ.
3. Test đơn vị bằng client giả (không gọi mạng); test handler của function bằng port giả.
4. Tài liệu thiết lập + checklist smoke test thủ công cho người dùng.

KHÔNG làm (nói rõ để khỏi lẫn):
- Nối UI/hook/route vào services, màn hình đăng nhập, `SessionGate`. Màn hình còn là trang giữ chỗ; làm sau khi designer bàn giao và có plan UI riêng.
- `resolve-location` (S2, đổi token `getLocation()` thành toạ độ). `gymers.search` nhận `center` từ người gọi như giao diện hiện tại.
- Chế độ `mock`: giữ nguyên hành vi hiện tại (mọi phương thức ném `NOT_IMPLEMENTED`). Không viết repository mock từ `src/mocks`.
- Chức năng chưa có trong giao diện repository: danh sách lượt đặt của khách, huỷ lịch (`cancel_booking`), viết đánh giá (`create_review`), đăng ký làm Gymer (tạo `gymer_profiles`, `gymer_locations`), quản lý khung giờ mẫu (`gymer_open_hours`). RPC đã có nhưng cần mở rộng giao diện cùng với thiết kế màn hình. Xem câu hỏi Q7.
- Thông báo đẩy, thanh toán, rate limit thật cho `auth-zalo` (xem rủi ro R3).
- Sửa migration/RLS. Nếu dev phát hiện thiếu quyền hoặc thiếu RPC, báo lại, KHÔNG tự thêm migration.
- Sửa `.github/workflows/deploy.yml`, `src/services/errors.ts`, `src/services/supabase/database.types.ts` (sinh tự động).

## 2. Quyết định kiến trúc

### 2.1 Luồng đăng nhập (D1-D4)

D1. Một edge function `auth-zalo`, `verify_jwt = false` (chưa có phiên lúc gọi). Hợp đồng cố định (task và client dựa vào đây):
- Yêu cầu: `POST` JSON `{ "zaloAccessToken": string }`, thân tối đa 4 KB, token 10-2048 ký tự sau trim.
- Thành công `200`: `{ "access_token", "refresh_token", "expires_in" (số giây), "user_id" }`.
- Lỗi: `{ "error": { "code": ... } }` với `400 INVALID_REQUEST`, `401 ZALO_TOKEN_INVALID`, `502 ZALO_UNAVAILABLE`, `500 CONFIG_MISSING` hoặc `INTERNAL`. `405` cho phương thức khác POST, `204` cho `OPTIONS` (CORS `*`, token nằm trong body, không dùng cookie).
- Client ánh xạ: 400 -> `VALIDATION`; 401 -> `UNAUTHENTICATED`; 502 hoặc lỗi mạng -> `NETWORK`; còn lại -> `UNKNOWN`.
- Không bao giờ log hoặc trả lại `zaloAccessToken`, `access_token`, `refresh_token`.

D2. `zaloId` chỉ lấy từ phản hồi của Zalo khi function tự gọi bằng token (không tin `zaloId` client gửi). Tên và ảnh cũng lấy từ phản hồi đó (không tin dữ liệu client). Endpoint, header (có cần secret key của Mini App không), và phạm vi `id` (theo từng Mini App hay toàn cục) là SPIKE S1, không khẳng định trong plan.

D3. Tạo/ghép tài khoản (đặt trong `UserStore`, dùng service role):
- Tìm `zalo_identities` theo `zalo_id` -> có thì dùng `user_id`.
- Chưa có: `auth.admin.createUser({ email: "zalo-<uuid-ngẫu-nhiên>@<miền>.invalid", email_confirm: true })` (định dạng email chốt ở S1), rồi `insert profiles(id, display_name, avatar_url)`, rồi `insert zalo_identities(zalo_id, user_id)`.
- Đua hai lần đăng nhập đầu cùng lúc: khoá chính `zalo_identities.zalo_id` thắng; bên thua bắt lỗi trùng khoá (`23505`), xoá `auth.users` vừa tạo (cascade xoá `profiles`), rồi dùng `user_id` của bên thắng. Lỗi giữa chừng thì dọn `auth.users` mồ côi (best effort, có log).
- Đăng nhập lần sau KHÔNG ghi đè `display_name` (người dùng có thể đã sửa).

D4. Cấp phiên THẬT (có refresh token) bằng `auth.admin.generateLink({ type: "magiclink", email })` lấy `hashed_token`, rồi một client anon gọi `auth.verifyOtp({ token_hash, type: "magiclink" })` ngay trong function; trả `access_token/refresh_token` cho client, client gọi `supabase.auth.setSession`. Đây là giả thuyết cần S1 xác nhận (kể cả khi tắt đăng ký email mà vẫn chạy). Phương án đã loại giữ như plan schema: tự ký JWT (không có refresh, lệch cơ chế khoá ký), mật khẩu suy ra từ Zalo ID (đoán được), `zaloId` làm khoá chính (mất `auth.uid()`). Nếu S1 cho thấy magiclink không chạy: dừng, báo lại sen1 để đổi plan (không tự chọn tự ký JWT).

Thiết kế để kiểm thử được mà không cần Deno ở môi trường này (không có `deno` trong máy dev, đã kiểm `which deno`):
- `supabase/functions/auth-zalo/handler.ts`: hàm thuần `handleAuthZalo(req: Request, deps)` chỉ phụ thuộc 3 port trong `ports.ts` (`ZaloVerifier`, `UserStore`, `SessionIssuer`) và cấu hình truyền vào. KHÔNG import `Deno.*`, `npm:`, `jsr:`. Vitest (Node) chạy được.
- `supabase/functions/auth-zalo/adapters/*.ts`: cài đặt port, nhận client qua interface cấu trúc tối thiểu (không import thư viện supabase), nên cũng test được bằng client giả.
- `supabase/functions/auth-zalo/index.ts`: lớp mỏng duy nhất dùng `Deno.serve`, `Deno.env`, `npm:@supabase/supabase-js@2.117.3` (cùng bản ghim với app). Không test cục bộ được; kiểm bằng smoke test sau deploy.
- Thiếu secret bắt buộc -> `500 CONFIG_MISSING`, KHÔNG chạy tiếp (job `functions` deploy function ngay cả khi người dùng chưa đặt secret).

### 2.2 Tầng services phía app (D5-D10)

D5. Cấu trúc file (theo `docs/project-structure.md` 2.5, mapper là chỗ DUY NHẤT biết kiểu DB lẫn kiểu domain):
```
src/services/supabase/client.ts          createSupabaseClient(env, storage?)
src/services/supabase/storageAdapter.ts  StoragePort -> SupportedStorage của supabase-js
src/services/supabase/postgrestError.ts  toAppError(error), unwrap(result)
src/services/supabase/userId.ts          requireUserId(client)
src/services/supabase/gymerRepo.ts       createGymerRepo(client, deps)
src/services/supabase/scheduleRepo.ts
src/services/supabase/bookingRepo.ts
src/services/supabase/requestRepo.ts
src/services/supabase/profileRepo.ts
src/services/supabase/sessionRepo.ts
src/services/mappers/{gymer,schedule,request}.ts   hàm thuần, có test
src/test/fakeSupabase.ts                 client giả dùng chung cho test
```
`createServices(env, deps?)` là composition root: `deps = { storage?: StoragePort; auth?: AuthPort; client?: SupabaseClient<Database>; now?: () => Date }`. `client` cho phép test tiêm client giả. Nhánh `mock` giữ nguyên. `ServicesProvider` lấy `storage` và `auth` từ `PlatformContext` (đọc Context nullable, không dùng `usePlatform()` ném lỗi, để test không có `PlatformProvider` vẫn chạy).
Lý do: một điểm chọn nguồn dữ liệu duy nhất, tiêm được để test, không đổi `Services` ngoài việc thêm `session`.
Loại: gọi `supabase.from()` trong hook (lộ kiểu DB ra UI, không test được); client toàn cục singleton import trực tiếp (không tiêm được).

D6. Thêm nhóm `session` vào `Services` (`SessionRepository`):
```ts
interface SessionRepository {
  signIn(): Promise<{ userId: string }>;            // platform.auth.login -> auth-zalo -> setSession
  getSession(): Promise<{ userId: string } | null>; // đọc phiên cục bộ, không gọi mạng
  signOut(): Promise<void>;
}
```
Phiên lưu qua `storageAdapter` vào `StoragePort` (nativeStorage), có dự phòng bộ nhớ nếu lưu lỗi; `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`. Khi RPC trả `UNAUTHENTICATED` (phiên hết/refresh lỗi), tầng gọi (UI/hook, plan sau) gọi lại `signIn()`; repository KHÔNG tự đăng nhập lại ngầm (tránh vòng lặp và nuốt lỗi).
Lý do không lưu phiên mà đăng nhập lại mỗi lần mở app: tốn một lượt gọi Zalo + function mỗi lần mở; nhưng nếu `nativeStorage` hỏng thì dự phòng này vẫn chạy được. Rủi ro R5.

D7. Quy ước từng repository (đã đối chiếu RPC/RLS):
- `gymers.search`: `rpc("search_gymers", { p_lat, p_lng, p_radius_km, p_keyword, p_specialty })`. Làm tròn `center` 3 chữ số trước khi gửi (quyết định riêng tư ở plan schema 2.3). `keyword` rỗng hoặc chỉ khoảng trắng -> không gửi; cắt còn 50 ký tự. Map: `user_id -> id`, `display_name -> name`, `area_label -> area`, `distance_km -> distanceKm`, `rating_avg -> rating`, `rating_count -> reviewCount`, `price_* -> priceWeekday/priceWeekend`, `bio = ''` (RPC không trả `bio`; chỉ `getDetail` có).
- `gymers.getDetail`: một truy vấn `gymer_profiles` có embed `gymer_specialties(specialty_name)`, `certificates(id,name)`, `reviews(id,author_name,rating,body,created_at)` (reviews: mới nhất trước, tối đa 20). Không có hàng (RLS ẩn hoặc không tồn tại) -> `NOT_FOUND`. `age = năm hiện tại giờ VN - birth_year`. `distanceKm = 0` (không có nguồn; câu hỏi Q5). `Review.dateLabel` dùng `formatDateVN` của `utils/format`. Chứng chỉ: tên tự khai, UI gắn nhãn.
- `schedule.getMonth(gymerId, year, month)`: `month` là 1-12 (khớp `MonthCalendar` và RPC), ghi vào JSDoc. `rpc("get_month_calendar")`. `DayInfo.date` dựng bằng `new Date(y, m-1, d)` từ chuỗi `YYYY-MM-DD` (KHÔNG `Date.parse`, tránh lệch múi giờ). `price = price_vnd` (server đã tính T7/CN theo ngày Việt Nam; client KHÔNG tự tính giá). `marker`: `has_booked ? "booked" : is_open ? "open" : "none"`; `disabled = !is_open && !has_booked`.
- `schedule.getDaySlots(gymerId, dateIso)`: `rpc("get_day_slots")`. `Slot.id = "<dateIso>T<HH:mm>"` (giờ Việt Nam; ví dụ `2026-10-17T07:00`), `time = HH:mm` (cắt từ `HH:MM:SS`), `state` giữ `available|booked|closed`, `bookedBy = booked_by ?? undefined`.
- `schedule.setPrices`: kiểm số nguyên 0..5.000.000 phía client (`VALIDATION`), rồi `update gymer_profiles set price_weekday_vnd, price_weekend_vnd where user_id = <uid> ... select()`; 0 hàng -> `NOT_FOUND` (không phải Gymer).
- `schedule.setSlotClosed(slotId, closed)`: tách `slotId` (sai định dạng -> `VALIDATION`). KHÔNG dùng `upsert` của supabase-js: nó sinh `ON CONFLICT DO UPDATE SET` cho mọi cột trong payload, mà client chỉ có quyền update cột `is_open` -> bị từ chối quyền (`42501`). Cách làm: `update ... set is_open = !closed where (gymer_id, day, start_time) ... select()`; 0 hàng -> `insert`; nếu `insert` báo trùng (`23505`) thì `update` lại một lần. Trigger `SLOT_HAS_BOOKING` -> `VALIDATION` (đúng bảng mã đã chốt).
- `bookings.create`: thêm `expectedPrice: number` (bắt buộc) vào `BookingCreateInput` (thay đổi hợp đồng nhỏ; chưa có chỗ gọi nên không vỡ). `rpc("create_booking", { p_gymer_id, p_starts_at: startIso, p_goal: goal ?? "", p_health_note: note ?? "", p_expected_price, p_share_health_note: shareHealthNote ?? false })` (kiểu sinh ra không cho `null`; server `nullif(btrim(...))`). `endIso` server bỏ qua (luôn +60 phút): repository ném `VALIDATION` nếu `end - start !== 60 phút` thay vì lặng lẽ bỏ. Trả `{ bookingId }`. Mọi lỗi nghiệp vụ (`SLOT_TAKEN`, `SLOT_NOT_OPEN`, `PRICE_CHANGED`, `LIMIT_REACHED`...) đi qua `appErrorFromRpc`.
- `requests.list(filter?)`: `bookings` có `gymer_id = <uid>`, embed `profiles!bookings_customer_id_fkey(display_name)` và `booking_health_notes(note)`; `status in (pending, confirmed, rejected)` (hoặc đúng `filter.status`), sắp theo `starts_at` tăng, tối đa 100. `pending` mà `isExpired(status, expires_at, now)` -> loại khỏi danh sách (câu hỏi Q4). `note` chỉ có khi khách đã đồng ý chia sẻ (RLS tự ẩn; embed trả `null`) -> `note = undefined`. Mapper chịu được embed 1-1 trả object hoặc mảng. `isNew` không đặt (Q3).
- `requests.respond(id, decision)`: `rpc("respond_booking")`, rồi đọc lại đúng hàng đó bằng cùng truy vấn/mapper để trả `BookingRequest`.
- `profile.getMine`: `uid = requireUserId`, rồi `gymers.getDetail(uid)` (Gymer xem được hồ sơ của mình qua policy `user_id = auth.uid()`); không phải Gymer -> `NOT_FOUND`.
- `profile.updateMine(patch)`: `update gymer_profiles` (`name -> display_name`, `bio`, `area -> area_label`) + đồng bộ `tags` với `gymer_specialties` bằng chèn phần thiếu TRƯỚC rồi xoá phần thừa (không nguyên tử; nếu bước giữa lỗi, trạng thái vẫn hợp lệ, chỉ dư tag). Trả `Gymer` mới đọc lại. Tên chuyên môn lạ -> lỗi khoá ngoại -> `VALIDATION`.

D8. Lỗi. `unwrap()` dùng `appErrorFromRpc(error.message, error)` cho lỗi do `raise exception` (SQLSTATE `P0001`). Thêm trong `postgrestError.ts` (không sửa `errors.ts`): lỗi mạng/`fetch` -> `NETWORK`; JWT hết hạn hoặc thiếu (`PGRST301`, HTTP 401) -> `UNAUTHENTICATED`; `42501` (không đủ quyền/RLS) -> `FORBIDDEN`; `23514`/`23503`/`22xxx` (vi phạm check/khoá ngoại/kiểu) -> `VALIDATION`; `PGRST116` (một hàng mong đợi nhưng không có) -> `NOT_FOUND`; còn lại -> `UNKNOWN`. Message gốc giữ làm `cause` cho log, UI chỉ hiện câu theo `code` (`i18n/errors.ts`).

D9. Phân quyền dựa hoàn toàn vào RLS/RPC ở server; client không lọc thay cho server (ví dụ không tự lọc `gymer_id` để "bảo mật", chỉ để chọn đúng dữ liệu của mình). Mọi truy vấn là một tài khoản `authenticated`; không có đường nào dùng service role ở client (CI đã chặn khoá `service_role`/`sb_secret_` trong bundle).

D10. Dependency: không thêm gói mới (đã có `@supabase/supabase-js` 2.117.3). Kích thước bundle: thêm thư viện vào nhánh `mock` nữa (import tĩnh). Chấp nhận; đo `dist` trước/sau ở điểm review 3 (giới hạn 3 MB mỗi file trong `scripts/ci/zalo-check.sh`; giới hạn của Zalo cho gói chưa kiểm).

### 2.3 Chiến lược test (không gọi mạng thật)

- `src/test/fakeSupabase.ts`: `createFakeSupabase(script)` trả client giả có `from(table)` (builder chuỗi `select/insert/update/delete/eq/in/order/limit/maybeSingle/single`, thenable), `rpc(name, args)`, `auth.{getSession,setSession,signOut,...}`, `functions.invoke`. Mỗi lệnh gọi được ghi vào `calls[]`; kết quả được kịch bản hoá theo `{ data, error }`. Test khẳng định đúng bảng, bộ lọc, payload và tên RPC. Ép kiểu `as unknown as SupabaseClient<Database>` đúng một chỗ.
- Mỗi repository: ca thành công, ca lỗi nghiệp vụ từng mã (`SLOT_TAKEN`, `SLOT_NOT_OPEN`, `PRICE_CHANGED`, `BOOKING_EXPIRED`, `LIMIT_REACHED`, `FORBIDDEN`, `NOT_FOUND`), lỗi mạng, ca 0 hàng.
- Riêng cho các điểm nghiệp vụ: `create` truyền đúng `p_expected_price` và `p_starts_at`; không bao giờ tự tính giá; `getMonth` giữ nguyên giá server cho T7/CN (ca thứ Bảy 2026-10-17 và Chủ nhật 2026-10-18 trong dữ liệu giả); `setSlotClosed` không dùng `upsert` (assert `calls` không có `upsert`); `requests.list` loại `pending` đã `isExpired`; `bookedBy` chỉ đi theo `booked_by` server trả.
- `client.test`: khởi tạo client không gọi `fetch` (stub `fetch` ném lỗi nếu bị gọi).
- Function: `handler.test.ts` bằng port giả (xem T-F1). Adapter test bằng client admin giả (T-F2).
- Cái không test được cục bộ, nói thẳng: Deno runtime của `index.ts`, hành vi thật của API Zalo, GoTrue magiclink/verifyOtp, PostgREST embed thật, CORS từ webview Zalo. Kiểm bằng S1 (trước) và smoke test thủ công (sau), checklist ở T-D.
- Cổng chất lượng mỗi task: `npm run typecheck`, `npm run lint`, `npm test` (phần của mình xanh; lỗi ngoài file của mình báo lại, không sửa).

## 3. Break-down task

Quy ước chung cho MỌI task (dev đọc kỹ, vì dev không thấy hội thoại này):
- Dự án "Gymer ơi": Zalo Mini App (React 18 + TS strict + Vite + Vitest) + Supabase. Comment và message tiếng Việt, có dấu. Không commit, không push. Không thêm dependency. Không sửa file ngoài danh sách "File được phép".
- Alias `@/` -> `src/`. ESLint cấm `src/services/**` import `react`, `zmp-ui`, `zmp-sdk`, `@/components`, `@/features`, `@/hooks`, `@/providers`, `@/stores`; cấm import tương đối sâu `../../../*`.
- Chỉ `src/services/supabase/*` và `src/services/mappers/*` được import `src/services/supabase/database.types.ts`. Không sửa file này, không sửa `src/services/errors.ts`.
- Mỗi repository là hàm tạo nhận phụ thuộc (không import singleton): ví dụ `createGymerRepo(client: SupabaseClient<Database>, deps?: { now?: () => Date }): GymerRepository`. Trả đúng interface trong `src/services/repositories/*.ts`.
- Báo cáo cuối: danh sách file, kết quả 3 lệnh typecheck/lint/test, việc không làm được.

### Đợt A (3 task song song, không trùng file)

**T-S1 (dev1): Spike S1, hai script chạy tay và tài liệu kết quả**
- Mục tiêu: để người dùng xác minh với Zalo và Supabase THẬT trước khi viết `auth-zalo`. Dev chỉ viết script và tài liệu, không chạy được (không có token thật).
- Bối cảnh: cần trả lời: (a) endpoint nào của Zalo xác minh `access_token` từ `zmp-sdk` `getAccessToken()` và trả `id`, `name`, ảnh; header nào cần (`access_token`; có cần `secret_key` của Mini App không); `id` có ổn định giữa các lần gọi không; có khác nhau giữa các Mini App không; lỗi trả ra thế nào khi token sai/hết hạn. Giả thuyết cần kiểm (KHÔNG khẳng định đúng): `GET https://graph.zalo.me/v2.0/me?fields=id,name,picture` với header `access_token`. (b) Cấp phiên Supabase: `auth.admin.createUser` (email giả) -> `auth.admin.generateLink({type:"magiclink"})` -> `auth.verifyOtp({token_hash,type:"magiclink"})` ra `access_token + refresh_token`; token đó gọi được RPC `search_gymers`? Refresh hoạt động? Còn chạy khi tắt "Allow new users to sign up"? Email dạng `x@y.invalid` có được GoTrue nhận không? `expires_in` bao nhiêu?
- File được phép: `scripts/spikes/s1-zalo-me.mjs`, `scripts/spikes/s1-session.mjs`, `docs/spikes/s1-auth-zalo.md`.
- Ràng buộc: ESM thuần Node 22, chỉ dùng `fetch` có sẵn và `@supabase/supabase-js` đã cài; đọc mọi giá trị nhạy cảm từ biến môi trường (`ZALO_ACCESS_TOKEN`, `ZALO_SECRET_KEY` tuỳ chọn, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`); thiếu biến thì thoát với thông báo rõ. KHÔNG in token, khoá, hay refresh token (chỉ in độ dài, `status`, tên trường có mặt, `expires_in`). `s1-zalo-me.mjs` thử các biến thể (có/không `secret_key`) và in bảng: HTTP status, mã lỗi Zalo, tên trường trả về. `s1-session.mjs` tạo user tạm, chạy chuỗi trên, gọi `rpc("search_gymers", {p_lat:10.77,p_lng:106.7,p_radius_km:1})` bằng phiên mới (kỳ vọng không lỗi `UNAUTHENTICATED`), thử `refreshSession`, rồi LUÔN xoá user tạm (kể cả khi lỗi). Tài liệu `docs/spikes/s1-auth-zalo.md`: cách lấy token thử (gọi `getAccessToken()` trong Mini App ở môi trường Development/simulator rồi sao chép; token là bí mật, chỉ chạy trên máy cá nhân, không dán vào chat/commit), cách chạy 2 script, bảng KẾT QUẢ để người dùng điền (các câu hỏi (a), (b) ở trên, mỗi câu một dòng: Kết quả / Ghi chú), và mục "Quyết định hệ quả" (để sen1 điền).
- Tiêu chí: `node --check` hai script sạch; `npm run lint` không lỗi mới; chạy thử không có biến môi trường -> thoát mã khác 0 với thông báo thiếu biến, không in gì nhạy cảm.
- Phụ thuộc: không. Có thể chạy song song mọi task khác.

**T-I1 (dev2): Hợp đồng giao diện (types, port, khung phiên)**
- Mục tiêu: chốt giao diện để các đợt sau không đoán. Chỉ đổi kiểu và khung, chưa cài đặt thật.
- File được phép: `src/types/domain.ts`, `src/services/index.ts`, `src/services/repositories/bookingRepository.ts`, `src/services/repositories/scheduleRepository.ts`, `src/services/repositories/sessionRepository.ts` (mới), `src/services/repositories/index.ts`, `src/services/createServices.ts`, `src/services/createServices.test.ts`, `supabase/functions/auth-zalo/ports.ts` (mới).
- Việc:
  1. `domain.ts`: thêm `'Giãn cơ'` vào `Specialty` (DB seed có 6 chuyên môn); thêm `expiresAt?: string` (ISO) vào `BookingRequest` để UI gọi `isExpired`.
  2. `BookingCreateInput`: thêm `expectedPrice: number` (VND, giá UI đã hiển thị; server so lại và ném `PRICE_CHANGED`). Sửa JSDoc `create`: nêu `endIso` phải đúng 60 phút sau `startIso`.
  3. `ScheduleRepository`: JSDoc `getMonth` ghi `month` là 1-12; JSDoc `getDaySlots` ghi `Slot.id = "<dateIso>T<HH:mm>"` giờ Việt Nam; JSDoc `setSlotClosed` ghi `slotId` theo định dạng đó.
  4. `sessionRepository.ts`: `SessionRepository { signIn(): Promise<{ userId: string }>; getSession(): Promise<{ userId: string } | null>; signOut(): Promise<void> }`. Thêm `session: SessionRepository` vào `Services`, export qua `repositories/index.ts` và `services/index.ts`.
  5. `createServices.ts`: thêm `session` (3 phương thức `notImplemented`); chữ ký thành `createServices(env: AppEnv, deps?: CreateServicesDeps)` với `CreateServicesDeps = { storage?: StoragePort; auth?: AuthPort; client?: SupabaseClient<Database>; now?: () => Date }` (dùng `import type`); hành vi vẫn là `NOT_IMPLEMENTED` cho cả hai nguồn ở bước này. Sửa `createServices.test.ts` cho 6 nhóm, thêm 3 ca `session.*`, thêm `expectedPrice` vào ca `bookings.create`.
  6. `ports.ts` (function): đúng nội dung dưới đây (không thêm gì khác):
```ts
export interface ZaloUser { zaloId: string; name: string; avatarUrl?: string }
export type ZaloAuthErrorCode = 'INVALID_TOKEN' | 'UNAVAILABLE';
export class ZaloAuthError extends Error { constructor(public code: ZaloAuthErrorCode, message?: string); }
export interface ZaloVerifier { verify(accessToken: string): Promise<ZaloUser>; } // ném ZaloAuthError
export interface UserStore {
  findUserIdByZaloId(zaloId: string): Promise<string | null>;
  createUserForZalo(user: ZaloUser): Promise<string>; // an toàn khi đua: trả user_id của bên thắng
}
export interface IssuedSession { accessToken: string; refreshToken: string; expiresIn: number }
export interface SessionIssuer { issue(userId: string): Promise<IssuedSession>; }
```
- Tiêu chí: `npm run typecheck`, `npm test` xanh (đặc biệt `createServices.test.ts` mới); `ports.ts` không import gì từ `src/`.
- Phụ thuộc: không.

**T-C1 (dev3): Hạ tầng client Supabase, lỗi, client giả**
- File được phép: `src/services/supabase/client.ts`, `client.test.ts`, `storageAdapter.ts`, `storageAdapter.test.ts`, `postgrestError.ts`, `postgrestError.test.ts`, `userId.ts`, `userId.test.ts`, `src/test/fakeSupabase.ts`, `src/test/fakeSupabase.test.ts`.
- Việc:
  1. `createSupabaseClient(env: AppEnv, storage?: StoragePort): SupabaseClient<Database>`: `env.dataSource !== 'supabase'` hoặc thiếu URL/key -> `AppError('VALIDATION', ...)`. Cấu hình `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: storage ? toAuthStorage(storage) : undefined }`.
  2. `toAuthStorage(storage: StoragePort)`: trả `{ getItem, setItem, removeItem }` bất đồng bộ (kiểu `SupportedStorage` của supabase-js; tự kiểm tra tên kiểu trong `node_modules/@supabase/auth-js` bằng Grep, không đọc cả thư viện). Giá trị là chuỗi, lưu qua `StoragePort` (JSON). Lỗi `StoragePort` KHÔNG ném ra ngoài: nuốt lỗi và dùng `Map` trong bộ nhớ làm dự phòng.
  3. `toAppError(error: unknown): AppError` và `unwrap<T>(res: { data: T | null; error: unknown }): T` theo D8 (bảng ánh xạ đầy đủ ở mục 2.2 D8). Dùng `appErrorFromRpc` từ `../errors` cho lỗi `P0001`/message có tiền tố mã. `unwrap` khi `error` null và `data` null: trả `null as T` chỉ nếu người gọi nói cho phép; cung cấp thêm `unwrapOrNull`.
  4. `requireUserId(client): Promise<string>`: `client.auth.getSession()` (không gọi mạng), không có phiên -> `AppError('UNAUTHENTICATED')`.
  5. `fakeSupabase.ts` theo mục 2.3, kèm `calls` có kiểu (`{ kind: 'from'|'rpc'|'auth'|'functions'; table?; op?; filters?; payload?; name?; args? }`).
- Ràng buộc: không import `react`. `postgrestError.ts` nhận `error` dạng cấu trúc `{ message?: string; code?: string; status?: number; name?: string }` (không phụ thuộc lớp lỗi cụ thể của thư viện).
- Tiêu chí: test phủ mọi dòng của bảng D8 (ít nhất 10 ca), `createSupabaseClient` không gọi `fetch`, adapter chịu lỗi storage, `fakeSupabase` ghi đúng `calls`. 3 lệnh xanh.
- Phụ thuộc: không.

Điểm review 1 (sen1) sau đợt A: hợp đồng giao diện (`BookingCreateInput`, `Slot.id`, `month`, `SessionRepository`, `ports.ts`), bảng ánh xạ lỗi, chất lượng `fakeSupabase`. Đợt B chỉ bắt đầu khi review 1 đạt.

### Đợt B (3 task song song; chờ review 1)

Song song với đợt B, NGƯỜI DÙNG làm U1-U3 (mục 5.2) để có kết quả S1 trước đợt C.

**T-G (dev1): Gymer mapper và repository**
- File: `src/services/mappers/gymer.ts`, `gymer.test.ts`, `src/services/supabase/gymerRepo.ts`, `gymerRepo.test.ts`.
- Việc: `createGymerRepo(client, deps?: { now?: () => Date }): GymerRepository` theo D7 (`gymers.search`, `gymers.getDetail`). Mapper thuần: `toGymerFromSearchRow(row, ...)`, `toGymerDetail(row, now)`; tuổi theo năm giờ Việt Nam (`now + 7h` rồi `getUTCFullYear`); `age` không âm; `rating` giữ số. Đọc `database.types.ts` bằng Grep theo tên hàm/bảng (`search_gymers`, `gymer_profiles`), không đọc cả file 728 dòng.
- Đọc thêm: `src/types/domain.ts`, `src/types/geo.ts`, `src/services/repositories/gymerRepository.ts`, `src/services/errors.ts`, `src/services/supabase/postgrestError.ts`, `src/test/fakeSupabase.ts`, `src/utils/format.ts` (`formatDateVN`).
- Tiêu chí: test kiểm `rpc` được gọi đúng tên và đối số (toạ độ làm tròn 3 chữ số, `keyword` rỗng không gửi, `p_radius_km` đúng); `getDetail` không có hàng -> `NOT_FOUND`; `tags` rỗng khi không có chuyên môn; `bio = ''` khi search; mapper không để `undefined`/`null` lọt vào kiểu domain.

**T-S (dev2): Schedule mapper và repository**
- File: `src/services/mappers/schedule.ts`, `schedule.test.ts`, `src/services/supabase/scheduleRepo.ts`, `scheduleRepo.test.ts`.
- Việc: `createScheduleRepo(client): ScheduleRepository` theo D7 (4 phương thức, gồm quy tắc `setSlotClosed` KHÔNG dùng upsert). Dùng `requireUserId` cho `setPrices`, `setSlotClosed`. Mapper: `toDayInfo(row)`, `toSlot(dateIso, row)`, `parseSlotId(slotId): { day: string; startTime: string }` (ném `VALIDATION`).
- Đọc thêm: `src/types/domain.ts`, `src/services/repositories/scheduleRepository.ts`, `postgrestError.ts`, `userId.ts`, `fakeSupabase.ts`; Grep `get_month_calendar`, `get_day_slots`, `gymer_slot_overrides` trong `database.types.ts`.
- Tiêu chí: test T7/CN (2026-10-17 thứ Bảy, 2026-10-18 Chủ nhật) giữ nguyên `price_vnd` server trả (mapper không có logic giá); `DayInfo.date` là ngày địa phương đúng (không lệch ngày khi múi giờ máy khác); `setSlotClosed`: nhánh update có hàng, nhánh update 0 hàng rồi insert, nhánh insert trùng `23505` rồi update lại, và `calls` không có `upsert`; `SLOT_HAS_BOOKING` -> `VALIDATION`; `setPrices` ngoài 0..5.000.000 hoặc không nguyên -> `VALIDATION` mà không gọi mạng; 0 hàng -> `NOT_FOUND`; slot id sai định dạng -> `VALIDATION`.

**T-R (dev3): Booking và Request repository**
- File: `src/services/mappers/request.ts`, `request.test.ts`, `src/services/supabase/bookingRepo.ts`, `bookingRepo.test.ts`, `src/services/supabase/requestRepo.ts`, `requestRepo.test.ts`.
- Việc: `createBookingRepo(client): BookingRepository`, `createRequestRepo(client, deps?: { now?: () => Date }): RequestRepository` theo D7. Mapper `toBookingRequest(row)`; dùng `isExpired` từ `@/utils/booking`. Select dùng chuỗi cố định dùng chung cho `list` và đọc lại sau `respond`.
- Đọc thêm: `src/types/domain.ts`, `src/services/repositories/{bookingRepository,requestRepository}.ts`, `src/utils/booking.ts`, `errors.ts` (`appErrorFromRpc`), `postgrestError.ts`, `userId.ts`, `fakeSupabase.ts`; Grep `create_booking`, `respond_booking`, `bookings` trong `database.types.ts`.
- Tiêu chí: `create` gửi đúng 6 tham số với `p_expected_price` lấy từ input (không tính lại), `endIso` lệch khác 60 phút -> `VALIDATION` không gọi mạng; mỗi mã `SLOT_TAKEN/SLOT_NOT_OPEN/PRICE_CHANGED/LIMIT_REACHED/FORBIDDEN/NOT_FOUND/VALIDATION` map đúng; `list` loại pending đã `isExpired` và không trả `cancelled/expired`; `note` undefined khi embed `null`; `respond` gọi RPC rồi đọc lại; `BOOKING_EXPIRED` đi đúng.

Điểm review 2 (sen1) sau đợt B: đối chiếu từng repository với RPC/RLS thật (mục 4 của định dạng review: chống trùng lịch, giá T7/CN, RLS, quyền, lỗi).

### Đợt C (3 task song song; T-F1 chờ S1)

**T-P (dev1): Profile repository**
- File: `src/services/supabase/profileRepo.ts`, `profileRepo.test.ts`.
- Việc: `createProfileRepo(client, gymers: GymerRepository): ProfileRepository` theo D7 (`getMine`, `updateMine`, đồng bộ `tags`). Đọc: `repositories/profileRepository.ts`, `domain.ts`, `postgrestError.ts`, `userId.ts`, `fakeSupabase.ts`; Grep `gymer_profiles`, `gymer_specialties` trong `database.types.ts`.
- Tiêu chí: patch rỗng không gọi mạng ghi; chỉ cột được phép (`display_name`, `bio`, `area_label`) trong payload; tag: chèn thiếu trước, xoá thừa sau (kiểm thứ tự trong `calls`); tag lạ -> `VALIDATION`; không phải Gymer -> `NOT_FOUND`.

**T-A (dev2): Session repository**
- File: `src/services/supabase/sessionRepo.ts`, `sessionRepo.test.ts`.
- Việc: `createSessionRepo(client, auth: AuthPort): SessionRepository` theo D6 và hợp đồng D1: `signIn` = `auth.login()` -> `client.functions.invoke('auth-zalo', { body: { zaloAccessToken } })` -> `client.auth.setSession({ access_token, refresh_token })` -> `{ userId }`. Ánh xạ lỗi: `PlatformError PERMISSION_DENIED` -> `AppError('FORBIDDEN')`; `UNAVAILABLE` -> `NETWORK`; HTTP 400/401/502/lỗi mạng của function theo D1; phản hồi thiếu trường -> `UNKNOWN`. `getSession` = `client.auth.getSession()` cục bộ. `signOut` = `client.auth.signOut({ scope: 'local' })`, không ném nếu đã không có phiên. Không log token.
- Đọc thêm: `src/platform/ports.ts`, `postgrestError.ts`, `fakeSupabase.ts`; kiểu lỗi của `functions.invoke` (`FunctionsHttpError`, `FunctionsFetchError`) bằng Grep trong `node_modules/@supabase/functions-js/dist/module/types.d.ts`. Với `FunctionsHttpError` đọc mã lỗi từ `error.context` (Response) -> JSON `error.code`.
- Tiêu chí: test thành công; token không bao giờ xuất hiện trong thông báo lỗi/`cause`; mỗi trạng thái lỗi ở D1 map đúng; không gọi `setSession` khi function lỗi; `getSession` không gọi `functions.invoke`.

**T-F1 (dev3): Handler của `auth-zalo`** (BẮT ĐẦU sau khi người dùng điền xong `docs/spikes/s1-auth-zalo.md` và sen1 ghi "Quyết định hệ quả")
- File: `supabase/functions/auth-zalo/handler.ts`, `handler.test.ts`, `supabase/functions/_shared/http.ts`, `http.test.ts`, `tsconfig.json` (chỉ thêm `supabase/functions/auth-zalo/handler.ts`, `handler.test.ts`, `ports.ts`, `supabase/functions/_shared/http.ts`, `http.test.ts` vào `include`; các adapter và `index.ts` KHÔNG thêm vì dùng thông số Deno).
- Việc: `handleAuthZalo(req: Request, deps: { verifier: ZaloVerifier; store: UserStore; issuer: SessionIssuer; log?: (msg: string, meta?: Record<string, unknown>) => void }): Promise<Response>` theo D1-D4. `http.ts`: `json(status, body)`, `CORS_HEADERS`, `preflight()`. Kiểm đầu vào: phương thức, thân JSON hợp lệ và ≤ 4 KB, token chuỗi 10-2048 ký tự; `zaloId` từ verifier phải là chuỗi không rỗng ≤ 64 ký tự; `name` trim, cắt 50 ký tự (cột `profiles.display_name` giới hạn 1-50), rỗng thì dùng "Người dùng Zalo"; `avatarUrl` chỉ nhận `https://` ≤ 500 ký tự, ngược lại bỏ. `ZaloAuthError('INVALID_TOKEN')` -> 401; `('UNAVAILABLE')` -> 502; lỗi khác -> 500 `INTERNAL` không lộ chi tiết. Log chỉ chứa `userId` hoặc `zaloId` băm-cắt (không log token, không log session). Chỉ gọi `store`/`issuer` sau khi `verifier` thành công.
- Tiêu chí (đủ các ca): OPTIONS 204 + CORS; GET 405; thân không phải JSON, thiếu token, token quá dài/quá ngắn -> 400 và `verifier` không bị gọi; token Zalo sai -> 401 và `store`/`issuer` không bị gọi; Zalo sập -> 502; user mới (tạo); user cũ (không tạo); `name` rỗng/quá dài; `avatarUrl` `http://` bị bỏ; `store` ném lỗi -> 500 và thân phản hồi không chứa message gốc; mọi phản hồi không chứa token nhận vào (assert chuỗi); `log` không nhận token (assert trên mọi lần gọi).

Điểm review 3a (sen1) sau T-F1 và T-F2 (xem đợt D): review bảo mật `auth-zalo` TRƯỚC khi push (xem R1).

### Đợt D (3 task song song; T-F2 chờ S1)

**T-W (dev1): Nối `createServices` và `ServicesProvider`**
- File: `src/services/createServices.ts`, `createServices.test.ts`, `src/providers/ServicesProvider.tsx`.
- Việc: nhánh `supabase`: tạo `client` (hoặc dùng `deps.client`), dựng 5 repo + `session`; `profile` nhận `gymers`. Thiếu `deps.auth` ở nhánh `supabase` -> `session.signIn` ném `UNKNOWN` có thông báo rõ (không crash lúc khởi tạo). Nhánh `mock` GIỮ NGUYÊN (mọi phương thức `NOT_IMPLEMENTED`, kể cả `session`). `ServicesProvider`: lấy `storage`, `auth` từ `PlatformContext` bằng `useContext` (nullable); `useMemo` tạo một lần.
- Test: nhánh `mock` vẫn `NOT_IMPLEMENTED` cho cả 14 phương thức; nhánh `supabase` với `deps.client` giả: mỗi phương thức gọi đúng repo (một ca đại diện mỗi nhóm), `createServices` không gọi `fetch`; render `ServicesProvider` không có `PlatformProvider` không ném lỗi.
- Phụ thuộc: xong T-G, T-S, T-R, T-P, T-A (đợt B, C).

**T-F2 (dev2): Adapter và `index.ts` của `auth-zalo`, `config.toml`** (chờ S1)
- File: `supabase/functions/auth-zalo/adapters/zaloVerifier.ts`, `userStore.ts`, `sessionIssuer.ts`, `adapters.test.ts`, `supabase/functions/auth-zalo/index.ts`, `supabase/config.toml` (chỉ thêm khối `[functions.auth-zalo]` với `verify_jwt = false` và comment lý do).
- Việc: theo `ports.ts` và kết quả S1. `zaloVerifier`: nhận `fetchFn` và cấu hình (`endpoint`, `appSecret?`) qua tham số; timeout 8 giây; ánh xạ lỗi theo S1 (token sai -> `INVALID_TOKEN`; HTTP 5xx/timeout/mạng -> `UNAVAILABLE`); không tin trường nào ngoài `id/name/picture`. `userStore`: theo D3, nhận `admin` là interface cấu trúc tối thiểu (`createUser`, `deleteUser`) và `db` (`from(...).select/insert`) tối thiểu, xử lý đua `23505`, dọn `auth.users` mồ côi. `sessionIssuer`: theo D4 (`generateLink` rồi `verifyOtp`), lấy email của user qua `getUserById`; thiếu `hashed_token`/phiên -> ném lỗi (handler trả 500). `index.ts`: duy nhất ở đây dùng `Deno.serve`, `Deno.env.get`, `import { createClient } from "npm:@supabase/supabase-js@2.117.3"`; đọc `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (hosted tự cấp; xem R6) và `ZALO_APP_SECRET` (và biến khác nếu S1 yêu cầu); thiếu biến -> truyền cho handler để trả `500 CONFIG_MISSING`. Không đặt giá trị bí mật nào trong repo.
- Tiêu chí: `adapters.test.ts` (Vitest, client giả): xác minh thành công; token sai; Zalo 500/timeout; user mới (thứ tự createUser -> profiles -> zalo_identities); đua `23505` (xoá user vừa tạo, trả user cũ); lỗi giữa chừng có dọn; issuer thiếu `hashed_token`. `index.ts` được `deno`-free kiểm bằng đọc: không có secret, không có `console.log` của token. `config.toml` đúng cú pháp TOML (khối `[functions.auth-zalo]`).
- Phụ thuộc: `ports.ts` (đợt A), S1; song song được với T-F1.

**T-D (dev3): Tài liệu thiết lập và checklist smoke test**
- File: `docs/app-supabase-setup.md`.
- Nội dung: (1) bảng biến/secret cần có và nơi đặt (GitHub environment `production-deploy`: `VITE_DATA_SOURCE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; Supabase function secrets: `ZALO_APP_SECRET`...) tham chiếu `docs/ci-cd-setup.md`, KHÔNG lặp giá trị; (2) lệnh `supabase secrets set` (giá trị placeholder); (3) cài đặt Auth ở dashboard (tắt "Allow new users to sign up", giữ anonymous sign-ins tắt; xác nhận lại sau S1); (4) SQL tạo dữ liệu thử để có ít nhất 1 Gymer hiển thị trong tìm kiếm (insert `gymer_profiles` `is_listed = true`, `gymer_locations`, `gymer_specialties`, `gymer_open_hours` cho một user đã đăng nhập; dùng `uuid` thay thế rõ ràng); (5) smoke test theo thứ tự: curl `auth-zalo` với token sai -> kỳ vọng 401 `ZALO_TOKEN_INVALID` (không cần secret thật), GET -> 405, rồi đăng nhập thật trong Mini App Development, kiểm `auth.users`/`profiles`/`zalo_identities` có 1 hàng, đăng nhập lần 2 không tạo hàng mới; gọi từng repository qua một trang thử hoặc console (ghi rõ chưa có UI); (6) cách tắt/khôi phục khi sự cố: xoá function trên dashboard, đặt `VITE_DATA_SOURCE=mock`.
- Tiêu chí: đủ 6 mục, mọi lệnh có placeholder, không giá trị thật; đối chiếu với `docs/ci-cd-setup.md` không mâu thuẫn tên biến.
- Phụ thuộc: không (có thể sửa nhỏ sau S1).

Điểm review 3 (sen1) sau đợt D: toàn bộ (xem mục 6).

Ma trận file (kiểm không trùng trong cùng đợt):
- A: T-S1 {scripts/spikes/*, docs/spikes/*}; T-I1 {src/types/domain.ts, src/services/index.ts, src/services/repositories/*, src/services/createServices*, supabase/functions/auth-zalo/ports.ts}; T-C1 {src/services/supabase/{client,storageAdapter,postgrestError,userId}*, src/test/fakeSupabase*}.
- B: T-G {mappers/gymer*, supabase/gymerRepo*}; T-S {mappers/schedule*, supabase/scheduleRepo*}; T-R {mappers/request*, supabase/{bookingRepo,requestRepo}*}.
- C: T-P {supabase/profileRepo*}; T-A {supabase/sessionRepo*}; T-F1 {supabase/functions/auth-zalo/handler*, supabase/functions/_shared/http*, tsconfig.json}.
- D: T-W {createServices*, providers/ServicesProvider.tsx}; T-F2 {supabase/functions/auth-zalo/adapters/*, index.ts, supabase/config.toml}; T-D {docs/app-supabase-setup.md}.
- Chỉ T-I1 (đợt A) và T-W (đợt D) cùng sửa `createServices*`; hai đợt khác nhau, không chạy song song.

## 4. Rủi ro và cách giảm

- R1 (cao) Deploy tự động: `deploy.yml` deploy MỌI function trong `supabase/functions/` mỗi lần push `main` (job `functions` chạy khi có thư mục function). Push `auth-zalo` chưa review/chưa có secret lên production là chạm trực tiếp vào đăng nhập. Giảm: function fail-closed khi thiếu secret (`500 CONFIG_MISSING`); sen1 review bảo mật (điểm 3a) trước khi người dùng cho push `main`; người dùng đặt secret (U4) TRƯỚC khi push; sau deploy kiểm dashboard có hiển thị "Enforce JWT verification" tắt cho `auth-zalo`. Nếu CLI không áp `verify_jwt = false` từ `config.toml`, deploy sẽ trả 401 cho mọi lời gọi; cách xử lý (thêm `--no-verify-jwt` vào bước deploy) cần sửa `deploy.yml`, quyết định riêng sau khi thấy lỗi, không đoán trước.
- R2 (cao) Mạo danh qua token Zalo của ứng dụng khác: nếu endpoint xác minh không ràng buộc token với Mini App của mình và `id` Zalo là toàn cục, kẻ có token hợp lệ từ app khác của cùng người dùng có thể đăng nhập thành người đó (hoặc ngược lại tạo tài khoản cho người khác). Giảm: S1 phải trả lời cụ thể (có header `secret_key` của Mini App thì Zalo kiểm app; `id` có khác nhau giữa các app không). Chưa trả lời được -> chưa viết T-F1/T-F2. Không có ca nào "tin id client".
- R3 (trung bình) Không có rate limit cho `auth-zalo`; ai cũng gọi được (JWT tắt) và mỗi lần gọi xuất ra một lượt gọi API Zalo. Giảm: kiểm đầu vào rẻ trước khi gọi Zalo (độ dài token, thân ≤ 4 KB), timeout 8 giây, giới hạn mặc định của nền tảng Supabase. Chấp nhận ở v1, ghi nợ: thêm giới hạn theo IP/zaloId sau.
- R4 (trung bình) `zalo_id` có thể theo từng Mini App: đổi Mini App ID (tạo app mới) sẽ cho `id` khác -> người dùng cũ thành tài khoản mới, mất lịch sử. Giảm: S1 xác nhận; ghi vào tài liệu "không đổi Mini App ID sau khi có người dùng thật"; Development/Testing của cùng App ID không ảnh hưởng.
- R5 (trung bình) `nativeStorage` của Zalo (đồng bộ, dung lượng và độ bền chưa kiểm) lưu refresh token; webview có thể thiếu `navigator.locks` mà `supabase-js` dùng cho auth. Giảm: dự phòng bộ nhớ; `UNAUTHENTICATED` -> đăng nhập lại im lặng (token Zalo lấy lại được sau khi đã cấp quyền); kiểm trên thiết bị thật ở smoke test.
- R6 (trung bình) Giả định về môi trường function trên hosted: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` tự được cấp vào function, và khoá mới kiểu `sb_secret_`/`sb_publishable_` có thể khác tên biến. Chưa kiểm được ở đây. Giảm: S1 chạy trên dự án thật; `index.ts` báo tên biến thiếu cụ thể; xem tài liệu Supabase hiện hành khi viết T-F2.
- R7 (trung bình) Tài khoản "mồ côi" hoặc rác: nếu bật đăng ký email, ai có khoá anon (công khai) tự tạo được user chỉ-có-auth (không có `profiles`). Họ gọi được `search_gymers` (chỉ cần `auth.uid()`); `create_booking` chặn vì thiếu `profiles`. Giảm: tắt "Allow new users to sign up" (U2); S1 xác nhận `admin.createUser` vẫn chạy.
- R8 (trung bình) Embed PostgREST (`profiles!bookings_customer_id_fkey`, `booking_health_notes`) và hình dạng trả về (object hay mảng) chỉ kiểm bằng client giả, không phải PostgREST thật. Giảm: mapper chịu cả hai dạng; smoke test có bước đọc danh sách yêu cầu thật; nếu embed lỗi, tách thành hai truy vấn (mapper vẫn dùng được).
- R9 (thấp) `tags` không nguyên tử (hai bước). Chấp nhận (trạng thái trung gian vẫn hợp lệ); đường nâng cấp: một RPC `set_gymer_specialties`.
- R10 (thấp) Bundle lớn hơn vì `supabase-js` vào cả bản `mock`. Đo `dist` ở điểm review 3.
- R11 (thấp) Suy diễn "giá hiển thị" lệch giá server: tránh bằng cách không tính giá ở client; `expectedPrice` luôn lấy từ `DayInfo.price` mà server vừa trả; lệch -> `PRICE_CHANGED` (đã có ca test).

## 5. Câu hỏi mở và việc người dùng phải làm

### 5.1 Câu hỏi mở (mỗi câu có mặc định plan sẽ dùng nếu bạn không trả lời)

- Q1. Xác minh token Zalo cần `secret_key` của Mini App không, và có đúng endpoint `graph.zalo.me` không? KHÔNG có mặc định; chờ kết quả S1 (U3). Chặn T-F1 và T-F2.
- Q2. Bạn đồng ý tắt "Allow new users to sign up" (R7) không? Mặc định: tắt.
- Q3. `BookingRequest.isNew` (huy hiệu "Mới" ở `RequestCard`) định nghĩa thế nào? DB không có cột "đã xem". Mặc định: repository KHÔNG đặt `isNew`; mọi yêu cầu chờ duyệt hiện huy hiệu "Chờ duyệt". Nếu cần "Mới": thêm cột/ghi nhận đã xem (migration riêng) hoặc dùng `created_at` trong N giờ.
- Q4. Danh sách yêu cầu phía Gymer có cần hiện lượt đã huỷ và đã hết hạn (lịch sử) không? Mặc định: không (`RequestStatus` chỉ có `pending|confirmed|rejected`); lượt `pending` hết hạn bị ẩn.
- Q5. `GymerDetail.gymer.distanceKm` không có nguồn ở `getDetail`. Mặc định: `0`, UI dùng khoảng cách từ kết quả tìm kiếm (truyền qua route/store). Phương án khác: `distanceKm` thành tuỳ chọn trong `Gymer` (đổi kiểu, ảnh hưởng `GymerCard`).
- Q6. Chế độ `mock` giữ nguyên `NOT_IMPLEMENTED` (theo yêu cầu). Khi có UI, có cần repository mock từ `src/mocks` để dev trong trình duyệt không? Mặc định: hoãn đến plan UI.
- Q7. Các chức năng có RPC/bảng nhưng chưa có trong giao diện repository: lịch của khách (danh sách + `cancel_booking`), `create_review`, đăng ký làm Gymer (tạo `gymer_profiles` + vị trí + chuyên môn), khung giờ mẫu `gymer_open_hours`, chọn địa điểm Gymer. Mặc định: ngoài plan này; lập plan mở rộng cùng thiết kế màn hình. Lưu ý: chưa có đường trong app để một người trở thành Gymer, nên smoke test phải gieo dữ liệu bằng SQL (T-D mục 4).
- Q8. Giữ phiên qua `nativeStorage` (mặc định, D6) hay không lưu và đăng nhập lại mỗi lần mở app?
- Q9. Chấp nhận việc push `main` kích hoạt deploy `auth-zalo` ngay (R1), hay bạn muốn khoá thủ công (ví dụ chỉ merge sau khi sen1 review bảo mật và bạn đặt xong secret)? Mặc định: merge `auth-zalo` sau review 3a và sau U4.
- Q10. Bạn đồng ý chạy script S1 với `SUPABASE_SERVICE_ROLE_KEY` trên máy cá nhân (không dán vào chat, không ghi vào file trong repo)? Nếu không: S1 phần (b) làm tay trên dashboard theo hướng dẫn, chậm hơn.

### 5.2 Việc người dùng phải làm

- U1. Zalo for Developers: lấy khoá bí mật (Secret Key) của Mini App và xác nhận App ID đang dùng. Tên mục có thể khác; plan chưa xác nhận vị trí chính xác. Không dán vào chat/repo.
- U2. Supabase dashboard > Authentication: tắt "Allow new users to sign up", để anonymous sign-ins tắt; nếu S1 cho thấy magiclink cần provider Email bật, giữ Email bật nhưng đăng ký tắt.
- U3. Chạy S1: lấy một `access_token` thật từ Mini App (môi trường Development/simulator), chạy `scripts/spikes/s1-zalo-me.mjs` và `scripts/spikes/s1-session.mjs` theo `docs/spikes/s1-auth-zalo.md`, điền bảng kết quả, báo lại để sen1 chốt "Quyết định hệ quả". Chỉ làm sau khi T-S1 xong.
- U4. Trước khi push `auth-zalo`: `supabase secrets set ZALO_APP_SECRET=... --project-ref <ref>` (cùng các biến khác S1 yêu cầu) thủ công hoặc trên dashboard (theo `docs/supabase-migrations.md`, secret function không đi qua GitHub Actions).
- U5. Kiểm GitHub environment `production-deploy` đã có `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL`, secret `VITE_SUPABASE_ANON_KEY` (theo `docs/ci-cd-setup.md`); chưa có thì job `zalo` dừng ở bước build.
- U6. Sau deploy: kiểm dashboard Edge Functions thấy `auth-zalo` với JWT verification tắt; chạy smoke test theo `docs/app-supabase-setup.md`; gieo dữ liệu Gymer thử bằng SQL Editor.
- U7. Duyệt plan này (đổi dòng đầu thành `Trạng thái: ĐÃ APPROVE` thông qua product-manager) và trả lời Q2, Q8, Q9, Q10 trước khi bắt đầu đợt A; các câu còn lại dùng mặc định nếu không trả lời.

## 6. Thứ tự thực hiện và các điểm kiểm tra

Thứ tự: Đợt A -> review 1 -> Đợt B (song song với U1-U3) -> review 2 -> Đợt C (T-F1 chỉ bắt đầu khi S1 xong) -> Đợt D (T-F2 chỉ bắt đầu khi S1 xong) -> review 3 -> review bảo mật 3a cho `auth-zalo` -> U4 -> push `main` -> U6 smoke test.

Nếu S1 chậm: Đợt A, B, C (trừ T-F1), T-W, T-D vẫn làm được; chỉ T-F1 và T-F2 chờ. Khi đó repository đã chạy được với một phiên tạo tay (dùng `s1-session.mjs` lấy tạm phiên cho kiểm thử cục bộ), nhưng KHÔNG có đăng nhập Zalo thật.

Điểm kiểm tra:
- Review 1 (sau A): hợp đồng giao diện và ánh xạ lỗi khớp mục 2.2; `fakeSupabase` ghi đủ thông tin để assert; 3 lệnh xanh.
- Review 2 (sau B): từng repository đối chiếu RPC/RLS thật: chống đặt trùng lịch (`create` không tự chặn thay server, chỉ chuyển mã lỗi; `setSlotClosed` không upsert), giá T7/CN (không tính ở client), RLS/quyền (không lọc thay server, không dùng service role), xử lý lỗi (đủ bảng mã), kiểu domain không lộ null/undefined.
- Review 3 (sau D): toàn bộ; `npm run build` xanh; đo `dist`; `createServices.test` bao nhánh `mock` giữ nguyên; không có secret trong repo (`git grep` chuỗi `service_role`, `ZALO_APP_SECRET` chỉ ở tên biến/tài liệu).
- Review 3a (bảo mật `auth-zalo`): đối chiếu R1-R3, R6, R7; kiểm không log token; fail-closed; CORS; xử lý đua; cấu hình `verify_jwt`.
- Smoke test thủ công (U6) là cổng cuối trước khi coi là xong; phần không kiểm được bằng test tự động ở mục 2.3 chỉ được xác nhận ở đây.
