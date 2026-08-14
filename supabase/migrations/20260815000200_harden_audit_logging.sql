create or replace function public.record_audit_event(
  target_org uuid,
  target_action text,
  target_entity_type text,
  target_entity_id uuid default null,
  target_request_id text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
begin
  if not public.is_org_member(target_org) then
    raise exception 'Not a member of this organization';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    request_id,
    metadata
  )
  values (
    target_org,
    (select auth.uid()),
    target_action,
    target_entity_type,
    target_entity_id,
    target_request_id,
    coalesce(target_metadata, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke insert, update, delete on public.audit_events from authenticated;
grant execute on function public.record_audit_event(uuid, text, text, uuid, text, jsonb) to authenticated;
