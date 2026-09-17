# WasteTrack deployment notes (handoff)

Deployment decisions and current state. Last updated: 2026-08-30.

## Chosen stack (per user)
- **Database**: Supabase (free Postgres) — alternatives: Neon / Azure Database for PostgreSQL / GCP Cloud SQL.
- **Backend** (Express + Postgres): **Azure or GCP via student credits** (always-on). Fallback: Render free tier (sleeps after 15 min idle → cold start).
- **Dashboard** (Vite + React Router): **Vercel** (has `vercel.json` SPA rewrite).
- **Mobile web** (Expo): **Netlify**.
- **Mobile native**: **Expo build** (EAS).

Everything uses PostgreSQL, so any Postgres host (Supabase/Neon/Azure/GCP) works — only `DATABASE_URL` changes. Do NOT switch to NoSQL (Firestore/Mongo) — it is a rewrite, not a swap.

## Backend deployment (the container artifact)
- `ecowaste-backend/Dockerfile` — multi-stage (build toolchain fallback for native deps like bcrypt → slim runtime, `USER node`, `node dist/server.js`).
- `ecowaste-backend/.dockerignore`
- `ecowaste-backend/.env.example` — all `envSchema` vars documented.
- `docker-compose.yml` (root) — `db` (postgres:16) + `migrate` (idempotent SQL migrations) + `backend`, with DB-ping health gate. Build with `docker compose up --build`.
- Health endpoint `GET /api/health` now pings Postgres → returns `200/UP` or `503/DOWN` (see `src/routes/index.ts`).
- Graceful shutdown on SIGTERM/SIGINT: drain HTTP connections, close DB pool, 10s force-exit guard (see `src/server.ts`).
- `src/config/db.ts`: added `pingDb`.

## Dashboard
- `ecowaste-dashboard/vercel.json` — SPA rewrite for React Router.
- `VITE_API_BASE_URL` injected at build time (see `ecowaste-dashboard/.env.example`). Set it in Vercel project env.
- Vite build output (`dist/`) deploys as-is.

## Mobile
- Native app via Expo/EAS. `EXPO_PUBLIC_API_BASE_URL` is read in `mobile/lib/api-client.ts`.
- **Web export works**: from within `mobile/`, `EXPO_PUBLIC_API_BASE_URL=... npx expo export --platform web --output-dir dist` produces a static site (index.html + `_expo/static/js`) suitable for Netlify/Cloudflare Pages. (Earlier failure was running the export from the repo root instead of `mobile/`.)
- **Map stack is fully keyless** (no API keys required):
  - Geocoding + reverse geocoding → OpenStreetMap **Nominatim** (`mobile/lib/logistics-map.ts`, web path in `mobile/lib/device-location.ts`). Web reverse-geocode is street-precise (road/neighbourhood/city/country).
  - Street routing → **OSRM** public server (`router.project-osrm.org`) with GraphHopper as an optional fallback only if `EXPO_PUBLIC_GRAPHHOPPER_KEY` is set.
  - Map tiles → OpenStreetMap / CARTO (keyless).
  - Caveats (free-tier): Nominatim public is ~1 req/sec; OSRM public has no SLA. Fine for demo/capstone; self-host or switch to a provider for production.
- **Coordinates are stored in the DB** (`waste_reports`, `pickup_requests`, `user_locations`) and used internally for map plotting/dispatch/navigation, but are **not shown as raw text** in the UI (dashboard reports list/detail/CSV export now display the human `location_text` label instead of lat/lng).
- The legacy Replit-era express server under `mobile/server/` and its Replit static-build pipeline (`mobile/scripts/build.js`) have been **removed**. The only backend is `ecowaste-backend`.
- Removed the expo-router `origin: https://replit.com/` override from `app.json` (would break deep links/asset URLs on real hosts).

## Deployment target reality
- No permanent free AND always-on backend host exists without a catch (free tiers sleep/cold-start; student credits run out). Student credits are the best always-on option.
- App-store publishing is not free (Apple ~$99/yr, Google ~$25 one-time).

## Next steps
1. Push baseline to GitHub so Actions CI runs.
2. Create Supabase project, set `DATABASE_URL`.
3. Deploy backend container to Azure/GCP (or Render free) using the Dockerfile.
4. Deploy dashboard to Vercel (set `VITE_API_BASE_URL`).
5. Fix mobile web export → deploy to Netlify (separate task).
6. Expo build for native binaries.
