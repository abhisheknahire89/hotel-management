import { useEffect, useMemo, useState } from 'react';
import {
  initialAlerts,
  initialBookings,
  initialGuests,
  initialRestaurantMenu,
  initialRestaurantOrders,
  initialRooms,
} from './data';
import {
  generateReport,
  getGuestsCountToday,
  getOccupancyRate,
  getRestaurantIncomeToday,
  getRevenuePerRoom,
  getTodayIncome,
} from './utils/metrics';
import './styles.css';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const toIsoDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
const localTaxPercent = 5;
const localServiceChargePercent = 5;

function nextId(collection, prefix) {
  const max = collection.reduce((currentMax, item) => {
    const parsed = Number(String(item.id || '').replace(`${prefix}-`, ''));
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.data = data;
    throw error;
  }

  return data;
}

function App() {
  const todayIso = toIsoDate();
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [restaurantMenu, setRestaurantMenu] = useState([]);
  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [orderItemsDraft, setOrderItemsDraft] = useState([]);
  const [menuPickId, setMenuPickId] = useState('');
  const [menuPickQty, setMenuPickQty] = useState(1);
  const [paymentModes, setPaymentModes] = useState({});
  const [report, setReport] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState('server');

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiRequest('/api/bootstrap');
        const menu = data.restaurantMenu || [];
        setRooms(data.rooms || []);
        setGuests(data.guests || []);
        setBookings(data.bookings || []);
        setAlerts(data.alerts || []);
        setRestaurantOrders(data.restaurantOrders || []);

        if (menu.length === 0) {
          try {
            const result = await apiRequest('/api/restaurant/menu/default', { method: 'POST' });
            setRestaurantMenu(result.menu || initialRestaurantMenu);
          } catch (_error) {
            setRestaurantMenu(initialRestaurantMenu);
          }
        } else {
          setRestaurantMenu(menu);
        }

        setSyncMode('server');
      } catch (_error) {
        setRooms(initialRooms);
        setGuests(initialGuests);
        setBookings(initialBookings);
        setAlerts(initialAlerts);
        setRestaurantMenu(initialRestaurantMenu);
        setRestaurantOrders(initialRestaurantOrders);
        setSyncMode('fallback');
        setNotice({ type: 'error', message: 'API not reachable. Running with local fallback data only.' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const guestsById = useMemo(() => Object.fromEntries(guests.map((guest) => [guest.id, guest])), [guests]);
  const menuById = useMemo(() => Object.fromEntries(restaurantMenu.map((item) => [item.id, item])), [restaurantMenu]);

  const summary = useMemo(() => {
    const todayIncome = getTodayIncome(bookings, todayIso);
    const restaurantIncome = getRestaurantIncomeToday(restaurantOrders, todayIso);
    const occupancyRate = getOccupancyRate(bookings, rooms, todayIso);
    const revenuePerRoom = getRevenuePerRoom(bookings, rooms, todayIso);
    const numberOfGuests = getGuestsCountToday(bookings, todayIso);
    return { todayIncome, restaurantIncome, occupancyRate, revenuePerRoom, numberOfGuests };
  }, [bookings, restaurantOrders, rooms, todayIso]);

  const expectedToday = useMemo(
    () => bookings.filter((booking) => booking.checkIn === todayIso && booking.status === 'reserved'),
    [bookings, todayIso],
  );

  const bookingHistory = useMemo(
    () => [...bookings].filter((booking) => booking.status === 'checked-out').sort((a, b) => b.checkOut.localeCompare(a.checkOut)),
    [bookings],
  );

  const openRestaurantOrders = useMemo(
    () => restaurantOrders.filter((order) => order.status !== 'paid'),
    [restaurantOrders],
  );

  const paidRestaurantOrders = useMemo(
    () => restaurantOrders.filter((order) => order.status === 'paid').slice(0, 12),
    [restaurantOrders],
  );

  const setFeedback = (type, message) => setNotice({ type, message });

  const checkIn = async (bookingId) => {
    try {
      const updated = await apiRequest(`/api/bookings/${bookingId}/check-in`, { method: 'POST' });
      setBookings((current) => current.map((booking) => (booking.id === updated.id ? updated : booking)));
      setFeedback('success', `${updated.id} checked in successfully.`);
    } catch (error) {
      setFeedback('error', error.message);
    }
  };

  const checkOut = async (bookingId) => {
    try {
      const updated = await apiRequest(`/api/bookings/${bookingId}/check-out`, { method: 'POST' });
      setBookings((current) => current.map((booking) => (booking.id === updated.id ? updated : booking)));
      setFeedback('success', `${updated.id} checked out and payment recorded.`);
    } catch (error) {
      setFeedback('error', error.message);
    }
  };

  const addGuest = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      idProof: String(formData.get('idProof') || '').trim(),
      vip: formData.get('vip') === 'on',
      notes: String(formData.get('notes') || '').trim(),
    };

    try {
      const created = await apiRequest('/api/guests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setGuests((current) => [created, ...current]);
      event.currentTarget.reset();
      setFeedback('success', `${created.name} added with ID ${created.id}.`);
    } catch (error) {
      setFeedback('error', error.message);
    }
  };

  const addBooking = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      guestId: String(formData.get('guestId') || '').trim(),
      roomNumber: Number(formData.get('roomNumber')),
      checkIn: String(formData.get('checkIn') || '').trim(),
      checkOut: String(formData.get('checkOut') || '').trim(),
      source: String(formData.get('source') || 'Website').trim(),
      totalAmount: Number(formData.get('totalAmount')),
    };

    try {
      const created = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setBookings((current) => [created, ...current]);
      event.currentTarget.reset();
      setFeedback('success', `${created.id} created for room ${created.roomNumber}.`);
    } catch (error) {
      setFeedback('error', error.message);
    }
  };

  const sendAlert = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      channel: String(formData.get('channel') || '').trim(),
      recipient: String(formData.get('recipient') || '').trim(),
      message: String(formData.get('message') || '').trim(),
    };

    try {
      const created = await apiRequest('/api/alerts/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setAlerts((current) => [created, ...current]);
      event.currentTarget.reset();
      setFeedback('success', `${created.channel} alert sent to ${created.recipient}.`);
    } catch (error) {
      if (error.data?.alert) {
        setAlerts((current) => [error.data.alert, ...current]);
      }
      setFeedback('error', error.message);
    }
  };

  const addDraftItem = () => {
    const menuId = String(menuPickId || '').trim();
    const qty = Number(menuPickQty);
    if (!menuId || !Number.isFinite(qty) || qty <= 0) {
      setFeedback('error', 'Select menu item and valid quantity.');
      return;
    }

    const menuItem = menuById[menuId];
    if (!menuItem) {
      setFeedback('error', 'Invalid menu item selected.');
      return;
    }

    setOrderItemsDraft((current) => {
      const existing = current.find((item) => item.menuId === menuId);
      if (existing) {
        return current.map((item) => (item.menuId === menuId ? { ...item, qty: item.qty + qty } : item));
      }
      return [...current, { menuId, qty }];
    });
    setMenuPickQty(1);
  };

  const removeDraftItem = (menuId) => {
    setOrderItemsDraft((current) => current.filter((item) => item.menuId !== menuId));
  };

  const importMenuFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = Array.isArray(parsed) ? parsed : parsed.items;

      if (syncMode === 'fallback') {
        if (!Array.isArray(payload) || payload.length === 0) throw new Error('Menu import requires an array.');
        const normalized = payload
          .map((item, index) => {
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
          })
          .filter(Boolean);
        if (normalized.length === 0) throw new Error('No valid menu items found.');
        setRestaurantMenu(normalized);
        setFeedback('success', `Menu imported successfully (${normalized.length} items).`);
      } else {
        const result = await apiRequest('/api/restaurant/menu/import', {
          method: 'POST',
          body: JSON.stringify({ items: payload }),
        });
        setRestaurantMenu(result.menu || []);
        setFeedback('success', `Menu imported successfully (${result.count} items).`);
      }
    } catch (error) {
      setFeedback('error', `Menu import failed: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const createRestaurantOrder = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (orderItemsDraft.length === 0) {
      setFeedback('error', 'Add at least one menu item to create restaurant order.');
      return;
    }

    const payload = {
      table: String(formData.get('table') || '').trim(),
      guestId: String(formData.get('guestId') || '').trim() || null,
      roomNumber: Number(formData.get('roomNumber')) || null,
      billedBy: String(formData.get('billedBy') || 'Restaurant Cashier').trim(),
      notes: String(formData.get('notes') || '').trim(),
      items: orderItemsDraft,
    };

    try {
      let created;
      if (syncMode === 'fallback') {
        const items = payload.items
          .map((item) => {
            const menuItem = menuById[item.menuId];
            const qty = Number(item.qty);
            if (!menuItem || !Number.isFinite(qty) || qty <= 0) return null;
            const cleanQty = Math.floor(qty);
            return {
              menuId: menuItem.id,
              name: menuItem.name,
              price: menuItem.price,
              qty: cleanQty,
              lineTotal: cleanQty * menuItem.price,
            };
          })
          .filter(Boolean);
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
        const taxAmount = Math.round((subtotal * localTaxPercent) / 100);
        const serviceChargeAmount = Math.round((subtotal * localServiceChargePercent) / 100);
        created = {
          id: nextId(restaurantOrders, 'R'),
          guestId: payload.guestId,
          roomNumber: payload.roomNumber,
          table: payload.table,
          items,
          subtotal,
          taxPercent: localTaxPercent,
          taxAmount,
          serviceChargePercent: localServiceChargePercent,
          serviceChargeAmount,
          totalAmount: subtotal + taxAmount + serviceChargeAmount,
          paymentMode: null,
          billedBy: payload.billedBy,
          notes: payload.notes,
          status: 'open',
          orderedAt: new Date().toISOString(),
          paidAt: null,
        };
      } else {
        created = await apiRequest('/api/restaurant/orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setRestaurantOrders((current) => [created, ...current]);
      setOrderItemsDraft([]);
      setMenuPickId('');
      setMenuPickQty(1);
      event.currentTarget.reset();
      setFeedback('success', `Restaurant bill ${created.id} created for table ${created.table}.`);
    } catch (error) {
      setFeedback('error', error.message);
    }
  };

  const payRestaurantOrder = async (orderId) => {
    const paymentMode = paymentModes[orderId] || 'Cash';
    try {
      let updated;
      if (syncMode === 'fallback') {
        const target = restaurantOrders.find((order) => order.id === orderId);
        if (!target) throw new Error('Restaurant order not found.');
        if (target.status === 'paid') throw new Error('Restaurant order is already paid.');
        updated = { ...target, status: 'paid', paymentMode, paidAt: new Date().toISOString() };
      } else {
        updated = await apiRequest(`/api/restaurant/orders/${orderId}/pay`, {
          method: 'POST',
          body: JSON.stringify({ paymentMode }),
        });
      }
      setRestaurantOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
      setFeedback('success', `Restaurant order ${updated.id} marked as paid via ${paymentMode}.`);
    } catch (error) {
      setFeedback('error', error.message);
    }
  };

  const generate = (period) => {
    setReport(generateReport(bookings, guests, period));
    setFeedback('success', `${period[0].toUpperCase() + period.slice(1)} report generated.`);
  };

  if (loading) {
    return (
      <div className="app-shell">
        <section className="panel">
          <h3>Loading Hotel Dashboard...</h3>
          <p>Connecting to server and loading live data.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Digitized Front Desk Platform</p>
          <h1>Hotel Management Software</h1>
          <p className="muted">
            Mobile + web access with shared backend storage.
            {' '}
            {syncMode === 'server' ? 'Server sync active.' : 'Local fallback mode.'}
          </p>
        </div>
        <div className={online ? 'status online' : 'status offline'}>{online ? 'Online Sync Active' : 'Offline Mode Active'}</div>
      </header>

      {notice.message && <section className={`notice ${notice.type}`}>{notice.message}</section>}

      <section className="workflow panel">
        <h3>User Workflow</h3>
        <ol>
          <li>Add or verify guest details in "Manage Guest Information".</li>
          <li>Create reservations and process check-in/check-out.</li>
          <li>Restaurant manager uploads/updates menu (JSON import).</li>
          <li>Create restaurant bills by selecting menu items and quantities.</li>
          <li>Manage open bills and close payments with payment mode.</li>
          <li>Use alerts, reports, and calendar for daily operations.</li>
        </ol>
      </section>

      <section className="stats-grid">
        <StatCard title="Today's Room Income" value={currency.format(summary.todayIncome)} />
        <StatCard title="Today's Restaurant Income" value={currency.format(summary.restaurantIncome)} />
        <StatCard title="Revenue / Room" value={currency.format(summary.revenuePerRoom)} />
        <StatCard title="Occupancy Rate" value={`${summary.occupancyRate}%`} />
        <StatCard title="No. of Guests" value={String(summary.numberOfGuests)} />
      </section>

      <section className="layout-two">
        <Panel title="Check-in / Check-out">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.id}</td>
                  <td>{guestsById[booking.guestId]?.name ?? 'Unknown'}</td>
                  <td>{booking.roomNumber}</td>
                  <td>
                    <span className={`badge ${booking.status}`}>{booking.status}</span>
                  </td>
                  <td className="actions">
                    {booking.status === 'reserved' && <button onClick={() => checkIn(booking.id)}>Check-in</button>}
                    {booking.status === 'checked-in' && <button onClick={() => checkOut(booking.id)}>Check-out</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Guests Expected Today">
          <ul className="list">
            {expectedToday.length === 0 && <li>No expected arrivals today.</li>}
            {expectedToday.map((booking) => (
              <li key={booking.id}>
                <strong>{guestsById[booking.guestId]?.name}</strong> - Room {booking.roomNumber} - via {booking.source}
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="layout-two">
        <Panel title="Manage Guest Information">
          <form className="stack" onSubmit={addGuest}>
            <input name="name" placeholder="Guest name" required />
            <input type="email" name="email" placeholder="Email" required />
            <input name="phone" placeholder="Phone" required />
            <input name="idProof" placeholder="ID proof" required />
            <textarea name="notes" placeholder="Notes" rows={2} />
            <label className="check">
              <input type="checkbox" name="vip" /> VIP Guest
            </label>
            <button type="submit">Add Guest</button>
          </form>
        </Panel>

        <Panel title="Create Reservation">
          <form className="stack" onSubmit={addBooking}>
            <select name="guestId" required>
              <option value="">Select guest</option>
              {guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.id} - {guest.name}
                </option>
              ))}
            </select>
            <select name="roomNumber" required>
              <option value="">Select room</option>
              {rooms.map((room) => (
                <option key={room.number} value={room.number}>
                  {room.number} - {room.type} ({currency.format(room.price)})
                </option>
              ))}
            </select>
            <input type="date" name="checkIn" required defaultValue={todayIso} />
            <input type="date" name="checkOut" required defaultValue={toIsoDate(Date.now() + 24 * 60 * 60 * 1000)} />
            <select name="source" defaultValue="Website">
              <option>Website</option>
              <option>Walk-in</option>
              <option>Travel Agent</option>
              <option>Phone</option>
            </select>
            <input type="number" name="totalAmount" placeholder="Total amount" min="0" required />
            <button type="submit">Book Room</button>
          </form>
        </Panel>
      </section>

      <section className="layout-two">
        <Panel title="Restaurant Menu Management">
          <p className="tiny">Default Nashik menu is preloaded. Upload JSON to replace existing menu catalog.</p>
          <input type="file" accept="application/json" onChange={importMenuFile} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {restaurantMenu.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>{currency.format(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Create Restaurant Bill">
          <form className="stack" onSubmit={createRestaurantOrder}>
            <input name="table" placeholder="Table number (e.g. G-03)" required />
            <select name="guestId" defaultValue="">
              <option value="">Optional: Link guest</option>
              {guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.id} - {guest.name}
                </option>
              ))}
            </select>
            <input type="number" name="roomNumber" placeholder="Optional: Room number" min="0" />
            <input name="billedBy" placeholder="Billed by" defaultValue="Restaurant Cashier" />
            <textarea name="notes" placeholder="Bill notes" rows={2} />

            <div className="row">
              <select value={menuPickId} onChange={(event) => setMenuPickId(event.target.value)}>
                <option value="">Select menu item</option>
                {restaurantMenu.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({currency.format(item.price)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={menuPickQty}
                onChange={(event) => setMenuPickQty(Number(event.target.value) || 1)}
              />
              <button type="button" onClick={addDraftItem}>Add Item</button>
            </div>

            <ul className="list compact">
              {orderItemsDraft.length === 0 && <li>No items selected yet.</li>}
              {orderItemsDraft.map((item) => (
                <li key={item.menuId} className="bill-line">
                  <span>{menuById[item.menuId]?.name} x {item.qty}</span>
                  <button type="button" onClick={() => removeDraftItem(item.menuId)}>Remove</button>
                </li>
              ))}
            </ul>

            <button type="submit">Create Restaurant Bill</button>
          </form>
        </Panel>
      </section>

      <section className="layout-two">
        <Panel title="Restaurant Billing Management (Open)">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Table</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Pay</th>
                </tr>
              </thead>
              <tbody>
                {openRestaurantOrders.length === 0 && (
                  <tr>
                    <td colSpan={5}>No open bills.</td>
                  </tr>
                )}
                {openRestaurantOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.table}</td>
                    <td>{(order.items || []).map((entry) => `${entry.name} x${entry.qty}`).join(', ')}</td>
                    <td>{currency.format(order.totalAmount || order.amount || 0)}</td>
                    <td className="actions">
                      <select
                        value={paymentModes[order.id] || 'Cash'}
                        onChange={(event) =>
                          setPaymentModes((current) => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                      >
                        <option>Cash</option>
                        <option>Card</option>
                        <option>UPI</option>
                        <option>Room Charge</option>
                      </select>
                      <button onClick={() => payRestaurantOrder(order.id)}>Mark Paid</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Restaurant Billing History (Paid)">
          <ul className="list compact">
            {paidRestaurantOrders.length === 0 && <li>No paid bills yet.</li>}
            {paidRestaurantOrders.map((order) => (
              <li key={order.id}>
                <strong>{order.id}</strong> | Table {order.table} | {currency.format(order.totalAmount || 0)} | {order.paymentMode || 'NA'}
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="layout-two">
        <Panel title="History of Bookings">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Guest</th>
                  <th>Dates</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {bookingHistory.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.id}</td>
                    <td>{guestsById[booking.guestId]?.name}</td>
                    <td>
                      {booking.checkIn} to {booking.checkOut}
                    </td>
                    <td>{currency.format(booking.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Mail / Message Alerts">
          <form className="stack" onSubmit={sendAlert}>
            <select name="channel" defaultValue="Email">
              <option>Email</option>
              <option>SMS</option>
            </select>
            <input name="recipient" placeholder="Email or phone" required />
            <textarea name="message" placeholder="Message" rows={2} required />
            <button type="submit">Send Alert</button>
          </form>
          <ul className="list compact">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <strong>{alert.channel}</strong> to {alert.recipient} - {alert.message} ({alert.deliveryStatus})
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="layout-two">
        <Panel title="Calendar Timeline of Reservations">
          <CalendarTimeline bookings={bookings} guestsById={guestsById} />
        </Panel>

        <Panel title="One-Click Reports">
          <div className="row">
            <button onClick={() => generate('monthly')}>Monthly</button>
            <button onClick={() => generate('quarterly')}>Quarterly</button>
            <button onClick={() => generate('yearly')}>Yearly</button>
          </div>
          {report && (
            <div className="report">
              <p>
                <strong>Report:</strong> {report.period}
              </p>
              <p>Total bookings: {report.totalBookings}</p>
              <p>Completed stays: {report.completedStays}</p>
              <p>Active guests: {report.activeGuests}</p>
              <p>Revenue: {currency.format(report.revenue)}</p>
              <p>Generated at: {new Date(report.generatedAt).toLocaleString()}</p>
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <article className="stat-card">
      <p>{title}</p>
      <h2>{value}</h2>
    </article>
  );
}

function Panel({ title, children }) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function CalendarTimeline({ bookings, guestsById }) {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const firstDay = new Date(year, month, 1);
  const daysCount = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysCount; d += 1) cells.push(d);

  const getBookingsForDay = (day) => {
    const iso = toIsoDate(new Date(year, month, day));
    return bookings.filter((booking) => booking.checkIn <= iso && booking.checkOut >= iso);
  };

  const changeMonth = (direction) => {
    const next = new Date(year, month + direction, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };

  return (
    <div>
      <div className="row">
        <button onClick={() => changeMonth(-1)}>Prev</button>
        <strong>{new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</strong>
        <button onClick={() => changeMonth(1)}>Next</button>
      </div>
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="calendar-head">
            {day}
          </div>
        ))}
        {cells.map((day, index) => (
          <div key={`${day ?? 'empty'}-${index}`} className="calendar-cell">
            {day && (
              <>
                <p className="day">{day}</p>
                <div className="chips">
                  {getBookingsForDay(day)
                    .slice(0, 2)
                    .map((booking) => (
                      <span key={booking.id} className="chip">
                        {guestsById[booking.guestId]?.name?.split(' ')[0]} - {booking.roomNumber}
                      </span>
                    ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
