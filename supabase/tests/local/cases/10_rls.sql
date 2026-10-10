-- Test RLS cho M2–M7 (đối chiếu mục 2.5, 2.4A, 2.6, 2.7 và M6/M7 thật).
-- Toàn bộ nằm trong MỘT giao dịch và kết thúc bằng rollback: không để lại dữ liệu.
-- Gieo dữ liệu bằng postgres (bỏ qua RLS), sau đó đổi vai bằng set local role + request.jwt.claim.sub.
-- Ca "bị từ chối" chỉ bắt insufficient_privilege (42501: thiếu quyền hoặc vi phạm RLS WITH CHECK).
-- Không bắt "others": lỗi lạ trong test sẽ làm test thất bại, không bị nuốt thành "đạt".
--
-- Người:  A, B = khách; G1 = Gymer is_listed=true; G2 = Gymer is_listed=false.
-- Booking (A-G1 trừ b5 và b1..b4 là các trạng thái; B-G2 là b6/b7):
--   b1 A-G1 pending   b2 A-G1 confirmed   b3 A-G1 rejected   b4 A-G1 cancelled (G1 tự huỷ)
--   b5 A-G1 confirmed, đã qua (có đánh giá d1)
--   b6 B-G2 confirmed, sắp tới (có ghi chú)   b7 B-G2 confirmed, đã qua (có đánh giá d2)
-- N1 (thêm sau): G3 = Gymer không listed, C = khách của G3; b11 pending quá hạn, b12 expired,
--   b13 pending còn hạn, b14 confirmed (expires_at đã qua).

begin;

-- ===== Gieo dữ liệu (postgres) =====
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'b@test.local'),
  ('11111111-0000-4000-8000-000000000001', 'g1@test.local'),
  ('22222222-0000-4000-8000-000000000002', 'g2@test.local');

insert into public.profiles (id, display_name) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'Khach A'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Khach B'),
  ('11111111-0000-4000-8000-000000000001', 'Gymer G1'),
  ('22222222-0000-4000-8000-000000000002', 'Gymer G2');

insert into public.gymer_profiles
  (user_id, display_name, gender, birth_year, area_label, price_weekday_vnd, price_weekend_vnd, is_listed)
values
  ('11111111-0000-4000-8000-000000000001', 'Gymer G1', 'male', 1990, 'Quan 1', 200000, 250000, true),
  ('22222222-0000-4000-8000-000000000002', 'Gymer G2', 'female', 1992, 'Quan 3', 200000, 250000, false);

insert into public.certificates (id, gymer_id, name) values
  ('c0000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'Chung chi G1 a'),
  ('c0000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'Chung chi G1 b'),
  ('c0000000-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000002', 'Chung chi G2 a');

insert into public.gymer_locations (user_id, lat, lng) values
  ('11111111-0000-4000-8000-000000000001', 10.7769, 106.7009);

-- Lưu ý: ends_at viết đúng biểu thức starts_at + interval '60 minutes' để khớp ràng buộc bookings_duration_60m.
insert into public.bookings
  (id, gymer_id, customer_id, starts_at, ends_at, price_vnd, status, expires_at, cancelled_at, cancelled_by)
values
  ('b0000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a',
   now() + interval '1 day', now() + interval '1 day' + interval '60 minutes', 200000, 'pending', now() + interval '1 day', null, null),
  ('b0000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a',
   now() + interval '2 days', now() + interval '2 days' + interval '60 minutes', 200000, 'confirmed', now() + interval '1 day', null, null),
  ('b0000000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a',
   now() + interval '3 days', now() + interval '3 days' + interval '60 minutes', 200000, 'rejected', now() + interval '1 day', null, null),
  ('b0000000-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a',
   now() + interval '4 days', now() + interval '4 days' + interval '60 minutes', 200000, 'cancelled', now() + interval '1 day', now(), '11111111-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a',
   now() - interval '2 days', now() - interval '2 days' + interval '60 minutes', 200000, 'confirmed', now() - interval '3 days', null, null),
  ('b0000000-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000b',
   now() + interval '5 days', now() + interval '5 days' + interval '60 minutes', 250000, 'confirmed', now() + interval '1 day', null, null),
  ('b0000000-0000-4000-8000-000000000007', '22222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000b',
   now() - interval '3 days', now() - interval '3 days' + interval '60 minutes', 250000, 'confirmed', now() - interval '4 days', null, null);

insert into public.booking_health_notes (booking_id, note, shared_with_gymer) values
  ('b0000000-0000-4000-8000-000000000001', 'Dau lung nhe', true),
  ('b0000000-0000-4000-8000-000000000002', 'Chan goi yeu', true),
  ('b0000000-0000-4000-8000-000000000003', 'Ghi chu bi tu choi', false),
  ('b0000000-0000-4000-8000-000000000004', 'Ghi chu bi huy', false),
  ('b0000000-0000-4000-8000-000000000006', 'Tien su huyet ap', true);

-- Đánh giá gắn với booking đã qua (ràng buộc thời gian chỉ ở RPC create_review, M9).
insert into public.reviews (id, booking_id, gymer_id, author_id, author_name, rating, body) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005',
   '11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'Khach A', 5, 'Tot'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000007',
   '22222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000b', 'Khach B', 4, 'On');

do $$
begin
  assert (select count(*) from public.bookings) = 7, 'seed: phải có 7 booking';
  assert (select rating_avg from public.gymer_profiles where user_id = '11111111-0000-4000-8000-000000000001') = 5.00,
    'seed: trigger phải tính rating_avg G1 = 5.00';
  assert (select rating_count from public.gymer_profiles where user_id = '22222222-0000-4000-8000-000000000002') = 1,
    'seed: trigger phải tính rating_count G2 = 1';
end $$;

-- ===== Vai A (khách có 5 booking với G1) =====
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-00000000000a';

do $$
begin
  assert (select count(*) from public.bookings) = 5, 'A: phải thấy đúng 5 booking của mình';
  assert not exists (select 1 from public.bookings where customer_id <> 'aaaaaaaa-0000-4000-8000-00000000000a'),
    'A: thấy booking của người khác';
  assert (select count(*) from public.booking_health_notes) = 4,
    'A: phải đọc đúng 4 ghi chú của mình (b1..b4, gồm cả đã từ chối/huỷ)';
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000006'),
    'A: đọc được ghi chú của booking B-G2';
  assert (select count(*) from public.gymer_profiles) = 1
     and exists (select 1 from public.gymer_profiles where user_id = '11111111-0000-4000-8000-000000000001'),
    'A: chỉ được thấy G1 (listed); G2 không listed và không có booking với A';
  assert (select count(*) from public.certificates) = 2,
    'A: phải thấy đúng 2 chứng chỉ của G1 và không thấy chứng chỉ của G2';
  assert (select count(*) from public.profiles) = 1,
    'A: profiles chỉ có dòng của chính A';
  assert (select count(*) from public.reviews) = 1,
    'A: phải thấy đúng 1 đánh giá (của chính A)';
  assert (select count(*) from public.gymer_locations) = 0,
    'A: đọc được gymer_locations của G1 (toạ độ riêng tư)';
end $$;

-- A không được ghi các bảng đặt lịch/đánh giá/chứng chỉ của người khác.
do $$
declare caught boolean;
begin
  caught := false;
  begin
    insert into public.bookings (gymer_id, customer_id, starts_at, ends_at, price_vnd, expires_at)
    values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a',
            now() + interval '9 days', now() + interval '9 days' + interval '60 minutes', 1, now());
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'A: insert bookings phải bị từ chối';

  caught := false;
  begin
    update public.bookings set goal = 'x' where customer_id = 'aaaaaaaa-0000-4000-8000-00000000000a';
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'A: update bookings phải bị từ chối';

  caught := false;
  begin
    delete from public.bookings where false;
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'A: delete bookings phải bị từ chối';

  caught := false;
  begin
    insert into public.booking_health_notes (booking_id, note)
    values ('b0000000-0000-4000-8000-000000000002', 'hack');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'A: insert booking_health_notes phải bị từ chối';

  caught := false;
  begin
    insert into public.reviews (booking_id, gymer_id, author_id, author_name, rating)
    values ('b0000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001',
            'aaaaaaaa-0000-4000-8000-00000000000a', 'Khach A', 1);
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'A: insert reviews phải bị từ chối (chỉ qua create_review)';

  caught := false;
  begin
    delete from public.reviews where false;
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'A: delete reviews phải bị từ chối';

  caught := false;
  begin
    insert into public.certificates (gymer_id, name)
    values ('11111111-0000-4000-8000-000000000001', 'gia');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'A: thêm chứng chỉ cho G1 phải bị từ chối (RLS WITH CHECK)';
end $$;

-- A không sửa/xoá được chứng chỉ của G1: RLS lọc, không báo lỗi, nên kiểm số dòng tác động.
do $$
declare n int;
begin
  update public.certificates set name = 'hack' where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'A: update chứng chỉ của G1 tác động dòng';

  delete from public.certificates where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'A: delete chứng chỉ của G1 tác động dòng';
end $$;
reset role;

-- ===== Vai G1 (Gymer listed, nhận 4 booking từ A và 1 đã qua) =====
set local role authenticated;
set local request.jwt.claim.sub = '11111111-0000-4000-8000-000000000001';

do $$
begin
  assert (select count(*) from public.bookings) = 5
     and not exists (select 1 from public.bookings where gymer_id <> '11111111-0000-4000-8000-000000000001'),
    'G1: phải thấy đúng 5 booking gửi G1 và không booking nào khác';
  -- Chỉ pending (b1) và confirmed (b2) được đọc ghi chú; rejected (b3), cancelled do chính G1 huỷ (b4) thì không.
  assert (select count(*) from public.booking_health_notes) = 2,
    'G1: phải đọc đúng 2 ghi chú (pending, confirmed)';
  assert exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000001')
     and exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000002'),
    'G1: không đọc được ghi chú của booking pending/confirmed';
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000003'),
    'G1: đọc được ghi chú sau khi booking bị rejected';
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000004'),
    'G1: đọc được ghi chú sau khi booking bị cancelled (kể cả do chính G1 huỷ)';
  -- Hồ sơ khách: chỉ khách có booking gửi G1 (A), không đọc được khách khác (B).
  assert exists (select 1 from public.profiles where id = 'aaaaaaaa-0000-4000-8000-00000000000a'),
    'G1: không đọc được hồ sơ khách A có booking gửi mình';
  assert not exists (select 1 from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b'),
    'G1: đọc được hồ sơ khách B không có booking với mình';
  assert (select count(*) from public.profiles) = 2, 'G1: profiles phải là chính G1 và A';
  assert (select count(*) from public.gymer_profiles) = 1,
    'G1: gymer_profiles phải chỉ có dòng của chính G1';
  assert (select count(*) from public.certificates) = 2,
    'G1: phải đọc được 2 chứng chỉ của mình';
  assert (select count(*) from public.reviews) = 1,
    'G1: phải đọc được đánh giá của mình (d1)';
  -- M6 cho chủ đọc dòng gymer_locations của mình (không cho khách khác): G1 thấy đúng 1 dòng.
  assert (select count(*) from public.gymer_locations) = 1,
    'G1: phải đọc được dòng gymer_locations của chính mình (M6)';
end $$;

-- G1 không tự huỷ/sửa booking trực tiếp và không tự sửa rating_avg.
do $$
declare caught boolean;
begin
  caught := false;
  begin
    update public.bookings set status = 'cancelled', cancelled_at = now(),
      cancelled_by = '11111111-0000-4000-8000-000000000001'
    where id = 'b0000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G1: update bookings (tự huỷ trực tiếp) phải bị từ chối';

  caught := false;
  begin
    update public.gymer_profiles set rating_avg = 0
    where user_id = '11111111-0000-4000-8000-000000000001';
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G1: update gymer_profiles.rating_avg phải bị từ chối (quyền theo cột)';
end $$;

-- Dòng chứng chỉ của chính G1 vẫn sửa được (đối chứng: ca từ chối ở trên không phải do khoá cứng).
-- Đặt lại đúng tên cũ nên không đổi dữ liệu.
do $$
declare n int;
begin
  update public.certificates set name = name where id = 'c0000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không sửa được chứng chỉ của chính mình';
end $$;
reset role;

-- ===== Vai G2 (Gymer không listed, có 1 booking từ B) =====
set local role authenticated;
set local request.jwt.claim.sub = '22222222-0000-4000-8000-000000000002';

do $$
begin
  assert (select count(*) from public.bookings) = 2
     and not exists (select 1 from public.bookings where gymer_id <> '22222222-0000-4000-8000-000000000002'),
    'G2: phải thấy đúng 2 booking gửi G2';
  assert (select count(*) from public.booking_health_notes) = 1,
    'G2: phải đọc đúng 1 ghi chú (booking b6 confirmed)';
  assert not exists (select 1 from public.booking_health_notes where booking_id in (
      'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004')),
    'G2: đọc được ghi chú của A (khách khác, booking với G1)';
  assert exists (select 1 from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b')
     and not exists (select 1 from public.profiles where id = 'aaaaaaaa-0000-4000-8000-00000000000a'),
    'G2: phải đọc hồ sơ B (có booking gửi mình) và không đọc hồ sơ A';
  assert (select count(*) from public.gymer_profiles) = 2,
    'G2: phải thấy chính mình và G1 (listed)';
  assert (select count(*) from public.certificates where gymer_id = '22222222-0000-4000-8000-000000000002') = 1,
    'G2: phải đọc được chứng chỉ của chính mình';
  assert (select count(*) from public.reviews) = 2,
    'G2: phải đọc được đánh giá của G2 (d2) và của G1 (d1, G1 listed)';
end $$;

-- G2 không sửa/xoá được chứng chỉ của G1 và không thêm được chứng chỉ cho G1.
do $$
declare n int;
declare caught boolean;
begin
  update public.certificates set name = 'hack' where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: update chứng chỉ của G1 tác động dòng';

  delete from public.certificates where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: delete chứng chỉ của G1 tác động dòng';

  caught := false;
  begin
    insert into public.certificates (gymer_id, name)
    values ('11111111-0000-4000-8000-000000000001', 'gia');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G2: thêm chứng chỉ cho G1 phải bị từ chối';
end $$;
reset role;

-- ===== Vai B (khách có booking với G2 không listed; không có booking với G1) =====
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-00000000000b';

do $$
begin
  assert (select count(*) from public.bookings) = 2,
    'B: phải thấy đúng 2 booking của mình (b6, b7)';
  assert (select count(*) from public.booking_health_notes) = 1,
    'B: phải đọc đúng 1 ghi chú của mình (b6)';
  assert not exists (select 1 from public.booking_health_notes where booking_id in (
      'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004')),
    'B: đọc được ghi chú sức khoẻ của A';
  -- Khách có booking với G2 (is_listed=false) đọc được hồ sơ G2; G1 listed đọc được như thường.
  assert (select count(*) from public.gymer_profiles) = 2
     and exists (select 1 from public.gymer_profiles where user_id = '22222222-0000-4000-8000-000000000002'),
    'B: phải đọc được hồ sơ G2 (không listed, có booking) và G1 (listed)';
  assert (select count(*) from public.certificates where gymer_id = '22222222-0000-4000-8000-000000000002') = 1,
    'B: khách có booking với G2 phải đọc được chứng chỉ của G2';
  assert (select count(*) from public.certificates where gymer_id = '11111111-0000-4000-8000-000000000001') = 2,
    'B: phải đọc được chứng chỉ của G1 (listed)';
  assert (select count(*) from public.reviews) = 2,
    'B: phải đọc được đánh giá của mình (d2) và của G1 (d1, G1 listed)';
  -- Khách không đọc hồ sơ khách khác và không đọc profiles của Gymer (chiều ngược không được cấp).
  assert (select count(*) from public.profiles) = 1,
    'B: profiles chỉ có dòng của chính B';
end $$;
reset role;

-- ===== N1: pending đã quá expires_at và expired không cho Gymer đọc ghi chú =====
-- Thêm G3 (không listed) và khách C chỉ có booking với G3, nên không đổi số dòng của các ca trên.
insert into auth.users (id, email) values
  ('33333333-0000-4000-8000-000000000003', 'g3@test.local'),
  ('cccccccc-0000-4000-8000-00000000000c', 'c@test.local');

insert into public.profiles (id, display_name) values
  ('cccccccc-0000-4000-8000-00000000000c', 'Khach C'),
  ('33333333-0000-4000-8000-000000000003', 'Gymer G3');

insert into public.gymer_profiles
  (user_id, display_name, gender, birth_year, area_label, price_weekday_vnd, price_weekend_vnd, is_listed)
values
  ('33333333-0000-4000-8000-000000000003', 'Gymer G3', 'male', 1990, 'Quan 7', 200000, 250000, false);

insert into public.bookings
  (id, gymer_id, customer_id, starts_at, ends_at, price_vnd, status, expires_at)
values
  -- b11: pending đã quá hạn (chưa chuyển expired).
  ('b0000000-0000-4000-8000-000000000011', '33333333-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-00000000000c',
   now() + interval '5 days', now() + interval '5 days' + interval '60 minutes', 200000, 'pending', now() - interval '1 hour'),
  -- b12: expired.
  ('b0000000-0000-4000-8000-000000000012', '33333333-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-00000000000c',
   now() + interval '6 days', now() + interval '6 days' + interval '60 minutes', 200000, 'expired', now() - interval '1 hour'),
  -- b13: pending còn hạn.
  ('b0000000-0000-4000-8000-000000000013', '33333333-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-00000000000c',
   now() + interval '7 days', now() + interval '7 days' + interval '60 minutes', 200000, 'pending', now() + interval '1 day'),
  -- b14: confirmed, expires_at đã qua (confirmed không áp expires_at).
  ('b0000000-0000-4000-8000-000000000014', '33333333-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-00000000000c',
   now() + interval '8 days', now() + interval '8 days' + interval '60 minutes', 200000, 'confirmed', now() - interval '3 days');

insert into public.booking_health_notes (booking_id, note, shared_with_gymer) values
  ('b0000000-0000-4000-8000-000000000011', 'Ghi chu pending qua han', false),
  ('b0000000-0000-4000-8000-000000000012', 'Ghi chu expired', false),
  ('b0000000-0000-4000-8000-000000000013', 'Ghi chu pending con han', true),
  ('b0000000-0000-4000-8000-000000000014', 'Ghi chu confirmed', true);

-- Khách luôn đọc được ghi chú của mình, kể cả pending quá hạn và expired.
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-4000-8000-00000000000c';

do $$
begin
  assert (select count(*) from public.booking_health_notes
          where booking_id in ('b0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000012',
                               'b0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000014')) = 4,
    'C: khách phải đọc đủ 4 ghi chú của mình';
end $$;
reset role;

-- Gymer G3: chỉ đọc pending còn hạn (b13) và confirmed (b14); không đọc pending quá hạn (b11) và expired (b12).
set local role authenticated;
set local request.jwt.claim.sub = '33333333-0000-4000-8000-000000000003';

do $$
begin
  assert (select count(*) from public.booking_health_notes) = 2,
    'G3: phải đọc đúng 2 ghi chú (pending còn hạn, confirmed)';
  assert exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000013')
     and exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000014'),
    'G3: không đọc được ghi chú của pending còn hạn hoặc confirmed';
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000011'),
    'G3: đọc được ghi chú của pending đã quá expires_at';
  assert not exists (select 1 from public.booking_health_notes where booking_id = 'b0000000-0000-4000-8000-000000000012'),
    'G3: đọc được ghi chú của booking expired';
end $$;
reset role;

-- ===== Vai anon: không đọc, không ghi bảng nào trong public =====
set local role anon;

do $$
declare t record;
declare n_ok int := 0;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    begin
      execute format('select 1 from public.%I limit 1', t.tablename);
      n_ok := n_ok + 1;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  assert n_ok = 0, format('anon đọc được %s bảng public', n_ok);
end $$;

do $$
declare t record;
declare n_ok int := 0;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    begin
      execute format('delete from public.%I where false', t.tablename);
      n_ok := n_ok + 1;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  assert n_ok = 0, format('anon có quyền delete trên %s bảng public', n_ok);
end $$;
reset role;

-- ===== zalo_identities: không có grant cho authenticated; select phải bị từ chối (N3) =====
do $$
begin
  assert not has_table_privilege('authenticated', 'public.zalo_identities', 'SELECT,INSERT,UPDATE,DELETE'),
    'authenticated có quyền trên zalo_identities';
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-00000000000a';

do $$
declare caught boolean := false;
begin
  begin
    perform 1 from public.zalo_identities limit 1;
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'A: select zalo_identities phải bị từ chối (42501)';
end $$;
reset role;

-- ===== Kiểm quyền trong catalog (không phụ thuộc dữ liệu) =====
do $$
declare bad text := '';
declare t record;
begin
  -- Mọi bảng public bật RLS.
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    bad := bad || ' ' || t.relname;
  end loop;
  assert bad = '', 'bảng public chưa bật RLS:' || bad;

  -- anon không có quyền trên bảng public nào.
  bad := '';
  for t in select tablename from pg_tables where schemaname = 'public' loop
    if has_table_privilege('anon', format('public.%I', t.tablename), 'SELECT,INSERT,UPDATE,DELETE') then
      bad := bad || ' ' || t.tablename;
    end if;
  end loop;
  assert bad = '', 'anon có quyền trên bảng:' || bad;

  -- Không policy nào cho anon hoặc PUBLIC.
  assert not exists (select 1 from pg_policies where schemaname = 'public'
                     and ('anon'::name = any(roles) or 'public'::name = any(roles))),
    'có policy cho anon hoặc PUBLIC';

  -- Ba bảng của M7: chỉ đọc, không ghi trực tiếp, không policy ghi.
  foreach bad in array array['bookings', 'booking_health_notes', 'reviews'] loop
    assert has_table_privilege('authenticated', format('public.%I', bad), 'SELECT'),
      'authenticated không có SELECT trên ' || bad;
    assert not has_table_privilege('authenticated', format('public.%I', bad), 'INSERT,UPDATE,DELETE'),
      'authenticated có quyền ghi trực tiếp trên ' || bad;
  end loop;
  assert not exists (select 1 from pg_policies where schemaname = 'public'
                     and tablename in ('bookings', 'booking_health_notes', 'reviews') and cmd <> 'SELECT'),
    'có policy ghi trên bookings/booking_health_notes/reviews';

  -- Quyền theo cột: authenticated không UPDATE được rating_avg, rating_count.
  assert not has_column_privilege('authenticated', 'public.gymer_profiles', 'rating_avg', 'UPDATE'),
    'authenticated có UPDATE trên gymer_profiles.rating_avg';
  assert not has_column_privilege('authenticated', 'public.gymer_profiles', 'rating_count', 'UPDATE'),
    'authenticated có UPDATE trên gymer_profiles.rating_count';
end $$;

-- ===== Catalog cho hàm (N4) =====
do $$
declare bad text := '';
declare f record;
declare n_definer int := 0;
begin
  -- Mọi hàm SECURITY DEFINER trong public/private phải có search_path="" (cố định, rỗng).
  for f in select p.oid::regprocedure::text as sig, p.proconfig
           from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname in ('public', 'private') and p.prosecdef loop
    n_definer := n_definer + 1;
    if f.proconfig is null or not ('search_path=""' = any (f.proconfig)) then
      bad := bad || ' ' || f.sig;
    end if;
  end loop;
  assert n_definer >= 4, format('mong đợi >= 4 hàm security definer, thấy %s', n_definer);
  assert bad = '', 'hàm security definer thiếu search_path="":' || bad;

  -- anon và PUBLIC không có EXECUTE trên hàm trong public.
  bad := '';
  for f in select p.oid as fid, p.oid::regprocedure::text as sig, p.proacl, p.proowner
           from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname = 'public' loop
    if has_function_privilege('anon', f.fid, 'EXECUTE') then
      bad := bad || ' ' || f.sig || '(anon)';
    end if;
    if exists (select 1 from aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
               where a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      bad := bad || ' ' || f.sig || '(PUBLIC)';
    end if;
  end loop;
  assert bad = '', 'anon hoặc PUBLIC có EXECUTE trên hàm public:' || bad;
end $$;

-- ===== Ghi bị lọc 0 dòng (kèm ca đối chứng cho chủ) =====
-- Seed thêm (postgres) để có dòng mà thử sửa/xoá: chuyên môn, ngoại lệ ngày và khung của G1.
insert into public.specialties (name) values ('strength'), ('yoga');

insert into public.gymer_specialties (gymer_id, specialty_name) values
  ('11111111-0000-4000-8000-000000000001', 'strength');

insert into public.gymer_day_overrides (gymer_id, day, is_open) values
  ('11111111-0000-4000-8000-000000000001', current_date + 10, false);

insert into public.gymer_slot_overrides (gymer_id, day, start_time, is_open) values
  ('11111111-0000-4000-8000-000000000001', current_date + 10, '09:00', false);

do $$
begin
  assert (select count(*) from public.gymer_open_hours where gymer_id = '11111111-0000-4000-8000-000000000001') = 8,
    'seed: G1 phải có 8 giờ mở mẫu (trigger seed_open_hours)';
  assert (select count(*) from public.gymer_specialties where gymer_id = '11111111-0000-4000-8000-000000000001') = 1,
    'seed: G1 phải có 1 chuyên môn';
  assert (select count(*) from public.gymer_day_overrides where gymer_id = '11111111-0000-4000-8000-000000000001') = 1,
    'seed: G1 phải có 1 ngoại lệ ngày';
  assert (select count(*) from public.gymer_slot_overrides where gymer_id = '11111111-0000-4000-8000-000000000001') = 1,
    'seed: G1 phải có 1 ngoại lệ khung';
end $$;

-- Khách A không sửa được hồ sơ người khác (B) và sửa được hồ sơ của chính mình.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-00000000000a';

do $$
declare n int;
begin
  update public.profiles set display_name = 'hack' where id = 'bbbbbbbb-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'A: update profiles của B tác động dòng';

  update public.profiles set display_name = 'Khach A' where id = 'aaaaaaaa-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  assert n = 1, 'A: không sửa được profiles của chính mình (đối chứng)';
end $$;
reset role;

-- Gymer G2 (người khác) không sửa/xoá được dòng của G1 và không thêm được dòng đứng tên G1.
set local role authenticated;
set local request.jwt.claim.sub = '22222222-0000-4000-8000-000000000002';

do $$
declare n int;
declare caught boolean;
begin
  update public.gymer_profiles set display_name = 'hack' where user_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: update gymer_profiles của G1 tác động dòng';

  update public.gymer_locations set lat = 1 where user_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: update gymer_locations của G1 tác động dòng';

  delete from public.gymer_specialties where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: delete gymer_specialties của G1 tác động dòng';

  delete from public.gymer_open_hours where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: delete gymer_open_hours của G1 tác động dòng';

  update public.gymer_day_overrides set is_open = true where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: update gymer_day_overrides của G1 tác động dòng';

  delete from public.gymer_day_overrides where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: delete gymer_day_overrides của G1 tác động dòng';

  update public.gymer_slot_overrides set is_open = true where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: update gymer_slot_overrides của G1 tác động dòng';

  delete from public.gymer_slot_overrides where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'G2: delete gymer_slot_overrides của G1 tác động dòng';

  -- WITH CHECK: insert với gymer_id/user_id của G1 bị từ chối (42501).
  caught := false;
  begin
    insert into public.gymer_specialties (gymer_id, specialty_name)
    values ('11111111-0000-4000-8000-000000000001', 'yoga');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G2: insert gymer_specialties cho G1 phải bị từ chối';

  caught := false;
  begin
    insert into public.gymer_open_hours (gymer_id, start_time)
    values ('11111111-0000-4000-8000-000000000001', '11:00');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G2: insert gymer_open_hours cho G1 phải bị từ chối';

  caught := false;
  begin
    insert into public.gymer_day_overrides (gymer_id, day, is_open)
    values ('11111111-0000-4000-8000-000000000001', current_date + 11, true);
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G2: insert gymer_day_overrides cho G1 phải bị từ chối';

  caught := false;
  begin
    insert into public.gymer_slot_overrides (gymer_id, day, start_time, is_open)
    values ('11111111-0000-4000-8000-000000000001', current_date + 11, '10:00', true);
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G2: insert gymer_slot_overrides cho G1 phải bị từ chối';

  caught := false;
  begin
    insert into public.gymer_locations (user_id, lat, lng)
    values ('11111111-0000-4000-8000-000000000001', 10.7, 106.7);
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'G2: insert gymer_locations cho G1 phải bị từ chối';
end $$;
reset role;

-- Gymer G1 (chủ) sửa/xoá được dòng của chính mình (đối chứng cho các ca 0 dòng ở trên).
set local role authenticated;
set local request.jwt.claim.sub = '11111111-0000-4000-8000-000000000001';

do $$
declare n int;
begin
  update public.gymer_profiles set bio = bio where user_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không sửa được gymer_profiles của chính mình (đối chứng)';

  update public.gymer_locations set lat = 10.7769 where user_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không sửa được gymer_locations của chính mình (đối chứng)';

  delete from public.gymer_specialties
  where gymer_id = '11111111-0000-4000-8000-000000000001' and specialty_name = 'strength';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không xoá được chuyên môn của chính mình (đối chứng)';

  insert into public.gymer_specialties (gymer_id, specialty_name)
  values ('11111111-0000-4000-8000-000000000001', 'yoga');
  get diagnostics n = row_count;
  assert n = 1, 'G1: không thêm được chuyên môn của chính mình (đối chứng)';

  delete from public.gymer_open_hours
  where gymer_id = '11111111-0000-4000-8000-000000000001' and start_time = '07:00';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không xoá được giờ mở của chính mình (đối chứng)';

  update public.gymer_day_overrides set is_open = true where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không sửa được ngoại lệ ngày của chính mình (đối chứng)';

  delete from public.gymer_day_overrides where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không xoá được ngoại lệ ngày của chính mình (đối chứng)';

  update public.gymer_slot_overrides set is_open = true where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không sửa được ngoại lệ khung của chính mình (đối chứng)';

  delete from public.gymer_slot_overrides where gymer_id = '11111111-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'G1: không xoá được ngoại lệ khung của chính mình (đối chứng)';
end $$;
reset role;

rollback;

\echo 'Ca RLS (10_rls.sql) đạt toàn bộ assert.'
