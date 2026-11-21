import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatDate, todayISO } from '@/lib/dates';
import { audienceLabel, noticeShareText, whatsappShareUrl } from '@/lib/notices';
import { getSettings } from '@/lib/settings';
import { FormModal } from '@/components/FormModal';
import { ConfirmAction } from '@/components/ConfirmAction';
import { CopyButton } from '@/components/CopyButton';
import { Empty, PageHeader } from '@/components/ui';
import { createNotice, deleteNotice, updateNotice } from './actions';

type Opt = { id: string; name: string };
type NoticeValues = { title: string; body: string; audience: string; branchId: string | null; batchId: string | null; pinned: boolean; expiresOn: string | null };

function NoticeFields({ branches, batches, notice }: { branches: Opt[]; batches: (Opt & { branch: { name: string } })[]; notice?: NoticeValues }) {
  const target = !notice || notice.audience === 'ALL' ? 'ALL' : notice.audience === 'BRANCH' ? `BRANCH:${notice.branchId}` : `BATCH:${notice.batchId}`;
  return (
    <>
      <label>Title *<input name="title" required maxLength={120} defaultValue={notice?.title} placeholder="e.g. Academy closed on Sunday" /></label>
      <label>Message *<textarea name="body" required rows={5} maxLength={2000} defaultValue={notice?.body} placeholder="Write the details parents need to know…" /></label>
      <div className="form-row">
        <label>Who should see it *
          <select name="target" defaultValue={target}>
            <option value="ALL">All families</option>
            {branches.length > 0 && <optgroup label="One branch">{branches.map((b) => <option key={b.id} value={`BRANCH:${b.id}`}>{b.name}</option>)}</optgroup>}
            {batches.length > 0 && <optgroup label="One batch">{batches.map((b) => <option key={b.id} value={`BATCH:${b.id}`}>{b.name} · {b.branch.name}</option>)}</optgroup>}
          </select>
        </label>
        <label>Show until <small className="muted">(optional)</small><input name="expiresOn" type="date" defaultValue={notice?.expiresOn ?? ''} /></label>
      </div>
      <label className="inline-check"><input type="checkbox" name="pinned" defaultChecked={notice?.pinned} /> Pin to the top</label>
    </>
  );
}

export default async function NoticesPage() {
  const user = await requireUser();
  const today = todayISO();
  const [notices, branches, batches, settings] = await Promise.all([
    db.notice.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { branch: { select: { name: true } }, batch: { select: { name: true } } },
    }),
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.batch.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, branch: { select: { name: true } } } }),
    getSettings(),
  ]);
  const active = notices.filter((n) => !n.expiresOn || n.expiresOn >= today);
  const expired = notices.filter((n) => n.expiresOn && n.expiresOn < today);

  const addButton = (
    <FormModal title="New notice" eyebrow="NOTICE BOARD" description="Parents see notices in the parent app. You can also share them on WhatsApp." trigger={<><Plus size={17} /> New notice</>} action={createNotice} submitLabel="Post notice">
      <NoticeFields branches={branches} batches={batches} />
    </FormModal>
  );

  const card = (n: (typeof notices)[number], isExpired: boolean) => {
    const share = noticeShareText(n, settings.academyName, settings.publicUrl);
    const canDelete = user.role === 'ADMIN' || n.createdById === user.id;
    return (
      <article key={n.id} className={`panel padded notice-card ${n.pinned ? 'pinned' : ''} ${isExpired ? 'expired' : ''}`}>
        <div className="notice-head">
          <div>
            <h3>{n.pinned && <Pin size={14} className="pin-icon" />} {n.title}</h3>
            <p className="muted">
              {audienceLabel(n)} · posted {formatDate(todayISO(n.createdAt))}{n.createdBy ? ` by ${n.createdBy}` : ''}
              {n.expiresOn && <> · {isExpired ? 'ended' : 'shown until'} {formatDate(n.expiresOn)}</>}
            </p>
          </div>
        </div>
        <p className="notice-body">{n.body}</p>
        <div className="row-actions end">
          <a className="wa-btn" href={whatsappShareUrl(share)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
          <CopyButton text={share} />
          <FormModal title="Edit notice" trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={updateNotice.bind(null, n.id)}>
            <NoticeFields branches={branches} batches={batches} notice={n} />
          </FormModal>
          {canDelete && <ConfirmAction action={deleteNotice.bind(null, n.id)} confirmText={`Delete the notice "${n.title}"? Parents will no longer see it.`} label="Delete"><Trash2 size={15} /></ConfirmAction>}
        </div>
      </article>
    );
  };

  return (
    <>
      <PageHeader title="Notices" subtitle="Announcements for parents and students. They appear at the top of the parent app." actions={addButton} />
      {notices.length === 0 ? (
        <article className="panel padded">
          <Empty title="No notices yet" action={addButton}>
            Post holidays, timing changes, tournament news or fee dates. Choose all families, one branch or one batch.
          </Empty>
        </article>
      ) : (
        <>
          {active.length === 0 ? <p className="muted small-note">No current notices.</p> : <div className="notice-list">{active.map((n) => card(n, false))}</div>}
          {expired.length > 0 && (
            <details className="history spaced-top">
              <summary><Megaphone size={13} /> Ended notices ({expired.length})</summary>
              <div className="notice-list">{expired.map((n) => card(n, true))}</div>
            </details>
          )}
        </>
      )}
    </>
  );
}
