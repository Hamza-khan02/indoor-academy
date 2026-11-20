import { todayISO } from '@/lib/dates';

const SKILLS = [
  ['batting', 'Batting'],
  ['bowling', 'Bowling'],
  ['fielding', 'Fielding'],
  ['fitness', 'Fitness'],
] as const;

/** Fields for a coach's skill assessment (scores 1-10). */
export function AssessmentFields({ studentId, students }: { studentId?: string; students?: { id: string; name: string }[] }) {
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
      <label>Date *<input name="date" type="date" required max={todayISO()} defaultValue={todayISO()} /></label>
      <p className="form-hint">Score each skill from 1 (needs a lot of work) to 10 (excellent).</p>
      <div className="form-row four">
        {SKILLS.map(([key, label]) => (
          <label key={key}>{label} *<input name={key} type="number" min={1} max={10} step={1} required /></label>
        ))}
      </div>
      <label>Coach notes<textarea name="notes" rows={3} maxLength={500} placeholder="Strengths, what to work on next…" /></label>
    </>
  );
}
