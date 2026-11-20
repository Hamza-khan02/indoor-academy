'use client';

import { useState } from 'react';
import { CheckCheck, Save } from 'lucide-react';
import type { ActionResult } from '@/lib/form';
import { useToast } from '@/components/Toast';
import { WhatsAppButton } from '@/components/WhatsAppButton';

type Row = { id: string; name: string; detail: string; status: string; noticeUrl: string | null; notified: boolean; medical: string | null };
const OPTIONS = [
  ['PRESENT', 'P', 'Present'],
  ['LATE', 'L', 'Late'],
  ['ABSENT', 'A', 'Absent'],
] as const;

export function AttendanceSheet({ students, day, action }: { students: Row[]; day: string; action: (fd: FormData) => Promise<ActionResult> }) {
  const toast = useToast();
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.id, s.status])));
  const [pending, setPending] = useState(false);

  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0, '': 0 } as Record<string, number>;
  for (const s of students) counts[marks[s.id] ?? '']++;

  const set = (id: string, status: string) => setMarks((m) => ({ ...m, [id]: m[id] === status ? '' : status }));

  async function save() {
    const fd = new FormData();
    for (const s of students) fd.set(`s_${s.id}`, marks[s.id] ?? '');
    setPending(true);
    try {
      const r = await action(fd);
      toast(r.ok ? r.message : r.error, r.ok ? 'success' : 'error');
    } catch {
      toast('Could not reach the server. Please try again.', 'error');
    }
    setPending(false);
  }

  return (
    <>
      <div className="sheet-toolbar">
        <span className="sheet-counts">
          <b className="c-present">{counts.PRESENT} present</b> · <b className="c-late">{counts.LATE} late</b> · <b className="c-absent">{counts.ABSENT} absent</b>
          {counts[''] > 0 && <> · <span className="muted">{counts['']} not marked</span></>}
        </span>
        <button type="button" className="secondary-btn" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'PRESENT'])))}>
          <CheckCheck size={15} /> Mark all present
        </button>
      </div>
      <ul className="sheet">
        {students.map((s) => (
          <li key={s.id}>
            <div className="stack"><b>{s.name}{s.medical && <span className="medical-flag" title={`Medical: ${s.medical}`}> ⚕</span>}</b><small className="muted">{s.detail}</small>{s.medical && <small className="medical-note">{s.medical}</small>}</div>
            {marks[s.id] === 'ABSENT' && (
              <div className="wa-cell end">
                {s.notified && <small className="muted">Parent notified</small>}
                <WhatsAppButton
                  href={s.noticeUrl}
                  log={{ studentId: s.id, kind: 'ABSENT', ref: day }}
                  label={s.notified ? 'Again' : 'Notify parent'}
                  compact={s.notified}
                />
              </div>
            )}
            <div className="seg" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
              {OPTIONS.map(([value, short, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={marks[s.id] === value}
                  title={label}
                  className={`seg-${value.toLowerCase()} ${marks[s.id] === value ? 'on' : ''}`}
                  onClick={() => set(s.id, value)}
                >
                  {short}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="sheet-save">
        <button type="button" className="primary-btn" onClick={save} disabled={pending}>
          <Save size={15} /> {pending ? 'Saving…' : 'Save attendance'}
        </button>
      </div>
    </>
  );
}
