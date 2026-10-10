-- M2: hồ sơ người dùng, Gymer, chuyên môn, chứng chỉ tự khai.
-- Chưa có policy RLS (nằm ở migration RLS riêng). Bảng đóng với anon/authenticated cho tới khi có policy.

-- Hàm trigger dùng chung: cập nhật updated_at.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

-- Hồ sơ người dùng (1 dòng cho mỗi tài khoản Zalo).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Định danh Zalo. Chỉ service role ghi/đọc.
create table if not exists public.zalo_identities (
  zalo_id text primary key,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.zalo_identities enable row level security;
revoke all on public.zalo_identities from anon, authenticated;
create or replace trigger zalo_identities_set_updated_at
  before update on public.zalo_identities
  for each row execute function private.set_updated_at();

-- Danh mục chuyên môn (dữ liệu tham chiếu).
create table if not exists public.specialties (
  name text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.specialties enable row level security;
revoke all on public.specialties from anon, authenticated;
create or replace trigger specialties_set_updated_at
  before update on public.specialties
  for each row execute function private.set_updated_at();

insert into public.specialties (name) values
  ('Gym'), ('Giảm mỡ'), ('Tăng cơ'), ('Yoga'), ('Calisthenics'), ('Giãn cơ')
on conflict do nothing;

-- Hồ sơ Gymer (1-1 với profiles).
create table if not exists public.gymer_profiles (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 50),
  gender public.gender not null,
  birth_year smallint not null check (birth_year between 1940 and 2100),
  area_label text not null check (char_length(area_label) between 1 and 100),
  bio text check (char_length(bio) <= 1000),
  avatar_url text,
  price_weekday_vnd integer not null check (price_weekday_vnd between 0 and 5000000),
  price_weekend_vnd integer not null check (price_weekend_vnd between 0 and 5000000),
  accepts_requests boolean not null default true,
  is_listed boolean not null default false,
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gymer_profiles enable row level security;
revoke all on public.gymer_profiles from anon, authenticated;
create index if not exists gymer_profiles_listed_idx
  on public.gymer_profiles (user_id) where is_listed;
create or replace trigger gymer_profiles_set_updated_at
  before update on public.gymer_profiles
  for each row execute function private.set_updated_at();

-- Tuổi Gymer tối thiểu 18, tính theo năm hiện tại giờ Việt Nam (Q6).
create or replace function private.check_gymer_age()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_year > extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::int - 18 then
    raise exception 'VALIDATION';
  end if;
  return new;
end $$;

revoke all on function private.check_gymer_age() from public, anon, authenticated;

create or replace trigger gymer_profiles_check_age
  before insert or update on public.gymer_profiles
  for each row execute function private.check_gymer_age();

-- Vị trí Gymer: riêng tư, không lộ ra client (không có policy đọc ở file này).
create table if not exists public.gymer_locations (
  user_id uuid primary key references public.gymer_profiles (user_id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gymer_locations enable row level security;
revoke all on public.gymer_locations from anon, authenticated;
create index if not exists gymer_locations_lat_lng_idx on public.gymer_locations (lat, lng);
create or replace trigger gymer_locations_set_updated_at
  before update on public.gymer_locations
  for each row execute function private.set_updated_at();

-- Làm tròn toạ độ tới 3 chữ số thập phân (~110 m) trước khi lưu.
create or replace function private.round_gymer_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.lat := round(new.lat::numeric, 3)::double precision;
  new.lng := round(new.lng::numeric, 3)::double precision;
  return new;
end $$;

revoke all on function private.round_gymer_location() from public, anon, authenticated;

create or replace trigger gymer_locations_round_coords
  before insert or update on public.gymer_locations
  for each row execute function private.round_gymer_location();

-- Chuyên môn của Gymer (nhiều-nhiều).
create table if not exists public.gymer_specialties (
  gymer_id uuid not null references public.gymer_profiles (user_id) on delete cascade,
  specialty_name text not null references public.specialties (name) on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gymer_id, specialty_name)
);
alter table public.gymer_specialties enable row level security;
revoke all on public.gymer_specialties from anon, authenticated;
create or replace trigger gymer_specialties_set_updated_at
  before update on public.gymer_specialties
  for each row execute function private.set_updated_at();

-- Chứng chỉ TỰ KHAI (không có trạng thái xác minh ở v1, Q8).
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  gymer_id uuid not null references public.gymer_profiles (user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.certificates enable row level security;
revoke all on public.certificates from anon, authenticated;
create index if not exists certificates_gymer_id_idx on public.certificates (gymer_id);
create or replace trigger certificates_set_updated_at
  before update on public.certificates
  for each row execute function private.set_updated_at();

-- Tối đa 10 chứng chỉ mỗi Gymer.
-- DEFINER vì: đếm toàn bộ chứng chỉ của Gymer, không bị RLS lọc theo người gọi.
create or replace function private.limit_certificates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Khoá theo Gymer để hai lần thêm song song không vượt giới hạn.
  perform pg_advisory_xact_lock(hashtextextended(new.gymer_id::text, 0));
  if (select count(*) from public.certificates c where c.gymer_id = new.gymer_id) >= 10 then
    raise exception 'LIMIT_REACHED';
  end if;
  return new;
end $$;

revoke all on function private.limit_certificates() from public, anon, authenticated;

create or replace trigger certificates_limit
  before insert on public.certificates
  for each row execute function private.limit_certificates();
