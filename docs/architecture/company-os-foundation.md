# Company OS Foundation

## Purpose

Provide the production tenant boundary for ReplyFlow AI before CRM, outreach, integrations, and worker automation are added.

## Tenant model

```text
auth.users
   |
   +--> profiles (1:1 identity data)
   |
   +--> organization_memberships <--> organizations
                                      |
                                      +--> automation_projects
                                             |
                                             +--> workflows
                                      |
                                      +--> integration_connections
                                      |
                                      +--> audit_events
```

A user may belong to multiple organizations. Every tenant-owned record carries `organization_id` and is protected by RLS.

## Roles

- `owner`: full tenant administration, including ownership changes.
- `admin`: tenant administration except granting/revoking ownership.
- `member`: operational create/update access to projects and workflows.
- `viewer`: read-only tenant access.

Platform/operator administration remains outside this tenant role model.

## Security rules

- Browser-accessible tables have RLS enabled.
- Authorization is based on membership, not profile fields or client state.
- Integration records contain provider metadata and optional external secret references only; plaintext credentials/tokens are prohibited.
- Audit events are append-only.
- Membership organization/user identity fields cannot be rewritten.
- An organization cannot be left without an owner.
- Organization creation is transactional and automatically creates the caller as owner.

## Migration workflow

1. Apply migrations in filename order to development.
2. Run schema/type generation and application checks.
3. Test tenant isolation with at least two organizations and all four roles.
4. Promote the same migration set to staging.
5. Promote to production through controlled deployment automation.

Never make a production-only schema change in the Supabase dashboard.
