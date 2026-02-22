# Hotel Management Software (React + Vite + Node API)

## What is now included
1. Shared online data storage using Supabase (cross-device)
2. Email delivery using Resend
3. Hotel front-desk workflow
4. Ground-floor restaurant operations (orders + payment status)

## Shared data behavior
- Frontend reads/writes via backend APIs (`/api/*`).
- Backend storage modes:
  - `supabase` mode when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are configured
  - `file` fallback (`server/data/db.json`) when Supabase env vars are missing
- In `supabase` mode, data is shared across all devices/users.

## Restaurant module
- Create restaurant orders (table, items, amount, optional guest/room link)
- Mark orders as paid
- Restaurant revenue shown in dashboard KPIs

## Notifications
- Email via Resend (`RESEND_API_KEY`, `RESEND_FROM`)
- SMS via Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`)

## Supabase setup
1. Create a Supabase project.
2. Run this SQL in Supabase SQL editor:

```sql
create table if not exists app_state (
  key text primary key,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

3. Copy `.env.example` to `.env` and set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM`
- Twilio vars (if SMS needed)

## Local run
```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

## Scripts
- `npm run dev` -> start web + API together
- `npm run dev:api` -> API in watch mode
- `npm run start:api` -> API normal mode
- `npm run build` -> production frontend build

## Deployment for cross-device use
1. Deploy backend (Render/Railway/Fly/etc) with Supabase + Resend env vars.
2. Deploy frontend and point it to backend API domain.
3. Access from any device; same data appears everywhere.
