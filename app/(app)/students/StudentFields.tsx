import { AGE_GROUPS, BLOOD_GROUPS, PLAYING_ROLES, STUDENT_STATUS } from '@/lib/constants';
import { todayISO } from '@/lib/dates';
import type { FormOptions } from '@/lib/queries';

type Student = {
  name: string; dob: string | null; ageGroup: string; playingRole: string | null; guardianName: string | null;
  guardianPhone: string; status: string; joinedOn: string; notes: string | null; branchId: string; batchId: string | null;
  bloodGroup: string | null; emergencyName: string | null; emergencyPhone: string | null; medicalNotes: string | null;
};

/** Form fields for creating or editing a student. */
export function StudentFields({ options, student }: { options: FormOptions; student?: Student }) {
  return (
    <>
      <label>Full name *<input name="name" required maxLength={80} defaultValue={student?.name} placeholder="e.g. Ananya Verma" /></label>
      <div className="form-row">
        <label>Date of birth<input name="dob" type="date" max={todayISO()} defaultValue={student?.dob ?? ''} /></label>
        <label>Age group *
          <select name="ageGroup" required defaultValue={student?.ageGroup ?? ''}>
            <option value="" disabled>Select</option>
            {AGE_GROUPS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>Playing role
          <select name="playingRole" defaultValue={student?.playingRole ?? ''}>
            <option value="">Not set</option>
            {PLAYING_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={student?.status ?? 'ACTIVE'}>
            {Object.entries(STUDENT_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>Branch *
          <select name="branchId" required defaultValue={student?.branchId ?? options.branches[0]?.id ?? ''}>
            {options.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>Batch
          <select name="batchId" defaultValue={student?.batchId ?? ''}>
            <option value="">No batch yet</option>
            {options.batches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.ageGroup}) · {b.branch.name}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>Parent / guardian name<input name="guardianName" maxLength={80} defaultValue={student?.guardianName ?? ''} /></label>
        <label>Parent / guardian phone *<input name="guardianPhone" required type="tel" defaultValue={student?.guardianPhone} placeholder="+91 98765 43210" /></label>
      </div>
      <label>Joining date<input name="joinedOn" type="date" defaultValue={student?.joinedOn ?? todayISO()} /></label>
      <label>Internal notes <small className="muted">(staff only)</small><textarea name="notes" rows={2} maxLength={500} defaultValue={student?.notes ?? ''} /></label>

      <fieldset className="form-section">
        <legend>Health &amp; emergency <small className="muted">(also shown to the family in the parent app)</small></legend>
        <div className="form-row">
          <label>Blood group
            <select name="bloodGroup" defaultValue={student?.bloodGroup ?? ''}>
              <option value="">Not known</option>
              {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <span />
        </div>
        <div className="form-row">
          <label>Emergency contact name<input name="emergencyName" maxLength={80} defaultValue={student?.emergencyName ?? ''} placeholder="If parents can't be reached" /></label>
          <label>Emergency contact phone<input name="emergencyPhone" type="tel" defaultValue={student?.emergencyPhone ?? ''} /></label>
        </div>
        <label>Medical notes<textarea name="medicalNotes" rows={2} maxLength={500} defaultValue={student?.medicalNotes ?? ''} placeholder="Allergies, asthma, past injuries, medicines…" /></label>
      </fieldset>
    </>
  );
}
