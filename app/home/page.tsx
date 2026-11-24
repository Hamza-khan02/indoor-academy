// Public home page. Open to everyone: logged-out visitors also see it at "/" (see proxy.ts).
// Shows only public details: academy contact, branches, facilities, batch timings and coaches' public profiles.
// No student data, fees or branch photos (those stay behind the staff and parent logins).
import './home.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, CalendarCheck, ClipboardCheck, Clock, Dumbbell, FileText, Hand, MapPin,
  MessageCircle, Navigation, Phone, Receipt, Smartphone, Star, Target, Trophy, Zap,
} from 'lucide-react';
import { getSettings } from '@/lib/settings';
import { displayFacilities } from '@/lib/facilities';
import { directionsUrl } from '@/lib/maps';
import { coachPhotoUrl } from '@/lib/photos';
import { coachingYears } from '@/lib/coach';
import { formatTime } from '@/lib/dates';
import { AGE_GROUPS } from '@/lib/constants';
import { initials } from '@/lib/format';
import { SiteDock, SiteFooter, SiteHeader, loadSite } from './site';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { academyName } = await getSettings();
  return {
    title: `${academyName} | Cricket coaching`,
    description: `Cricket coaching at ${academyName}: batting, bowling, fielding and fitness training, with attendance, coach ratings and match records shared with parents.`,
  };
}

const TRAINING = [
  { icon: Target, title: 'Batting', text: 'Technique, footwork and shot selection, built ball by ball in the nets.' },
  { icon: Zap, title: 'Bowling', text: 'Action, line and length for pace and spin bowlers.' },
  { icon: Hand, title: 'Fielding', text: 'Catching, ground fielding and throwing drills that save runs.' },
  { icon: Dumbbell, title: 'Fitness', text: 'Strength, speed and stamina work matched to each age group.' },
];

const TRACKING = [
  { icon: CalendarCheck, title: 'Attendance, every session', text: 'Present, late or absent is marked each session. Parents can check the last 30 days at any time.' },
  { icon: Star, title: 'Coach ratings', text: 'Coaches rate batting, bowling, fielding and fitness from 1 to 10 and add their notes.' },
  { icon: Trophy, title: 'Scorecards and career stats', text: 'Runs, wickets and catches from every match build a career record with averages, milestones and a printable career card.' },
  { icon: FileText, title: 'Monthly progress report', text: "One page each month: attendance, ratings, matches, drills and the coach's comment." },
  { icon: ClipboardCheck, title: 'Drills and homework', text: 'Coaches set practice to do at home, with video links. Players mark it done.' },
  { icon: Receipt, title: 'Fee receipts', text: 'Every payment gets a numbered receipt that parents can open and print.' },
];

const SAMPLE_SKILLS = [
  { label: 'Batting', value: 9 },
  { label: 'Bowling', value: 7 },
  { label: 'Fielding', value: 8 },
  { label: 'Fitness', value: 8 },
];
// Sample attendance strip for the hero card: p = present, l = late, a = absent.
const SAMPLE_DAYS = 'ppplppppappplpppp'.split('');

export default async function HomePage() {
  const site = await loadSite();
  const { academy, branches, coaches, callHref, phoneText, waHref, parentLink } = site;

  const facilityCount = new Set(branches.flatMap((b) => displayFacilities(b.facilities).map((f) => f.label))).size;
  const stats = [
    branches.length > 0 && { value: String(branches.length), label: branches.length === 1 ? 'Branch' : 'Branches' },
    { value: `${AGE_GROUPS[0]} to ${AGE_GROUPS[AGE_GROUPS.length - 1]}`, label: 'Age groups' },
    { value: '4', label: 'Skills rated by coaches' },
    facilityCount > 0 && { value: String(facilityCount), label: 'Facilities on site' },
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <div className="hp" id="top">
      <SiteHeader site={site} />

      <main>
        <section className="hp-hero">
          <div className="hp-hero-bg" aria-hidden />
          <div className="hp-wrap hp-hero-grid">
            <div className="hp-hero-copy">
              <p className="hp-kicker"><i /> Cricket performance center</p>
              <h1>Train smart.<br />Play <em>fearless.</em></h1>
              <p className="hp-lead">
                Structured coaching in batting, bowling, fielding and fitness. Every session, coach rating and match is
                recorded, so players and parents always know where they stand.
              </p>
              <div className="hp-cta-row">
                <a className="hp-btn hp-btn-primary" {...site.enquire()}>
                  {waHref ? <><MessageCircle size={18} /> Enquire on WhatsApp</> : <>Contact us <ArrowRight size={17} /></>}
                </a>
                <a className="hp-btn hp-btn-ghost" href={branches.length > 0 ? '#branches' : '#training'}>
                  {branches.length > 0 ? 'See our branches' : 'See the training'} <ArrowRight size={17} />
                </a>
              </div>
            </div>

            <div className="hp-visual" aria-hidden>
              <div className="hp-rings" />
              <svg className="hp-ball" viewBox="0 0 400 400">
                <defs>
                  <radialGradient id="hpBall" cx="35%" cy="28%" r="80%">
                    <stop offset="0" stopColor="#ff7b6b" />
                    <stop offset=".42" stopColor="#dc2626" />
                    <stop offset="1" stopColor="#4c0b0f" />
                  </radialGradient>
                  <radialGradient id="hpShine" cx="32%" cy="24%" r="38%">
                    <stop offset="0" stopColor="#fff" stopOpacity=".55" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </radialGradient>
                  <clipPath id="hpClip"><circle cx="200" cy="200" r="182" /></clipPath>
                </defs>
                <circle cx="200" cy="200" r="182" fill="url(#hpBall)" />
                <g clipPath="url(#hpClip)" fill="none" strokeLinecap="butt">
                  <path d="M150 0 C 236 120, 236 280, 150 400" stroke="#2a0507" strokeOpacity=".45" strokeWidth="34" />
                  <path d="M150 0 C 236 120, 236 280, 150 400" stroke="#ffe9e2" strokeOpacity=".9" strokeWidth="2.5" />
                  <path d="M133 0 C 219 120, 219 280, 133 400" stroke="#ffe9e2" strokeOpacity=".85" strokeWidth="13" strokeDasharray="2.6 9" />
                  <path d="M167 0 C 253 120, 253 280, 167 400" stroke="#ffe9e2" strokeOpacity=".85" strokeWidth="13" strokeDasharray="2.6 9" />
                </g>
                <circle cx="200" cy="200" r="182" fill="url(#hpShine)" />
              </svg>

              <div className="hp-float hp-float-rating">
                <small>Coach rating</small>
                <strong>8.0<span>/10</span></strong>
                <ul>
                  {SAMPLE_SKILLS.map((s) => (
                    <li key={s.label}><span>{s.label}</span><i><b style={{ width: `${s.value * 10}%` }} /></i></li>
                  ))}
                </ul>
              </div>
              <div className="hp-float hp-float-match">
                <Trophy size={15} />
                <div><small>Last match</small><strong>54 (38) · 2/18</strong></div>
              </div>
              <div className="hp-float hp-float-att">
                <small>Attendance · last 30 days</small>
                <strong>94%</strong>
                <div className="hp-days">{SAMPLE_DAYS.map((d, i) => <i key={i} className={`d-${d}`} />)}</div>
              </div>
              <p className="hp-visual-note">Sample of what players and parents see</p>
            </div>
          </div>
        </section>

        <div className="hp-wrap">
          <ul className="hp-statbar" style={{ '--n': stats.length } as React.CSSProperties}>
            {stats.map((s) => (
              <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>
            ))}
          </ul>
        </div>

        <section className="hp-intro">
          <div className="hp-wrap hp-reveal">
            <h2>Coaching that players and parents can follow.</h2>
            <p>
              At {academy} every session is marked, every skill is rated and every match is scored. Families see their
              own child&rsquo;s record in the parent app, so progress is never a guess.
            </p>
            <a className="hp-btn hp-btn-outline" href="#progress">See how progress is tracked <ArrowRight size={17} /></a>
          </div>
        </section>

        <section className="hp-section hp-soft" id="training">
          <div className="hp-wrap">
            <div className="hp-head hp-reveal">
              <p className="hp-eyebrow">Our training</p>
              <h2>Four skills. One complete cricketer.</h2>
              <span className="hp-rule" />
              <p>Every player works on all four areas, and coaches rate each one from 1 to 10 so improvement is easy to see.</p>
            </div>
            <ul className="hp-services">
              {TRAINING.map((t) => (
                <li key={t.title} className="hp-service hp-reveal">
                  <span className="hp-service-icon"><t.icon size={28} /></span>
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                  <small>Rated 1 to 10 by coaches</small>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hp-section" id="progress">
          <div className="hp-wrap">
            <div className="hp-head hp-reveal">
              <p className="hp-eyebrow">Progress tracking</p>
              <h2>Everything recorded, in one place.</h2>
              <span className="hp-rule" />
              <p>The academy records training and matches in one system, and families see their own child&rsquo;s record in the parent app.</p>
            </div>
            <ul className="hp-features">
              {TRACKING.map((f) => (
                <li key={f.title} className="hp-feature hp-reveal">
                  <span className="hp-feature-icon"><f.icon size={22} /></span>
                  <div>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hp-parent hp-reveal">
              <span className="hp-parent-icon"><Smartphone size={26} /></span>
              <div>
                <h3>Already with us? Open the parent app.</h3>
                <p>Log in with the guardian phone number registered with the academy and the 6-digit PIN we sent you.</p>
              </div>
              <Link className="hp-btn hp-btn-light" href={parentLink.href}>{parentLink.label} <ArrowUpRight size={17} /></Link>
            </div>
          </div>
        </section>

        {branches.length > 0 && (
          <section className="hp-section hp-soft" id="branches">
            <div className="hp-wrap">
              <div className="hp-head hp-reveal">
                <p className="hp-eyebrow">Our branches</p>
                <h2>{branches.length === 1 ? 'Where we train.' : `${branches.length} places to train.`}</h2>
                <span className="hp-rule" />
                <p>Tap <b>Get directions</b> to open a branch in Google Maps.</p>
              </div>
              <div className={`hp-branches${branches.length === 1 ? ' single' : ''}`}>
                {branches.map((b, i) => {
                  const facilities = displayFacilities(b.facilities);
                  const directions = directionsUrl(b);
                  return (
                    <article key={b.id} className="hp-branch hp-reveal">
                      <header>
                        <span className="hp-branch-no">{String(i + 1).padStart(2, '0')}</span>
                        <h3>{b.name}</h3>
                      </header>
                      {b.address && <p className="hp-address"><MapPin size={17} /><span>{b.address}</span></p>}
                      {facilities.length > 0 && (
                        <ul className="hp-chips" aria-label="Facilities">
                          {facilities.map((f) => (
                            <li key={f.label}><span aria-hidden>{f.emoji}</span> {f.label}{f.detail && <small> · {f.detail}</small>}</li>
                          ))}
                        </ul>
                      )}
                      {b.batches.length > 0 && (
                        <div className="hp-batches">
                          <h4><Clock size={14} /> Batch timings</h4>
                          <ul>
                            {b.batches.map((batch) => (
                              <li key={batch.id}>
                                <b>{batch.name}</b>
                                <span className="hp-age">{batch.ageGroup}</span>
                                <span>{batch.days.split(',').filter(Boolean).join(' · ')}</span>
                                <span>{formatTime(batch.startTime)} – {formatTime(batch.endTime)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {directions && (
                        <a className="hp-btn hp-btn-small hp-btn-navy" href={directions} target="_blank" rel="noopener noreferrer">
                          <Navigation size={16} /> Get directions
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {coaches.length > 0 && (
          <section className="hp-section" id="coaches">
            <div className="hp-wrap">
              <div className="hp-head hp-reveal">
                <p className="hp-eyebrow">Our coaches</p>
                <h2>{coaches.length === 1 ? 'Meet the coach.' : 'Meet the coaches.'}</h2>
                <span className="hp-rule" />
                <p>Open a profile to see {coaches.length === 1 ? 'the coach’s' : 'each coach’s'} experience, trophies and awards.</p>
              </div>
              <ul className="hp-coaches">
                {coaches.map((c) => {
                  const photo = coachPhotoUrl(c);
                  const years = coachingYears(c.coachingSince);
                  return (
                    <li key={c.id} className="hp-reveal">
                      <Link className="hp-coach" href={`/home/coach/${c.id}`}>
                        <span className="hp-coach-av">{photo ? <img src={photo} alt="" /> : initials(c.name)}</span>
                        <h3>{c.name}</h3>
                        <p>{c.specialization || 'Coach'}</p>
                        {(c.branch?.name || branches.length > 1 || (years ?? 0) > 0) && (
                          <small>
                            {c.branch?.name ? <span className="hp-cap">{c.branch.name}</span> : branches.length > 1 && 'All branches'}
                            {(c.branch?.name || branches.length > 1) && (years ?? 0) > 0 && ' · '}
                            {(years ?? 0) > 0 && `${years}+ years coaching`}
                          </small>
                        )}
                        <span className="hp-coach-more">View full profile <ArrowRight size={16} /></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        <section className="hp-contact" id="contact">
          <div className="hp-wrap hp-contact-row hp-reveal">
            <div className="hp-contact-copy">
              <p className="hp-eyebrow light">Join the academy</p>
              <h2>Talk to us about joining.</h2>
              <p>Call or message us for batch timings and fees, or visit a branch.</p>
            </div>
            <div className="hp-contact-actions">
              {waHref && (
                <a className="hp-btn hp-btn-light" href={waHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={18} /> Message on WhatsApp
                </a>
              )}
              {callHref && <a className="hp-btn hp-btn-onred" href={callHref}><Phone size={17} /> Call {phoneText}</a>}
              {!waHref && !callHref && branches.length > 0 && <a className="hp-btn hp-btn-light" href="#branches">Find a branch <ArrowRight size={17} /></a>}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter site={site} />
      <SiteDock site={site} />
    </div>
  );
}
