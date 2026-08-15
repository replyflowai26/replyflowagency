-- Harden auth.users bootstrap so a non-critical profile write can never
-- block Supabase from creating the actual authentication account.
-- The profile is only enrichment; workspace creation/onboarding is the source
-- of truth for the business account.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  begin
    insert into public.profiles (id, display_name, avatar_url)
    values (
      new.id,
      nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
      nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
    )
    on conflict (id) do update
      set display_name = coalesce(excluded.display_name, public.profiles.display_name),
          avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  exception when others then
    -- Never roll back auth.users because profile enrichment failed.
    -- Supabase logs this warning so the underlying database issue remains visible.
    raise warning 'ReplyFlow profile bootstrap failed for auth user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
