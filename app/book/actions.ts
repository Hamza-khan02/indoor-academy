'use server';

// Actions of the customer booking site. The person is always taken from their login cookie
// (an outside customer's booking account, or an academy family's parent app login), never from
// what the browser sends, and they can only touch their own bookings.
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { endParentSession } from '@/lib/family';
import { type ActionResult, FormError, email as emailField, run, text } from '@/lib/form';
import { whatsappNumber } from '@/lib/messages';
import { type Booker, bookerActor, endCustomerSession, getBooker, getCustomer, ownBookings, ownNotifications, startCustomerSession } from '@/lib/rentals/account';
import { customerSlots } from '@/lib/rentals/availability';
import { type BookingInput, cancelBooking, createBooking, previewBooking, rescheduleBooking } from '@/lib/rentals/booking';
import { audit } from '@/lib/rentals/core';
import { confirmCheckout, createOnlineOrder } from '@/lib/rentals/payments';

// 5 wrong passwords for a phone lock it for 15 minutes (in memory; resets when the server restarts).
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function passwordFrom(fd: FormData, key = 'password') {
  const value = String(fd.get(key) ?? '');
  if (value.length < 8) throw new FormError('The password must be at least 8 characters.');
  if (value.length > 100) throw new FormError('The password is too long.');
  return value;
}

export async function registerCustomer(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const name = text(fd, 'name', { required: true, label: 'Name', max: 80 });
    if (name.length < 2) throw new FormError('Enter your name.');
    const phone = text(fd, 'phone', { required: true, label: 'Phone number', max: 20 });
    const key = whatsappNumber(phone);
    if (!key || !/^[+\d\s-]+$/.test(phone)) throw new FormError('Enter a valid mobile number.');
    const email = emailField(fd, 'email', { label: 'Email' });
    const password = passwordFrom(fd);

    // One person, one account: academy families already have a login that also gives student prices.
    const [family, student, existing] = await Promise.all([
      db.familyLogin.findUnique({ where: { phoneKey: key }, select: { id: true } }),
      db.student.findFirst({ where: { guardianPhoneKey: key, status: { not: 'INACTIVE' } }, select: { id: true } }),
      db.rentalCustomer.findUnique({ where: { phoneKey: key }, select: { id: true } }),
    ]);
    if (family) throw new FormError('This number is registered with the academy. Log in under "Academy family" with your parent app PIN to book at student prices.');
    if (student) throw new FormError('This number belongs to an academy student. Ask the academy for your parent app PIN, then log in under "Academy family" to book at student prices.');
    if (existing) throw new FormError('An account with this number already exists. Please log in.');

    const customer = await db.rentalCustomer.create({ data: { name, phone, phoneKey: key, email, passwordHash: await bcrypt.hash(password, 10), lastLoginAt: new Date() } });
    await audit(db, { entity: 'CUSTOMER', entityId: customer.id, action: 'Customer registered', detail: name, actor: { type: 'CUSTOMER', name } });
    await startCustomerSession(customer);
    return `Welcome, ${name}`;
  });
}

export async function loginCustomer(fd: FormData): Promise<ActionResult> {
  const key = whatsappNumber(String(fd.get('phone') ?? ''));
  const password = String(fd.get('password') ?? '');
  if (!key || !password) return { ok: false, error: 'Enter your mobile number and password.' };
  const entry = failures.get(key);
  if (entry && entry.count >= MAX_FAILS && entry.until > Date.now()) return { ok: false, error: 'Too many wrong attempts. Try again in 15 minutes.' };

  const customer = await db.rentalCustomer.findUnique({ where: { phoneKey: key } });
  const valid = customer ? await bcrypt.compare(password, customer.passwordHash) : false;
  if (!customer || !valid) {
    failures.set(key, { count: entry && entry.until > Date.now() ? entry.count + 1 : 1, until: Date.now() + LOCK_MS });
    return { ok: false, error: 'Incorrect mobile number or password.' };
  }
  if (!customer.active) return { ok: false, error: 'This account has been switched off. Please contact the academy.' };
  failures.delete(key);
  await db.rentalCustomer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } });
  try {
    await startCustomerSession(customer);
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'Login is not available right now. Please contact the academy.' };
  }
  return { ok: true, message: `Welcome back, ${customer.name}` };
}

/** Logs out of the booking site (whichever login was used). */
export async function bookingLogout() {
  await endCustomerSession();
  await endParentSession();
  redirect('/book');
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

/** Free start times. Public: anyone can look before logging in. */
export async function publicSlots(facilityId: string, day: string, packageId: string | null) {
  const result = await customerSlots(String(facilityId), String(day), packageId ? String(packageId) : null);
  return result ? { slots: result.slots, wholeDayFree: result.wholeDayFree, dayOpen: result.dayOpen } : null;
}

/** Who is booking, from the login cookie. What the browser says about identity is ignored, except which child. */
function whoFor(booker: Booker | null, input: BookingInput): BookingInput['who'] {
  if (!booker) return { kind: 'WALK_IN', name: '', phone: '' }; // not logged in: can see prices, cannot book
  if (booker.kind === 'CUSTOMER') return { kind: 'CUSTOMER', customerId: booker.customerId };
  const wanted = input.who?.kind === 'FAMILY' ? input.who.studentId : '';
  return { kind: 'FAMILY', familyLoginId: booker.familyLoginId, studentId: booker.students.some((s) => s.id === wanted) ? wanted : booker.students[0]?.id ?? '' };
}

export async function customerQuote(input: BookingInput) {
  try {
    const booker = await getBooker();
    return { ok: true as const, ...(await previewBooking({ ...input, resourceId: null, who: whoFor(booker, input) }, { staff: false })) };
  } catch (e) {
    if (e instanceof FormError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function customerCreateBooking(input: BookingInput) {
  let id = '';
  const result = await run(async () => {
    const booker = await getBooker();
    if (!booker) throw new FormError('Please log in to book.');
    const booking = await createBooking({ ...input, resourceId: null, who: whoFor(booker, input) }, bookerActor(booker));
    id = booking.id;
    revalidatePath('/', 'layout');
    return booking.status === 'CONFIRMED' ? `Booking ${booking.code} confirmed` : `Booking ${booking.code} created`;
  });
  return { ...result, id };
}

async function own(bookingId: string) {
  const booker = await getBooker();
  if (!booker) throw new FormError('Please log in again.');
  const booking = await db.rentalBooking.findFirst({ where: { id: String(bookingId), ...ownBookings(booker) }, select: { id: true, facilityId: true, packageId: true } });
  if (!booking) throw new FormError('This booking was not found in your account.');
  return { booker, booking };
}

export async function cancelMyBooking(bookingId: string, fd: FormData) {
  return run(async () => {
    const { booker, booking } = await own(bookingId);
    const result = await cancelBooking(booking.id, bookerActor(booker), { byCustomer: true, reason: text(fd, 'reason', { label: 'Reason', max: 300 }) });
    revalidatePath('/', 'layout');
    return ['Booking cancelled.', result.charge > 0 ? `Cancellation charge: ₹${result.charge}.` : '', result.refund > 0 ? `₹${result.refund} will be refunded by the academy.` : ''].filter(Boolean).join(' ');
  });
}

export async function myRescheduleSlots(bookingId: string, day: string) {
  const { booking } = await own(bookingId);
  const result = await customerSlots(booking.facilityId, String(day), booking.packageId, { excludeBookingId: booking.id });
  return result ? { slots: result.slots, wholeDayFree: result.wholeDayFree, dayOpen: result.dayOpen } : null;
}

export async function rescheduleMyBooking(bookingId: string, change: { date: string; startMin: number | null; resourceId: string | null }) {
  return run(async () => {
    const { booker, booking } = await own(bookingId);
    await rescheduleBooking(booking.id, { date: String(change.date), startMin: change.startMin === null ? null : Number(change.startMin) }, bookerActor(booker), { byCustomer: true });
    revalidatePath('/', 'layout');
    return 'Your booking has been moved.';
  });
}

// ---------------------------------------------------------------------------
// Online payment
// ---------------------------------------------------------------------------

export async function startPayment(bookingId: string) {
  try {
    const { booker, booking } = await own(bookingId);
    const order = await createOnlineOrder(booking.id, bookerActor(booker));
    return { ok: true as const, order: { orderId: order.orderId, keyId: order.keyId, amountPaise: order.amountPaise, code: order.code, name: order.name, phone: order.phone, email: order.email } };
  } catch (e) {
    if (e instanceof FormError) return { ok: false as const, error: e.message };
    throw e;
  }
}

/** The browser hands over what Razorpay returned; the server verifies the signature before anything is marked paid. */
export async function confirmPayment(data: { orderId: string; paymentId: string; signature: string }) {
  try {
    if (!(await getBooker())) throw new FormError('Please log in again.');
    const result = await confirmCheckout({ orderId: String(data?.orderId ?? ''), paymentId: String(data?.paymentId ?? ''), signature: String(data?.signature ?? '') });
    revalidatePath('/', 'layout');
    return { ok: true as const, state: result.state };
  } catch (e) {
    if (e instanceof FormError) return { ok: false as const, error: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Profile and notifications
// ---------------------------------------------------------------------------

export async function updateProfile(fd: FormData) {
  return run(async () => {
    const customer = await getCustomer();
    if (!customer) throw new FormError('Please log in again.');
    const name = text(fd, 'name', { required: true, label: 'Name', max: 80 });
    await db.rentalCustomer.update({ where: { id: customer.id }, data: { name, email: emailField(fd, 'email', { label: 'Email' }) } });
    revalidatePath('/', 'layout');
    return 'Profile saved';
  });
}

export async function changeMyPassword(fd: FormData) {
  return run(async () => {
    const customer = await getCustomer();
    if (!customer) throw new FormError('Please log in again.');
    if (!(await bcrypt.compare(String(fd.get('current') ?? ''), customer.passwordHash))) throw new FormError('Your current password is incorrect.');
    const password = passwordFrom(fd);
    if (password !== String(fd.get('confirm') ?? '')) throw new FormError('The new passwords do not match.');
    // Other devices are logged out; this one gets a fresh session.
    const updated = await db.rentalCustomer.update({ where: { id: customer.id }, data: { passwordHash: await bcrypt.hash(password, 10), sessionVersion: { increment: 1 } } });
    await startCustomerSession(updated);
    return 'Password changed';
  });
}

export async function markNotificationsRead() {
  const booker = await getBooker();
  if (!booker) return;
  await db.rentalNotification.updateMany({ where: { ...ownNotifications(booker), readAt: null }, data: { readAt: new Date() } });
  revalidatePath('/book/account');
}
