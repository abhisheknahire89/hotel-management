export const initialRooms = [
  { number: 101, type: 'Single', price: 3200 },
  { number: 102, type: 'Single', price: 3200 },
  { number: 103, type: 'Single', price: 3400 },
  { number: 201, type: 'Double', price: 5200 },
  { number: 202, type: 'Double', price: 5200 },
  { number: 203, type: 'Double', price: 5500 },
  { number: 301, type: 'Suite', price: 7800 },
  { number: 302, type: 'Suite', price: 8200 },
];

export const initialGuests = [
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
];

const iso = (date) => new Date(date).toISOString().slice(0, 10);
const today = new Date();
const oneDay = 24 * 60 * 60 * 1000;

export const initialBookings = [
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
];

export const initialAlerts = [
  {
    id: 'A-1',
    channel: 'Email',
    recipient: 'arjun.mehta@example.com',
    message: 'Your room is prepared for check-in.',
    time: new Date().toISOString(),
  },
  {
    id: 'A-2',
    channel: 'SMS',
    recipient: '+91-9922334455',
    message: 'Reminder: checkout is scheduled today at 12:00 PM.',
    time: new Date(Date.now() - 45 * 60000).toISOString(),
  },
];

export const initialRestaurantMenu = [
  { id: 'M-001', name: 'Nashik Misal Pav', category: 'Breakfast', price: 120, isVeg: true, spiceLevel: 'high' },
  { id: 'M-002', name: 'Sabudana Khichdi', category: 'Breakfast', price: 110, isVeg: true, spiceLevel: 'mild' },
  { id: 'M-003', name: 'Thalipeeth with Curd', category: 'Breakfast', price: 130, isVeg: true, spiceLevel: 'mild' },
  { id: 'M-004', name: 'Kanda Bhaji', category: 'Starter', price: 140, isVeg: true, spiceLevel: 'medium' },
  { id: 'M-005', name: 'Kothimbir Vadi', category: 'Starter', price: 150, isVeg: true, spiceLevel: 'medium' },
  { id: 'M-006', name: 'Pithla Bhakri', category: 'Main Course', price: 220, isVeg: true, spiceLevel: 'medium' },
  { id: 'M-007', name: 'Bharli Vangi', category: 'Main Course', price: 240, isVeg: true, spiceLevel: 'medium' },
  { id: 'M-008', name: 'Matki Usal', category: 'Main Course', price: 200, isVeg: true, spiceLevel: 'medium' },
  { id: 'M-009', name: 'Maharashtrian Veg Thali', category: 'Main Course', price: 320, isVeg: true, spiceLevel: 'medium' },
  { id: 'M-010', name: 'Varan Bhaat with Tup', category: 'Main Course', price: 190, isVeg: true, spiceLevel: 'mild' },
  { id: 'M-011', name: 'Solkadhi', category: 'Beverage', price: 85, isVeg: true, spiceLevel: 'mild' },
  { id: 'M-012', name: 'Taak (Spiced Buttermilk)', category: 'Beverage', price: 60, isVeg: true, spiceLevel: 'mild' },
  { id: 'M-013', name: 'Puran Poli', category: 'Dessert', price: 140, isVeg: true, spiceLevel: 'mild' },
  { id: 'M-014', name: 'Shrikhand', category: 'Dessert', price: 120, isVeg: true, spiceLevel: 'mild' },
];

export const initialRestaurantOrders = [
  {
    id: 'R-001',
    guestId: 'G-001',
    roomNumber: 301,
    table: 'G-04',
    items: [
      { menuId: 'M-009', name: 'Maharashtrian Veg Thali', price: 320, qty: 2, lineTotal: 640 },
      { menuId: 'M-011', name: 'Solkadhi', price: 85, qty: 2, lineTotal: 170 },
    ],
    subtotal: 810,
    taxPercent: 5,
    taxAmount: 41,
    serviceChargePercent: 5,
    serviceChargeAmount: 41,
    totalAmount: 892,
    paymentMode: 'Card',
    billedBy: 'Front Desk',
    notes: 'Guest requested less spicy',
    status: 'paid',
    orderedAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
  },
  {
    id: 'R-002',
    guestId: null,
    roomNumber: null,
    table: 'G-02',
    items: [
      { menuId: 'M-001', name: 'Nashik Misal Pav', price: 120, qty: 2, lineTotal: 240 },
      { menuId: 'M-004', name: 'Kanda Bhaji', price: 140, qty: 1, lineTotal: 140 },
      { menuId: 'M-012', name: 'Taak (Spiced Buttermilk)', price: 60, qty: 2, lineTotal: 120 },
    ],
    subtotal: 500,
    taxPercent: 5,
    taxAmount: 25,
    serviceChargePercent: 5,
    serviceChargeAmount: 25,
    totalAmount: 550,
    paymentMode: null,
    billedBy: 'Restaurant Cashier',
    notes: '',
    status: 'open',
    orderedAt: new Date(Date.now() - 40 * 60000).toISOString(),
    paidAt: null,
  },
];
