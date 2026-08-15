-- Membership rows are tenant authorization records.
-- Their organization and user identity must never be rewritten in-place.

create or replace function private.prevent_membership_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'membership organization_id and user_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_prevent_identity_change on public.organization_memberships;
create trigger memberships_prevent_identity_change
before update on public.organization_memberships
for each row execute function private.prevent_membership_identity_change();
