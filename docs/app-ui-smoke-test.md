# Smoke test UI trên Zalo Development

Trạng thái: BẢN NHÁP (Z2, dev3, 2026-10-11). Căn cứ: `docs/plans/app-ui-integration.md` mục 6.3 (S1-S13) và 6.2; `docs/app-supabase-setup.md` mục 4, 5, 6, 8; `docs/ci-cd-setup.md` mục 8.

Tài liệu không chứa giá trị bí mật. Mọi `<...>` là placeholder. Không dán token, khoá, mật khẩu hay toạ độ thật vào chat, issue, commit hay ảnh chụp gửi đi.

## 0. Cách dùng

- Làm lần lượt: mục 1 (điều kiện), mục 2 (triển khai), mục 3 (kiểm trước), mục 4 (S1-S13), mục 5 (sau kiểm thử).
- Mỗi bước có ô "Ghi kết quả". Đánh dấu một trong ba: Đạt, Không đạt, Chặn (bị điều kiện bên ngoài chặn, ghi rõ điều kiện).
- Không đạt: làm mục "Nếu hỏng" của bước đó, rồi báo sen1 (kèm dòng log, không kèm token). Không chạy tiếp các bước phụ thuộc vào bước đã hỏng.
- Bước bị chặn bởi thiếu tài khoản B hoặc thiếu quyền: ghi "Chặn", không đánh dấu Đạt.
- Các lệnh SQL chạy ở Supabase Dashboard > SQL Editor (quyền postgres, bỏ qua RLS). Trong SQL Editor `auth.uid()` là null, nên không gọi RPC từ đây; RPC chỉ gọi qua app.

## 1. Điều kiện tiên quyết

Đánh dấu từng mục trước khi bắt đầu.

- [ ] **Hai tài khoản Zalo**: A là Gymer (làm hồ sơ, đặt giá, nhận yêu cầu), B là khách (tìm và đặt lịch). Cả hai phải được phép mở bản Development. Cách thêm tài khoản tester vào Development trên console Zalo: CHƯA XÁC NHẬN, ghi lại cách đã làm: ______.
- [ ] Nếu chưa có tài khoản B: các bước S7, S8, S9, S10, S12 bị chặn. Các bước còn lại vẫn làm được. Không tự tạo `auth.users` bằng SQL để thay B (xem `docs/app-supabase-setup.md` mục 7).
- [ ] Thiết bị thật có Zalo cho A và B. Ghi model và phiên bản Zalo: ______. Việc giữ phiên trên thiết bị thật là một điểm chưa kiểm chứng (R5).
- [ ] Máy có Supabase CLI và quyền đặt secret cho project. Có quyền chạy GitHub Actions trên repo `hanglequan1991/gymer-oi`.
- [ ] Có quyền vào Dashboard của project Supabase (Edge Functions, Authentication, SQL Editor).
- [ ] Nhánh `main` trên GitHub đã có commit cần test. SHA: ______.
- [ ] **Gate trước khi đặt secret**: `docs/app-supabase-setup.md` mục 4.1 ghi rằng `auth-zalo` đọc cùng biến `ZALO_APP_SECRET`, và chưa kiểm xem verifier có gửi `secret_key` khi biến có giá trị hay không. sen1 đã xác nhận một trong hai: sửa `auth-zalo` hoặc chấp nhận có chủ đích và ghi vào mục 7. Nếu chưa có xác nhận, dừng ở mục 2.2. Ghi kết quả xác nhận: ______.
- [ ] Giá trị `ZALO_APP_SECRET` đã có sẵn (lấy theo `docs/app-supabase-setup.md` mục 2). Không lưu vào file trong repo.
- [ ] Đọc rủi ro ở mục 1.1 trước khi bắt đầu.

### 1.1 Rủi ro cần biết trước

- **Development dùng DB production.** Bản Development gọi cùng Supabase với app thật (R10, Q8 chưa quyết). Mọi dữ liệu test (A, B, hồ sơ, lịch, đánh giá) nằm trong DB thật. Người dùng thật có thể thấy A khi `is_listed = true`. Giữ A ở `is_listed = false` khi không cần test (S12 làm việc này).
- Mọi lệnh `UPDATE` hoặc `DELETE` phải có điều kiện rõ ràng (`user_id = '<UUID_A>'` hoặc `id` của booking test). Không chạy câu lệnh không có `WHERE`.
- Pipeline dispatch chạy lại `migrate`. Nếu có migration chờ, job `migrate` đòi duyệt ở environment `production`, và job `zalo` đứng chờ.

## 2. Triển khai trước khi test

Làm đúng thứ tự. Thứ tự quan trọng: secret `ZALO_APP_SECRET` phải có trước khi dispatch, vì job `functions` deploy lại function và `resolve-location` trả `500 CONFIG_MISSING` khi thiếu secret (fail-closed).

### 2.1 Đối chứng trước khi đặt secret (chỉ khi `resolve-location` đã có trên Supabase)

- [ ] Chạy lệnh ở Phụ lục A (S3), ca đầu tiên. Kỳ vọng: `500` với `CONFIG_MISSING`. Nếu kết quả khác, ghi lại và báo sen1 trước khi đặt secret.
- Ghi kết quả: ______

### 2.2 Đặt `ZALO_APP_SECRET` (BẮT BUỘC, làm trước 2.4)

Lệnh (lấy từ `docs/app-supabase-setup.md` mục 4.1). Giá trị không hiện trên màn hình, không nằm trên dòng lệnh:

```bash
read -rs -p "ZALO_APP_SECRET: " ZALO_APP_SECRET && echo
umask 077
mkdir -p "$HOME/.gymer-secrets"
printf 'ZALO_APP_SECRET=%s\n' "$ZALO_APP_SECRET" > "$HOME/.gymer-secrets/resolve-location.env"
unset ZALO_APP_SECRET
supabase secrets set --env-file "$HOME/.gymer-secrets/resolve-location.env" --project-ref <project-ref>
rm -f "$HOME/.gymer-secrets/resolve-location.env"
```

- [ ] Thư mục `$HOME/.gymer-secrets` nằm ngoài repo. Không đặt file này trong repo.
- Kỳ vọng: lệnh `set` báo thành công.
- Ghi kết quả: ______

### 2.3 Kiểm secret đã đặt

```bash
supabase secrets list --project-ref <project-ref>
```

- [ ] Danh sách có tên `ZALO_APP_SECRET`. Lệnh chỉ hiện tên và digest, không hiện giá trị.
- Nếu không có: dừng, đặt lại theo 2.2 (hoặc Dashboard > Edge Functions > Secrets).
- Ghi kết quả: ______

### 2.4 Kiểm biến và secret trên GitHub environment

Vào Settings > Environments > `production-deploy`. Không đặt giá trị vào chat.

- [ ] Variables: `VITE_DATA_SOURCE` = `supabase`; `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`; `ZMP_APP_ID` = App ID (chỉ chữ số).
- [ ] Variables: `ZMP_TOKEN_KIND` để trống (mặc định `access`) hoặc `jwt` nếu token là JWT (CHƯA CHỐT, Q1). `ZALO_PUSH_MODE` để trống hoặc `check`. Không đặt `deploy-dev` ở bước này.
- [ ] Secrets: `VITE_SUPABASE_ANON_KEY` là khoá anon/publishable. Không phải service-role, không phải `sb_secret_`. `ZMP_TOKEN` có giá trị (token Zalo, loại đã ghi ở trên).
- [ ] Deployment branches của environment chỉ là `main`. Không đặt reviewer ở `production-deploy` (job `zalo` không được chờ duyệt).
- Ghi kết quả: ______

### 2.5 Dispatch chế độ `login-only`

- [ ] Vào Actions > Deploy > Run workflow. Chọn nhánh **`main`** (không chọn nhánh khác). `zalo_mode` = `login-only`.
- [ ] Nếu đã có run đang chờ trong nhóm `deploy-production`, run mới sẽ huỷ run chờ cũ (ci-cd mục 8.10). Kiểm lại danh sách run trước khi dispatch.
- [ ] Theo dõi: job `ci`, `plan-migrate`, `migrate` (nếu cần duyệt ở `production`, duyệt hoặc dừng), `functions`, `zalo`.
- Kỳ vọng: `functions` xanh. `zalo` xanh, log có bước build, kiểm gói, cài `zmp-cli`, đăng nhập, dòng `exp`, `appId` khớp `ZMP_APP_ID`. Không có bước upload.
- Ghi kết quả: ______ (ghi run id, không ghi log có token)
- Nếu hỏng: xem `docs/ci-cd-setup.md` mục 8.5, bậc 3. Đăng nhập thất bại thường do sai loại token: thử đổi `ZMP_TOKEN_KIND` sang `jwt` rồi dispatch lại `login-only`.

### 2.6 Kiểm cấu hình JWT ở Dashboard (R1)

Dashboard > Edge Functions:

- [ ] `auth-zalo`: "Enforce JWT verification" TẮT.
- [ ] `resolve-location`: "Enforce JWT verification" BẬT.
- Nếu lệch: dừng, báo product-manager. Không tự sửa `deploy.yml`.
- Ghi kết quả: ______

### 2.7 Dispatch chế độ `deploy-dev` (một lần)

Chỉ làm khi 2.5 và 2.6 đạt.

- [ ] Actions > Deploy > Run workflow, nhánh `main`, `zalo_mode` = `deploy-dev`. Chạy một lần (ci-cd mục 8.5, bậc 4).
- [ ] Log job `zalo` có dòng hạn mức upload, URL bản Development, và dòng "Chưa phát hành production".
- [ ] Mở bản Development trên điện thoại A: mở được, không trắng màn hình, không có hai thanh tiêu đề, dữ liệu Supabase tải được, giá T7/CN đúng, icon và ảnh không vỡ.
- [ ] Không đặt `ZALO_PUSH_MODE` = `deploy-dev` trong bước này.
- Ghi kết quả: ______ (ghi run id và số lần upload còn lại theo dòng hạn mức)
- Nếu hỏng: theo ci-cd mục 8.5 (lỗi liên quan `-e` hoặc asset: dùng phương án dự phòng, rồi lặp bậc 4). Ghi lỗi, không tự chạy lại nhiều lần vì hạn mức Development có giới hạn (Q3).

### 2.8 Kiểm sau deploy

- [ ] Chạy lại lệnh ở Phụ lục A (S3), ca token giả. Kỳ vọng: không còn `500 CONFIG_MISSING`. Kết quả là `401 ZALO_TOKEN_INVALID` hoặc `502 ZALO_UNAVAILABLE` (CHƯA KIỂM CHỨNG, ghi kết quả thật).
- Ghi kết quả: ______

## 3. Kiểm trước khi bắt đầu S1 (baseline)

### 3.1 Từ chối đầu vào của `auth-zalo` (không cần tài khoản Zalo)

Chỉ dùng token giả. Không gõ token thật vào shell.

```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/auth-zalo" \
  -H "Content-Type: application/json" \
  -d '{"zaloAccessToken":"token-gia-khong-hop-le"}' -w "\n%{http_code}\n"
```

- [ ] Kỳ vọng: `401 ZALO_TOKEN_INVALID`. Nếu `500 CONFIG_MISSING`: thiếu secret (mục 2.2). Nếu `401` không có mã lỗi JSON: cổng đang chặn, kiểm mục 2.6.
- [ ] `GET` tới cùng endpoint: kỳ vọng `405`.
- [ ] `POST` với thân `{}`: kỳ vọng `400 INVALID_REQUEST`.
- Ghi kết quả: ______

### 3.2 Baseline trong SQL

Chạy trước S1. Ghi số liệu để so sánh sau S1 và S13.

```sql
select
  (select count(*) from auth.users)                  as so_user,
  (select count(*) from public.profiles)             as so_profile,
  (select count(*) from public.zalo_identities)      as so_identity,
  (select count(*) from public.gymer_profiles)       as so_gymer,
  (select count(*) from public.bookings)             as so_booking;
```

- Ghi kết quả: so_user ____, so_profile ____, so_identity ____, so_gymer ____, so_booking ____
- Ghi chú: DB này có người dùng thật, nên số liệu tuyệt đối không có ý nghĩa. Chỉ so sánh hiệu số trước và sau.

## 4. Các bước S1-S13

Mỗi bước có: thao tác, kết quả mong đợi, kiểm SQL (khi cần), và "Nếu hỏng".

Đặt biến để tiện theo dõi (ghi ra giấy, không ghi vào file):
- `<UUID_A>`: `profiles.id` của A. Lấy bằng: `select z.user_id, z.created_at from public.zalo_identities z order by z.created_at desc;` rồi chọn hàng vừa tạo ở S1.
- `<UUID_B>`: tương tự, sau khi B đăng nhập lần đầu.
- `<ID_BOOKING_1>`, `<ID_BOOKING_2>`: id booking tạo ở S8 và S10.

Lưu ý: không chạy mục 6.4 của `docs/app-supabase-setup.md` (gieo `gymer_profiles` bằng SQL) cùng với bộ bước này. S4 tạo hồ sơ Gymer bằng app, và `gymer_profiles.user_id` là khoá chính, nên insert thứ hai sẽ lỗi.

---

### S1. Mở app lần đầu bằng A

- Thao tác: đăng nhập A trên bản Development (lần đầu trên thiết bị này). Nếu A đã từng đăng nhập trước đó, ghi rõ và so sánh hiệu số ở bước SQL.
- Kỳ vọng: đăng nhập tự động, vào trang tìm kiếm. Không có thao tác đăng nhập thủ công.
- Kiểm SQL:

```sql
select id, display_name, created_at from public.profiles order by created_at desc limit 5;
select zalo_id, user_id, created_at from public.zalo_identities order by created_at desc limit 5;
select count(*) as user_thieu_profile
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
```

  Kỳ vọng so với baseline 3.2: `profiles` +1, `zalo_identities` +1, `auth.users` +1, `user_thieu_profile` = 0.
- Mở lại (đóng hẳn rồi mở): vẫn đăng nhập, số liệu không đổi.
- Nếu hỏng: xem log Edge Function `auth-zalo` (Dashboard > Edge Functions > Logs), ghi mã lỗi hiển thị. Kiểm lại mục 2.6. Chạy S13 để tìm user mồ côi.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn   Ghi chú: ______

---

### S2. Ngắt mạng rồi mở app

- Thao tác: đóng hẳn Mini App. Tắt Wi-Fi và dữ liệu di động. Mở lại Mini App. Chờ. Bật mạng. Bấm "Thử lại".
- Kỳ vọng: hiện màn "Chưa đăng nhập được" có nút "Thử lại". App tự thử lại 2 lần trước khi hiện màn này (ghi nếu quan sát được). Sau khi bật mạng và bấm "Thử lại", vào được trang tìm kiếm. Không có trang trắng.
- Nếu hỏng: trang trắng, thiếu nút "Thử lại", hoặc không vào được sau khi có mạng. Chụp màn hình (không chứa thông tin cá nhân), ghi bước làm và thời điểm, báo sen1.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn   Ghi chú: ______

---

### S3. Gọi `resolve-location` với token giả

- Thao tác: chạy các lệnh ở Phụ lục A (cuối tài liệu), ca token giả.
- Kỳ vọng: ca token giả cho `401 ZALO_TOKEN_INVALID` hoặc `502 ZALO_UNAVAILABLE`. Không có `500 CONFIG_MISSING`.
- Ghi lại mã lỗi Zalo thật trong log của function (không ghi token). Mã này dùng để đóng giả thuyết S2 trong `docs/spikes/s2-resolve-location.md`.
- Nếu hỏng: `500 CONFIG_MISSING` là thiếu secret (mục 2.2). Các lỗi khác: ghi nguyên văn, báo sen1. Nếu S3 hỏng, theo plan: ghi nhận R1 và dừng nhánh S5 (vị trí của Gymer). Khi đó B vẫn kiểm được S7 bằng lối chọn khu vực.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn   Mã thật: ______

---

### S4. A: vào `/gymer`, điền form, gửi

- Thao tác: A mở mục Gymer. Hệ thống chuyển sang `/gymer/join`. Điền form, gửi.
- Kỳ vọng: form gửi thành công. App chuyển sang tab Hồ sơ.
- Kiểm SQL (thay `<UUID_A>`):

```sql
select user_id, display_name, is_listed, accepts_requests, price_weekday_vnd, price_weekend_vnd
from public.gymer_profiles where user_id = '<UUID_A>';

select count(*) as so_gio_mo from public.gymer_open_hours where gymer_id = '<UUID_A>';
```

  Kỳ vọng: đúng 1 hàng, `is_listed = false`. `gymer_open_hours` có 8 hàng.
- Nếu hỏng: ghi lỗi hiển thị trên form. Nếu có hàng `gymer_profiles` nhưng thiếu `gymer_open_hours`, ghi số hàng thực tế và báo sen1. Không tự sửa bằng SQL trước khi báo.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn   Ghi chú: ______

---

### S5. A: Hồ sơ, đặt vị trí, bật hiển thị

- Thao tác: vào tab Hồ sơ, mục "Phòng tập / địa điểm công cộng". Cho phép quyền vị trí trên điện thoại. Bấm "Đặt vị trí hiện tại làm vị trí phòng tập". Sau khi lưu, bật công tắc Hiển thị.
- Kỳ vọng: thông báo "Đã lưu địa điểm". Dòng trạng thái là "Đã đặt vị trí (làm tròn khoảng 100 m)". Công tắc Hiển thị bật được. Không có toạ độ hiện trên màn hình.
- Kiểm SQL:

```sql
select user_id, lat, lng, updated_at from public.gymer_locations where user_id = '<UUID_A>';
select user_id, is_listed from public.gymer_profiles where user_id = '<UUID_A>';
```

  Kỳ vọng: 1 hàng; `lat` và `lng` có tối đa 3 chữ số thập phân (ví dụ `10.777`); `is_listed = true`.
- Nếu hỏng: từ chối quyền thì kiểm nút "Thử lại" và thông báo. Nếu lỗi định vị (`CONFIG_MISSING`, `ZALO_UNAVAILABLE`), ghi nhận R1 và dừng nhánh này theo plan. Báo sen1.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn   Ghi chú: ______

---

### S6. A: Lịch và giá

- Thao tác: (a) đổi giá mặc định ngày thường và T7/CN; (b) đặt giá riêng cho một ngày; (c) đóng một khung giờ; (d) áp dụng hàng loạt cho một khoảng ngày.
- Kỳ vọng: mỗi thao tác lưu thành công. Lịch tải lại đúng với thay đổi.
- Kiểm SQL:

```sql
select gymer_id, day, is_open, price_vnd
from public.gymer_day_overrides where gymer_id = '<UUID_A>' order by day;

select gymer_id, day, start_time, is_open
from public.gymer_slot_overrides where gymer_id = '<UUID_A>' order by day, start_time;

select price_weekday_vnd, price_weekend_vnd from public.gymer_profiles where user_id = '<UUID_A>';
```

  Kỳ vọng: có hàng cho ngày đã đặt giá riêng, khung đã đóng có `is_open = false`, giá khớp với màn hình. Với thao tác (d), số hàng khớp số ngày trong khoảng đã chọn.
- Nếu hỏng: ghi ngày, khung và thông báo lỗi. Không sửa SQL bằng tay trước khi báo sen1.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn   Ghi chú: ______

---

### S7. B: mở app, cho phép vị trí, tìm

- Thao tác: B đăng nhập lần đầu (ghi lại `<UUID_B>` như S1). Cho phép quyền vị trí. Tìm Gymer.
- Kỳ vọng: thấy A trong bán kính. Đổi bán kính sang 1 km: nếu A ở xa hơn 1 km thì A biến mất. Thử một bộ lọc có sẵn: kết quả khớp dữ liệu của A.
- Lưu ý: nếu A và B cùng một chỗ, không phân biệt được việc A biến mất theo bán kính. Khi đó chọn một khu vực khác xa hơn 1 km bằng lối chọn khu vực, rồi kiểm.
- Từ chối quyền vị trí: tắt quyền vị trí của Mini App, mở lại. App hiện "Hoặc chọn khu vực của bạn". Chọn một khu vực có A, bấm tìm. A xuất hiện.
- Nếu hỏng và không thấy A: kiểm SQL.

```sql
select user_id, is_listed from public.gymer_profiles where user_id = '<UUID_A>';
select user_id, lat, lng from public.gymer_locations where user_id = '<UUID_A>';
```

  Kiểm `is_listed = true`, có toạ độ. Nếu đúng mà vẫn không thấy, báo sen1 (có thể do RPC `search_gymers` hoặc giới hạn bán kính).
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn (thiếu B)   Ghi chú: ______

---

### S8. B: xem giá, chọn giờ, đặt lịch

- Thao tác: B mở A. Xem giá một ngày thường và một ngày T7 hoặc CN. Chọn ngày và giờ: giờ tròn, trong 8h đến 20h giờ VN, cách hiện tại ít nhất 2 giờ, trong 60 ngày tới. Đặt.
- Kỳ vọng:
  - Giá ngày thường khớp `price_weekday_vnd` của A. Giá T7/CN khớp `price_weekend_vnd`.
  - Sau khi đặt: trang thành công đúng.
- Kiểm SQL (thay `<UUID_B>`):

```sql
select id, gymer_id, customer_id, status, starts_at, ends_at, price_vnd, expires_at
from public.bookings order by created_at desc limit 5;

select bk.id, bk.status, hn.booking_id as co_ghi_chu_suc_khoe
from public.bookings bk
left join public.booking_health_notes hn on hn.booking_id = bk.id
where bk.customer_id = '<UUID_B>' order by bk.created_at desc limit 5;
```

  Kỳ vọng: đúng 1 hàng `status = pending`, `customer_id = <UUID_B>`, `gymer_id = <UUID_A>`, `price_vnd` bằng giá đã hiển thị. Cột `co_ghi_chu_suc_khoe` rỗng (không có ghi chú sức khoẻ, vì `shareHealthNote` luôn `false`).
- Ghi lại: `<ID_BOOKING_1>`.
- Nếu hỏng: giá sai (ghi giá hiển thị, giá trong DB). Nếu lỗi `PRICE_CHANGED` ngoài ý muốn, ghi nguyên văn. Nếu lỗi khác, ghi mã và báo sen1.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn (thiếu B)   Ghi chú: ______

---

### S9. B: đặt lại đúng khung vừa đặt

- Thao tác: đặt lại đúng khung giờ của `<ID_BOOKING_1>`. Cách làm: mở cùng khung trên hai thiết bị của B, hoặc mở một phiên thứ hai của B và đặt cùng khung. Nhập ghi chú vào form trước khi bấm đặt, để kiểm nội dung còn nguyên.
- Kỳ vọng: hiện lỗi `SLOT_TAKEN` với câu thông báo đúng ngữ cảnh. Nội dung đã nhập còn nguyên. Không có thêm booking.
- Kiểm SQL:

```sql
select count(*) as so_booking_cung_khung
from public.bookings
where gymer_id = '<UUID_A>' and starts_at = (select starts_at from public.bookings where id = '<ID_BOOKING_1>')
  and status in ('pending', 'confirmed');
```

  Kỳ vọng: 1.
- Nếu hỏng và có 2 booking cùng khung: DỪNG ngay, báo sen1. Đây là lỗi chống trùng ở server (ràng buộc `bookings_no_overlap`), mức nghiêm trọng cao.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn (thiếu B)   Ghi chú: ______

---

### S10. A: xác nhận và từ chối; B: "Lịch của tôi"

- Thao tác:
  1. A mở tab Yêu cầu, xác nhận `<ID_BOOKING_1>`.
  2. B mở "Lịch của tôi".
  3. B đặt thêm một lịch khác (khung khác, đủ điều kiện như S8). Ghi `<ID_BOOKING_2>`.
  4. A từ chối `<ID_BOOKING_2>` trước khi hết hạn (cột `expires_at`).
- Kỳ vọng: sau bước 1, trạng thái `Đã xác nhận` ở cả hai phía (A ở tab Yêu cầu, B ở Lịch của tôi). Sau bước 4, `<ID_BOOKING_2>` ở trạng thái từ chối phía B.
- Kiểm SQL:

```sql
select id, status, responded_at from public.bookings
where id in ('<ID_BOOKING_1>', '<ID_BOOKING_2>');
```

  Kỳ vọng: booking 1 `confirmed`, booking 2 `rejected`, cả hai có `responded_at`.
- Lưu ý kiểm R8: tab Yêu cầu của A hiện đúng tên khách. Nếu tên khách trống hoặc lỗi, ghi lại và báo sen1 (cần tách truy vấn embed).
- Nếu hỏng: ghi trạng thái hiển thị và trạng thái trong DB. Nếu A không xác nhận được, kiểm `expires_at` và thời điểm bấm.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn (thiếu B)   Ghi chú: ______

---

### S11. B: huỷ một lịch; B: đánh giá một buổi đã kết thúc

- Thao tác:
  1. B huỷ một lịch đang hiệu lực. `<ID_BOOKING_2>` đã bị từ chối ở S10 nên không dùng được. B đặt thêm một lịch thứ ba (khung khác, đủ điều kiện như S8), rồi huỷ lịch đó. Ghi `<ID_BOOKING_3>`.
  2. Để đánh giá, `<ID_BOOKING_1>` phải `confirmed` và đã kết thúc. Chạy SQL dưới đây để đưa lịch về quá khứ (thay `<ID_BOOKING_1>`):

```sql
update public.bookings
set starts_at = now() - interval '3 hours',
    ends_at   = now() - interval '2 hours'
where id = '<ID_BOOKING_1>';
```

  Giữ đúng khoảng 60 phút (ràng buộc `bookings_duration_60m`). Nếu trigger hoặc ràng buộc chặn câu lệnh, ghi lỗi và báo sen1.
  3. B đánh giá `<ID_BOOKING_1>` (ví dụ 5 sao, có nhận xét ngắn).
- Kỳ vọng:
  - Huỷ: trạng thái `Đã huỷ` ở B. Trong DB, `<ID_BOOKING_3>`: `status = cancelled`, `cancelled_at` có giá trị, `cancelled_by = <UUID_B>`.
  - Đánh giá: lưu thành công. Nút đánh giá biến mất ở B. `rating_avg` của A cập nhật.
- Kiểm SQL:

```sql
select id, status, cancelled_at, cancelled_by from public.bookings
where id in ('<ID_BOOKING_1>', '<ID_BOOKING_2>', '<ID_BOOKING_3>');

select id, booking_id, rating, body, author_name, created_at
from public.reviews order by created_at desc limit 3;

select rating_avg, rating_count from public.gymer_profiles where user_id = '<UUID_A>';
```

  Kỳ vọng: `rating_count` tăng 1; `rating_avg` bằng trung bình các đánh giá (nếu chỉ có một đánh giá thì bằng đúng số sao).
- Nếu hỏng: lỗi `FORBIDDEN` khi đánh giá nghĩa là lịch chưa `confirmed` hoặc chưa kết thúc (`ends_at < now()`). Ghi lại trạng thái và `ends_at`.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn (thiếu B)   Ghi chú: ______

---

### S12. A tắt hiển thị, B tìm lại

- Thao tác: A vào Hồ sơ, tắt công tắc Hiển thị. B tìm lại (làm mới hoặc tìm lại với cùng vị trí và bán kính).
- Kỳ vọng: A không còn trong kết quả của B.
- Kiểm SQL: `select user_id, is_listed from public.gymer_profiles where user_id = '<UUID_A>';` kỳ vọng `is_listed = false`.
- Sau bước này, giữ A ở `is_listed = false` cho đến khi kết thúc kiểm thử (xem mục 1.1).
- Nếu hỏng: A vẫn xuất hiện. Kiểm `is_listed`. Nếu `is_listed = false` mà vẫn xuất hiện, ghi bộ lọc và báo sen1 ngay (lỗi lộ hồ sơ ẩn).
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn (thiếu B)   Ghi chú: ______

---

### S13. Kiểm kê user mồ côi

- Thao tác: chạy truy vấn dưới đây (`docs/app-supabase-setup.md` mục 6.10).

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

- Kỳ vọng: 0 hàng.
- Nếu có hàng: user mồ côi do function dừng giữa chừng. Chấp nhận v1 (review C, G-b), không tự dọn. Ghi số hàng và id. Xoá tay trên Dashboard > Authentication chỉ khi chắc không liên quan đến phiên đăng nhập nào.
- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn   Số hàng: ____

---

## Phụ lục A. Smoke test `resolve-location` (dùng cho S3 và mục 2.1, 2.8)

Chuẩn bị: lấy khoá publishable (anon) từ Dashboard > Settings > API. Đọc vào biến shell, không hiện ra màn hình. Không dùng service-role key.

```bash
read -rs -p "Publishable key: " SB_PUBLISHABLE_KEY && echo
```

```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/resolve-location" \
  -H "Authorization: Bearer $SB_PUBLISHABLE_KEY" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"zaloAccessToken":"token-gia-khong-hop-le-1234","locationToken":"loc-gia-khong-hop-le"}' \
  -w "\n%{http_code}\n"
```

Các ca (chạy theo thứ tự):

- [ ] Trước khi đặt secret (mục 2.1): `500` với `CONFIG_MISSING`.
- [ ] Sau khi đặt secret (mục 2.8): `401 ZALO_TOKEN_INVALID` nếu Zalo trả 452, hoặc `502 ZALO_UNAVAILABLE` nếu Zalo trả mã khác. CHƯA KIỂM CHỨNG: ghi kết quả thật, không đoán.
- [ ] `GET` không có thân: `405 METHOD_NOT_ALLOWED`.
- [ ] `POST` thân `{}`: `400 INVALID_REQUEST`.
- [ ] `POST` không có header `Authorization`: `401` từ cổng (`verify_jwt = true`). Phản hồi có thể không có JSON của handler, đó là dấu hiệu cổng đang chặn đúng.
- [ ] `POST` với anon key: kỳ vọng `401 UNAUTHENTICATED` sau khi handler kiểm role `authenticated` (F4 của plan đợt 3-6). Nếu F4 chưa có trên `main`, chỉ ghi nhận kết quả hiện tại. Kiểm thêm trong `docs/plans/app-ui-integration-review-dot-3-6.md`.

Chỉ dùng token giả trong các lệnh này. Token vị trí thật chỉ đi qua app.

- Ghi kết quả: [ ] Đạt  [ ] Không đạt  [ ] Chặn   Ghi chú: ______

---

## 5. Sau kiểm thử

- [ ] Giữ A ở `is_listed = false` (đã làm ở S12). Không để dữ liệu test hiển thị cho người dùng thật.
- [ ] Liệt kê các hàng test đã tạo (theo `<UUID_A>`, `<UUID_B>`, `<ID_BOOKING_1>`, `<ID_BOOKING_2>`) để product-manager quyết định dọn. Chưa có kịch bản dọn đã kiểm. Không xoá tự động. Xoá tay có điều kiện `where`, và xoá `auth.users` qua Dashboard như mục 6.10.
- [ ] Ghi kết quả tổng hợp vào bảng ở mục 6 và gửi cho sen1 để review (plan mục 6.4).
- [ ] Ghi vào `docs/spikes/s2-resolve-location.md` mã lỗi Zalo thật (S3) và kết quả các ca Phụ lục A. Không ghi token hay toạ độ.

## 6. Bảng tổng hợp kết quả

| Bước | Kết quả (Đạt / Không đạt / Chặn) | Ghi chú (không chứa token, toạ độ) | Người kiểm | Ngày |
|---|---|---|---|---|
| 2.1 Đối chứng trước secret | | | | |
| 2.2 Đặt `ZALO_APP_SECRET` | | | | |
| 2.3 `secrets list` có tên | | | | |
| 2.4 Biến GitHub `production-deploy` | | | | |
| 2.5 Dispatch `login-only` | | | | |
| 2.6 JWT ở Dashboard | | | | |
| 2.7 Dispatch `deploy-dev` (một lần) | | | | |
| 2.8 Kiểm sau deploy | | | | |
| 3.1 Từ chối đầu vào `auth-zalo` | | | | |
| 3.2 Baseline SQL | | | | |
| S1 Đăng nhập lần đầu (A) | | | | |
| S2 Ngắt mạng | | | | |
| S3 `resolve-location` | | | | |
| S4 Hồ sơ Gymer (A) | | | | |
| S5 Vị trí và hiển thị (A) | | | | |
| S6 Lịch và giá (A) | | | | |
| S7 Tìm kiếm (B) | | | | |
| S8 Đặt lịch (B) | | | | |
| S9 Đặt trùng khung | | | | |
| S10 Xác nhận và từ chối | | | | |
| S11 Huỷ và đánh giá | | | | |
| S12 Tắt hiển thị | | | | |
| S13 User mồ côi | | | | |

Điều kiện hoàn tất (plan 6.4): các bước S1-S13 đạt, hoặc bước bị chặn được ghi rõ là chưa kiểm; sen1 review cuối trả "Đạt".
