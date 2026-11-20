import { PAYMENT_METHODS } from '@/lib/constants';
import { currentMonth, todayISO } from '@/lib/dates';

/** Fields for recording a fee payment. Pass `studentId` to fix the student, or `students` to pick one. */
export function PaymentFields({
  studentId,
  students,
  amount,
  forMonth = currentMonth(),
}: {
  studentId?: string;
  students?: { id: string; name: string }[];
  amount?: number;
  forMonth?: string;
}) {
  return (
    <>
      {studentId ? (
        <input type="hidden" name="studentId" value={studentId} />
      ) : (
        <label>Student *
          <select name="studentId" required defaultValue="">
            <option value="" disabled>Select student</option>
            {students?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      <div className="form-row">
        <label>Amount (₹) *<input name="amount" type="number" min={1} step={1} required defaultValue={amount || ''} /></label>
        <label>Fee for month *<input name="forMonth" type="month" required defaultValue={forMonth} /></label>
      </div>
      <div className="form-row">
        <label>Paid on *<input name="paidOn" type="date" required max={todayISO()} defaultValue={todayISO()} /></label>
        <label>Method *
          <select name="method" defaultValue="CASH">
            {Object.entries(PAYMENT_METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <label>Reference / receipt no.<input name="reference" maxLength={100} placeholder="UPI ref, receipt number…" /></label>
    </>
  );
}
