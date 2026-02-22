# Hotel Management Software (React + Vite + Node API)

## Included modules
1. Hotel front-desk operations (guests, reservations, check-in/out)
2. Ground-floor restaurant operations
   - Default Nashik-style Maharashtrian menu
   - Menu upload/import (JSON)
   - Itemized order creation with quantity
   - Automatic bill calculation (subtotal + tax + service charge)
   - Open bill management and payment closure
3. Shared online data using Supabase (cross-device)
4. Email notifications via Resend
5. SMS notifications via Twilio

## Shared data behavior
- Frontend reads/writes via backend APIs (`/api/*`).
- Backend storage modes:
  - `supabase` mode when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are configured
  - `file` fallback (`server/data/db.json`) when Supabase env vars are missing

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

## Restaurant menu upload format
Upload JSON as either array or `{ "items": [...] }`:

```json
[
  { "name": "Nashik Misal Pav", "category": "Breakfast", "price": 120, "isVeg": true, "spiceLevel": "high" },
  { "name": "Pithla Bhakri", "category": "Main Course", "price": 220, "isVeg": true, "spiceLevel": "medium" }
]
```

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
