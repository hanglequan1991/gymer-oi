# Thiết lập app-Supabase và smoke test

Trạng thái: BẢN NHÁP (T-D, dev3, 2026-10-11). Căn cứ: `docs/plans/app-supabase-integration.md` mục 2.1, 4 (R1, R2, R5-R8), 5.2 (U1-U7); `docs/spikes/s1-auth-zalo.md`; `docs/ci-cd-setup.md`; `docs/supabase-migrations.md`.

Tài liệu không chứa giá trị bí mật. Mọi `<...>` là placeholder.

## 0. Tình trạng code hiện tại (kiểm 2026-10-11)

- `supabase/functions/auth-zalo/` chưa có `index.ts` và `adapters/`.
- Có `ports.ts` trên nhánh `wip/auth-zalo-ports` (commit `e0f969d`), không có trên `main`.
- Có `handler.ts`, `handler.test.ts` và `_shared/http.ts` nhưng CHƯA commit (đang nằm trong working tree của `main`).
- `supabase/config.toml` chưa có khối `[functions.auth-zalo]`.

Hệ quả: các bước deploy `auth-zalo` ở mục 4 chỉ làm được sau khi T-F1 và T-F2 xong và review 3a đạt.

## 1. Checklist tổng (theo thứ tự)

- [ ] A. Lấy Zalo Secret Key (U1), mục 2
- [ ] B. Chạy S1, bật rồi tắt đăng ký (U3), mục 3.1
- [ ] C. Cài đặt Auth trên Supabase: tắt đăng ký và anonymous sign-in (U2), mục 3.2
- [ ] D. Đặt secret function trước khi push (U4), mục 4.1
- [ ] E. Kiểm điều kiện và đưa `auth-zalo` lên `main` qua PR, mục 4.2 và 4.3
- [ ] F. Đặt biến `VITE_*` và biến GitHub environment (U5), mục 5
- [ ] G. Kiểm sau deploy (U6), mục 4.3 bước 5
- [ ] H. Smoke test, mục 6

## 2. Lấy Zalo Secret Key

- Vào Zalo for Developers, mở Mini App có App ID trong biến `ZMP_APP_ID` (xem `docs/ci-cd-setup.md` mục 3). Tìm mục khoá bí mật của Mini App. Tên mục có thể khác với mô tả này, plan chưa xác nhận vị trí (U1).
- Không dán khoá vào chat, issue, commit, file trong repo hay biến `VITE_*`.
- Tên biến khi đặt trên Supabase: `ZALO_APP_SECRET` (theo plan D2 và test `handler.test.ts`).
- Script `scripts/spikes/s1-zalo-me.mjs` đọc cùng tên `ZALO_APP_SECRET` (biến tuỳ chọn ở S1). Việc có cần secret hay không vẫn chờ S1 chốt mục 6 của `docs/spikes/s1-auth-zalo.md`. Chưa chốt thì chưa đặt secret.

## 3. Chạy S1 và cài đặt Auth

### 3.1 Chạy S1 (trên máy cá nhân)

Làm theo `docs/spikes/s1-auth-zalo.md` mục 2 đến 4. Không lưu bí mật vào file trong repo, không dùng `.env` trong repo.

- [ ] Phần (a): `node scripts/spikes/s1-zalo-me.mjs` (token từ Mini App, chạy trong vài phút sau khi lấy).
- [ ] Phần (b), lần 1: bật "Allow new users to sign up", chạy `node scripts/spikes/s1-session.mjs`.
- [ ] Phần (b), lần 2: tắt "Allow new users to sign up", chạy lại. Ghi kết quả vào bảng 5.2 của spike.
- [ ] Điền bảng 5.1 và 5.2, báo sen1 để chốt mục 6 (endpoint, tên secret, magiclink, R2).

### 3.2 Cài đặt Authentication trên Supabase Dashboard

Vị trí các mục có thể khác theo phiên bản dashboard.

- [ ] Tắt "Allow new users to sign up" (R7, Q2 mặc định là tắt).
- [ ] Tắt anonymous sign-ins. Nếu không thấy mục này trên dashboard, ghi lại và không coi là chặn.
- [ ] Provider Email: nếu S1 cho thấy magiclink cần provider Email, giữ Email bật nhưng đăng ký vẫn tắt. Chưa kiểm chứng (xem mục 7).
- [ ] Không bật provider nào khác nếu chưa có quyết định.

## 4. Secret và đưa `auth-zalo` lên `main`

### 4.1 Đặt secret TRƯỚC khi push

Secret của function không đi qua GitHub Actions (`docs/supabase-migrations.md`). Đặt bằng CLI, dùng file env nằm NGOÀI repo:

```bash
# Tạo file ngoài repo, quyền 600, mỗi dòng NAME=value
# Nội dung ví dụ: ZALO_APP_SECRET=<giá trị khoá bí mật>
supabase secrets set --env-file /<đường-dẫn-ngoài-repo>/auth-zalo.env --project-ref <project-ref>
rm /<đường-dẫn-ngoài-repo>/auth-zalo.env
supabase secrets list --project-ref <project-ref>   # chỉ hiện tên và digest, không hiện giá trị
```

- Nếu không dùng được CLI: đặt trên Dashboard > Edge Functions > Secrets.
- Không đặt tên bắt đầu bằng `SUPABASE_`. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` được nền tảng cấp vào function (R6). Việc CLI có từ chối tên `SUPABASE_*` hay không chưa kiểm chứng.
- Thiếu secret thì function trả `500 CONFIG_MISSING` và không chạy tiếp (fail-closed). Nếu lỡ deploy trước khi đặt secret, đây là trạng thái an toàn, không đăng nhập được.

### 4.2 Điều kiện trước khi merge

Push `main` làm job `functions` deploy MỌI thư mục function (R1), và job `zalo` chỉ chạy khi `functions` thành công hoặc bị bỏ qua. Vì vậy:

- [ ] `supabase/functions/auth-zalo/index.ts` có tồn tại. Thiếu file này thì deploy đỏ và job `zalo` bị bỏ qua.
- [ ] `adapters/` đủ, test của function xanh (lệnh Vitest chạy trong repo, xác nhận trong `package.json` trước khi chạy).
- [ ] `supabase/config.toml` có khối sau. Không có khối này, gateway đòi JWT và mọi lời gọi trả 401 (R1):

```toml
[functions.auth-zalo]
verify_jwt = false
```

- [ ] Review bảo mật 3a đạt (R1 đến R3, R6, R7).
- [ ] Secret mục 4.1 đã đặt.
- [ ] Diff không chứa token, khoá hay `.env`. Kiểm bằng `git diff --cached` trước khi commit.

### 4.3 Cách đưa lên `main`

Không merge trực tiếp `wip/auth-zalo-ports`. Nhánh đó chỉ có `ports.ts`, không có `index.ts`, và sẽ làm job `functions` đỏ.

Không bấm Run workflow (`workflow_dispatch`) trên nhánh chứa function chưa merge. Job `functions` trong `deploy.yml` hiện chưa kiểm `github.ref`, nên có thể deploy `auth-zalo` từ nhánh đó (xem review C, N3).

1. Từ `main`, tạo nhánh mới, ví dụ `feat/auth-zalo`.
2. Đưa vào nhánh mới: commit `e0f969d` (`ports.ts`), `handler.ts`, `handler.test.ts`, `_shared/http.ts`, `_shared/http.test.ts`, `index.ts`, `adapters/*`, `supabase/functions/tsconfig.json`, `supabase/config.toml`.
3. Mở PR vào `main`, chờ `ci.yml` xanh, merge. Không push thẳng `main`.
4. Theo dõi run `deploy.yml`: các job `functions` và `zalo`.
5. Kiểm Dashboard > Edge Functions: `auth-zalo` có "Enforce JWT verification" TẮT (R1). Nếu không tắt, dừng và báo product-manager. Không tự sửa `deploy.yml`.
6. Sau khi merge xong, xoá nhánh `wip/auth-zalo-ports` nếu không còn cần.

Rollback: revert PR trên `main` (deploy lại bản trước). Nếu đây là lần deploy đầu tiên, không có bản trước để quay về, dùng Dashboard để xoá function `auth-zalo`.

## 5. Biến `VITE_*` và biến môi trường

Đặt ở GitHub environment `production-deploy` (chi tiết và bảng đầy đủ ở `docs/ci-cd-setup.md` mục 3). Không commit giá trị vào repo.

| Tên | Loại | Giá trị hoặc ghi chú |
|---|---|---|
| `VITE_DATA_SOURCE` | Variable | `supabase`. Mặc định code là `mock` (`src/config/env.ts`). |
| `VITE_SUPABASE_URL` | Variable | `https://<project-ref>.supabase.co` (công khai). |
| `VITE_SUPABASE_ANON_KEY` | Secret | Khoá anon hoặc publishable. Job build từ chối khoá `sb_secret_`. |

- Không bao giờ đặt service-role key vào biến có tiền tố `VITE_*` (biến này được nhúng vào bundle gửi cho người dùng).
- Chạy local: copy `.env.example` thành `.env.local`. File này bị `.gitignore` chặn (`.env.*`), không commit.

## 6. Smoke test

### 6.0 Chuẩn bị

- Hai tài khoản Zalo trong môi trường Development: A là Gymer, B là khách. Nếu chỉ có một tài khoản, xem mục 7 (chưa kiểm chứng).
- Thiết bị hoặc simulator Zalo. Kiểm giữ phiên trên thiết bị thật (R5).
- App chưa có UI đăng nhập, đặt lịch (các trang là giữ chỗ). Các bước 6.5 đến 6.8 gọi repository qua một trang thử hoặc console tạm do dev tạo, không commit, và ghi rõ trong báo cáo.
- Chạy SQL trong SQL Editor của Dashboard (quyền postgres, bỏ qua RLS). `auth.uid()` trong SQL Editor là null nên các RPC kiểm đăng nhập sẽ trả `FORBIDDEN` khi chạy ở đây. Chỉ gọi RPC từ phiên của app.

### 6.1 Từ chối đầu vào (không cần tài khoản Zalo)

- [ ] `POST` với token giả, kỳ vọng `401 ZALO_TOKEN_INVALID`. Nếu `500 CONFIG_MISSING`: thiếu secret (mục 4.1). Nếu 401 không có mã lỗi JSON: gateway đang chặn, kiểm `verify_jwt` (R1).
- [ ] `GET`, kỳ vọng `405`.
- [ ] `POST` thân `{}`, kỳ vọng `400 INVALID_REQUEST`.

```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/auth-zalo" \
  -H "Content-Type: application/json" \
  -d '{"zaloAccessToken":"token-gia-khong-hop-le"}' -w "\n%{http_code}\n"
```

Chỉ dùng token giả trong lệnh này. Không gõ token thật vào shell (lưu vào lịch sử).

### 6.2 Đăng nhập lần đầu (A)

- [ ] Đăng nhập A trong Mini App Development.
- [ ] Chạy SQL kiểm tra:

```sql
select id, display_name, created_at from public.profiles order by created_at desc limit 5;
select zalo_id, user_id from public.zalo_identities;
select count(*) as user_thieu_profile
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
```

Kỳ vọng: `profiles` có thêm 1 hàng, `zalo_identities` có thêm 1 hàng, `user_thieu_profile` = 0.

### 6.3 Đăng nhập lại và giữ phiên (A)

- [ ] Đóng hẳn Mini App rồi mở lại, kỳ vọng vẫn đăng nhập (Q8 mặc định là giữ phiên).
- [ ] Đăng nhập lần hai (sau khi xoá phiên cục bộ), kỳ vọng không tạo thêm hàng ở `profiles`, `zalo_identities`, `auth.users`. `display_name` không bị ghi đè (plan D3).

### 6.4 Gieo dữ liệu Gymer bằng SQL

App chưa có đường đăng ký làm Gymer. Thay `<UUID_A>` bằng `profiles.id` của A (lấy từ bước 6.2). Chạy một lần.

```sql
insert into public.gymer_profiles
  (user_id, display_name, gender, birth_year, area_label, bio,
   price_weekday_vnd, price_weekend_vnd, accepts_requests, is_listed)
values
  ('<UUID_A>', 'Gymer thử A', 'male', 1995, 'Quận 1, TP.HCM', 'Dữ liệu smoke test',
   200000, 300000, true, true);

insert into public.gymer_locations (user_id, lat, lng)
values ('<UUID_A>', 10.7769, 106.7009);

insert into public.gymer_specialties (gymer_id, specialty_name)
values ('<UUID_A>', 'Gym');

insert into public.gymer_open_hours (gymer_id, start_time)
select '<UUID_A>', make_time(h, 0, 0) from generate_series(8, 20) as h;
```

- [ ] Chạy xong, kiểm `select * from public.gymer_profiles where user_id = '<UUID_A>';` có 1 hàng.
- Dọn sau khi test: `delete from public.gymer_profiles where user_id = '<UUID_A>';` (cần kiểm các bảng phụ có xoá theo cascade không).

### 6.5 Tìm kiếm (phiên B)

- [ ] Gọi `search_gymers` từ phiên B với `p_lat=10.7769`, `p_lng=106.7009`, `p_radius_km=5`. Kỳ vọng A xuất hiện với `distance_km` gần 0.
- [ ] Đặt `is_listed = false` cho A (SQL), gọi lại: A biến mất. Sau đó đặt lại `true`.
- [ ] Gọi không phiên: kỳ vọng lỗi (đối chứng).

### 6.6 Đặt lịch (phiên B)

- [ ] Chọn một khung giờ tròn theo giờ VN, cách hiện tại từ 2 giờ đến 60 ngày, trong khoảng 8h đến 20h (khớp với `gymer_open_hours` đã gieo).
- [ ] Gọi `get_day_slots` cho ngày đó, kỳ vọng khung có trạng thái trống.
- [ ] Gọi `create_booking` với `p_expected_price` bằng 200000 (ngày thường) hoặc 300000 (T7 và CN theo giờ VN). Kỳ vọng trả về id, hàng `bookings` có `status = pending`.
- [ ] Ca lỗi, mỗi ca thử một lần:
  - giá sai: `PRICE_CHANGED`
  - đặt lại đúng khung vừa đặt: `SLOT_TAKEN`
  - A tự đặt lịch với chính mình: `FORBIDDEN`
  - giờ cách dưới 2 giờ: `VALIDATION`
  - đồng ý chia sẻ ghi chú sức khoẻ nhưng ghi chú rỗng: `VALIDATION`

### 6.7 Xác nhận (phiên A)

- [ ] Gọi `respond_booking(<id>, 'confirmed')` bằng phiên A. Kỳ vọng `status = confirmed`.
- [ ] Gọi cùng RPC bằng phiên B: kỳ vọng `FORBIDDEN`.
- [ ] Repository đọc danh sách yêu cầu của A hiện đúng tên khách (đây là bước kiểm R8: embed `profiles!bookings_customer_id_fkey` và `booking_health_notes`). Nếu lỗi embed, báo sen1 để tách thành hai truy vấn.

### 6.8 Huỷ (phiên B)

- [ ] Gọi `cancel_booking(<id>)` bằng phiên B. Kỳ vọng `status = cancelled`.
- [ ] Gọi lại lần hai: kỳ vọng `FORBIDDEN`.
- [ ] Tuỳ chọn: huỷ một lịch đã qua giờ, kỳ vọng `ALREADY_STARTED` (chỉ làm nếu có lịch cũ).

### 6.9 Kiểm trạng thái cuối

```sql
select id, customer_id, gymer_id, status, starts_at, expires_at
from public.bookings order by created_at desc limit 5;
```

Kỳ vọng: booking đã thử có trạng thái `cancelled`.

### 6.10 Kiểm kê user mồ côi

Khi function bị dừng giữa chừng (ví dụ hết thời gian chạy) sau khi `auth.users` đã tạo nhưng trước khi ghi `profiles` hoặc `zalo_identities`, có thể còn user không liên kết. Chạy truy vấn sau trên SQL Editor:

```sql
select u.id, u.email, u.created_at,
       exists (select 1 from public.zalo_identities z where z.user_id = u.id) as co_identity,
       exists (select 1 from public.profiles p where p.id = u.id) as co_profile
from auth.users u
where u.email like '%@zalo.gymer.invalid'
  and (not exists (select 1 from public.zalo_identities z where z.user_id = u.id)
       or not exists (select 1 from public.profiles p where p.id = u.id))
order by u.created_at;
```

- Kỳ vọng: 0 hàng. Chạy trước mỗi lần kiểm smoke test và sau mỗi sự cố.
- Nếu có hàng: đây là user mồ côi do function bị dừng giữa chừng. Chấp nhận v1 (review C, G-b), không tự động dọn. Xoá tay từng user trên Dashboard > Authentication sau khi chắc không liên quan đến phiên đăng nhập nào.

## 7. Giả thuyết chưa kiểm chứng

- R8: embed PostgREST (`profiles!bookings_customer_id_fkey`, `booking_health_notes`) và hình dạng object hay mảng. Mới chỉ kiểm bằng client giả. Kiểm ở 6.7.
- D4 (magiclink): `auth.admin.generateLink` rồi `verifyOtp` có cấp phiên thật không, và có chạy khi đăng ký tắt không. Chưa chứng minh, S1 phần (b) sẽ trả lời. Nếu không chạy: dừng và báo sen1, không tự chuyển sang ký JWT.
- R2: `id` Zalo có khác nhau giữa các Mini App không, token của app khác có đăng nhập được không. S1 phần (a) sẽ trả lời.
- R1: CLI có áp `verify_jwt = false` từ `config.toml` khi deploy không. Kiểm ở mục 4.3 bước 5.
- R5: `nativeStorage` có giữ phiên ổn định trên thiết bị thật không.
- Tên secret đã chốt là `ZALO_APP_SECRET`. Còn lại chờ S1: có cần secret hay không.
- Một tài khoản Zalo: nếu chỉ có A, chưa có cách đã kiểm để tạo khách B. Không tự tạo `auth.users` bằng SQL vì khi đó không kiểm được đường đăng nhập Zalo của khách.
- SQL gieo dữ liệu dựa trên migration hiện tại (`supabase/migrations/`). Nếu lệnh lỗi, đối chiếu lại cột và khoá của các bảng.

## 8. Khi sự cố

- Lỗi đăng nhập hàng loạt: revert PR của `auth-zalo` trên `main`, hoặc xoá function trên Dashboard.
- Nghi lộ khoá: đổi khoá trên Zalo for Developers, đặt lại secret bằng mục 4.1, deploy lại.
- Đăng ký bị mở nhầm: tắt lại "Allow new users to sign up" (mục 3.2).
- Đưa app về dữ liệu giả: đặt `VITE_DATA_SOURCE=mock`. Lưu ý: `docs/ci-cd-setup.md` mục 8 nói job từ chối deploy `deploy-*` nếu `VITE_DATA_SOURCE` khác `supabase`. Kiểm mục đó trước khi dùng cách này.
