-- M7: policy RLS cho đặt lịch, ghi chú sức khoẻ, đánh giá (mục 2.4A, 2.5, 2.6).
-- bookings, booking_health_notes, reviews: chỉ SELECT cho authenticated. Ghi qua RPC (M8/M9), không ghi trực tiếp.
-- Bổ sung policy SELECT cho profiles và gymer_profiles để hai bên của booking đọc được hồ sơ nhau.
-- Không policy và không grant nào cho anon.

-- Chặn tường minh, không dựa vào mặc định của Supabase.
revoke all on public.bookings, public.booking_health_notes, public.reviews from anon, authenticated;
grant select on public.bookings, public.booking_health_notes, public.reviews to authenticated;

-- bookings: khách của booking hoặc Gymer của booking đọc được, mọi trạng thái (huỷ/từ chối vẫn là lịch sử).
drop policy if exists bookings_select_party on public.bookings;
create policy bookings_select_party on public.bookings
  for select to authenticated
  using (customer_id = (select auth.uid()) or gymer_id = (select auth.uid()));

-- Ghi chú sức khoẻ: khách của booking luôn đọc được; Gymer chỉ khi booking còn pending (chưa quá expires_at) hoặc confirmed.
-- Từ chối, huỷ (kể cả Gymer tự huỷ) làm Gymer mất quyền đọc (mục 2.4A).
-- Pending đã quá expires_at nhưng chưa được chuyển expired (không có cron) vẫn bị chặn ở đây.
-- Confirmed không áp expires_at: booking đã xác nhận có expires_at nằm trong quá khứ.
drop policy if exists booking_health_notes_select on public.booking_health_notes;
create policy booking_health_notes_select on public.booking_health_notes
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_health_notes.booking_id
      and (b.customer_id = (select auth.uid())
           or (b.gymer_id = (select auth.uid())
               and ((b.status = 'pending' and b.expires_at > now()) or b.status = 'confirmed')))
  ));

-- Đánh giá: ai đọc được hồ sơ Gymer thì đọc được đánh giá của Gymer đó; tác giả luôn đọc được đánh giá của mình.
-- Subquery chạy dưới RLS của gymer_profiles nên áp đúng điều kiện đọc hồ sơ.
drop policy if exists reviews_select_visible on public.reviews;
create policy reviews_select_visible on public.reviews
  for select to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.gymer_profiles gp where gp.user_id = reviews.gymer_id)
  );

-- profiles: Gymer đọc hồ sơ khách có booking gửi cho mình (mọi trạng thái).
drop policy if exists profiles_select_gymer_customer on public.profiles;
create policy profiles_select_gymer_customer on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.customer_id = profiles.id and b.gymer_id = (select auth.uid())
  ));

-- gymer_profiles: khách đọc Gymer mình có booking, kể cả khi is_listed = false (mọi trạng thái).
drop policy if exists gymer_profiles_select_booked on public.gymer_profiles;
create policy gymer_profiles_select_booked on public.gymer_profiles
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.gymer_id = gymer_profiles.user_id and b.customer_id = (select auth.uid())
  ));
