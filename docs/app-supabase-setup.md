# Thiết lập app-Supabase và smoke test

Trạng thái: BẢN NHÁP (T-D, dev3, 2026-10-11; cập nhật theo task D1 của `docs/plans/app-ui-integration-review-dot-3-6.md`, mục B1). Căn cứ: `docs/plans/app-supabase-integration.md` mục 2.1, 4 (R1, R2, R5-R8), 5.2 (U1-U7); `docs/spikes/s1-auth-zalo.md` (mục 6 đã chốt); `docs/spikes/s2-resolve-location.md`; `docs/ci-cd-setup.md`; `docs/supabase-migrations.md`.

Tài liệu không chứa giá trị bí mật. Mọi `<...>` là placeholder.

## 0. Tình trạng code hiện tại (kiểm 2026-10-11)

- `supabase/functions/auth-zalo/` có `index.ts`, `handler.ts`, `ports.ts`, `adapters/` trên `main`. `supabase/config.toml` có `[functions.auth-zalo] verify_jwt = false`.
- `supabase/functions/resolve-location/` có đủ file trên `main`. `supabase/config.toml` có `[functions.resolve-location] verify_jwt = true`.
- Push `main` làm workflow `deploy.yml` deploy MỌI function (R1). Theo báo cáo của chủ dự án, `auth-zalo` đã được deploy. `resolve-location` cũng đã lên cùng đợt, nên hiện đang trả 500 `CONFIG_MISSING` cho đến khi đặt `ZALO_APP_SECRET` (mục 4.1).
- Vì vậy thứ tự cũ "đặt secret trước khi push" không còn đúng với `resolve-location`. Mục 4.4 là thứ tự bắt buộc từ bây giờ.

## 1. Checklist tổng (theo thứ tự)

- [ ] A. Lấy Zalo Secret Key (U1), mục 2
- [ ] B. Chạy S1, bật rồi tắt đăng ký (U3), mục 3.1
- [ ] C. Cài đặt Auth trên Supabase: tắt đăng ký và anonymous sign-in (U2), mục 3.2
- [ ] D. Đặt `ZALO_APP_SECRET` cho `resolve-location` (BẮT BUỘC), mục 4.1
- [ ] E. Kiểm trạng thái `auth-zalo` và `resolve-location` trên `main` và Dashboard, mục 4.2 và 4.3
- [ ] F. Đặt biến `VITE_*` và biến GitHub environment (U5), mục 5
- [ ] G. Kiểm sau deploy (U6), mục 4.3 bước 5
- [ ] H. Smoke test, mục 6 (gồm 6.11 cho `resolve-location`)
- [ ] I. Chạy S2 trên Zalo thật và ghi kết quả, `docs/spikes/s2-resolve-location.md`
- [ ] J. Đủ điều kiện mở cho người dùng thật, mục 4.4

## 2. Lấy Zalo Secret Key

- Vào Zalo for Developers, mở Mini App có App ID trong biến `ZMP_APP_ID` (xem `docs/ci-cd-setup.md` mục 3). Tìm mục khoá bí mật của Mini App. Tên mục có thể khác với mô tả này, plan chưa xác nhận vị trí (U1).
- Không dán khoá vào chat, issue, commit, file trong repo hay biến `VITE_*`.
- Tên biến khi đặt trên Supabase: `ZALO_APP_SECRET` (theo plan D2 và test `handler.test.ts`).
- Vai trò của secret theo từng function:
  - `resolve-location`: BẮT BUỘC (vị trí của khách). Thiếu thì trả 500 `CONFIG_MISSING`, không chạm Zalo (fail-closed).
  - `auth-zalo`: TUỲ CHỌN. `docs/spikes/s1-auth-zalo.md` mục 6.1 chốt là không cần để đăng nhập chạy. Xem cảnh báo ở mục 4.1.
- Script `scripts/spikes/s1-zalo-me.mjs` đọc cùng tên `ZALO_APP_SECRET` (biến tuỳ chọn ở S1).

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

## 4. Secret và trạng thái `auth-zalo`, `resolve-location` trên `main`

### 4.1 Đặt `ZALO_APP_SECRET` cho `resolve-location` (BẮT BUỘC)

Secret của function không đi qua GitHub Actions (`docs/supabase-migrations.md`). Đặt bằng CLI. Giá trị không được in ra màn hình, không nằm trên dòng lệnh (dễ lọt vào lịch sử shell), không nằm trong repo:

```bash
read -rs -p "ZALO_APP_SECRET: " ZALO_APP_SECRET && echo     # gõ hoặc dán, không hiện trên màn hình
umask 077
mkdir -p "$HOME/.gymer-secrets"
printf 'ZALO_APP_SECRET=%s\n' "$ZALO_APP_SECRET" > "$HOME/.gymer-secrets/resolve-location.env"
unset ZALO_APP_SECRET
supabase secrets set --env-file "$HOME/.gymer-secrets/resolve-location.env" --project-ref <project-ref>
rm -f "$HOME/.gymer-secrets/resolve-location.env"
supabase secrets list --project-ref <project-ref>   # chỉ hiện tên và digest, không hiện giá trị
```

- Thư mục `$HOME/.gymer-secrets` nằm NGOÀI repo. Không đặt file này trong `/home/claude/gymer-oi`.
- Nếu không dùng được CLI: đặt trên Dashboard > Edge Functions > Secrets.
- Secret đặt ở cấp dự án nên mọi function trong dự án đều đọc được. Xem cảnh báo cho `auth-zalo` bên dưới.
- Không đặt tên bắt đầu bằng `SUPABASE_`. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` được nền tảng cấp vào function (R6). Việc CLI có từ chối tên `SUPABASE_*` hay không chưa kiểm chứng.
- Thiếu secret thì `resolve-location` trả `500 CONFIG_MISSING` và không chạm Zalo (fail-closed). Đây là trạng thái an toàn nhưng làm chết luồng vị trí của khách.
- Chưa kiểm chứng: có cần deploy lại sau khi đặt secret hay không. Kiểm bằng smoke test 6.11 (bước đối chứng trước và sau khi đặt).

Cảnh báo cho `auth-zalo`: `supabase/functions/auth-zalo/index.ts` đọc cùng biến này và truyền xuống verifier (dòng 12 và 32). Mục 6.1 của S1 chốt là không gửi `secret_key` mặc định. Chưa kiểm xem verifier có gửi header `secret_key` khi biến có giá trị hay không. Trước khi đặt secret, sen1 cần xác nhận một trong hai: sửa `auth-zalo` để không dùng biến này, hoặc chấp nhận có chủ đích và ghi vào mục 7.

### 4.2 Trạng thái trên `main`

Push `main` làm job `functions` deploy MỌI thư mục function (R1), và job `zalo` chỉ chạy khi `functions` thành công hoặc bị bỏ qua. Trạng thái hiện tại:

- [x] `supabase/functions/auth-zalo/index.ts` có trên `main` (kiểm trong repo 2026-10-11).
- [x] `supabase/functions/resolve-location/index.ts` có trên `main`.
- [x] `supabase/config.toml` có khối `[functions.auth-zalo] verify_jwt = false` và `[functions.resolve-location] verify_jwt = true`. Không có khối `auth-zalo`, gateway đòi JWT và mọi lời gọi trả 401 (R1).
- [ ] Review bảo mật 3a đạt (R1 đến R3, R6, R7). Chưa có xác nhận trong repo.
- [ ] Secret `ZALO_APP_SECRET` đã đặt (mục 4.1). Chưa xác nhận.
- [ ] Diff không chứa token, khoá hay `.env`. Kiểm bằng `git diff --cached` trước khi commit.

### 4.3 Kiểm sau khi lên `main`

Các bước đưa lên `main` (PR, `ci.yml`, `deploy.yml`) đã được thực hiện. Dùng phần này để kiểm, không làm lại việc đưa lên.

Không merge trực tiếp `wip/auth-zalo-ports`. Nhánh đó chỉ có `ports.ts`, không có `index.ts`, và sẽ làm job `functions` đỏ. Không bấm Run workflow (`workflow_dispatch`) trên nhánh chứa function chưa merge. Job `functions` trong `deploy.yml` hiện chưa kiểm `github.ref`, nên có thể deploy function từ nhánh đó (xem review C, N3).

1. Theo dõi run `deploy.yml` gần nhất: các job `functions` và `zalo`.
2. Kiểm Dashboard > Edge Functions: `auth-zalo` có "Enforce JWT verification" TẮT (R1). `resolve-location` có "Enforce JWT verification" BẬT (khớp `verify_jwt = true`). Nếu lệch, dừng và báo product-manager. Không tự sửa `deploy.yml`.
3. Xoá nhánh `wip/auth-zalo-ports` nếu không còn cần.

Rollback: revert PR trên `main` (deploy lại bản trước). Nếu đây là lần deploy đầu tiên của một function, không có bản trước để quay về, dùng Dashboard để xoá function đó.

### 4.4 Thứ tự bắt buộc trước khi mở cho người dùng thật (B1)

Không phát hành cho khách khi chưa xong các bước 1 đến 4.

1. Đặt `ZALO_APP_SECRET` (mục 4.1). Kiểm `supabase secrets list` có tên `ZALO_APP_SECRET`.
2. Kiểm mục 4.3 bước 2 (JWT ở cổng khớp cấu hình).
3. Chạy S2 trên Zalo thật, ghi kết quả vào `docs/spikes/s2-resolve-location.md`. Đóng S2 theo mục 5 của spike.
4. Chạy smoke test 6.11 (S3). Không còn `500 CONFIG_MISSING`, và phản hồi khớp kết quả S2.

Lối chọn khu vực (C1b, `f20d34a`) đã có trên `main`. Đây là đường dự phòng khi không lấy được vị trí (D9 trong plan). Đường dự phòng không thay thế bước 1 đến 4: nó chỉ giúp khách vẫn tìm được Gymer khi `resolve-location` lỗi. Bước 1 đến 4 vẫn là điều kiện để phát hành.

Điều kiện khác của B1 (review đợt 3-6, mục 5, không thuộc tài liệu này): N1, N2, N3 phải được sửa trước khi phát hành. Kiểm trạng thái trong `docs/plans/app-ui-integration-review-dot-3-6.md`.

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

### 6.11 Smoke test `resolve-location` (S3, curl)

Chuẩn bị: lấy khoá publishable (anon) từ Dashboard > Settings > API. Đọc vào biến shell mà không hiện ra màn hình. Không dùng service-role key.

```bash
read -rs -p "Publishable key: " SB_PUBLISHABLE_KEY && echo
```

Lệnh chung (thay `<project-ref>`):

```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/resolve-location" \
  -H "Authorization: Bearer $SB_PUBLISHABLE_KEY" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"zaloAccessToken":"token-gia-khong-hop-le-1234","locationToken":"loc-gia-khong-hop-le"}' \
  -w "\n%{http_code}\n"
```

Các ca (chạy theo thứ tự):

- [ ] Trước khi đặt secret (đối chứng): kỳ vọng `500` với `CONFIG_MISSING`.
- [ ] Sau khi đặt secret, token giả như lệnh trên: kỳ vọng `401 ZALO_TOKEN_INVALID` nếu Zalo trả 452, hoặc `502 ZALO_UNAVAILABLE` nếu Zalo trả mã khác. Hai kết quả này CHƯA kiểm chứng. Ghi kết quả thật vào spike S2, không đoán.
- [ ] `GET` (không kèm thân): kỳ vọng `405 METHOD_NOT_ALLOWED`.
- [ ] `POST` thân `{}`: kỳ vọng `400 INVALID_REQUEST`.
- [ ] `POST` không có header `Authorization`: kỳ vọng `401` từ cổng (`verify_jwt = true`). Phản hồi có thể không có JSON của handler. Đây là dấu hiệu cổng đang chặn đúng.
- [ ] Sau F4 (plan đợt 3-6): `POST` với anon key kỳ vọng `401 UNAUTHENTICATED`. Trước F4, bước này chỉ là ghi nhận.

Chỉ dùng token giả trong lệnh này. Token vị trí thật chỉ đi qua app hoặc lệnh đọc từ biến shell, không gõ vào dòng lệnh.

## 7. Giả thuyết chưa kiểm chứng

- R8: embed PostgREST (`profiles!bookings_customer_id_fkey`, `booking_health_notes`) và hình dạng object hay mảng. Mới chỉ kiểm bằng client giả. Kiểm ở 6.7.
- D4 (magiclink): `auth.admin.generateLink` rồi `verifyOtp` có cấp phiên thật không, và có chạy khi đăng ký tắt không. Chưa chứng minh, S1 phần (b) sẽ trả lời. Nếu không chạy: dừng và báo sen1, không tự chuyển sang ký JWT.
- R2: `id` Zalo có khác nhau giữa các Mini App không, token của app khác có đăng nhập được không. S1 phần (a) sẽ trả lời.
- R1: CLI có áp `verify_jwt = false` từ `config.toml` khi deploy không. Kiểm ở mục 4.3 bước 5.
- R5: `nativeStorage` có giữ phiên ổn định trên thiết bị thật không.
- Tên secret đã chốt là `ZALO_APP_SECRET`. Bắt buộc cho `resolve-location` (theo code). Cho `auth-zalo`: tuỳ chọn, và verifier có gửi `secret_key` khi có giá trị hay không chưa kiểm (xem mục 4.1).
- S2 (`docs/spikes/s2-resolve-location.md`): endpoint `graph.zalo.me/v2.0/me/info`, header `access_token`, `code`, `secret_key`, cấu trúc phản hồi, mã 452. Tất cả là giả thuyết, chưa chạy trên Zalo thật.
- `resolve-location` có `verify_jwt = true`, nên anon key vẫn qua được cổng (vì là JWT hợp lệ). Sau khi handler kiểm role `authenticated` (F4 của plan đợt 3-6), anon key phải nhận 401. Kiểm lại mục 6.11 sau F4.
- Một tài khoản Zalo: nếu chỉ có A, chưa có cách đã kiểm để tạo khách B. Không tự tạo `auth.users` bằng SQL vì khi đó không kiểm được đường đăng nhập Zalo của khách.
- SQL gieo dữ liệu dựa trên migration hiện tại (`supabase/migrations/`). Nếu lệnh lỗi, đối chiếu lại cột và khoá của các bảng.

## 8. Khi sự cố

- Lỗi đăng nhập hàng loạt: revert PR của `auth-zalo` trên `main`, hoặc xoá function trên Dashboard.
- Lỗi vị trí hàng loạt (`500 CONFIG_MISSING` hoặc `502 ZALO_UNAVAILABLE` từ `resolve-location`): kiểm `supabase secrets list` có `ZALO_APP_SECRET`, xem log function. Trong lúc chờ, khách dùng lối chọn khu vực (C1b). Nếu không khắc phục được, dừng mở thêm người dùng và báo product-manager.
- Nghi lộ khoá: đổi khoá trên Zalo for Developers, đặt lại secret bằng mục 4.1, deploy lại.
- Đăng ký bị mở nhầm: tắt lại "Allow new users to sign up" (mục 3.2).
- Đưa app về dữ liệu giả: đặt `VITE_DATA_SOURCE=mock`. Lưu ý: `docs/ci-cd-setup.md` mục 8 nói job từ chối deploy `deploy-*` nếu `VITE_DATA_SOURCE` khác `supabase`. Kiểm mục đó trước khi dùng cách này.
