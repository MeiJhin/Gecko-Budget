import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Settings, Tx } from '../lib/types';
import { COLORS, guessIcon, uid } from '../lib/defaults';
import { centsToInput, monthLabel, monthOf, parseEuros, todayKey } from '../lib/format';
import { fromDraft, toDraft, type Draft } from '../lib/settings';
import { parseBackup, saveFile, toBackup, toCsv } from '../lib/csv';
import { store } from '../lib/store';
import { isDemo } from '../lib/supabase';
import { frError, householdInfo, leaveEmptyHousehold, signOut } from '../lib/auth';
import IconPicker from './IconPicker';
import { Icon, Sheet, useToast } from './ui';
import { L, setLang, useLang, type Lang } from '../lib/i18n';

export type ThemeChoice = 'auto' | 'light' | 'dark';

/** Champ montant : garde le texte saisi, renvoie des centimes */
function MoneyInput({ value, onChange, placeholder, label }: { value: number; onChange: (c: number) => void; placeholder: string; label: string }) {
  const [text, setText] = useState(centsToInput(value));
  return (
    <input
      className="field right"
      inputMode="decimal"
      aria-label={label}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d,.\s]/g, '');
        setText(t);
        onChange(parseEuros(t) ?? 0);
      }}
    />
  );
}

type PickTarget = { list: 'charges' | 'envelopes' | 'pots'; id: string } | null;

export default function SettingsSheet({
  settings,
  txs,
  householdId,
  email,
  theme,
  setTheme,
  onClose,
}: {
  settings: Settings;
  txs: Tx[];
  householdId: string | null;
  email: string | null;
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const month = monthOf(todayKey());
  const [d, setD] = useState<Draft>(() => toDraft(settings, month));
  const [pick, setPick] = useState<PickTarget>(null);
  const [done, setDone] = useState(false);
  const [info, setInfo] = useState<{ code: string; members: number } | null>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lang = useLang();

  useEffect(() => {
    if (isDemo || !householdId) return;
    householdInfo(householdId)
      .then(setInfo)
      .catch((e) => setInfoErr(frError(e)));
  }, [householdId]);

  const upd = <K extends 'charges' | 'envelopes' | 'pots'>(list: K, id: string, patch: Partial<Draft[K][number]>) =>
    setD((x) => ({ ...x, [list]: (x[list] as Draft[K]).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const del = (list: 'charges' | 'envelopes' | 'pots', id: string) => setD((x) => ({ ...x, [list]: (x[list] as { id: string }[]).filter((r) => r.id !== id) }));
  const nextColor = (n: number) => COLORS[n % COLORS.length];

  const save = () => {
    store.saveSettings(fromDraft(settings, d, month));
    toast(L('Réglages enregistrés ✓', 'Settings saved ✓'));
    setDone(true);
  };

  const pickRow = pick ? (d[pick.list] as { id: string; name: string; icon: string; color: string }[]).find((r) => r.id === pick.id) : null;

  const exportCsv = () => saveFile(`gecko-budget-${L('operations', 'transactions')}-${todayKey()}.csv`, toCsv(settings, txs), 'text/csv;charset=utf-8');
  const exportJson = () => saveFile(`gecko-budget-${L('sauvegarde', 'backup')}-${todayKey()}.json`, toBackup(settings, txs), 'application/json');
  const importJson = async (f: File) => {
    try {
      const { settings: s, txs: t } = parseBackup(await f.text());
      if (!window.confirm(L(`Restaurer cette sauvegarde ?\n\n${t.length} opérations seront ajoutées (ou remises à jour), et les réglages remplacés.`, `Restore this backup?\n\n${t.length} transactions will be added (or updated), and the settings replaced.`))) return;
      store.importData(s, t);
      setImportMsg(L(`Sauvegarde restaurée : ${t.length} opérations.`, `Backup restored: ${t.length} transactions.`));
      setD(toDraft(s, month));
    } catch (e) {
      setImportMsg((e as Error).message);
    }
  };

  return (
    <Sheet title={L('Notre budget', 'Our budget')} onClose={onClose} closeSignal={done} footer={<button className="btn" onClick={save}>{L('Enregistrer', 'Save')}</button>}>
      <div className="grid2">
        {[0, 1].map((i) => (
          <div key={i}>
            <label className="label" htmlFor={`name${i}`}>
              {L('Prénom', 'First name')} {i + 1}
            </label>
            <input
              id={`name${i}`}
              className="field"
              value={d.names[i]}
              maxLength={20}
              autoComplete="off"
              onChange={(e) => {
                const names = [...d.names] as [string, string];
                names[i] = e.target.value;
                setD({ ...d, names });
              }}
            />
          </div>
        ))}
      </div>

      <label className="label" htmlFor="income">
        {L('Revenus du foyer par mois (€)', 'Household income per month (€)')}
      </label>
      <MoneyInput label={L('Revenus du foyer par mois', 'Household income per month')} value={d.income} onChange={(c) => setD({ ...d, income: c })} placeholder={L('ex. 3800', 'e.g. 3800')} />
      <p className="help" style={{ marginTop: 8 }}>
        {L(
          `Salaires et revenus réguliers, nets. Les montants s'appliquent à partir de ${monthLabel(month, false)} : les mois passés ne changent pas.`,
          `Regular take-home pay and income. Amounts apply from ${monthLabel(month, false)} onwards: past months don't change.`,
        )}
      </p>

      {/* ---------- charges fixes ---------- */}
      <span className="label">{L('Charges fixes', 'Fixed bills')}</span>
      <p className="help">
        {L(
          "Ce qui part tout seul chaque mois : loyer, crédit, assurances, abonnements… L'icône se choisit toute seule d'après le nom, touchez-la pour la changer. « Jour » = date du prélèvement.",
          'What goes out automatically each month: rent, loans, insurance, subscriptions… The icon is picked from the name; tap it to change it. “Day” = payment date.',
        )}
      </p>
      {d.charges.length > 0 && (
        <div className="cols">
          <span style={{ width: 50 }}>{L('Icône', 'Icon')}</span>
          <span className="grow">{L('Nom', 'Name')}</span>
          <span style={{ width: 80, textAlign: 'right' }}>{L('Montant', 'Amount')}</span>
          <span style={{ width: 62 + 28 + 6, paddingLeft: 10 }}>{L('Jour', 'Day')}</span>
        </div>
      )}
      {d.charges.map((c) => (
        <div className="setrow" key={c.id}>
          <button className="icobtn" style={{ '--c': c.color } as CSSProperties} onClick={() => setPick({ list: 'charges', id: c.id })} aria-label={L(`Changer l'icône de ${c.name || 'cette charge'}`, `Change the icon of ${c.name || 'this bill'}`)}>
            {c.icon}
          </button>
          <input
            className="field grow"
            value={c.name}
            placeholder={L('ex. Loyer', 'e.g. Rent')}
            aria-label={L('Nom de la charge', 'Bill name')}
            onChange={(e) => {
              const name = e.target.value;
              upd('charges', c.id, c.iconAuto ? { name, icon: guessIcon(name) ?? '🧾' } : { name });
            }}
          />
          <div style={{ width: 80, flex: 'none' }}>
            <MoneyInput label={L('Montant par mois', 'Amount per month')} value={c.amount} onChange={(v) => upd('charges', c.id, { amount: v })} placeholder="€" />
          </div>
          <label className="daybox">
            {L('le', 'on')}
            <input
              inputMode="numeric"
              aria-label={L('Jour du prélèvement', 'Payment day')}
              placeholder="–"
              value={c.day ?? ''}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, '').slice(0, 2), 10);
                upd('charges', c.id, { day: Number.isFinite(n) && n >= 1 ? Math.min(n, 31) : null });
              }}
            />
          </label>
          <button className="x" onClick={() => del('charges', c.id)} aria-label={L(`Supprimer ${c.name || 'cette charge'}`, `Delete ${c.name || 'this bill'}`)}>
            <Icon name="close" />
          </button>
        </div>
      ))}
      <button className="dashed" onClick={() => setD({ ...d, charges: [...d.charges, { id: uid(), name: '', icon: '🧾', color: nextColor(d.charges.length + 2), iconAuto: true, day: null, amount: 0 }] })}>
        {L('+ Ajouter une charge fixe', '+ Add a fixed bill')}
      </button>

      {/* ---------- enveloppes ---------- */}
      <span className="label" style={{ marginTop: 28 }}>
        {L('Enveloppes du quotidien', 'Everyday envelopes')}
      </span>
      <p className="help">{L("Ce qu'on s'autorise à dépenser par mois. Touchez l'icône pour la changer, ainsi que sa couleur.", 'What we allow ourselves to spend each month. Tap the icon to change it and its colour.')}</p>
      {d.envelopes.map((e) => (
        <div className="setrow" key={e.id}>
          <button className="icobtn" style={{ '--c': e.color } as CSSProperties} onClick={() => setPick({ list: 'envelopes', id: e.id })} aria-label={L(`Changer l'icône de ${e.name || 'cette enveloppe'}`, `Change the icon of ${e.name || 'this envelope'}`)}>
            {e.icon}
          </button>
          <input className="field grow" value={e.name} placeholder={L('ex. Courses', 'e.g. Groceries')} aria-label={L("Nom de l'enveloppe", 'Envelope name')} onChange={(ev) => upd('envelopes', e.id, { name: ev.target.value })} />
          <div style={{ width: 104, flex: 'none' }}>
            <MoneyInput label={L(`Budget mensuel ${e.name}`, `Monthly budget ${e.name}`)} value={e.budget} onChange={(v) => upd('envelopes', e.id, { budget: v })} placeholder={L('€/mois', '€/month')} />
          </div>
          <button className="x" onClick={() => del('envelopes', e.id)} aria-label={L(`Supprimer ${e.name || 'cette enveloppe'}`, `Delete ${e.name || 'this envelope'}`)}>
            <Icon name="close" />
          </button>
        </div>
      ))}
      <button className="dashed" onClick={() => setD({ ...d, envelopes: [...d.envelopes, { id: uid(), name: '', icon: '📦', color: nextColor(d.envelopes.length), budget: 0 }] })}>
        {L('+ Ajouter une enveloppe', '+ Add an envelope')}
      </button>

      {/* ---------- cagnottes ---------- */}
      <span className="label" style={{ marginTop: 28 }}>
        {L("Cagnottes d'épargne", 'Savings pots')}
      </span>
      <p className="help">{L("Livret A, vacances, voiture… « Objectif » est facultatif. « Déjà » = ce qu'il y a dessus aujourd'hui.", 'Savings account, holidays, car… “Goal” is optional. “Now” = what is in it today.')}</p>
      {d.pots.length > 0 && (
        <div className="cols">
          <span style={{ width: 50 }}>{L('Icône', 'Icon')}</span>
          <span className="grow">{L('Nom', 'Name')}</span>
          <span style={{ width: 76, textAlign: 'center' }}>{L('Objectif', 'Goal')}</span>
          <span style={{ width: 76 + 28 + 6, paddingLeft: 26 }}>{L('Déjà', 'Now')}</span>
        </div>
      )}
      {d.pots.map((p) => (
        <div className="setrow" key={p.id}>
          <button className="icobtn" style={{ '--c': p.color } as CSSProperties} onClick={() => setPick({ list: 'pots', id: p.id })} aria-label={L(`Changer l'icône de ${p.name || 'cette cagnotte'}`, `Change the icon of ${p.name || 'this pot'}`)}>
            {p.icon}
          </button>
          <input className="field grow" value={p.name} placeholder={L('ex. Vacances', 'e.g. Holidays')} aria-label={L('Nom de la cagnotte', 'Pot name')} onChange={(ev) => upd('pots', p.id, { name: ev.target.value })} />
          <div style={{ width: 76, flex: 'none' }}>
            <MoneyInput label={L('Objectif', 'Goal')} value={p.goal ?? 0} onChange={(v) => upd('pots', p.id, { goal: v > 0 ? v : null })} placeholder="–" />
          </div>
          <div style={{ width: 76, flex: 'none' }}>
            <MoneyInput label={L('Déjà sur la cagnotte', 'Already in the pot')} value={p.initial} onChange={(v) => upd('pots', p.id, { initial: v })} placeholder="0" />
          </div>
          <button className="x" onClick={() => del('pots', p.id)} aria-label={L(`Supprimer ${p.name || 'cette cagnotte'}`, `Delete ${p.name || 'this pot'}`)}>
            <Icon name="close" />
          </button>
        </div>
      ))}
      <button className="dashed" onClick={() => setD({ ...d, pots: [...d.pots, { id: uid(), name: '', icon: '🐷', color: nextColor(d.pots.length + 7), goal: null, initial: 0 }] })}>
        {L('+ Ajouter une cagnotte', '+ Add a savings pot')}
      </button>

      {/* ---------- langue ---------- */}
      <span className="label" style={{ marginTop: 32 }}>
        Langue · Language
      </span>
      <div className="grid2">
        {(
          [
            ['fr', '🇫🇷 Français'],
            ['en', '🇬🇧 English'],
          ] as [Lang, string][]
        ).map(([k, l]) => (
          <button key={k} className={`mode${lang === k ? ' on' : ''}`} onClick={() => setLang(k)}>
            {l}
          </button>
        ))}
      </div>

      {/* ---------- apparence ---------- */}
      <span className="label" style={{ marginTop: 32 }}>
        {L('Apparence (sur ce téléphone)', 'Appearance (on this phone)')}
      </span>
      <div className="themes">
        {(
          [
            ['auto', 'Auto'],
            ['light', L('☀️ Clair', '☀️ Light')],
            ['dark', L('🌙 Sombre', '🌙 Dark')],
          ] as [ThemeChoice, string][]
        ).map(([k, l]) => (
          <button key={k} className={`mode${theme === k ? ' on' : ''}`} onClick={() => setTheme(k)}>
            {l}
          </button>
        ))}
      </div>

      {/* ---------- foyer ---------- */}
      <span className="label" style={{ marginTop: 32 }}>
        {L('Notre foyer', 'Our household')}
      </span>
      {isDemo ? (
        <p className="help">
          <b>{L('Mode démo', 'Demo mode')}</b>
          {L(
            ' : les données restent sur cet appareil. Une fois Supabase branché (voir le guide), vous aurez chacun votre compte et un foyer partagé.',
            ': data stays on this device. Once Supabase is connected (see the guide), you will each have an account and a shared household.',
          )}
        </p>
      ) : info ? (
        <>
          <p className="help">
            {info.members >= 2
              ? L('Vous êtes deux dans ce foyer. Tout ce que l’un note apparaît chez l’autre.', 'There are two of you in this household. Whatever one records shows up for the other.')
              : L('Pour relier le 2ᵉ téléphone : créez un compte dessus, choisissez « Rejoindre un foyer » et tapez ce code :', 'To link the 2nd phone: create an account on it, choose “Join a household” and type this code:')}
          </p>
          {info.members < 2 && <div className="code">{info.code}</div>}
          {info.members < 2 && txs.length === 0 && (
            <button
              className="textlink"
              onClick={async () => {
                if (!window.confirm(L('Quitter ce foyer vide pour rejoindre celui de votre moitié avec son code ?', "Leave this empty household to join your partner's with their code?"))) return;
                try {
                  await leaveEmptyHousehold();
                  store.clearLocal();
                  window.location.reload();
                } catch (e) {
                  setInfoErr(frError(e));
                }
              }}
            >
              {L("Vous avez plutôt un code pour rejoindre l'autre foyer ?", 'Have a code to join the other household instead?')}
            </button>
          )}
          {infoErr && <div className="error-msg">{infoErr}</div>}
        </>
      ) : (
        <p className="help">{infoErr ?? L('Chargement…', 'Loading…')}</p>
      )}

      {/* ---------- sauvegarde ---------- */}
      <span className="label" style={{ marginTop: 32 }}>
        {L('Export et sauvegarde', 'Export & backup')}
      </span>
      <p className="help">{L("Le CSV s'ouvre dans Excel, Numbers ou Google Sheets. La sauvegarde (.json) contient tout et peut être restaurée ici.", 'The CSV opens in Excel, Numbers or Google Sheets. The backup (.json) contains everything and can be restored here.')}</p>
      <div className="grid2">
        <button className="btn ghost small" onClick={exportCsv}>
          📄 Export CSV
        </button>
        <button className="btn ghost small" onClick={exportJson}>
          💾 {L('Sauvegarde', 'Backup')}
        </button>
      </div>
      <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
        ♻️ {L('Restaurer une sauvegarde', 'Restore a backup')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importJson(f);
          e.target.value = '';
        }}
      />
      {importMsg && <div className="info-msg">{importMsg}</div>}

      {!isDemo && (
        <>
          <span className="label" style={{ marginTop: 32 }}>
            {L('Compte', 'Account')}
          </span>
          <p className="help">{L('Connecté avec', 'Signed in as')} {email ?? L('votre e-mail', 'your e-mail')}.</p>
          <button
            className="btn danger small"
            onClick={async () => {
              if (!window.confirm(L('Se déconnecter de Gecko Budget sur ce téléphone ?', 'Sign out of Gecko Budget on this phone?'))) return;
              store.clearLocal();
              store.close();
              await signOut();
              window.location.reload();
            }}
          >
            {L('Se déconnecter', 'Sign out')}
          </button>
        </>
      )}
      <p className="help" style={{ textAlign: 'center', marginTop: 28 }}>
        Gecko Budget · version {__APP_VERSION__}
      </p>

      {pick && pickRow && (
        <IconPicker
          name={pickRow.name}
          icon={pickRow.icon}
          color={pickRow.color}
          onClose={() => setPick(null)}
          onDone={(icon, color) => upd(pick.list, pick.id, pick.list === 'charges' ? { icon, color, iconAuto: false } : { icon, color })}
        />
      )}
    </Sheet>
  );
}
