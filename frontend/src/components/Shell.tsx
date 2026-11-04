'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken } from '@/lib/api';
import { person } from '@/lib/format';
import { Icon, IconBox } from './Icon';
import { Avatar } from './ui';

type AppState = {
  me: any;
  objects: any[];
  users: any[];
  teams: any[];
  notifications: any[];
  refreshNotifications: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside the shell');
  return value;
}

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/o/leads', label: 'Leads' },
  { href: '/o/accounts', label: 'Accounts' },
  { href: '/o/contacts', label: 'Contacts' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/o/cases', label: 'Cases' },
  { href: '/o/activities', label: 'Activities' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/reports', label: 'Reports' },
  { href: '/feed', label: 'Feed' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AppState | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [launcher, setLauncher] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  async function refreshNotifications() {
    const notifications = await api('/notifications');
    setState((current) => (current ? { ...current, notifications } : current));
  }

  useEffect(() => {
    if (!localStorage.getItem('sf_token')) {
      router.replace('/login');
      return;
    }
    Promise.all([api('/auth/me'), api('/metadata'), api('/users'), api('/teams'), api('/notifications')])
      .then(([me, metadata, users, teams, notifications]) => {
        setState({ me, objects: metadata.objects, users, teams, notifications, refreshNotifications });
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const handle = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(query)}`).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  const unread = useMemo(() => state?.notifications.filter((note) => !note.isRead).length || 0, [state]);

  if (!state) {
    return <div className="slds-p-around_large">Loading Salesfroge…</div>;
  }

  function signOut() {
    clearToken();
    router.replace('/login');
  }

  return (
    <AppContext.Provider value={state}>
      <header className="slds-global-header_container">
        <div className="slds-global-header slds-grid slds-grid_align-spread">
          <div className="slds-global-header__item">
            <Link href="/" className="sf-brand" aria-label="Salesfroge home">
              <img src="/logo.svg" alt="" />
              <strong>Salesfroge</strong>
            </Link>
          </div>
          <div className="slds-global-header__item slds-global-header__item_search">
            <form className="sf-search" onSubmit={(event) => { event.preventDefault(); setResults(null); router.push(`/search?q=${encodeURIComponent(query)}`); }}>
              <div className="slds-form-element">
                <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                  <Icon name="search" sprite="utility" size="x-small" className="slds-input__icon slds-input__icon_left" />
                  <input className="slds-input" type="search" placeholder="Search Salesfroge" aria-label="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
              </div>
              {results && (
                <div className="sf-search-results" role="listbox">
                  {results.length === 0 && <div className="slds-p-around_small sf-muted">No matches</div>}
                  {results.map((result) => (
                    <Link key={`${result.type}-${result.id}`} href={result.href} onClick={() => { setResults(null); setQuery(''); }}>
                      <span className="sf-muted">{result.type}</span><br />{result.title}
                    </Link>
                  ))}
                </div>
              )}
            </form>
          </div>
          <div className="slds-global-header__item">
            <div className="slds-grid slds-grid_vertical-align-center">
              <button className="slds-button slds-button_icon slds-button_icon-container slds-button_icon-inverse" title="Notifications" onClick={() => { setNotesOpen((open) => !open); setMenu(false); }}>
                <Icon name="notification" sprite="utility" size="small" />
                {unread > 0 && <span className="slds-badge slds-m-left_xx-small">{unread}</span>}
              </button>
              <button className="slds-button slds-button_icon slds-button_icon-inverse slds-m-left_x-small" title="User menu" onClick={() => { setMenu((open) => !open); setNotesOpen(false); }}>
                <Avatar user={state.me} />
              </button>
            </div>
            {notesOpen && (
              <div className="sf-menu">
                <div className="slds-p-horizontal_small slds-p-vertical_x-small slds-grid slds-grid_align-spread">
                  <strong>Notifications</strong>
                  <button className="slds-button slds-button_reset" onClick={() => api('/notifications/read-all', { method: 'POST' }).then(refreshNotifications)}>Mark read</button>
                </div>
                {state.notifications.length === 0 && <div className="slds-p-around_small sf-muted">You are all caught up.</div>}
                {state.notifications.slice(0, 8).map((note) => (
                  <Link key={note.id} href={note.link || '/feed'} onClick={() => { api(`/notifications/${note.id}/read`, { method: 'POST' }).then(refreshNotifications); setNotesOpen(false); }}>
                    {note.message}
                    <div className="sf-muted">{note.isRead ? 'Read' : 'New'}</div>
                  </Link>
                ))}
              </div>
            )}
            {menu && (
              <div className="sf-menu">
                <div className="slds-p-around_small"><strong>{person(state.me)}</strong><div className="sf-muted">{state.me.email}</div></div>
                <Link href="/settings" onClick={() => setMenu(false)}>Settings</Link>
                <Link href="/import" onClick={() => setMenu(false)}>Import</Link>
                <button type="button" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="sf-shell">
        <div className="slds-context-bar sf-context">
          <div className="slds-context-bar__primary">
            <div className="slds-context-bar__item slds-no-hover">
              <div className="slds-context-bar__icon-action">
                <button className="slds-button slds-context-bar__button" title="App launcher" onClick={() => setLauncher((open) => !open)}>
                  <div className="slds-icon-waffle"><div className="slds-r1" /><div className="slds-r2" /><div className="slds-r3" /><div className="slds-r4" /><div className="slds-r5" /><div className="slds-r6" /><div className="slds-r7" /><div className="slds-r8" /><div className="slds-r9" /></div>
                </button>
              </div>
              <span className="slds-context-bar__label-action slds-context-bar__app-name"><span className="slds-truncate">Sales</span></span>
            </div>
            <button className="slds-button slds-button_neutral sf-nav-toggle slds-m-left_small" type="button" onClick={() => setNavOpen((open) => !open)}>Menu</button>
          </div>
          <nav className={`slds-context-bar__secondary sf-context-nav ${navOpen ? 'is-open' : ''}`} aria-label="App navigation">
            <ul className="slds-grid">
              {NAV.map((item) => (
                <li key={item.href} className={`slds-context-bar__item ${pathname === item.href ? 'slds-is-active' : ''}`}>
                  <Link href={item.href} className="slds-context-bar__label-action" onClick={() => setNavOpen(false)}>
                    <span className="slds-truncate">{item.label}</span>
                  </Link>
                </li>
              ))}
              {state.objects.filter((object) => object.custom).map((object) => (
                <li key={object.key} className={`slds-context-bar__item ${pathname.startsWith(`/o/${object.key}`) ? 'slds-is-active' : ''}`}>
                  <Link href={`/o/${object.key}`} className="slds-context-bar__label-action" onClick={() => setNavOpen(false)}>
                    <span className="slds-truncate">{object.plural}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {launcher && (
            <div className="sf-launcher">
              <p className="slds-text-title_caps slds-m-bottom_x-small">Apps</p>
              <div className="sf-launcher-grid">
                {state.objects.map((object) => (
                  <Link key={object.key} href={`/o/${object.key}`} onClick={() => setLauncher(false)}>
                    <IconBox name={object.icon || 'custom'} size="medium" />
                    <span>{object.plural}</span>
                  </Link>
                ))}
                <Link href="/reports" onClick={() => setLauncher(false)}><IconBox name="report" /><span>Reports</span></Link>
                <Link href="/dashboards" onClick={() => setLauncher(false)}><IconBox name="dashboard" /><span>Dashboards</span></Link>
                <Link href="/feed" onClick={() => setLauncher(false)}><IconBox name="feed" /><span>Feed</span></Link>
                <Link href="/calendar" onClick={() => setLauncher(false)}><IconBox name="event" /><span>Calendar</span></Link>
                <Link href="/settings" onClick={() => setLauncher(false)}><IconBox name="user" /><span>Setup</span></Link>
              </div>
            </div>
          )}
        </div>
        <main className="sf-main">{children}</main>
      </div>
    </AppContext.Provider>
  );
}
