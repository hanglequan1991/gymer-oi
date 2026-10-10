-- M6: policy RLS và quyền theo cột cho phía người dùng và Gymer (ma trận mục 2.5).
-- Mỗi bảng: revoke tất cả cho anon/authenticated, rồi grant đúng phần cần. Không grant gì cho anon.
-- Policy cho người có booking (xem hồ sơ khách, Gymer đã huỷ/từ chối) nằm ở M7.
-- Mọi policy dùng (select auth.uid()) để planner cache.

-- profiles: đọc dòng của mình; sửa tên và ảnh của mình. Insert do edge function (service role).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- specialties: danh mục tham chiếu, ai đăng nhập cũng đọc được. Không ghi.
revoke all on public.specialties from anon, authenticated;
grant select on public.specialties to authenticated;

drop policy if exists specialties_select_all on public.specialties;
create policy specialties_select_all on public.specialties
  for select to authenticated
  using (true);

-- gymer_profiles: đọc dòng của mình, hoặc dòng đang is_listed. Insert/update dòng của mình, theo cột.
-- Không có delete ở v1 (tắt bằng is_listed = false). Không grant rating_avg, rating_count, user_id, created_at, updated_at.
revoke all on public.gymer_profiles from anon, authenticated;
grant select on public.gymer_profiles to authenticated;
grant insert (user_id, display_name, gender, birth_year, area_label, bio, avatar_url,
              price_weekday_vnd, price_weekend_vnd, accepts_requests, is_listed)
  on public.gymer_profiles to authenticated;
grant update (display_name, gender, birth_year, area_label, bio, avatar_url,
              price_weekday_vnd, price_weekend_vnd, accepts_requests, is_listed)
  on public.gymer_profiles to authenticated;

drop policy if exists gymer_profiles_select on public.gymer_profiles;
create policy gymer_profiles_select on public.gymer_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or is_listed);

drop policy if exists gymer_profiles_insert_own on public.gymer_profiles;
create policy gymer_profiles_insert_own on public.gymer_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists gymer_profiles_update_own on public.gymer_profiles;
create policy gymer_profiles_update_own on public.gymer_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- gymer_locations: toạ độ riêng tư. Chỉ chủ đọc/ghi dòng của mình; client khác không đọc được.
-- Khách tìm theo bán kính qua RPC search_gymers (M8), không đọc trực tiếp bảng này.
revoke all on public.gymer_locations from anon, authenticated;
grant select on public.gymer_locations to authenticated;
grant insert (user_id, lat, lng), update (lat, lng) on public.gymer_locations to authenticated;

drop policy if exists gymer_locations_select_own on public.gymer_locations;
create policy gymer_locations_select_own on public.gymer_locations
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists gymer_locations_insert_own on public.gymer_locations;
create policy gymer_locations_insert_own on public.gymer_locations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists gymer_locations_update_own on public.gymer_locations;
create policy gymer_locations_update_own on public.gymer_locations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- gymer_specialties: đọc theo quyền đọc gymer_profiles (subquery chạy dưới RLS của gymer_profiles).
-- Chủ thêm/xoá chuyên môn của mình. Không update (khoá chính là cặp cột).
revoke all on public.gymer_specialties from anon, authenticated;
grant select on public.gymer_specialties to authenticated;
grant insert (gymer_id, specialty_name), delete on public.gymer_specialties to authenticated;

drop policy if exists gymer_specialties_select on public.gymer_specialties;
create policy gymer_specialties_select on public.gymer_specialties
  for select to authenticated
  using (exists (
    select 1 from public.gymer_profiles gp
    where gp.user_id = gymer_specialties.gymer_id
  ));

drop policy if exists gymer_specialties_insert_own on public.gymer_specialties;
create policy gymer_specialties_insert_own on public.gymer_specialties
  for insert to authenticated
  with check (gymer_id = (select auth.uid()));

drop policy if exists gymer_specialties_delete_own on public.gymer_specialties;
create policy gymer_specialties_delete_own on public.gymer_specialties
  for delete to authenticated
  using (gymer_id = (select auth.uid()));

-- certificates: TỰ KHAI (Q8). Đọc theo quyền đọc gymer_profiles; chủ thêm/sửa tên/xoá dòng của mình.
-- Giới hạn 10 dòng/Gymer nằm ở trigger (M2).
revoke all on public.certificates from anon, authenticated;
grant select on public.certificates to authenticated;
grant insert (gymer_id, name), update (name), delete on public.certificates to authenticated;

drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates
  for select to authenticated
  using (exists (
    select 1 from public.gymer_profiles gp
    where gp.user_id = certificates.gymer_id
  ));

drop policy if exists certificates_insert_own on public.certificates;
create policy certificates_insert_own on public.certificates
  for insert to authenticated
  with check (gymer_id = (select auth.uid()));

drop policy if exists certificates_update_own on public.certificates;
create policy certificates_update_own on public.certificates
  for update to authenticated
  using (gymer_id = (select auth.uid()))
  with check (gymer_id = (select auth.uid()));

drop policy if exists certificates_delete_own on public.certificates;
create policy certificates_delete_own on public.certificates
  for delete to authenticated
  using (gymer_id = (select auth.uid()));

-- Lịch của Gymer (gymer_open_hours, gymer_day_overrides, gymer_slot_overrides): chỉ chủ đọc và ghi.
-- Khách đọc qua RPC get_day_slots / get_month_calendar (M8).
revoke all on public.gymer_open_hours from anon, authenticated;
grant select on public.gymer_open_hours to authenticated;
grant insert (gymer_id, start_time), delete on public.gymer_open_hours to authenticated;

drop policy if exists gymer_open_hours_select_own on public.gymer_open_hours;
create policy gymer_open_hours_select_own on public.gymer_open_hours
  for select to authenticated
  using (gymer_id = (select auth.uid()));

drop policy if exists gymer_open_hours_insert_own on public.gymer_open_hours;
create policy gymer_open_hours_insert_own on public.gymer_open_hours
  for insert to authenticated
  with check (gymer_id = (select auth.uid()));

drop policy if exists gymer_open_hours_delete_own on public.gymer_open_hours;
create policy gymer_open_hours_delete_own on public.gymer_open_hours
  for delete to authenticated
  using (gymer_id = (select auth.uid()));

revoke all on public.gymer_day_overrides from anon, authenticated;
grant select on public.gymer_day_overrides to authenticated;
grant insert (gymer_id, day, is_open, price_vnd), update (is_open, price_vnd), delete
  on public.gymer_day_overrides to authenticated;

drop policy if exists gymer_day_overrides_select_own on public.gymer_day_overrides;
create policy gymer_day_overrides_select_own on public.gymer_day_overrides
  for select to authenticated
  using (gymer_id = (select auth.uid()));

drop policy if exists gymer_day_overrides_insert_own on public.gymer_day_overrides;
create policy gymer_day_overrides_insert_own on public.gymer_day_overrides
  for insert to authenticated
  with check (gymer_id = (select auth.uid()));

drop policy if exists gymer_day_overrides_update_own on public.gymer_day_overrides;
create policy gymer_day_overrides_update_own on public.gymer_day_overrides
  for update to authenticated
  using (gymer_id = (select auth.uid()))
  with check (gymer_id = (select auth.uid()));

drop policy if exists gymer_day_overrides_delete_own on public.gymer_day_overrides;
create policy gymer_day_overrides_delete_own on public.gymer_day_overrides
  for delete to authenticated
  using (gymer_id = (select auth.uid()));

revoke all on public.gymer_slot_overrides from anon, authenticated;
grant select on public.gymer_slot_overrides to authenticated;
grant insert (gymer_id, day, start_time, is_open), update (is_open), delete
  on public.gymer_slot_overrides to authenticated;

drop policy if exists gymer_slot_overrides_select_own on public.gymer_slot_overrides;
create policy gymer_slot_overrides_select_own on public.gymer_slot_overrides
  for select to authenticated
  using (gymer_id = (select auth.uid()));

drop policy if exists gymer_slot_overrides_insert_own on public.gymer_slot_overrides;
create policy gymer_slot_overrides_insert_own on public.gymer_slot_overrides
  for insert to authenticated
  with check (gymer_id = (select auth.uid()));

drop policy if exists gymer_slot_overrides_update_own on public.gymer_slot_overrides;
create policy gymer_slot_overrides_update_own on public.gymer_slot_overrides
  for update to authenticated
  using (gymer_id = (select auth.uid()))
  with check (gymer_id = (select auth.uid()));

drop policy if exists gymer_slot_overrides_delete_own on public.gymer_slot_overrides;
create policy gymer_slot_overrides_delete_own on public.gymer_slot_overrides
  for delete to authenticated
  using (gymer_id = (select auth.uid()));
