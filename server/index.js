import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { sendEmail, sendSms } from './notify.js';
import { nextId, readState, updateState } from './store.js';

const app = express();
const port = Number(process.env.API_PORT || 8787);

const toIsoDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get('/api/bootstrap', (_req, res) => {
  res.json(readState());
});

app.post('/api/guests', (req, res) => {
  const payload = req.body || {};
  const guest = {
    name: String(payload.name || '').trim(),
    email: String(payload.email || '').trim(),
    phone: String(payload.phone || '').trim(),
    idProof: String(payload.idProof || '').trim(),
    vip: Boolean(payload.vip),
    notes: String(payload.notes || '').trim(),
  };

  if (!guest.name || !guest.email || !guest.phone || !guest.idProof) {
    return res.status(400).json({ error: 'Name, email, phone, and ID proof are required.' });
  }

  const state = readState();
  const duplicateEmail = state.guests.some((current) => current.email.toLowerCase() === guest.email.toLowerCase());
  if (duplicateEmail) {
    return res.status(409).json({ error: `Guest with email ${guest.email} already exists.` });
  }

  const created = {
    id: nextId(state.guests, 'G'),
    ...guest,
  };

  updateState((current) => ({ ...current, guests: [created, ...current.guests] }));
  return res.status(201).json(created);
});

app.post('/api/bookings', (req, res) => {
  const payload = req.body || {};
  const booking = {
    guestId: String(payload.guestId || '').trim(),
    roomNumber: Number(payload.roomNumber),
    checkIn: String(payload.checkIn || '').trim(),
    checkOut: String(payload.checkOut || '').trim(),
    source: String(payload.source || 'Website').trim(),
    totalAmount: Number(payload.totalAmount),
  };

  if (!booking.guestId || !booking.roomNumber || !booking.checkIn || !booking.checkOut || !booking.totalAmount) {
    return res.status(400).json({ error: 'Guest, room, dates, and amount are required to create a booking.' });
  }

  if (booking.checkOut <= booking.checkIn) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
  }

  const state = readState();
  if (!state.guests.some((guest) => guest.id === booking.guestId)) {
    return res.status(400).json({ error: 'Selected guest does not exist.' });
  }

  if (!state.rooms.some((room) => room.number === booking.roomNumber)) {
    return res.status(400).json({ error: `Room ${booking.roomNumber} does not exist.` });
  }

  const overlap = state.bookings.some((current) => {
    if (current.roomNumber !== booking.roomNumber) return false;
    if (current.status === 'checked-out') return false;
    return booking.checkIn < current.checkOut && booking.checkOut > current.checkIn;
  });

  if (overlap) {
    return res.status(409).json({ error: `Room ${booking.roomNumber} is already booked for those dates.` });
  }

  const created = {
    id: `B-${1000 + state.bookings.length + 1}`,
    ...booking,
    status: 'reserved',
    paymentDate: null,
  };

  updateState((current) => ({ ...current, bookings: [created, ...current.bookings] }));
  return res.status(201).json(created);
});

app.post('/api/bookings/:id/check-in', (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const todayIso = toIsoDate();

  let updated = null;
  let error = null;

  updateState((state) => {
    const target = state.bookings.find((booking) => booking.id === bookingId);
    if (!target) {
      error = 'Booking not found.';
      return state;
    }

    if (target.checkIn > todayIso) {
      error = `Check-in is available from ${target.checkIn}.`;
      return state;
    }

    if (target.status !== 'reserved') {
      error = `Booking is already ${target.status}.`;
      return state;
    }

    const bookings = state.bookings.map((booking) =>
      booking.id === bookingId ? { ...booking, status: 'checked-in' } : booking,
    );

    updated = bookings.find((booking) => booking.id === bookingId);
    return { ...state, bookings };
  });

  if (error) return res.status(400).json({ error });
  return res.json(updated);
});

app.post('/api/bookings/:id/check-out', (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const todayIso = toIsoDate();

  let updated = null;
  let error = null;

  updateState((state) => {
    const target = state.bookings.find((booking) => booking.id === bookingId);
    if (!target) {
      error = 'Booking not found.';
      return state;
    }

    if (target.status !== 'checked-in') {
      error = 'Only checked-in bookings can be checked out.';
      return state;
    }

    const bookings = state.bookings.map((booking) =>
      booking.id === bookingId
        ? {
            ...booking,
            status: 'checked-out',
            paymentDate: todayIso,
            checkOut: booking.checkOut < todayIso ? todayIso : booking.checkOut,
          }
        : booking,
    );

    updated = bookings.find((booking) => booking.id === bookingId);
    return { ...state, bookings };
  });

  if (error) return res.status(400).json({ error });
  return res.json(updated);
});

app.post('/api/alerts/send', async (req, res) => {
  const payload = req.body || {};
  const channel = String(payload.channel || '').trim();
  const recipient = String(payload.recipient || '').trim();
  const message = String(payload.message || '').trim();

  if (!recipient || !message || !['Email', 'SMS'].includes(channel)) {
    return res.status(400).json({ error: 'Valid channel, recipient, and message are required.' });
  }

  const state = readState();
  const alert = {
    id: nextId(state.alerts, 'A'),
    channel,
    recipient,
    message,
    time: new Date().toISOString(),
    deliveryStatus: 'pending',
    providerMeta: null,
  };

  try {
    if (channel === 'Email') {
      alert.providerMeta = await sendEmail({ to: recipient, message });
    } else {
      alert.providerMeta = await sendSms({ to: recipient, message });
    }
    alert.deliveryStatus = 'sent';
  } catch (error) {
    alert.deliveryStatus = 'failed';
    alert.providerMeta = { error: error.message };
  }

  updateState((current) => ({ ...current, alerts: [alert, ...current.alerts] }));

  if (alert.deliveryStatus === 'failed') {
    return res.status(502).json({
      error: `Failed to send ${channel}.`,
      alert,
    });
  }

  return res.status(201).json(alert);
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
