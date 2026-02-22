# Hotel Management Software (React + Vite)

## Operational features
1. Digitized front desk dashboard
2. Guest onboarding with local persistence
3. Reservation creation with date and room-conflict validation
4. Check-in / check-out lifecycle controls
5. Live KPI statistics dashboard
   - Today's income
   - Revenue per room
   - Occupancy rate
   - Number of guests
6. Guests expected today view
7. Booking history
8. Calendar-based reservation timeline
9. Mail/SMS alert tracking panel
10. One-click report generation (monthly / quarterly / yearly)
11. Mobile + web responsive layout with offline caching support

## User workflow (front desk)
1. Add guest in **Manage Guest Information**.
2. Create reservation in **Create Reservation**.
   - Blocks invalid date ranges.
   - Prevents overlapping reservations for the same room.
3. Process arrivals/departures in **Check-in / Check-out**.
4. Send communication updates from **Mail / Message Alerts**.
5. Monitor operations in **Guests Expected Today**, **Booking History**, and **Calendar Timeline**.
6. Generate operational summaries in **One-Click Reports**.

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Notes
- Data is persisted in browser `localStorage`.
- Service worker cache is provided via `/public/sw.js`.
- Status/validation feedback appears at the top of the app for all key actions.
