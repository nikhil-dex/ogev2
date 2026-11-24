'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import PixelStrip from './pixel-strip';

const links = [
  { href: '/notes', label: 'Notes' },
  { href: '/news', label: 'News' },
  { href: '/profile', label: 'Profile' },
];

export default function SiteNavbar({ actions = null, notesHref = '/notes', showNews = null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newsPreference, setNewsPreference] = useState(null);
  useEffect(() => {
    if (showNews !== null) return;
    let cancelled = false;
    fetch('/api/preferences/features', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (!cancelled && typeof result?.news === 'boolean') setNewsPreference(result.news); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showNews]);
  const newsEnabled = showNews ?? newsPreference ?? true;
  return <><header className="site-navbar">
    <Link className="brand" href="/" aria-label="OgeNotes home" onClick={() => setMenuOpen(false)}><span className="brand-mark" aria-hidden="true">O</span><span>Oge<span className="brand-light">Notes</span></span></Link>
    <button className="site-navbar-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="site-navbar-content" onClick={() => setMenuOpen((open) => !open)}><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
    <div id="site-navbar-content" className={'site-navbar-content' + (menuOpen ? ' is-open' : '')}>
      <nav className="site-navbar-links" aria-label="Main navigation">{links.filter((link) => link.href !== '/news' || newsEnabled).map((link) => {
        const href = link.href === '/notes' ? notesHref : link.href;
        const active = href === '/' ? pathname === '/' :
          pathname === href || pathname.startsWith(href + '/');
        return <a href={href} key={link.href} className={'site-navbar-link' + (active ? ' is-active' : '')} aria-current={active ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{link.label}</a>;
      })}</nav>
      {actions && <div className="site-navbar-actions">{actions}</div>}
    </div>
  </header><PixelStrip /></>;
}
