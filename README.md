# GridFlow

Premium electricity operations dashboard, running with seeded demo data by default. When Supabase credentials are configured, the login can use Supabase Auth. This version keeps editable records in browser local storage; `supabase/schema.sql` provides a starting PostgreSQL schema for a future data-sync layer.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Optionally copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Run `npm run dev` and open the local URL Vite prints (usually `http://localhost:5173`).

With no Supabase variables, GridFlow runs in demo mode. Changes are stored in local storage on this device. For a Supabase deployment, run `supabase/schema.sql` and configure authentication and appropriate row-level-security policies before connecting real users. The SQL schema is included, but editable record CRUD is not wired to PostgreSQL yet.

The landing video lives at `public/videos/gemini-loop.webm`; the original download is not modified. If that file is missing, the hero shows its gradient fallback.
