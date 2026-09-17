# ReplyFlow AI Website
Production-oriented marketing website foundation.

## Run (against the LOCAL Supabase + n8n stack)

`npm install`

`npm run dev:local` — boots the app on http://127.0.0.1:3000 wired to the local
stack defined in `.env.e2e.local` (git-ignored). Use `npm run dev:local:3001`
for a second local instance.

> Do NOT use plain `npm run dev` for local sign-in work: it loads `.env.local`,
> which points at the hosted Supabase project, so browser login fails with
> "Unable to sign in right now."

## Local login troubleshooting

If login fails against the local stack with the generic
"Unable to sign in right now. Please check your account details and try again."
message, the usual causes, in order:

1. **Local stack is not running** — run `supabase start` (the `dev:local`
   launcher checks this and warns before booting).
2. **Broken local auth schema** — a local volume created by an older CLI then run
   against a newer GoTrue image can leave `auth.users` token columns NULL, which
   GoTrue cannot scan ("converting NULL to string is unsupported"). This breaks
   every sign-in. Repair it (non-destructive) once:
   `npm run local:repair`
   Then restart the app.
3. **Wrong credentials** — a test account can be created and verified with:
   `node scripts/run-local-login-smoke.mjs`
   (creates/reuses `login-smoke@localhost.dev`; auto-generated credentials are
   stored in the git-ignored `.local-test-login.json`). The same harness
   verifies session validity, token refresh, logout, the unauthenticated
   `/dashboard` redirect and that the browser bundle targets the local stack.

## Production check

`npm run lint`
`npm run build`
`npm start`

Suite (no live stack needed): `npm test`

Architecture: `src/app` routes, `src/components` reusable UI, `src/sections` landing sections, `src/config` content, `src/lib` utilities, `src/types` types, `public` assets.