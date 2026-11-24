import Link from 'next/link';
import { KeyRound, Power, PowerOff } from 'lucide-react';
import { db } from '@/lib/db';
import { formatDate, todayISO } from '@/lib/dates';
import { inr } from '@/lib/format';
import { EARNING } from '@/lib/rentals/constants';
import { requireRental } from '@/lib/rentals/staff';
import { ConfirmAction } from '@/components/ConfirmAction';
import { FormModal } from '@/components/FormModal';
import { Empty, PageHeader } from '@/components/ui';
import { Chip } from '@/components/rentals/ui';
import { resetCustomerPassword, setCustomerActive } from '../actions';

/** Outside customers with a booking account, and what each has booked and paid. */
export default async function CustomersPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await props.searchParams;
  await requireRental('config');
  const term = q.trim();
  const customers = await db.rentalCustomer.findMany({
    where: term ? { OR: [{ name: { contains: term } }, { phone: { contains: term } }, { email: { contains: term } }] } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { bookings: { select: { status: true, total: true, paid: true, date: true } } },
  });

  return (
    <>
      <PageHeader title="Customers" subtitle="Outside customers who registered to book. Academy families book with their parent app login and are listed under Students." />
      <form className="panel filters" method="get">
        <input name="q" defaultValue={term} placeholder="Search name, phone or email" aria-label="Search customers" />
        <button className="secondary-btn">Search</button>
        {term && <Link className="text-btn" href="/bookings/customers">Clear</Link>}
      </form>
      <article className="panel padded">
        {customers.length === 0 ? <Empty title={term ? 'No customer matches' : 'No customers yet'}>Customers appear here when they register on the booking site.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>CUSTOMER</th><th>CONTACT</th><th>JOINED</th><th className="rn-num">BOOKINGS</th><th className="rn-num">SPENT</th><th>LAST BOOKING</th><th>ACCOUNT</th><th /></tr></thead>
              <tbody>
                {customers.map((c) => {
                  const earning = c.bookings.filter((b) => EARNING.includes(b.status));
                  const last = c.bookings.map((b) => b.date).sort().at(-1);
                  return (
                    <tr key={c.id}>
                      <td><b>{c.name}</b></td>
                      <td><div className="stack"><span>{c.phone}</span><small className="muted">{c.email ?? ''}</small></div></td>
                      <td>{formatDate(todayISO(c.createdAt))}</td>
                      <td className="rn-num">{c.bookings.length}</td>
                      <td className="rn-num">{inr(earning.reduce((t, b) => t + b.total, 0))}</td>
                      <td>{last ? formatDate(last) : <span className="muted">None</span>}</td>
                      <td>{c.active ? <Chip tone="green">Active</Chip> : <Chip tone="grey">Switched off</Chip>}</td>
                      <td>
                        <div className="row-actions">
                          <Link className="text-btn" href={`/bookings/list?customer=${c.id}`}>History</Link>
                          <FormModal title={`New password for ${c.name}`} description="Use this when a customer has forgotten their password. Tell them the new one privately." trigger={<KeyRound size={15} />} triggerClassName="icon-action" triggerLabel="Set a new password" action={resetCustomerPassword.bind(null, c.id)} submitLabel="Set password">
                            <label>New password * <small className="muted">(at least 8 characters)</small><input name="password" type="text" minLength={8} required autoComplete="off" /></label>
                          </FormModal>
                          <ConfirmAction
                            action={setCustomerActive.bind(null, c.id, !c.active)}
                            confirmText={c.active ? `Switch off ${c.name}'s booking account? They will be logged out and cannot book.` : `Switch ${c.name}'s account back on?`}
                            className="icon-action" label={c.active ? 'Switch off' : 'Switch on'}
                          >
                            {c.active ? <PowerOff size={15} /> : <Power size={15} />}
                          </ConfirmAction>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}
