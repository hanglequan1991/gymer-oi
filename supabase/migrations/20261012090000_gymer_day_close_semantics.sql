-- M10 (Gymer điều khiển ngày, plan gymer-schedule-day-control B1): ngữ nghĩa ngày đóng.
-- Nghĩa mới: ngày đóng = mọi khung mặc định đóng, trừ khung có gymer_slot_overrides.is_open = true (Gymer mở riêng).
-- Chỉ thay thân hàm nội bộ và thêm một trigger. Không đổi chữ ký RPC công khai, bảng, cột; không drop gì.
-- Thứ tự: dọn dữ liệu cũ trước, rồi mới thay hàm. Dọn không ảnh hưởng dòng nào ngoài khung mở trên ngày đã đóng.
-- Idempotent: create or replace (hàm, trigger). Lệnh dọn ở (4) KHÔNG idempotent: chạy đúng một lần qua job migrate;
-- chạy lại sau khi Gymer đã mở khung riêng hợp lệ trên ngày đóng sẽ xoá các khung đó, và việc xoá không hoàn tác được.

-- (4) Dọn một lần dữ liệu cũ: theo nghĩa cũ, ngày đóng ép mọi khung đóng nên khung mở trên ngày đó không có tác dụng.
-- Xoá các khung mở đó để nghĩa mới không làm ngày cũ tự mở lại.
delete from public.gymer_slot_overrides s
using public.gymer_day_overrides d
where d.gymer_id = s.gymer_id
  and d.day = s.day
  and d.is_open = false
  and s.is_open = true;

-- (1) Lịch, khung giờ và create_booking (SLOT_NOT_OPEN) cùng đọc hàm này.

create or replace function private.slot_states(p_gymer uuid, p_from date, p_to date)
returns table (
  day date,
  start_time time,
  is_open boolean,
  booking_id uuid,
  customer_id uuid
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_from_ts timestamptz := (p_from::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  v_to_ts timestamptz := ((p_to + 1)::timestamp) at time zone 'Asia/Ho_Chi_Minh';
begin
  return query
  with days as (
    select gs::date as d
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as gs
  ),
  tpl as (
    select dd.d, oh.start_time as st
    from days dd
    cross join public.gymer_open_hours oh
    where oh.gymer_id = p_gymer
  ),
  so as (
    select s.day as d, s.start_time as st, s.is_open as op
    from public.gymer_slot_overrides s
    where s.gymer_id = p_gymer and s.day between p_from and p_to
  ),
  bk as (
    select (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
           (b.starts_at at time zone 'Asia/Ho_Chi_Minh')::time as st,
           b.id as bid,
           b.customer_id as cid
    from public.bookings b
    where b.gymer_id = p_gymer
      and b.starts_at >= v_from_ts and b.starts_at < v_to_ts
      and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now()))
  ),
  keys as (
    select t.d, t.st from tpl t
    union select s.d, s.st from so s
    union select k.d, k.st from bk k
  ),
  closed_days as (
    select dov.day as d
    from public.gymer_day_overrides dov
    where dov.gymer_id = p_gymer and dov.is_open = false
      and dov.day between p_from and p_to
  )
  select k.d,
         k.st,
         case
           when cd.d is not null then coalesce(so.op, false)
           else coalesce(so.op, (tpl.st is not null))
         end,
         bk.bid,
         bk.cid
  from keys k
  left join tpl on tpl.d = k.d and tpl.st = k.st
  left join so on so.d = k.d and so.st = k.st
  left join bk on bk.d = k.d and bk.st = k.st
  left join closed_days cd on cd.d = k.d
  order by k.d, k.st;
end
$$;

revoke all on function private.slot_states(uuid, date, date) from public, anon, authenticated;

-- (2) Ngày đã đóng sẵn thì sửa giá không bị chặn dù có khung mở riêng đã được đặt.
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
  if tg_op = 'UPDATE' and old.is_open = false then
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

-- (3) Đóng cả ngày thì bỏ các khung đã mở riêng của ngày đó, kể cả giờ ngoài mẫu. Đóng nguyên tử trong cùng lệnh ghi.
-- Chỉ chạy khi ngày chuyển từ mở sang đóng (hoặc chèn mới đóng), nên sửa giá ngày đã đóng không xoá khung.
-- DEFINER vì: xoá gymer_slot_overrides dưới quyền chủ hệ thống, không phụ thuộc RLS của phiên ghi.
create or replace function private.clear_open_slots_on_day_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_open = false and (tg_op = 'INSERT' or old.is_open = true) then
    delete from public.gymer_slot_overrides
    where gymer_id = new.gymer_id
      and day = new.day
      and is_open = true;
  end if;
  return new;
end $$;

revoke all on function private.clear_open_slots_on_day_close() from public, anon, authenticated;

create or replace trigger gymer_day_overrides_clear_open_slots
  after insert or update on public.gymer_day_overrides
  for each row execute function private.clear_open_slots_on_day_close();
