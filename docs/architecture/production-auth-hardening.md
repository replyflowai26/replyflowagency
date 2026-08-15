# Production Authentication Hardening

## Purpose

Provide a production-safe email/password authentication flow for the ReplyFlow AI Company OS using Supabase Auth, Next.js 16 Proxy, and cookie-backed SSR sessions.

## Implemented

- Email/password sign-up and sign-in.
- Email confirmation redirect through `/auth/callback`.
- Password recovery request and secure reset flow.
- Server-side session verification with `auth.getClaims()`.
- Next.js 16 `proxy.ts` session refresh.
- Organization onboarding through the existing `create_organization` RPC.
- Organization-aware dashboard access.
- Owner/admin invitation flow using the Supabase Auth Admin API.
- Invitation membership creation and audit logging.
- Service-role access isolated to a server-only module.
- Generic authentication errors in user-facing UI.

## Required Supabase configuration

1. Enable Email provider and require email confirmation.
2. Configure the production Site URL.
3. Allow these redirect paths for the production origin:
   - `/auth/callback`
   - `/auth/callback?next=/dashboard`
   - `/auth/callback?next=/reset-password`
4. Configure the Confirm signup, Reset password, and Invite user email templates to use the application's callback URL where required by the chosen SSR email-template strategy.
5. Configure `SUPABASE_SERVICE_ROLE_KEY` only in trusted server/worker environments. Never expose it as `NEXT_PUBLIC_*`, return it to the browser, log it, or store it in database records.
6. Configure `NEXT_PUBLIC_SITE_URL` in production for invitation redirects. Local development may fall back to `http://localhost:3000`.

## Authorization model

- `auth.users` is the identity source of truth.
- `profiles` contains application-facing identity data only.
- Organization roles remain in `organization_memberships`.
- Proxy refreshes sessions but does not replace server-side authorization.
- Server Actions verify claims and membership before privileged operations.
- Supabase RLS remains the database authorization boundary.

## Important operational note

The application code does not enable or change Supabase Auth provider settings, email templates, or redirect allow-lists automatically. Those are controlled by the Supabase project configuration and must be verified in the production project before release.
