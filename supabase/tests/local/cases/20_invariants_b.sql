-- Bất biến Đợt B (mục 2 và mục 5 của docs/plans/schema-v1-review-dot-b.md), kiểm trên M2-M5 thật.
-- Toàn bộ nằm trong MỘT giao dịch và kết thúc bằng rollback: không để lại dữ liệu.
-- Gieo dữ liệu bằng postgres (bỏ qua RLS: file này kiểm ràng buộc và trigger, RLS kiểm ở 10_rls.sql).
-- Ca "bị từ chối" chỉ bắt đúng lớp lỗi kỳ vọng, rồi so SQLSTATE + tên ràng buộc (hoặc thông điệp RAISE) cụ thể.
-- Không có "when others": lỗi lạ trong test làm test dừng, không bị nuốt thành "đạt".

begin;

-- ===== Hàm phụ tạm (chỉ sống trong giao dịch này) =====
-- try: chạy một câu lệnh. Nếu lỗi thuộc đúng các lớp kỳ vọng thì trả về SQLSTATE, tên ràng buộc, thông điệp.
-- Lớp lỗi khác không được bắt ở đây và sẽ làm test dừng.
create function pg_temp.try(q text, out code text, out cname text, out msg text)
language plpgsql
as $$
begin
  execute q;
  code := '00000';
  cname := '';
  msg := '';
exception
  when check_violation or exclusion_violation or foreign_key_violation
    or unique_violation or raise_exception then
    get stacked diagnostics cname = constraint_name, msg = message_text;
    code := sqlstate;
end $$;

-- gy: thêm một Gymer (gymer_profiles) với các tham số cần kiểm.
create function pg_temp.gy(u uuid, dn text, area text, birth int)
returns table (code text, cname text, msg text)
language plpgsql
as $$
begin
  return query
    select t.code, t.cname, t.msg from pg_temp.try(format(
      'insert into public.gymer_profiles (user_id, display_name, gender, birth_year, area_label, price_weekday_vnd, price_weekend_vnd) values (%L, %L, %L, %s, %L, 200000, 250000)',
      u, dn, 'male', birth, area)) t;
end $$;

-- bk: thêm một booking (giá 200000, hết hạn trước buổi 1 ngày).
create function pg_temp.bk(g uuid, c uuid, s timestamptz, e timestamptz, st text, ca timestamptz, cb uuid)
returns table (code text, cname text, msg text)
language plpgsql
as $$
begin
  return query
    select t.code, t.cname, t.msg from pg_temp.try(format(
      'insert into public.bookings (gymer_id, customer_id, starts_at, ends_at, price_vnd, status, expires_at, cancelled_at, cancelled_by) values (%L, %L, %L, %L, 200000, %L, %L, %L, %L)',
      g, c, s, e, st, s - interval '1 day', ca, cb)) t;
end $$;

-- rv: thêm một đánh giá (tên tác giả cố định).
create function pg_temp.rv(b uuid, g uuid, a uuid, r int)
returns table (code text, cname text, msg text)
language plpgsql
as $$
begin
  return query
    select t.code, t.cname, t.msg from pg_temp.try(format(
      'insert into public.reviews (booking_id, gymer_id, author_id, author_name, rating) values (%L, %L, %L, %L, %s)',
      b, g, a, 'Khach test', r)) t;
end $$;

-- ===== Gieo người dùng (postgres) =====
-- Gymer: 30000000-0000-4000-8000-0000000000NN (NN = 01..13). Khách: 31000000-...-00000000000N (N = 01..02).
insert into auth.users (id, email)
select ('30000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'g' || i || '@test.local'
from generate_series(1, 13) as i;
insert into auth.users (id, email)
select ('31000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'c' || i || '@test.local'
from generate_series(1, 2) as i;

insert into public.profiles (id, display_name)
select id, 'Test ' || left(id::text, 8) from auth.users
where id::text like '30000000-%' or id::text like '31000000-%';

-- Vai trò theo số: 01 Gymer tuổi đúng 18; 02 Gymer 17 tuổi; 03 Gymer chứng chỉ; 04 Gymer GB (đặt lịch, đánh giá);
-- 05 Gymer GB2 (Gymer khác); 06 Gymer đánh giá (rating); 07 display rỗng; 08 display 50; 09 display 51;
-- 10 area 100; 11 area 101; 12 area rỗng; 13 Gymer chứng chỉ hàng loạt.
-- Khách: 31...01 = C1, 31...02 = C2.

-- ===== 1. Tuổi tối thiểu 18 (check_gymer_age, theo năm hiện tại giờ Việt Nam) =====
do $$
declare
  y int := extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::int;
  r record;
begin
  -- Đúng 18 tuổi (năm sinh = năm hiện tại - 18) phải được nhận.
  select * into r from pg_temp.gy('30000000-0000-4000-8000-000000000001', 'Gymer 18 tuoi', 'Quan 1', y - 18);
  assert r.code = '00000', format('đúng 18 tuổi phải được nhận, nhưng lỗi %s: %s', r.code, r.msg);

  -- Dưới 18 tuổi (năm sinh = năm hiện tại - 17) bị từ chối bởi trigger VALIDATION.
  select * into r from pg_temp.gy('30000000-0000-4000-8000-000000000002', 'Gymer 17 tuoi', 'Quan 1', y - 17);
  assert r.code = 'P0001' and r.msg = 'VALIDATION',
    format('dưới 18 tuổi phải bị từ chối với VALIDATION, thực tế %s / %s', r.code, r.msg);
  assert not exists (select 1 from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000002'),
    'dưới 18 tuổi: dòng gymer_profiles vẫn được ghi';

  -- UPDATE đưa năm sinh xuống dưới 18 tuổi cũng bị từ chối; dòng giữ nguyên.
  select * into r from pg_temp.try(format(
    'update public.gymer_profiles set birth_year = %s where user_id = %L', y - 17, '30000000-0000-4000-8000-000000000001'));
  assert r.code = 'P0001' and r.msg = 'VALIDATION',
    format('UPDATE xuống dưới 18 tuổi phải bị từ chối với VALIDATION, thực tế %s / %s', r.code, r.msg);
  assert (select birth_year from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000001') = y - 18,
    'UPDATE bị từ chối nhưng năm sinh đã đổi';
end $$;

-- ===== 2. Seed mẫu giờ mở: đúng 8 dòng 07,09,10,14,16,17,18,19 khi tạo hồ sơ Gymer =====
do $$
begin
  assert (select count(*) from public.gymer_open_hours where gymer_id = '30000000-0000-4000-8000-000000000001') = 8,
    'seed giờ mở: phải có đúng 8 dòng';
  assert (select array_agg(start_time order by start_time) from public.gymer_open_hours
          where gymer_id = '30000000-0000-4000-8000-000000000001')
         = array['07:00','09:00','10:00','14:00','16:00','17:00','18:00','19:00']::time[],
    'seed giờ mở: sai danh sách giờ mẫu';
end $$;

-- ===== 3. Làm tròn toạ độ tới 3 chữ số (round_gymer_location) =====
insert into public.gymer_locations (user_id, lat, lng)
values ('30000000-0000-4000-8000-000000000001', 10.776943, 106.700876);

do $$
declare v_lat double precision; v_lng double precision;
begin
  select lat, lng into v_lat, v_lng from public.gymer_locations
  where user_id = '30000000-0000-4000-8000-000000000001';
  assert v_lat = 10.777::double precision and v_lng = 106.701::double precision,
    format('làm tròn khi INSERT sai: lat=%s lng=%s (kỳ vọng 10.777, 106.701)', v_lat, v_lng);
end $$;

update public.gymer_locations set lat = 10.7764, lng = 106.7004
where user_id = '30000000-0000-4000-8000-000000000001';

do $$
declare v_lat double precision; v_lng double precision;
begin
  select lat, lng into v_lat, v_lng from public.gymer_locations
  where user_id = '30000000-0000-4000-8000-000000000001';
  assert v_lat = 10.776::double precision and v_lng = 106.700::double precision,
    format('làm tròn khi UPDATE sai: lat=%s lng=%s (kỳ vọng 10.776, 106.700)', v_lat, v_lng);
end $$;

-- ===== 3b. Gymer nền cho các ca sau (tuổi 1990, hợp lệ) =====
do $$
declare
  r record;
  u uuid;
begin
  foreach u in array array[
    '30000000-0000-4000-8000-000000000003'::uuid,  -- chứng chỉ
    '30000000-0000-4000-8000-000000000004'::uuid,  -- đặt lịch, đánh giá
    '30000000-0000-4000-8000-000000000005'::uuid,  -- Gymer khác
    '30000000-0000-4000-8000-000000000006'::uuid,  -- rating
    '30000000-0000-4000-8000-000000000013'::uuid   -- chứng chỉ hàng loạt
  ] loop
    select * into r from pg_temp.gy(u, 'Gymer nen ' || left(u::text, 8), 'Quan 1', 1990);
    assert r.code = '00000', format('tạo Gymer nền %s thất bại: %s %s', u, r.code, r.msg);
  end loop;
end $$;

-- ===== 4. Tối đa 10 chứng chỉ mỗi Gymer (limit_certificates) =====
do $$
declare r record; n int;
begin
  -- 10 chứng chỉ, mỗi câu một dòng: phải được nhận.
  insert into public.certificates (gymer_id, name)
  select '30000000-0000-4000-8000-000000000003', 'Chung chi ' || g from generate_series(1, 10) g;
  select count(*) into n from public.certificates where gymer_id = '30000000-0000-4000-8000-000000000003';
  assert n = 10, format('phải có đúng 10 chứng chỉ, thực tế %s', n);

  -- Dòng 11 (câu lệnh riêng) bị từ chối với LIMIT_REACHED.
  select * into r from pg_temp.try($q$insert into public.certificates (gymer_id, name)
    values ('30000000-0000-4000-8000-000000000003', 'Chung chi 11')$q$);
  assert r.code = 'P0001' and r.msg = 'LIMIT_REACHED',
    format('chứng chỉ thứ 11 phải bị từ chối với LIMIT_REACHED, thực tế %s / %s', r.code, r.msg);
  select count(*) into n from public.certificates where gymer_id = '30000000-0000-4000-8000-000000000003';
  assert n = 10, format('sau khi bị từ chối vẫn phải có 10 chứng chỉ, thực tế %s', n);
end $$;

-- Chèn 11 chứng chỉ trong MỘT câu lệnh cũng không được vượt giới hạn (trigger là BEFORE INSERT FOR EACH ROW).
do $$
declare r record; n int;
begin
  select * into r from pg_temp.try($q$insert into public.certificates (gymer_id, name)
    select '30000000-0000-4000-8000-000000000013', 'Chung chi hang loat ' || g
    from generate_series(1, 11) g$q$);
  assert r.code = 'P0001' and r.msg = 'LIMIT_REACHED',
    format('11 chứng chỉ trong một câu lệnh phải bị từ chối với LIMIT_REACHED, thực tế %s / %s', r.code, r.msg);
  select count(*) into n from public.certificates where gymer_id = '30000000-0000-4000-8000-000000000013';
  assert n = 0, format('câu lệnh bị từ chối phải không ghi dòng nào, thực tế %s', n);
end $$;

-- ===== 5. Chống chồng lấn booking (bookings_no_overlap, chỉ pending/confirmed, khoảng [) ) =====
-- S1 = 2030-06-01 09:00-10:00 (giờ Việt Nam) của GB (30...04).
do $$
declare
  gb uuid := '30000000-0000-4000-8000-000000000004';
  gb2 uuid := '30000000-0000-4000-8000-000000000005';
  c1 uuid := '31000000-0000-4000-8000-000000000001';
  c2 uuid := '31000000-0000-4000-8000-000000000002';
  r record;
begin
  -- Chuẩn: một buổi pending được nhận.
  select * into r from pg_temp.bk(gb, c1, '2030-06-01 09:00:00+07', '2030-06-01 10:00:00+07', 'pending', null, null);
  assert r.code = '00000', format('buổi đầu tiên phải được nhận, lỗi %s: %s', r.code, r.msg);

  -- Cùng khung, cùng Gymer, pending: chồng lấn.
  select * into r from pg_temp.bk(gb, c2, '2030-06-01 09:00:00+07', '2030-06-01 10:00:00+07', 'pending', null, null);
  assert r.code = '23P01' and r.cname = 'bookings_no_overlap',
    format('cùng khung pending phải bị 23P01 bookings_no_overlap, thực tế %s / %s', r.code, r.cname);

  -- Cùng khung nhưng đã confirmed: vẫn chồng lấn.
  select * into r from pg_temp.bk(gb, c2, '2030-06-01 09:00:00+07', '2030-06-01 10:00:00+07', 'confirmed', null, null);
  assert r.code = '23P01' and r.cname = 'bookings_no_overlap',
    format('cùng khung confirmed phải bị 23P01 bookings_no_overlap, thực tế %s / %s', r.code, r.cname);

  -- Lệch 30 phút về sau (09:30-10:30) và về trước (08:30-09:30): đều chồng lấn.
  select * into r from pg_temp.bk(gb, c2, '2030-06-01 09:30:00+07', '2030-06-01 10:30:00+07', 'pending', null, null);
  assert r.code = '23P01' and r.cname = 'bookings_no_overlap',
    format('lệch +30 phút phải bị 23P01, thực tế %s / %s', r.code, r.cname);
  select * into r from pg_temp.bk(gb, c2, '2030-06-01 08:30:00+07', '2030-06-01 09:30:00+07', 'pending', null, null);
  assert r.code = '23P01' and r.cname = 'bookings_no_overlap',
    format('lệch -30 phút phải bị 23P01, thực tế %s / %s', r.code, r.cname);

  -- Liền kề không chồng: 10:00-11:00 (sau) và 08:00-09:00 (trước) đều được nhận.
  select * into r from pg_temp.bk(gb, c2, '2030-06-01 10:00:00+07', '2030-06-01 11:00:00+07', 'pending', null, null);
  assert r.code = '00000', format('liền kề sau phải được nhận, lỗi %s: %s', r.code, r.msg);
  select * into r from pg_temp.bk(gb, c2, '2030-06-01 08:00:00+07', '2030-06-01 09:00:00+07', 'pending', null, null);
  assert r.code = '00000', format('liền kề trước phải được nhận, lỗi %s: %s', r.code, r.msg);

  -- Trạng thái không còn hiệu lực (rejected, cancelled) cùng khung S1: được nhận.
  select * into r from pg_temp.bk(gb, c2, '2030-06-01 09:00:00+07', '2030-06-01 10:00:00+07', 'rejected', null, null);
  assert r.code = '00000', format('rejected cùng khung phải được nhận, lỗi %s: %s', r.code, r.msg);
  select * into r from pg_temp.bk(gb, c2, '2030-06-01 09:00:00+07', '2030-06-01 10:00:00+07', 'cancelled', now(), c2);
  assert r.code = '00000', format('cancelled cùng khung phải được nhận, lỗi %s: %s', r.code, r.msg);

  -- Gymer khác cùng giờ: được nhận.
  select * into r from pg_temp.bk(gb2, c1, '2030-06-01 09:00:00+07', '2030-06-01 10:00:00+07', 'pending', null, null);
  assert r.code = '00000', format('Gymer khác cùng giờ phải được nhận, lỗi %s: %s', r.code, r.msg);
end $$;

-- ===== 6. Buổi đúng 60 phút (bookings_duration_60m) =====
do $$
declare
  gb uuid := '30000000-0000-4000-8000-000000000004';
  c1 uuid := '31000000-0000-4000-8000-000000000001';
  r record;
begin
  select * into r from pg_temp.bk(gb, c1, '2030-06-01 15:00:00+07', '2030-06-01 16:30:00+07', 'pending', null, null);
  assert r.code = '23514' and r.cname = 'bookings_duration_60m',
    format('buổi 90 phút phải bị 23514 bookings_duration_60m, thực tế %s / %s', r.code, r.cname);
  select * into r from pg_temp.bk(gb, c1, '2030-06-01 15:00:00+07', '2030-06-01 15:30:00+07', 'pending', null, null);
  assert r.code = '23514' and r.cname = 'bookings_duration_60m',
    format('buổi 30 phút phải bị 23514 bookings_duration_60m, thực tế %s / %s', r.code, r.cname);
end $$;

-- ===== 7. Không tự đặt (bookings_not_self) =====
do $$
declare
  gb uuid := '30000000-0000-4000-8000-000000000004';
  r record;
begin
  select * into r from pg_temp.bk(gb, gb, '2030-06-01 15:00:00+07', '2030-06-01 16:00:00+07', 'pending', null, null);
  assert r.code = '23514' and r.cname = 'bookings_not_self',
    format('tự đặt phải bị 23514 bookings_not_self, thực tế %s / %s', r.code, r.cname);
end $$;

-- ===== 8. Huỷ nhất quán (bookings_cancel_consistent, bookings_cancelled_by_consistent) =====
-- Mỗi ca chỉ vi phạm đúng một ràng buộc, nên tên ràng buộc được xác định.
do $$
declare
  gb uuid := '30000000-0000-4000-8000-000000000004';
  c1 uuid := '31000000-0000-4000-8000-000000000001';
  r record;
begin
  -- cancelled thiếu cancelled_at (và cancelled_by).
  select * into r from pg_temp.bk(gb, c1, '2030-06-01 12:00:00+07', '2030-06-01 13:00:00+07', 'cancelled', null, null);
  assert r.code = '23514' and r.cname = 'bookings_cancel_consistent',
    format('cancelled thiếu cancelled_at phải bị 23514 bookings_cancel_consistent, thực tế %s / %s', r.code, r.cname);

  -- cancelled có cancelled_at nhưng thiếu cancelled_by.
  select * into r from pg_temp.bk(gb, c1, '2030-06-01 12:00:00+07', '2030-06-01 13:00:00+07', 'cancelled', now(), null);
  assert r.code = '23514' and r.cname = 'bookings_cancelled_by_consistent',
    format('cancelled thiếu cancelled_by phải bị 23514 bookings_cancelled_by_consistent, thực tế %s / %s', r.code, r.cname);

  -- confirmed nhưng đã có cancelled_at (và cancelled_by).
  select * into r from pg_temp.bk(gb, c1, '2030-06-01 13:00:00+07', '2030-06-01 14:00:00+07', 'confirmed', now(), c1);
  assert r.code = '23514' and r.cname = 'bookings_cancel_consistent',
    format('confirmed có cancelled_at phải bị 23514 bookings_cancel_consistent, thực tế %s / %s', r.code, r.cname);

  -- confirmed có cancelled_by nhưng cancelled_at rỗng.
  select * into r from pg_temp.bk(gb, c1, '2030-06-01 14:00:00+07', '2030-06-01 15:00:00+07', 'confirmed', null, c1);
  assert r.code = '23514' and r.cname = 'bookings_cancelled_by_consistent',
    format('confirmed có cancelled_by mà thiếu cancelled_at phải bị 23514 bookings_cancelled_by_consistent, thực tế %s / %s',
           r.code, r.cname);

  -- Chuẩn: cancelled đủ cả hai trường được nhận.
  select * into r from pg_temp.bk(gb, c1, '2030-06-01 17:00:00+07', '2030-06-01 18:00:00+07', 'cancelled', now(), c1);
  assert r.code = '00000', format('cancelled đủ hai trường phải được nhận, lỗi %s: %s', r.code, r.msg);
end $$;

-- ===== 9. Khoá ngoại ghép của reviews (booking_id, gymer_id, author_id) và một booking một review =====
insert into public.bookings
  (id, gymer_id, customer_id, starts_at, ends_at, price_vnd, status, expires_at)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001',
   '2030-06-02 09:00:00+07', '2030-06-02 10:00:00+07', 200000, 'confirmed', '2030-06-01 09:00:00+07');

do $$
declare
  b uuid := '40000000-0000-4000-8000-000000000001';
  gb uuid := '30000000-0000-4000-8000-000000000004';
  gb2 uuid := '30000000-0000-4000-8000-000000000005';
  c1 uuid := '31000000-0000-4000-8000-000000000001';
  c2 uuid := '31000000-0000-4000-8000-000000000002';
  r record;
begin
  -- gymer_id không khớp booking: lỗi khoá ngoại ghép.
  select * into r from pg_temp.rv(b, gb2, c1, 5);
  assert r.code = '23503' and r.cname = 'reviews_booking_parties_fkey',
    format('gymer_id không khớp booking phải bị 23503 reviews_booking_parties_fkey, thực tế %s / %s', r.code, r.cname);

  -- author_id không khớp booking: lỗi khoá ngoại ghép.
  select * into r from pg_temp.rv(b, gb, c2, 5);
  assert r.code = '23503' and r.cname = 'reviews_booking_parties_fkey',
    format('author_id không khớp booking phải bị 23503 reviews_booking_parties_fkey, thực tế %s / %s', r.code, r.cname);

  -- Khớp đúng hai bên: được nhận.
  select * into r from pg_temp.rv(b, gb, c1, 5);
  assert r.code = '00000', format('đánh giá khớp booking phải được nhận, lỗi %s: %s', r.code, r.msg);

  -- Một booking một review: đánh giá thứ hai cho cùng booking bị 23505 (reviews_booking_id_key).
  select * into r from pg_temp.rv(b, gb, c1, 4);
  assert r.code = '23505' and r.cname = 'reviews_booking_id_key',
    format('đánh giá thứ hai cho một booking phải bị 23505 reviews_booking_id_key, thực tế %s / %s', r.code, r.cname);
end $$;

-- ===== 10. rating_avg, rating_count theo đánh giá (reviews_sync_rating, recompute_rating) =====
insert into public.bookings
  (id, gymer_id, customer_id, starts_at, ends_at, price_vnd, status, expires_at)
values
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000001',
   '2030-06-03 09:00:00+07', '2030-06-03 10:00:00+07', 200000, 'confirmed', '2030-06-02 09:00:00+07'),
  ('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000002',
   '2030-06-03 10:00:00+07', '2030-06-03 11:00:00+07', 200000, 'confirmed', '2030-06-02 09:00:00+07');

insert into public.reviews (id, booking_id, gymer_id, author_id, author_name, rating) values
  ('50000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000011',
   '30000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000001', 'Khach 1', 5),
  ('50000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000012',
   '30000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000002', 'Khach 2', 3);

do $$
begin
  assert (select rating_avg from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000006') = 4.00,
    format('sau hai đánh giá (5, 3) rating_avg phải là 4.00, thực tế %s',
           (select rating_avg from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000006'));
  assert (select rating_count from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000006') = 2,
    'sau hai đánh giá rating_count phải là 2';
end $$;

delete from public.reviews where id = '50000000-0000-4000-8000-000000000012';

do $$
begin
  assert (select rating_avg from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000006') = 5.00,
    'sau khi xoá đánh giá 3, rating_avg phải là 5.00';
  assert (select rating_count from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000006') = 1,
    'sau khi xoá đánh giá 3, rating_count phải là 1';
end $$;

delete from public.reviews where id = '50000000-0000-4000-8000-000000000011';

do $$
begin
  assert (select rating_avg from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000006') = 0.00,
    'không còn đánh giá thì rating_avg phải là 0';
  assert (select rating_count from public.gymer_profiles where user_id = '30000000-0000-4000-8000-000000000006') = 0,
    'không còn đánh giá thì rating_count phải là 0';
end $$;

-- ===== 11. Độ dài display_name (1-50) và area_label (1-100) =====
do $$
declare r record;
begin
  -- display_name rỗng và dài 51 ký tự: bị từ chối đúng ràng buộc độ dài.
  select * into r from pg_temp.gy('30000000-0000-4000-8000-000000000007', '', 'Quan 1', 1990);
  assert r.code = '23514' and r.cname = 'gymer_profiles_display_name_check',
    format('display_name rỗng phải bị 23514 gymer_profiles_display_name_check, thực tế %s / %s', r.code, r.cname);

  select * into r from pg_temp.gy('30000000-0000-4000-8000-000000000009', repeat('a', 51), 'Quan 1', 1990);
  assert r.code = '23514' and r.cname = 'gymer_profiles_display_name_check',
    format('display_name 51 ký tự phải bị 23514 gymer_profiles_display_name_check, thực tế %s / %s', r.code, r.cname);

  -- Ranh giới 50 ký tự được nhận.
  select * into r from pg_temp.gy('30000000-0000-4000-8000-000000000008', repeat('a', 50), 'Quan 1', 1990);
  assert r.code = '00000', format('display_name 50 ký tự phải được nhận, lỗi %s: %s', r.code, r.msg);

  -- area_label rỗng và dài 101 ký tự: bị từ chối; 100 ký tự được nhận.
  select * into r from pg_temp.gy('30000000-0000-4000-8000-000000000012', 'Gymer', '', 1990);
  assert r.code = '23514' and r.cname = 'gymer_profiles_area_label_check',
    format('area_label rỗng phải bị 23514 gymer_profiles_area_label_check, thực tế %s / %s', r.code, r.cname);

  select * into r from pg_temp.gy('30000000-0000-4000-8000-000000000011', 'Gymer', repeat('b', 101), 1990);
  assert r.code = '23514' and r.cname = 'gymer_profiles_area_label_check',
    format('area_label 101 ký tự phải bị 23514 gymer_profiles_area_label_check, thực tế %s / %s', r.code, r.cname);

  select * into r from pg_temp.gy('30000000-0000-4000-8000-000000000010', 'Gymer', repeat('b', 100), 1990);
  assert r.code = '00000', format('area_label 100 ký tự phải được nhận, lỗi %s: %s', r.code, r.msg);
end $$;

-- ===== 12. Không hàm nào trong schema private được authenticated/anon EXECUTE =====
do $$
declare
  f record;
  n int := 0;
begin
  for f in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'private'
  loop
    n := n + 1;
    assert not has_function_privilege('authenticated', f.oid, 'EXECUTE'),
      format('authenticated có EXECUTE trên private.%s', f.proname);
    assert not has_function_privilege('anon', f.oid, 'EXECUTE'),
      format('anon có EXECUTE trên private.%s', f.proname);
  end loop;
  assert n >= 7, format('phải thấy ít nhất 7 hàm trong schema private, thực tế %s', n);
end $$;

rollback;

\echo 'Ca bất biến Đợt B (20_invariants_b.sql) đạt toàn bộ assert.'
