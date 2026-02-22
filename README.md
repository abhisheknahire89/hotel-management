# Hotel Management Software (React + Vite + Node API)

## What you asked for
Shared online data so users on different devices see the same records.

## How this is now implemented
1. Frontend calls backend APIs (`/api/*`) for all operations.
2. Backend supports two storage modes:
   - Cloud mode: MongoDB via `MONGODB_URI` (recommended for multi-device access)
   - Local mode: `server/data/db.json` fallback
3. When deployed with `MONGODB_URI`, all devices share the same live database.

## Features
1. Digitized front desk dashboard
2. Shared backend persistence
3. Guest management
4. Reservation creation with overlap validation
5. Check-in / check-out lifecycle
6. Alert delivery logging with real integrations:
   - Email via SMTP
   - SMS via Twilio
7. Booking history + calendar timeline
8. Report generation

## Environment setup
Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required for cloud/shared data:
- `MONGODB_URI` (MongoDB Atlas recommended)

Required for notifications:
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

## Run locally
```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

## Deploy for multi-device use
1. Deploy backend (Railway/Render/Fly/EC2).
2. Set backend env vars including `MONGODB_URI`.
3. Deploy frontend (Vercel/Netlify) and point API base URL to your backend domain.
4. Open frontend URL from any device; all users will see same data.

## Scripts
- `npm run dev` -> start web + API together
- `npm run dev:api` -> API in watch mode
- `npm run start:api` -> API normal mode
- `npm run build` -> production frontend build

## Notes
- If `MONGODB_URI` is missing, backend uses local JSON file (`server/data/db.json`), which is not shared across hosted instances.
