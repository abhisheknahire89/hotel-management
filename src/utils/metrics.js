export function getTodayIncome(bookings, todayIso) {
  return bookings
    .filter((booking) => booking.paymentDate === todayIso)
    .reduce((sum, booking) => sum + booking.totalAmount, 0);
}

export function getRestaurantIncomeToday(restaurantOrders, todayIso) {
  return restaurantOrders
    .filter((order) => order.status === 'paid' && String(order.paidAt || '').slice(0, 10) === todayIso)
    .reduce((sum, order) => sum + (order.totalAmount || order.amount || 0), 0);
}

export function getOccupiedRooms(bookings, todayIso) {
  return bookings.filter((booking) => {
    const active = booking.status === 'checked-in' || booking.status === 'reserved';
    return active && booking.checkIn <= todayIso && booking.checkOut >= todayIso;
  }).length;
}

export function getOccupancyRate(bookings, rooms, todayIso) {
  if (rooms.length === 0) return 0;
  return Math.round((getOccupiedRooms(bookings, todayIso) / rooms.length) * 100);
}

export function getRevenuePerRoom(bookings, rooms, todayIso) {
  if (rooms.length === 0) return 0;
  const totalRevenue = bookings
    .filter((booking) => booking.paymentDate === todayIso)
    .reduce((sum, booking) => sum + booking.totalAmount, 0);
  return Math.round(totalRevenue / rooms.length);
}

export function getGuestsCountToday(bookings, todayIso) {
  return bookings.filter((booking) => booking.checkIn <= todayIso && booking.checkOut >= todayIso).length;
}

export function generateReport(bookings, guests, period) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const currentMonth = now.getMonth();

  const filtered = bookings.filter((booking) => {
    const date = new Date(booking.checkIn);
    if (period === 'monthly') {
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    }
    if (period === 'quarterly') {
      return date.getFullYear() === currentYear && Math.floor(date.getMonth() / 3) === currentQuarter;
    }
    return date.getFullYear() === currentYear;
  });

  const revenue = filtered.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const checkedOut = filtered.filter((booking) => booking.status === 'checked-out').length;

  return {
    period,
    totalBookings: filtered.length,
    completedStays: checkedOut,
    activeGuests: new Set(filtered.map((booking) => booking.guestId)).size,
    revenue,
    generatedAt: now.toISOString(),
    topGuests: guests
      .map((guest) => ({
        name: guest.name,
        stays: filtered.filter((booking) => booking.guestId === guest.id).length,
      }))
      .filter((guest) => guest.stays > 0)
      .sort((a, b) => b.stays - a.stays)
      .slice(0, 5),
  };
}
