-- Test nghiệp vụ M9 (mục 2.4, 2.4A, 2.5A, 2.6; T9): create_booking, respond_booking, cancel_booking,
-- create_review, recompute_rating, trigger SLOT_HAS_BOOKING, ghi chú sức khoẻ (N2).
-- Bổ sung kiểm hành vi thật cho 40_booking_smoke.sql (smoke giữ nguyên, chạy trước).
-- Toàn bộ nằm trong MỘT giao dịch, dùng savepoint cho từng nhóm và kết thúc bằng rollback: không để lại dữ liệu.
-- Gieo dữ liệu và kiểm tra bằng postgres (bỏ qua RLS); đổi vai bằng set local role authenticated + request.jwt.claim.sub.
-- Mọi ca lỗi chỉ bắt đúng mã nghiệp vụ (P0001 có thông điệp khớp chính xác) hoặc đúng SQLSTATE (42501); lỗi khác làm test thất bại.
-- Giờ: mọi slot dựng bằng pg_temp.vn_ts (giờ Việt Nam tường minh). Ca múi giờ chạy lại với timezone UTC và Asia/Ho_Chi_Minh.
-- GIỚI HẠN: không có ca chạy song song thật (run.sh chạy một kết nối). Chốt cuối được kiểm bằng ràng buộc loại trừ
--   (ca "exclusion" bên dưới); cuộc đua thật giữa hai phiên cần harness hai tiến trình, chưa làm.
-- Người: C1, C2, C3 = khách; G = Gymer listed nhận yêu cầu; GH = listed nhưng accepts_requests=false; GX = is_listed=false.

begin;

-- Bảng id đặt trong giao dịch (ghi sau mỗi lần đặt thành công, rollback theo savepoint).
create temp table t_ids (k text primary key, id uuid not null);

-- ===== Tiện ích (chỉ tồn tại trong giao dịch này) =====
create function pg_temp.c1() returns uuid language sql immutable as $$ select '11000000-0000-4000-8000-000000000001'::uuid $$;
create function pg_temp.c2() returns uuid language sql immutable as $$ select '22000000-0000-4000-8000-000000000002'::uuid $$;
create function pg_temp.c3() returns uuid language sql immutable as $$ select '33000000-0000-4000-8000-000000000003'::uuid $$;
create function pg_temp.g() returns uuid language sql immutable as $$ select '44000000-0000-4000-8000-000000000004'::uuid $$;
create function pg_temp.gh() returns uuid language sql immutable as $$ select '55000000-0000-4000-8000-000000000005'::uuid $$;
create function pg_temp.gx() returns uuid language sql immutable as $$ select '66000000-0000-4000-8000-000000000006'::uuid $$;

create function pg_temp.vn_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

create function pg_temp.vn_ts(p_d date, p_t time) returns timestamptz language sql immutable as $$
  select (p_d + p_t) at time zone 'Asia/Ho_Chi_Minh' $$;

-- Ngày theo thứ ISO (1=T2 ... 7=CN), ít nhất 3 ngày sau hôm nay (giờ VN).
create function pg_temp.vn_day(p_isodow integer) returns date language sql stable as $$
  select d::date from generate_series(pg_temp.vn_today() + 3, pg_temp.vn_today() + 12, interval '1 day') as g(d)
  where extract(isodow from d) = p_isodow order by d limit 1 $$;

-- Giá mặc định theo ngày (không có override): T7/CN 250000, còn lại 200000.
create function pg_temp.exp_price(p_d date) returns integer language sql immutable as $$
  select case when extract(isodow from p_d) in (6, 7) then 250000 else 200000 end $$;

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create function pg_temp.assert_eq(p_actual text, p_expected text, p_msg text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ASSERT [%]: thấy [%], kỳ vọng [%]', p_msg, p_actual, p_expected;
  end if;
end $$;

-- Gọi dưới vai p_uid; kỳ vọng đúng mã nghiệp vụ p_want ('OK' nếu thành công). Lỗi khác không bị nuốt.
create function pg_temp.expect(p_uid uuid, p_sql text, p_want text) returns void language plpgsql as $$
declare v text := 'OK';
begin
  perform pg_temp.as_user(p_uid);
  begin
    execute p_sql;
  exception when raise_exception then
    v := sqlerrm;
  end;
  perform pg_temp.as_admin();
  if v is distinct from p_want then
    raise exception 'ASSERT [%]: kỳ vọng [%], thấy [%]', left(p_sql, 160), p_want, v;
  end if;
end $$;

-- Như expect nhưng chạy bằng postgres (dùng cho trigger, không phụ thuộc quyền bảng).
create function pg_temp.expect_admin(p_sql text, p_want text) returns void language plpgsql as $$
declare v text := 'OK';
begin
  begin
    execute p_sql;
  exception when raise_exception then
    v := sqlerrm;
  end;
  if v is distinct from p_want then
    raise exception 'ASSERT [%]: kỳ vọng [%], thấy [%]', left(p_sql, 160), p_want, v;
  end if;
end $$;

-- Ca bị từ chối quyền (SQLSTATE 42501): chỉ bắt đúng 42501.
create function pg_temp.expect_denied(p_uid uuid, p_sql text) returns void language plpgsql as $$
declare v text := 'OK';
begin
  perform pg_temp.as_user(p_uid);
  begin
    execute p_sql;
  exception when insufficient_privilege then
    v := '42501';
  end;
  perform pg_temp.as_admin();
  if v <> '42501' then
    raise exception 'ASSERT [%]: kỳ vọng 42501, thấy [%]', left(p_sql, 160), v;
  end if;
end $$;

-- Dựng câu lệnh create_booking an toàn (mọi tham số qua %L).
create function pg_temp.cb_sql(p_gymer uuid, p_ts timestamptz, p_price integer, p_note text, p_share boolean)
returns text language sql immutable as $$
  select format('select public.create_booking(%L, %L, %L, %L, %s, %L)',
                p_gymer, p_ts, null::text, p_note, coalesce(p_price::text, 'null'), p_share) $$;

-- Đặt thật dưới vai khách (lỗi làm dừng test).
create function pg_temp.book(p_uid uuid, p_gymer uuid, p_ts timestamptz, p_price integer, p_note text, p_share boolean)
returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user(p_uid);
  v := public.create_booking(p_gymer, p_ts, null, p_note, p_price, p_share);
  perform pg_temp.as_admin();
  return v;
end $$;

-- Gieo booking trực tiếp (postgres), giờ bắt đầu và trạng thái tuỳ ý.
create function pg_temp.seed(p_id uuid, p_gymer uuid, p_cust uuid, p_start timestamptz, p_status public.booking_status,
                             p_expires timestamptz) returns uuid language plpgsql as $$
begin
  insert into public.bookings (id, gymer_id, customer_id, starts_at, ends_at, price_vnd, status, expires_at,
                               cancelled_at, cancelled_by)
  values (p_id, p_gymer, p_cust, p_start, p_start + interval '60 minutes', 200000, p_status, p_expires,
          case when p_status = 'cancelled' then now() end,
          case when p_status = 'cancelled' then p_cust end);
  return p_id;
end $$;

create function pg_temp.notes_seen(p_uid uuid, p_booking uuid) returns integer language plpgsql as $$
declare n integer;
begin
  perform pg_temp.as_user(p_uid);
  select count(*)::integer into n from public.booking_health_notes where booking_id = p_booking;
  perform pg_temp.as_admin();
  return n;
end $$;

create function pg_temp.id(p_k text) returns uuid language sql stable as $$
  select t.id from pg_temp.t_ids t where t.k = p_k $$;

-- ===== Gieo dữ liệu nền (postgres) =====
insert into auth.users (id, email) values
  (pg_temp.c1(), 'c1@t9.local'), (pg_temp.c2(), 'c2@t9.local'), (pg_temp.c3(), 'c3@t9.local'),
  (pg_temp.g(), 'g@t9.local'), (pg_temp.gh(), 'gh@t9.local'), (pg_temp.gx(), 'gx@t9.local');

insert into public.profiles (id, display_name) values
  (pg_temp.c1(), 'Khach C1'), (pg_temp.c2(), 'Khach C2'), (pg_temp.c3(), 'Khach C3'),
  (pg_temp.g(), 'Gymer G'), (pg_temp.gh(), 'Gymer GH'), (pg_temp.gx(), 'Gymer GX');

insert into public.gymer_profiles
  (user_id, display_name, gender, birth_year, area_label, price_weekday_vnd, price_weekend_vnd, is_listed, accepts_requests)
values
  (pg_temp.g(), 'Gymer G', 'male', 1990, 'Quan 1', 200000, 250000, true, true),
  (pg_temp.gh(), 'Gymer GH', 'female', 1992, 'Quan 3', 200000, 250000, true, false),
  (pg_temp.gx(), 'Gymer GX', 'male', 1991, 'Quan 7', 200000, 250000, false, true);

-- ===== Nhóm 1: VALIDATION, mã từ chối theo quy tắc (không ghi dữ liệu) =====
savepoint sp1;
do $$
declare
  v_wk date := pg_temp.vn_day(2);
begin
  -- Tick đồng ý mà ghi chú rỗng hoặc null: VALIDATION (không lưu đồng ý trống).
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00'), 200000, '   ', true), 'VALIDATION');
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00'), 200000, null, true), 'VALIDATION');
  -- Không chẵn giờ VN: 10:30, và có giây.
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '10:30'), 200000, null, false), 'VALIDATION');
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00:30'), 200000, null, false), 'VALIDATION');
  -- Ngoài cửa sổ: dưới 2 giờ (giờ tròn gần nhất trong 2 giờ tới) và trên 60 ngày.
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), date_trunc('hour', now()) + interval '1 hour', 200000, null, false), 'VALIDATION');
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(pg_temp.vn_today() + 61, '10:00'), 200000, null, false), 'VALIDATION');
  -- Thiếu giá, goal quá 200 ký tự.
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00'), null, null, false), 'VALIDATION');
  perform pg_temp.expect(pg_temp.c1(), format('select public.create_booking(%L, %L, %L, null, 200000, false)',
                         pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00'), repeat('a', 201)), 'VALIDATION');
  -- Ghi chú quá 1000 ký tự.
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00'), 200000, repeat('b', 1001), false), 'VALIDATION');
  -- Chưa đăng nhập, tự đặt chính mình.
  perform pg_temp.expect(null, pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00'), 200000, null, false), 'FORBIDDEN');
  perform pg_temp.expect(pg_temp.g(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00'), 200000, null, false), 'FORBIDDEN');
  -- Gymer ẩn (is_listed=false) bị từ chối như không tồn tại: NOT_FOUND.
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.gx(), pg_temp.vn_ts(v_wk, '10:00'), 200000, null, false), 'NOT_FOUND');
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql('ff000000-0000-4000-8000-0000000000ff', pg_temp.vn_ts(v_wk, '10:00'), 200000, null, false), 'NOT_FOUND');
  -- Gymer đang tắt nhận yêu cầu (accepts_requests=false): FORBIDDEN.
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.gh(), pg_temp.vn_ts(v_wk, '10:00'), 200000, null, false), 'FORBIDDEN');
  -- Khung ngoài mẫu (08:00 không có trong mẫu): SLOT_NOT_OPEN.
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '08:00'), 200000, null, false), 'SLOT_NOT_OPEN');
  raise notice 'booking 50 nhóm 1: VALIDATION/FORBIDDEN/NOT_FOUND/SLOT_NOT_OPEN OK';
end $$;
rollback to savepoint sp1;

-- ===== Nhóm 2: đặt thành công, giá, snapshot giá =====
savepoint sp2;
do $$
declare
  v_wk date := pg_temp.vn_day(2);
  v_we date := pg_temp.vn_day(6);
  v_ov date := pg_temp.vn_today() + 25;
  v_id uuid;
  r record;
begin
  -- Ngày thường, có ghi chú và tick: pending, giá 200000, 60 phút, hết hạn <= 24h.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_wk, '10:00'), 200000, 'Dau lung nhe', true);
  insert into t_ids values ('c1_wk10', v_id);
  select * into r from public.bookings where id = v_id;
  perform pg_temp.assert_eq(r.status::text, 'pending', 'đặt mới là pending');
  perform pg_temp.assert_eq(r.price_vnd::text, '200000', 'giá ngày thường');
  perform pg_temp.assert_eq((r.ends_at - r.starts_at)::text, '01:00:00', 'buổi 60 phút');
  perform pg_temp.assert_eq((r.expires_at <= now() + interval '24 hours' and r.expires_at > now() + interval '23 hours')::text,
                            'true', 'expires_at = now + 24h (starts xa hơn 24h)');
  perform pg_temp.assert_eq(r.starts_at::text, pg_temp.vn_ts(v_wk, '10:00')::text, 'starts_at đúng giờ VN');

  -- Cuối tuần (T7): giá 250000.
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_we, '10:00'), 250000, null, false);
  insert into t_ids values ('c2_we10', v_id);
  perform pg_temp.assert_eq((select price_vnd::text from public.bookings where id = v_id), '250000', 'giá cuối tuần');

  -- Không tick: không có hàng ghi chú sức khoẻ.
  perform pg_temp.assert_eq((select count(*)::text from public.booking_health_notes where booking_id = v_id), '0',
                            'không tick thì không ghi chú');

  -- Giá lệch: PRICE_CHANGED, không ghi booking nào.
  perform pg_temp.expect(pg_temp.c3(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_wk, '14:00'), 250000, null, false), 'PRICE_CHANGED');
  perform pg_temp.assert_eq((select count(*)::text from public.bookings where starts_at = pg_temp.vn_ts(v_wk, '14:00')),
                            '0', 'PRICE_CHANGED không ghi booking');

  -- Override giá ngày: 300000 cho ngày v_ov.
  insert into public.gymer_day_overrides (gymer_id, day, is_open, price_vnd) values (pg_temp.g(), v_ov, true, 300000);
  perform pg_temp.expect(pg_temp.c3(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_ov, '14:00'), 200000, null, false), 'PRICE_CHANGED');
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_ov, '10:00'), 300000, null, false);
  insert into t_ids values ('c3_ov10', v_id);
  perform pg_temp.assert_eq((select price_vnd::text from public.bookings where id = v_id), '300000', 'override giá ngày');

  -- Snapshot: Gymer đổi giá sau đó, booking đã tạo giữ giá cũ.
  update public.gymer_profiles set price_weekday_vnd = 999000 where user_id = pg_temp.g();
  perform pg_temp.assert_eq((select price_vnd::text from public.bookings where id = pg_temp.id('c1_wk10')), '200000',
                            'giá booking không đổi khi Gymer đổi giá');
  raise notice 'booking 50 nhóm 2: đặt, giá, override, snapshot OK';
end $$;
rollback to savepoint sp2;

-- ===== Nhóm 3: SLOT_TAKEN (khung đã giữ chỗ) và chốt cuối bằng ràng buộc loại trừ =====
savepoint sp3;
do $$
declare
  v_d date := pg_temp.vn_today() + 26;
  v_d3 date := pg_temp.vn_today() + 27;
  v_id uuid;
begin
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '14:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('c1_d26_14', v_id);
  -- Khung đã có booking pending còn hạn: SLOT_TAKEN.
  perform pg_temp.expect(pg_temp.c2(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_d, '14:00'), pg_temp.exp_price(v_d), null, false), 'SLOT_TAKEN');

  -- Chốt cuối: booking confirmed 09:30 (chèn trực tiếp) chồng lên khung 10:00. slot_states không thấy
  -- (so khớp đúng giờ bắt đầu) nên create_booking tới INSERT và ràng buộc loại trừ ném 23P01 -> SLOT_TAKEN.
  perform pg_temp.seed('d3000000-0000-4000-8000-000000000001', pg_temp.g(), pg_temp.c3(),
                       pg_temp.vn_ts(v_d3, '09:30'), 'confirmed', now() + interval '1 day');
  perform pg_temp.expect(pg_temp.c2(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_d3, '10:00'), pg_temp.exp_price(v_d3), null, false), 'SLOT_TAKEN');
  -- Khung 14:00 không chồng lên 09:30-10:30: đặt được.
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d3, '14:00'), pg_temp.exp_price(v_d3), null, false);
  insert into t_ids values ('c2_d27_14', v_id);
  raise notice 'booking 50 nhóm 3: SLOT_TAKEN và chốt cuối exclusion OK';
end $$;
rollback to savepoint sp3;

-- ===== Nhóm 4: LIMIT_REACHED (3 pending/khách) và lười chuyển pending quá hạn =====
savepoint sp4;
do $$
declare
  v_d date := pg_temp.vn_today() + 28;
  v_id uuid;
  n integer;
begin
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('c3_10', v_id);
  perform pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '14:00'), pg_temp.exp_price(v_d), null, false);
  perform pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '16:00'), pg_temp.exp_price(v_d), null, false);
  -- Đã có 3 pending còn hạn: thứ 4 bị LIMIT_REACHED (khung 17:00 đang mở).
  perform pg_temp.expect(pg_temp.c3(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_d, '17:00'), pg_temp.exp_price(v_d), null, false), 'LIMIT_REACHED');

  -- Một pending hết hạn không tính vào giới hạn: đưa 10:00 về quá hạn, khách đặt được 17:00.
  update public.bookings set expires_at = now() - interval '1 minute' where id = v_id;
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '17:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('c3_17', v_id);

  -- Khách khác đặt đúng khung 10:00 đã quá hạn: khung được coi là trống, và pending cũ bị chuyển sang expired.
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('c2_10', v_id);
  perform pg_temp.assert_eq((select status::text from public.bookings where id = pg_temp.id('c3_10')), 'expired',
                            'pending quá hạn bị lười chuyển sang expired');

  -- Sau đó C3 còn 14:00, 16:00, 17:00 đang chờ (3): lại LIMIT_REACHED.
  select count(*)::integer into n from public.bookings where customer_id = pg_temp.c3() and status = 'pending' and expires_at > now();
  perform pg_temp.assert_eq(n::text, '3', 'C3 còn đúng 3 pending');
  perform pg_temp.expect(pg_temp.c3(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_d, '18:00'), pg_temp.exp_price(v_d), null, false), 'LIMIT_REACHED');
  raise notice 'booking 50 nhóm 4: LIMIT_REACHED và lazy expiry OK';
end $$;
rollback to savepoint sp4;

-- ===== Nhóm 5: respond_booking =====
savepoint sp5;
do $$
declare
  v_d date := pg_temp.vn_today() + 29;
  v_id uuid;
begin
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('r1', v_id);
  perform pg_temp.expect(pg_temp.c1(), format('select public.respond_booking(%L, %L)', v_id, 'confirmed'), 'FORBIDDEN');
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'maybe'), 'VALIDATION');
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', 'ee000000-0000-4000-8000-0000000000ee', 'confirmed'), 'NOT_FOUND');
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'confirmed'), 'OK');
  perform pg_temp.assert_eq((select status::text || ' ' || (responded_at is not null)::text from public.bookings where id = v_id),
                            'confirmed true', 'confirm đặt trạng thái và responded_at');
  -- Đã confirmed thì không respond lại được.
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'rejected'), 'FORBIDDEN');

  -- Reject: khung trả lại cho khách khác ngay.
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d, '14:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('r2', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'rejected'), 'OK');
  perform pg_temp.assert_eq((select status::text from public.bookings where id = v_id), 'rejected', 'reject');
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '14:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('r3', v_id);

  -- Pending quá expires_at: BOOKING_EXPIRED, trạng thái giữ nguyên pending (không đổi khi respond).
  update public.bookings set expires_at = now() - interval '1 minute' where id = pg_temp.id('r3');
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', pg_temp.id('r3'), 'confirmed'), 'BOOKING_EXPIRED');
  perform pg_temp.assert_eq((select status::text from public.bookings where id = pg_temp.id('r3')), 'pending',
                            'BOOKING_EXPIRED không đổi trạng thái');

  -- Pending đã bị lười chuyển sang expired (khách khác đặt chồng khung): respond vẫn ra BOOKING_EXPIRED (kiểm hết hạn trước trạng thái).
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d, '14:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('r4', v_id);
  perform pg_temp.assert_eq((select status::text from public.bookings where id = pg_temp.id('r3')), 'expired',
                            'pending quá hạn chuyển expired khi có người đặt chồng');
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', pg_temp.id('r3'), 'confirmed'), 'BOOKING_EXPIRED');
  raise notice 'booking 50 nhóm 5: respond_booking OK';
end $$;
rollback to savepoint sp5;

-- ===== Nhóm 6: cancel_booking (một quy tắc, hai vai) và dữ liệu đã qua giờ bất biến =====
savepoint sp6;
do $$
declare
  v_d date := pg_temp.vn_today() + 30;
  v_id uuid;
  v_past uuid := 'a6000000-0000-4000-8000-000000000001';
  v_ing uuid := 'a6000000-0000-4000-8000-000000000002';
  v_old_rev uuid := 'a6000000-0000-4000-8000-000000000003';
  v_pend_past uuid := 'a6000000-0000-4000-8000-000000000004';
  v_exp uuid := 'a6000000-0000-4000-8000-000000000005';
  v_rej uuid := 'a6000000-0000-4000-8000-000000000006';
  v_canc uuid := 'a6000000-0000-4000-8000-000000000007';
  v_before text;
begin
  -- Khách huỷ confirmed sắp tới: OK, cancelled_by = khách.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('x1', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'confirmed'), 'OK');
  perform pg_temp.expect(pg_temp.c1(), format('select public.cancel_booking(%L)', v_id), 'OK');
  perform pg_temp.assert_eq((select status::text || ' ' || cancelled_by::text || ' ' || (cancelled_at is not null)::text
                             from public.bookings where id = v_id),
                            'cancelled ' || pg_temp.c1()::text || ' true', 'khách huỷ confirmed');
  -- Khung trống lại ngay: C3 đặt được đúng khung đó.
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('x2', v_id);

  -- Gymer huỷ pending sắp tới: OK, cancelled_by = Gymer.
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d, '14:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('x3', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.cancel_booking(%L)', v_id), 'OK');
  perform pg_temp.assert_eq((select cancelled_by::text from public.bookings where id = v_id), pg_temp.g()::text,
                            'Gymer huỷ pending');

  -- Người thứ ba: FORBIDDEN.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '16:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('x4', v_id);
  perform pg_temp.expect(pg_temp.c2(), format('select public.cancel_booking(%L)', v_id), 'FORBIDDEN');
  perform pg_temp.expect(pg_temp.gh(), format('select public.cancel_booking(%L)', v_id), 'FORBIDDEN');

  -- Trạng thái không huỷ được: rejected, expired, cancelled (đã huỷ ở trên) => FORBIDDEN.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '17:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('x5', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'rejected'), 'OK');
  perform pg_temp.expect(pg_temp.c1(), format('select public.cancel_booking(%L)', v_id), 'FORBIDDEN');
  perform pg_temp.expect(pg_temp.c1(), format('select public.cancel_booking(%L)', pg_temp.id('x1')), 'FORBIDDEN');
  perform pg_temp.seed('a6000000-0000-4000-8000-000000000008', pg_temp.g(), pg_temp.c2(), pg_temp.vn_ts(v_d, '18:00'),
                       'expired', now() - interval '1 hour');
  perform pg_temp.expect(pg_temp.c2(), format('select public.cancel_booking(%L)', 'a6000000-0000-4000-8000-000000000008'), 'FORBIDDEN');

  -- Buổi đã bắt đầu (kể cả đang diễn ra, đã qua, có đánh giá): ALREADY_STARTED cho cả hai vai.
  -- Ngoại lệ: pending quá hạn chưa bị quét (v_pend_past) coi là expired, kiểm hết hạn trước giờ bắt đầu: FORBIDDEN.
  perform pg_temp.seed(v_ing, pg_temp.g(), pg_temp.c1(), now() - interval '10 minutes', 'confirmed', now() - interval '1 day');
  perform pg_temp.seed(v_past, pg_temp.g(), pg_temp.c1(), now() - interval '3 days', 'confirmed', now() - interval '4 days');
  perform pg_temp.seed(v_old_rev, pg_temp.g(), pg_temp.c2(), now() - interval '5 days', 'confirmed', now() - interval '6 days');
  insert into public.reviews (booking_id, gymer_id, author_id, author_name, rating)
  values (v_old_rev, pg_temp.g(), pg_temp.c2(), 'Khach C2', 4);
  perform pg_temp.seed(v_pend_past, pg_temp.g(), pg_temp.c3(), now() - interval '6 days', 'pending', now() - interval '6 days');

  v_before := (select string_agg(status::text || '/' || price_vnd::text, ',' order by id)
               from public.bookings where id in (v_ing, v_past, v_old_rev));
  perform pg_temp.expect(pg_temp.c1(), format('select public.cancel_booking(%L)', v_ing), 'ALREADY_STARTED');
  perform pg_temp.expect(pg_temp.g(), format('select public.cancel_booking(%L)', v_ing), 'ALREADY_STARTED');
  perform pg_temp.expect(pg_temp.c1(), format('select public.cancel_booking(%L)', v_past), 'ALREADY_STARTED');
  perform pg_temp.expect(pg_temp.g(), format('select public.cancel_booking(%L)', v_old_rev), 'ALREADY_STARTED');
  perform pg_temp.expect(pg_temp.c3(), format('select public.cancel_booking(%L)', v_pend_past), 'FORBIDDEN');
  -- Dữ liệu đã qua giờ không đổi sau các RPC thất bại.
  perform pg_temp.assert_eq((select string_agg(status::text || '/' || price_vnd::text, ',' order by id)
                             from public.bookings where id in (v_ing, v_past, v_old_rev)),
                            v_before, 'booking đã qua giờ bất biến');

  -- Không có quyền ghi trực tiếp: UPDATE, DELETE, INSERT bảng bookings bằng authenticated đều 42501.
  perform pg_temp.expect_denied(pg_temp.c1(), format('update public.bookings set status = %L where id = %L', 'cancelled', v_past));
  perform pg_temp.expect_denied(pg_temp.g(), format('update public.bookings set price_vnd = 0 where id = %L', v_past));
  perform pg_temp.expect_denied(pg_temp.c1(), format('delete from public.bookings where id = %L', v_past));
  perform pg_temp.expect_denied(pg_temp.c1(), format(
    'insert into public.bookings (gymer_id, customer_id, starts_at, ends_at, price_vnd, expires_at) values (%L, %L, now() + interval ''3 days'', now() + interval ''3 days 1 hour'', 0, now())',
    pg_temp.g(), pg_temp.c1()));
  raise notice 'booking 50 nhóm 6: cancel_booking hai vai, ALREADY_STARTED, bất biến, 42501 OK';
end $$;
rollback to savepoint sp6;

-- ===== Nhóm 7: ghi chú sức khoẻ (N2) qua create_booking; Gymer chỉ đọc khi tick + điều kiện trạng thái/thời gian =====
savepoint sp7;
do $$
declare
  v_d date := pg_temp.vn_today() + 33;
  v_id uuid;
begin
  -- (a) Tick + confirmed: Gymer đọc được; khách đọc được.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), 'Huyet ap cao', true);
  insert into t_ids values ('h_a', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'confirmed'), 'OK');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '1', '(a) Gymer đọc khi tick + confirmed');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.c1(), v_id)::text, '1', '(a) khách đọc ghi chú của mình');
  perform pg_temp.assert_eq((select shared_with_gymer::text from public.booking_health_notes where booking_id = v_id), 'true',
                            '(a) cờ shared_with_gymer = true');

  -- (b1) Tick tường minh false: Gymer không đọc, khách đọc.
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d, '14:00'), pg_temp.exp_price(v_d), 'Di ung', false);
  insert into t_ids values ('h_b1', v_id);
  perform pg_temp.assert_eq((select shared_with_gymer::text from public.booking_health_notes where booking_id = v_id), 'false',
                            '(b1) cờ false');
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'confirmed'), 'OK');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '0', '(b1) Gymer không đọc khi không tick');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.c2(), v_id)::text, '1', '(b1) khách vẫn đọc');

  -- (b2) Bỏ tham số đồng ý (gọi 5 tham số, mặc định false): Gymer không đọc.
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '16:00'), pg_temp.exp_price(v_d), 'Mot ghi chu', false);
  insert into t_ids values ('h_b2', v_id);
  perform pg_temp.expect(pg_temp.c3(), format('select public.create_booking(%L, %L, %L, %L, %s)',
                         pg_temp.g(), pg_temp.vn_ts(v_d, '17:00'), null::text, 'Ghi chu thu hai', pg_temp.exp_price(v_d)), 'OK');
  insert into t_ids values ('h_b2b', (select id from public.bookings where starts_at = pg_temp.vn_ts(v_d, '17:00')
                                       and customer_id = pg_temp.c3()));
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', pg_temp.id('h_b2b'), 'confirmed'), 'OK');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), pg_temp.id('h_b2b'))::text, '0', '(b2) bỏ tham số thì Gymer không đọc');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.c3(), pg_temp.id('h_b2b'))::text, '1', '(b2) khách vẫn đọc');

  -- (g) Pending còn hạn + tick: Gymer đọc được trước khi respond.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '19:00'), pg_temp.exp_price(v_d), 'Cho xem', true);
  insert into t_ids values ('h_g', v_id);
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '1', '(g) pending còn hạn + tick: Gymer đọc được');

  -- (e) Tick + pending quá expires_at: Gymer không đọc.
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d, '18:00'), pg_temp.exp_price(v_d), 'Het han', true);
  insert into t_ids values ('h_e', v_id);
  update public.bookings set expires_at = now() - interval '1 minute' where id = v_id;
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '0', '(e) pending quá hạn: Gymer không đọc');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.c2(), v_id)::text, '1', '(e) khách vẫn đọc');

  -- (f) Tick + rejected: Gymer không đọc.
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '07:00'), pg_temp.exp_price(v_d), 'Bi tu choi', true);
  insert into t_ids values ('h_f', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'rejected'), 'OK');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '0', '(f) rejected: Gymer không đọc');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.c3(), v_id)::text, '1', '(f) khách vẫn đọc');

  -- (f2) Tick + khách huỷ: Gymer mất quyền đọc ngay, khách vẫn đọc.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '18:00'), pg_temp.exp_price(v_d), 'Se huy', true);
  insert into t_ids values ('h_f2', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'confirmed'), 'OK');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '1', '(f2) trước huỷ: Gymer đọc');
  perform pg_temp.expect(pg_temp.c1(), format('select public.cancel_booking(%L)', v_id), 'OK');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '0', '(f2) khách huỷ: Gymer mất quyền đọc');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.c1(), v_id)::text, '1', '(f2) khách vẫn đọc sau huỷ');

  -- (f3) Tick + Gymer huỷ: Gymer mất quyền đọc, khách vẫn đọc.
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d, '09:00'), pg_temp.exp_price(v_d), 'Gymer huy', true);
  insert into t_ids values ('h_f3', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.cancel_booking(%L)', v_id), 'OK');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '0', '(f3) Gymer huỷ: Gymer mất quyền đọc');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.c2(), v_id)::text, '1', '(f3) khách vẫn đọc');

  -- (d) Tick + confirmed nhưng đã quá ends_at + 1 ngày (dịch thời gian bằng postgres): Gymer không đọc.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '07:00'), pg_temp.exp_price(v_d), 'Buoi cu', true);
  insert into t_ids values ('h_d', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'confirmed'), 'OK');
  update public.bookings set starts_at = now() - interval '26 hours', ends_at = now() - interval '25 hours' where id = v_id;
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.g(), v_id)::text, '0', '(d) quá ends_at + 1 ngày: Gymer không đọc');
  perform pg_temp.assert_eq(pg_temp.notes_seen(pg_temp.c1(), v_id)::text, '1', '(d) khách vẫn đọc');

  -- Lỗi: tick mà ghi chú rỗng không tạo booking nào (không có hàng mồ côi).
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_d, '11:00'), pg_temp.exp_price(v_d), '  ', true), 'VALIDATION');
  perform pg_temp.assert_eq((select count(*)::text from public.bookings where starts_at = pg_temp.vn_ts(v_d, '11:00')), '0',
                            'tick + ghi chú rỗng không ghi booking');
  raise notice 'booking 50 nhóm 7: ghi chú sức khoẻ (tick, không tick, quá hạn, huỷ, quá ends_at + 1 ngày) OK';
end $$;
rollback to savepoint sp7;

-- ===== Nhóm 8: create_review, recompute_rating =====
savepoint sp8;
do $$
declare
  v_d date := pg_temp.vn_today() + 34;
  v_id uuid;
  r record;
begin
  -- Buổi đã xong do postgres gieo: p1 (C1, confirmed), p2 (C2, confirmed), p3 (C3, cancelled), p5 (C3, pending quá khứ).
  perform pg_temp.seed('b8000000-0000-4000-8000-000000000001', pg_temp.g(), pg_temp.c1(), now() - interval '3 days', 'confirmed', now() - interval '4 days');
  perform pg_temp.seed('b8000000-0000-4000-8000-000000000002', pg_temp.g(), pg_temp.c2(), now() - interval '2 days', 'confirmed', now() - interval '3 days');
  perform pg_temp.seed('b8000000-0000-4000-8000-000000000003', pg_temp.g(), pg_temp.c3(), now() - interval '1 day', 'cancelled', now() - interval '2 days');
  perform pg_temp.seed('b8000000-0000-4000-8000-000000000005', pg_temp.g(), pg_temp.c3(), now() - interval '6 days', 'pending', now() - interval '6 days');
  -- Buổi chưa đến giờ kết thúc (đặt rồi confirm).
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false);
  insert into t_ids values ('rv_future', v_id);
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_id, 'confirmed'), 'OK');

  -- Sai người, chưa xong, pending, cancelled: FORBIDDEN.
  perform pg_temp.expect(pg_temp.c2(), format('select public.create_review(%L, 5, null)', 'b8000000-0000-4000-8000-000000000001'), 'FORBIDDEN');
  perform pg_temp.expect(pg_temp.c3(), format('select public.create_review(%L, 5, null)', pg_temp.id('rv_future')), 'FORBIDDEN');
  perform pg_temp.expect(pg_temp.c3(), format('select public.create_review(%L, 4, null)', 'b8000000-0000-4000-8000-000000000003'), 'FORBIDDEN');
  perform pg_temp.expect(pg_temp.c3(), format('select public.create_review(%L, 4, null)', 'b8000000-0000-4000-8000-000000000005'), 'FORBIDDEN');
  perform pg_temp.expect(null, format('select public.create_review(%L, 5, null)', 'b8000000-0000-4000-8000-000000000001'), 'FORBIDDEN');
  -- Rating ngoài 1..5 (kiểm sau khi đã qua kiểm trạng thái): VALIDATION.
  perform pg_temp.expect(pg_temp.c1(), format('select public.create_review(%L, 0, null)', 'b8000000-0000-4000-8000-000000000001'), 'VALIDATION');
  perform pg_temp.expect(pg_temp.c1(), format('select public.create_review(%L, 6, null)', 'b8000000-0000-4000-8000-000000000001'), 'VALIDATION');
  perform pg_temp.expect(pg_temp.c1(), format('select public.create_review(%L, null, null)', 'b8000000-0000-4000-8000-000000000001'), 'VALIDATION');
  perform pg_temp.expect(pg_temp.c1(), format('select public.create_review(%L, 5, %L)', 'b8000000-0000-4000-8000-000000000001', repeat('x', 501)), 'VALIDATION');

  -- Thành công: author_name chụp từ profiles; rating_avg và rating_count cập nhật.
  perform pg_temp.expect(pg_temp.c1(), format('select public.create_review(%L, 5, %L)', 'b8000000-0000-4000-8000-000000000001', 'Tot'), 'OK');
  select * into r from public.reviews where booking_id = 'b8000000-0000-4000-8000-000000000001';
  perform pg_temp.assert_eq(r.author_name, 'Khach C1', 'author_name chụp từ profiles');
  perform pg_temp.assert_eq(r.rating::text, '5', 'rating đã lưu');
  perform pg_temp.assert_eq((select rating_avg::text || '/' || rating_count::text from public.gymer_profiles where user_id = pg_temp.g()),
                            '5.00/1', 'recompute sau đánh giá đầu');
  -- Mỗi booking một đánh giá.
  perform pg_temp.expect(pg_temp.c1(), format('select public.create_review(%L, 4, null)', 'b8000000-0000-4000-8000-000000000001'), 'FORBIDDEN');

  -- Đánh giá thứ hai (rating 3): trung bình 4.00, số lượt 2. Đánh giá biên 1 cũng hợp lệ.
  perform pg_temp.expect(pg_temp.c2(), format('select public.create_review(%L, 3, null)', 'b8000000-0000-4000-8000-000000000002'), 'OK');
  perform pg_temp.assert_eq((select rating_avg::text || '/' || rating_count::text from public.gymer_profiles where user_id = pg_temp.g()),
                            '4.00/2', 'recompute sau đánh giá thứ hai');

  -- Xoá một đánh giá (postgres): trigger tính lại, còn 1 lượt.
  delete from public.reviews where booking_id = 'b8000000-0000-4000-8000-000000000002';
  perform pg_temp.assert_eq((select rating_avg::text || '/' || rating_count::text from public.gymer_profiles where user_id = pg_temp.g()),
                            '5.00/1', 'recompute sau khi xoá');

  -- Không có quyền ghi trực tiếp vào reviews.
  perform pg_temp.expect_denied(pg_temp.c1(), format(
    'insert into public.reviews (booking_id, gymer_id, author_id, author_name, rating) values (%L, %L, %L, %L, 1)',
    'b8000000-0000-4000-8000-000000000001', pg_temp.g(), pg_temp.c1(), 'Khach C1'));
  perform pg_temp.expect_denied(pg_temp.g(), format('update public.gymer_profiles set rating_avg = 0 where user_id = %L', pg_temp.g()));
  raise notice 'booking 50 nhóm 8: create_review và recompute_rating OK';
end $$;
rollback to savepoint sp8;

-- ===== Nhóm 9: trigger SLOT_HAS_BOOKING (đóng ngày và đóng khung; postgres) =====
savepoint sp9;
do $$
declare
  v_d1 date := pg_temp.vn_today() + 35;
  v_d2 date := pg_temp.vn_today() + 36;
  v_d3 date := pg_temp.vn_today() + 37;
  v_d4 date := pg_temp.vn_today() + 38;
  v_d5 date := pg_temp.vn_today() + 39;
  v_id uuid;
begin
  -- Pending còn hạn chặn đóng ngày.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d1, '10:00'), pg_temp.exp_price(v_d1), null, false);
  insert into t_ids values ('t1', v_id);
  perform pg_temp.expect_admin(format('insert into public.gymer_day_overrides (gymer_id, day, is_open) values (%L, %L, false)',
                               pg_temp.g(), v_d1), 'SLOT_HAS_BOOKING');

  -- Đóng khung đã có booking confirmed: chặn; mở lại khung (is_open=true) thì được.
  perform pg_temp.seed('b9000000-0000-4000-8000-000000000001', pg_temp.g(), pg_temp.c2(), pg_temp.vn_ts(v_d2, '14:00'),
                       'confirmed', now() + interval '1 day');
  perform pg_temp.expect_admin(format('insert into public.gymer_slot_overrides (gymer_id, day, start_time, is_open) values (%L, %L, %L, false)',
                               pg_temp.g(), v_d2, '14:00'), 'SLOT_HAS_BOOKING');
  perform pg_temp.expect_admin(format('insert into public.gymer_slot_overrides (gymer_id, day, start_time, is_open) values (%L, %L, %L, true)',
                               pg_temp.g(), v_d2, '14:00'), 'OK');
  -- Khung khác trong cùng ngày không bị chặn.
  perform pg_temp.expect_admin(format('insert into public.gymer_slot_overrides (gymer_id, day, start_time, is_open) values (%L, %L, %L, false)',
                               pg_temp.g(), v_d2, '16:00'), 'OK');

  -- Ngày có booking, cập nhật ngoại lệ hiện có từ mở sang đóng: chặn khi UPDATE.
  perform pg_temp.expect_admin(format('insert into public.gymer_day_overrides (gymer_id, day, is_open, price_vnd) values (%L, %L, true, 210000)',
                               pg_temp.g(), v_d3), 'OK');
  v_id := pg_temp.book(pg_temp.c2(), pg_temp.g(), pg_temp.vn_ts(v_d3, '10:00'), 210000, null, false);
  insert into t_ids values ('t3', v_id);
  perform pg_temp.expect_admin(format('update public.gymer_day_overrides set is_open = false where gymer_id = %L and day = %L',
                               pg_temp.g(), v_d3), 'SLOT_HAS_BOOKING');

  -- Pending đã quá hạn không chặn: đóng ngày và đóng khung đều được.
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(v_d4, '10:00'), pg_temp.exp_price(v_d4), null, false);
  insert into t_ids values ('t4', v_id);
  update public.bookings set expires_at = now() - interval '1 minute' where id = v_id;
  perform pg_temp.expect_admin(format('insert into public.gymer_day_overrides (gymer_id, day, is_open) values (%L, %L, false)',
                               pg_temp.g(), v_d4), 'OK');

  -- Đóng ngày không có booking: được. Sau đó khách không đặt được khung nào trong ngày đó: SLOT_NOT_OPEN.
  perform pg_temp.expect_admin(format('insert into public.gymer_day_overrides (gymer_id, day, is_open) values (%L, %L, false)',
                               pg_temp.g(), v_d5), 'OK');
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_d5, '10:00'), pg_temp.exp_price(v_d5), null, false),
                         'SLOT_NOT_OPEN');
  raise notice 'booking 50 nhóm 9: SLOT_HAS_BOOKING (ngày, khung, UPDATE; pending quá hạn không chặn) OK';
end $$;
rollback to savepoint sp9;

-- ===== Nhóm 10: múi giờ. Chạy cùng bộ ca với timezone UTC và Asia/Ho_Chi_Minh =====
create function pg_temp.tz_suite(p_tag text) returns void language plpgsql as $$
declare
  v_d date := pg_temp.vn_today() + 40;
  v_id uuid;
begin
  -- Đặt 10:00 giờ VN: starts_at đúng và đọc lại đúng giờ VN, bất kể timezone phiên.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false);
  perform pg_temp.assert_eq((select (starts_at at time zone 'Asia/Ho_Chi_Minh')::time::text from public.bookings where id = v_id),
                            '10:00:00', p_tag || ' giờ VN');
  -- Cùng khung: SLOT_TAKEN.
  perform pg_temp.expect(pg_temp.c2(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false), 'SLOT_TAKEN');
  -- Booking 00:00 giờ VN của ngày v_d+1 (UTC là ngày trước): đóng ngày v_d+1 phải bị chặn.
  perform pg_temp.seed('b1000000-0000-4000-8000-00000000000a', pg_temp.g(), pg_temp.c3(), pg_temp.vn_ts(v_d + 1, '00:00'),
                       'confirmed', now() + interval '1 day');
  perform pg_temp.expect_admin(format('insert into public.gymer_day_overrides (gymer_id, day, is_open) values (%L, %L, false)',
                               pg_temp.g(), v_d + 1), 'SLOT_HAS_BOOKING');
  -- Ngày v_d (không có booking 00:00 của ngày khác): đóng được.
  perform pg_temp.expect_admin(format('insert into public.gymer_day_overrides (gymer_id, day, is_open) values (%L, %L, false)',
                               pg_temp.g(), v_d + 2), 'OK');
  -- Cuối tuần: giá 250000 theo ngày VN.
  v_id := pg_temp.book(pg_temp.c3(), pg_temp.g(), pg_temp.vn_ts(pg_temp.vn_day(6), '10:00'), 250000, null, false);
  perform pg_temp.assert_eq((select price_vnd::text from public.bookings where id = v_id), '250000', p_tag || ' T7 giá 250000');
end $$;

savepoint sp10a;
set timezone = 'UTC';
select pg_temp.tz_suite('UTC');
rollback to savepoint sp10a;

savepoint sp10b;
set timezone = 'Asia/Ho_Chi_Minh';
select pg_temp.tz_suite('Asia/Ho_Chi_Minh');
rollback to savepoint sp10b;
set timezone = 'UTC';

-- ===== Nhóm 11: khung đã qua và đặt trùng trên cùng ca (kiểm SLOT_TAKEN sau khi huỷ/đóng) =====
savepoint sp11;
do $$
declare
  v_d date := pg_temp.vn_today() + 41;
  v_id uuid;
begin
  -- Huỷ rồi đặt lại: khung trống ngay sau khi huỷ, và Gymer đóng khung sau huỷ được.
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false);
  perform pg_temp.expect(pg_temp.c1(), format('select public.cancel_booking(%L)', v_id), 'OK');
  perform pg_temp.expect_admin(format('insert into public.gymer_slot_overrides (gymer_id, day, start_time, is_open) values (%L, %L, %L, false)',
                               pg_temp.g(), v_d, '10:00'), 'OK');
  raise notice 'booking 50 nhóm 11: sau huỷ khung trống và đóng được OK';
end $$;
rollback to savepoint sp11;

-- ===== Nhóm 12: pending quá hạn chưa quét; Chủ nhật; thiếu profiles; rating về 0 sau khi xoá đánh giá cuối =====
savepoint sp12;
do $$
declare
  v_d date := pg_temp.vn_today() + 42;
  v_sun date := pg_temp.vn_day(7);
  v_id uuid;
  v_c4 uuid := '77000000-0000-4000-8000-000000000007';
  v_stale_r uuid := 'c1200000-0000-4000-8000-000000000001';
  v_stale_c uuid := 'c1200000-0000-4000-8000-000000000002';
  v_near_ok uuid := 'c1200000-0000-4000-8000-000000000003';
  v_rv_b uuid := 'c1200000-0000-4000-8000-000000000004';
begin
  -- respond_booking trên pending quá hạn chưa bị quét: BOOKING_EXPIRED, trạng thái giữ nguyên pending.
  perform pg_temp.seed(v_stale_r, pg_temp.g(), pg_temp.c1(), now() + interval '3 days', 'pending', now() - interval '1 minute');
  perform pg_temp.expect(pg_temp.g(), format('select public.respond_booking(%L, %L)', v_stale_r, 'confirmed'), 'BOOKING_EXPIRED');
  perform pg_temp.assert_eq((select status::text from public.bookings where id = v_stale_r), 'pending',
                            'respond quá hạn chưa quét giữ pending');

  -- cancel_booking trên pending quá hạn chưa quét, buổi bắt đầu trong 1 giờ: FORBIDDEN (không phải ALREADY_STARTED), cả hai vai.
  perform pg_temp.seed(v_stale_c, pg_temp.g(), pg_temp.c2(), now() + interval '1 hour', 'pending', now() - interval '1 minute');
  perform pg_temp.expect(pg_temp.c2(), format('select public.cancel_booking(%L)', v_stale_c), 'FORBIDDEN');
  perform pg_temp.expect(pg_temp.g(), format('select public.cancel_booking(%L)', v_stale_c), 'FORBIDDEN');
  perform pg_temp.assert_eq((select status::text from public.bookings where id = v_stale_c), 'pending',
                            'cancel quá hạn chưa quét không đổi trạng thái');
  -- Đối chứng: pending còn hạn, buổi sau 2 giờ (không chồng khung với v_stale_c): khách huỷ được.
  perform pg_temp.seed(v_near_ok, pg_temp.g(), pg_temp.c2(), now() + interval '2 hours', 'pending', now() + interval '10 minutes');
  perform pg_temp.expect(pg_temp.c2(), format('select public.cancel_booking(%L)', v_near_ok), 'OK');

  -- Chủ nhật: giá cuối tuần 250000 theo ngày VN; khai giá ngày thường: PRICE_CHANGED.
  perform pg_temp.expect(pg_temp.c1(), pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_sun, '10:00'), 200000, null, false), 'PRICE_CHANGED');
  v_id := pg_temp.book(pg_temp.c1(), pg_temp.g(), pg_temp.vn_ts(v_sun, '10:00'), 250000, null, false);
  perform pg_temp.assert_eq((select price_vnd::text from public.bookings where id = v_id), '250000', 'Chủ nhật giá 250000');

  -- Đăng nhập nhưng chưa có hàng profiles: FORBIDDEN, không tạo booking.
  insert into auth.users (id, email) values (v_c4, 'c4@t9.local');
  delete from public.profiles where id = v_c4;
  perform pg_temp.expect(v_c4, pg_temp.cb_sql(pg_temp.g(), pg_temp.vn_ts(v_d, '10:00'), pg_temp.exp_price(v_d), null, false), 'FORBIDDEN');
  perform pg_temp.assert_eq((select count(*)::text from public.bookings where customer_id = v_c4), '0',
                            'thiếu profiles không tạo booking');

  -- Xoá đánh giá cuối (postgres): rating_avg và rating_count về 0.
  perform pg_temp.seed(v_rv_b, pg_temp.g(), pg_temp.c1(), now() - interval '3 days', 'confirmed', now() - interval '4 days');
  insert into public.reviews (booking_id, gymer_id, author_id, author_name, rating)
  values (v_rv_b, pg_temp.g(), pg_temp.c1(), 'Khach C1', 4);
  perform pg_temp.assert_eq((select rating_count::text from public.gymer_profiles where user_id = pg_temp.g()), '1',
                            'có một đánh giá trước khi xoá');
  delete from public.reviews where booking_id = v_rv_b;
  perform pg_temp.assert_eq((select (rating_avg = 0 and rating_count = 0)::text from public.gymer_profiles where user_id = pg_temp.g()),
                            'true', 'xoá đánh giá cuối: rating về 0');
  raise notice 'booking 50 nhóm 12: pending quá hạn chưa quét, Chủ nhật, thiếu profiles, rating về 0 OK';
end $$;
rollback to savepoint sp12;

rollback;
