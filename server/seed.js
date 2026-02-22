const iso = (date) => new Date(date).toISOString().slice(0, 10);

export function createSeedData() {
  const today = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  return {
    rooms: [
      { number: 101, type: 'Single', price: 3200 },
      { number: 102, type: 'Single', price: 3200 },
      { number: 103, type: 'Single', price: 3400 },
      { number: 201, type: 'Double', price: 5200 },
      { number: 202, type: 'Double', price: 5200 },
      { number: 203, type: 'Double', price: 5500 },
      { number: 301, type: 'Suite', price: 7800 },
      { number: 302, type: 'Suite', price: 8200 },
    ],
    guests: [
      {
        id: 'G-001',
        name: 'Arjun Mehta',
        email: 'arjun.mehta@example.com',
        phone: '+91-9988776655',
        idProof: 'Passport',
        vip: true,
        notes: 'Airport pickup required',
      },
      {
        id: 'G-002',
        name: 'Priya Rao',
        email: 'priya.rao@example.com',
        phone: '+91-9922334455',
        idProof: 'Driver License',
        vip: false,
        notes: 'Late check-in after 9 PM',
      },
      {
        id: 'G-003',
        name: 'Noah Miller',
        email: 'noah.miller@example.com',
        phone: '+1-415-555-0172',
        idProof: 'Passport',
        vip: false,
        notes: 'Prefers higher floor',
      },
    ],
    bookings: [
      {
        id: 'B-1001',
        guestId: 'G-001',
        roomNumber: 301,
        checkIn: iso(today),
        checkOut: iso(today.getTime() + oneDay),
        status: 'reserved',
        source: 'Website',
        totalAmount: 7800,
        paymentDate: null,
      },
      {
        id: 'B-1002',
        guestId: 'G-002',
        roomNumber: 202,
        checkIn: iso(today.getTime() - oneDay),
        checkOut: iso(today),
        status: 'checked-out',
        source: 'Walk-in',
        totalAmount: 5200,
        paymentDate: iso(today),
      },
      {
        id: 'B-1003',
        guestId: 'G-003',
        roomNumber: 103,
        checkIn: iso(today),
        checkOut: iso(today.getTime() + 2 * oneDay),
        status: 'checked-in',
        source: 'Travel Agent',
        totalAmount: 6800,
        paymentDate: null,
      },
    ],
    alerts: [
      {
        id: 'A-1',
        channel: 'Email',
        recipient: 'arjun.mehta@example.com',
        message: 'Your room is prepared for check-in.',
        time: new Date().toISOString(),
        deliveryStatus: 'seeded',
      },
      {
        id: 'A-2',
        channel: 'SMS',
        recipient: '+91-9922334455',
        message: 'Reminder: checkout is scheduled today at 12:00 PM.',
        time: new Date(Date.now() - 45 * 60000).toISOString(),
        deliveryStatus: 'seeded',
      },
    ],
  };
}
