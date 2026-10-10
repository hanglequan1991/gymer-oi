-- M1: extension, schema private, enum dùng chung.
-- Không có bảng, không có dữ liệu. Phép thử pipeline nhỏ nhất.

-- Extension nằm ở schema extensions (đã có sẵn trên Supabase).
create extension if not exists btree_gist with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Schema cho hàm nội bộ (trigger, helper). Không cho client truy cập.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Enum giới tính (khớp Gender trong src/types/domain.ts).
do $$
begin
  create type public.gender as enum ('female', 'male');
exception when duplicate_object then
  null;
end $$;

-- Enum trạng thái đặt lịch.
do $$
begin
  create type public.booking_status as enum ('pending', 'confirmed', 'rejected', 'cancelled', 'expired');
exception when duplicate_object then
  null;
end $$;
