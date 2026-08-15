-- Fix the auth.users trigger so account creation cannot fail because of
-- function/search-path resolution inside the profile bootstrap function.
-- This function must remain SECURITY DEFINER because auth.users is managed by Supabase.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

-- Keep the trigger deterministic and idempotent.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
