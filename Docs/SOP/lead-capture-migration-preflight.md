# Lead Capture — Migration Preflight Checklist

> Internal engineering reference. This document prepares the database side of the
> lead-capture / hot-lead approval slice. It is a **procedure**, not an action:
> applying migrations is a deliberate, reviewed step performed by a human against
> a named environment. Do **not** apply these migrations to production as a side
> effect of a code change.

Status legend: ✅ already true · ⚠️ requires action · ⛔ do not do.

## Migrations in scope (strict order)

| # | Migration | What it does | Depends on |
| - | --------- | ------------ | ---------- |
| 1 | `20261005000000_workflow_run_approval_state.sql` | Adds `workflow_runs.approval_state` (`none`/`pending`/`approved`/`rejected`) + partial index. Required for the hot-lead gate to persist. | `workflow_runs` exists |
| 2 | `20261006000000_agent_runtime_foundation.sql` | Agent runtime tables. Required **only** if the Operations Assistant is enabled. | org/membership tables |
| 3 | `20261007000000_restrict_workflow_run_transition_and_approval.sql` | Tightens `apply_workflow_run_transition` to owner/admin and adds the `workflow_runs` approval-gate guard trigger. | **#1 must be applied first** (references `approval_state`) |

Also required to already be present in the target database:

- `20260917000011_atomic_workflow_run_transitions.sql` (creates the RPC).
- `20261004000000_grant_service_role_execute_workflow_run_transition.sql` (service-role grant).

## 0. Preconditions (do not skip)

- ⚠️ **Name the target.** Confirm the intended Supabase project ref before doing
  anything. Local reference is `ReplyFlow-AI-Final` (`supabase/config.toml`);
  production is the linked project. If you cannot name it, stop.
- ⚠️ **Back up first.** Take a Supabase snapshot / point-in-time backup, or a
  `pg_dump` of `public.workflow_runs`, `public.workflow_run_events` and the
  membership tables, before applying.
- ⚠️ **Freeze writes** to `workflow_runs` during the window (approvals and
  dispatch) so no transition races the guard-trigger creation.
- ⛔ Never run `supabase db reset` against anything but a disposable local stack.

## 1. Local / staging rehearsal (mandatory)

```powershell
# Local only. Validates the SQL and the dependency order end-to-end.
supabase migration up --local
supabase migration list --local     # confirm local == remote for 20261005/06/07
```

This has been rehearsed: `20261005000000`, `20261006000000` and
`20261007000000` apply cleanly to the local stack, and the local ledger matches.

## 2. Post-migration verification

Structural check (run in the SQL editor / psql on the target):

```sql
select column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'workflow_runs'
   and column_name = 'approval_state';
-- expect exactly one row
```

Authorization boundary check (local/staging, with real JWT sign-ins). The
repository's verification probe asserts all of the following; re-run it against
staging before enabling traffic:

- ⚠️ RPC rejects an ordinary member (`approver role required`).
- ⚠️ RPC allows an owner/admin (returns `applied`).
- ⚠️ RPC rejects a cross-tenant owner.
- ⚠️ RPC rejects an unauthenticated caller.
- ⚠️ RPC trusts `service_role` (the n8n callback + recovery paths).
- ⚠️ The guard trigger rejects a member writing `approval_state` directly.
- ⚠️ The guard trigger allows an owner/admin to change `approval_state`.
- ⚠️ A member can still update non-approval columns (no over-blocking).

## 3. Rollback plan

`20261007000000` is an in-place replace plus one additive trigger. To revert it:

```sql
drop trigger if exists workflow_runs_guard_approval_state on public.workflow_runs;
drop function if exists private.prevent_unauthorized_approval_change();
-- restore the previous member-permissive RPC body only if strictly required
```

`20261005000000` is additive and harmless to leave in place even if the feature
is switched off. Nothing here drops a policy, a grant or a column.

## 4. Post-apply smoke test

- ⚠️ `npm run test:bridge` is green.
- ⚠️ `npm run demo:client-capture` demonstrates capture → qualification → gate.
- ⚠️ One owner/admin can approve a hot lead from the run page and delivery occurs
  exactly once; a duplicate approve is refused.

## 5. Explicitly out of scope

- ⛔ Applying these migrations to production from this change.
- ⛔ Per-tenant intake secrets (still a single shared secret; see
  `lead-capture-production-readiness.md` §4).
- ⛔ Any change to RLS policies or grants beyond the RPC body and the guard
  trigger.
