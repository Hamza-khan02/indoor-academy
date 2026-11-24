import Link from 'next/link';
import { Download, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { photoUrl } from '@/lib/photos';
import { requireUser } from '@/lib/auth';
import { addDays, todayISO } from '@/lib/dates';
import { STUDENT_STATUS } from '@/lib/constants';
import { attendanceByStudent, formOptions } from '@/lib/queries';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { AttendanceBar, Avatar, Empty, PageHeader, StatusPill } from '@/components/ui';
import { StudentFields } from './StudentFields';
import { createStudent, deleteStudent, updateStudent } from './actions';

type Search = { q?: string; branch?: string; batch?: string; status?: string };

export default async function StudentsPage(props: { searchParams: Promise<Search> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const q = searchParams.q?.trim() ?? '';
  const options = await formOptions();

  const students = await db.student.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q } }, { guardianPhone: { contains: q } }, { guardianName: { contains: q } }] } : {}),
      ...(searchParams.branch ? { branchId: searchParams.branch } : {}),
      ...(searchParams.batch ? { batchId: searchParams.batch } : {}),
      ...(searchParams.status ? { status: searchParams.status } : {}),
    },
    include: { batch: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  const attendance = await attendanceByStudent(students.map((s) => s.id), addDays(todayISO(), -29));
  const filtered = Boolean(q || searchParams.branch || searchParams.batch || searchParams.status);

  const addButton = options.branches.length > 0 && (
    <FormModal title="Add new student" eyebrow="PLAYER ENROLLMENT" description="Create a student record in your academy." trigger={<><Plus size={17} /> Add student</>} action={createStudent} submitLabel="Create student">
      <StudentFields options={options} />
    </FormModal>
  );

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="All players enrolled at the academy. Attendance is for the last 30 days."
        actions={<>
          {isAdmin && <a className="secondary-btn" href="/api/export/students"><Download size={16} /> Export CSV</a>}
          {addButton}
        </>}
      />

      <form className="filters panel" method="get">
        <input name="q" defaultValue={q} placeholder="Name, guardian or phone" aria-label="Search" />
        <select name="branch" defaultValue={searchParams.branch ?? ''} aria-label="Branch">
          <option value="">All branches</option>
          {options.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select name="batch" defaultValue={searchParams.batch ?? ''} aria-label="Batch">
          <option value="">All batches</option>
          {options.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ''} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(STUDENT_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="secondary-btn">Apply</button>
        {filtered && <Link className="text-btn" href="/students">Clear</Link>}
      </form>

      <article className="panel padded">
        {options.branches.length === 0 ? (
          <Empty title="Add a branch first">Students belong to a branch. {isAdmin ? <Link href="/branches">Create a branch</Link> : 'Ask an administrator to create one.'}</Empty>
        ) : students.length === 0 ? (
          filtered ? <Empty title="No students match these filters" /> : <Empty title="No students yet" action={addButton}>Add your first student to start tracking attendance, fees and performance.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>PLAYER</th><th>BATCH</th><th>BRANCH</th><th>GUARDIAN</th><th>ATTENDANCE</th><th>STATUS</th><th /></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/students/${s.id}`} className="player-cell">
                        <Avatar name={s.name} photo={photoUrl(s)} />
                        <div><b>{s.name}</b><small>{s.ageGroup}{s.playingRole ? ` · ${s.playingRole}` : ''}</small></div>
                      </Link>
                    </td>
                    <td>{s.batch ? <span className="batch-tag">{s.batch.name}</span> : <small className="muted">Not assigned</small>}</td>
                    <td>{s.branch.name}</td>
                    <td><div className="stack"><span>{s.guardianName ?? '—'}</span><small className="muted">{s.guardianPhone}</small></div></td>
                    <td><AttendanceBar pct={attendance.get(s.id) ?? null} /></td>
                    <td><StatusPill status={s.status} /></td>
                    <td>
                      <div className="row-actions">
                        <Link className="icon-action" href={`/students/${s.id}`} aria-label="View" title="View"><Eye size={15} /></Link>
                        <FormModal title={`Edit ${s.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={updateStudent.bind(null, s.id)}>
                          <StudentFields options={options} student={s} />
                        </FormModal>
                        {isAdmin && (
                          <ConfirmAction action={deleteStudent.bind(null, s.id)} confirmText={`Delete ${s.name}? Their attendance, fee and assessment records will also be deleted. This cannot be undone.`} label="Delete">
                            <Trash2 size={15} />
                          </ConfirmAction>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {students.length > 0 && <div className="table-bottom"><span>Showing <b>{students.length}</b> {students.length === 1 ? 'student' : 'students'}</span></div>}
      </article>
    </>
  );
}
