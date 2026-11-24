// Shared pieces of the public site (home page and coach pages): the data they need, the header,
// the footer and the Call / WhatsApp bar on phones. Only public details are loaded here.
import { cache } from 'react';
import Link from 'next/link';
import { ChevronRight, Clock, Facebook, Instagram, MessageCircle, Phone, Youtube } from 'lucide-react';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { displayPhone, getFamily } from '@/lib/family';
import { getSettings } from '@/lib/settings';
import { directionsUrl } from '@/lib/maps';
import { whatsappNumber, whatsappUrl } from '@/lib/messages';
import { SOCIAL_LABELS, SOCIAL_PLATFORMS, socialHandle, socialUrl, type SocialPlatform } from '@/lib/social';
import { initials } from '@/lib/format';
import { HomeMenu } from './HomeMenu';

const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, youtube: Youtube };

/** The valid social links out of a record's instagramUrl / facebookUrl / youtubeUrl. */
export function socialLinks(values: Partial<Record<`${SocialPlatform}Url`, string | null>>) {
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const url = socialUrl(platform, values[`${platform}Url`]);
    return url ? [{ platform, url, label: SOCIAL_LABELS[platform], handle: socialHandle(platform, url), Icon: SOCIAL_ICONS[platform] }] : [];
  });
}

export const loadSite = cache(async () => {
  const [settings, branches, coaches, user, family] = await Promise.all([
    getSettings(),
    db.branch.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, address: true, mapsUrl: true, facilities: true,
        batches: {
          where: { active: true },
          orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, ageGroup: true, days: true, startTime: true, endTime: true },
        },
      },
    }),
    db.coach.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, specialization: true, coachingSince: true, photoUpdatedAt: true, branch: { select: { name: true } } },
    }),
    getCurrentUser(),
    getFamily(),
  ]);

  const academy = settings.academyName.trim() || 'INDOOR ACADEMY';
  const phoneKey = whatsappNumber(settings.academyPhone);
  const waHref = whatsappUrl(settings.academyPhone, `Namaste, I would like to know about cricket coaching at ${academy}.`);

  return {
    settings,
    academy,
    branches,
    coaches,
    isStaff: Boolean(user),
    phone: settings.academyPhone,
    callHref: phoneKey ? `tel:+${phoneKey}` : null,
    phoneText: phoneKey ? displayPhone(phoneKey) : '',
    waHref,
    hours: settings.academyHours.trim(),
    socials: socialLinks(settings),
    parentLink: family ? { href: '/parent', label: 'Open parent app' } : { href: '/parent/login', label: 'Parent login' },
    staffLink: user ? { href: '/', label: 'Dashboard' } : { href: '/login', label: 'Staff login' },
    /** Link props for "enquire" buttons: WhatsApp when there is a phone, otherwise the contact section. */
    enquire: (base = '') => (waHref ? { href: waHref, target: '_blank', rel: 'noopener noreferrer' } : { href: `${base}#contact` }),
  };
});

export type Site = Awaited<ReturnType<typeof loadSite>>;

/** Menu links. `base` is '' on the home page itself and '/home' on its sub-pages. */
export function siteSections(site: Site, base = '') {
  return [
    { href: base || '#top', label: 'Home' },
    { href: `${base}#training`, label: 'Training' },
    { href: `${base}#progress`, label: 'Progress' },
    site.branches.length > 0 && { href: `${base}#branches`, label: 'Branches' },
    site.coaches.length > 0 && { href: `${base}#coaches`, label: 'Coaches' },
    { href: `${base}#contact`, label: 'Contact' },
  ].filter(Boolean) as { href: string; label: string }[];
}

/** Same-page "#section" links stay plain anchors; links to another page use the app router. */
function SiteLink({ href, children, ...rest }: { href: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  if (href.startsWith('#') || /^(https?:|tel:)/.test(href)) return <a href={href} {...rest}>{children}</a>;
  return <Link href={href} {...rest}>{children}</Link>;
}

function Brand({ academy, href, dark }: { academy: string; href: string; dark?: boolean }) {
  const words = academy.split(/\s+/);
  const accent = words.length > 1 ? words.pop()! : '';
  return (
    <SiteLink className={`hp-brand${dark ? ' on-dark' : ''}`} href={href} aria-label={`${academy} home`}>
      <span className="hp-mark"><b>{initials(academy) || 'IA'}</b><i /></span>
      <span className="hp-brand-text">
        <span className="hp-brand-name">{words.join(' ')}{accent && <em> {accent}</em>}</span>
        <span className="hp-brand-tag">Cricket performance center</span>
      </span>
    </SiteLink>
  );
}

export function SiteHeader({ site, base = '', current = 'Home' }: { site: Site; base?: string; current?: string }) {
  const sections = siteSections(site, base);
  return (
    <>
      <div className="hp-top">
        <div className="hp-wrap hp-top-row">
          <div className="hp-top-info">
            {site.callHref && <a href={site.callHref}><Phone size={14} /> {site.phoneText}</a>}
            {site.hours && <span className="hp-top-hours"><Clock size={14} /> {site.hours.split('\n')[0]}</span>}
          </div>
          <div className="hp-top-links">
            {site.socials.length > 0 && (
              <span className="hp-top-social">
                {site.socials.map((s) => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}><s.Icon size={15} /></a>
                ))}
              </span>
            )}
            <Link href={site.parentLink.href}>{site.parentLink.label}</Link>
            <Link className="hp-top-staff" href={site.staffLink.href}>{site.staffLink.label}</Link>
          </div>
        </div>
      </div>

      <header className="hp-header">
        <div className="hp-wrap hp-header-row">
          <Brand academy={site.academy} href={base || '#top'} />
          <nav className="hp-links" aria-label="Sections">
            {sections.map((s) => <SiteLink key={s.href} href={s.href} className={s.label === current ? 'on' : undefined}>{s.label}</SiteLink>)}
          </nav>
          <a className="hp-btn hp-btn-small hp-btn-primary hp-header-cta" {...site.enquire(base)}>Enquire now</a>
          <HomeMenu links={sections} logins={[site.parentLink, site.staffLink]} />
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ site, base = '' }: { site: Site; base?: string }) {
  const { settings, branches, callHref, phoneText, waHref, hours, socials, parentLink, staffLink, academy } = site;
  return (
    <footer className="hp-footer">
      <div className="hp-wrap">
        <div className="hp-foot-cols">
          <nav aria-label="Explore">
            <h3>Explore</h3>
            <ul>{siteSections(site, base).map((s) => <li key={s.href}><SiteLink href={s.href}>{s.label}</SiteLink></li>)}</ul>
          </nav>
          <nav aria-label="Parents and students">
            <h3>Parents &amp; students</h3>
            <ul>
              <li><Link href={parentLink.href}>{parentLink.label}</Link></li>
              <li><SiteLink href={`${base}#progress`}>What parents can see</SiteLink></li>
              <li><SiteLink href={`${base}#training`}>What we train</SiteLink></li>
              <li><a {...site.enquire(base)}>Admission enquiry</a></li>
            </ul>
          </nav>
          {branches.length > 0 && (
            <nav aria-label="Branches">
              <h3>Branches</h3>
              <ul>
                {branches.map((b) => {
                  const directions = directionsUrl(b);
                  return (
                    <li key={b.id}>
                      {directions
                        ? <a className="hp-cap" href={directions} target="_blank" rel="noopener noreferrer">{b.name}</a>
                        : <SiteLink className="hp-cap" href={`${base}#branches`}>{b.name}</SiteLink>}
                    </li>
                  );
                })}
                <li><SiteLink href={`${base}#branches`}>Facilities and timings</SiteLink></li>
              </ul>
            </nav>
          )}
          <div>
            <h3>Get in touch</h3>
            <ul className="hp-foot-contact">
              {callHref && <li><Phone size={16} /><a href={callHref}>{phoneText}</a></li>}
              {waHref && <li><MessageCircle size={16} /><a href={waHref} target="_blank" rel="noopener noreferrer">WhatsApp us</a></li>}
              {hours && <li><Clock size={16} /><span className="hp-pre">{hours}</span></li>}
              {!callHref && !waHref && !hours && <li><SiteLink href={`${base}#branches`}>Visit a branch</SiteLink></li>}
            </ul>
          </div>
        </div>

        <div className="hp-foot-lower">
          <div className="hp-foot-org">
            <Brand academy={academy} href={base || '#top'} dark />
            {settings.academyAddress && <address>{settings.academyAddress}</address>}
            {callHref && <p>tel: <a href={callHref}>{phoneText}</a></p>}
            {branches.length > 0 && <SiteLink className="hp-foot-more" href={`${base}#branches`}>Branches &amp; maps <ChevronRight size={16} /></SiteLink>}
          </div>
          <div className="hp-foot-side">
            {settings.homeAbout && <p className="hp-foot-about">{settings.homeAbout}</p>}
            {socials.length > 0 && (
              <div className="hp-follow">
                <h3>Follow {academy}</h3>
                <ul>
                  {socials.map((s) => (
                    <li key={s.platform}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}><s.Icon size={22} /></a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="hp-foot-legal">
              <li><Link href={parentLink.href}>{parentLink.label}</Link></li>
              <li><Link href={staffLink.href}>{staffLink.label}</Link></li>
              <li><a href="#top">Back to top</a></li>
              <li>© {new Date().getFullYear()} {academy}</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Call / WhatsApp bar fixed to the bottom of the screen on phones. */
export function SiteDock({ site }: { site: Site }) {
  if (!site.callHref && !site.waHref) return null;
  return (
    <div className="hp-dock">
      {site.callHref && <a className="hp-btn hp-btn-navy" href={site.callHref}><Phone size={17} /> Call</a>}
      {site.waHref && <a className="hp-btn hp-btn-primary" href={site.waHref} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> WhatsApp</a>}
    </div>
  );
}
