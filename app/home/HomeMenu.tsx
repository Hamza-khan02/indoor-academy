'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

type Item = { href: string; label: string };

/** The menu button shown on phones and tablets, and the panel it opens under the header. */
export function HomeMenu({ links, logins }: { links: Item[]; logins: Item[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="hp-menu-btn"
        aria-expanded={open}
        aria-controls="hp-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <div className="hp-menu" id="hp-menu">
          <nav aria-label="Menu">
            {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
          </nav>
          <div className="hp-menu-logins">
            {logins.map((l, i) => (
              <Link key={l.href} href={l.href} className={`hp-btn hp-btn-small ${i === 0 ? 'hp-btn-navy' : 'hp-btn-outline'}`}>{l.label}</Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
