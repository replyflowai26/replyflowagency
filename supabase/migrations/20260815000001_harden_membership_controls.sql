-- Membership hardening:
-- admins may manage members/viewers, but only owners may grant/revoke ownership.
-- an organization can never be left without an owner.

create or replace function private.prevent_last_owner_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_count integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      select count(*) into owner_count
      from public.organization_memberships
      where organization_id = old.organization_id
        and role = 'owner'
        and user_id <> old.user_id;

      if owner_count = 0 then
        raise exception 'organization must retain at least one owner' using errcode = '42501';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'owner' and new.role <> 'owner' then
    select count(*) into owner_count
    from public.organization_memberships
    where organization_id = old.organization_id
      and role = 'owner'
      and user_id <> old.user_id;

    if owner_count = 0 then
      raise exception 'organization must retain at least one owner' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_prevent_last_owner_loss on public.organization_memberships;
create trigger memberships_prevent_last_owner_loss
before update or delete on public.organization_memberships
for each row execute function private.prevent_last_owner_loss();

-- Rebuild membership policies so admins cannot self-elevate or grant ownership.
drop policy if exists memberships_insert_admin on public.organization_memberships;
create policy memberships_insert_admin
on public.organization_memberships for insert to authenticated
with check (
  (select private.has_org_role(organization_id, (select auth.uid()), array['owner']))
  or (
    role <> 'owner'
    and (select private.has_org_role(organization_id, (select auth.uid()), array['admin']))
  )
);

drop policy if exists memberships_update_admin on public.organization_memberships;
create policy memberships_update_admin
on public.organization_memberships for update to authenticated
using (
  (select private.has_org_role(organization_id, (select auth.uid()), array['owner']))
  or (
    (select private.has_org_role(organization_id, (select auth.uid()), array['admin']))
    and role <> 'owner'
  )
)
with check (
  (select private.has_org_role(organization_id, (select auth.uid()), array['owner']))
  or (
    (select private.has_org_role(organization_id, (select auth.uid()), array['admin']))
    and role <> 'owner'
  )
);

drop policy if exists memberships_delete_admin on public.organization_memberships;
create policy memberships_delete_admin
on public.organization_memberships for delete to authenticated
using (
  (select private.has_org_role(organization_id, (select auth.uid()), array['owner']))
  or (
    role <> 'owner'
    and (select private.has_org_role(organization_id, (select auth.uid()), array['admin']))
  )
);
