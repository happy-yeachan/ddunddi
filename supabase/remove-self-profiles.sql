-- 자기소개만 삭제하고 서로 작성한 소개서는 보존한다.
delete from public.profiles where author = subject;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_partner_only') then
    alter table public.profiles add constraint profiles_partner_only check (author <> subject);
  end if;
end $$;
