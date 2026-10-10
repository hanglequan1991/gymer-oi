Trạng thái: CHỜ APPROVE

# Plan: schema Supabase v1 (migration đầu tiên)

Phạm vi approve ban đầu (2026-10-10): TOÀN BỘ plan, thực thi theo 4 đợt merge (A: M1 là phép thử pipeline; B: bảng; C: policy; D: RPC). Mỗi đợt chỉ merge sau khi người dùng đọc dry-run và duyệt job `migrate`. Mọi thay đổi plan sau đây (nếu có) phải đưa trạng thái về `CHỜ APPROVE`.

Sửa đổi chờ approve (2026-10-10, sen1): chốt N2 "cách 2" (khách tick đồng ý chia sẻ ghi chú sức khoẻ khi đặt lịch; Gymer chỉ đọc khi có tick, booking `confirmed` hoặc `pending` còn hạn, và đến `ends_at + 1 ngày`). Vì M4 và M7 đã/đang áp lên production nên KHÔNG sửa M4/M7; thêm migration mới M7b (`20261010100650_health_note_consent.sql`, đợt C2) và đổi M9/T8/T9 chưa áp dụng. Chi tiết: mục 2.5A, mục 3, T6b; bản tóm tắt tại `docs/plans/schema-v1-n2-health-consent.md`. Phần plan đã approve trước đó không đổi ngoài các điểm này.

Tác giả: sen1. Ngày: 2026-10-10. Chỉ là tài liệu; chưa viết migration thật, chưa commit/push.
Tham chiếu: `docs/supabase-migrations.md`, `docs/ci-cd-setup.md`, `docs/project-structure.md` (mục 3), `src/types/domain.ts`, `src/services/repositories/*.ts`, `src/mocks/*`.

## 0. Giả định và câu hỏi còn mở (ngắn)

Giả định (sai thì plan đổi):
- G1. Production trống, Postgres 17, không staging. Mọi migration chạy qua `db push` sau dry-run + duyệt tay.
- G2. Thanh toán ngoài app; không có bảng thanh toán. Mỗi buổi cố định 60 phút, bắt đầu đúng giờ chẵn.
- G3. Quy mô v1 nhỏ (vài trăm Gymer, một thành phố). Con số này là phỏng đoán, chưa có dữ liệu thật.
- G4. Mọi thao tác đều cần đăng nhập Zalo; `anon` không có quyền gì (xem Q3).

Đã chốt (nguồn: người dùng trả lời 2026-10-10):
- Q1. Bỏ gói 10 buổi (khách và Gymer tự thương lượng ngoài app; không có cột, không có dòng giá này trong app). Các mục còn lại của Q1 người dùng không phản đối nên coi là ĐÃ ĐƯỢC XÁC NHẬN NGẦM (người dùng trả lời 2026-10-10): cắt khỏi v1 áp dụng hàng loạt, chọn thời lượng buổi (cố định 60 phút), upload file chứng chỉ, upload ảnh đại diện (dùng ảnh Zalo), sửa/xoá đánh giá (mục 2.8).
- Q2. Gymer dạy ở phòng tập công cộng. Giữ làm tròn toạ độ 3 chữ số (~110 m); "điểm hoạt động" là phòng tập (mục 2.3). Rủi ro Gymer nhập nhầm nhà riêng làm phòng tập: người dùng chấp nhận, "người dùng phải tự verify"; không thêm cơ chế kiểm duyệt (người dùng trả lời 2026-10-10).
- Q3. KHÔNG cho xem danh sách Gymer trước khi đăng nhập: `anon` không đọc gì.
- Q4. Huỷ lịch (người dùng trả lời 2026-10-10, bản cuối thắng): MỘT quy tắc cho cả khách và Gymer: chỉ huỷ được khi `starts_at > now()` (giờ server), cho cả `pending` và `confirmed`. Không ai huỷ được booking đã bắt đầu hoặc đã qua. Q12 (Gymer huỷ buổi `confirmed`) = ĐƯỢC, theo cùng quy tắc, đã đóng. Quy tắc ở mục 2.4A.
- Q8. KHÔNG xác minh chứng chỉ ở v1 (làm sau). Người dùng ĐỒNG Ý phương án "tự khai" (2026-10-10): Gymer tự nhập tên chứng chỉ, nhãn "Tự khai", KHÔNG tick, KHÔNG chữ "đã xác minh". Mục chứng chỉ đã đóng; việc UI/mock cần đổi ở mục 2.7 và T10.
- Q7. Khớp Q8: hồ sơ công khai hiện tên chứng chỉ tự khai, gắn nhãn "Tự khai, chưa xác minh". Không có cờ xác minh. (Khác bản đầu của yêu cầu 5 "chứng chỉ chỉ owner + cờ xác minh công khai": không còn xác minh nên cờ không có nghĩa.)
- Q11. Region Singapore (`ap-southeast-1`) được người dùng chấp nhận. Dữ liệu vẫn nằm ngoài Việt Nam; xem cảnh báo mục 2.9.
- Q5, Q6, Q9, Q10: người dùng không đổi, giữ mặc định: Q5 đặt sau hiện tại ít nhất 2 giờ và nhiều nhất 60 ngày; Q6 Gymer tối thiểu 18 tuổi (trigger), khách không thu tuổi; Q9 hiện tên người đánh giá như tên Zalo của họ; Q10 không có luồng xoá tài khoản, xử lý thủ công theo yêu cầu.

- Q13 ĐÃ ĐÓNG (người dùng trả lời 2026-10-10): áp dụng chung cho Gymer và khách như Q4 ở trên (tương đương phương án (c) cũ nhưng ranh giới là `starts_at`, không phải `ends_at`). Thay quyết định trước đó "Gymer huỷ mọi lúc".
- Rủi ro khách huỷ phút chót: người dùng bỏ qua, ghi là rủi ro chấp nhận (R14); không phạt, không cửa sổ tối thiểu.
- N2. ĐÃ ĐÓNG (người dùng quyết "cách 2", 2026-10-10): khi `create_booking`, khách tick đồng ý cho Gymer xem ghi chú sức khoẻ. Có tick thì Gymer mới đọc được, và vẫn chỉ khi booking `confirmed` hoặc `pending` còn hạn, và chỉ đến `ends_at + 1 ngày`. Không tick thì Gymer không đọc được (khách vẫn đọc ghi chú của mình). Thực hiện bằng migration mới M7b, không sửa M7 (mục 2.5A).
- N3. CHỜ QUYẾT, CẦN THỬ TRƯỚC. `reviews` lộ `author_id` và `booking_id` cho mọi người đọc được dòng đó. RLS không giới hạn theo cột, nhưng có thể giới hạn bằng quyền cột (`grant select (...)` chỉ các cột công khai, không cấp `author_id`, `booking_id`). Cần thử trên local: `select *` và embed PostgREST không lỗi ngoài ý muốn; và client có cần `author_id` để nhận "đánh giá của mình" không (nếu cần, tìm cách khác). Chưa thử thì chưa chốt.

Câu hỏi còn chờ người dùng quyết: N3 (N2 đã đóng). Điểm chưa chắc về kỹ thuật (spike S1/S2, hành vi thật của dry-run, extension trên hosted) nằm ở mục 2.1 và mục 6.

## 1. Mục tiêu và phạm vi

Mục tiêu: schema + RLS + RPC đủ cho luồng v1: đăng nhập Zalo -> tìm Gymer theo bán kính -> xem hồ sơ/lịch -> đặt lịch -> Gymer xác nhận/từ chối -> đánh giá sau buổi.

KHÔNG làm trong plan này:
- Không viết migration/SQL đầy đủ (chỉ SQL minh hoạ phần khó). Không commit/push.
- Edge function `auth-zalo`, `resolve-location` (chỉ nêu giao diện và spike, mục 2.1). Cài đặt repository Supabase thật (`src/services/supabase/*`) và nối UI: plan riêng sau khi schema chạy.
- Thanh toán, chat, thông báo đẩy (Zalo OA), admin UI, gói 10 buổi (đã bỏ, Q1), áp dụng hàng loạt, upload file, xác minh chứng chỉ (Q8), pg_cron.

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
- Vị trí Gymer: bảng `gymer_locations` chỉ chủ sở hữu đọc/ghi. Không có đường nào trả lat/lng của Gymer ra client; RPC chỉ trả `distance_km` làm tròn 0.1 km. Toạ độ ép làm tròn 3 chữ số bằng trigger. Gymer dạy ở phòng tập công cộng (Q2) nên "điểm hoạt động" là địa điểm công khai; giữ 3 chữ số (sai số ~110 m so với bán kính nhỏ nhất 1 km là chấp nhận được) như lớp phòng thủ phụ nếu Gymer lỡ nhập nhà riêng.
- Rủi ro còn lại, nói thẳng: kẻ gọi RPC nhiều lần từ nhiều toạ độ giả có thể dò (trilateration) ra điểm của Gymer với sai số ~vài chục mét. Giảm: làm tròn khoảng cách, bán kính tối đa 10 km, giới hạn tối đa 50 kết quả; rate limit thật chưa có (cần cơ chế khác, ngoài v1). Với điểm là phòng tập công cộng (Q2), dò ra điểm này không tiết lộ nhà ở; rủi ro còn lại là Gymer nhập nhầm địa chỉ nhà làm "phòng tập". Người dùng ĐÃ CHẤP NHẬN rủi ro này ("người dùng phải tự verify"); không thêm cơ chế kiểm duyệt. Việc rẻ duy nhất: UX copy trên form địa điểm, ví dụ nhãn "Phòng tập / địa điểm công cộng bạn dạy" và ghi chú "Không nhập địa chỉ nhà riêng. Vị trí này hiện trong kết quả tìm kiếm (làm tròn khoảng 100 m).". Đưa vào T10/UI khi dựng màn hồ sơ Gymer.

RPC minh hoạ (rút gọn, không phải bản cuối):

```sql
create or replace function public.search_gymers(
  p_lat double precision, p_lng double precision, p_radius_km numeric,
  p_keyword text default null, p_specialty text default null,
  p_gender public.gender default null, p_min_rating numeric default null,
  p_age_min int default null, p_age_max int default null, p_max_price int default null)
returns table (user_id uuid, display_name text, gender public.gender, age int,
               area_label text, distance_km numeric, rating_avg numeric, rating_count int,
               price_weekday_vnd int, price_weekend_vnd int, tags text[], avatar_url text)
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

### 2.4A Huỷ lịch (Q4/Q12/Q13: người dùng chốt, bản cuối 2026-10-10)

Một RPC `cancel_booking(p_booking_id uuid)`, MỘT quy tắc cho cả hai vai. Người gọi là chủ booking (`customer_id = auth.uid()` hoặc `gymer_id = auth.uid()`), xác định ở server. Cột thời gian bắt đầu trong plan tên `starts_at` (người dùng ghi `start_at`; cùng ý, kiểu `timestamptz`, so với `now()` của server).
- Điều kiện: `status in ('pending','confirmed')` VÀ `starts_at > now()`. Ngược lại: booking đã bắt đầu/đã qua => `ALREADY_STARTED` (cả hai vai; tạm map `FORBIDDEN` ở tầng services); trạng thái khác (`rejected`, `cancelled`, `expired`) hoặc người lạ => `FORBIDDEN`.
- Kết quả: `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = auth.uid()` (hai cột trên `bookings`, ràng buộc `(status = 'cancelled') = (cancelled_at is not null)`).
- Không có UPDATE trực tiếp trên `bookings` cho client (không policy `update`, không `grant update`): huỷ chỉ qua RPC SECURITY DEFINER, kiểm quyền trong thân hàm, khoá hàng `for update` để hai lần huỷ/xác nhận đồng thời không chồng nhau. Không có cửa sổ giờ tối thiểu và không có hằng số "2 giờ".
- Lịch sử buổi đã qua giờ bất biến: không RPC nào chuyển trạng thái booking có `starts_at <= now()` ngoại trừ việc lười chuyển `pending` quá hạn sang `expired` (pending chưa từng được xác nhận). `respond_booking` trên booking đã quá `expires_at` (= `least(created_at + 24h, starts_at)`) cũng không xác nhận được. Thay đổi bởi admin ngoài app (dashboard) nằm ngoài quy tắc này.
Hệ quả:
- Khung giờ trống lại NGAY khi sang `cancelled` (ràng buộc loại trừ chỉ tính `pending`/`confirmed`); `get_day_slots` trả `available` (trừ khi Gymer tự đóng khung).
- Gymer MẤT quyền đọc ghi chú sức khoẻ ngay khi `cancelled` (policy chỉ cho `pending`/`confirmed`), kể cả khi chính Gymer huỷ. Khách vẫn đọc ghi chú của mình. Hàng booking giữ lại làm lịch sử.
- Đánh giá: `create_review` yêu cầu `confirmed` và `ends_at < now()`. Vì không booking nào đã qua giờ huỷ được, booking có đánh giá không bao giờ bị huỷ; không cần mã `HAS_REVIEW` và không có đường nào "xoá dấu vết buổi tập sau đánh giá xấu" trong app. `rating_avg` không bị ảnh hưởng bởi huỷ lịch.
- Thống kê phía Gymer: "buổi tuần này", "buổi hôm nay" chỉ đếm `status = 'confirmed'`; "yêu cầu mới/chờ duyệt" chỉ đếm `pending` chưa hết hạn; `cancelled`, `expired`, `rejected` không đếm. Buổi đã qua giờ không đổi nên thống kê quá khứ ổn định. Các số này tính bằng truy vấn ở tầng repository, không có bảng thống kê riêng ở v1.
- Không có thông báo đẩy ở v1: bên kia chỉ thấy khi mở app. Mapper hiển thị "Đã huỷ" kèm ai huỷ (`cancelled_by`).
Rủi ro chấp nhận (người dùng bỏ qua, không phạt, không cửa sổ tối thiểu):
- Khách huỷ `confirmed` phút chót (miễn là `starts_at > now()`): Gymer có thể bỏ trống khung mà không kịp biết.
- Gymer huỷ sát giờ ảnh hưởng khách tương tự.
- Đặt rồi huỷ liên tục gây nhiễu lịch; giới hạn 3 `pending` chỉ chặn một phần.

### 2.5 RLS, quyền, SECURITY DEFINER

Nguyên tắc:
- Bật RLS cho MỌI bảng `public`, ngay trong chính migration tạo bảng (cùng file), kèm `revoke all ... from anon, authenticated`. Policy và `grant` chọn lọc nằm ở migration RLS riêng. Nhờ vậy giữa hai đợt deploy, bảng đã tạo vẫn đóng.
- Giả định cần kiểm sau migration (`\dp` hoặc Supabase advisor): Supabase mặc định cấp quyền rộng cho `anon`/`authenticated` trên bảng mới ở schema `public`; nên không dựa vào "chưa có policy" mà revoke tường minh.
- Ghi vào cột nhạy cảm bằng quyền theo cột: `grant update (cột...) on ... to authenticated` (RLS không giới hạn theo cột). Ví dụ `gymer_profiles`: client KHÔNG được ghi `rating_avg`, `rating_count`.
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
| `certificates` | theo quyền đọc `gymer_profiles` (công khai khi Gymer `is_listed`) | chủ insert/update/delete dòng của mình | tên tự khai, KHÔNG có trạng thái xác minh (Q8); tối đa 10 dòng/Gymer (trigger) |
| `gymer_open_hours`, `gymer_day_overrides`, `gymer_slot_overrides` | chỉ chủ | chủ | khách đọc qua RPC |
| `bookings` | khách của booking hoặc Gymer của booking | KHÔNG ghi trực tiếp | ghi qua RPC |
| `booking_health_notes` | khách của booking (luôn đọc); Gymer của booking CHỈ khi đủ cả ba: (1) khách đã tick đồng ý (`shared_with_gymer = true`), (2) booking `confirmed` hoặc `pending` còn hạn (`expires_at > now()`), (3) `now() <= ends_at + 1 ngày`. Không tick, quá hạn, quá `ends_at + 1 ngày`, `rejected`, `cancelled`, `expired`: Gymer không đọc (N2, mục 2.5A) | KHÔNG ghi trực tiếp | ghi trong `create_booking` (cùng lúc ghi cờ đồng ý); `reject`/`cancel`/hết hạn/quá 1 ngày làm Gymer mất quyền đọc; v1 không có đường thu hồi/đổi cờ |
| `reviews` | đọc được khi đọc được hồ sơ `gymer_profiles` của `gymer_id` (theo dòng trên: Gymer đang `is_listed`, hoặc chính Gymer đó, hoặc khách có booking với Gymer đó; kể cả khi Gymer đã ẩn). Đổi policy `gymer_profiles` sẽ đổi luôn phạm vi đọc `reviews` | KHÔNG ghi trực tiếp | ghi qua `create_review`; cột `author_id`, `booking_id`: xem N3 |

### 2.5A Ghi chú sức khoẻ: đồng ý của khách (N2, người dùng chốt "cách 2")

Quyết định: thêm cột `booking_health_notes.shared_with_gymer boolean not null default false` bằng migration MỚI M7b `20261010100650_health_note_consent.sql` (đợt C2, chạy sau M7 và trước M8/M9), rồi `drop policy if exists` + `create policy` lại `booking_health_notes_select`. KHÔNG sửa M4 (tạo bảng) và M7 (policy cũ) vì đã/đang áp lên production; sửa file đã áp dụng làm lệch lịch sử migration.

Lý do chọn cột trên `booking_health_notes` thay vì `bookings.health_note_shared`:
- Cờ đồng ý gắn đúng với dữ liệu nhạy cảm nó điều khiển; policy đọc cờ ngay trên hàng đang kiểm, không thêm cột vào bảng `bookings` (bảng nóng, có exclusion constraint, nhiều RPC dùng).
- Không có ghi chú thì không có hàng, nên không có trạng thái vô nghĩa "đã đồng ý chia sẻ một thứ không tồn tại".
- Client không có `insert/update` trên bảng này (M7), nên cờ chỉ được đặt trong `create_booking` (DEFINER), không ai bật lại sau khi tạo. Mặc định `false` = an toàn nếu một đường ghi nào quên đặt cờ.
- Thêm cột không-null có default hằng số vào bảng hiện có là thay đổi expand, không khoá lâu; bảng hiện chưa có dữ liệu thật (không có `create_booking` nào chạy). Hàng cũ (nếu có) mặc định `false`, tức Gymer mất quyền đọc: hướng an toàn.
- Thời điểm đồng ý = `created_at` của hàng (cùng giao dịch `create_booking`); không cần cột thời gian riêng.
Phương án đã loại: `bookings.health_note_shared` (đổi bảng nóng, cờ tách khỏi dữ liệu, có thể `true` mà không có ghi chú); cột timestamp `consented_at` (dư vì đã có `created_at`); hàm RPC đọc ghi chú riêng cho Gymer (thêm bề mặt API, trong khi policy đủ); sửa M7 tại chỗ (lệch lịch sử đã áp dụng).

Policy mới (thay thế bản trong M7; nội dung minh hoạ, T6b viết bản cuối):

```sql
alter table public.booking_health_notes
  add column if not exists shared_with_gymer boolean not null default false;

drop policy if exists booking_health_notes_select on public.booking_health_notes;
create policy booking_health_notes_select on public.booking_health_notes
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_health_notes.booking_id
      and ( b.customer_id = (select auth.uid())
         or ( booking_health_notes.shared_with_gymer
              and b.gymer_id = (select auth.uid())
              and now() <= b.ends_at + interval '1 day'
              and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now())) ) )));
```

`create_booking` (M9) nhận thêm tham số cuối `p_share_health_note boolean default false` (mục T8). Quy tắc:
- Có ghi chú (sau trim không rỗng) thì chèn hàng với `shared_with_gymer = coalesce(p_share_health_note, false)`. Không có ghi chú mà `p_share_health_note = true` => `VALIDATION` (không lưu đồng ý trống; UI vô hiệu tick khi ô ghi chú rỗng). Không thêm mã lỗi mới.
- Không tick (hoặc bỏ qua tham số) => Gymer không bao giờ đọc được; khách vẫn đọc.
- Sau `ends_at + 1 ngày` Gymer mất quyền đọc dù booking vẫn `confirmed`. Với `pending`, `expires_at <= starts_at` nên điều kiện ngày thừa nhưng vô hại.
Hệ quả và giới hạn (nói thẳng):
- Gymer không phân biệt được "khách không có ghi chú" với "khách không chia sẻ" với "đã quá hạn xem" (hàng bị RLS ẩn trong cả ba trường hợp). UI Gymer chỉ nên hiện chung một dòng, ví dụ "Không có ghi chú sức khoẻ được chia sẻ". Không thêm RPC/cột để lộ sự tồn tại của ghi chú.
- v1 khách KHÔNG rút lại được sự đồng ý sau khi đặt (không có UPDATE). Rút lại tạm thời = huỷ booking (Gymer mất quyền đọc ngay). Nếu cần rút lại độc lập: RPC `withdraw_health_note_share` ở plan sau.
- Văn bản đồng ý (ô tick) phải nói rõ: ai xem (Gymer đã chọn), khi nào (đến 1 ngày sau buổi), mục đích. Nội dung do designer/UX copy; chưa kiểm pháp lý (mục 2.9).
- Quyền của Gymer khi dữ liệu đã được đọc: Gymer có thể đã xem hoặc chép ghi chú trước khi hết hạn; DB không ngăn được. Hạn `ends_at + 1 ngày` chỉ chặn đọc tiếp qua app.

Policy cũ trong M7 (không có điều kiện đồng ý và hạn `ends_at + 1 ngày`) bị thay hoàn toàn bởi M7b; không dùng làm chuẩn nữa.

### 2.5B RPC SECURITY DEFINER và mã lỗi

RPC SECURITY DEFINER (mỗi cái kèm lý do trong comment):
- `search_gymers`, `get_day_slots`, `get_month_calendar`: cần đọc bảng mà client bị chặn (toạ độ, ngoại lệ lịch, booking của người khác để tính khung bận), chỉ trả dữ liệu công khai/đã lọc. `get_day_slots` chỉ trả `booked_by` (tên khách) khi người gọi chính là Gymer đó.
- `create_booking`, `respond_booking`, `cancel_booking`, `create_review`: kiểm điều kiện nghiệp vụ và ghi vào bảng mà client không có quyền ghi. `create_booking` có tham số `p_share_health_note` (2.5A).
- `create_booking` (M9, T8; bảng mục 3 ghi M9, không phải M8) phải từ chối Gymer `is_listed=false` bằng một mã lỗi trong danh sách trên. Cần test (T9, `20_booking.sql`): đặt Gymer đã ẩn bị từ chối.
- Trigger `private.recompute_rating` (sau thay đổi `reviews`): cập nhật cột client không được ghi.
Lỗi nghiệp vụ ném bằng `raise exception 'MÃ'` (ví dụ `SLOT_TAKEN`, `SLOT_NOT_OPEN`, `PRICE_CHANGED`, `FORBIDDEN`, `NOT_FOUND`, `BOOKING_EXPIRED`, `LIMIT_REACHED`, `ALREADY_STARTED`, `VALIDATION`); mapper ở tầng services chuyển sang `AppError`. Khớp `ErrorCode` hiện có, các mã mới (`PRICE_CHANGED`, `SLOT_NOT_OPEN`, `ALREADY_STARTED`) tạm map về `VALIDATION`/`SLOT_TAKEN`/`FORBIDDEN` (mục 5).

### 2.6 Đánh giá

- Chỉ cho đánh giá sau buổi đã xong: booking của chính khách, `status = 'confirmed'`, `ends_at < now()`, mỗi booking một đánh giá (`unique (booking_id)`). Không có trạng thái `completed` lưu trữ: "đã xong" = `confirmed` và đã qua `ends_at` (suy ra, không cần cron). Hệ quả: không có cách ghi nhận Gymer vắng mặt; khách vẫn đánh giá được. Chấp nhận ở v1. Booking đã qua giờ không huỷ được (2.4A) nên đánh giá luôn gắn với một buổi `confirmed` bất biến.
- Rating lưu denormalized: `gymer_profiles.rating_avg numeric(3,2)`, `rating_count int`, cập nhật bằng trigger sau insert/update/delete trên `reviews` (tính lại bằng aggregate theo Gymer). Lý do: bộ lọc "từ 4★" và thẻ danh sách cần giá trị này cho mọi dòng mỗi lần tìm; tính động phải join + group mỗi lần tìm. Cái giá: trigger là thêm một chỗ có thể sai, cần test; ghi lại đánh giá 0 lượt = `rating_avg 0, rating_count 0` (UI phải hiển thị "chưa có đánh giá", không hiện "0.0").
- `reviews.author_name` chụp tên tại thời điểm đánh giá (tránh mở `profiles` cho công chúng). Mapper dựng `dateLabel` từ `created_at`.
- v1 không sửa/xoá đánh giá (không có policy ghi); admin xử lý qua dashboard.
Loại: tính động (chậm dần, khó lọc); cho đánh giá bất kỳ lúc nào (đánh giá giả).

### 2.7 Chứng chỉ (Q8: không xác minh ở v1)

Quyết định (sen1 đề xuất trong khuôn khổ Q8; người dùng có thể đổi sang "bỏ hẳn"): v1 chỉ lưu chứng chỉ do Gymer TỰ KHAI. Bảng `certificates (id, gymer_id, name)`, không có `status`, `file_path`, `verified_at`; không có `gymer_profiles.is_certified`; không có enum `certificate_status`; không có RPC `gymer_certificate_badges`. Không bucket Storage, không upload.

Nói thẳng rủi ro: mockup đang có huy hiệu "Đã xác minh" và nhãn "Chứng chỉ PT". Khi không có quy trình xác minh, hiện huy hiệu "Đã xác minh" là thông tin sai và làm người dùng hiểu nhầm về an toàn/chuyên môn của Gymer (người dùng tin để đặt buổi tập và có thể khai ghi chú sức khoẻ). Ngay cả danh sách tự khai cũng có thể bị lợi dụng để khai gian.
Cách hiển thị trung thực (bắt buộc cho UI khi nối dữ liệu thật):
- KHÔNG hiện chữ/biểu tượng "Đã xác minh", dấu tick xanh, hay `Gymer.certified` ở bất kỳ đâu (thẻ danh sách, hồ sơ, hồ sơ phía Gymer).
- Phần chứng chỉ ở hồ sơ công khai đặt tiêu đề "Chứng chỉ (Gymer tự khai, chưa được Gymer ơi xác minh)"; từng dòng gắn nhãn "Tự khai".
- Phía Gymer: ô nhập tên chứng chỉ; bỏ trạng thái "đã xác minh/đang chờ" và nút tải lên (mockup hiện có) cho đến khi làm xác minh.
- Mockup trong Project cần cập nhật tương ứng (ngoài repo).
Việc phải đổi ở app (T10): `Gymer.certified` bỏ; `Certificate.verified` bỏ; mock bỏ `certified`/`verified`; ví dụ Tag "Đã xác minh" ở gallery đổi thành "Tự khai" không dấu tick.
Giảm nhẹ trong DB: tên tối đa 100 ký tự, tối đa 10 chứng chỉ mỗi Gymer (trigger). Không chặn được khai gian.
Khi làm xác minh sau (expand, không phá): thêm cột `status` (mặc định `unverified`), `file_path`, `verified_at`, bucket private `certificates` + policy `storage.objects` (schema do Supabase quản lý, rủi ro riêng) + quy trình người xác minh; làm ở plan riêng.
Loại: giữ trạng thái xác minh thủ công "dựa trên niềm tin" (người dùng đã quyết không làm); bỏ hẳn chứng chỉ khỏi v1 (an toàn hơn về hiểu nhầm, nhưng mất thông tin hữu ích và mockup có sẵn; để người dùng chọn nếu thấy rủi ro khai gian lớn hơn lợi ích).

### 2.8 Phạm vi v1: cắt (Q1: gói 10 buổi do người dùng chốt; các mục còn lại đã được xác nhận ngầm, không phản đối)

| Mục | Đề xuất | Lý do | Nếu cần sau |
|---|---|---|---|
| Gói 10 buổi | Bỏ (người dùng chốt: khách và Gymer tự thương lượng ngoài app) | Không có cột, không có logic | UI/mockup phải bỏ dòng "gói 10 buổi" khỏi bảng giá |
| Áp dụng hàng loạt | Cắt | Đặt/đóng từng ngày, từng khung đã đủ; cần RPC nguyên tử riêng | RPC `apply_schedule_bulk` |
| Chọn thời lượng buổi | Cắt (cố định 60) | Ràng buộc slot và chống trùng đơn giản hơn nhiều | Cột `slot_minutes` + sinh khung theo đó |
| Upload file chứng chỉ, xác minh chứng chỉ | Cắt (người dùng chốt xác minh để sau, Q8) | Mục 2.7 | Plan riêng: cột `status`/`file_path`, Storage |
| Upload ảnh đại diện | Cắt (dùng URL ảnh Zalo) | Cần bucket public + policy | Bucket `avatars` |
| Sửa/xoá đánh giá | Cắt | | Policy + trigger đã sẵn sàng tính lại |
| Sửa mẫu giờ mở theo thứ trong tuần | Cắt (mẫu giống nhau mọi ngày, đóng/mở bằng ngoại lệ) | Mockup không có màn sửa mẫu | Thêm cột `weekday` (expand) |
| Huỷ lịch bởi khách | GIỮ (người dùng chốt Q4, `starts_at > now()`) | Quy tắc mục 2.4A | |
| Gymer huỷ booking (cả đã xác nhận) | GIỮ (Q12 = được), cùng quy tắc `starts_at > now()` với khách | Mockup không có; cùng RPC `cancel_booking` (2.4A) | |
| Xoá tài khoản tự phục vụ | Cắt (Q10) | Cần quy tắc giữ lịch sử | |

### 2.9 Dữ liệu cá nhân

Lưu tối thiểu:
- `profiles`: `display_name`, `avatar_url` (từ Zalo). Không giới tính/tuổi/SĐT của khách.
- `gymer_profiles`: `display_name` (công khai, có thể khác tên Zalo), `gender`, `birth_year smallint` (không lưu ngày sinh đầy đủ; tuổi = năm hiện tại (giờ Việt Nam) - `birth_year`, lệch tối đa 1 tuổi, chấp nhận; lưu `age` trực tiếp sẽ cũ dần nên loại). Không lưu `lat/lng` của khách.
- `booking_health_notes.note`: tách bảng riêng để policy riêng, xoá riêng được; giới hạn 1000 ký tự; KHÔNG ghi vào log hay trả trong danh sách yêu cầu (Gymer chỉ đọc khi mở chi tiết booking). `shared_with_gymer` (M7b, N2): mặc định không chia sẻ; Gymer chỉ đọc khi khách tick đồng ý, trong hạn `ends_at + 1 ngày` (2.5A).
- `zalo_identities`: chỉ `zalo_id`, `user_id`.
Cảnh báo (không phải tư vấn pháp lý; cần người có chuyên môn xác nhận):
- Ghi chú sức khoẻ và dữ liệu vị trí thường được coi là dữ liệu cá nhân nhạy cảm theo quy định bảo vệ dữ liệu cá nhân của Việt Nam (Nghị định 13/2023 và luật bảo vệ dữ liệu cá nhân có hiệu lực từ 2026; plan không kiểm lại nội dung hiện hành). Thường đòi hỏi sự đồng ý rõ ràng, mục đích xử lý rõ, chính sách quyền riêng tư; ngoài ra Zalo Mini App có yêu cầu riêng.
- Dữ liệu nằm ở region Singapore (`ap-southeast-1`, Q11, người dùng chấp nhận); nghĩa là ngoài Việt Nam, và chuyển dữ liệu cá nhân ra nước ngoài có thể kéo theo nghĩa vụ riêng (cần người có chuyên môn pháp lý xác nhận).
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
                 │        │              ├─1─* certificates            (tự khai, chưa xác minh)
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

Bảng và cột chính (chỉ cột đáng nói; `created_at/updated_at timestamptz default now()` ở mọi bảng, `updated_at` bằng trigger `private.set_updated_at`):

- `profiles`: `id uuid pk references auth.users on delete cascade`, `display_name text not null check (char_length between 1 and 50)`, `avatar_url text`.
- `zalo_identities`: `zalo_id text pk`, `user_id uuid not null unique references profiles(id) on delete cascade`.
- `specialties`: `name text pk` (khớp `Specialty` và `tags`). Seed trong migration (`on conflict do nothing`): Gym, Giảm mỡ, Tăng cơ, Yoga, Calisthenics, Giãn cơ (mock có tag "Giãn cơ" không nằm trong union `Specialty`: nhãn tự do vẫn được, bộ lọc chỉ dùng 5 giá trị).
- `gymer_profiles`: `user_id uuid pk references profiles(id) on delete restrict`, `display_name text not null`, `gender gender not null`, `birth_year smallint not null check (between 1940 and 2100)` (+ trigger tuổi >= 18, Q6), `area_label text not null` (ví dụ "Quận 1, TP.HCM"), `bio text check (char_length <= 1000)`, `avatar_url text`, `price_weekday_vnd int not null check (between 0 and 5000000)`, `price_weekend_vnd int not null` (cùng check), `accepts_requests boolean not null default true`, `is_listed boolean not null default false`, `rating_avg numeric(3,2) not null default 0`, `rating_count int not null default 0`.
  Index: `(is_listed)` phần `where is_listed` trên `user_id`.
- `gymer_locations`: `user_id pk references gymer_profiles on delete cascade`, `lat double precision not null check (between -90 and 90)`, `lng double precision not null check (between -180 and 180)`; trigger làm tròn 3 chữ số. Index một phần `(lat, lng)` (tác dụng nhỏ ở quy mô hiện tại, ghi rõ).
- `gymer_specialties`: `pk (gymer_id, specialty_name)`, `specialty_name references specialties(name) on update cascade`.
- `certificates`: `id uuid pk default gen_random_uuid()`, `gymer_id uuid not null references gymer_profiles(user_id) on delete cascade`, `name text not null check (char_length between 1 and 100)`. Chỉ có `created_at/updated_at` chung; không có trạng thái xác minh (Q8). Trigger giới hạn 10 dòng/Gymer. Index `(gymer_id)`.
- `gymer_open_hours`: `pk (gymer_id, start_time)`, `start_time time not null check (date_part('minute', start_time) = 0 and date_part('second', start_time) = 0)`.
- `gymer_day_overrides`: `pk (gymer_id, day)`, `day date not null`, `is_open boolean not null default true`, `price_vnd int check (between 0 and 5000000)`.
- `gymer_slot_overrides`: `pk (gymer_id, day, start_time)`, `is_open boolean not null`; cùng check giờ chẵn.
- `bookings`: `id uuid pk default gen_random_uuid()`, `gymer_id uuid not null references gymer_profiles(user_id) on delete restrict`, `customer_id uuid not null references profiles(id) on delete restrict`, `starts_at timestamptz not null`, `ends_at timestamptz not null`, `goal text check (char_length <= 200)`, `price_vnd int not null check (>= 0)`, `status booking_status not null default 'pending'`, `expires_at timestamptz not null`, `responded_at timestamptz`, `cancelled_at timestamptz`, `cancelled_by uuid references profiles(id) on delete restrict`. Check: `(status = 'cancelled') = (cancelled_at is not null)`, `ends_at = starts_at + interval '60 minutes'`, `customer_id <> gymer_id`. Ràng buộc loại trừ ở 2.4. Index: `(customer_id, starts_at desc)`, `(gymer_id, status, starts_at)`.
- `booking_health_notes`: `booking_id uuid pk references bookings on delete cascade`, `note text not null check (char_length between 1 and 1000)`, `shared_with_gymer boolean not null default false` (cột này thêm bởi M7b, KHÔNG nằm trong M4).
- `reviews`: `id uuid pk`, `booking_id uuid not null unique references bookings`, `gymer_id`, `author_id`, `author_name text not null`, `rating smallint not null check (between 1 and 5)`, `body text check (<= 500)`. Index `(gymer_id, created_at desc)`.

Đối chiếu với `src/types/domain.ts` (lệch và bên nào đổi) — xem mục 5.

## 3. Chia migration

Tên file theo `docs/supabase-migrations.md`: `YYYYMMDDHHMMSS_ten.sql` (timestamp dưới đây là chỗ giữ; dev tạo bằng `supabase migration new` nếu có CLI, nếu không thì đặt tay đúng định dạng, tăng dần, sau mọi migration đã có). Mỗi file một mục đích, idempotent, KHÔNG chứa `drop table`/`truncate`/`delete from`/`alter column ... type` (script `scan-migrations.sh` sẽ cảnh báo; mong đợi 0 cảnh báo).

| # | File | Nội dung | Rủi ro |
|---|---|---|---|
| M1 | `20261010100000_init_extensions_enums_private.sql` | `create extension if not exists btree_gist, unaccent with schema extensions`; `create schema if not exists private`; 2 enum `gender`, `booking_status` (bọc `do $$ ... exception when duplicate_object`) | Thấp. Không có bảng, không có dữ liệu. PHÉP THỬ PIPELINE NHỎ NHẤT (xem 3.1) |
| M2 | `20261010100100_core_profile_tables.sql` | `private.set_updated_at`; `profiles`, `zalo_identities`, `specialties` (+seed), `gymer_profiles`, `gymer_locations` (+trigger làm tròn), `gymer_specialties`, `certificates` (tự khai, +trigger giới hạn 10 dòng/Gymer); mỗi bảng enable RLS + revoke | Trung bình |
| M3 | `20261010100200_schedule_tables.sql` | `gymer_open_hours`, `gymer_day_overrides`, `gymer_slot_overrides`; trigger gán giờ mặc định khi tạo `gymer_profiles`; enable RLS + revoke | Thấp |
| M4 | `20261010100300_booking_tables.sql` | `bookings` + exclusion constraint + index, `booking_health_notes`; enable RLS + revoke | Cao nhất trong nhóm bảng (exclusion + extension ngoài) |
| M5 | `20261010100400_reviews_and_triggers.sql` | `reviews`; `private.recompute_rating` (+trigger); enable RLS + revoke | Trung bình |
| M6 | `20261010100500_rls_gymer_side.sql` | policy + grant theo cột cho `profiles`, `specialties`, `gymer_*`, `certificates`, 3 bảng lịch | Cao (RLS sai = lộ/chặn dữ liệu) |
| M7 | `20261010100600_rls_booking_review.sql` | policy cho `bookings`, `booking_health_notes`, `reviews`; policy bổ sung `profiles`/`gymer_profiles` cho người có booking | Cao |
| M7b | `20261010100650_health_note_consent.sql` | MỚI (N2): `alter table public.booking_health_notes add column if not exists shared_with_gymer boolean not null default false`; `drop policy if exists` + `create policy booking_health_notes_select` mới (2.5A). Không sửa M4/M7 | Cao (RLS dữ liệu nhạy cảm); thay đổi nhỏ, tách đợt C2 để duyệt riêng |
| M8 | `20261010100700_rpc_read.sql` | `search_gymers`, `get_day_slots`, `get_month_calendar` + revoke/grant execute | Cao |
| M9 | `20261010100800_rpc_booking_flow.sql` | `create_booking` (có `p_share_health_note`), `respond_booking`, `cancel_booking`, `create_review`; trigger chặn đóng khung/ngày đã có booking | Cao nhất (logic nghiệp vụ, khoá, giá) |

Vì sao M6, M7 tách khỏi bảng (M2–M5): người duyệt đọc "cấu trúc" và "quyền" riêng; sai quyền sửa bằng migration quyền, không đụng cấu trúc.
Thứ tự phụ thuộc: M1 trước tất cả; M3, M4, M5 cần M2; M6 cần M2–M3; M7 cần M4–M5; M7b cần M4 (bảng) và M7 (policy cũ để thay), chạy sau M7 và trước M8/M9 (timestamp 100650 nằm giữa 100600 và 100700; không chèn trước migration đã áp dụng); M8, M9 cần M2–M5 và M7b (và nên sau M6–M7 để quyền đúng khi hàm chạy). M9 ghi cột `shared_with_gymer` nên bắt buộc sau M7b.

### 3.1 Cách đưa lên production (đợt merge)

Mỗi lần merge `main` có migration chờ thì pipeline dry-run rồi chờ duyệt. Không gộp mọi thứ một lần: file nào lỗi sẽ dừng tại đó, các file trước đã áp dụng (mỗi file một giao dịch; xem 4 về lệch trạng thái).

| Đợt | Merge | Mục đích | Điểm kiểm sau đợt |
|---|---|---|---|
| A | M1 | Phép thử pipeline: dry-run, duyệt, `--yes`, cụm "up to date" ở lần sau | Mục 3.2 điểm 1–4 |
| B | M2–M5 | Cấu trúc bảng (đóng sẵn bằng RLS+revoke) | `\dt`/dashboard: đủ bảng, RLS bật; advisor bảo mật không báo "RLS disabled" |
| C | M6–M7 | Quyền (M7 đã/đang áp, không sửa) | Chạy bộ test RLS cục bộ đã xanh trước; kiểm `\dp` |
| C2 | M7b | Cột đồng ý + policy ghi chú sức khoẻ mới (N2); merge riêng, một file | Dry-run chỉ liệt kê đúng `20261010100650_health_note_consent.sql`; sau áp: `\d booking_health_notes` có `shared_with_gymer`, `pg_policies` có đúng một policy `booking_health_notes_select` với điều kiện mới |
| D | M8–M9 | RPC | Gọi thử qua dashboard bằng role `authenticated` giả (nếu có thể); advisor "function search_path mutable" không báo |

Quy tắc chung: MỖI đợt chỉ merge vào `main` sau khi người dùng đọc dry-run (job `plan-migrate`) và duyệt job `migrate`; PM không merge đợt kế tiếp khi chưa có kết quả đợt trước.

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
9. Không có dấu vết xác minh chứng chỉ: grep `certificate_status`, `is_certified`, `verified` trong `supabase/migrations/` => kỳ vọng không có. Đợt B/C: `certificates` chỉ có `id`, `gymer_id`, `name` (+ cột thời gian).
10. Đợt C: grep policy có `anon` => không có (Q3); mọi `grant select` cho `authenticated` đúng ma trận 2.5; policy ghi chú sức khoẻ chỉ cho Gymer khi `pending`/`confirmed`. Đợt C2 (M7b): file chỉ có `alter table ... add column if not exists`, `drop policy if exists`, `create policy`; không `drop column`/`drop table`; policy mới có đủ ba điều kiện cho Gymer (`shared_with_gymer`, trạng thái, `now() <= ends_at + interval '1 day'`) và khách luôn đọc; không có policy/grant ghi nào mới; không đụng M4/M7 (`git diff` hai file đó rỗng).
11. Đợt D: `cancel_booking` đúng 2.4A: MỘT điều kiện `starts_at > now()` cho cả hai vai, không nhánh riêng theo vai về thời gian, không hằng số "2 giờ", không `HAS_REVIEW`; chỉ chuyển từ `pending`/`confirmed`; set `cancelled_at`, `cancelled_by`; khoá hàng; không có `grant update`/policy `update` trên `bookings`; không RPC nào trả lat/lng. Đợt B: `bookings` có `cancelled_at`, `cancelled_by` và check nhất quán.

## 4. Rủi ro và cách giảm

| # | Rủi ro | Mức | Giảm |
|---|---|---|---|
| R1 | Migration lỗi giữa chừng khi áp dụng thật (dry-run không bắt) | Cao | Test cục bộ trên Postgres 16 với shim (mục 6); chia đợt nhỏ; mỗi file idempotent. Khi lỗi: chạy `supabase migration list` để biết file nào đã áp dụng; file lỗi chưa được ghi nhận thì sửa tại chỗ được; file đã áp dụng thì CHỈ tạo migration mới (hành vi ghi nhận lịch sử khi lỗi: chưa kiểm, xác nhận lúc gặp) |
| R2 | Khác biệt PG16 cục bộ so với PG17 hosted và các thành phần Supabase (role, `auth.uid()`, default privileges, extension schema) | Trung bình | Shim chỉ mô phỏng; mục "CHỈ kiểm được khi chạy thật" ở mục 6 là danh sách điểm kiểm sau đợt |
| R3 | RLS/column grant sai làm lộ hoặc chặn dữ liệu | Cao | Bộ test SQL theo vai (khách A, khách B, Gymer, anon); đợt C riêng; advisor sau áp dụng |
| R4 | Rò rỉ ghi chú sức khoẻ | Cao | Bảng riêng + policy riêng + không chọn ghi chú trong RPC danh sách; test: khách B, Gymer khác, anon đều không đọc; Gymer không đọc khi khách không tick; Gymer mất quyền sau reject/cancel và sau `ends_at + 1 ngày`. Tồn dư: Gymer có thể đã chép ghi chú khi còn quyền xem; khách không rút lại được sau khi đặt (2.5A) |
| R5 | Đặt trùng / đua với đóng khung | Cao | Exclusion constraint + advisory lock + test song song 2 phiên |
| R6 | Dò vị trí Gymer bằng nhiều lần gọi `search_gymers` | Trung bình | Mục 2.3; không có rate limit ở v1, nói thẳng |
| R7 | Spam `pending` chiếm khung | Trung bình | Giới hạn 3 pending/khách; hết hạn 24h; chưa chặn tài khoản mới tạo hàng loạt |
| R8 | Giả định auth (S1) sai làm đổi khoá `auth.uid()` | Trung bình | Schema chỉ cần `auth.users.id` là uuid; mọi cách S1 đều tạo được; nếu S1 bắt buộc cách khác, chỉ `zalo_identities` và edge function đổi |
| R9 | `unaccent`/"đ", haversine tại cực, kết quả rỗng sai | Thấp | Ca test cụ thể |
| R10 | Mô hình lịch suy ra sai (đặc biệt ngày T7/CN, ranh giới nửa đêm, múi giờ) | Trung bình | Test với `timezone = 'UTC'` và `'Asia/Ho_Chi_Minh'`; giờ chẵn 19:00 VN = 12:00 UTC cùng ngày; 07:00 VN = 00:00 UTC cùng ngày; không có giờ nào vượt ngày |
| R11 | Pháp lý/riêng tư (mục 2.9) | Cao (ngoài kỹ thuật) | Người dùng tìm tư vấn pháp lý trước khi có người dùng thật; chặn `is_listed` cho đến khi có chính sách |
| R14 | Huỷ phút chót (khách hoặc Gymer), không cửa sổ tối thiểu | Thấp-TB | Người dùng bỏ qua, CHẤP NHẬN (2.4A); không phạt ở v1; `cancelled_by/at` để sau này thống kê |
| R15 | Lịch sử buổi đã qua bị sửa trong app | Thấp | Không ai huỷ được booking `starts_at <= now()` (2.4A); không UPDATE trực tiếp; test; admin sửa qua dashboard nằm ngoài app và không bị chặn |
| R13 | Hiển thị chứng chỉ tự khai bị hiểu là đã xác minh, hoặc khai gian | Trung bình | Mục 2.7: không huy hiệu/tick xanh, nhãn "Tự khai", tiêu đề rõ; T10 bỏ `certified`/`verified`; cập nhật mockup trong Project; người duyệt UI kiểm khi nối dữ liệu thật |
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
| 1 (ĐỢT A) | T1 Migration M1 | dev1 | — | T3 (T3 chạy kiểm M1 sau khi T1 xong) |
| 1B (Đợt B, CHƯA giao ở Đợt A) | T2 Migration M2 | dev2 | Đợt A đã áp dụng | — |
| 1 (ĐỢT A) | T3 Bộ chạy thử Postgres cục bộ + shim | dev3 | — (nạp M1 khi có) | T1 |
| 2 | T4 Migration M3 + M4 | dev1 | T1 (enum), T3 để chạy thử | T5, T6 |
| 2 | T5 Migration M5 + M6 | dev2 | T2, T3 | T4, T6 |
| 2 | T6 Migration M7 + test RLS | dev3 | T2, T4 (tên cột bookings), T3 | T4, T5 |
| 2b (MỚI, N2) | T6b Migration M7b + test đồng ý ghi chú | dev3 | T6 xong (M7 và `10_rls.sql` đã có) | T7, T8, T10 (khác file) |
| 3 | T7 Migration M8 | dev1 | đợt 2 xong | T8, T9, T10 |
| 3 | T8 Migration M9 | dev2 | đợt 2 xong và T6b có file M7b (cột `shared_with_gymer`) để chạy thử | T7, T9, T10 |
| 3 | T9 Test nghiệp vụ (đặt lịch, giá, múi giờ, tìm kiếm, rating) | dev3 | đợt 2 xong; chạy được khi T7, T8 có; sau T6b (cùng dev3, tuần tự) | T7, T8, T10 |
| 3 | T10 Căn chỉnh kiểu/interface app (NGOÀI phạm vi migration) | dev1 hoặc dev2 sau xong việc | không phụ thuộc SQL | T7–T9 (khác file) |
| 4 | T11 Sinh `database.types.ts` | dev3 | SAU khi các đợt B–D đã áp dụng thật | — |

Đợt MERGE (A–D ở 3.1) khác với đợt VIẾT ở đây: PM chỉ merge theo bảng 3.1 sau khi sen1 review từng nhóm. Cuối mỗi đợt viết: PM chạy `bash supabase/tests/local/run.sh` (nếu có), sen1 review Đạt/Chưa đạt trước khi mở đợt kế tiếp.

---

### T1 — Migration M1 (dev1, ĐỢT A)
- Mục tiêu: ghi file migration M1 đúng NGUYÊN VĂN bên dưới. Đây là phép thử pipeline đầu tiên; không thiết kế, không thêm bớt, không sửa tên file.
- File được phép: tạo đúng một file `supabase/migrations/20261010100000_init_extensions_enums_private.sql` với nội dung CHÍNH XÁC (chép nguyên, kể cả comment):

```sql
-- M1: extension, schema private, enum dùng chung.
-- Không có bảng, không có dữ liệu. Phép thử pipeline nhỏ nhất.

-- Extension nằm ở schema extensions (đã có sẵn trên Supabase).
create extension if not exists btree_gist with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Schema cho hàm nội bộ (trigger, helper). Không cho client truy cập.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Enum giới tính (khớp Gender trong src/types/domain.ts).
do $$
begin
  create type public.gender as enum ('female', 'male');
exception when duplicate_object then
  null;
end $$;

-- Enum trạng thái đặt lịch.
do $$
begin
  create type public.booking_status as enum ('pending', 'confirmed', 'rejected', 'cancelled', 'expired');
exception when duplicate_object then
  null;
end $$;
```

- Dừng và báo lại (đừng tự sửa) nếu: thư mục `supabase/migrations/` đã có file migration khác; tên file trùng một file đã có; bạn thấy SQL cần chỉnh mới chạy được.
- Cách kiểm tra (chạy từ `/home/claude/gymer-oi`; đều khả thi ở môi trường này, không cần Docker/Supabase CLI):
  1. `bash scripts/ci/scan-migrations.sh supabase/migrations/20261010100000_init_extensions_enums_private.sql` => phải in "không thấy mẫu nguy hiểm".
  2. Nếu `supabase/tests/local/run.sh` đã có (T3): `bash supabase/tests/local/run.sh` => phải thấy `OK: ... (lần 1)`, `OK: ... (lần 2)`, `XONG: tất cả đạt.`. Nếu chưa có: báo "chưa chạy được SQL", KHÔNG khẳng định SQL đúng.
  3. `git status --short` chỉ có đúng file mới này.
- Tiêu chí hoàn thành: file giống từng ký tự; ba lệnh trên có kết quả như nêu; báo cáo dán đầu ra thật.
- Phụ thuộc: không. Không commit, không push.

### T2 — Migration M2 (dev2, đợt 1)
- File được phép: tạo `supabase/migrations/20261010100100_core_profile_tables.sql`.
- Nội dung: theo 2A: `private.set_updated_at()`; bảng `profiles`, `zalo_identities`, `specialties` (+ seed 6 dòng), `gymer_profiles`, `gymer_locations` (+ trigger BEFORE INSERT/UPDATE làm tròn lat/lng 3 chữ số), `gymer_specialties`, `certificates` (chỉ `id`, `gymer_id`, `name`; trigger `private.limit_certificates()` tối đa 10 dòng/Gymer); trigger updated_at; index đã nêu; enable RLS + revoke. KHÔNG viết policy ở file này. Trigger tuổi >= 18 cho `gymer_profiles` (Q6, mặc định 18) dùng hàm `private.check_gymer_age()` (BEFORE INSERT/UPDATE).
- Hoàn thành: áp trong harness sau M1 hai lần không lỗi; `\d` các bảng đúng cột; mọi bảng `relrowsecurity = true`; `anon`/`authenticated` không có quyền trên bất kỳ bảng nào (truy vấn `information_schema.role_table_grants` ra rỗng); scan 0 cảnh báo.
- Phụ thuộc: M1 (enum `gender`) chỉ khi chạy thử.

### T3 — Harness Postgres cục bộ + shim Supabase (dev3, ĐỢT A)
- Mục tiêu: chạy migration và test SQL trên Postgres 16 tạm vì không có Docker daemon/Supabase CLI. Chép NGUYÊN VĂN các file bên dưới (sen1 đã chạy thử bản này, mục 6). Không thiết kế lại, không đổi tên, không thêm tính năng.
- File được phép (tạo mới): `supabase/tests/local/shim_supabase.sql`, `supabase/tests/local/run.sh`, `supabase/tests/local/README.md`, `supabase/tests/local/cases/00_m1_smoke.sql`. Không đụng `supabase/migrations/`. Sau khi tạo: `chmod +x supabase/tests/local/run.sh`.

`supabase/tests/local/shim_supabase.sql`:
```sql
-- Shim tối thiểu mô phỏng Supabase trên Postgres thường. CHỈ dùng cho test cục bộ, không phải migration.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- auth.uid() đọc từ cài đặt phiên: set local request.jwt.claim.sub = '<uuid>'.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Mô phỏng default privileges của Supabase: đối tượng mới ở schema public được cấp rộng.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
```

`supabase/tests/local/run.sh`:
```bash
#!/usr/bin/env bash
# Chạy migration + test SQL trên Postgres 16 tạm. Xem README.md. KHÔNG đụng production.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PG_TEST_PORT:-54329}"
DB=gymer_test

[ -x "$PGBIN/initdb" ] || { echo "LỖI: không thấy $PGBIN/initdb (đặt PGBIN nếu khác)."; exit 2; }

WORK="$(mktemp -d /var/tmp/gymer-pgtest.XXXXXX)"
RUN=()
if [ "$(id -u)" = "0" ]; then
  # root không chạy được postgres: dùng user postgres, thư mục tạm phải thuộc user đó.
  chown postgres "$WORK"
  RUN=(runuser -u postgres --)
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres -E UTF8 --locale=C.UTF-8 --no-sync >"$WORK/initdb.log" 2>&1 \
  || { echo "LỖI initdb:"; tail -20 "$WORK/initdb.log"; exit 3; }
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -w -l "$WORK/server.log" \
  -o "-c listen_addresses='' -c unix_socket_directories=$WORK -p $PORT" start >/dev/null \
  || { echo "LỖI khởi động Postgres:"; tail -20 "$WORK/server.log"; exit 4; }

psql_run() { "${RUN[@]}" "$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -d "$DB" -X -q -v ON_ERROR_STOP=1 "$@"; }
"${RUN[@]}" "$PGBIN/createdb" -h "$WORK" -p "$PORT" -U postgres "$DB"
echo "Postgres: $(psql_run -At -c 'select version()')"

psql_run < "$HERE/shim_supabase.sql"
echo "OK: shim_supabase.sql"

shopt -s nullglob
for f in "$ROOT"/supabase/migrations/*.sql; do
  for pass in 1 2; do
    # -1: mỗi file một giao dịch, giống supabase db push.
    psql_run -1 < "$f" || { echo "THẤT BẠI: $(basename "$f") (lần $pass)"; exit 1; }
    echo "OK: $(basename "$f") (lần $pass)"
  done
done
for f in "$HERE"/cases/*.sql; do
  psql_run < "$f" || { echo "THẤT BẠI test: $(basename "$f")"; exit 1; }
  echo "OK test: $(basename "$f")"
done
echo "XONG: tất cả đạt."
```

`supabase/tests/local/cases/00_m1_smoke.sql`:
```sql
do $$
begin
  assert (select count(*) from pg_extension where extname in ('btree_gist','unaccent')) = 2, 'thiếu extension';
  assert (select count(*) from pg_namespace where nspname = 'private') = 1, 'thiếu schema private';
  assert (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public' and t.typname in ('gender','booking_status')) = 2, 'thiếu enum';
  assert (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid
          where t.typname = 'booking_status') = array['pending','confirmed','rejected','cancelled','expired'], 'sai nhãn booking_status';
  assert not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated không được dùng schema private';
  assert not has_schema_privilege('anon', 'private', 'usage'), 'anon không được dùng schema private';
  raise notice 'unaccent(Đức Hà) = %', extensions.unaccent('Đức Hà');
end $$;
```

`supabase/tests/local/README.md` (nội dung đúng như khối sau, không kể dòng rào):
```
# Test cục bộ cho migration

Chạy: `bash supabase/tests/local/run.sh` (từ gốc repo).

Làm gì: dựng Postgres 16 tạm (thư mục /var/tmp/gymer-pgtest.*, chỉ socket, cổng 54329 hoặc PG_TEST_PORT), nạp shim_supabase.sql, áp từng file trong supabase/migrations/ theo thứ tự (mỗi file hai lần, mỗi lần một giao dịch), rồi chạy cases/*.sql. Tự dọn khi xong.
Chạy bằng root thì tự dùng user postgres (runuser). Cần binary ở /usr/lib/postgresql/16/bin (đổi bằng biến PGBIN).

Giới hạn (nói thẳng): đây là Postgres 16, KHÔNG phải 17; shim chỉ mô phỏng role anon/authenticated/service_role, auth.uid() và default privileges, KHÔNG phải Supabase thật. Không kiểm được: output thật của `supabase db push --dry-run`, extension trên hosted, PostgREST/RPC qua API, edge function, quyền của role migration trên hosted.
Test case: thêm file *.sql vào cases/, dùng do $$ ... assert ... $$; lỗi => run.sh dừng với mã khác 0.
```

- Dừng và báo lại (đừng tự sửa) nếu: `run.sh` báo lỗi khởi động Postgres (dán nguyên văn dòng `LỖI ...` và 20 dòng log); `/usr/lib/postgresql/16/bin/initdb` không có; cổng 54329 bận (có thể đặt `PG_TEST_PORT` khác để chạy thử, rồi báo); bạn muốn đổi nội dung file.
- Cách kiểm tra (từ `/home/claude/gymer-oi`):
  1. Nếu T1 chưa xong (chưa có file M1): bỏ tạm `cases/00_m1_smoke.sql` ra ngoài thư mục (hoặc chạy sau khi T1 xong), chạy `bash supabase/tests/local/run.sh` => thấy `Postgres: PostgreSQL 16...`, `OK: shim_supabase.sql`, `XONG: tất cả đạt.`; trả file về chỗ cũ.
  2. Khi M1 đã có (T1 xong): `bash supabase/tests/local/run.sh; echo EXIT=$?` => thấy `OK: 20261010100000_init_extensions_enums_private.sql (lần 1)` và `(lần 2)`, `OK test: 00_m1_smoke.sql`, `XONG: tất cả đạt.`, `EXIT=0`.
  3. `ls /var/tmp | grep gymer-pgtest` => rỗng (đã dọn).
  4. `git status --short` chỉ có các file thuộc T3 (+ file của T1 nếu đã có).
- Tiêu chí hoàn thành: các file giống nguyên văn; bước 2 và 3 đạt; báo cáo dán đầu ra thật của bước 2.
- Phụ thuộc: bước kiểm 2 cần T1 xong. Không commit, không push.

### T4 — Migration M3 + M4 (dev1, đợt 2)
- File được phép: tạo `supabase/migrations/20261010100200_schedule_tables.sql`, `supabase/migrations/20261010100300_booking_tables.sql`.
- M3: ba bảng lịch (2A), trigger AFTER INSERT trên `gymer_profiles` gán giờ mặc định 07,09,10,14,16,17,18,19 vào `gymer_open_hours` (hàm `private.seed_open_hours`, DEFINER vì: chèn thay chủ sở hữu; search_path cố định). Enable RLS + revoke.
- M4: `bookings` đủ check, index, ràng buộc loại trừ `bookings_no_overlap` như mục 2.4 (bọc idempotent: kiểm `pg_constraint` trước khi `alter table add constraint`), `booking_health_notes`. Enable RLS + revoke.
- Hoàn thành: harness áp hai lần không lỗi; một test nhanh bằng superuser: chèn 2 booking `pending` cùng Gymer cùng giờ => lỗi `23P01`; booking `rejected` cùng giờ chèn được; booking chồng 30 phút => lỗi; `customer_id = gymer_id` => lỗi check; scan 0 cảnh báo.
- Phụ thuộc: M1, M2 trong harness.

### T5 — Migration M5 + M6 (dev2, đợt 2)
- File được phép: tạo `supabase/migrations/20261010100400_reviews_and_triggers.sql`, `supabase/migrations/20261010100500_rls_gymer_side.sql`.
- M5: `reviews`; `private.recompute_rating(gymer uuid)` và trigger AFTER INSERT/UPDATE/DELETE (DEFINER vì: cập nhật cột client không được ghi). Enable RLS + revoke. (Không còn `sync_is_certified`: không có xác minh, Q8.)
- M6: policy + grant theo cột đúng ma trận mục 2.5 cho `profiles`, `specialties`, `gymer_profiles` (bản ghi của mình + `is_listed`; policy cho người có booking viết ở M7), `gymer_locations`, `gymer_specialties`, `certificates` (đọc theo quyền đọc `gymer_profiles`; chủ ghi dòng của mình), `gymer_open_hours`, `gymer_day_overrides`, `gymer_slot_overrides`. Grant update theo cột đúng danh sách (không gồm `rating_*`, `user_id`). Không grant gì cho `anon`.
- Hoàn thành: harness xanh; sau khi T6 có test, các ca RLS của bảng này pass; scan 0 cảnh báo; truy vấn `information_schema.column_privileges` chứng minh `authenticated` không có UPDATE trên `rating_avg`.
- Phụ thuộc: M1–M4.

### T6 — Migration M7 + test RLS (dev3, đợt 2)
- File được phép: tạo `supabase/migrations/20261010100600_rls_booking_review.sql`, `supabase/tests/local/cases/10_rls.sql`.
- M7: policy `bookings`, `booking_health_notes` (như ví dụ 2.5), `reviews`; policy bổ sung `SELECT` cho `profiles` (Gymer đọc hồ sơ khách có booking gửi cho mình) và `gymer_profiles` (khách đọc Gymer mình có booking dù đã `is_listed=false`). `grant select` cho `authenticated` trên 3 bảng; KHÔNG grant insert/update/delete.
- `10_rls.sql`: tạo hai khách A, B, hai Gymer G1, G2 (dữ liệu gieo bằng role superuser/`service_role`); với từng vai (`set local role authenticated; set local request.jwt.claim.sub = ...`), assert: A chỉ thấy booking của A; G1 chỉ thấy booking gửi G1; B không đọc `booking_health_notes` của A; G2 không đọc; G1 đọc được khi `pending/confirmed`, không đọc sau `rejected` hoặc `cancelled` (kể cả khi chính G1 huỷ); chứng chỉ của Gymer `is_listed=false` không đọc được bởi khách không có booking, người khác không ghi/xoá được chứng chỉ của G1; `anon` không đọc/ghi bảng nào; không ai ghi được `bookings`/`reviews` trực tiếp; client không ghi được `rating_avg`; `gymer_locations` của G1 không đọc được bởi A.
- Hoàn thành: `bash supabase/tests/local/run.sh` xanh, đầu ra kèm; mỗi assert có thông điệp rõ.
- Phụ thuộc: T2, T4, T5 (bảng và M6) để chạy.

### T6b — Migration M7b + test đồng ý ghi chú sức khoẻ (dev3, đợt 2b; N2)
- Bối cảnh: người dùng chốt N2 "cách 2" (mục 2.5A). M4 và M7 đã/đang áp lên production nên TUYỆT ĐỐI không sửa hai file đó; mọi thay đổi nằm trong migration mới.
- File được phép: tạo `supabase/migrations/20261010100650_health_note_consent.sql`; tạo `supabase/tests/local/cases/15_health_consent.sql`; sửa `supabase/tests/local/cases/10_rls.sql` CHỈ để các dòng seed `insert into public.booking_health_notes` (khoảng dòng 63 và 365) thêm cột `shared_with_gymer` = `true` cho những hàng mà các assert Gymer-đọc-được hiện có đang kỳ vọng (b1, b2, và nhóm b13, b14), vì sau M7b mặc định `false`. Không đổi assert khác. Không sửa file migration nào khác (`git diff` trên M4 và M7 phải rỗng).
- Nội dung migration (idempotent, KHÔNG có `drop column`/`delete`): (1) `alter table public.booking_health_notes add column if not exists shared_with_gymer boolean not null default false;` kèm `comment on column`; (2) `drop policy if exists booking_health_notes_select on public.booking_health_notes;` rồi `create policy` đúng như mục 2.5A (khách của booking luôn đọc; Gymer chỉ khi `shared_with_gymer` VÀ `now() <= b.ends_at + interval '1 day'` VÀ (`confirmed` hoặc `pending` với `expires_at > now()`)). Không thêm policy/grant ghi; không `grant` nào cho `anon`. Comment tiếng Việt ngắn nêu N2.
- `15_health_consent.sql` (assert có thông điệp, gieo dữ liệu bằng superuser rồi `set local role authenticated` + `request.jwt.claim.sub`; ghi chú chèn trực tiếp, không dùng RPC vì M9 chưa chắc có): Gymer KHÔNG đọc khi `shared_with_gymer=false` (booking `confirmed` còn trong hạn); Gymer đọc được khi `true` + `confirmed` trong hạn; Gymer đọc được khi `true` + `pending` còn hạn; KHÔNG đọc khi `true` + `pending` quá `expires_at`; KHÔNG đọc khi `true` + `confirmed` mà `now() > ends_at + 1 ngày` (gieo ends_at lùi 1 ngày + vài giờ), và ĐỌC được khi `ends_at` lùi chỉ vài giờ (còn trong 1 ngày); KHÔNG đọc khi `true` + `rejected`/`cancelled`/`expired`; khách của booking đọc được ở mọi trường hợp trên (kể cả `false`, kể cả quá hạn); khách khác, Gymer khác, anon không đọc; client không đổi được `shared_with_gymer` bằng UPDATE/INSERT (bắt `42501`); cột tồn tại với `boolean not null default false` (truy vấn `information_schema.columns`); `pg_policies` có đúng MỘT policy SELECT `booking_health_notes_select` và không có policy ghi. Tránh chia sẻ một giá trị tuyệt đối sát ranh giới (không assert đúng giây `ends_at + 1 ngày`).
- Hoàn thành: `bash supabase/tests/local/run.sh` xanh, dán đầu ra thật (M7b chạy 2 lần liên tiếp OK; `10_rls.sql` và `15_health_consent.sql` OK); `bash scripts/ci/scan-migrations.sh supabase/migrations/20261010100650_health_note_consent.sql` 0 cảnh báo; `git status --short` chỉ có ba file trên.
- Phụ thuộc: T6 xong. Không commit, không push.

### T7 — Migration M8 (dev1, đợt 3)
- File được phép: tạo `supabase/migrations/20261010100700_rpc_read.sql`.
- Nội dung: `search_gymers` (khung ở 2.3; đủ bộ lọc: keyword trên `display_name` và tên môn bằng `extensions.unaccent` + `ilike`, `p_specialty`, giới tính, rating tối thiểu, khoảng tuổi, giá tối đa; chỉ `is_listed`; tối đa 50; sắp theo khoảng cách); `get_day_slots(p_gymer_id uuid, p_day date)` trả `(start_time time, state text 'available'|'booked'|'closed', booked_by text)`; `get_month_calendar(p_gymer_id uuid, p_year int, p_month int)` trả `(day date, price_vnd int, is_open boolean, has_booked boolean)`; KHÔNG có RPC chứng chỉ (đọc thẳng bảng qua RLS). Quy tắc suy ra khung: mục 2.4 (mẫu + ngoại lệ - booking giữ chỗ; `pending` quá hạn coi là trống). Giá ngày = override > T7/CN > ngày thường. Revoke/grant execute; DEFINER + search_path + lý do.
- Hoàn thành: harness xanh; test cục bộ nhanh của chính task (T9 làm bộ đầy đủ): tìm "minh ha" khớp "Minh Hà"; khoảng cách giữa hai điểm biết trước đúng ±0.1 km; `get_day_slots` trả khung đã đặt là `booked`, khung đóng là `closed`.
- Phụ thuộc: M1–M7.

### T8 — Migration M9 (dev2, đợt 3)
- File được phép: tạo `supabase/migrations/20261010100800_rpc_booking_flow.sql`.
- Nội dung:
  - `create_booking(p_gymer_id uuid, p_starts_at timestamptz, p_goal text, p_health_note text, p_expected_price int, p_share_health_note boolean default false) returns uuid` (N2, mục 2.5A; M9 chưa áp dụng nên được tự do đặt chữ ký này, không cần giữ chữ ký cũ): `p_health_note` sau trim rỗng/null => không chèn hàng ghi chú, và nếu `p_share_health_note` là `true` => `raise exception 'VALIDATION'`; có ghi chú => chèn `booking_health_notes (booking_id, note, shared_with_gymer)` với `shared_with_gymer = coalesce(p_share_health_note, false)`; không tick => `false`. Không thêm mã lỗi mới. Kiểm đã đăng nhập; Gymer `is_listed` và `accepts_requests`; không tự đặt; thời điểm hợp lệ (mặc định sau hiện tại >= 2 giờ, <= 60 ngày; Q5); khung đang mở theo 2.4 (giờ VN); lấy advisory lock theo Gymer; chuyển `pending` quá hạn chồng khung sang `expired`; giới hạn 3 `pending`/khách (`LIMIT_REACHED`); tính giá ở server, lệch `p_expected_price` => `PRICE_CHANGED`; chèn `bookings` (`ends_at = starts_at + 60 phút`, `expires_at = least(now() + 24h, starts_at)`) và `booking_health_notes` nếu có ghi chú; bắt `exclusion_violation` => `SLOT_TAKEN`.
  - `respond_booking(p_booking_id uuid, p_decision text)`: chỉ Gymer của booking; chỉ từ `pending` chưa hết hạn (quá hạn => `BOOKING_EXPIRED` và chuyển `expired`); `p_decision` thuộc `confirmed|rejected`.
  - `cancel_booking(p_booking_id uuid)`: đúng mục 2.4A. Khoá hàng booking `for update`; xác định người gọi là `customer_id` hoặc `gymer_id` (nếu không phải => `FORBIDDEN`); điều kiện duy nhất cho cả hai vai: `status in ('pending','confirmed')` và `starts_at > now()`, nếu `starts_at <= now()` => `ALREADY_STARTED`, trạng thái khác => `FORBIDDEN`. Set `status='cancelled'`, `cancelled_at=now()`, `cancelled_by=auth.uid()`. Không có hằng số cửa sổ giờ, không kiểm `reviews`.
  - `create_review(p_booking_id uuid, p_rating int, p_body text) returns uuid`: chỉ khách của booking, `confirmed` và `ends_at < now()`, chưa có đánh giá; chụp `author_name` từ `profiles.display_name`.
  - Trigger BEFORE INSERT/UPDATE trên `gymer_day_overrides` và `gymer_slot_overrides` (đặt `is_open = false`): nếu có booking `pending|confirmed` giữ khung/ngày đó => `SLOT_HAS_BOOKING`; dùng cùng advisory lock.
  - Mã lỗi đúng danh sách 2.5, ném bằng `raise exception '<MÃ>'`.
- Hoàn thành: harness xanh; test nhanh của task: 2 `create_booking` cùng khung (hai phiên khách khác nhau) => đúng một thành công, người kia `SLOT_TAKEN`; giá T7/CN đúng; `PRICE_CHANGED`; đóng khung đã đặt bị chặn; `create_booking` có tick => hàng ghi chú `shared_with_gymer = true`, không tick => `false`, tick mà ghi chú rỗng => `VALIDATION`.
- Phụ thuộc: M1–M7 và M7b (cột `shared_with_gymer`; không sửa file M7b, của T6b).

### T9 — Test nghiệp vụ (dev3, đợt 3)
- File được phép: tạo `supabase/tests/local/cases/20_booking.sql`, `30_schedule_pricing.sql`, `40_search.sql`, `50_reviews_rating.sql`.
- Nội dung (mỗi file là chuỗi assert với dữ liệu gieo riêng, dọn sau mình): chống trùng (kể cả 2 kết nối psql thực sự song song dùng `pg_sleep`/hai tiến trình nền nếu làm được trong `run.sh` mà không sửa nó; nếu không, ghi rõ chỉ kiểm tuần tự); giá T7/CN và override ngày; snapshot giá không đổi khi Gymer đổi giá sau; múi giờ: chạy cùng ca với `set timezone = 'UTC'` và `'Asia/Ho_Chi_Minh'`; hết hạn pending giải phóng khung; giới hạn 3 pending; huỷ lịch theo 2.4A (cùng ca cho cả hai vai): khách và Gymer đều huỷ được `pending` và `confirmed` khi `starts_at > now()`; cả hai bị `ALREADY_STARTED` khi `starts_at <= now()` (kể cả booking đang diễn ra, đã qua, đã có đánh giá); huỷ `rejected`/`expired`/`cancelled` => `FORBIDDEN`; người thứ ba => `FORBIDDEN`; `UPDATE public.bookings` trực tiếp bằng role `authenticated` bị từ chối; sau huỷ người khác đặt lại được khung và Gymer mất quyền đọc ghi chú sức khoẻ; ghi chú sức khoẻ qua `create_booking` (N2, đọc bằng role `authenticated` của Gymer, ghi chú không được rò qua RPC/danh sách): (a) CÓ tick + `confirmed` => Gymer đọc được; (b) KHÔNG tick (cả `false` tường minh lẫn bỏ tham số) => Gymer không đọc, khách vẫn đọc; (c) tick mà ghi chú rỗng => `VALIDATION`; (d) CÓ tick nhưng `ends_at + 1 ngày` đã qua (đưa `ends_at` lùi bằng superuser, hoặc gieo booking quá khứ) => Gymer không đọc, khách vẫn đọc; (e) CÓ tick + `pending` quá `expires_at` (hoặc đã `expired` lười) => Gymer không đọc; (f) CÓ tick rồi `rejected`/`cancelled` => Gymer không đọc; (g) `pending` còn hạn + tick => Gymer đọc được trước khi respond; `create_review` cho booking `cancelled` => lỗi; thống kê `confirmed` không đếm booking đã huỷ; dữ liệu booking đã qua giờ không đổi sau mọi RPC; certificates: tối đa 10 dòng/Gymer; tìm: bán kính 1/2/3/5, hộp bao ở vĩ độ khác, `unaccent` với "đ", Gymer không `is_listed` không xuất hiện, bộ lọc rating/tuổi/giá; rating: trigger tính lại khi thêm đánh giá, đánh giá chỉ khi `confirmed` và đã qua giờ, mỗi booking một đánh giá; huỷ lịch/`BOOKING_EXPIRED`.
- Hoàn thành: `run.sh` xanh kèm đầu ra; mỗi ca có tên; ca nào không kiểm được (ví dụ song song thật) ghi rõ trong đầu ra.
- Phụ thuộc: T7, T8 để chạy; có thể viết trước.

### T10 — Căn chỉnh kiểu/interface app (dev1 hoặc dev2; NGOÀI phạm vi migration)
Các lệch giữa UI hiện tại và schema, kèm bên đổi (đề xuất; user duyệt kèm plan):

| Lệch | Hiện tại | Đề xuất |
|---|---|---|
| Slot không có id riêng | `Slot.id`, `setSlotClosed(slotId, closed)` | App đổi: `setSlotClosed(dateIso: string, time: string, closed: boolean)`; `Slot.id` giữ làm khoá hiển thị (mapper đặt = `time`) |
| `endIso` thừa | `BookingCreateInput.endIso` | App bỏ `endIso` (server tính +60 phút); thêm `expectedPrice: number`, `healthNote?: string` (đã có `note`; đổi tên thành `healthNote` để không nhầm) |
| Thiếu danh sách booking của khách | `BookingRepository` chỉ có `create` | App thêm `listMine(): Promise<MyBooking[]>` (kiểu mới `MyBooking` có `gymerName`, `status: BookingStatus`) |
| Chứng chỉ không xác minh (Q8) | `Gymer.certified: boolean`; `Certificate.verified: boolean`; mock có `certified`/`verified`; gallery có Tag "Đã xác minh" | Bỏ `Gymer.certified` và `Certificate.verified` (còn `{ id, name }`); mock bỏ hai trường; Tag ví dụ ở gallery đổi sang "Tự khai" không dấu tick; UI hồ sơ khi dựng phải theo mục 2.7 |
| Form địa điểm Gymer (Q2) | Chưa có màn thật | Khi dựng: nhãn "Phòng tập / địa điểm công cộng bạn dạy" và ghi chú không nhập nhà riêng (mục 2.3); không thêm kiểm duyệt |
| Huỷ lịch (Q4) | `RequestRepository` chỉ có `respond` | Thêm `cancel(bookingId)` dùng chung hai phía (ở `BookingRepository` hoặc `RequestRepository`, chọn một khi làm); `MyBooking`/`BookingRequest` có `cancelledBy?: 'customer'|'gymer'`; lỗi `ALREADY_STARTED` map về `FORBIDDEN`; UI chỉ hiện nút Huỷ khi `start > now` |
| Gói 10 buổi (Q1) | Mockup có dòng bảng giá "gói 10 buổi"; type và mock không có | Không đổi type; chỉ nhắc: không dựng dòng này khi làm màn hồ sơ |
| Trạng thái thêm | `RequestStatus` 3 giá trị | Giữ nguyên; thêm `BookingStatus = RequestStatus | 'cancelled' | 'expired'` dùng cho phía khách; mapper phía Gymer lọc `cancelled` khỏi danh sách |
| `distanceKm` bắt buộc | `Gymer.distanceKm: number` | `getDetail` không có tâm tìm kiếm => đổi thành `distanceKm?: number`; `GymerCard` ẩn đoạn "cách ..." khi vắng |
| `age` vs `birth_year` | `Gymer.age` | Giữ `age`; mapper tính từ `birth_year` theo giờ Việt Nam |
| `isNew` của yêu cầu | `BookingRequest.isNew` | Không có cột; mapper đặt `isNew = status==='pending' && tạo < 24h trước`. Nếu cần "chưa xem", thêm cột sau |
| Đồng ý chia sẻ ghi chú sức khoẻ (N2) | `BookingCreateInput` có `healthNote?` | Thêm `shareHealthNote?: boolean` (mặc định `false`); mapper gửi `p_share_health_note`; mock giữ nguyên hành vi. UI (ô tick, copy đồng ý, vô hiệu khi ô ghi chú rỗng) do designer đặc tả, chưa làm ở T10; phía Gymer hiện một dòng chung "Không có ghi chú sức khoẻ được chia sẻ" (2.5A) |
| Mã lỗi | `ErrorCode` | Thêm `PRICE_CHANGED` và `SLOT_NOT_OPEN`? Đề xuất v1: không thêm, map `PRICE_CHANGED`/`SLOT_NOT_OPEN` => `VALIDATION`/`SLOT_TAKEN`; ghi nhớ để UI hiện câu phù hợp sau |
| `Specialty` | 5 giá trị; mock có "Giãn cơ" | Giữ; tags là chuỗi tự do |

- File được phép: `src/types/domain.ts`, `src/services/repositories/scheduleRepository.ts`, `src/services/repositories/bookingRepository.ts`, `src/services/repositories/index.ts`, `src/services/createServices.ts`, `src/services/createServices.test.ts`, `src/components/ui/cards/GymerCard/GymerCard.tsx` (và test cùng thư mục nếu có), `src/mocks/gymers.ts` (bỏ `certified`/`verified`), `src/pages/gallery/sections/AtomsSection.tsx` (chỉ ví dụ Tag "Đã xác minh" ở khoảng dòng 53). Cần file khác (ví dụ `src/mocks/*` còn lại, `src/services/index.ts`) thì dừng và báo; nếu vượt ngân sách context thì báo để chia đôi (hợp đồng services trước, chứng chỉ/mock sau).
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
- `psql` 16.15: CÓ. Máy chủ PostgreSQL 16.15: CÓ binary (`/usr/lib/postgresql/16/bin`: `initdb`, `postgres`, `pg_ctl`). Không có Postgres 17. Không có PostGIS. Contrib `btree_gist`, `unaccent`, `pgcrypto` có.
- ĐÃ KIỂM (sen1, 2026-10-10): cụm PG16 tạm KHỞI ĐỘNG ĐƯỢC ở đây khi chạy bằng `runuser -u postgres --` với thư mục dữ liệu thuộc `postgres` dưới `/var/tmp` (lỗi quyền lần đầu là do thư mục scratchpad của root; root không chạy được `postgres`). Bản `run.sh` + shim + M1 + test khói ở mục T1/T3 đã được chạy ở một cây thư mục tạm ngoài repo: shim nạp OK, M1 áp hai lần liên tiếp OK (mỗi lần một giao dịch), test khói pass, chạy lại với thư mục migrations rỗng pass, thư mục tạm được dọn sạch; `scripts/ci/scan-migrations.sh` báo 0 cảnh báo cho M1; `unaccent('Đức Hà')` ra `Duc Ha`. Đây là kiểm trên PG16 + shim, KHÔNG phải trên Supabase/PG17 thật.

Cách kiểm khả thi (harness ở T3): dựng PG16 tạm + shim Supabase; áp migration; chạy test SQL theo vai. Kiểm được: cú pháp, thứ tự phụ thuộc, idempotent, ràng buộc/exclusion, trigger, RLS và column grant (với role `authenticated` giả lập), logic RPC, múi giờ, haversine, `unaccent`.
Nếu harness hỏng trên máy dev khác: chỉ còn kiểm cú pháp bằng cách đọc và quét (`scan-migrations.sh`), không có bằng chứng chạy; khi đó nên đòi người dùng chạy `supabase start` + `supabase db reset` trên máy có Docker TRƯỚC khi duyệt đợt B (không có staging).

CHỈ kiểm được khi chạy pipeline thật (hoặc trên stack Supabase thật):
- Output thật của `supabase db push --dry-run`, cụm "up to date", cờ `--yes`, chờ duyệt đúng.
- Extension có sẵn ở hosted và nằm đúng schema `extensions` (btree_gist, unaccent); quyền của role migration (`postgres` không phải superuser).
- Default privileges thật của Supabase cho `anon`/`authenticated`; hàm `auth.uid()` thật; hành vi PostgREST với RPC, lỗi và mã lỗi trả ra client; schema `private` không lộ.
- Phiên bản PG17 vs 16 (khác biệt nhỏ nhưng tồn tại).
- Edge function `auth-zalo`/`resolve-location` (S1, S2) và dòng chảy đăng nhập thật.
- Advisor bảo mật/hiệu năng của Supabase sau áp dụng.

## 7. Thứ tự thực hiện và điểm kiểm tra

1. HOÀN TẤT: plan ĐÃ APPROVE (2026-10-10); mọi câu hỏi mở đã đóng (Q1–Q13). Không còn bước chờ trả lời.
2. ĐỢT A (giao ngay): chỉ T1 (M1) và T3 (harness); T2 chưa giao (thuộc Đợt B). Kiểm tra: đầu ra thật của `run.sh`; sen1 review Đạt/Chưa đạt; PM chạy lại `run.sh`.
3. Merge ĐỢT A (M1 một mình). Kiểm tra: mục 3.2 điểm 1–4; ghi lại output thật của dry-run vào `docs/ci-cd-setup.md` hoặc báo lại (xác nhận/bác bỏ giả định "dry-run chỉ in tên file").
4. Đợt viết 2 (T4–T6), review. Merge ĐỢT B (M2–M5) sau khi harness xanh. Kiểm tra: bảng đủ, RLS bật, advisor.
5. Merge ĐỢT C (M6–M7) sau khi test RLS xanh. Kiểm tra: `\dp`, advisor. (M7 giữ nguyên, không sửa.)
5b. Đợt viết 2b: T6b (M7b + test đồng ý), sen1 review Đạt/Chưa đạt. Merge ĐỢT C2 (M7b một mình) sau khi người dùng đọc dry-run; kiểm tra: cột `shared_with_gymer` tồn tại, policy mới đúng một bản.
6. Đợt viết 3 (T7–T9), review (sen1 soi riêng: chống trùng, giá T7/CN, RLS, ghi chú sức khoẻ gồm tick/không tick/`ends_at + 1 ngày`/pending quá hạn, `search_path`). Merge ĐỢT D (M8–M9) SAU đợt C2.
7. T11 sinh type sau Đợt D; T10 khi người dùng duyệt các thay đổi hợp đồng. Sau đó plan riêng: `auth-zalo` (S1), `resolve-location` (S2), repository Supabase thật.
