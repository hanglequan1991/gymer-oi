# Review Đợt B (M2-M5) và M6 - schema v1

Reviewer: sen1. Ngày: 2026-10-10. Chỉ đọc và chạy lệnh kiểm; không sửa file của dev. Tham chiếu: `docs/plans/supabase-schema-v1.md` (2.4, 2.5, 2.6, 3.2 mục 5, 7, 9), `docs/plans/schema-v1-review-dot-a.md`.

Bối cảnh quan trọng: environment `production` CHƯA có Required reviewers, nên khi M2-M5 lên `main`, job `migrate` tự áp lên production không ai duyệt. Review này là cổng duy nhất. Database đang trống nên rủi ro mất dữ liệu bằng 0, nhưng cấu trúc đã áp chỉ sửa được bằng migration mới.

## 1. Kết luận

| File | Kết luận | Ghi chú |
|---|---|---|
| M2 `20261010100100_core_profile_tables.sql` | ĐẠT, kèm 2 sửa nhỏ nên làm trước khi áp (mục 4) | thiếu revoke hàm `private`, thiếu check độ dài `display_name`/`area_label` |
| M3 `20261010100200_schedule_tables.sql` | ĐẠT, không cần sửa | |
| M4 `20261010100300_booking_tables.sql` | ĐẠT, kèm 1 sửa nên làm trước khi áp | thêm unique ghép cho khoá ngoại của `reviews`, thêm check `cancelled_by` |
| M5 `20261010100400_reviews_and_triggers.sql` | ĐẠT, kèm 2 sửa nên làm trước khi áp | khoá ngoại ghép; bỏ `grant execute` thừa |
| M6 `20261010100500_rls_gymer_side.sql` | ĐẠT, không cần sửa (merge ở Đợt C) | khớp ma trận 2.5 |
| M7 `20261010100600_rls_booking_review.sql` | ngoài phạm vi review này (dev3 đang làm); chỉ đọc lướt, không thấy vấn đề | |

An toàn để merge Đợt B (M2-M5) bây giờ: CÓ, VỚI ĐIỀU KIỆN:
1. Áp bản vá mục 4 vào M2, M4, M5 trước (đã thử: bản vá áp sạch, `run.sh` xanh kể cả `10_rls.sql` của dev3 và các ca bất biến bổ sung). Không vá vẫn an toàn về dữ liệu (không có chỗ nào chặn) nhưng sẽ phải thêm migration sửa sau.
2. Chỉ ĐÚNG M2, M3, M4, M5 nằm trong `supabase/migrations/` của commit/PR lên `main`. M6 và M7 PHẢI để ngoài (Đợt C), nếu không `migrate` sẽ tự áp cả policy khi chưa có người duyệt. Thư mục `supabase/tests/local/` không kích hoạt migrate nên vào cùng được.
3. Đợt A đã áp xong và dry-run kế tiếp ra `up to date` (M2 phụ thuộc enum `gender` của M1 và schema `private`).
4. Người dùng biết là không có bước duyệt tay cho `migrate`; cân nhắc bật Required reviewers cho `production` trước Đợt C và D (policy/RPC sai nguy hiểm hơn bảng đóng).
5. Sau patch, chạy lại `bash supabase/tests/local/run.sh` => xanh (PM chạy lại, không tin báo cáo).

## 2. Bằng chứng đã chạy

- `bash scripts/ci/scan-migrations.sh` cho từng file M2-M6: "không thấy mẫu nguy hiểm" (0 cảnh báo). `grep` các mẫu `drop table|truncate|delete from|alter column|verified|certificate_status|is_certified|anon` trong M2-M6: không có (chỉ `drop policy if exists` ở M6 và `revoke ... from anon` có chủ đích).
- `bash supabase/tests/local/run.sh` trên cây hiện tại (M1-M7 + `00_m1_smoke.sql` + `10_rls.sql` của dev3): mọi file áp hai lần OK, mọi test OK, `XONG: tất cả đạt`, không sót `/var/tmp/gymer-pgtest.*`. (M7 và `10_rls.sql` đã có khi tôi chạy.)
- Trên bản sao tạm có bản vá (ngoài repo) tôi thêm hai test ngoài cây repo: bất biến M2-M5 và khoá ngoại ghép của `reviews`. Kết quả đạt:
  - tuổi dưới 18 bị `VALIDATION`; seed đúng 8 giờ mở khi tạo Gymer; toạ độ `10.77649, 106.70081` lưu `10.776, 106.701`; chứng chỉ thứ 11 bị `LIMIT_REACHED`;
  - hai booking `pending` cùng khung => `exclusion_violation`; booking `confirmed` lệch 30 phút chồng => bị chặn; booking liền kề `[)` được; booking `rejected` cùng khung được; buổi 70 phút bị check; tự đặt (`customer_id = gymer_id`) bị check; `status = cancelled` thiếu `cancelled_at` bị check;
  - đánh giá sai Gymer hoặc sai tác giả so với booking => `foreign_key_violation`; đúng thì được và `rating_avg` tính lại đúng (4.00);
  - không còn hàm nào trong `private` mà `authenticated`/`anon` có EXECUTE.
  Các test này KHÔNG nằm trong repo; dev3 nên đưa bản bất biến vào `supabase/tests/local/cases/` (xem mục 5).

## 3. Checklist 3.2 mục 5, 7, 9 và bất biến

| Hạng mục | Kết quả |
|---|---|
| Mục 5: mọi `create table` kèm `enable row level security` + `revoke all ... from anon, authenticated` cùng file (M2: 7 bảng; M3: 3; M4: 2; M5: 1) | ĐẠT |
| Mục 7: không `drop table/column`, `truncate`, `delete from`, `alter column ... type` | ĐẠT |
| Mục 9: không `certificate_status`, `is_certified`, `verified`, `file_path`; `certificates` chỉ `id`, `gymer_id`, `name` + cột thời gian | ĐẠT |
| Tên bảng/cột khớp 2A (kể cả `cancelled_at`, `cancelled_by`) | ĐẠT. Lệch nhỏ so với 2A: `display_name`, `area_label` chưa có check độ dài (sửa ở mục 4) |
| `bookings_no_overlap`: `gymer_id with =`, `tstzrange(starts_at, ends_at, '[)') with &&`, `where status in ('pending','confirmed')`, bọc kiểm `pg_constraint` | ĐẠT (đã thử hành vi, mục 2) |
| Check 60 phút, tự đặt, huỷ nhất quán | ĐẠT. Thiếu chiều ngược `cancelled_by` (sửa ở mục 4) |
| Trigger seed 8 giờ, DEFINER + `search_path = ''` + comment lý do | ĐẠT |
| Giới hạn 10 chứng chỉ (advisory lock theo Gymer, chỉ BEFORE INSERT; không thể chuyển chứng chỉ sang Gymer khác vì không có `grant update (gymer_id)`) | ĐẠT |
| Tuổi >= 18 theo giờ Việt Nam; làm tròn toạ độ 3 chữ số | ĐẠT |
| `recompute_rating` + `reviews_sync_rating` (insert/update/delete, đổi Gymer tính cả hai), DEFINER + `search_path = ''` + lý do | ĐẠT. `grant execute ... to authenticated` thừa (sửa ở mục 4) |
| Hàm DEFINER: `limit_certificates`, `seed_open_hours`, `recompute_rating`, `reviews_sync_rating` đều có `set search_path = ''` và comment "DEFINER vì" | ĐẠT |
| Idempotent: `create table/index if not exists`, `create or replace function/trigger` (cần PG14+, prod là 17), `insert ... on conflict do nothing`, constraint thêm bằng DO có kiểm; harness áp hai lần mỗi file OK | ĐẠT |
| Mỗi file một giao dịch ở harness (`psql -1`); M2-M5 không có lệnh cấm trong giao dịch (không `create index concurrently`) | ĐẠT |

M6 theo ma trận 2.5:
- Không có `grant`/policy cho `anon` (test `10_rls.sql` kiểm cả chiều này).
- `rating_avg`, `rating_count`, `user_id` (khi update), `created_at`, `updated_at` không ghi được; `certificates` chỉ ghi `name`; `gymer_id` không ghi được sau khi tạo; `gymer_specialties` chỉ insert/delete.
- `gymer_locations`: chỉ chủ select/insert/update (lat, lng); khách khác không đọc được toạ độ (không có policy nào khác trên bảng này, kể cả M7).
- Bảng lịch: chỉ chủ. `specialties`: đọc cho authenticated, không ghi.
- `gymer_specialties`, `certificates` đọc theo quyền đọc `gymer_profiles` (subquery chịu RLS của `gymer_profiles`): đúng ý.
Quan sát (không chặn): ba bảng override không giới hạn số hàng mỗi Gymer (một Gymer có thể chèn rất nhiều hàng). Chấp nhận ở v1; ghi vào rủi ro khi làm hạn mức.

## 4. Chốt sáu điểm mở của dev

1. `gymer_locations`: CHỐT GIỮ cho CHỦ đọc/ghi hàng của mình (như dev2 làm). Lý do: plan 2.3 và 2.5 đã ghi "chỉ chủ sở hữu đọc/ghi"; câu "client không đọc được toạ độ" trong T5 là nói về client khác. Chủ cần đọc điểm của mình để hiện/sửa trong form hồ sơ, và giá trị đã bị làm tròn 3 chữ số, nên không lộ thêm gì. Bỏ quyền đọc của chủ thì phải thêm RPC DEFINER `get_my_location`/`set_my_location` (thêm bề mặt, thêm test, upsert phải qua RPC) mà không lợi gì về riêng tư. Không sửa.
2. `gymer_profiles` được client sửa `gender`, `birth_year`, `is_listed`: CHỐT GIỮ ở v1, không sửa M6. Lý do:
   - `birth_year`/`gender` là tự khai, không có cách xác minh trong app. Khoá không cho sửa không ngăn khai gian (khai sai ngay lúc tạo vẫn được). Trigger 18+ là kiểm hợp lệ dữ liệu, KHÔNG phải cơ chế kiểm soát tuổi. Khoá lại chỉ làm sửa nhầm phải nhờ admin. Nếu người dùng coi giới hạn 18+ là yêu cầu pháp lý thì đó là yêu cầu xác minh danh tính, ngoài v1.
   - `is_listed`: schema không thể và không nên thực thi "chính sách pháp lý R11". Kiểm soát thật là vận hành: chưa phát hành app cho người dùng thật trước khi có chính sách quyền riêng tư. Hiện thời không ai ghi được: bảng `profiles` chỉ do service role (edge function `auth-zalo`, chưa có) tạo, và `gymer_profiles` có khoá ngoại tới `profiles`, nên tài khoản tự đăng ký email (nếu Supabase Auth đang cho) cũng không tạo được Gymer. Khuyến nghị cứng cho người dùng: vào Dashboard > Authentication và TẮT email sign-up/anonymous sign-in (không đọc được cấu hình hiện tại ở đây nên không khẳng định đang bật).
   - Nếu sau này muốn Gymer chỉ lên danh sách sau khi admin duyệt: một migration `revoke update (is_listed)` + RPC/duyệt tay là đủ, tương thích ngược. Không cần đổi bây giờ.
   - Đề xuất thêm nhỏ, nên làm ngay trong M2: check độ dài `display_name` (1-50) và `area_label` (1-100) (trong bản vá).
3. Thiếu `revoke ... from public, anon, authenticated` cho hàm trigger trong `private`: mức nghiêm trọng thực tế THẤP, nhưng nên sửa TRƯỚC khi áp vì rẻ. Lý do thấp: schema `private` đã bị `revoke usage` với public/anon/authenticated ở M1 nên client không gọi được hàm nào trong đó (cũng không lộ qua API); trigger chạy không cần EXECUTE tại thời điểm kích hoạt (EXECUTE chỉ kiểm lúc tạo trigger). Rủi ro còn lại là phòng thủ chiều sâu: nếu sau này ai đó cấp USAGE trên `private`, các hàm DEFINER (`limit_certificates`...) thành gọi được ngay vì Postgres mặc định cấp EXECUTE cho PUBLIC, và `recompute_rating` còn bị `grant execute ... to authenticated` tường minh (thừa, vì chỉ trigger DEFINER gọi nó). Sửa trong bản vá: revoke cho 4 hàm ở M2, bỏ grant ở M5. Không đụng M1 (đã áp).
4. `reviews.gymer_id`/`author_id` không bị ràng buộc khớp booking: KHÔNG chấp nhận chỉ dựa vào RPC; sửa ngay trong M4/M5 bằng khoá ngoại ghép (khai báo, không thêm hàm/trigger): M4 thêm `unique (id, gymer_id, customer_id)` trên `bookings`; M5 thay khoá ngoại đơn `booking_id` bằng `foreign key (booking_id, gymer_id, author_id) references bookings (id, gymer_id, customer_id) on delete cascade` (giữ `unique (booking_id)`). Lý do: tính toàn vẹn của `rating_avg` phụ thuộc đúng cột `gymer_id`; admin sửa tay hoặc lỗi RPC sau này không thể gắn đánh giá sai Gymer. Chi phí: một unique index phụ (id, gymer_id, customer_id) trên `bookings`, không đáng kể ở quy mô này. Đã thử: bản vá không làm hỏng seed của `10_rls.sql`.
5. `bookings_no_overlap` dùng opclass mặc định của `btree_gist` không ghi `extensions.`: RỦI RO THẤP. Chắc: lớp toán tử mặc định cho kiểu `uuid` được chọn theo catalog (kiểu dữ liệu + phương thức truy cập + `opcdefault`), không theo `search_path`; harness cục bộ tạo extension ở schema `extensions` (không có trong `search_path` mặc định của phiên) và tạo ràng buộc thành công, chạy lại cũng không lỗi. Không chắc: hành vi y hệt trên Supabase hosted với role migration thật (chưa chạy); điều kiện tiên quyết là M1 đã tạo được `btree_gist` ở Đợt A. Nếu Đợt A đã áp xong và `up to date`, rủi ro còn lại của điểm này rất nhỏ. Không sửa.
6. Ba chi tiết còn lại: CHẤP NHẬN cả ba.
   - Index `gymer_locations (lat, lng)` btree thường: plan 2A ghi "một phần" nhưng bảng không có cột để làm vị từ (`is_listed` nằm ở `gymer_profiles`), nên "một phần" trong plan là sai chỗ. Giữ index thường; tác dụng nhỏ ở quy mô vài trăm Gymer, vô hại.
   - `gymer_specialties on delete cascade`: giữ (xoá Gymer qua admin thì chuyên môn đi theo; không có đường xoá từ client).
   - `reviews.booking_id on delete cascade` so với `restrict` ở nơi khác: giữ cascade, vì trigger `reviews_sync_rating` xử lý nhánh DELETE nên `rating_avg` vẫn đúng; `restrict` sẽ chặn admin xoá booking. Đây là quyết định chủ ý, ghi lại. (Lịch sử booking đã qua giờ không bao giờ bị xoá trong app; xoá là thao tác admin ngoài app.)

## 5. Yêu cầu sửa (tự chứa) - làm TRƯỚC khi merge Đợt B

Cách làm: mỗi dev sửa đúng file được giao theo diff dưới đây; không sửa file khác; không đổi tên file; sau khi sửa chạy `bash supabase/tests/local/run.sh` (phải xanh) và `bash scripts/ci/scan-migrations.sh <file>` cho file mình sửa (0 cảnh báo); báo lại đầu ra thật. Các file chưa áp lên production nên được phép sửa tại chỗ (theo `docs/supabase-migrations.md`: chỉ cấm sửa file ĐÃ áp dụng; M1 đã áp nên KHÔNG đụng).

- dev2: sửa `supabase/migrations/20261010100100_core_profile_tables.sql` (M2) và `supabase/migrations/20261010100400_reviews_and_triggers.sql` (M5).
  - M2: thêm `check (char_length(display_name) between 1 and 50)` vào `gymer_profiles.display_name`; thêm `check (char_length(area_label) between 1 and 100)` vào `area_label`; thêm `revoke all on function private.<ten>() from public, anon, authenticated;` ngay sau định nghĩa hàm cho `set_updated_at`, `check_gymer_age`, `round_gymer_location`, `limit_certificates` (đặt trước `create or replace trigger` dùng nó).
  - M5: `booking_id uuid not null unique,` (bỏ `references`); thêm `constraint reviews_booking_parties_fkey foreign key (booking_id, gymer_id, author_id) references public.bookings (id, gymer_id, customer_id) on delete cascade` vào cuối danh sách cột của `create table`; đổi `revoke ... from public, anon;` + `grant execute ... to authenticated;` của `private.recompute_rating(uuid)` thành một dòng `revoke all on function private.recompute_rating(uuid) from public, anon, authenticated;`.
- dev1: sửa `supabase/migrations/20261010100300_booking_tables.sql` (M4): thêm `constraint bookings_cancelled_by_consistent check ((cancelled_at is not null) = (cancelled_by is not null))` và `constraint bookings_id_parties_key unique (id, gymer_id, customer_id)` vào danh sách ràng buộc của `create table public.bookings`.
- dev3 (file riêng, không đụng migration): thêm `supabase/tests/local/cases/20_invariants_b.sql` kiểm các bất biến ở mục 2 (đặt trong một khối `do $$ ... $$` tạo dữ liệu mẫu rồi ROLLBACK bằng cách ném lỗi có chủ đích như mẫu trong `10_rls.sql`; hoặc dùng `begin; ... rollback;` nếu cách đó chạy được với `ON_ERROR_STOP`): tuổi, seed 8 giờ, làm tròn toạ độ, giới hạn 10 chứng chỉ, chồng lấn, 60 phút, tự đặt, huỷ nhất quán, khoá ngoại ghép của `reviews`, và không có hàm `private` nào `authenticated`/`anon` được EXECUTE.

Diff tham chiếu (đã áp sạch bằng `patch -p1` trên bản sao và chạy xanh):

```diff
--- a/supabase/migrations/20261010100100_core_profile_tables.sql
+++ b/supabase/migrations/20261010100100_core_profile_tables.sql
@@ -12,6 +12,8 @@
   return new;
 end $$;
 
+revoke all on function private.set_updated_at() from public, anon, authenticated;
+
 -- Hồ sơ người dùng (1 dòng cho mỗi tài khoản Zalo).
 create table if not exists public.profiles (
   id uuid primary key references auth.users (id) on delete cascade,
@@ -58,10 +60,10 @@
 -- Hồ sơ Gymer (1-1 với profiles).
 create table if not exists public.gymer_profiles (
   user_id uuid primary key references public.profiles (id) on delete restrict,
-  display_name text not null,
+  display_name text not null check (char_length(display_name) between 1 and 50),
   gender public.gender not null,
   birth_year smallint not null check (birth_year between 1940 and 2100),
-  area_label text not null,
+  area_label text not null check (char_length(area_label) between 1 and 100),
   bio text check (char_length(bio) <= 1000),
   avatar_url text,
   price_weekday_vnd integer not null check (price_weekday_vnd between 0 and 5000000),
@@ -94,6 +96,8 @@
   return new;
 end $$;
 
+revoke all on function private.check_gymer_age() from public, anon, authenticated;
+
 create or replace trigger gymer_profiles_check_age
   before insert or update on public.gymer_profiles
   for each row execute function private.check_gymer_age();
@@ -125,6 +129,8 @@
   return new;
 end $$;
 
+revoke all on function private.round_gymer_location() from public, anon, authenticated;
+
 create or replace trigger gymer_locations_round_coords
   before insert or update on public.gymer_locations
   for each row execute function private.round_gymer_location();
@@ -175,6 +181,8 @@
   return new;
 end $$;
 
+revoke all on function private.limit_certificates() from public, anon, authenticated;
+
 create or replace trigger certificates_limit
   before insert on public.certificates
   for each row execute function private.limit_certificates();
--- a/supabase/migrations/20261010100300_booking_tables.sql
+++ b/supabase/migrations/20261010100300_booking_tables.sql
@@ -21,7 +21,10 @@
   constraint bookings_duration_60m check (ends_at = starts_at + interval '60 minutes'),
   constraint bookings_not_self check (customer_id <> gymer_id),
   -- Huỷ thì phải có thời điểm huỷ, và ngược lại.
-  constraint bookings_cancel_consistent check ((status = 'cancelled') = (cancelled_at is not null))
+  constraint bookings_cancel_consistent check ((status = 'cancelled') = (cancelled_at is not null)),
+  constraint bookings_cancelled_by_consistent check ((cancelled_at is not null) = (cancelled_by is not null)),
+  -- Cặp (id, gymer_id, customer_id) để reviews khoá ngoại ghép khớp bên của booking.
+  constraint bookings_id_parties_key unique (id, gymer_id, customer_id)
 );
 alter table public.bookings enable row level security;
 revoke all on public.bookings from anon, authenticated;
--- a/supabase/migrations/20261010100400_reviews_and_triggers.sql
+++ b/supabase/migrations/20261010100400_reviews_and_triggers.sql
@@ -5,7 +5,7 @@
 -- Đánh giá: mỗi booking một đánh giá.
 create table if not exists public.reviews (
   id uuid primary key default gen_random_uuid(),
-  booking_id uuid not null unique references public.bookings (id) on delete cascade,
+  booking_id uuid not null unique,
   gymer_id uuid not null references public.gymer_profiles (user_id) on delete restrict,
   author_id uuid not null references public.profiles (id) on delete restrict,
   -- Chụp tên tại thời điểm đánh giá, để không mở profiles cho công chúng.
@@ -13,7 +13,10 @@
   rating smallint not null check (rating between 1 and 5),
   body text check (char_length(body) <= 500),
   created_at timestamptz not null default now(),
-  updated_at timestamptz not null default now()
+  updated_at timestamptz not null default now(),
+  -- gymer_id và author_id phải đúng là hai bên của booking.
+  constraint reviews_booking_parties_fkey foreign key (booking_id, gymer_id, author_id)
+    references public.bookings (id, gymer_id, customer_id) on delete cascade
 );
 alter table public.reviews enable row level security;
 revoke all on public.reviews from anon, authenticated;
@@ -40,8 +43,7 @@
   where gp.user_id = gymer;
 end $$;
 
-revoke all on function private.recompute_rating(uuid) from public, anon;
-grant execute on function private.recompute_rating(uuid) to authenticated;
+revoke all on function private.recompute_rating(uuid) from public, anon, authenticated;
 
 -- Trigger sau insert/update/delete trên reviews: gọi recompute cho Gymer liên quan.
 -- DEFINER vì: trigger chạy trong phiên người viết đánh giá, phải đi qua recompute_rating để ghi cột rating.
```

## 6. Điểm chưa chắc (cần nói thẳng)

- Chưa chạy trên Supabase/PG17 thật; mọi kiểm tra ở trên là PG16 + shim.
- `references auth.users (id)` ở M2 cần quyền REFERENCES của role migration trên bảng `auth.users` của Supabase. Đây là mẫu chuẩn trong tài liệu Supabase nên khả năng cao chạy được, nhưng tôi không có bằng chứng ở đây. Nếu M2 lỗi vì quyền, lỗi lộ ngay lúc áp thật (giao dịch của file đó sẽ được hoàn lại theo hiểu biết, chưa kiểm).
- Hành vi của job `migrate` khi một file giữa chuỗi lỗi: các file trước đó đã áp, file lỗi và các file sau chưa. Vì không có người duyệt, hãy theo dõi run ngay sau khi merge và báo lỗi nguyên văn.
- Cấu hình Supabase Auth (email sign-up, anonymous sign-in) tôi không đọc được; nên tắt khi chưa dùng.
