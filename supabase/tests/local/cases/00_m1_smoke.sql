do $$
begin
  assert (select count(*) from pg_extension where extname in ('btree_gist','unaccent')) = 2, 'thiếu extension';
  assert (select count(*) from pg_namespace where nspname = 'private') = 1, 'thiếu schema private';
  assert (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public' and t.typname in ('gender','booking_status')) = 2, 'thiếu enum';
  assert (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid
          where t.typname = 'booking_status') = array['pending','confirmed','rejected','cancelled','expired'], 'sai nhãn booking_status';
  assert not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated không được dùng schema private';
  assert not has_schema_privilege('anon', 'private', 'usage'), 'anon không được dùng schema private';
  raise notice 'unaccent(Đức Hà) = %', extensions.unaccent('Đức Hà');
end $$;
