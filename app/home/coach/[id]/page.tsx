// Public profile of one coach: photo, experience, trophies and awards, social links and batches.
// Reached from the coach cards on the home page. Only active coaches have a page, and the coach's
// phone and email are never shown here (enquiries go to the academy's number).
import '../../home.css';
import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Award, CalendarDays, Check, ChevronRight, Clock, MapPin, MessageCircle, Pencil, Phone, Trophy } from 'lucide-react';
import { db } from '@/lib/db';
import { coachingYears, parseAchievement, profileLines } from '@/lib/coach';
import { coachPhotoUrl } from '@/lib/photos';
import { whatsappUrl } from '@/lib/messages';
import { formatTime } from '@/lib/dates';
import { initials } from '@/lib/format';
import { SiteDock, SiteFooter, SiteHeader, loadSite, socialLinks } from '../../site';

export const dynamic = 'force-dynamic';

const getCoach = cache((id: string) =>
  db.coach.findFirst({
    where: { id, active: true },
    select: {
      id: true, name: true, specialization: true, bio: true, coachingSince: true, experience: true, achievements: true,
      instagramUrl: true, facebookUrl: true, youtubeUrl: true, photoUpdatedAt: true,
      branch: { select: { name: true } },
      batches: {
        where: { active: true },
        orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, ageGroup: true, days: true, startTime: true, endTime: true, branch: { select: { name: true } } },
      },
    },
  }),
);

/** "Batting" -> "Batting coach"; "Head coach" stays as it is. */
function roleTitle(specialization: string | null) {
  if (!specialization) return 'Coach';
  return /coach/i.test(specialization) ? specialization : `${specialization} coach`;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const [coach, site] = await Promise.all([getCoach(params.id), loadSite()]);
  if (!coach) return { title: `Coach not found | ${site.academy}` };
  const role = roleTitle(coach.specialization);
  return {
    title: `${coach.name} | ${site.academy}`,
    description: `${coach.name}, ${role} at ${site.academy}: experience, trophies and awards.`,
  };
}

export default async function CoachPage({ params }: { params: { id: string } }) {
  const [site, coach] = await Promise.all([loadSite(), getCoach(params.id)]);
  if (!coach) notFound();

  const firstName = coach.name.split(/\s+/)[0];
  const photo = coachPhotoUrl(coach);
  const years = coachingYears(coach.coachingSince);
  const about = (coach.bio ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const experience = profileLines(coach.experience);
  const awards = profileLines(coach.achievements).map(parseAchievement);
  const socials = socialLinks(coach);
  const branchName = coach.branch?.name ?? (site.branches.length === 1 ? site.branches[0].name : site.branches.length > 1 ? 'All branches' : null);
  const waHref = whatsappUrl(site.phone, `Namaste, I would like to know about training with ${coach.name} at ${site.academy}.`);

  const stats = [
    (years ?? 0) > 0 && { value: `${years}+`, label: years === 1 ? 'Year of coaching' : 'Years of coaching' },
    awards.length > 0 && { value: String(awards.length), label: awards.length === 1 ? 'Trophy or award' : 'Trophies and awards' },
    coach.batches.length > 0 && { value: String(coach.batches.length), label: coach.batches.length === 1 ? 'Batch coached' : 'Batches coached' },
    coach.specialization && { value: coach.specialization, label: 'Speciality' },
  ].filter(Boolean) as { value: string; label: string }[];
  const showStats = stats.length >= 2;
  const hasDetails = about.length > 0 || experience.length > 0 || awards.length > 0;

  return (
    <div className="hp" id="top">
      <SiteHeader site={site} base="/home" current="Coaches" />

      <main>
        <section className={`hp-cp-hero${showStats ? ' with-stats' : ''}`}>
          <div className="hp-hero-bg" aria-hidden />
          <div className="hp-wrap">
            <nav className="hp-crumbs" aria-label="Breadcrumb">
              <Link href="/home">Home</Link><ChevronRight size={14} />
              <Link href="/home#coaches">Coaches</Link><ChevronRight size={14} />
              <span aria-current="page">{coach.name}</span>
            </nav>
            <div className="hp-cp-head">
              <div className="hp-cp-photo">{photo ? <img src={photo} alt={`${coach.name}`} /> : <span>{initials(coach.name)}</span>}</div>
              <div className="hp-cp-id">
                <p className="hp-kicker"><i /> {roleTitle(coach.specialization)}</p>
                <h1>{coach.name}</h1>
                <ul className="hp-cp-meta">
                  {branchName && <li><MapPin size={16} /> <span className={branchName === 'All branches' ? undefined : 'hp-cap'}>{branchName}</span></li>}
                  {coach.coachingSince && years !== null && <li><CalendarDays size={16} /> Coaching since {coach.coachingSince}</li>}
                  {awards.length > 0 && <li><Trophy size={16} /> {awards.length} {awards.length === 1 ? 'trophy or award' : 'trophies and awards'}</li>}
                </ul>
                {socials.length > 0 && (
                  <ul className="hp-cp-social">
                    {socials.map((s) => (
                      <li key={s.platform}>
                        <a className={`s-${s.platform}`} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${coach.name} on ${s.label}`}>
                          <s.Icon size={18} /> {s.handle}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        {showStats && (
          <div className="hp-wrap">
            <ul className="hp-statbar" style={{ '--n': stats.length } as React.CSSProperties}>
              {stats.map((s) => <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>)}
            </ul>
          </div>
        )}

        <section className="hp-section hp-cp-body">
          <div className="hp-wrap">
            {site.isStaff && (
              <p className="hp-cp-staff">
                <Pencil size={15} /> You are logged in as staff. Change this page from <Link href="/coaches">Coaches → Edit profile</Link>.
              </p>
            )}
            <div className="hp-cp-grid">
              <div className="hp-cp-main">
                {about.length > 0 && (
                  <article className="hp-cp-block">
                    <h2>About {firstName}</h2>
                    <span className="hp-rule" />
                    {about.map((p, i) => <p key={i} className="hp-cp-text">{p}</p>)}
                  </article>
                )}
                {experience.length > 0 && (
                  <article className="hp-cp-block">
                    <h2>Experience and qualifications</h2>
                    <span className="hp-rule" />
                    <ul className="hp-cp-exp">
                      {experience.map((line, i) => <li key={i}><span><Check size={15} /></span>{line}</li>)}
                    </ul>
                  </article>
                )}
                {awards.length > 0 && (
                  <article className="hp-cp-block">
                    <h2>Trophies and awards</h2>
                    <span className="hp-rule" />
                    <ul className="hp-cp-awards">
                      {awards.map((a, i) => (
                        <li key={i}>
                          <span className="hp-cp-award-icon">{i % 2 === 0 ? <Trophy size={22} /> : <Award size={22} />}</span>
                          <div>
                            {a.year && <small>{a.year}</small>}
                            <b>{a.title}</b>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
                {!hasDetails && (
                  <article className="hp-cp-block hp-cp-empty">
                    <Trophy size={30} />
                    <h2>{firstName}&rsquo;s profile is being updated</h2>
                    <p>Experience, trophies and awards will appear here soon. Message the academy if you would like to know more.</p>
                  </article>
                )}
              </div>

              <aside className="hp-cp-side">
                {coach.batches.length > 0 && (
                  <div className="hp-cp-card">
                    <h3><Clock size={16} /> Batches with {firstName}</h3>
                    <ul className="hp-cp-batches">
                      {coach.batches.map((b) => (
                        <li key={b.id}>
                          <b>{b.name} <span className="hp-age">{b.ageGroup}</span></b>
                          <span>{b.days.split(',').filter(Boolean).join(' · ')}</span>
                          <span>{formatTime(b.startTime)} – {formatTime(b.endTime)} · <span className="hp-cap">{b.branch.name}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="hp-cp-card hp-cp-cta">
                  <h3>Train with {firstName}</h3>
                  <p>Message or call the academy to ask about batches, timings and fees.</p>
                  {waHref && <a className="hp-btn hp-btn-light" href={waHref} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Enquire on WhatsApp</a>}
                  {site.callHref && <a className="hp-btn hp-btn-onred" href={site.callHref}><Phone size={17} /> Call {site.phoneText}</a>}
                  {!waHref && !site.callHref && <Link className="hp-btn hp-btn-light" href="/home#branches">Find a branch</Link>}
                </div>
                <Link className="hp-cp-back" href="/home#coaches"><ArrowLeft size={16} /> {site.coaches.length > 1 ? 'All coaches' : 'Back to the home page'}</Link>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter site={site} base="/home" />
      <SiteDock site={site} />
    </div>
  );
}
