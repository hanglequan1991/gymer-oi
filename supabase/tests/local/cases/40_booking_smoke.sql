-- Smoke test M9 (T8): chỉ kiểm hàm và trigger tồn tại, quyền đúng, và một lời gọi chạy được.
-- Nghiệp vụ đầy đủ thuộc T9 (20_booking.sql), không viết ở đây.

-- Catalog: bốn RPC là SECURITY DEFINER, search_path rỗng, anon không có EXECUTE, authenticated có.
do $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select p.oid, p.proname, p.prosecdef,
           coalesce(array_to_string(p.proconfig, ','), '') as cfg
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_booking', 'respond_booking', 'cancel_booking', 'create_review')
  loop
    v_count := v_count + 1;
    if not r.prosecdef then
      raise exception 'smoke 40: % không phải SECURITY DEFINER', r.proname;
    end if;
    if r.cfg not like '%search_path=""%' then
      raise exception 'smoke 40: % thiếu set search_path = '''' (cấu hình: %)', r.proname, r.cfg;
    end if;
    if has_function_privilege('anon', r.oid, 'EXECUTE') then
      raise exception 'smoke 40: % cho anon EXECUTE', r.proname;
    end if;
    if not has_function_privilege('authenticated', r.oid, 'EXECUTE') then
      raise exception 'smoke 40: % thiếu EXECUTE cho authenticated', r.proname;
    end if;
  end loop;
  if v_count <> 4 then
    raise exception 'smoke 40: kỳ vọng 4 hàm RPC, thấy %', v_count;
  end if;
  raise notice 'smoke 40: catalog RPC OK';
end $$;

-- Trigger chặn đóng ngày/khung đã có booking tồn tại.
do $$
begin
  if not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                 where c.relname = 'gymer_day_overrides' and t.tgname = 'gymer_day_overrides_guard_booked' and not t.tgisinternal) then
    raise exception 'smoke 40: thiếu trigger gymer_day_overrides_guard_booked';
  end if;
  if not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                 where c.relname = 'gymer_slot_overrides' and t.tgname = 'gymer_slot_overrides_guard_booked' and not t.tgisinternal) then
    raise exception 'smoke 40: thiếu trigger gymer_slot_overrides_guard_booked';
  end if;
  raise notice 'smoke 40: trigger OK';
end $$;

-- Lời gọi chạy được: chưa đăng nhập (auth.uid() rỗng) thì create_booking ném FORBIDDEN.
do $$
declare
  v_msg text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.create_booking(gen_random_uuid(), now() + interval '3 days', null, null, 100000, false);
    v_msg := 'KHONG_BAO_LOI';
  exception when others then
    v_msg := sqlerrm;
  end;
  reset role;
  if v_msg is distinct from 'FORBIDDEN' then
    raise exception 'smoke 40: create_booking khi chưa đăng nhập: kỳ vọng FORBIDDEN, thấy %', v_msg;
  end if;
  raise notice 'smoke 40: create_booking chưa đăng nhập -> FORBIDDEN OK';
end $$;
