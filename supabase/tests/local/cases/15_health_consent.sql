-- Test đồng ý chia sẻ ghi chú sức khoẻ (N2, mục 2.5A; M7b: cột shared_with_gymer + policy booking_health_notes_select).
-- Toàn bộ nằm trong MỘT giao dịch và kết thúc bằng rollback: không để lại dữ liệu.
-- Gieo dữ liệu bằng postgres (bỏ qua RLS), sau đó đổi vai bằng set local role + request.jwt.claim.sub.
-- Ghi chú được chèn trực tiếp (không dùng RPC create_booking vì M9 có thể chưa áp).
-- Mọi mốc thời gian cách xa ranh giới (tối thiểu vài giờ), không assert sát giây.
--
-- Người:  K = khách của G và G2 (không ai khác); K2 = khách khác; G = Gymer listed; G2 = Gymer listed khác; Z = khách anon không có.
-- Booking (đều tính theo now()):
--   h1  K-G  confirmed, sắp tới, shared=false        -> G KHÔNG đọc (không tick)
--   h2  K-G  confirmed, sắp tới, shared=true         -> G đọc
--   h3  K-G  pending, còn hạn, shared=true           -> G đọc
--   h4  K-G  pending, quá expires_at, shared=true    -> G KHÔNG đọc
--   h5  K-G  confirmed, đã qua 19 giờ, shared=true   -> G đọc (còn trong 1 ngày sau ends_at)
--   h6  K-G  confirmed, đã qua 35 giờ, shared=true   -> G KHÔNG đọc (quá ends_at + 1 ngày)
--   h7  K-G  rejected, shared=true                   -> G KHÔNG đọc
--   h8  K-G  cancelled (G tự huỷ), shared=true       -> G KHÔNG đọc
--   h9  K-G  expired, shared=true                    -> G KHÔNG đọc
--   h10 K2-G confirmed, sắp tới, shared=true         -> G đọc; K2 đọc
--   h11 K2-G2 confirmed, sắp tới, shared=true        -> G2 đọc; K2 đọc; G không đọc
-- Kỳ vọng: K đọc 9 (h1..h9); K2 đọc 2 (h10, h11); G đọc 4 (h2, h3, h5, h10); G2 đọc 1 (h11); Z (anon) không đọc được.

begin;

-- ===== Gieo dữ liệu (postgres) =====
insert into auth.users (id, email) values
  ('dddddddd-0000-4000-8000-00000000000d', 'k15@test.local'),
  ('eeeeeeee-0000-4000-8000-00000000000e', 'k2-15@test.local'),
  ('44444444-0000-4000-8000-000000000004', 'g15@test.local'),
  ('55555555-0000-4000-8000-000000000005', 'g2-15@test.local');

insert into public.profiles (id, display_name) values
  ('dddddddd-0000-4000-8000-00000000000d', 'Khach K'),
  ('eeeeeeee-0000-4000-8000-00000000000e', 'Khach K2'),
  ('44444444-0000-4000-8000-000000000004', 'Gymer G'),
  ('55555555-0000-4000-8000-000000000005', 'Gymer G2');

insert into public.gymer_profiles
  (user_id, display_name, gender, birth_year, area_label, price_weekday_vnd, price_weekend_vnd, is_listed)
values
  ('44444444-0000-4000-8000-000000000004', 'Gymer G', 'male', 1990, 'Quan 1', 200000, 250000, true),
  ('55555555-0000-4000-8000-000000000005', 'Gymer G2', 'female', 1992, 'Quan 3', 200000, 250000, true);

-- Ghi chú: h1 không tick (false); còn lại tick (true). Bookings đặt ở phần dưới cùng transaction.
insert into public.bookings
  (id, gymer_id, customer_id, starts_at, ends_at, price_vnd, status, expires_at, cancelled_at, cancelled_by)
values
  ('f1500000-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() + interval '3 days', now() + interval '3 days' + interval '60 minutes', 200000, 'confirmed', now() + interval '1 day', null, null),
  ('f1500000-0000-4000-8000-000000000002', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() + interval '4 days', now() + interval '4 days' + interval '60 minutes', 200000, 'confirmed', now() + interval '1 day', null, null),
  ('f1500000-0000-4000-8000-000000000003', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() + interval '5 days', now() + interval '5 days' + interval '60 minutes', 200000, 'pending', now() + interval '1 hour', null, null),
  ('f1500000-0000-4000-8000-000000000004', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() + interval '6 days', now() + interval '6 days' + interval '60 minutes', 200000, 'pending', now() - interval '1 hour', null, null),
  ('f1500000-0000-4000-8000-000000000005', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() - interval '20 hours', now() - interval '19 hours', 200000, 'confirmed', now() - interval '3 days', null, null),
  ('f1500000-0000-4000-8000-000000000006', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() - interval '36 hours', now() - interval '35 hours', 200000, 'confirmed', now() - interval '3 days', null, null),
  ('f1500000-0000-4000-8000-000000000007', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() + interval '7 days', now() + interval '7 days' + interval '60 minutes', 200000, 'rejected', now() + interval '1 day', null, null),
  ('f1500000-0000-4000-8000-000000000008', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() + interval '8 days', now() + interval '8 days' + interval '60 minutes', 200000, 'cancelled', now() + interval '1 day',
   now(), '44444444-0000-4000-8000-000000000004'),
  ('f1500000-0000-4000-8000-000000000009', '44444444-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-00000000000d',
   now() + interval '9 days', now() + interval '9 days' + interval '60 minutes', 200000, 'expired', now() - interval '1 hour', null, null),
  ('f1500000-0000-4000-8000-000000000010', '44444444-0000-4000-8000-000000000004', 'eeeeeeee-0000-4000-8000-00000000000e',
   now() + interval '10 days', now() + interval '10 days' + interval '60 minutes', 200000, 'confirmed', now() + interval '1 day', null, null),
  ('f1500000-0000-4000-8000-000000000011', '55555555-0000-4000-8000-000000000005', 'eeeeeeee-0000-4000-8000-00000000000e',
   now() + interval '11 days', now() + interval '11 days' + interval '60 minutes', 200000, 'confirmed', now() + interval '1 day', null, null);

insert into public.booking_health_notes (booking_id, note, shared_with_gymer) values
  ('f1500000-0000-4000-8000-000000000001', 'Ghi chu h1 khong tick', false),
  ('f1500000-0000-4000-8000-000000000002', 'Ghi chu h2', true),
  ('f1500000-0000-4000-8000-000000000003', 'Ghi chu h3', true),
  ('f1500000-0000-4000-8000-000000000004', 'Ghi chu h4', true),
  ('f1500000-0000-4000-8000-000000000005', 'Ghi chu h5', true),
  ('f1500000-0000-4000-8000-000000000006', 'Ghi chu h6', true),
  ('f1500000-0000-4000-8000-000000000007', 'Ghi chu h7', true),
  ('f1500000-0000-4000-8000-000000000008', 'Ghi chu h8', true),
  ('f1500000-0000-4000-8000-000000000009', 'Ghi chu h9', true),
  ('f1500000-0000-4000-8000-000000000010', 'Ghi chu h10', true),
  ('f1500000-0000-4000-8000-000000000011', 'Ghi chu h11', true);

-- ===== Cấu trúc: cột và policy (không phụ thuộc dữ liệu) =====
do $$
begin
  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'booking_health_notes' and column_name = 'shared_with_gymer'
      and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false'
  ), 'cột booking_health_notes.shared_with_gymer phải là boolean not null default false';

  assert (select count(*) from pg_policies
          where schemaname = 'public' and tablename = 'booking_health_notes') = 1,
    'booking_health_notes phải có đúng một policy';
  assert (select count(*) from pg_policies
          where schemaname = 'public' and tablename = 'booking_health_notes'
            and policyname = 'booking_health_notes_select' and cmd = 'SELECT') = 1,
    'thiếu policy SELECT booking_health_notes_select';
  assert not exists (select 1 from pg_policies
          where schemaname = 'public' and tablename = 'booking_health_notes' and cmd <> 'SELECT'),
    'booking_health_notes không được có policy ghi';
  assert (select position('shared_with_gymer' in qual) > 0 from pg_policies
          where schemaname = 'public' and tablename = 'booking_health_notes'
            and policyname = 'booking_health_notes_select'),
    'policy booking_health_notes_select phải kiểm shared_with_gymer';
end $$;

-- ===== Khách K: đọc đủ 9 ghi chú của mình, kể cả h1 (không tick) và h6 (quá hạn) =====
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0000-4000-8000-00000000000d';

do $$
begin
  assert (select count(*) from public.booking_health_notes) = 9,
    'K: khách phải đọc đủ 9 ghi chú của mình (h1..h9) bất kể tick, hạn, trạng thái';
  assert exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000001')
     and exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000006'),
    'K: không đọc được h1 (không tick) hoặc h6 (quá hạn) của chính mình';
end $$;
reset role;

-- ===== Gymer G: chỉ đọc h2, h3, h5, h10 =====
set local role authenticated;
set local request.jwt.claim.sub = '44444444-0000-4000-8000-000000000004';

do $$
begin
  assert (select count(*) from public.booking_health_notes) = 4,
    'G: phải đọc đúng 4 ghi chú (h2, h3, h5, h10)';
  assert exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000002')
     and exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000003')
     and exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000005')
     and exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000010'),
    'G: không đọc được h2/h3/h5/h10 (khách đã tick, còn hạn hoặc trong 1 ngày sau buổi)';
  -- Không tick (h1).
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000001'),
    'G: đọc được h1 khi khách không tick';
  -- Pending quá expires_at (h4).
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000004'),
    'G: đọc được h4 (pending quá expires_at)';
  -- Quá ends_at + 1 ngày (h6).
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000006'),
    'G: đọc được h6 (confirmed đã quá ends_at + 1 ngày)';
  -- Rejected (h7), cancelled (h8), expired (h9).
  assert not exists (select 1 from public.booking_health_notes where booking_id in (
      'f1500000-0000-4000-8000-000000000007', 'f1500000-0000-4000-8000-000000000008', 'f1500000-0000-4000-8000-000000000009')),
    'G: đọc được ghi chú của booking rejected/cancelled/expired';
  -- Booking của G2 (h11): không phải của G.
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000011'),
    'G: đọc được ghi chú của booking không phải của mình (h11)';
end $$;
reset role;

-- ===== Khách K2: đọc h10 và h11 (hai booking của mình) =====
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-00000000000e';

do $$
begin
  assert (select count(*) from public.booking_health_notes) = 2,
    'K2: phải đọc đúng 2 ghi chú của mình (h10, h11)';
  assert not exists (select 1 from public.booking_health_notes where booking_id in (
      'f1500000-0000-4000-8000-000000000001', 'f1500000-0000-4000-8000-000000000005')),
    'K2: đọc được ghi chú của khách K';
end $$;
reset role;

-- ===== Gymer G2 (khác G): chỉ đọc h11 (khách K2 tick), không đọc h10 của G =====
set local role authenticated;
set local request.jwt.claim.sub = '55555555-0000-4000-8000-000000000005';

do $$
begin
  assert (select count(*) from public.booking_health_notes) = 1,
    'G2: phải đọc đúng 1 ghi chú (h11)';
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'f1500000-0000-4000-8000-000000000010'),
    'G2: đọc được ghi chú của Gymer G (h10)';
end $$;
reset role;

-- ===== Anon: không đọc được ghi chú nào =====
set local role anon;

do $$
declare
  caught boolean := false;
  n int;
begin
  begin
    select count(*) into n from public.booking_health_notes;
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'anon: phải bị từ chối đọc booking_health_notes';
end $$;
reset role;

-- ===== Client không đổi được shared_with_gymer (không có quyền UPDATE/INSERT, bắt 42501) =====
-- K không được bật tick cho h1 (booking của chính mình, không tick).
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0000-4000-8000-00000000000d';

do $$
declare
  caught boolean := false;
begin
  begin
    update public.booking_health_notes set shared_with_gymer = true
    where booking_id = 'f1500000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'K: update shared_with_gymer phải bị từ chối (42501)';
end $$;

do $$
declare
  caught boolean := false;
begin
  begin
    insert into public.booking_health_notes (booking_id, note, shared_with_gymer)
    values ('f1500000-0000-4000-8000-000000000001', 'hack', true);
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'K: insert booking_health_notes phải bị từ chối (42501)';
end $$;
reset role;

-- Gymer G cũng không bật được tick cho h2 (booking của mình, đã tick, nên đây là kiểm không ghi được).
set local role authenticated;
set local request.jwt.claim.sub = '44444444-0000-4000-8000-000000000004';

do $$
declare
  caught boolean := false;
begin
  begin
    update public.booking_health_notes set shared_with_gymer = false
    where booking_id = 'f1500000-0000-4000-8000-000000000002';
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G: update shared_with_gymer phải bị từ chối (42501)';
end $$;
reset role;

-- Giá trị không đổi sau các ca ghi bị từ chối (đọc bằng postgres, bỏ qua RLS).
do $$
begin
  assert (select shared_with_gymer from public.booking_health_notes
          where booking_id = 'f1500000-0000-4000-8000-000000000001') = false,
    'h1: shared_with_gymer bị đổi sau ca ghi bị từ chối';
  assert (select shared_with_gymer from public.booking_health_notes
          where booking_id = 'f1500000-0000-4000-8000-000000000002') = true,
    'h2: shared_with_gymer bị đổi sau ca ghi bị từ chối';
end $$;

rollback;

\echo 'Ca đồng ý ghi chú sức khoẻ (15_health_consent.sql) đạt toàn bộ assert.'
