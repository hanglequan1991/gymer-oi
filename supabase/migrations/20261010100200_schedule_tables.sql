-- M3: lịch của Gymer (giờ mở mẫu, ngoại lệ theo ngày, ngoại lệ theo khung).
-- Giờ (time, date) là GIỜ ĐỊA PHƯƠNG Việt Nam. Chưa có policy RLS (nằm ở migration RLS riêng).
-- Bảng đóng với anon/authenticated cho tới khi có policy.

-- Mẫu giờ mở hằng ngày (giờ chẵn). Gymer có thể đổi sau.
create table if not exists public.gymer_open_hours (
  gymer_id uuid not null references public.gymer_profiles (user_id) on delete cascade,
  start_time time not null
    check (date_part('minute', start_time) = 0 and date_part('second', start_time) = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gymer_id, start_time)
);
alter table public.gymer_open_hours enable row level security;
revoke all on public.gymer_open_hours from anon, authenticated;
create or replace trigger gymer_open_hours_set_updated_at
  before update on public.gymer_open_hours
  for each row execute function private.set_updated_at();

-- Ngoại lệ theo ngày: đóng cả ngày và/hoặc giá riêng cho ngày.
create table if not exists public.gymer_day_overrides (
  gymer_id uuid not null references public.gymer_profiles (user_id) on delete cascade,
  day date not null,
  is_open boolean not null default true,
  price_vnd integer check (price_vnd between 0 and 5000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gymer_id, day)
);
alter table public.gymer_day_overrides enable row level security;
revoke all on public.gymer_day_overrides from anon, authenticated;
create or replace trigger gymer_day_overrides_set_updated_at
  before update on public.gymer_day_overrides
  for each row execute function private.set_updated_at();

-- Ngoại lệ theo khung: đóng một khung hoặc mở thêm một giờ ngoài mẫu.
create table if not exists public.gymer_slot_overrides (
  gymer_id uuid not null references public.gymer_profiles (user_id) on delete cascade,
  day date not null,
  start_time time not null
    check (date_part('minute', start_time) = 0 and date_part('second', start_time) = 0),
  is_open boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gymer_id, day, start_time)
);
alter table public.gymer_slot_overrides enable row level security;
revoke all on public.gymer_slot_overrides from anon, authenticated;
create or replace trigger gymer_slot_overrides_set_updated_at
  before update on public.gymer_slot_overrides
  for each row execute function private.set_updated_at();

-- Gán mẫu giờ mặc định (07, 09, 10, 14, 16, 17, 18, 19) khi tạo hồ sơ Gymer.
-- DEFINER vì: chèn thay chủ sở hữu, người tạo hồ sơ không có quyền ghi bảng này.
create or replace function private.seed_open_hours()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.gymer_open_hours (gymer_id, start_time)
  select new.user_id, h.start_time
  from unnest(array[
    '07:00', '09:00', '10:00', '14:00', '16:00', '17:00', '18:00', '19:00'
  ]::time[]) as h (start_time)
  on conflict do nothing;
  return new;
end $$;

revoke all on function private.seed_open_hours() from public, anon;

create or replace trigger gymer_profiles_seed_open_hours
  after insert on public.gymer_profiles
  for each row execute function private.seed_open_hours();
