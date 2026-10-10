-- M4: đặt lịch và ghi chú sức khoẻ của buổi tập.
-- Chưa có policy RLS (nằm ở migration RLS riêng). Bảng đóng với anon/authenticated cho tới khi có policy.
-- Mỗi buổi cố định 60 phút (ends_at = starts_at + 60 phút). Thời gian lưu UTC (timestamptz).

-- Đặt lịch.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  gymer_id uuid not null references public.gymer_profiles (user_id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  goal text check (char_length(goal) <= 200),
  price_vnd integer not null check (price_vnd >= 0),
  status public.booking_status not null default 'pending',
  expires_at timestamptz not null,
  responded_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_duration_60m check (ends_at = starts_at + interval '60 minutes'),
  constraint bookings_not_self check (customer_id <> gymer_id),
  -- Huỷ thì phải có thời điểm huỷ, và ngược lại.
  constraint bookings_cancel_consistent check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint bookings_cancelled_by_consistent check ((cancelled_at is not null) = (cancelled_by is not null)),
  -- Cặp (id, gymer_id, customer_id) để reviews khoá ngoại ghép khớp bên của booking.
  constraint bookings_id_parties_key unique (id, gymer_id, customer_id)
);
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
create index if not exists bookings_customer_starts_idx
  on public.bookings (customer_id, starts_at desc);
create index if not exists bookings_gymer_status_starts_idx
  on public.bookings (gymer_id, status, starts_at);
create or replace trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function private.set_updated_at();

-- Một Gymer không có hai buổi chồng nhau khi buổi còn hiệu lực (pending hoặc confirmed).
-- Thêm bằng DO vì ALTER TABLE ... ADD CONSTRAINT không có IF NOT EXISTS.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_no_overlap'
  ) then
    alter table public.bookings add constraint bookings_no_overlap
      exclude using gist (
        gymer_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
      )
      where (status in ('pending', 'confirmed'));
  end if;
end $$;

-- Ghi chú sức khoẻ của khách cho một buổi. Đọc/ghi qua policy riêng ở migration RLS.
create table if not exists public.booking_health_notes (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.booking_health_notes enable row level security;
revoke all on public.booking_health_notes from anon, authenticated;
create or replace trigger booking_health_notes_set_updated_at
  before update on public.booking_health_notes
  for each row execute function private.set_updated_at();
