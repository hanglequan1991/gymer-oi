-- M9: luồng đặt lịch và đánh giá (mục 2.4, 2.4A, 2.5, 2.5A, 2.5B, 2.6; T8).
-- Ghi bảng bookings, booking_health_notes, reviews chỉ qua hàm này (client không có quyền ghi, M7).
-- Giờ: starts_at là timestamptz (UTC); khung là giờ tròn theo giờ Việt Nam; mọi đổi qua lại dùng 'Asia/Ho_Chi_Minh' tường minh.
-- Lock theo Gymer: pg_advisory_xact_lock(hashtextextended(gymer_id::text, 0)); trigger cuối file dùng cùng khoá.
-- Lock theo khách: pg_advisory_xact_lock(hashtextextended('cust:' || customer_id::text, 0)), chỉ create_booking lấy.
-- Thứ tự khoá trong create_booking: khách TRƯỚC, Gymer SAU. Trigger chỉ lấy khoá Gymer, không bao giờ giữ khoá khách,
-- nên không có chu trình và không deadlock.
-- Idempotent: chạy lại an toàn.

-- Trigger: không đóng ngày/khung đã có booking đang giữ chỗ (pending còn hạn hoặc confirmed).
-- DEFINER vì: booking của khách bị RLS chặn với Gymer; trigger cần đọc để chặn đóng khung.
create or replace function private.guard_day_override_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_open then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.gymer_id::text, 0));
  if exists (
    select 1 from public.bookings b
    where b.gymer_id = new.gymer_id
      and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now()))
      and (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = new.day
  ) then
    raise exception 'SLOT_HAS_BOOKING';
  end if;
  return new;
end $$;

revoke all on function private.guard_day_override_booked() from public, anon, authenticated;

create or replace trigger gymer_day_overrides_guard_booked
  before insert or update on public.gymer_day_overrides
  for each row execute function private.guard_day_override_booked();

-- Trigger: không đóng khung đã có booking đang giữ chỗ.
-- DEFINER vì: lý do như trên (đọc booking dưới RLS của khách).
create or replace function private.guard_slot_override_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_open then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.gymer_id::text, 0));
  if exists (
    select 1 from public.bookings b
    where b.gymer_id = new.gymer_id
      and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now()))
      and b.starts_at = (new.day + new.start_time) at time zone 'Asia/Ho_Chi_Minh'
  ) then
    raise exception 'SLOT_HAS_BOOKING';
  end if;
  return new;
end $$;

revoke all on function private.guard_slot_override_booked() from public, anon, authenticated;

create or replace trigger gymer_slot_overrides_guard_booked
  before insert or update on public.gymer_slot_overrides
  for each row execute function private.guard_slot_override_booked();

-- Khách đặt một khung. Ghi chú sức khoẻ (nếu có) và cờ đồng ý chia sẻ (N2) được ghi cùng giao dịch.
-- DEFINER vì: chèn bookings và booking_health_notes (client không có quyền ghi); đọc lịch và giá bị RLS chặn.
create or replace function public.create_booking(
  p_gymer_id uuid,
  p_starts_at timestamptz,
  p_goal text,
  p_health_note text,
  p_expected_price integer,
  p_share_health_note boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_local timestamp;
  v_day date;
  v_time time;
  v_listed boolean;
  v_accepts boolean;
  v_open boolean;
  v_taken uuid;
  v_pending integer;
  v_price integer;
  v_goal text := nullif(btrim(p_goal), '');
  v_note text := nullif(btrim(p_health_note), '');
  v_share boolean := coalesce(p_share_health_note, false);
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;
  -- Tài khoản đã đăng nhập nhưng chưa có hàng profiles (luồng đăng nhập lỗi): FORBIDDEN thay vì lỗi FK 23503 thô.
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'FORBIDDEN';
  end if;
  if p_gymer_id is null or p_starts_at is null or p_expected_price is null then
    raise exception 'VALIDATION';
  end if;
  if p_gymer_id = v_uid then
    raise exception 'FORBIDDEN';
  end if;
  if v_goal is not null and char_length(v_goal) > 200 then
    raise exception 'VALIDATION';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'VALIDATION';
  end if;
  -- Tick đồng ý mà không có ghi chú là vô nghĩa: từ chối.
  if v_note is null and v_share then
    raise exception 'VALIDATION';
  end if;

  -- Thời điểm: sau hiện tại ít nhất 2 giờ, tối đa 60 ngày, đúng giờ tròn theo giờ VN.
  if p_starts_at < now() + interval '2 hours' or p_starts_at > now() + interval '60 days' then
    raise exception 'VALIDATION';
  end if;
  v_local := p_starts_at at time zone 'Asia/Ho_Chi_Minh';
  if extract(minute from v_local) <> 0 or extract(second from v_local) <> 0 then
    raise exception 'VALIDATION';
  end if;
  v_day := v_local::date;
  v_time := v_local::time;

  -- Gymer phải đang hiển thị và nhận yêu cầu. Ẩn Gymer trả NOT_FOUND để không lộ hồ sơ ẩn.
  select gp.is_listed, gp.accepts_requests
    into v_listed, v_accepts
  from public.gymer_profiles gp
  where gp.user_id = p_gymer_id;
  if not found or not v_listed then
    raise exception 'NOT_FOUND';
  end if;
  if not v_accepts then
    raise exception 'FORBIDDEN';
  end if;

  -- Khoá khách trước, khoá Gymer sau (thứ tự cố định). Không có khoá này, hai lời gọi của cùng khách
  -- tới hai Gymer khác nhau không loại trừ nhau, cùng đếm thấy 2 pending rồi cùng chèn: vượt giới hạn 3.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cust:' || v_uid::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_gymer_id::text, 0));

  -- Dọn các pending quá hạn chồng lên khung này (lười, không cron) để khung được coi là trống.
  update public.bookings b
  set status = 'expired'
  where b.gymer_id = p_gymer_id
    and b.status = 'pending'
    and b.expires_at <= now()
    and b.starts_at < p_starts_at + interval '60 minutes'
    and b.ends_at > p_starts_at;

  -- Khung đã có người giữ chỗ, hoặc khung đóng/ngoài mẫu.
  select s.is_open, s.booking_id
    into v_open, v_taken
  from private.slot_states(p_gymer_id, v_day, v_day) s
  where s.start_time = v_time;
  if v_taken is not null then
    raise exception 'SLOT_TAKEN';
  end if;
  if not coalesce(v_open, false) then
    raise exception 'SLOT_NOT_OPEN';
  end if;

  -- Khách không giữ quá 3 yêu cầu đang chờ cùng lúc.
  select count(*)::integer
    into v_pending
  from public.bookings b
  where b.customer_id = v_uid
    and b.status = 'pending'
    and b.expires_at > now();
  if v_pending >= 3 then
    raise exception 'LIMIT_REACHED';
  end if;

  -- Giá tính ở server: override ngày > cuối tuần (T7/CN, theo ngày VN) > ngày thường.
  select case
           when dov.price_vnd is not null then dov.price_vnd
           when extract(isodow from v_day) in (6, 7) then gp.price_weekend_vnd
           else gp.price_weekday_vnd
         end
    into v_price
  from public.gymer_profiles gp
  left join public.gymer_day_overrides dov
    on dov.gymer_id = gp.user_id and dov.day = v_day
  where gp.user_id = p_gymer_id;
  if v_price <> p_expected_price then
    raise exception 'PRICE_CHANGED';
  end if;

  begin
    insert into public.bookings (
      gymer_id, customer_id, starts_at, ends_at, goal, price_vnd, expires_at
    ) values (
      p_gymer_id,
      v_uid,
      p_starts_at,
      p_starts_at + interval '60 minutes',
      v_goal,
      v_price,
      least(now() + interval '24 hours', p_starts_at)
    )
    returning id into v_booking_id;
  exception when exclusion_violation then
    -- Chốt cuối: ràng buộc loại trừ bắt đặt trùng nếu hai yêu cầu chạy sát nhau.
    raise exception 'SLOT_TAKEN';
  end;

  if v_note is not null then
    insert into public.booking_health_notes (booking_id, note, shared_with_gymer)
    values (v_booking_id, v_note, v_share);
  end if;

  return v_booking_id;
end $$;

revoke all on function public.create_booking(uuid, timestamptz, text, text, integer, boolean) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz, text, text, integer, boolean) to authenticated;

-- Gymer xác nhận hoặc từ chối một yêu cầu đang chờ còn hạn.
-- Yêu cầu quá hạn không chuyển sang expired ở đây: lỗi làm mất thay đổi, nên để trạng thái pending
-- và các RPC đọc coi là hết hạn (create_booking sẽ dọn sau). Hết hạn gồm status='expired'
-- hoặc (status='pending' và expires_at <= now()); cả hai đều trả BOOKING_EXPIRED.
-- DEFINER vì: ghi bookings (client không có quyền ghi); hàm tự kiểm người gọi là Gymer của booking.
create or replace function public.respond_booking(p_booking_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_b public.bookings;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;
  if p_decision is null or p_decision not in ('confirmed', 'rejected') then
    raise exception 'VALIDATION';
  end if;

  select b.* into v_b
  from public.bookings b
  where b.id = p_booking_id
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_b.gymer_id <> v_uid then
    raise exception 'FORBIDDEN';
  end if;
  -- Kiểm hết hạn trước kiểm trạng thái: cùng một tình huống "yêu cầu đã hết hạn" luôn trả BOOKING_EXPIRED,
  -- dù lười đã chuyển sang expired hay chưa.
  if v_b.status = 'expired' or (v_b.status = 'pending' and v_b.expires_at <= now()) then
    raise exception 'BOOKING_EXPIRED';
  end if;
  if v_b.status <> 'pending' then
    raise exception 'FORBIDDEN';
  end if;

  update public.bookings b
  set status = p_decision::public.booking_status,
      responded_at = now()
  where b.id = p_booking_id;
end $$;

revoke all on function public.respond_booking(uuid, text) from public, anon;
grant execute on function public.respond_booking(uuid, text) to authenticated;

-- Huỷ lịch, một quy tắc cho khách và Gymer (mục 2.4A): chỉ khi pending hoặc confirmed và starts_at > now().
-- DEFINER vì: ghi bookings (client không có quyền ghi); hàm tự kiểm người gọi là một bên của booking.
create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_b public.bookings;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;

  select b.* into v_b
  from public.bookings b
  where b.id = p_booking_id
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_uid not in (v_b.customer_id, v_b.gymer_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_b.status not in ('pending', 'confirmed') then
    raise exception 'FORBIDDEN';
  end if;
  -- Pending quá hạn nhưng chưa bị lười quét vẫn là expired về nghiệp vụ: từ chối như expired.
  if v_b.status = 'pending' and v_b.expires_at <= now() then
    raise exception 'FORBIDDEN';
  end if;
  if v_b.starts_at <= now() then
    raise exception 'ALREADY_STARTED';
  end if;

  update public.bookings b
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid
  where b.id = p_booking_id;
end $$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- Khách đánh giá sau buổi đã xong (confirmed và ends_at < now()); mỗi booking một đánh giá (mục 2.6).
-- DEFINER vì: ghi reviews (client không có quyền ghi); chụp author_name từ profiles.
create or replace function public.create_review(p_booking_id uuid, p_rating integer, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_b public.bookings;
  v_name text;
  v_body text := nullif(btrim(p_body), '');
  v_review_id uuid;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;

  select b.* into v_b
  from public.bookings b
  where b.id = p_booking_id
  for share;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_b.customer_id <> v_uid then
    raise exception 'FORBIDDEN';
  end if;
  if v_b.status <> 'confirmed' or v_b.ends_at >= now() then
    raise exception 'FORBIDDEN';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'VALIDATION';
  end if;
  if v_body is not null and char_length(v_body) > 500 then
    raise exception 'VALIDATION';
  end if;

  select p.display_name into v_name
  from public.profiles p
  where p.id = v_uid;

  begin
    insert into public.reviews (booking_id, gymer_id, author_id, author_name, rating, body)
    values (p_booking_id, v_b.gymer_id, v_uid, v_name, p_rating::smallint, v_body)
    returning id into v_review_id;
  exception when unique_violation then
    -- Booking này đã có đánh giá.
    raise exception 'FORBIDDEN';
  end;

  return v_review_id;
end $$;

revoke all on function public.create_review(uuid, integer, text) from public, anon;
grant execute on function public.create_review(uuid, integer, text) to authenticated;
