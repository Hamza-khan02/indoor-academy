// Booking & rental: fixed lists, labels and rules. Pure data, safe in client and server code.

export const CATEGORIES: Record<string, { label: string; unit: string; emoji: string }> = {
  NETS: { label: 'Cricket nets', unit: 'Net', emoji: '🏏' },
  TURF: { label: 'Turf / ground', unit: 'Ground', emoji: '🟩' },
  PITCH: { label: 'Practice pitch', unit: 'Pitch', emoji: '🎯' },
  BOWLING_MACHINE: { label: 'Bowling machine', unit: 'Machine', emoji: '⚙️' },
  EQUIPMENT: { label: 'Equipment rental', unit: 'Counter', emoji: '🎒' },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const FACILITY_STATUS: Record<string, string> = { ACTIVE: 'Open for booking', MAINTENANCE: 'Under maintenance', INACTIVE: 'Switched off' };
export const RESOURCE_STATUS: Record<string, string> = { ACTIVE: 'Available', MAINTENANCE: 'Under maintenance', INACTIVE: 'Switched off' };

/** `minutes` is the length of one pricing unit; 0 = not time based. */
export const PRICE_UNITS: Record<string, { label: string; short: string; minutes: number }> = {
  PER_30_MIN: { label: 'Per 30 minutes', short: '30 min', minutes: 30 },
  PER_HOUR: { label: 'Per hour', short: 'hour', minutes: 60 },
  PER_SESSION: { label: 'Per session (one slot)', short: 'session', minutes: 0 },
  PER_DAY: { label: 'Per day (whole day)', short: 'day', minutes: 0 },
  PER_ITEM: { label: 'Per item (equipment only)', short: 'item', minutes: 0 },
};
export const SLOT_LENGTHS = [30, 60, 90, 120];

export const PACKAGE_KINDS: Record<string, { label: string; net: boolean; operator: boolean; balls: boolean }> = {
  MACHINE_ONLY: { label: 'Machine only', net: false, operator: false, balls: false },
  MACHINE_NET: { label: 'Machine + cricket net', net: true, operator: false, balls: false },
  MACHINE_OPERATOR: { label: 'Machine + operator', net: false, operator: true, balls: false },
  MACHINE_BALLS: { label: 'Machine + balls', net: false, operator: false, balls: true },
  COMPLETE: { label: 'Complete package (machine + net + balls + operator)', net: true, operator: true, balls: true },
  CUSTOM: { label: 'Custom package', net: false, operator: false, balls: false },
};
export const MACHINE_PACKAGE_KINDS = ['MACHINE_ONLY', 'MACHINE_NET', 'MACHINE_OPERATOR', 'MACHINE_BALLS', 'COMPLETE'];

// ---- Booking status workflow ----

export const BOOKING_STATUS: Record<string, { label: string; tone: 'green' | 'red' | 'amber' | 'grey' | 'blue' }> = {
  PENDING: { label: 'Pending approval', tone: 'amber' },
  PAYMENT_PENDING: { label: 'Payment pending', tone: 'amber' },
  CONFIRMED: { label: 'Confirmed', tone: 'red' },
  CHECKED_IN: { label: 'Checked in', tone: 'blue' },
  IN_PROGRESS: { label: 'In progress', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'grey' },
  REJECTED: { label: 'Rejected', tone: 'grey' },
  EXPIRED: { label: 'Expired', tone: 'grey' },
  NO_SHOW: { label: 'No-show', tone: 'grey' },
  REFUNDED: { label: 'Refunded', tone: 'grey' },
};

/** The only status changes the system allows: from -> to. Everything else is refused on the server. */
export const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAYMENT_PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  PAYMENT_PENDING: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: ['REFUNDED'],
  REJECTED: ['REFUNDED'],
  NO_SHOW: ['REFUNDED'],
  EXPIRED: ['REFUNDED'],
  REFUNDED: [],
};
export const canTransition = (from: string, to: string) => (TRANSITIONS[from] ?? []).includes(to);

/** Bookings in these statuses hold their time slots and equipment. */
export const HOLDING = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];
/** Still to happen (shown as "upcoming"). */
export const UPCOMING = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'];
/** Reaching one of these frees the slots and any equipment not yet handed out. */
export const RELEASING = ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'];
/** Counted as income-earning bookings in reports. */
export const EARNING = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];

// ---- Calendar colours (the legend customers and staff see) ----
export const SLOT_STATES: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: 'Available', tone: 'green' },
  BOOKED: { label: 'Booked', tone: 'red' },
  PENDING: { label: 'Pending', tone: 'amber' },
  BLOCKED: { label: 'Maintenance / blocked', tone: 'grey' },
  CHECKED_IN: { label: 'Checked in', tone: 'blue' },
};
export function slotState(status: string) {
  if (status === 'PENDING' || status === 'PAYMENT_PENDING') return 'PENDING';
  if (status === 'CHECKED_IN' || status === 'IN_PROGRESS') return 'CHECKED_IN';
  return 'BOOKED';
}

// ---- Equipment ----
export const EQUIPMENT_CATEGORIES: Record<string, string> = {
  BAT: 'Cricket bats', BALL: 'Cricket balls', PADS: 'Batting pads', GLOVES: 'Batting gloves', HELMET: 'Helmets', STUMPS: 'Stumps', OTHER: 'Other equipment',
};
export const EQUIPMENT_CONDITIONS: Record<string, string> = { GOOD: 'Good', FAIR: 'Fair', WORN: 'Worn' };
export const EQUIPMENT_PRICE_UNITS: Record<string, string> = { PER_ITEM: 'Per item, per booking', PER_DAY: 'Per item, per day' };
export const LINE_STATUS: Record<string, { label: string; tone: string }> = {
  RESERVED: { label: 'Reserved', tone: 'amber' },
  ISSUED: { label: 'Issued', tone: 'blue' },
  RETURNED: { label: 'Returned, to inspect', tone: 'red' },
  INSPECTED: { label: 'Inspected, back in stock', tone: 'green' },
  RELEASED: { label: 'Released', tone: 'grey' },
};

// ---- Payments ----
export const OFFLINE_METHODS: Record<string, string> = { CASH: 'Cash', UPI_QR: 'UPI QR', CARD: 'Card', BANK: 'Bank transfer' };
export const PAYMENT_METHODS: Record<string, string> = { ...OFFLINE_METHODS, ONLINE: 'Online (Razorpay)' };
export const PAYMENT_STATUS: Record<string, string> = { CREATED: 'Started, not paid', PAID: 'Paid', FAILED: 'Failed' };
export const REFUND_STATUS: Record<string, string> = { PENDING: 'To be refunded', PROCESSED: 'Refunded', REJECTED: 'Refund declined' };

/** Paid / part paid / unpaid, worked out from the booking's own numbers. */
export function paymentState(b: { total: number; deposit: number; paid: number; status: string }) {
  const due = b.total + b.deposit - b.paid;
  if (RELEASING.includes(b.status) || b.status === 'REFUNDED') return b.paid > 0 ? 'Refund due' : 'Nothing paid';
  if (b.total + b.deposit === 0) return 'Free';
  if (due <= 0) return 'Paid in full';
  return b.paid > 0 ? 'Part paid' : 'Unpaid';
}

// ---- Roles ----
// Owner / Super Admin and Admin are the app's ADMIN role (full access). RECEPTIONIST works the
// bookings desk. COACH only sees schedules. Customers and families are checked separately.
export type RentalPermission =
  | 'schedule' // see the calendar
  | 'view' // see bookings and their details
  | 'create' // create bookings for customers
  | 'checkin' // mark customers as arrived
  | 'payOffline' // record cash / UPI QR / card / bank payments
  | 'manage' // approve, reject, cancel, reschedule, complete, equipment hand-over
  | 'refund' // refunds
  | 'config' // facilities, machines, equipment, pricing, promo codes, settings
  | 'reports'; // revenue and reports

const ALL: RentalPermission[] = ['schedule', 'view', 'create', 'checkin', 'payOffline', 'manage', 'refund', 'config', 'reports'];
export const ROLE_PERMISSIONS: Record<string, RentalPermission[]> = {
  ADMIN: ALL,
  RECEPTIONIST: ['schedule', 'view', 'create', 'checkin', 'payOffline'],
  COACH: ['schedule'],
};
export const can = (role: string, permission: RentalPermission) => (ROLE_PERMISSIONS[role] ?? []).includes(permission);

export const NOTIFICATION_TYPES: Record<string, string> = {
  BOOKING_RECEIVED: 'Booking received',
  BOOKING_CONFIRMED: 'Booking confirmation',
  PAYMENT: 'Payment confirmation',
  REMINDER: 'Booking reminder',
  CANCELLED: 'Cancellation',
  RESCHEDULED: 'Rescheduling',
  RETURN_REMINDER: 'Equipment return reminder',
  REFUND: 'Refund confirmation',
  REJECTED: 'Booking not approved',
  EXPIRED: 'Booking expired',
};
