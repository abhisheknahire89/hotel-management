import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { sendEmail, sendSms } from './notify.js';
import { getDefaultRestaurantMenu } from './seed.js';
import { nextId, readState, storageMode, updateState } from './store.js';

const app = express();
const port = Number(process.env.API_PORT || 8787);

const toIsoDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

const RESTAURANT_TAX_PERCENT = Number(process.env.RESTAURANT_TAX_PERCENT || 5);
const RESTAURANT_SERVICE_CHARGE_PERCENT = Number(process.env.RESTAURANT_SERVICE_CHARGE_PERCENT || 5);

function withDefaults(state) {
  return {
    rooms: state.rooms || [],
    guests: state.guests || [],
    bookings: state.bookings || [],
    alerts: state.alerts || [],
    restaurantMenu: state.restaurantMenu || [],
    restaurantOrders: state.restaurantOrders || [],
  };
}

function normalizeMenuItem(item, index) {
  const name = String(item?.name || '').trim();
  const category = String(item?.category || 'Main Course').trim();
  const price = Number(item?.price);

  if (!name || !Number.isFinite(price) || price <= 0) return null;

  return {
    id: item?.id ? String(item.id) : `M-${String(index + 1).padStart(3, '0')}`,
    name,
    category,
    price: Math.round(price),
    isVeg: item?.isVeg !== false,
    spiceLevel: ['mild', 'medium', 'high'].includes(String(item?.spiceLevel || '').toLowerCase())
      ? String(item.spiceLevel).toLowerCase()
      : 'medium',
  };
}

function computeBill(menu, orderItems) {
  const validItems = orderItems
    .map((item) => {
      const menuItem = menu.find((entry) => entry.id === item.menuId);
      const qty = Number(item.qty);
      if (!menuItem || !Number.isFinite(qty) || qty <= 0) return null;
      const cleanQty = Math.floor(qty);
      return {
        menuId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        qty: cleanQty,
        lineTotal: menuItem.price * cleanQty,
      };
    })
    .filter(Boolean);

  const subtotal = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = Math.round((subtotal * RESTAURANT_TAX_PERCENT) / 100);
  const serviceChargeAmount = Math.round((subtotal * RESTAURANT_SERVICE_CHARGE_PERCENT) / 100);

  return {
    items: validItems,
    subtotal,
    taxPercent: RESTAURANT_TAX_PERCENT,
    taxAmount,
    serviceChargePercent: RESTAURANT_SERVICE_CHARGE_PERCENT,
    serviceChargeAmount,
    totalAmount: subtotal + taxAmount + serviceChargeAmount,
  };
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString(), storage: storageMode() });
});

app.get('/api/bootstrap', async (_req, res) => {
  try {
    res.json(withDefaults(await readState()));
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
    const state = withDefaults(await readState());
    const duplicateEmail = state.guests.some((current) => current.email.toLowerCase() === guest.email.toLowerCase());
    if (duplicateEmail) {
      return res.status(409).json({ error: `Guest with email ${guest.email} already exists.` });
    }

    const created = {
      id: nextId(state.guests, 'G'),
      ...guest,
    };

    await updateState((current) => ({ ...withDefaults(current), guests: [created, ...withDefaults(current).guests] }));
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
    const state = withDefaults(await readState());

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

    await updateState((current) => ({ ...withDefaults(current), bookings: [created, ...withDefaults(current).bookings] }));
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
    await updateState((current) => {
      const state = withDefaults(current);
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
    await updateState((current) => {
      const state = withDefaults(current);
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

app.post('/api/restaurant/menu/import', async (req, res) => {
  const payload = req.body || {};
  const list = Array.isArray(payload) ? payload : payload.items;

  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: 'Menu import requires a non-empty array.' });
  }

  const normalized = list
    .map((item, index) => normalizeMenuItem(item, index))
    .filter(Boolean);

  if (normalized.length === 0) {
    return res.status(400).json({ error: 'No valid menu items found in upload.' });
  }

  try {
    await updateState((current) => ({ ...withDefaults(current), restaurantMenu: normalized }));
    return res.status(201).json({ count: normalized.length, menu: normalized });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/restaurant/menu/default', async (_req, res) => {
  try {
    const defaultMenu = getDefaultRestaurantMenu();
    await updateState((current) => ({ ...withDefaults(current), restaurantMenu: defaultMenu }));
    return res.status(201).json({ count: defaultMenu.length, menu: defaultMenu });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/restaurant/orders', async (req, res) => {
  const payload = req.body || {};
  const table = String(payload.table || '').trim();
  const orderItems = Array.isArray(payload.items) ? payload.items : [];

  if (!table) {
    return res.status(400).json({ error: 'Table number is required.' });
  }

  if (orderItems.length === 0) {
    return res.status(400).json({ error: 'At least one menu item is required.' });
  }

  try {
    const state = withDefaults(await readState());
    if (state.restaurantMenu.length === 0) {
      return res.status(400).json({ error: 'Restaurant menu is empty. Upload/import menu first.' });
    }

    const bill = computeBill(state.restaurantMenu, orderItems);
    if (bill.items.length === 0) {
      return res.status(400).json({ error: 'No valid bill items selected.' });
    }

    const created = {
      id: nextId(state.restaurantOrders, 'R'),
      guestId: payload.guestId ? String(payload.guestId).trim() : null,
      roomNumber: payload.roomNumber ? Number(payload.roomNumber) : null,
      table,
      items: bill.items,
      subtotal: bill.subtotal,
      taxPercent: bill.taxPercent,
      taxAmount: bill.taxAmount,
      serviceChargePercent: bill.serviceChargePercent,
      serviceChargeAmount: bill.serviceChargeAmount,
      totalAmount: bill.totalAmount,
      paymentMode: null,
      billedBy: String(payload.billedBy || 'Front Desk').trim(),
      notes: String(payload.notes || '').trim(),
      status: 'open',
      orderedAt: new Date().toISOString(),
      paidAt: null,
    };

    await updateState((current) => ({
      ...withDefaults(current),
      restaurantOrders: [created, ...withDefaults(current).restaurantOrders],
    }));

    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/restaurant/orders/:id/pay', async (req, res) => {
  const orderId = String(req.params.id || '').trim();
  const paymentMode = String(req.body?.paymentMode || 'Cash').trim();

  let updated = null;
  let error = null;

  try {
    await updateState((current) => {
      const state = withDefaults(current);
      const target = state.restaurantOrders.find((order) => order.id === orderId);
      if (!target) {
        error = 'Restaurant order not found.';
        return state;
      }

      if (target.status === 'paid') {
        error = 'Restaurant order is already paid.';
        return state;
      }

      const nextOrders = state.restaurantOrders.map((order) =>
        order.id === orderId
          ? { ...order, status: 'paid', paymentMode, paidAt: new Date().toISOString() }
          : order,
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
    const state = withDefaults(await readState());
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
    } catch (sendError) {
      alert.deliveryStatus = 'failed';
      alert.providerMeta = { error: sendError.message };
    }

    await updateState((current) => ({ ...withDefaults(current), alerts: [alert, ...withDefaults(current).alerts] }));

    if (alert.deliveryStatus === 'failed') {
      return res.status(502).json({ error: `Failed to send ${channel}.`, alert });
    }

    return res.status(201).json(alert);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port} (${storageMode()} storage)`);
});
