# Hotel Management Software (React + Vite + Node API)

## Operational features
1. Digitized front desk dashboard
2. Shared backend data persistence (JSON DB on server)
3. Reservation creation with date and room-conflict validation
4. Check-in / check-out lifecycle controls
5. Live KPI statistics dashboard
6. Guests expected today view
7. Booking history
8. Calendar-based reservation timeline
9. Real notification integrations:
   - Email via SMTP
   - SMS via Twilio
10. One-click report generation (monthly / quarterly / yearly)
11. Mobile + web responsive layout

## User workflow (front desk)
1. Add guest in **Manage Guest Information**.
2. Create reservation in **Create Reservation**.
3. Process arrivals/departures in **Check-in / Check-out**.
4. Send communication updates from **Mail / Message Alerts**.
5. Monitor **Guests Expected Today**, **Booking History**, and **Calendar Timeline**.
6. Generate reports in **One-Click Reports**.

## Data storage
- Main data is stored on the server at:
  - `server/data/db.json`
- This means all users connected to the same deployed backend see the same data.
- If API is unavailable, the UI falls back to local seed data (read-only operational fallback mode).

## Local setup
1. Install deps:
```bash
npm install
```

2. Configure env:
```bash
cp .env.example .env
```

3. Fill `.env` with real SMTP/Twilio credentials.

4. Start frontend + backend together:
```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

## API scripts
- `npm run dev:api` -> start API in watch mode
- `npm run start:api` -> start API normally

## Build web app
```bash
npm run build
npm run preview
```

## Notification behavior
- Email alerts require valid SMTP credentials.
- SMS alerts require valid Twilio credentials.
- Failed sends are still logged in alert history with `deliveryStatus: failed`.
