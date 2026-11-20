import { useCallback, useEffect, useState } from 'react';
import type { Person, Tx } from './lib/types';
import { store, useStore, type StoreState } from './lib/store';
import { isDemo } from './lib/supabase';
import { findHousehold, frError, signOut, useSession } from './lib/auth';
import { addMonths, monthLabel, monthOf, todayKey } from './lib/format';
import { demoData } from './lib/demo';
import { Icon, ToastProvider } from './components/ui';
import AddSheet, { type AddInit } from './components/AddSheet';
import SettingsSheet, { type ThemeChoice } from './components/SettingsSheet';
import Suivi from './screens/Suivi';
import Depenses from './screens/Depenses';
import Epargne from './screens/Epargne';
import Bilan from './screens/Bilan';
import { AuthScreen, HouseholdScreen, NewPasswordScreen } from './screens/Auth';
import { L, useLang } from './lib/i18n';

export type Tab = 'suivi' | 'depenses' | 'epargne' | 'bilan';
export interface DepFilter {
  kind?: 'expense' | 'income';
  person?: Person;
  cat?: string;
}
export interface NavApi {
  month: string;
  today: string;
  go: (tab: Tab, filter?: DepFilter) => void;
  openAdd: (init?: AddInit) => void;
  openEdit: (tx: Tx) => void;
  openSettings: () => void;
  depFilter: DepFilter;
  setDepFilter: (f: DepFilter) => void;
  bilanView: 'bilan' | 'charges';
  setBilanView: (v: 'bilan' | 'charges') => void;
  loadDemo: () => void;
}
export interface ScreenProps {
  data: StoreState;
  nav: NavApi;
}

/* ---------- thème ---------- */

function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    try {
      return (localStorage.getItem('gb:theme') as ThemeChoice) || 'auto';
    } catch {
      return 'auto';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem('gb:theme', theme);
    } catch {
      /* ignore */
    }
    const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0E1117' : '#F2F1EE'));
  }, [theme]);
  return [theme, setTheme];
}

/** La date du jour, rafraîchie quand on revient sur l'appli */
function useToday() {
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const tick = () => setToday(todayKey());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}

/* ---------- l'appli ---------- */

export default function App() {
  // la langue change → toute l'appli se redessine
  useLang();
  return (
    <ToastProvider>
      <Gate />
    </ToastProvider>
  );
}

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <img src="/icons/icon-192.png" alt="Gecko Budget" width={88} height={88} style={{ borderRadius: 24 }} />
    </div>
  );
}

function Gate() {
  const { session, loading, recovery, endRecovery } = useSession();
  const [hid, setHid] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const uid = session?.user.id;

  useEffect(() => {
    if (isDemo) {
      store.open('demo', { demo: true });
      setHid('demo');
      return;
    }
    if (!uid) {
      setHid(undefined);
      return;
    }
    let alive = true;
    findHousehold(uid)
      .then((h) => alive && setHid(h))
      .catch((e) => alive && setError(frError(e)));
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    if (hid && !isDemo) store.open(hid);
  }, [hid]);

  if (isDemo) return <Main email={null} />;
  if (loading) return <Splash />;
  if (recovery && session) return <NewPasswordScreen onDone={endRecovery} />;
  if (!session) return <AuthScreen />;
  if (error && hid === undefined)
    return (
      <main className="auth">
        <div className="error-msg">{error}</div>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
          {L('Réessayer', 'Try again')}
        </button>
      </main>
    );
  if (hid === undefined) return <Splash />;
  if (hid === null)
    return (
      <HouseholdScreen
        uid={session.user.id}
        onReady={setHid}
        onSignOut={async () => {
          await signOut();
        }}
      />
    );
  return <Main email={session.user.email ?? null} />;
}

function Main({ email }: { email: string | null }) {
  const data = useStore();
  const today = useToday();
  const [theme, setTheme] = useTheme();
  const [tab, setTab] = useState<Tab>('suivi');
  const [month, setMonth] = useState(monthOf(todayKey()));
  const [depFilter, setDepFilter] = useState<DepFilter>({});
  const [bilanView, setBilanView] = useState<'bilan' | 'charges'>('bilan');
  const [add, setAdd] = useState<AddInit | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const go = useCallback((t: Tab, filter?: DepFilter) => {
    if (filter) setDepFilter(filter);
    setTab(t);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const nav: NavApi = {
    month,
    today,
    go,
    openAdd: (init) => setAdd(init ?? {}),
    openEdit: (tx) => setAdd({ tx }),
    openSettings: () => setSettingsOpen(true),
    depFilter,
    setDepFilter,
    bilanView,
    setBilanView,
    loadDemo: () => {
      const d = demoData();
      store.importData(d.settings, d.txs);
    },
  };

  if (!data.ready) return <Splash />;
  const current = monthOf(today);

  return (
    <div className="app">
      <header className="topbar">
        <img className="logo" src="/icons/logo-128.png" alt="" width={40} height={40} />
        <div className="brand">
          Gecko <span className="b2">Budget</span>
        </div>
        <button className="round-btn" onClick={() => setSettingsOpen(true)} aria-label={L('Réglages', 'Settings')}>
          <Icon name="gear" />
        </button>
      </header>

      <nav className="month-pill" aria-label={L('Mois affiché', 'Month shown')}>
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label={L('Mois précédent', 'Previous month')}>
          <Icon name="left" />
        </button>
        <span className="label">
          <button onClick={() => setMonth(current)} title={L('Revenir au mois en cours', 'Back to the current month')}>
            {monthLabel(month)}
          </button>
        </span>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label={L('Mois suivant', 'Next month')}>
          <Icon name="right" />
        </button>
      </nav>

      {(!data.online || data.pending > 0 || data.lastError) && (
        <div className="sync-dot" role="status">
          {data.lastError
            ? `⚠️ ${data.lastError}`
            : !data.online
              ? L(
                  `📴 Hors connexion${data.pending ? ` · ${data.pending} opération${data.pending > 1 ? 's' : ''} en attente` : ''} — tout est gardé sur le téléphone`,
                  `📴 Offline${data.pending ? ` · ${data.pending} pending` : ''} — everything is kept on the phone`,
                )
              : L(`⏳ Envoi de ${data.pending} opération${data.pending > 1 ? 's' : ''}…`, `⏳ Sending ${data.pending} transaction${data.pending > 1 ? 's' : ''}…`)}
        </div>
      )}

      <main>
        {tab === 'suivi' && <Suivi data={data} nav={nav} />}
        {tab === 'depenses' && <Depenses data={data} nav={nav} />}
        {tab === 'epargne' && <Epargne data={data} nav={nav} />}
        {tab === 'bilan' && <Bilan data={data} nav={nav} />}
      </main>

      <nav className="nav" aria-label={L('Navigation', 'Navigation')}>
        <button className={tab === 'suivi' ? 'on' : ''} onClick={() => go('suivi')} aria-current={tab === 'suivi' ? 'page' : undefined}>
          {L('Suivi', 'Home')}
        </button>
        <button className={tab === 'depenses' ? 'on' : ''} onClick={() => go('depenses', {})} aria-current={tab === 'depenses' ? 'page' : undefined}>
          {L('Dépenses', 'Spending')}
        </button>
        <button className="plus" onClick={() => setAdd({})} aria-label={L('Ajouter une opération', 'Add a transaction')}>
          <Icon name="plus" stroke={2.6} />
        </button>
        <button className={tab === 'epargne' ? 'on' : ''} onClick={() => go('epargne')} aria-current={tab === 'epargne' ? 'page' : undefined}>
          {L('Épargne', 'Savings')}
        </button>
        <button className={tab === 'bilan' ? 'on' : ''} onClick={() => go('bilan')} aria-current={tab === 'bilan' ? 'page' : undefined}>
          {L('Bilan', 'Report')}
        </button>
      </nav>

      {add && <AddSheet init={add} settings={data.settings} txs={data.txs} onClose={() => setAdd(null)} />}
      {settingsOpen && (
        <SettingsSheet
          settings={data.settings}
          txs={data.txs}
          householdId={data.householdId}
          email={email}
          theme={theme}
          setTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

