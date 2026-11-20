// Small presentational building blocks shared by pages (server-safe, no hooks).
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatLongDate, todayISO } from '@/lib/dates';
import { avatarClass, initials } from '@/lib/format';
import { STUDENT_STATUS } from '@/lib/constants';

export function PageHeader({ title, subtitle, actions, accent = true }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="welcome-row">
      <div>
        <div className="eyebrow"><span className="live-dot" /> {formatLongDate(todayISO()).toUpperCase()}</div>
        <h1>{title}{accent && <span>.</span>}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="welcome-actions">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, action, children, className = '' }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <article className={`panel padded ${className}`}>
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </article>
  );
}

export type Trend = { text: string; direction: 'up' | 'down' | 'flat' } | null;

export function TrendBadge({ trend }: { trend: Trend }) {
  if (!trend) return null;
  const Icon = trend.direction === 'up' ? ArrowUpRight : trend.direction === 'down' ? ArrowDownRight : Minus;
  const cls = trend.direction === 'up' ? 'positive' : trend.direction === 'down' ? 'negative' : 'neutral';
  return <span className={`trend ${cls}`}><Icon size={13} />{trend.text}</span>;
}

export function StatCard({ title, value, trend, detail, icon, color, spark }: { title: string; value: string; trend?: Trend; detail: string; icon: React.ReactNode; color: 'red' | 'green' | 'blue' | 'amber'; spark?: number[] }) {
  const max = spark ? Math.max(...spark, 1) : 1;
  return (
    <article className="stat-card">
      <div className="stat-top"><span>{title}</span><div className={`stat-icon ${color}`}>{icon}</div></div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot"><TrendBadge trend={trend ?? null} /><span>{detail}</span></div>
      {spark && spark.some((v) => v > 0) && (
        <div className={`spark ${color}`} aria-hidden>
          {spark.map((v, i) => <i key={i} style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />)}
        </div>
      )}
    </article>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Avatar({ name, small }: { name: string; small?: boolean }) {
  return <div className={`avatar player ${avatarClass(name)} ${small ? 'sm' : ''}`}>{initials(name)}</div>;
}

export function StatusPill({ status, labels = STUDENT_STATUS }: { status: string; labels?: Record<string, string> }) {
  return <span className={`status s-${status.toLowerCase()}`}><i />{labels[status] ?? status}</span>;
}

export function AttendanceBar({ pct }: { pct: number | null }) {
  if (pct === null) return <small className="muted">No records</small>;
  const cls = pct >= 85 ? 'good' : pct >= 75 ? 'ok' : 'low';
  return (
    <div className="attendance-cell">
      <div className="mini-progress"><span className={cls} style={{ width: `${pct}%` }} /></div>
      <small>{pct}%</small>
    </div>
  );
}
