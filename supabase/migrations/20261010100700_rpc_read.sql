-- M8: RPC đọc cho khách và Gymer (mục 2.3, 2.4, 2.5B; T7).
-- Giờ địa phương VN: day/start_time là giờ VN; mọi đổi qua lại dùng 'Asia/Ho_Chi_Minh' tường minh.
-- Trạng thái khung: mẫu giờ mở + ngoại lệ (đóng cả ngày > khung > mẫu), trừ booking giữ chỗ
-- (confirmed, hoặc pending còn hạn). Booking đã đặt luôn hiển thị là booked.

-- Hàm nội bộ: kiểm Gymer có được xem không (listed, chính Gymer, hoặc khách đã có booking).
-- DEFINER vì: gymer_profiles/bookings có RLS; hàm chỉ trả true/false.
create or replace function private.can_view_gymer(p_gymer uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gymer_profiles gp
    where gp.user_id = p_gymer
      and (
        gp.is_listed
        or gp.user_id = auth.uid()
        or exists (
          select 1 from public.bookings b
          where b.gymer_id = gp.user_id and b.customer_id = auth.uid()
        )
      )
  )
$$;

revoke all on function private.can_view_gymer(uuid) from public, anon, authenticated;

-- Hàm nội bộ: trạng thái từng khung trong [p_from, p_to] (giờ VN).
-- DEFINER vì: lịch (mẫu, ngoại lệ) và booking của Gymer bị RLS chặn với khách; hàm không trả cột nhạy cảm.
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
           when cd.d is not null then false
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

-- Tìm Gymer theo bán kính (km, tối đa 10). Chỉ Gymer is_listed.
-- Haversine trên toạ độ đã làm tròn 3 chữ số (không PostGIS); hộp bao lọc trước.
-- Chỉ trả cột công khai và khoảng cách làm tròn 0.1 km; không trả lat/lng.
-- DEFINER vì: gymer_locations chỉ chủ đọc được (RLS chặn khách); hàm tự kiểm đăng nhập.
create or replace function public.search_gymers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric,
  p_keyword text default null,
  p_specialty text default null,
  p_gender public.gender default null,
  p_min_rating numeric default null,
  p_age_min integer default null,
  p_age_max integer default null,
  p_max_price integer default null
)
returns table (
  user_id uuid,
  display_name text,
  gender public.gender,
  age integer,
  area_label text,
  distance_km numeric,
  rating_avg numeric,
  rating_count integer,
  price_weekday_vnd integer,
  price_weekend_vnd integer,
  tags text[],
  avatar_url text
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_kw text;
  v_year integer := extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'VALIDATION: toa do';
  end if;
  if p_radius_km is null or p_radius_km <= 0 or p_radius_km > 10 then
    raise exception 'VALIDATION: radius';
  end if;
  if p_min_rating is not null and p_min_rating not between 0 and 5 then
    raise exception 'VALIDATION: rating';
  end if;
  if p_max_price is not null and p_max_price < 0 then
    raise exception 'VALIDATION: price';
  end if;

  -- Từ khoá: bỏ dấu cả hai phía, escape ký tự đặc biệt của ILIKE.
  if p_keyword is not null and btrim(p_keyword) <> '' then
    if char_length(p_keyword) > 50 then raise exception 'VALIDATION: keyword'; end if;
    v_kw := '%' || replace(replace(replace(
              extensions.unaccent(btrim(p_keyword)), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select g.user_id,
         g.display_name,
         g.gender,
         (v_year - g.birth_year)::integer,
         g.area_label,
         round(d.km::numeric, 1),
         g.rating_avg,
         g.rating_count,
         g.price_weekday_vnd,
         g.price_weekend_vnd,
         coalesce(
           (select array_agg(gs.specialty_name order by gs.specialty_name)
            from public.gymer_specialties gs where gs.gymer_id = g.user_id),
           '{}'::text[]),
         g.avatar_url
  from public.gymer_profiles g
  join public.gymer_locations l on l.user_id = g.user_id
  cross join lateral (
    select 2 * 6371 * asin(sqrt(least(1::double precision,
             power(sin(radians(l.lat - p_lat) / 2), 2)
             + cos(radians(p_lat)) * cos(radians(l.lat)) * power(sin(radians(l.lng - p_lng) / 2), 2)))) as km
  ) d
  where g.is_listed
    and l.lat between p_lat - p_radius_km / 111.32 and p_lat + p_radius_km / 111.32
    and l.lng between p_lng - p_radius_km / (111.32 * cos(radians(p_lat)))
                  and p_lng + p_radius_km / (111.32 * cos(radians(p_lat)))
    and d.km <= p_radius_km
    and (p_gender is null or g.gender = p_gender)
    and (p_min_rating is null or g.rating_avg >= p_min_rating)
    and (p_max_price is null or g.price_weekday_vnd <= p_max_price)
    and (p_age_min is null or v_year - g.birth_year >= p_age_min)
    and (p_age_max is null or v_year - g.birth_year <= p_age_max)
    and (p_specialty is null or exists (
          select 1 from public.gymer_specialties gs
          where gs.gymer_id = g.user_id and gs.specialty_name = p_specialty))
    and (v_kw is null
         or extensions.unaccent(g.display_name) ilike v_kw
         or exists (
           select 1 from public.gymer_specialties gs
           where gs.gymer_id = g.user_id
             and extensions.unaccent(gs.specialty_name) ilike v_kw))
  order by d.km, g.user_id
  limit 50;
end
$$;

revoke all on function public.search_gymers(double precision, double precision, numeric, text, text, public.gender, numeric, integer, integer, integer) from public, anon;
grant execute on function public.search_gymers(double precision, double precision, numeric, text, text, public.gender, numeric, integer, integer, integer) to authenticated;

-- Khung giờ của một ngày: state = booked | available | closed.
-- booked_by (tên khách) chỉ trả khi người gọi là chính Gymer đó.
-- DEFINER vì: lịch và booking của Gymer bị RLS chặn với khách; hàm tự kiểm quyền xem.
create or replace function public.get_day_slots(p_gymer_id uuid, p_day date)
returns table (
  start_time time,
  state text,
  booked_by text
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_gymer_id is null or p_day is null then raise exception 'VALIDATION: thieu tham so'; end if;
  if not private.can_view_gymer(p_gymer_id) then raise exception 'NOT_FOUND'; end if;

  return query
  select s.start_time,
         (case
            when s.booking_id is not null then 'booked'
            when s.is_open then 'available'
            else 'closed'
          end)::text,
         (case
            when s.booking_id is not null and auth.uid() = p_gymer_id then pr.display_name
            else null
          end)::text
  from private.slot_states(p_gymer_id, p_day, p_day) s
  left join public.profiles pr on pr.id = s.customer_id
  order by s.start_time;
end
$$;

revoke all on function public.get_day_slots(uuid, date) from public, anon;
grant execute on function public.get_day_slots(uuid, date) to authenticated;

-- Lịch tháng: giá ngày (override > T7/CN > ngày thường), ngày có khung mở, ngày có booking.
-- is_open = ngày còn ít nhất một khung mở (chưa tính booking); has_booked = có booking giữ chỗ.
-- DEFINER vì: lịch và booking của Gymer bị RLS chặn với khách; hàm tự kiểm quyền xem.
create or replace function public.get_month_calendar(p_gymer_id uuid, p_year integer, p_month integer)
returns table (
  day date,
  price_vnd integer,
  is_open boolean,
  has_booked boolean
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_first date;
  v_last date;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_gymer_id is null or p_year is null or p_month is null then raise exception 'VALIDATION: thieu tham so'; end if;
  if p_year not between 2000 and 2100 or p_month not between 1 and 12 then
    raise exception 'VALIDATION: thang';
  end if;
  if not private.can_view_gymer(p_gymer_id) then raise exception 'NOT_FOUND'; end if;

  v_first := make_date(p_year, p_month, 1);
  v_last := (v_first + interval '1 month - 1 day')::date;

  return query
  with days as (
    select gs::date as d
    from generate_series(v_first::timestamp, v_last::timestamp, interval '1 day') as gs
  ),
  st as (
    select * from private.slot_states(p_gymer_id, v_first, v_last)
  ),
  day_state as (
    select st.day as d,
           bool_or(st.is_open) as any_open,
           bool_or(st.booking_id is not null) as any_booked
    from st
    group by st.day
  )
  select dd.d,
         coalesce(dov.price_vnd,
                  case when extract(isodow from dd.d) in (6, 7)
                       then gp.price_weekend_vnd
                       else gp.price_weekday_vnd
                  end)::integer,
         coalesce(ds.any_open, false),
         coalesce(ds.any_booked, false)
  from days dd
  join public.gymer_profiles gp on gp.user_id = p_gymer_id
  left join public.gymer_day_overrides dov on dov.gymer_id = p_gymer_id and dov.day = dd.d
  left join day_state ds on ds.d = dd.d
  order by dd.d;
end
$$;

revoke all on function public.get_month_calendar(uuid, integer, integer) from public, anon;
grant execute on function public.get_month_calendar(uuid, integer, integer) to authenticated;
