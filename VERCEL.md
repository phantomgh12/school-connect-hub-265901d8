# Deploying SchoolConnect on Vercel

The production build targets Nitro's Vercel preset. Nitro creates Vercel Build Output API files automatically; do not add an SPA rewrite or override the output directory. Lovable's sandbox keeps its own preview target.

1. Import this repository into Vercel. Use the repository root, not the legacy `ghschoolhub` folder.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the existing backend's public connection values. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the same values for server-rendered public totals. Use your connected project's existing configuration, or your own backend's public settings if moving services.
3. Deploy and verify `/`, `/auth?mode=signup`, `/auth?mode=login`, and `/recover`, including direct reloads.

The active account screens use existing database RPCs, not hosting-specific privileged keys. Never put a service-role key in a `VITE_` variable. Private keys for Lovable Cloud are not available for export. Moving to a separate backend requires its own schema and auth setup; changing hosts alone does not move account data.

## Current blockers

The connected database was unavailable during this change. The new aggregate function in `database/pending/landing-community-stats.sql` could not be applied; apply it through the migration tool when the service returns. The landing page shows unavailable totals until this succeeds, never invented counts.

Existing signup, sign-in and recovery RPCs could not be inspected or exercised against the unavailable service. Email-confirmation settings and auth security warnings also remain unverified. A live Vercel deployment has not been tested; deployment configuration is prepared, not proof of a successful deployment.

Verify that the account service supports the existing username-only registration without confirmation emails. Do not enable social sign-in, SMS verification or anonymous accounts.