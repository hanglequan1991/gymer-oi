-- M5: đánh giá Gymer sau buổi đã xong, và trigger cập nhật rating denormalized.
-- Chưa có policy RLS (nằm ở M7). Bảng đóng với anon/authenticated cho tới khi có policy.
-- Ghi đánh giá chỉ qua RPC create_review (M9). Không có sửa/xoá đánh giá từ client (2.6).

-- Đánh giá: mỗi booking một đánh giá.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique,
  gymer_id uuid not null references public.gymer_profiles (user_id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  -- Chụp tên tại thời điểm đánh giá, để không mở profiles cho công chúng.
  author_name text not null check (char_length(author_name) between 1 and 50),
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- gymer_id và author_id phải đúng là hai bên của booking.
  constraint reviews_booking_parties_fkey foreign key (booking_id, gymer_id, author_id)
    references public.bookings (id, gymer_id, customer_id) on delete cascade
);
alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
create index if not exists reviews_gymer_created_idx
  on public.reviews (gymer_id, created_at desc);
create or replace trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function private.set_updated_at();

-- Tính lại rating_avg và rating_count của một Gymer từ bảng reviews.
-- Không có đánh giá thì về 0 (UI hiển thị "chưa có đánh giá").
-- DEFINER vì: cập nhật cột client không được ghi (rating_avg, rating_count).
create or replace function private.recompute_rating(gymer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gymer_profiles gp
  set rating_avg = coalesce(
        (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.gymer_id = gymer), 0),
      rating_count = (select count(*)::int from public.reviews r where r.gymer_id = gymer)
  where gp.user_id = gymer;
end $$;

revoke all on function private.recompute_rating(uuid) from public, anon, authenticated;

-- Trigger sau insert/update/delete trên reviews: gọi recompute cho Gymer liên quan.
-- DEFINER vì: trigger chạy trong phiên người viết đánh giá, phải đi qua recompute_rating để ghi cột rating.
create or replace function private.reviews_sync_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recompute_rating(old.gymer_id);
    return old;
  end if;
  perform private.recompute_rating(new.gymer_id);
  -- Đổi Gymer của đánh giá: tính lại cả Gymer cũ.
  if tg_op = 'UPDATE' and new.gymer_id is distinct from old.gymer_id then
    perform private.recompute_rating(old.gymer_id);
  end if;
  return new;
end $$;

revoke all on function private.reviews_sync_rating() from public, anon, authenticated;

create or replace trigger reviews_sync_rating
  after insert or update or delete on public.reviews
  for each row execute function private.reviews_sync_rating();
