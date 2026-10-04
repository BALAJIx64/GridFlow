# GridFlow

Premium electricity billing and operations workspace built with React, TypeScript, Vite, Supabase Auth, and PostgreSQL. The approved UI and looping hero video are retained. Workspace data starts empty and is read from Supabase; the application does not provide demo credentials or local-storage records.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`; provide the Supabase project URL and publishable key (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
4. Run `npm run dev` and open the local URL Vite prints.

The supplied `.env.example` is already populated for this GridFlow project. A local `.env.local` is git-ignored.

## Supabase setup

1. Open the project’s Supabase Dashboard → SQL Editor.
2. Run [`supabase/schema.sql`](supabase/schema.sql) once. It creates the empty operations schema, indexes, INR billing fields, admin-only RLS policies, and SQL RPCs for generating bills and reporting. No seed data is inserted.
3. In Project Settings → API → Data API, confirm `public` is an exposed schema. The SQL grants authenticated access, while RLS limits visible rows to GridFlow administrators.
4. In Supabase Authentication, create the administrator user and confirm its email.
5. Set its trusted `app_metadata.role` to `gridflow_admin` using the Supabase Admin API/server-side workflow. Never set this value from the browser or user-editable metadata. Refresh that user’s session after changing the claim.
6. Add a prior cumulative meter reading and a reading in the billing period; bill generation uses those readings to calculate usage. Create an active tariff for each consumer category before creating consumers.
7. Start GridFlow and sign in with that administrator’s email and password.

The front end uses only the publishable key. Keep service-role/secret keys out of `.env.local` and the browser bundle. RLS blocks all non-admin data access, and anonymous table access is revoked.

## Database behavior

- Consumer, meter, bill, and technician lists are loaded from the database; create/update/delete dialogs write to PostgreSQL and refresh the workspace.
- Bill generation uses cumulative meter readings in the selected billing period and the consumer’s tariff. It skips consumers with no readings and avoids duplicate bills for a period.
- Currency is INR. Dashboard counts and totals are based on loaded records; empty charts/tables show no fabricated sample history.
- Authentication requires `app_metadata.role = gridflow_admin` and checks this claim at sign-in and session restore.

## Deploying database changes

The Supabase CLI is not available in this environment, so the schema has not been applied to the hosted project or registered as a CLI migration. Apply `supabase/schema.sql` through the SQL Editor above. Do not apply it to a project that already contains production data without reviewing the existing schema first.

The landing video is `public/videos/gemini-loop.webm`.
