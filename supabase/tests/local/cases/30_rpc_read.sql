-- Test RPC đọc M8 (search_gymers, get_day_slots, get_month_calendar; mục 2.3, 2.4, 2.5B; T7).
-- Một giao dịch, kết thúc bằng rollback: không để lại dữ liệu.
-- Gieo bằng postgres (bỏ qua RLS); đổi vai bằng pg_temp.act() (set role authenticated + auth.uid()).
-- Ngày test cố định 2030-03-12 (giờ VN) để không phụ thuộc hôm nay.
--
-- Người: A, B = khách; G1 = listed (Minh Hà, Yoga, nam 1990, 200k/250k, rating 4.5);
--        G2 = listed (Đức Hà, Gym, nữ 1992, 300k/350k, rating 3.0, cách G1 ~1.0 km);
--        G3 = KHÔNG listed (cùng toạ độ G1); G4 = listed, cách ~20.8 km (ngoài bán kính 10);
--        52 Gymer "Ext" listed cách 1.4–7 km (kiểm giới hạn 50).
-- Lịch G1 ngày 2030-03-12: mẫu 07,09,10,14,16,17,18,19; slot override đóng 10:00, mở thêm 08:00.
-- Booking G1: A 14:00 confirmed; B 16:00 pending còn hạn; B 17:00 pending quá hạn; A 18:00 cancelled; B 19:00 confirmed.
-- Booking G3: B 09:00 pending còn hạn.
-- Ngoại lệ ngày: G1 2030-03-13 giá 999000; G1 2030-03-20 đóng cả ngày.

begin;

-- ===== Vai thử (pg_temp, chỉ tồn tại trong giao dịch) =====
create function pg_temp.act(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
  set local role authenticated;
end $$;

create function pg_temp.admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Chạy câu lệnh, trả về thông điệp RAISE EXCEPTION (hoặc null nếu không lỗi).
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when raise_exception then
  return sqlerrm;
end $$;

-- ===== Gieo dữ liệu (postgres) =====
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'a@test.local'),
  ('b0000000-0000-4000-8000-00000000000b', 'b@test.local'),
  ('11111111-0000-4000-8000-000000000001', 'g1@test.local'),
  ('22222222-0000-4000-8000-000000000002', 'g2@test.local'),
  ('33333333-0000-4000-8000-000000000003', 'g3@test.local'),
  ('44444444-0000-4000-8000-000000000004', 'g4@test.local');

insert into public.profiles (id, display_name) values
  ('a0000000-0000-4000-8000-00000000000a', 'Khach A'),
  ('b0000000-0000-4000-8000-00000000000b', 'Khach B'),
  ('11111111-0000-4000-8000-000000000001', 'Minh Hà'),
  ('22222222-0000-4000-8000-000000000002', 'Đức Hà'),
  ('33333333-0000-4000-8000-000000000003', 'An Gymer'),
  ('44444444-0000-4000-8000-000000000004', 'Far Gymer');

insert into public.gymer_profiles
  (user_id, display_name, gender, birth_year, area_label, price_weekday_vnd, price_weekend_vnd, is_listed)
values
  ('11111111-0000-4000-8000-000000000001', 'Minh Hà', 'male', 1990, 'Hoan Kiem', 200000, 250000, true),
  ('22222222-0000-4000-8000-000000000002', 'Đức Hà', 'female', 1992, 'Hoan Kiem', 300000, 350000, true),
  ('33333333-0000-4000-8000-000000000003', 'An Gymer', 'male', 1991, 'Hoan Kiem', 200000, 250000, false),
  ('44444444-0000-4000-8000-000000000004', 'Far Gymer', 'female', 1985, 'Long Bien', 200000, 250000, true);

insert into public.gymer_locations (user_id, lat, lng) values
  ('11111111-0000-4000-8000-000000000001', 21.028, 105.854),
  ('22222222-0000-4000-8000-000000000002', 21.037, 105.854),
  ('33333333-0000-4000-8000-000000000003', 21.028, 105.854),
  ('44444444-0000-4000-8000-000000000004', 21.028, 106.054);

insert into public.gymer_specialties (gymer_id, specialty_name) values
  ('11111111-0000-4000-8000-000000000001', 'Yoga'),
  ('22222222-0000-4000-8000-000000000002', 'Gym');

update public.gymer_profiles set rating_avg = 4.5 where user_id = '11111111-0000-4000-8000-000000000001';
update public.gymer_profiles set rating_avg = 3.0 where user_id = '22222222-0000-4000-8000-000000000002';

do $$
begin
  insert into auth.users (id, email)
  select ('cccccccc-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'x' || i || '@test.local'
  from generate_series(1, 52) as i;

  insert into public.profiles (id, display_name)
  select ('cccccccc-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'Ext ' || i
  from generate_series(1, 52) as i;

  insert into public.gymer_profiles
    (user_id, display_name, gender, birth_year, area_label, price_weekday_vnd, price_weekend_vnd, is_listed)
  select ('cccccccc-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'Ext ' || i, 'female', 1995,
         'Hoan Kiem', 150000, 180000, true
  from generate_series(1, 52) as i;

  insert into public.gymer_locations (user_id, lat, lng)
  select ('cccccccc-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 21.04 + i * 0.001, 105.854
  from generate_series(1, 52) as i;
end $$;

insert into public.gymer_slot_overrides (gymer_id, day, start_time, is_open) values
  ('11111111-0000-4000-8000-000000000001', '2030-03-12', '10:00', false),
  ('11111111-0000-4000-8000-000000000001', '2030-03-12', '08:00', true);

insert into public.gymer_day_overrides (gymer_id, day, is_open, price_vnd) values
  ('11111111-0000-4000-8000-000000000001', '2030-03-13', true, 999000),
  ('11111111-0000-4000-8000-000000000001', '2030-03-20', false, null);

insert into public.bookings
  (gymer_id, customer_id, starts_at, ends_at, price_vnd, status, expires_at, responded_at, cancelled_at, cancelled_by)
values
  ('11111111-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a',
   '2030-03-12 14:00:00+07', '2030-03-12 15:00:00+07', 200000, 'confirmed',
   '2030-03-12 14:00:00+07', now(), null, null),
  ('11111111-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b',
   '2030-03-12 16:00:00+07', '2030-03-12 17:00:00+07', 200000, 'pending',
   now() + interval '1 day', null, null, null),
  ('11111111-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b',
   '2030-03-12 17:00:00+07', '2030-03-12 18:00:00+07', 200000, 'pending',
   now() - interval '1 hour', null, null, null),
  ('11111111-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a',
   '2030-03-12 18:00:00+07', '2030-03-12 19:00:00+07', 200000, 'cancelled',
   now() - interval '1 day', null, now(), 'a0000000-0000-4000-8000-00000000000a'),
  ('11111111-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b',
   '2030-03-12 19:00:00+07', '2030-03-12 20:00:00+07', 200000, 'confirmed',
   '2030-03-12 19:00:00+07', now(), null, null),
  ('33333333-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-00000000000b',
   '2030-03-12 09:00:00+07', '2030-03-12 10:00:00+07', 200000, 'pending',
   now() + interval '1 day', null, null, null);

-- ===== 1. Catalog: DEFINER, search_path, quyền EXECUTE =====
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select p.oid, ns.nspname as sch, p.proname, p.prosecdef, p.proconfig, p.proacl, p.proowner
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where (ns.nspname = 'public' and p.proname in ('search_gymers', 'get_day_slots', 'get_month_calendar'))
       or (ns.nspname = 'private' and p.proname in ('slot_states', 'can_view_gymer'))
  loop
    n := n + 1;
    assert r.prosecdef, r.sch || '.' || r.proname || ' phai SECURITY DEFINER';
    assert r.proconfig is not null and 'search_path=""' = any(r.proconfig),
      r.proname || ' thieu set search_path = ''''';
    assert not has_function_privilege('anon', r.oid, 'EXECUTE'), r.proname || ': anon co EXECUTE';
    assert not exists (
      select 1 from aclexplode(coalesce(r.proacl, acldefault('f', r.proowner))) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ), r.proname || ': PUBLIC co EXECUTE';
    if r.sch = 'public' then
      assert has_function_privilege('authenticated', r.oid, 'EXECUTE'), r.proname || ': authenticated thieu EXECUTE';
    else
      assert not has_function_privilege('authenticated', r.oid, 'EXECUTE'), r.proname || ': authenticated co EXECUTE ham private';
    end if;
  end loop;
  assert n = 5, 'thieu ham, dem = ' || n;
  assert not exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace,
    unnest(p.proargnames) as an
    where ns.nspname = 'public' and p.proname = 'search_gymers' and an in ('lat', 'lng')
  ), 'search_gymers tra ve lat/lng';
end $$;

-- ===== 2. search_gymers (khách A) =====
select pg_temp.act('a0000000-0000-4000-8000-00000000000a');

do $$
declare
  v_n integer;
  v_s text;
  v_d numeric;
  v_year integer := extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::integer;
  g1 constant text := '11111111-0000-4000-8000-000000000001';
  g2 constant text := '22222222-0000-4000-8000-000000000002';
begin
  -- Bán kính 0.5 km: chỉ G1 (G2 ~1.0 km bị loại).
  select count(*) into v_n from public.search_gymers(21.028, 105.854, 0.5);
  assert v_n = 1, 'radius 0.5: ky vong 1, co ' || v_n;

  -- Bán kính 1.2 km: G1 (0 km) rồi G2 (~1.0 km). G3 không listed không xuất hiện.
  select string_agg(user_id::text, ',' order by distance_km) into v_s
  from public.search_gymers(21.028, 105.854, 1.2);
  assert v_s = g1 || ',' || g2, 'radius 1.2 sai thu tu/tap: ' || v_s;

  select distance_km into v_d from public.search_gymers(21.028, 105.854, 1.2) where user_id::text = g2;
  assert v_d between 0.9 and 1.1, 'khoang cach G2 ngoai 0.9..1.1: ' || v_d;
  assert v_d = round(v_d, 1), 'khoang cach chua lam tron 0.1 km';

  -- Bán kính 10 km: cắt ở 50, sắp theo khoảng cách không giảm.
  select count(*) into v_n from public.search_gymers(21.028, 105.854, 10);
  assert v_n = 50, 'gioi han 50, co ' || v_n;
  select count(*) into v_n
  from (select distance_km, lag(distance_km) over () as prev
        from public.search_gymers(21.028, 105.854, 10)) x
  where prev > distance_km;
  assert v_n = 0, 'ket qua khong sap theo khoang cach';

  -- Từ khoá: bỏ dấu, không phân biệt hoa thường, escape ký tự % và _.
  select count(*) into v_n from public.search_gymers(21.028, 105.854, 10, 'minh ha');
  assert v_n = 1, 'minh ha phai khop Minh Hà (1), co ' || v_n;
  select string_agg(user_id::text, ',') into v_s from public.search_gymers(21.028, 105.854, 10, 'DUC HA');
  assert v_s = g2, 'DUC HA phai khop Đức Hà, co ' || coalesce(v_s, 'rong');
  select string_agg(user_id::text, ',') into v_s from public.search_gymers(21.028, 105.854, 10, 'yoga');
  assert v_s = g1, 'yoga phai khop G1 qua mon tap, co ' || coalesce(v_s, 'rong');
  select count(*) into v_n from public.search_gymers(21.028, 105.854, 10, 'a%');
  assert v_n = 0, 'a% phai duoc escape, khong khop tat ca';
  select count(*) into v_n from public.search_gymers(21.028, 105.854, 10, 'far');
  assert v_n = 0, 'G4 (20.8 km) khong duoc trong ban kinh 10';

  -- Bộ lọc khác.
  select string_agg(user_id::text, ',') into v_s from public.search_gymers(21.028, 105.854, 10, null, 'Yoga');
  assert v_s = g1, 'loc mon Yoga sai';
  select string_agg(user_id::text, ',') into v_s from public.search_gymers(21.028, 105.854, 1.2, null, null, 'female');
  assert v_s = g2, 'loc gioi tinh female sai, co ' || coalesce(v_s, 'rong');
  select string_agg(user_id::text, ',') into v_s from public.search_gymers(21.028, 105.854, 1.2, null, null, null, 4);
  assert v_s = g1, 'loc rating >= 4 sai';
  select string_agg(user_id::text, ',') into v_s from public.search_gymers(21.028, 105.854, 1.2, null, null, null, null, null, null, 250000);
  assert v_s = g1, 'loc gia toi da 250000 sai';
  select string_agg(user_id::text, ',') into v_s
  from public.search_gymers(21.028, 105.854, 1.2, null, null, null, null, v_year - 1990, null);
  assert v_s = g1, 'loc tuoi >= ' || (v_year - 1990) || ' sai, co ' || coalesce(v_s, 'rong');
  select string_agg(user_id::text, ',') into v_s
  from public.search_gymers(21.028, 105.854, 1.2, null, null, null, null, null, v_year - 1991);
  assert v_s = g2, 'loc tuoi <= ' || (v_year - 1991) || ' sai, co ' || coalesce(v_s, 'rong');

  -- Mảng môn của G1 có Yoga.
  select tags::text into v_s from public.search_gymers(21.028, 105.854, 1.2) where user_id::text = g1;
  assert v_s like '%Yoga%', 'tags cua G1 thieu Yoga: ' || coalesce(v_s, 'null');
end $$;

-- Lỗi nghiệp vụ (vẫn là khách A).
do $$
declare v_err text;
begin
  v_err := pg_temp.err('select * from public.search_gymers(21.028, 105.854, 0)');
  assert v_err = 'VALIDATION: radius', 'radius 0 phai VALIDATION, co: ' || coalesce(v_err, 'khong loi');
  v_err := pg_temp.err('select * from public.search_gymers(21.028, 105.854, 11)');
  assert v_err = 'VALIDATION: radius', 'radius 11 phai VALIDATION, co: ' || coalesce(v_err, 'khong loi');
  v_err := pg_temp.err('select * from public.search_gymers(95, 105.854, 1)');
  assert v_err like 'VALIDATION%', 'lat 95 phai VALIDATION, co: ' || coalesce(v_err, 'khong loi');
  v_err := pg_temp.err('select * from public.search_gymers(21.028, 105.854, 1, ' || quote_literal(repeat('a', 51)) || ')');
  assert v_err = 'VALIDATION: keyword', 'keyword 51 ky tu phai VALIDATION, co: ' || coalesce(v_err, 'khong loi');
end $$;

select pg_temp.act('');
do $$
declare v_err text;
begin
  v_err := pg_temp.err('select * from public.search_gymers(21.028, 105.854, 1)');
  assert v_err = 'UNAUTHENTICATED', 'khong dang nhap phai UNAUTHENTICATED, co: ' || coalesce(v_err, 'khong loi');
end $$;

-- ===== 3. get_day_slots =====
select pg_temp.act('a0000000-0000-4000-8000-00000000000a');

do $$
declare
  v_s text;
  v_tz text;
  v_n integer;
  v_tot integer;
  g1 constant uuid := '11111111-0000-4000-8000-000000000001';
  d constant date := '2030-03-12';
  expected constant text :=
    '07:00:00=available,08:00:00=available,09:00:00=available,10:00:00=closed,'
    || '14:00:00=booked,16:00:00=booked,17:00:00=available,18:00:00=available,19:00:00=booked';
begin
  -- Khách A: đúng trạng thái; không thấy tên người đặt.
  select string_agg(start_time::text || '=' || state, ',' order by start_time) into v_s
  from public.get_day_slots(g1, d);
  assert v_s = expected, 'get_day_slots (khach A) sai: ' || coalesce(v_s, 'rong');

  select count(*) into v_n from public.get_day_slots(g1, d) where booked_by is not null;
  assert v_n = 0, 'khach thay booked_by';

  -- Múi giờ phiên không đổi kết quả (giờ VN tường minh).
  set local timezone = 'UTC';
  select string_agg(start_time::text || '=' || state, ',' order by start_time) into v_tz
  from public.get_day_slots(g1, d);
  set local timezone = 'Asia/Ho_Chi_Minh';
  assert v_tz = expected, 'get_day_slots phu thuoc timezone phien: ' || coalesce(v_tz, 'rong');

  -- Ngày không có ngoại lệ: 8 khung mẫu đều trống.
  select count(*) into v_tot from public.get_day_slots(g1, '2030-03-13');
  select count(*) into v_n from public.get_day_slots(g1, '2030-03-13') where state = 'available';
  assert v_tot = 8 and v_n = 8, 'ngay 03-13 phai 8 khung trong, co ' || v_n || '/' || v_tot;

  -- Ngày đóng cả ngày: mọi khung closed.
  select count(*) into v_tot from public.get_day_slots(g1, '2030-03-20');
  select count(*) into v_n from public.get_day_slots(g1, '2030-03-20') where state = 'closed';
  assert v_tot = 8 and v_n = 8, 'ngay 03-20 dong phai 8 khung closed, co ' || v_n || '/' || v_tot;
end $$;

do $$
declare v_err text;
begin
  v_err := pg_temp.err('select * from public.get_day_slots(''33333333-0000-4000-8000-000000000003'', ''2030-03-12'')');
  assert v_err = 'NOT_FOUND', 'G3 an voi khach A phai NOT_FOUND, co: ' || coalesce(v_err, 'khong loi');
end $$;

select pg_temp.act('b0000000-0000-4000-8000-00000000000b');
do $$
declare
  v_n integer;
  v_s text;
  g3 constant uuid := '33333333-0000-4000-8000-000000000003';
begin
  -- B có booking với G3 nên xem được lịch G3 dù không listed.
  select count(*) into v_n from public.get_day_slots(g3, '2030-03-12');
  assert v_n = 8, 'B phai xem duoc lich G3 (co booking), co ' || v_n;
  select state into v_s from public.get_day_slots(g3, '2030-03-12') where start_time = '09:00';
  assert v_s = 'booked', 'G3 09:00 phai booked, co ' || coalesce(v_s, 'null');
end $$;

select pg_temp.act('33333333-0000-4000-8000-000000000003');
do $$
declare v_n integer;
begin
  -- Chính G3 xem lịch của mình.
  select count(*) into v_n from public.get_day_slots('33333333-0000-4000-8000-000000000003', '2030-03-12');
  assert v_n = 8, 'G3 phai xem duoc lich cua minh, co ' || v_n;
end $$;

-- Gymer G1: thấy tên khách trên khung đã đặt; khung đã huỷ/quá hạn không có tên.
select pg_temp.act('11111111-0000-4000-8000-000000000001');
do $$
declare
  v_by text;
  v_n integer;
  g1 constant uuid := '11111111-0000-4000-8000-000000000001';
begin
  select booked_by into v_by from public.get_day_slots(g1, '2030-03-12') where start_time = '14:00';
  assert v_by = 'Khach A', 'G1 phai thay ten khach 14:00, co ' || coalesce(v_by, 'null');
  select booked_by into v_by from public.get_day_slots(g1, '2030-03-12') where start_time = '16:00';
  assert v_by = 'Khach B', 'G1 phai thay ten khach 16:00, co ' || coalesce(v_by, 'null');
  select booked_by into v_by from public.get_day_slots(g1, '2030-03-12') where start_time = '17:00';
  assert v_by is null, '17:00 (pending quá hạn) khong duoc co ten';
  select count(*) into v_n from public.get_day_slots(g1, '2030-03-12') where state = 'booked' and booked_by is null;
  assert v_n = 0, 'co khung booked khong co booked_by khi la chu Gymer';
end $$;

select pg_temp.act('');
do $$
declare v_err text;
begin
  v_err := pg_temp.err('select * from public.get_day_slots(''11111111-0000-4000-8000-000000000001'', ''2030-03-12'')');
  assert v_err = 'UNAUTHENTICATED', 'get_day_slots khong dang nhap phai UNAUTHENTICATED, co: ' || coalesce(v_err, 'khong loi');
end $$;

-- ===== 4. get_month_calendar (tháng 03/2030) =====
select pg_temp.act('a0000000-0000-4000-8000-00000000000a');
do $$
declare
  v_n integer;
  v_p integer;
  v_b boolean;
  v_o boolean;
  g1 constant uuid := '11111111-0000-4000-8000-000000000001';
  v_err text;
begin
  select count(*) into v_n from public.get_month_calendar(g1, 2030, 3);
  assert v_n = 31, 'thang 3/2030 phai co 31 dong, co ' || v_n;

  -- Giá: T7/CN = 250000, ngày thường = 200000, trừ 03-13 (override 999000).
  select count(*) into v_n
  from public.get_month_calendar(g1, 2030, 3) c
  where c.day <> '2030-03-13'
    and c.price_vnd <> (case when extract(isodow from c.day) in (6, 7) then 250000 else 200000 end);
  assert v_n = 0, 'co ngay sai gia thuong/cuoi tuan: ' || v_n;

  select count(*) into v_n from public.get_month_calendar(g1, 2030, 3) c where c.price_vnd = 250000;
  assert v_n > 0, 'khong co ngay gia cuoi tuan 250000';

  select price_vnd into v_p from public.get_month_calendar(g1, 2030, 3) where day = '2030-03-13';
  assert v_p = 999000, 'override gia 03-13 phai 999000, co ' || coalesce(v_p::text, 'null');

  -- Đóng cả ngày và ngày có booking.
  select is_open into v_o from public.get_month_calendar(g1, 2030, 3) where day = '2030-03-20';
  assert v_o = false, '03-20 phai is_open = false';
  select is_open, has_booked into v_o, v_b from public.get_month_calendar(g1, 2030, 3) where day = '2030-03-12';
  assert v_o = true and v_b = true, '03-12 phai is_open va has_booked';
  select has_booked into v_b from public.get_month_calendar(g1, 2030, 3) where day = '2030-03-13';
  assert v_b = false, '03-13 khong duoc has_booked';
  select is_open into v_o from public.get_month_calendar(g1, 2030, 3) where day = '2030-03-14';
  assert v_o = true, '03-14 phai is_open';
end $$;

do $$
declare v_err text;
begin
  v_err := pg_temp.err('select * from public.get_month_calendar(''11111111-0000-4000-8000-000000000001'', 2030, 13)');
  assert v_err = 'VALIDATION: thang', 'thang 13 phai VALIDATION, co: ' || coalesce(v_err, 'khong loi');
  v_err := pg_temp.err('select * from public.get_month_calendar(''11111111-0000-4000-8000-000000000001'', 1999, 3)');
  assert v_err = 'VALIDATION: thang', 'nam 1999 phai VALIDATION, co: ' || coalesce(v_err, 'khong loi');
  v_err := pg_temp.err('select * from public.get_month_calendar(''33333333-0000-4000-8000-000000000003'', 2030, 3)');
  assert v_err = 'NOT_FOUND', 'G3 an voi khach A phai NOT_FOUND, co: ' || coalesce(v_err, 'khong loi');
end $$;

-- ===== 5. Dọn vai =====
select pg_temp.admin();

rollback;
