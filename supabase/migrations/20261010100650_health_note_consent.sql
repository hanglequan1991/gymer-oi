-- M7b (N2, mục 2.5A): khách đồng ý cho Gymer của booking đọc ghi chú sức khoẻ.
-- Thêm cột shared_with_gymer (mặc định false = không chia sẻ) và thay policy booking_health_notes_select.
-- Không sửa M4 (tạo bảng) và M7 (policy cũ); không xoá cột, không xoá dữ liệu.
-- Idempotent: chạy lại an toàn.
-- Ghi cờ chỉ qua create_booking (M9, SECURITY DEFINER); client không có quyền ghi (M7).

alter table public.booking_health_notes
  add column if not exists shared_with_gymer boolean not null default false;

comment on column public.booking_health_notes.shared_with_gymer is
  'N2: khách tick đồng ý cho Gymer của booking đọc ghi chú. Mặc định false. Chỉ create_booking đặt cờ này.';

-- Khách của booking luôn đọc được ghi chú của mình.
-- Gymer của booking chỉ đọc khi: (1) khách đã tick đồng ý; (2) booking confirmed, hoặc pending còn hạn expires_at;
-- (3) chưa quá ends_at + 1 ngày. Rejected, cancelled, expired: không đọc.
drop policy if exists booking_health_notes_select on public.booking_health_notes;
create policy booking_health_notes_select on public.booking_health_notes
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_health_notes.booking_id
      and (
        b.customer_id = (select auth.uid())
        or (
          booking_health_notes.shared_with_gymer
          and b.gymer_id = (select auth.uid())
          and now() <= b.ends_at + interval '1 day'
          and (b.status = 'confirmed' or (b.status = 'pending' and b.expires_at > now()))
        )
      )
  ));
