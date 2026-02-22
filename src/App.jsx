import { useEffect, useMemo, useState } from 'react';
import { initialAlerts, initialBookings, initialGuests, initialRooms } from './data';
import { getGuestsCountToday, getOccupancyRate, getRevenuePerRoom, getTodayIncome, generateReport } from './utils/metrics';
import { usePersistentState } from './utils/storage';
import './styles.css';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const toIsoDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

function App() {
  const todayIso = toIsoDate();
  const [rooms] = usePersistentState('hms-rooms', initialRooms);
  const [guests, setGuests] = usePersistentState('hms-guests', initialGuests);
  const [bookings, setBookings] = usePersistentState('hms-bookings', initialBookings);
  const [alerts, setAlerts] = usePersistentState('hms-alerts', initialAlerts);
  const [report, setReport] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState({ type: 'info', message: '' });

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

  const guestsById = useMemo(() => Object.fromEntries(guests.map((guest) => [guest.id, guest])), [guests]);

  const summary = useMemo(() => {
    const todayIncome = getTodayIncome(bookings, todayIso);
    const occupancyRate = getOccupancyRate(bookings, rooms, todayIso);
    const revenuePerRoom = getRevenuePerRoom(bookings, rooms, todayIso);
    const numberOfGuests = getGuestsCountToday(bookings, todayIso);

    return { todayIncome, occupancyRate, revenuePerRoom, numberOfGuests };
  }, [bookings, rooms, todayIso]);

  const expectedToday = useMemo(
    () => bookings.filter((booking) => booking.checkIn === todayIso && booking.status === 'reserved'),
    [bookings, todayIso],
  );

  const bookingHistory = useMemo(
    () => [...bookings].filter((booking) => booking.status === 'checked-out').sort((a, b) => b.checkOut.localeCompare(a.checkOut)),
    [bookings],
  );

  const setFeedback = (type, message) => {
    setNotice({ type, message });
  };

  const isRoomBooked = (roomNumber, checkIn, checkOut) => {
    return bookings.some((booking) => {
      if (booking.roomNumber !== roomNumber) return false;
      if (booking.status === 'checked-out') return false;
      return checkIn < booking.checkOut && checkOut > booking.checkIn;
    });
  };

  const checkIn = (bookingId) => {
    const target = bookings.find((booking) => booking.id === bookingId);
    if (!target) {
      setFeedback('error', 'Booking not found.');
      return;
    }

    if (target.checkIn > todayIso) {
      setFeedback('error', `Check-in is available from ${target.checkIn}.`);
      return;
    }

    setBookings((current) =>
      current.map((booking) => (booking.id === bookingId ? { ...booking, status: 'checked-in' } : booking)),
    );
    setFeedback('success', `${target.id} checked in successfully.`);
  };

  const checkOut = (bookingId) => {
    const target = bookings.find((booking) => booking.id === bookingId);
    if (!target) {
      setFeedback('error', 'Booking not found.');
      return;
    }

    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? { ...booking, status: 'checked-out', paymentDate: todayIso, checkOut: booking.checkOut < todayIso ? todayIso : booking.checkOut }
          : booking,
      ),
    );
    setFeedback('success', `${target.id} checked out and payment recorded.`);
  };

  const addGuest = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const id = `G-${String(guests.length + 1).padStart(3, '0')}`;
    const guest = {
      id,
      name: formData.get('name').trim(),
      email: formData.get('email').trim(),
      phone: formData.get('phone').trim(),
      idProof: formData.get('idProof').trim(),
      vip: formData.get('vip') === 'on',
      notes: formData.get('notes').trim(),
    };

    if (!guest.name || !guest.email || !guest.phone || !guest.idProof) {
      setFeedback('error', 'Name, email, phone, and ID proof are required.');
      return;
    }

    const duplicateEmail = guests.some((currentGuest) => currentGuest.email.toLowerCase() === guest.email.toLowerCase());
    if (duplicateEmail) {
      setFeedback('error', `Guest with email ${guest.email} already exists.`);
      return;
    }

    setGuests((current) => [guest, ...current]);
    event.currentTarget.reset();
    setFeedback('success', `${guest.name} added with ID ${guest.id}.`);
  };

  const addBooking = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const guestId = formData.get('guestId');
    const roomNumber = Number(formData.get('roomNumber'));
    const checkInDate = formData.get('checkIn');
    const checkOutDate = formData.get('checkOut');
    const totalAmount = Number(formData.get('totalAmount'));

    const booking = {
      id: `B-${1000 + bookings.length + 1}`,
      guestId,
      roomNumber,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      status: 'reserved',
      source: formData.get('source'),
      totalAmount,
      paymentDate: null,
    };

    if (!booking.guestId || !booking.roomNumber || !booking.checkIn || !booking.checkOut || !booking.totalAmount) {
      setFeedback('error', 'Guest, room, dates, and amount are required to create a booking.');
      return;
    }

    if (booking.checkOut <= booking.checkIn) {
      setFeedback('error', 'Check-out date must be after check-in date.');
      return;
    }

    if (!guestsById[booking.guestId]) {
      setFeedback('error', 'Selected guest does not exist. Please choose a valid guest.');
      return;
    }

    if (isRoomBooked(booking.roomNumber, booking.checkIn, booking.checkOut)) {
      setFeedback('error', `Room ${booking.roomNumber} is already booked for those dates.`);
      return;
    }

    setBookings((current) => [booking, ...current]);
    event.currentTarget.reset();
    setFeedback('success', `${booking.id} created for room ${booking.roomNumber}.`);
  };

  const sendAlert = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const alert = {
      id: `A-${alerts.length + 1}`,
      channel: formData.get('channel'),
      recipient: formData.get('recipient').trim(),
      message: formData.get('message').trim(),
      time: new Date().toISOString(),
    };

    if (!alert.recipient || !alert.message) {
      setFeedback('error', 'Recipient and message are required for alerts.');
      return;
    }

    setAlerts((current) => [alert, ...current]);
    event.currentTarget.reset();
    setFeedback('success', `${alert.channel} alert queued for ${alert.recipient}.`);
  };

  const generate = (period) => {
    setReport(generateReport(bookings, guests, period));
    setFeedback('success', `${period[0].toUpperCase() + period.slice(1)} report generated.`);
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Digitized Front Desk Platform</p>
          <h1>Hotel Management Software</h1>
          <p className="muted">Mobile + web access with local caching for low internet environments.</p>
        </div>
        <div className={online ? 'status online' : 'status offline'}>{online ? 'Online Sync Active' : 'Offline Mode Active'}</div>
      </header>

      {notice.message && <section className={`notice ${notice.type}`}>{notice.message}</section>}

      <section className="workflow panel">
        <h3>User Workflow</h3>
        <ol>
          <li>Add or verify guest details in "Manage Guest Information".</li>
          <li>Create a reservation in "Create Reservation" (conflicts are blocked automatically).</li>
          <li>Use "Check-in / Check-out" to move booking status through stay lifecycle.</li>
          <li>Track expected arrivals, booking history, and send alerts when needed.</li>
          <li>Review calendar and generate monthly/quarterly/yearly reports.</li>
        </ol>
      </section>

      <section className="stats-grid">
        <StatCard title="Today's Income" value={currency.format(summary.todayIncome)} />
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>VIP</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td>{guest.id}</td>
                    <td>{guest.name}</td>
                    <td>{guest.phone}</td>
                    <td>{guest.vip ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <strong>{alert.channel}</strong> to {alert.recipient} - {alert.message}
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
