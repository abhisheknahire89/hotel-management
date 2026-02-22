import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { sendEmail, sendSms } from './notify.js';
import { nextId, readState, storageMode, updateState } from './store.js';

const app = express();
const port = Number(process.env.API_PORT || 8787);

const toIsoDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString(), storage: storageMode() });
});

app.get('/api/bootstrap', async (_req, res) => {
  try {
    res.json(await readState());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/guests', async (req, res) => {
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

  try {
    const state = await readState();
    const duplicateEmail = state.guests.some((current) => current.email.toLowerCase() === guest.email.toLowerCase());
    if (duplicateEmail) {
      return res.status(409).json({ error: `Guest with email ${guest.email} already exists.` });
    }

    const created = {
      id: nextId(state.guests, 'G'),
      ...guest,
    };

    await updateState((current) => ({ ...current, guests: [created, ...current.guests] }));
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings', async (req, res) => {
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

  try {
    const state = await readState();

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

    await updateState((current) => ({ ...current, bookings: [created, ...current.bookings] }));
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings/:id/check-in', async (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const todayIso = toIsoDate();

  let updated = null;
  let error = null;

  try {
    await updateState((state) => {
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
  } catch (caught) {
    return res.status(500).json({ error: caught.message });
  }
});

app.post('/api/bookings/:id/check-out', async (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const todayIso = toIsoDate();

  let updated = null;
  let error = null;

  try {
    await updateState((state) => {
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
  } catch (caught) {
    return res.status(500).json({ error: caught.message });
  }
});

app.post('/api/restaurant/orders', async (req, res) => {
  const payload = req.body || {};
  const order = {
    guestId: payload.guestId ? String(payload.guestId).trim() : null,
    roomNumber: payload.roomNumber ? Number(payload.roomNumber) : null,
    table: String(payload.table || '').trim(),
    itemSummary: String(payload.itemSummary || '').trim(),
    amount: Number(payload.amount),
  };

  if (!order.table || !order.itemSummary || !order.amount) {
    return res.status(400).json({ error: 'Table, item summary, and amount are required.' });
  }

  try {
    const state = await readState();
    const created = {
      id: nextId(state.restaurantOrders || [], 'R'),
      ...order,
      status: 'open',
      orderedAt: new Date().toISOString(),
      paidAt: null,
    };

    await updateState((current) => ({
      ...current,
      restaurantOrders: [created, ...(current.restaurantOrders || [])],
    }));

    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/restaurant/orders/:id/pay', async (req, res) => {
  const orderId = String(req.params.id || '').trim();

  let updated = null;
  let error = null;

  try {
    await updateState((state) => {
      const currentOrders = state.restaurantOrders || [];
      const target = currentOrders.find((order) => order.id === orderId);
      if (!target) {
        error = 'Restaurant order not found.';
        return state;
      }

      if (target.status === 'paid') {
        error = 'Restaurant order is already paid.';
        return state;
      }

      const nextOrders = currentOrders.map((order) =>
        order.id === orderId ? { ...order, status: 'paid', paidAt: new Date().toISOString() } : order,
      );

      updated = nextOrders.find((order) => order.id === orderId);
      return { ...state, restaurantOrders: nextOrders };
    });

    if (error) return res.status(400).json({ error });
    return res.json(updated);
  } catch (caught) {
    return res.status(500).json({ error: caught.message });
  }
});

app.post('/api/alerts/send', async (req, res) => {
  const payload = req.body || {};
  const channel = String(payload.channel || '').trim();
  const recipient = String(payload.recipient || '').trim();
  const message = String(payload.message || '').trim();

  if (!recipient || !message || !['Email', 'SMS'].includes(channel)) {
    return res.status(400).json({ error: 'Valid channel, recipient, and message are required.' });
  }

  try {
    const state = await readState();
    const alert = {
      id: nextId(state.alerts || [], 'A'),
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
    } catch (sendError) {
      alert.deliveryStatus = 'failed';
      alert.providerMeta = { error: sendError.message };
    }

    await updateState((current) => ({ ...current, alerts: [alert, ...(current.alerts || [])] }));

    if (alert.deliveryStatus === 'failed') {
      return res.status(502).json({
        error: `Failed to send ${channel}.`,
        alert,
      });
    }

    return res.status(201).json(alert);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port} (${storageMode()} storage)`);
});
