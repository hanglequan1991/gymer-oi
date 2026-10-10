Trạng thái: CHỜ APPROVE

# Plan: schema Supabase v1 (migration đầu tiên)

Tác giả: sen1. Ngày: 2026-10-10. Chỉ là tài liệu; chưa viết migration thật, chưa commit/push.
Tham chiếu: `docs/supabase-migrations.md`, `docs/ci-cd-setup.md`, `docs/project-structure.md` (mục 3), `src/types/domain.ts`, `src/services/repositories/*.ts`, `src/mocks/*`.

## 0. Giả định và câu hỏi còn mở (ngắn)

Giả định (sai thì plan đổi):
- G1. Production trống, Postgres 17, không staging. Mọi migration chạy qua `db push` sau dry-run + duyệt tay.
- G2. Thanh toán ngoài app; không có bảng thanh toán. Mỗi buổi cố định 60 phút, bắt đầu đúng giờ chẵn.
- G3. Quy mô v1 nhỏ (vài trăm Gymer, một thành phố). Con số này là phỏng đoán, chưa có dữ liệu thật.
- G4. Mọi thao tác đều cần đăng nhập Zalo; `anon` không có quyền gì (xem Q3).

Câu hỏi cần người dùng trả lời (đánh số để trả lời ngắn; mặc định của sen1 ghi trong ngoặc):
- Q1. Cắt khỏi v1 những mục ở mục 2.8? (mặc định: cắt gói 10 buổi, áp dụng hàng loạt, upload file chứng chỉ, upload ảnh đại diện, sửa/xoá đánh giá, chọn thời lượng buổi.)
- Q2. Gymer dạy ở đâu: phòng tập/điểm công cộng hay nhà riêng? Quyết định mức làm tròn toạ độ và cảnh báo quyền riêng tư. (mặc định: toạ độ làm tròn 3 chữ số thập phân, ~110 m, Gymer tự chọn "điểm hoạt động", không phải nhà.)
- Q3. Cho xem danh sách Gymer trước khi đăng nhập không? (mặc định: không; `anon` không quyền.)
- Q4. Khách có được tự huỷ lịch (pending/confirmed) không? Mockup không có. (mặc định: có, qua RPC `cancel_booking`, chỉ trước giờ bắt đầu.)
- Q5. Đặt trước tối thiểu/tối đa bao lâu? (mặc định: sau hiện tại ít nhất 2 giờ, nhiều nhất 60 ngày.)
- Q6. Tuổi tối thiểu của Gymer? (mặc định: 18, kiểm bằng trigger.) Khách không thu tuổi.
- Q7. Hồ sơ công khai có hiện TÊN chứng chỉ đã xác minh không, hay chỉ cờ "đã xác minh"? Yêu cầu nói "cờ"; nhưng `GymerDetail.certificates` đang có `name`. (mặc định: hiện tên các chứng chỉ ĐÃ xác minh, không bao giờ hiện file, không hiện chứng chỉ chờ.)
- Q8. Ai xác minh chứng chỉ và bằng cách nào khi v1 không có upload file? (mặc định: bạn xác minh thủ công qua dashboard Supabase, sau khi Gymer gửi ảnh qua Zalo ngoài app. Đây là xác minh dựa trên niềm tin, nói thẳng.)
- Q9. Tên người đánh giá hiện đầy đủ ("Hoàng Nam") hay rút gọn ("Nam H.")? (mặc định: hiện như tên Zalo họ có; rủi ro riêng tư thấp nhưng có.)
- Q10. Có yêu cầu xoá tài khoản/dữ liệu ngay trong v1 không? (mặc định: không có luồng xoá; xử lý thủ công theo yêu cầu, ghi rõ ở mục 4.)
- Q11. Region của project Supabase (dữ liệu lưu ở đâu)? Ảnh hưởng cảnh báo pháp lý mục 4. Plan không biết.

## 1. Mục tiêu và phạm vi

Mục tiêu: schema + RLS + RPC đủ cho luồng v1: đăng nhập Zalo -> tìm Gymer theo bán kính -> xem hồ sơ/lịch -> đặt lịch -> Gymer xác nhận/từ chối -> đánh giá sau buổi.

KHÔNG làm trong plan này:
- Không viết migration/SQL đầy đủ (chỉ SQL minh hoạ phần khó). Không commit/push.
- Edge function `auth-zalo`, `resolve-location` (chỉ nêu giao diện và spike, mục 2.1). Cài đặt repository Supabase thật (`src/services/supabase/*`) và nối UI: plan riêng sau khi schema chạy.
- Thanh toán, chat, thông báo đẩy (Zalo OA), admin UI, gói 10 buổi, áp dụng hàng loạt, upload file, pg_cron.

## 2. Quyết định kiến trúc

### 2.1 Xác thực: danh tính Zalo -> Supabase

Hiện trạng: `AuthPort.login()` chỉ trả `zaloAccessToken`; `getProfile()` trả `zaloId`, `name`, `avatarUrl`. Zalo không phải provider có sẵn của Supabase Auth (theo `docs/project-structure.md` 3.3; chưa kiểm lại với tài liệu Supabase hiện hành).

Quyết định (khuyến nghị): edge function `auth-zalo`:
1. Client gửi `zaloAccessToken` tới function (function `verify_jwt = false` vì chưa có phiên; ghi lý do trong PR theo `docs/supabase-migrations.md`).
2. Function gọi API Zalo phía server để xác minh token và lấy `zaloId` (KHÔNG tin `zaloId` do client gửi). Endpoint và header chính xác: SPIKE S1.
3. Function (service role) tìm `public.zalo_identities` theo `zalo_id`; chưa có thì tạo người dùng `auth.users` qua admin API (email giả không gửi được, ví dụ `zalo-<id>@users.invalid`, hoặc cách khác SPIKE S1 chọn), tạo `profiles` + `zalo_identities`.
4. Function cấp phiên Supabase THẬT (access + refresh token) cho user đó; client `supabase.auth.setSession(...)`. Cách cấp phiên (admin generateLink + verifyOtp, hay JWT ký bằng khoá dự án) là SPIKE S1; plan chưa khẳng định cách nào chạy được.
5. Hệ quả: `auth.uid()` = uuid của `auth.users`; mọi RLS dùng `auth.uid()`; khoá ngoại về `profiles(id)`.

`zalo_id` nằm ở `public.zalo_identities` (RLS bật, KHÔNG có policy nào cho client, chỉ service role đọc/ghi), không nằm ở `profiles`, để client không bao giờ đọc được `zalo_id` của người khác.

Phương án đã loại:
- Tự ký JWT với `sub` tuỳ ý: phải giữ secret trong function, không có refresh, rủi ro lệch với cơ chế khoá ký của Supabase. Chỉ xét lại nếu S1 cho thấy cách chính thống không chạy.
- Email/mật khẩu suy ra từ Zalo ID: mật khẩu đoán được; loại.
- Dùng `zaloId` làm khoá chính trực tiếp, không qua `auth.users`: mất `auth.uid()` và toàn bộ RLS chuẩn; loại.

SPIKE:
- S1 (trước khi viết `auth-zalo`): xác nhận endpoint xác minh token Zalo, cách cấp phiên, thời hạn session, và `userInfo.id` có ổn định/phạm vi theo Mini App không.
- S2: xác nhận đổi `getLocation()` token -> toạ độ (function `resolve-location`, cần secret key Zalo). Ngoài phạm vi schema; schema không phụ thuộc.
- Cả hai chặn việc nối UI thật, KHÔNG chặn migration.

### 2.2 Vai trò

Một tài khoản (`profiles`) có thể vừa là khách vừa là Gymer. "Là Gymer" = có hàng trong `gymer_profiles` (khoá chính `user_id` = `profiles.id`). Không có cột role.
- Ràng buộc: `bookings.customer_id <> bookings.gymer_id` (không tự đặt lịch của mình).
- Chế độ khách/Gymer là trạng thái giao diện, không phải quyền.
Loại: enum role trên profile (không vừa-vừa được, phải đổi dữ liệu khi người dùng muốn cả hai); hai loại tài khoản tách rời (nhân đôi đăng nhập).

### 2.3 Tìm theo bán kính

Quyết định: KHÔNG dùng PostGIS ở v1. Lưu `lat`, `lng` (double precision) trong bảng riêng `gymer_locations`; RPC `search_gymers` lọc hộp bao (bounding box) rồi tính haversine.
Lý do:
- Quy mô nhỏ (G3): quét vài trăm dòng là đủ nhanh; index trên toạ độ gần như vô ích ở quy mô này, nên chỉ tạo một index một phần `where` đơn giản, không hứa hẹn hơn.
- Không thêm extension nào ở migration đầu; môi trường dev ở đây không có PostGIS (đã kiểm, mục 6), nên haversine kiểm được cục bộ còn PostGIS thì không.
- Đường nâng cấp rõ: khi tới hàng nghìn Gymer, thêm cột `geography` + GiST bằng migration expand (cột mới, backfill, đổi RPC), không phá gì.
Rủi ro nói thẳng: "vài trăm" là phỏng đoán; haversine thuần không có chỉ mục không gian thật.
Loại: PostGIS ngay (chính xác hơn, có KNN, nhưng thêm extension chưa kiểm được ở môi trường dev, kiểu `geography` sinh ra `unknown` trong `database.types.ts`); `earthdistance`/`cube` (cũng là extension, ít dùng hơn).

Quyền riêng tư vị trí:
- Vị trí khách: KHÔNG lưu. App gửi `p_lat`, `p_lng` làm tròn 3 chữ số (~110 m) qua `supabase.rpc` (POST, tham số trong body, không nằm trong URL). Việc log request phía Supabase: chưa kiểm; cần xem cấu hình log, không dùng GET.
- Vị trí Gymer: bảng `gymer_locations` chỉ chủ sở hữu đọc/ghi. Không có đường nào trả lat/lng của Gymer ra client; RPC chỉ trả `distance_km` làm tròn 0.1 km. Toạ độ ép làm tròn 3 chữ số bằng trigger (Gymer chọn "điểm hoạt động").
- Rủi ro còn lại, nói thẳng: kẻ gọi RPC nhiều lần từ nhiều toạ độ giả có thể dò (trilateration) ra điểm của Gymer với sai số ~vài chục mét. Giảm: làm tròn khoảng cách, bán kính tối đa 10 km, giới hạn tối đa 50 kết quả; rate limit thật chưa có (cần cơ chế khác, ngoài v1). Chấp nhận nếu điểm là nơi công cộng (Q2).

RPC minh hoạ (rút gọn, không phải bản cuối):

```sql
create or replace function public.search_gymers(
  p_lat double precision, p_lng double precision, p_radius_km numeric,
  p_keyword text default null, p_specialty text default null,
  p_gender public.gender default null, p_min_rating numeric default null,
  p_age_min int default null, p_age_max int default null, p_max_price int default null)
returns table (user_id uuid, display_name text, gender public.gender, age int,
               area_label text, distance_km numeric, rating_avg numeric, rating_count int,
               price_weekday_vnd int, price_weekend_vnd int, tags text[], is_certified boolean, avatar_url text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_radius_km is null or p_radius_km <= 0 or p_radius_km > 10 then raise exception 'VALIDATION: radius'; end if;
  return query
  select g.user_id, ... ,
         round(d.km::numeric, 1)
  from public.gymer_profiles g
  join public.gymer_locations l on l.user_id = g.user_id
  cross join lateral (select 6371 * 2 * asin(sqrt(
      sin(radians(l.lat - p_lat) / 2) ^ 2
      + cos(radians(p_lat)) * cos(radians(l.lat)) * sin(radians(l.lng - p_lng) / 2) ^ 2)) as km) d
  where g.is_listed
    and l.lat between p_lat - p_radius_km / 111.32 and p_lat + p_radius_km / 111.32
    and l.lng between p_lng - p_radius_km / (111.32 * cos(radians(p_lat)))
                  and p_lng + p_radius_km / (111.32 * cos(radians(p_lat)))
    and d.km <= p_radius_km
    -- lọc keyword (extensions.unaccent + ilike trên tên và môn), specialty, gender, rating, tuổi, giá
  order by d.km, g.user_id limit 50;
end $$;
```
Ghi chú: `SECURITY DEFINER` bắt buộc vì `gymer_locations` bị RLS chặn với client; nên hàm phải tự kiểm `auth.uid()` và chỉ trả cột công khai. `unaccent` cho tìm "minh ha" khớp "Minh Hà": chưa kiểm hành vi với chữ "đ"; phải có ca test.
Lọc giá "dưới 200k" dùng `price_weekday_vnd` (khớp `GymerCard` hiển thị `priceWeekday`); tuổi tính từ `birth_year`.

### 2.4 Lịch, khung giờ, chống đặt trùng, thời gian, giá

Mô hình lịch: mẫu + ngoại lệ, KHÔNG sinh sẵn từng slot.
- `gymer_open_hours (gymer_id, start_time)`: các giờ chẵn mặc định mở MỌI ngày (trigger gán mẫu 07,09,10,14,16,17,18,19 khi tạo `gymer_profiles`; Gymer có thể đổi sau, giao diện sửa mẫu có thể chưa có ở v1).
- `gymer_day_overrides (gymer_id, day, is_open, price_vnd null)`: đóng cả ngày và/hoặc giá riêng cho ngày.
- `gymer_slot_overrides (gymer_id, day, start_time, is_open)`: đóng một khung (hoặc mở thêm một giờ ngoài mẫu).
- Trạng thái khung = suy ra: mở theo mẫu/ngoại lệ, trừ đi booking đang giữ chỗ (`pending` chưa hết hạn, `confirmed`). Tính trong RPC `get_day_slots`, `get_month_calendar` (cũng là chỗ tính giá).
Lý do: sinh sẵn slot cần cron kéo dài lịch, nhân số hàng (8 slot x 365 ngày x mỗi Gymer), và "áp dụng hàng loạt" thành hàng nghìn update. Mô hình mẫu+ngoại lệ ít hàng, ngoại lệ chỉ tồn tại khi Gymer đổi.
Cái giá: logic suy ra nằm trong SQL, phải có test (mục 6). Loại: sinh sẵn slot.

Hệ quả với UI hiện tại (lệch, đề xuất ĐỔI PHÍA APP, mục 5): `Slot.id` và `setSlotClosed(slotId, closed)` giả định slot có id riêng; ở mô hình này slot = (Gymer, ngày, giờ). Đổi `setSlotClosed(dateIso, time, closed)`.

Chống đặt trùng, ở DB (ràng buộc loại trừ):

```sql
create extension if not exists btree_gist with schema extensions;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (gymer_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status in ('pending', 'confirmed'));
-- Khách không giữ hai lịch chồng nhau (tuỳ chọn, cùng cách):
--   exclude using gist (customer_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (...)
```
- Hai người đặt cùng lúc: người sau nhận lỗi `23P01` (exclusion_violation); `create_booking` bắt và ném `SLOT_TAKEN`. Không dựa vào app.
- Chọn exclusion thay vì unique `(gymer_id, starts_at)`: unique đủ khi buổi cố định 60 phút, nhưng không chặn chồng lấn nếu sau này đổi thời lượng; chi phí thêm chỉ là extension `btree_gist` (có trong contrib, đã thấy bản cài đặt ở môi trường này; trên hosted Supabase là việc CHỈ kiểm được khi chạy thật).
- `pending` hết hạn: ràng buộc không thể phụ thuộc `now()`. Cách xử lý v1 (lười, không cron): `create_booking` trước khi chèn chuyển các `pending` đã hết hạn chồng lên khung đó sang `expired`; các RPC đọc coi `pending` quá hạn là trống; mapper hiển thị `pending` quá hạn là "hết hạn". `expires_at = least(created_at + 24h, starts_at)`.
- Khách spam `pending` để chiếm khung của Gymer: `create_booking` giới hạn mỗi khách tối đa 3 `pending` cùng lúc. Chỉ giảm, không loại bỏ.
- Đua giữa "Gymer đóng khung" và "khách đặt khung": cả `create_booking` và trigger chặn đóng khung dùng `pg_advisory_xact_lock(hashtextextended(gymer_id::text, 0))`.
- Gymer không đóng được khung/ngày đã có booking `pending|confirmed`: trigger trên hai bảng override ném lỗi `SLOT_HAS_BOOKING`.

Thời gian:
- `bookings.starts_at/ends_at` kiểu `timestamptz` (lưu UTC). `day` kiểu `date` và `start_time` kiểu `time` là GIỜ ĐỊA PHƯƠNG Việt Nam. Mọi đổi qua lại dùng tường minh `at time zone 'Asia/Ho_Chi_Minh'` (không phụ thuộc `timezone` của phiên; Việt Nam không có DST).
- T7/CN: `extract(isodow from day) in (6, 7)`; tính trên `date` nên không dính múi giờ.
- Giá: `create_booking` tính ở server: `day_overrides.price_vnd` nếu có, không thì `price_weekend_vnd` (T7/CN) hoặc `price_weekday_vnd`; ghi vào `bookings.price_vnd` (integer VND, `check (>= 0)`). Client gửi `p_expected_price`; lệch thì ném `PRICE_CHANGED` để khách thấy giá mới trước khi xác nhận lại. Sau đó giá Gymer đổi không ảnh hưởng booking đã tạo.

### 2.5 RLS, quyền, SECURITY DEFINER

Nguyên tắc:
- Bật RLS cho MỌI bảng `public`, ngay trong chính migration tạo bảng (cùng file), kèm `revoke all ... from anon, authenticated`. Policy và `grant` chọn lọc nằm ở migration RLS riêng. Nhờ vậy giữa hai đợt deploy, bảng đã tạo vẫn đóng.
- Giả định cần kiểm sau migration (`\dp` hoặc Supabase advisor): Supabase mặc định cấp quyền rộng cho `anon`/`authenticated` trên bảng mới ở schema `public`; nên không dựa vào "chưa có policy" mà revoke tường minh.
- Ghi vào cột nhạy cảm bằng quyền theo cột: `grant update (cột...) on ... to authenticated` (RLS không giới hạn theo cột). Ví dụ `gymer_profiles`: client KHÔNG được ghi `rating_avg`, `rating_count`, `is_certified`.
- Policy dùng `(select auth.uid())` để planner cache.
- Hàm nội bộ (trigger, helper) đặt ở schema `private` (không lộ qua API). RPC cho client ở `public`.
- Mọi hàm: `revoke all on function ... from public, anon; grant execute ... to authenticated` (Postgres mặc định cấp EXECUTE cho PUBLIC).
- Mọi `SECURITY DEFINER`: `set search_path = ''`, tham chiếu đầy đủ `public.x`, `extensions.x`; có comment `-- DEFINER vì: ...` ngay trên hàm.

Ma trận quyền (anon = không có gì ở mọi bảng):

| Bảng | authenticated đọc | authenticated ghi | Ghi chú |
|---|---|---|---|
| `profiles` | dòng của mình; dòng của khách có booking gửi cho mình (Gymer) | update `display_name`, `avatar_url` của mình | insert do edge function (service role) |
| `zalo_identities` | không | không | chỉ service role |
| `specialties` | tất cả | không | dữ liệu tham chiếu, seed trong migration |
| `gymer_profiles` | `is_listed` hoặc của mình hoặc Gymer mình có booking | insert/update dòng của mình, theo cột | không có `delete` ở v1 (tắt bằng `is_listed=false`) |
| `gymer_locations` | chỉ chủ | insert/update của mình | không bao giờ lộ ra client khác |
| `gymer_specialties` | theo quyền đọc `gymer_profiles` | chủ insert/delete | |
| `certificates` | chỉ chủ | chủ insert (status ép `pending`), xoá khi còn `pending` | `status`, `verified_at` chỉ admin/service |
| `gymer_open_hours`, `gymer_day_overrides`, `gymer_slot_overrides` | chỉ chủ | chủ | khách đọc qua RPC |
| `bookings` | khách của booking hoặc Gymer của booking | KHÔNG ghi trực tiếp | ghi qua RPC |
| `booking_health_notes` | khách của booking; Gymer của booking chỉ khi status `pending`/`confirmed` | KHÔNG ghi trực tiếp | ghi trong `create_booking`; `reject`/`cancel` làm Gymer mất quyền đọc |
| `reviews` | của Gymer đang `is_listed`, hoặc của mình | KHÔNG ghi trực tiếp | ghi qua `create_review` |

Ví dụ một policy (ghi chú sức khoẻ):

```sql
drop policy if exists health_notes_select on public.booking_health_notes;
create policy health_notes_select on public.booking_health_notes
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_health_notes.booking_id
      and ( b.customer_id = (select auth.uid())
         or (b.gymer_id = (select auth.uid()) and b.status in ('pending', 'confirmed')) )));
```

RPC SECURITY DEFINER (mỗi cái kèm lý do trong comment):
- `search_gymers`, `get_day_slots`, `get_month_calendar`, `gymer_certificate_badges`: cần đọc bảng mà client bị chặn (toạ độ, ngoại lệ lịch, booking của người khác để tính khung bận, file/chứng chỉ), chỉ trả dữ liệu công khai/đã lọc. `get_day_slots` chỉ trả `booked_by` (tên khách) khi người gọi chính là Gymer đó.
- `create_booking`, `respond_booking`, `cancel_booking`, `create_review`: kiểm điều kiện nghiệp vụ và ghi vào bảng mà client không có quyền ghi.
- Trigger `private.recompute_rating` (sau thay đổi `reviews`) và `private.sync_is_certified` (sau thay đổi `certificates`): cập nhật cột client không được ghi.
Lỗi nghiệp vụ ném bằng `raise exception 'MÃ'` (ví dụ `SLOT_TAKEN`, `SLOT_NOT_OPEN`, `PRICE_CHANGED`, `FORBIDDEN`, `NOT_FOUND`, `BOOKING_EXPIRED`, `LIMIT_REACHED`, `VALIDATION`); mapper ở tầng services chuyển sang `AppError`. Khớp `ErrorCode` hiện có, hai mã mới (`PRICE_CHANGED`, `SLOT_NOT_OPEN`) tạm map về `VALIDATION`/`SLOT_TAKEN` (mục 5).

### 2.6 Đánh giá

- Chỉ cho đánh giá sau buổi đã xong: booking của chính khách, `status = 'confirmed'`, `ends_at < now()`, mỗi booking một đánh giá (`unique (booking_id)`). Không có trạng thái `completed` lưu trữ: "đã xong" = `confirmed` và đã qua `ends_at` (suy ra, không cần cron). Hệ quả: không có cách ghi nhận Gymer vắng mặt; khách vẫn đánh giá được. Chấp nhận ở v1.
- Rating lưu denormalized: `gymer_profiles.rating_avg numeric(3,2)`, `rating_count int`, cập nhật bằng trigger sau insert/update/delete trên `reviews` (tính lại bằng aggregate theo Gymer). Lý do: bộ lọc "từ 4★" và thẻ danh sách cần giá trị này cho mọi dòng mỗi lần tìm; tính động phải join + group mỗi lần tìm. Cái giá: trigger là thêm một chỗ có thể sai, cần test; ghi lại đánh giá 0 lượt = `rating_avg 0, rating_count 0` (UI phải hiển thị "chưa có đánh giá", không hiện "0.0").
- `reviews.author_name` chụp tên tại thời điểm đánh giá (tránh mở `profiles` cho công chúng). Mapper dựng `dateLabel` từ `created_at`.
- v1 không sửa/xoá đánh giá (không có policy ghi); admin xử lý qua dashboard.
Loại: tính động (chậm dần, khó lọc); cho đánh giá bất kỳ lúc nào (đánh giá giả).

### 2.7 Chứng chỉ

v1 tối thiểu: chỉ metadata (`certificates`: `name`, `status` enum `pending|verified|rejected`, `file_path` null). Chưa tạo bucket Storage, chưa upload (cột `file_path` để sẵn, null). Xác minh thủ công: Q8. `gymer_profiles.is_certified` đồng bộ bằng trigger (có ít nhất một chứng chỉ `verified`). Công khai: cờ `is_certified` + (Q7) tên các chứng chỉ đã xác minh qua RPC `gymer_certificate_badges`.
Khi làm upload: bucket private `certificates`, đường dẫn `<gymer_id>/<uuid>`, policy trên `storage.objects` (schema do Supabase quản lý, rủi ro riêng), xem ảnh bằng signed URL ngắn hạn; làm ở migration + plan riêng.
Loại: upload ngay v1 (thêm bucket + policy `storage.objects` vào migration đầu, khó kiểm cục bộ, mở thêm bề mặt dữ liệu nhạy cảm).

### 2.8 Phạm vi v1: đề xuất cắt (người dùng quyết, Q1)

| Mục | Đề xuất | Lý do | Nếu cần sau |
|---|---|---|---|
| Gói 10 buổi | Cắt | Không có logic tính tiền/đặt gói; thanh toán ngoài app | Thêm cột `price_pack10_vnd` (nullable, chỉ hiển thị) bằng migration expand; UI phải ẩn dòng này đến lúc đó |
| Áp dụng hàng loạt | Cắt | Đặt/đóng từng ngày, từng khung đã đủ; cần RPC nguyên tử riêng | RPC `apply_schedule_bulk` |
| Chọn thời lượng buổi | Cắt (cố định 60) | Ràng buộc slot và chống trùng đơn giản hơn nhiều | Cột `slot_minutes` + sinh khung theo đó |
| Upload file chứng chỉ | Cắt | Mục 2.7 | Storage plan riêng |
| Upload ảnh đại diện | Cắt (dùng URL ảnh Zalo) | Cần bucket public + policy | Bucket `avatars` |
| Sửa/xoá đánh giá | Cắt | | Policy + trigger đã sẵn sàng tính lại |
| Sửa mẫu giờ mở theo thứ trong tuần | Cắt (mẫu giống nhau mọi ngày, đóng/mở bằng ngoại lệ) | Mockup không có màn sửa mẫu | Thêm cột `weekday` (expand) |
| Huỷ lịch bởi khách | Giữ (mặc định), Q4 | Không có thì khung bị giữ vô thời hạn khi `confirmed` | |
| Xoá tài khoản tự phục vụ | Cắt (Q10) | Cần quy tắc giữ lịch sử | |

### 2.9 Dữ liệu cá nhân

Lưu tối thiểu:
- `profiles`: `display_name`, `avatar_url` (từ Zalo). Không giới tính/tuổi/SĐT của khách.
- `gymer_profiles`: `display_name` (công khai, có thể khác tên Zalo), `gender`, `birth_year smallint` (không lưu ngày sinh đầy đủ; tuổi = năm hiện tại (giờ Việt Nam) - `birth_year`, lệch tối đa 1 tuổi, chấp nhận; lưu `age` trực tiếp sẽ cũ dần nên loại). Không lưu `lat/lng` của khách.
- `booking_health_notes.note`: tách bảng riêng để policy riêng, xoá riêng được; giới hạn 1000 ký tự; KHÔNG ghi vào log hay trả trong danh sách yêu cầu (Gymer chỉ đọc khi mở chi tiết booking).
- `zalo_identities`: chỉ `zalo_id`, `user_id`.
Cảnh báo (không phải tư vấn pháp lý; cần người có chuyên môn xác nhận):
- Ghi chú sức khoẻ và dữ liệu vị trí thường được coi là dữ liệu cá nhân nhạy cảm theo quy định bảo vệ dữ liệu cá nhân của Việt Nam (Nghị định 13/2023 và luật bảo vệ dữ liệu cá nhân có hiệu lực từ 2026; plan không kiểm lại nội dung hiện hành). Thường đòi hỏi sự đồng ý rõ ràng, mục đích xử lý rõ, chính sách quyền riêng tư; ngoài ra Zalo Mini App có yêu cầu riêng.
- Dữ liệu nằm ở region Supabase (Q11); chuyển dữ liệu ra nước ngoài có thể kéo theo nghĩa vụ riêng.
- Người điều hành project và nhân sự Supabase có thể đọc dữ liệu (dashboard, backup); v1 KHÔNG mã hoá theo cột.
- Chưa có luồng xoá dữ liệu (Q10): khoá ngoại từ `bookings`/`reviews` tới `profiles` dùng `on delete restrict`; xoá một người phải làm tay và có chủ đích.
- Người dưới 18 tuổi: chỉ Gymer có `birth_year`; khách không kiểm tuổi.

## 2A. Mô hình dữ liệu

Sơ đồ quan hệ (text):

```
auth.users 1─1 profiles 1─1 zalo_identities
                 │
                 ├─0..1─ gymer_profiles ─┬─1─1─ gymer_locations        (riêng tư)
                 │        │              ├─*─* specialties (qua gymer_specialties)
                 │        │              ├─1─* certificates
                 │        │              ├─1─* gymer_open_hours
                 │        │              ├─1─* gymer_day_overrides
                 │        │              └─1─* gymer_slot_overrides
                 │        └─1─* bookings *─1─ profiles (customer)
                 │                  ├─1─0..1 booking_health_notes
                 │                  └─1─0..1 reviews (author = customer, gymer = gymer)
```

Enum (kiểu Postgres; thêm giá trị sau bằng `alter type ... add value`, KHÔNG xoá được; chọn enum thay vì `check` vì `database.types.ts` sinh ra union chặt):
- `public.gender`: `female`, `male` (khớp `Gender`; thêm "khác" là câu hỏi nhỏ, hiện UI không có).
- `public.booking_status`: `pending`, `confirmed`, `rejected`, `cancelled`, `expired`.
- `public.certificate_status`: `pending`, `verified`, `rejected`.

Bảng và cột chính (chỉ cột đáng nói; `created_at/updated_at timestamptz default now()` ở mọi bảng, `updated_at` bằng trigger `private.set_updated_at`):

- `profiles`: `id uuid pk references auth.users on delete cascade`, `display_name text not null check (char_length between 1 and 50)`, `avatar_url text`.
- `zalo_identities`: `zalo_id text pk`, `user_id uuid not null unique references profiles(id) on delete cascade`.
- `specialties`: `name text pk` (khớp `Specialty` và `tags`). Seed trong migration (`on conflict do nothing`): Gym, Giảm mỡ, Tăng cơ, Yoga, Calisthenics, Giãn cơ (mock có tag "Giãn cơ" không nằm trong union `Specialty`: nhãn tự do vẫn được, bộ lọc chỉ dùng 5 giá trị).
- `gymer_profiles`: `user_id uuid pk references profiles(id) on delete restrict`, `display_name text not null`, `gender gender not null`, `birth_year smallint not null check (between 1940 and 2100)` (+ trigger tuổi >= 18, Q6), `area_label text not null` (ví dụ "Quận 1, TP.HCM"), `bio text check (char_length <= 1000)`, `avatar_url text`, `price_weekday_vnd int not null check (between 0 and 5000000)`, `price_weekend_vnd int not null` (cùng check), `accepts_requests boolean not null default true`, `is_listed boolean not null default false`, `is_certified boolean not null default false`, `rating_avg numeric(3,2) not null default 0`, `rating_count int not null default 0`.
  Index: `(is_listed)` phần `where is_listed` trên `user_id`.
- `gymer_locations`: `user_id pk references gymer_profiles on delete cascade`, `lat double precision not null check (between -90 and 90)`, `lng double precision not null check (between -180 and 180)`; trigger làm tròn 3 chữ số. Index một phần `(lat, lng)` (tác dụng nhỏ ở quy mô hiện tại, ghi rõ).
- `gymer_specialties`: `pk (gymer_id, specialty_name)`, `specialty_name references specialties(name) on update cascade`.
- `certificates`: `id uuid pk default gen_random_uuid()`, `gymer_id`, `name text not null check (<= 100)`, `file_path text`, `status certificate_status not null default 'pending'`, `verified_at timestamptz`. Index `(gymer_id)`.
- `gymer_open_hours`: `pk (gymer_id, start_time)`, `start_time time not null check (date_part('minute', start_time) = 0 and date_part('second', start_time) = 0)`.
- `gymer_day_overrides`: `pk (gymer_id, day)`, `day date not null`, `is_open boolean not null default true`, `price_vnd int check (between 0 and 5000000)`.
- `gymer_slot_overrides`: `pk (gymer_id, day, start_time)`, `is_open boolean not null`; cùng check giờ chẵn.
- `bookings`: `id uuid pk default gen_random_uuid()`, `gymer_id uuid not null references gymer_profiles(user_id) on delete restrict`, `customer_id uuid not null references profiles(id) on delete restrict`, `starts_at timestamptz not null`, `ends_at timestamptz not null`, `goal text check (char_length <= 200)`, `price_vnd int not null check (>= 0)`, `status booking_status not null default 'pending'`, `expires_at timestamptz not null`, `responded_at timestamptz`. Check: `ends_at = starts_at + interval '60 minutes'`, `customer_id <> gymer_id`. Ràng buộc loại trừ ở 2.4. Index: `(customer_id, starts_at desc)`, `(gymer_id, status, starts_at)`.
- `booking_health_notes`: `booking_id uuid pk references bookings on delete cascade`, `note text not null check (char_length between 1 and 1000)`.
- `reviews`: `id uuid pk`, `booking_id uuid not null unique references bookings`, `gymer_id`, `author_id`, `author_name text not null`, `rating smallint not null check (between 1 and 5)`, `body text check (<= 500)`. Index `(gymer_id, created_at desc)`.

Đối chiếu với `src/types/domain.ts` (lệch và bên nào đổi) — xem mục 5.

## 3. Chia migration

Tên file theo `docs/supabase-migrations.md`: `YYYYMMDDHHMMSS_ten.sql` (timestamp dưới đây là chỗ giữ; dev tạo bằng `supabase migration new` nếu có CLI, nếu không thì đặt tay đúng định dạng, tăng dần, sau mọi migration đã có). Mỗi file một mục đích, idempotent, KHÔNG chứa `drop table`/`truncate`/`delete from`/`alter column ... type` (script `scan-migrations.sh` sẽ cảnh báo; mong đợi 0 cảnh báo).

| # | File | Nội dung | Rủi ro |
|---|---|---|---|
| M1 | `20261010100000_init_extensions_enums_private.sql` | `create extension if not exists btree_gist, unaccent with schema extensions`; `create schema if not exists private`; 3 enum (bọc `do $$ ... exception when duplicate_object`) | Thấp. Không có bảng, không có dữ liệu. PHÉP THỬ PIPELINE NHỎ NHẤT (xem 3.1) |
| M2 | `20261010100100_core_profile_tables.sql` | `private.set_updated_at`; `profiles`, `zalo_identities`, `specialties` (+seed), `gymer_profiles`, `gymer_locations` (+trigger làm tròn), `gymer_specialties`, `certificates`; mỗi bảng enable RLS + revoke | Trung bình |
| M3 | `20261010100200_schedule_tables.sql` | `gymer_open_hours`, `gymer_day_overrides`, `gymer_slot_overrides`; trigger gán giờ mặc định khi tạo `gymer_profiles`; enable RLS + revoke | Thấp |
| M4 | `20261010100300_booking_tables.sql` | `bookings` + exclusion constraint + index, `booking_health_notes`; enable RLS + revoke | Cao nhất trong nhóm bảng (exclusion + extension ngoài) |
| M5 | `20261010100400_reviews_and_triggers.sql` | `reviews`; `private.recompute_rating` (+trigger); `private.sync_is_certified` (+trigger); enable RLS + revoke | Trung bình |
| M6 | `20261010100500_rls_gymer_side.sql` | policy + grant theo cột cho `profiles`, `specialties`, `gymer_*`, `certificates`, 3 bảng lịch | Cao (RLS sai = lộ/chặn dữ liệu) |
| M7 | `20261010100600_rls_booking_review.sql` | policy cho `bookings`, `booking_health_notes`, `reviews`; policy bổ sung `profiles`/`gymer_profiles` cho người có booking | Cao |
| M8 | `20261010100700_rpc_read.sql` | `search_gymers`, `get_day_slots`, `get_month_calendar`, `gymer_certificate_badges` + revoke/grant execute | Cao |
| M9 | `20261010100800_rpc_booking_flow.sql` | `create_booking`, `respond_booking`, `cancel_booking`, `create_review`; trigger chặn đóng khung/ngày đã có booking | Cao nhất (logic nghiệp vụ, khoá, giá) |

Vì sao M6, M7 tách khỏi bảng (M2–M5): người duyệt đọc "cấu trúc" và "quyền" riêng; sai quyền sửa bằng migration quyền, không đụng cấu trúc.
Thứ tự phụ thuộc: M1 trước tất cả; M3, M4, M5 cần M2; M6 cần M2–M3; M7 cần M4–M5; M8, M9 cần M2–M5 (và nên sau M6–M7 để quyền đúng khi hàm chạy).

### 3.1 Cách đưa lên production (đợt merge)

Mỗi lần merge `main` có migration chờ thì pipeline dry-run rồi chờ duyệt. Không gộp mọi thứ một lần: file nào lỗi sẽ dừng tại đó, các file trước đã áp dụng (mỗi file một giao dịch; xem 4 về lệch trạng thái).

| Đợt | Merge | Mục đích | Điểm kiểm sau đợt |
|---|---|---|---|
| A | M1 | Phép thử pipeline: dry-run, duyệt, `--yes`, cụm "up to date" ở lần sau | Mục 3.2 điểm 1–4 |
| B | M2–M5 | Cấu trúc bảng (đóng sẵn bằng RLS+revoke) | `\dt`/dashboard: đủ bảng, RLS bật; advisor bảo mật không báo "RLS disabled" |
| C | M6–M7 | Quyền | Chạy bộ test RLS cục bộ đã xanh trước; kiểm `\dp` |
| D | M8–M9 | RPC | Gọi thử qua dashboard bằng role `authenticated` giả (nếu có thể); advisor "function search_path mutable" không báo |

Đợt A đáng kể vì nó kiểm các giả định chưa từng chạy ở repo này: dry-run in gì; có đọc được cụm "up to date" ở lần dry-run kế tiếp không; job `migrate` có chờ duyệt đúng; `--yes` hoạt động; secrets đúng. Nếu A lỗi, lỗi thuộc về pipeline, không lẫn với lỗi SQL nghiệp vụ.

### 3.2 Hướng dẫn người duyệt đọc dry-run và migration

Điều cần biết trước (theo hiểu biết của sen1, CHƯA kiểm ở repo này; đợt A là lần kiểm đầu): `supabase db push --dry-run` chỉ liệt kê TÊN các file migration sẽ áp dụng, không in nội dung SQL và không chạy thử SQL. Nghĩa là dry-run thành công KHÔNG chứng minh SQL đúng. Lỗi cú pháp/đối tượng chỉ lộ ở lúc áp dụng thật. Vì thế phải đọc file trong PR, không chỉ đọc summary.

Danh sách kiểm cho từng đợt:
1. Danh sách file trong dry-run khớp đúng và đúng thứ tự với các file của đợt (không thừa file nào).
2. Mục "Quét migration" trong summary: kỳ vọng 0 cảnh báo; có cảnh báo thì dừng và hỏi.
3. Đợt A: file chỉ có extension/schema/enum, không có `drop`, không có bảng.
4. Sau khi duyệt và chạy xong: lần deploy kế tiếp (hoặc chạy `workflow_dispatch`) phải ra `up to date`. Nếu không ra, `migrate` sẽ lại chờ duyệt (fail-safe), cần xem tại sao.
5. Đợt B: mỗi `create table` đi kèm `enable row level security` và `revoke all ... from anon, authenticated` trong CÙNG file. Tìm `create table` không có dòng kèm theo => từ chối.
6. Đợt C/D: grep `grant ... to anon` (kỳ vọng không có); mọi hàm `security definer` có `set search_path = ''` và comment lý do; mọi hàm có `revoke ... from public, anon`.
7. Không có `drop table|column`, `truncate`, `delete from`, `alter column ... type` ngoài ý muốn.
8. Trước đợt C: xác nhận đã có kết quả test cục bộ (báo cáo của dev kèm đầu ra) và Supabase có bật backup/PITR (database trống nên rủi ro mất dữ liệu thấp, nhưng nên giữ thói quen theo `docs/supabase-migrations.md`).

## 4. Rủi ro và cách giảm

| # | Rủi ro | Mức | Giảm |
|---|---|---|---|
| R1 | Migration lỗi giữa chừng khi áp dụng thật (dry-run không bắt) | Cao | Test cục bộ trên Postgres 16 với shim (mục 6); chia đợt nhỏ; mỗi file idempotent. Khi lỗi: chạy `supabase migration list` để biết file nào đã áp dụng; file lỗi chưa được ghi nhận thì sửa tại chỗ được; file đã áp dụng thì CHỈ tạo migration mới (hành vi ghi nhận lịch sử khi lỗi: chưa kiểm, xác nhận lúc gặp) |
| R2 | Khác biệt PG16 cục bộ so với PG17 hosted và các thành phần Supabase (role, `auth.uid()`, default privileges, extension schema) | Trung bình | Shim chỉ mô phỏng; mục "CHỈ kiểm được khi chạy thật" ở mục 6 là danh sách điểm kiểm sau đợt |
| R3 | RLS/column grant sai làm lộ hoặc chặn dữ liệu | Cao | Bộ test SQL theo vai (khách A, khách B, Gymer, anon); đợt C riêng; advisor sau áp dụng |
| R4 | Rò rỉ ghi chú sức khoẻ | Cao | Bảng riêng + policy riêng + không chọn ghi chú trong RPC danh sách; test: khách B, Gymer khác, anon đều không đọc; Gymer mất quyền sau reject/cancel |
| R5 | Đặt trùng / đua với đóng khung | Cao | Exclusion constraint + advisory lock + test song song 2 phiên |
| R6 | Dò vị trí Gymer bằng nhiều lần gọi `search_gymers` | Trung bình | Mục 2.3; không có rate limit ở v1, nói thẳng |
| R7 | Spam `pending` chiếm khung | Trung bình | Giới hạn 3 pending/khách; hết hạn 24h; chưa chặn tài khoản mới tạo hàng loạt |
| R8 | Giả định auth (S1) sai làm đổi khoá `auth.uid()` | Trung bình | Schema chỉ cần `auth.users.id` là uuid; mọi cách S1 đều tạo được; nếu S1 bắt buộc cách khác, chỉ `zalo_identities` và edge function đổi |
| R9 | `unaccent`/"đ", haversine tại cực, kết quả rỗng sai | Thấp | Ca test cụ thể |
| R10 | Mô hình lịch suy ra sai (đặc biệt ngày T7/CN, ranh giới nửa đêm, múi giờ) | Trung bình | Test với `timezone = 'UTC'` và `'Asia/Ho_Chi_Minh'`; giờ chẵn 19:00 VN = 12:00 UTC cùng ngày; 07:00 VN = 00:00 UTC cùng ngày; không có giờ nào vượt ngày |
| R11 | Pháp lý/riêng tư (mục 2.9) | Cao (ngoài kỹ thuật) | Người dùng tìm tư vấn pháp lý trước khi có người dùng thật; chặn `is_listed` cho đến khi có chính sách |
| R12 | `database.types.ts` lệch schema | Trung bình | Sinh bằng công cụ (mục 5, T9), không viết tay; kiểm typecheck |

## 5. Break-down task

### Khối chung (PM dán vào ĐẦU mọi prompt giao dev)

```
Bạn là <devN> của dự án "Gymer ơi" (Zalo Mini App, Supabase Postgres 17). Repo: /home/claude/gymer-oi, nhánh main.
KHÔNG commit, KHÔNG push, KHÔNG chạy `supabase db push`/`db reset` và KHÔNG kết nối production. Chỉ tạo/sửa đúng các file trong mục "File được phép"; cần file khác thì DỪNG và báo lại.
Đọc trước: docs/plans/supabase-schema-v1.md (mục 2 và 2A là đặc tả; mục bạn được giao ghi ở dưới) và docs/supabase-migrations.md.
Quy tắc migration SQL: idempotent (create table if not exists; drop policy if exists rồi create policy; create or replace function; enum bọc DO $$ ... exception when duplicate_object then null; end $$); MỖI create table kèm `alter table ... enable row level security;` và `revoke all on ... from anon, authenticated;` trong CÙNG file; tên bảng/cột đúng như mục 2A; không dùng drop table/truncate/delete from/alter column ... type; hàm SECURITY DEFINER phải có `set search_path = ''`, tham chiếu đối tượng có tiền tố schema, và comment `-- DEFINER vì: <lý do>`; hàm nội bộ ở schema private; mọi hàm `revoke all ... from public, anon; grant execute ... to authenticated;` (trừ trigger). Chuỗi hiển thị/lỗi nghiệp vụ dùng mã tiếng Anh viết hoa như mục 2.5. Comment tiếng Việt, ngắn.
Xác minh: nếu supabase/tests/local/run.sh đã có thì chạy nó và đưa đầu ra vào báo cáo; nếu chưa có thì chỉ nói rõ "chưa chạy được SQL" và KHÔNG khẳng định SQL đúng. Báo cáo: file đã tạo, lệnh đã chạy và kết quả thật, điểm không chắc.
```

### Thứ tự và song song

| Đợt viết | Task | Dev | Phụ thuộc | Song song với |
|---|---|---|---|---|
| 1 | T1 Migration M1 | dev1 | — | T2, T3 |
| 1 | T2 Migration M2 | dev2 | — (tên bảng theo 2A) | T1, T3 |
| 1 | T3 Bộ chạy thử Postgres cục bộ + shim | dev3 | — | T1, T2 |
| 2 | T4 Migration M3 + M4 | dev1 | T1 (enum), T3 để chạy thử | T5, T6 |
| 2 | T5 Migration M5 + M6 | dev2 | T2, T3 | T4, T6 |
| 2 | T6 Migration M7 + test RLS | dev3 | T2, T4 (tên cột bookings), T3 | T4, T5 |
| 3 | T7 Migration M8 | dev1 | đợt 2 xong | T8, T9, T10 |
| 3 | T8 Migration M9 | dev2 | đợt 2 xong | T7, T9, T10 |
| 3 | T9 Test nghiệp vụ (đặt lịch, giá, múi giờ, tìm kiếm, rating) | dev3 | đợt 2 xong; chạy được khi T7, T8 có | T7, T8, T10 |
| 3 | T10 Căn chỉnh kiểu/interface app (NGOÀI phạm vi migration) | dev1 hoặc dev2 sau xong việc | không phụ thuộc SQL | T7–T9 (khác file) |
| 4 | T11 Sinh `database.types.ts` | dev3 | SAU khi các đợt B–D đã áp dụng thật | — |

Đợt MERGE (A–D ở 3.1) khác với đợt VIẾT ở đây: PM chỉ merge theo bảng 3.1 sau khi sen1 review từng nhóm. Cuối mỗi đợt viết: PM chạy `bash supabase/tests/local/run.sh` (nếu có), sen1 review Đạt/Chưa đạt trước khi mở đợt kế tiếp.

---

### T1 — Migration M1 (dev1, đợt 1)
- Mục tiêu: file phép thử pipeline nhỏ nhất.
- File được phép: tạo `supabase/migrations/20261010100000_init_extensions_enums_private.sql`.
- Nội dung: `create extension if not exists btree_gist with schema extensions;` và `unaccent` (cùng cách); `create schema if not exists private;` (không grant gì cho client); 3 enum ở mục 2A bọc DO-exception; comment đầu file nêu mục đích và "không có bảng, không dữ liệu".
- Hoàn thành: file đúng tên/định dạng; chạy trong harness (T3) hai lần liên tiếp không lỗi; `bash scripts/ci/scan-migrations.sh supabase/migrations/20261010100000_init_extensions_enums_private.sql` ra 0 cảnh báo. Nếu T3 chưa có: chỉ báo "chưa chạy được".
- Phụ thuộc: không.

### T2 — Migration M2 (dev2, đợt 1)
- File được phép: tạo `supabase/migrations/20261010100100_core_profile_tables.sql`.
- Nội dung: theo 2A: `private.set_updated_at()`; bảng `profiles`, `zalo_identities`, `specialties` (+ seed 6 dòng), `gymer_profiles`, `gymer_locations` (+ trigger BEFORE INSERT/UPDATE làm tròn lat/lng 3 chữ số), `gymer_specialties`, `certificates`; trigger updated_at; index đã nêu; enable RLS + revoke. KHÔNG viết policy ở file này. Trigger tuổi >= 18 cho `gymer_profiles` (Q6, mặc định 18) dùng hàm `private.check_gymer_age()` (BEFORE INSERT/UPDATE).
- Hoàn thành: áp trong harness sau M1 hai lần không lỗi; `\d` các bảng đúng cột; mọi bảng `relrowsecurity = true`; `anon`/`authenticated` không có quyền trên bất kỳ bảng nào (truy vấn `information_schema.role_table_grants` ra rỗng); scan 0 cảnh báo.
- Phụ thuộc: M1 (enum `gender`, `certificate_status`) chỉ khi chạy thử.

### T3 — Harness Postgres cục bộ + shim Supabase (dev3, đợt 1)
- Mục tiêu: chạy được mọi migration và test SQL trên Postgres 16 cục bộ, vì không có Docker daemon/CLI (mục 6).
- File được phép (tạo mới): `supabase/tests/local/shim_supabase.sql`, `supabase/tests/local/run.sh`, `supabase/tests/local/README.md`. (Chỉ dùng cho test, KHÔNG nằm trong `supabase/migrations/`.)
- `shim_supabase.sql`: tạo role `anon`, `authenticated`, `service_role` (NOLOGIN); `create schema extensions`, `auth`; bảng tối thiểu `auth.users(id uuid pk default gen_random_uuid(), email text)`; hàm `auth.uid()` đọc `current_setting('request.jwt.claim.sub', true)::uuid` (null nếu rỗng); mô phỏng default privileges kiểu Supabase cho bảng mới ở `public` (cấp ALL cho anon/authenticated/service_role) để kiểm tra revoke thật sự có tác dụng; `service_role` có `bypassrls`.
- `run.sh`: (1) dựng cụm Postgres tạm trong thư mục do user `postgres` sở hữu (root không chạy được `postgres`; dùng `runuser -u postgres --`, binary ở `/usr/lib/postgresql/16/bin`, dữ liệu ở thư mục tạm riêng, cổng không mặc định, socket trong thư mục tạm); (2) tạo DB trống, nạp shim; (3) áp lần lượt `supabase/migrations/*.sql` theo thứ tự tên, mỗi file hai lần (kiểm idempotent), dừng ở lỗi đầu tiên với tên file; (4) chạy mọi `supabase/tests/local/cases/*.sql` theo thứ tự (mỗi file dùng `do $$ ... assert/raise exception ... $$` hoặc `\set ON_ERROR_STOP on`); (5) luôn dừng và xoá cụm tạm khi xong (trap EXIT). Thoát khác 0 nếu có lỗi. Thư mục `cases/` có thể rỗng ban đầu và vẫn phải pass.
- `README.md`: cách chạy, giới hạn (PG16 không phải PG17; shim không phải Supabase thật), danh sách điều KHÔNG kiểm được.
- Hoàn thành: dev chạy `bash supabase/tests/local/run.sh` với thư mục migrations rỗng (chỉ `.gitkeep`) và với M1 (nếu đã có); dán đầu ra thật. Nếu không khởi động được Postgres (quyền, cổng...), báo nguyên văn lỗi, KHÔNG sửa thành "giả vờ pass".
- Phụ thuộc: không. Lưu ý quyền: thư mục scratchpad của sen1 không dùng được cho `postgres`; dùng `mktemp -d` rồi `chown postgres`.

### T4 — Migration M3 + M4 (dev1, đợt 2)
- File được phép: tạo `supabase/migrations/20261010100200_schedule_tables.sql`, `supabase/migrations/20261010100300_booking_tables.sql`.
- M3: ba bảng lịch (2A), trigger AFTER INSERT trên `gymer_profiles` gán giờ mặc định 07,09,10,14,16,17,18,19 vào `gymer_open_hours` (hàm `private.seed_open_hours`, DEFINER vì: chèn thay chủ sở hữu; search_path cố định). Enable RLS + revoke.
- M4: `bookings` đủ check, index, ràng buộc loại trừ `bookings_no_overlap` như mục 2.4 (bọc idempotent: kiểm `pg_constraint` trước khi `alter table add constraint`), `booking_health_notes`. Enable RLS + revoke.
- Hoàn thành: harness áp hai lần không lỗi; một test nhanh bằng superuser: chèn 2 booking `pending` cùng Gymer cùng giờ => lỗi `23P01`; booking `rejected` cùng giờ chèn được; booking chồng 30 phút => lỗi; `customer_id = gymer_id` => lỗi check; scan 0 cảnh báo.
- Phụ thuộc: M1, M2 trong harness.

### T5 — Migration M5 + M6 (dev2, đợt 2)
- File được phép: tạo `supabase/migrations/20261010100400_reviews_and_triggers.sql`, `supabase/migrations/20261010100500_rls_gymer_side.sql`.
- M5: `reviews`; `private.recompute_rating(gymer uuid)` và trigger AFTER INSERT/UPDATE/DELETE (DEFINER vì: cập nhật cột client không được ghi); `private.sync_is_certified` + trigger trên `certificates` (cùng lý do). Enable RLS + revoke.
- M6: policy + grant theo cột đúng ma trận mục 2.5 cho `profiles`, `specialties`, `gymer_profiles` (bản ghi của mình + `is_listed`; policy cho người có booking viết ở M7), `gymer_locations`, `gymer_specialties`, `certificates`, `gymer_open_hours`, `gymer_day_overrides`, `gymer_slot_overrides`. Grant update theo cột đúng danh sách (không gồm `rating_*`, `is_certified`, `user_id`). Không grant gì cho `anon`.
- Hoàn thành: harness xanh; sau khi T6 có test, các ca RLS của bảng này pass; scan 0 cảnh báo; truy vấn `information_schema.column_privileges` chứng minh `authenticated` không có UPDATE trên `rating_avg`.
- Phụ thuộc: M1–M4.

### T6 — Migration M7 + test RLS (dev3, đợt 2)
- File được phép: tạo `supabase/migrations/20261010100600_rls_booking_review.sql`, `supabase/tests/local/cases/10_rls.sql`.
- M7: policy `bookings`, `booking_health_notes` (như ví dụ 2.5), `reviews`; policy bổ sung `SELECT` cho `profiles` (Gymer đọc hồ sơ khách có booking gửi cho mình) và `gymer_profiles` (khách đọc Gymer mình có booking dù đã `is_listed=false`). `grant select` cho `authenticated` trên 3 bảng; KHÔNG grant insert/update/delete.
- `10_rls.sql`: tạo hai khách A, B, hai Gymer G1, G2 (dữ liệu gieo bằng role superuser/`service_role`); với từng vai (`set local role authenticated; set local request.jwt.claim.sub = ...`), assert: A chỉ thấy booking của A; G1 chỉ thấy booking gửi G1; B không đọc `booking_health_notes` của A; G2 không đọc; G1 đọc được khi `pending/confirmed`, không đọc sau `rejected`; `anon` không đọc/ghi bảng nào; không ai ghi được `bookings`/`reviews` trực tiếp; client không ghi được `rating_avg`; `gymer_locations` của G1 không đọc được bởi A.
- Hoàn thành: `bash supabase/tests/local/run.sh` xanh, đầu ra kèm; mỗi assert có thông điệp rõ.
- Phụ thuộc: T2, T4, T5 (bảng và M6) để chạy.

### T7 — Migration M8 (dev1, đợt 3)
- File được phép: tạo `supabase/migrations/20261010100700_rpc_read.sql`.
- Nội dung: `search_gymers` (khung ở 2.3; đủ bộ lọc: keyword trên `display_name` và tên môn bằng `extensions.unaccent` + `ilike`, `p_specialty`, giới tính, rating tối thiểu, khoảng tuổi, giá tối đa; chỉ `is_listed`; tối đa 50; sắp theo khoảng cách); `get_day_slots(p_gymer_id uuid, p_day date)` trả `(start_time time, state text 'available'|'booked'|'closed', booked_by text)`; `get_month_calendar(p_gymer_id uuid, p_year int, p_month int)` trả `(day date, price_vnd int, is_open boolean, has_booked boolean)`; `gymer_certificate_badges(p_gymer_id uuid)` trả tên chứng chỉ `verified`. Quy tắc suy ra khung: mục 2.4 (mẫu + ngoại lệ - booking giữ chỗ; `pending` quá hạn coi là trống). Giá ngày = override > T7/CN > ngày thường. Revoke/grant execute; DEFINER + search_path + lý do.
- Hoàn thành: harness xanh; test cục bộ nhanh của chính task (T9 làm bộ đầy đủ): tìm "minh ha" khớp "Minh Hà"; khoảng cách giữa hai điểm biết trước đúng ±0.1 km; `get_day_slots` trả khung đã đặt là `booked`, khung đóng là `closed`.
- Phụ thuộc: M1–M7.

### T8 — Migration M9 (dev2, đợt 3)
- File được phép: tạo `supabase/migrations/20261010100800_rpc_booking_flow.sql`.
- Nội dung:
  - `create_booking(p_gymer_id uuid, p_starts_at timestamptz, p_goal text, p_health_note text, p_expected_price int) returns uuid`: kiểm đã đăng nhập; Gymer `is_listed` và `accepts_requests`; không tự đặt; thời điểm hợp lệ (mặc định sau hiện tại >= 2 giờ, <= 60 ngày; Q5); khung đang mở theo 2.4 (giờ VN); lấy advisory lock theo Gymer; chuyển `pending` quá hạn chồng khung sang `expired`; giới hạn 3 `pending`/khách (`LIMIT_REACHED`); tính giá ở server, lệch `p_expected_price` => `PRICE_CHANGED`; chèn `bookings` (`ends_at = starts_at + 60 phút`, `expires_at = least(now() + 24h, starts_at)`) và `booking_health_notes` nếu có ghi chú; bắt `exclusion_violation` => `SLOT_TAKEN`.
  - `respond_booking(p_booking_id uuid, p_decision text)`: chỉ Gymer của booking; chỉ từ `pending` chưa hết hạn (quá hạn => `BOOKING_EXPIRED` và chuyển `expired`); `p_decision` thuộc `confirmed|rejected`.
  - `cancel_booking(p_booking_id uuid)`: chỉ khách của booking, trước `starts_at`, từ `pending|confirmed` sang `cancelled` (Q4).
  - `create_review(p_booking_id uuid, p_rating int, p_body text) returns uuid`: chỉ khách của booking, `confirmed` và `ends_at < now()`, chưa có đánh giá; chụp `author_name` từ `profiles.display_name`.
  - Trigger BEFORE INSERT/UPDATE trên `gymer_day_overrides` và `gymer_slot_overrides` (đặt `is_open = false`): nếu có booking `pending|confirmed` giữ khung/ngày đó => `SLOT_HAS_BOOKING`; dùng cùng advisory lock.
  - Mã lỗi đúng danh sách 2.5, ném bằng `raise exception '<MÃ>'`.
- Hoàn thành: harness xanh; test nhanh của task: 2 `create_booking` cùng khung (hai phiên khách khác nhau) => đúng một thành công, người kia `SLOT_TAKEN`; giá T7/CN đúng; `PRICE_CHANGED`; đóng khung đã đặt bị chặn.
- Phụ thuộc: M1–M7.

### T9 — Test nghiệp vụ (dev3, đợt 3)
- File được phép: tạo `supabase/tests/local/cases/20_booking.sql`, `30_schedule_pricing.sql`, `40_search.sql`, `50_reviews_rating.sql`.
- Nội dung (mỗi file là chuỗi assert với dữ liệu gieo riêng, dọn sau mình): chống trùng (kể cả 2 kết nối psql thực sự song song dùng `pg_sleep`/hai tiến trình nền nếu làm được trong `run.sh` mà không sửa nó; nếu không, ghi rõ chỉ kiểm tuần tự); giá T7/CN và override ngày; snapshot giá không đổi khi Gymer đổi giá sau; múi giờ: chạy cùng ca với `set timezone = 'UTC'` và `'Asia/Ho_Chi_Minh'`; hết hạn pending giải phóng khung; giới hạn 3 pending; tìm: bán kính 1/2/3/5, hộp bao ở vĩ độ khác, `unaccent` với "đ", Gymer không `is_listed` không xuất hiện, bộ lọc rating/tuổi/giá; rating: trigger tính lại khi thêm đánh giá, đánh giá chỉ khi `confirmed` và đã qua giờ, mỗi booking một đánh giá; huỷ lịch/`BOOKING_EXPIRED`.
- Hoàn thành: `run.sh` xanh kèm đầu ra; mỗi ca có tên; ca nào không kiểm được (ví dụ song song thật) ghi rõ trong đầu ra.
- Phụ thuộc: T7, T8 để chạy; có thể viết trước.

### T10 — Căn chỉnh kiểu/interface app (dev1 hoặc dev2; NGOÀI phạm vi migration)
Các lệch giữa UI hiện tại và schema, kèm bên đổi (đề xuất; user duyệt kèm plan):

| Lệch | Hiện tại | Đề xuất |
|---|---|---|
| Slot không có id riêng | `Slot.id`, `setSlotClosed(slotId, closed)` | App đổi: `setSlotClosed(dateIso: string, time: string, closed: boolean)`; `Slot.id` giữ làm khoá hiển thị (mapper đặt = `time`) |
| `endIso` thừa | `BookingCreateInput.endIso` | App bỏ `endIso` (server tính +60 phút); thêm `expectedPrice: number`, `healthNote?: string` (đã có `note`; đổi tên thành `healthNote` để không nhầm) |
| Thiếu danh sách booking của khách | `BookingRepository` chỉ có `create` | App thêm `listMine(): Promise<MyBooking[]>` (kiểu mới `MyBooking` có `gymerName`, `status: BookingStatus`) |
| Trạng thái thêm | `RequestStatus` 3 giá trị | Giữ nguyên; thêm `BookingStatus = RequestStatus | 'cancelled' | 'expired'` dùng cho phía khách; mapper phía Gymer lọc `cancelled` khỏi danh sách |
| `distanceKm` bắt buộc | `Gymer.distanceKm: number` | `getDetail` không có tâm tìm kiếm => đổi thành `distanceKm?: number`; `GymerCard` ẩn đoạn "cách ..." khi vắng |
| `age` vs `birth_year` | `Gymer.age` | Giữ `age`; mapper tính từ `birth_year` theo giờ Việt Nam |
| `isNew` của yêu cầu | `BookingRequest.isNew` | Không có cột; mapper đặt `isNew = status==='pending' && tạo < 24h trước`. Nếu cần "chưa xem", thêm cột sau |
| Mã lỗi | `ErrorCode` | Thêm `PRICE_CHANGED` và `SLOT_NOT_OPEN`? Đề xuất v1: không thêm, map `PRICE_CHANGED`/`SLOT_NOT_OPEN` => `VALIDATION`/`SLOT_TAKEN`; ghi nhớ để UI hiện câu phù hợp sau |
| `Specialty` | 5 giá trị; mock có "Giãn cơ" | Giữ; tags là chuỗi tự do |

- File được phép: `src/types/domain.ts`, `src/services/repositories/scheduleRepository.ts`, `src/services/repositories/bookingRepository.ts`, `src/services/repositories/index.ts`, `src/services/createServices.ts`, `src/services/createServices.test.ts`, `src/components/ui/cards/GymerCard/GymerCard.tsx` (và test cùng thư mục nếu có). Cần file khác (ví dụ `src/mocks/*`, `src/services/index.ts`) thì dừng và báo.
- Hoàn thành: `npm run typecheck && npm run lint && npm test` xanh, số test không giảm; không sửa logic UI ngoài các điểm trong bảng; `GymerCard` có test cho trường hợp thiếu `distanceKm`.
- Phụ thuộc: không phụ thuộc SQL. Chỉ chạy sau khi người dùng duyệt các dòng bảng này (chúng đổi hợp đồng đã dùng); nếu không duyệt, bỏ T10.

### T11 — Sinh `database.types.ts` (dev3, đợt 4, SAU khi đã áp dụng thật)
- File được phép: `src/services/supabase/database.types.ts`.
- Cách làm khi không có CLI/mạng tới Supabase (môi trường này): KHÔNG viết tay. Hai đường: (a) người dùng chạy trên máy có Supabase CLI và mạng: `SUPABASE_PROJECT_ID=vbncctoffwenbnnfvwfi npm run db:types` (cần đăng nhập CLI), rồi đưa file cho dev; (b) phiên chính dùng công cụ MCP Supabase "generate TypeScript types" (nếu khả dụng) lấy nội dung rồi giao dev ghi vào file. Dev chỉ ghi nội dung được giao, giữ dòng đầu "Sinh tự động... Không sửa tay", chạy `npm run typecheck`.
- Hoàn thành: typecheck xanh; có các bảng/hàm mục 2A; kiểu enum là union.
- Phụ thuộc: các đợt merge B–D đã áp dụng thành công trên production. Nếu muốn có kiểu trước khi áp dụng thì chỉ làm được bằng harness (sinh từ DB cục bộ không khả thi ở đây: không có CLI); chấp nhận chờ.

## 6. Cách xác minh khi không chắc có Docker/`supabase start`

Đã chạy `which` trong môi trường này (2026-10-10):
- `docker`: CÓ binary (v29.8.2) nhưng daemon không chạy (không có socket) => `supabase start` không khả thi.
- `supabase` CLI: KHÔNG có (cũng không có trong `node_modules/.bin`).
- `psql` 16.15: CÓ. Máy chủ PostgreSQL 16.15: CÓ binary (`/usr/lib/postgresql/16/bin`: `initdb`, `postgres`, `pg_ctl`). Không có Postgres 17. Không có PostGIS (không thấy file extension). Contrib `btree_gist`, `cube`, `earthdistance`, `pgcrypto` có; `unaccent` chưa kiểm cụ thể.
- Sen1 đã thử `initdb` trong thư mục scratchpad: THẤT BẠI vì quyền thư mục (thư mục của root, user `postgres` không vào được); đó là lỗi của chỗ chạy thử, không chứng minh PG không chạy được. CHƯA từng khởi động được cụm PG16 ở đây => T3 là bước phải chứng minh; plan không khẳng định nó chạy.

Cách kiểm khả thi (nếu T3 thành công): dựng PG16 tạm + shim Supabase; áp migration; chạy test SQL theo vai. Kiểm được: cú pháp, thứ tự phụ thuộc, idempotent, ràng buộc/exclusion, trigger, RLS và column grant (với role `authenticated` giả lập), logic RPC, múi giờ, haversine, `unaccent`.
Nếu T3 không chạy được: chỉ còn kiểm cú pháp bằng cách đọc và quét (`scan-migrations.sh`), không có bằng chứng chạy; khi đó nên đòi người dùng chạy `supabase start` + `supabase db reset` trên máy có Docker TRƯỚC khi duyệt đợt B, và đây là điều kiện nên có (không có staging).

CHỈ kiểm được khi chạy pipeline thật (hoặc trên stack Supabase thật):
- Output thật của `supabase db push --dry-run`, cụm "up to date", cờ `--yes`, chờ duyệt đúng.
- Extension có sẵn ở hosted và nằm đúng schema `extensions` (btree_gist, unaccent); quyền của role migration (`postgres` không phải superuser).
- Default privileges thật của Supabase cho `anon`/`authenticated`; hàm `auth.uid()` thật; hành vi PostgREST với RPC, lỗi và mã lỗi trả ra client; schema `private` không lộ.
- Phiên bản PG17 vs 16 (khác biệt nhỏ nhưng tồn tại).
- Edge function `auth-zalo`/`resolve-location` (S1, S2) và dòng chảy đăng nhập thật.
- Advisor bảo mật/hiệu năng của Supabase sau áp dụng.

## 7. Thứ tự thực hiện và điểm kiểm tra

1. Người dùng duyệt plan và trả lời Q1–Q11 (ít nhất Q1, Q2, Q3, Q4, Q7, Q8, Q10). sen1 cập nhật plan nếu đổi; trạng thái về `CHỜ APPROVE` sau mỗi lần sửa.
2. Đợt viết 1 (T1–T3). Kiểm tra: T3 có đầu ra thật chứng minh harness chạy hoặc báo lỗi nguyên văn. sen1 review.
3. Merge ĐỢT A (M1 một mình). Kiểm tra: mục 3.2 điểm 1–4; ghi lại output thật của dry-run vào `docs/ci-cd-setup.md` hoặc báo lại (xác nhận/bác bỏ giả định "dry-run chỉ in tên file").
4. Đợt viết 2 (T4–T6), review. Merge ĐỢT B (M2–M5) sau khi harness xanh. Kiểm tra: bảng đủ, RLS bật, advisor.
5. Merge ĐỢT C (M6–M7) sau khi test RLS xanh. Kiểm tra: `\dp`, advisor.
6. Đợt viết 3 (T7–T9), review (sen1 soi riêng: chống trùng, giá T7/CN, RLS, ghi chú sức khoẻ, `search_path`). Merge ĐỢT D (M8–M9).
7. T11 sinh type sau Đợt D; T10 khi người dùng duyệt các thay đổi hợp đồng. Sau đó plan riêng: `auth-zalo` (S1), `resolve-location` (S2), repository Supabase thật.
