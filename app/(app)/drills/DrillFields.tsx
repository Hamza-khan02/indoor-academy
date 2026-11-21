import { DRILL_CATEGORIES } from '@/lib/drills';

type Opt = { id: string; name: string };
type Values = { title: string; instructions: string; videoUrl: string | null; category: string; dueOn: string | null; batchId: string | null; studentIds: string[] };

/** Fields for setting a drill. "Who should do it" is a batch, or the students ticked below. */
export function DrillFields({
  batches,
  students,
  drill,
}: {
  batches: (Opt & { branch: { name: string } })[];
  students: (Opt & { batch: { name: string } | null })[];
  drill?: Values;
}) {
  const target = drill ? (drill.batchId ? `BATCH:${drill.batchId}` : 'STUDENTS') : batches[0] ? `BATCH:${batches[0].id}` : 'STUDENTS';
  const picked = new Set(drill?.studentIds ?? []);
  return (
    <>
      <label>Title *<input name="title" required maxLength={120} defaultValue={drill?.title} placeholder="e.g. 50 shadow cover drives daily" /></label>
      <label>How to do it *<textarea name="instructions" required rows={4} maxLength={2000} defaultValue={drill?.instructions} placeholder="Steps, sets/reps, what to focus on…" /></label>
      <div className="form-row">
        <label>Category
          <select name="category" defaultValue={drill?.category ?? 'BATTING'}>
            {Object.entries(DRILL_CATEGORIES).map(([v, c]) => <option key={v} value={v}>{c.emoji} {c.label}</option>)}
          </select>
        </label>
        <label>Complete by <small className="muted">(optional)</small><input name="dueOn" type="date" defaultValue={drill?.dueOn ?? ''} /></label>
      </div>
      <label>Video link <small className="muted">(optional, e.g. YouTube)</small><input name="videoUrl" type="url" maxLength={300} defaultValue={drill?.videoUrl ?? ''} placeholder="https://youtube.com/…" /></label>
      <label>Who should do it *
        <select name="target" defaultValue={target}>
          {batches.map((b) => <option key={b.id} value={`BATCH:${b.id}`}>Whole batch: {b.name} · {b.branch.name}</option>)}
          <option value="STUDENTS">Only the students ticked below</option>
        </select>
      </label>
      <details className="student-picker" open={target === 'STUDENTS'}>
        <summary>Pick students ({students.length})</summary>
        <ul>
          {students.map((s) => (
            <li key={s.id}>
              <label className="inline-check"><input type="checkbox" name="studentIds" value={s.id} defaultChecked={picked.has(s.id)} /> {s.name} <small className="muted">{s.batch?.name ?? 'no batch'}</small></label>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
