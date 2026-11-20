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
    toast('Réglages enregistrés ✓');
    setDone(true);
  };

  const pickRow = pick ? (d[pick.list] as { id: string; name: string; icon: string; color: string }[]).find((r) => r.id === pick.id) : null;

  const exportCsv = () => saveFile(`gecko-budget-operations-${todayKey()}.csv`, toCsv(settings, txs), 'text/csv;charset=utf-8');
  const exportJson = () => saveFile(`gecko-budget-sauvegarde-${todayKey()}.json`, toBackup(settings, txs), 'application/json');
  const importJson = async (f: File) => {
    try {
      const { settings: s, txs: t } = parseBackup(await f.text());
      if (!window.confirm(`Restaurer cette sauvegarde ?\n\n${t.length} opérations seront ajoutées (ou remises à jour), et les réglages remplacés.`)) return;
      store.importData(s, t);
      setImportMsg(`Sauvegarde restaurée : ${t.length} opérations.`);
      setD(toDraft(s, month));
    } catch (e) {
      setImportMsg((e as Error).message);
    }
  };

  return (
    <Sheet title="Notre budget" onClose={onClose} closeSignal={done} footer={<button className="btn" onClick={save}>Enregistrer</button>}>
      <div className="grid2">
        {[0, 1].map((i) => (
          <div key={i}>
            <label className="label" htmlFor={`name${i}`}>
              Prénom {i + 1}
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
        Revenus du foyer par mois (€)
      </label>
      <MoneyInput label="Revenus du foyer par mois" value={d.income} onChange={(c) => setD({ ...d, income: c })} placeholder="ex. 3800" />
      <p className="help" style={{ marginTop: 8 }}>
        Salaires et revenus réguliers, nets. Les montants s'appliquent à partir de {monthLabel(month, false)} : les mois passés ne changent pas.
      </p>

      {/* ---------- charges fixes ---------- */}
      <span className="label">Charges fixes</span>
      <p className="help">
        Ce qui part tout seul chaque mois : loyer, crédit, assurances, abonnements… L'icône se choisit toute seule d'après le nom, touchez-la pour la changer. « Jour » = date du
        prélèvement.
      </p>
      {d.charges.length > 0 && (
        <div className="cols">
          <span style={{ width: 50 }}>Icône</span>
          <span className="grow">Nom</span>
          <span style={{ width: 80, textAlign: 'right' }}>Montant</span>
          <span style={{ width: 62 + 28 + 6, paddingLeft: 10 }}>Jour</span>
        </div>
      )}
      {d.charges.map((c) => (
        <div className="setrow" key={c.id}>
          <button className="icobtn" style={{ '--c': c.color } as CSSProperties} onClick={() => setPick({ list: 'charges', id: c.id })} aria-label={`Changer l'icône de ${c.name || 'cette charge'}`}>
            {c.icon}
          </button>
          <input
            className="field grow"
            value={c.name}
            placeholder="ex. Loyer"
            aria-label="Nom de la charge"
            onChange={(e) => {
              const name = e.target.value;
              upd('charges', c.id, c.iconAuto ? { name, icon: guessIcon(name) ?? '🧾' } : { name });
            }}
          />
          <div style={{ width: 80, flex: 'none' }}>
            <MoneyInput label="Montant par mois" value={c.amount} onChange={(v) => upd('charges', c.id, { amount: v })} placeholder="€" />
          </div>
          <label className="daybox">
            le
            <input
              inputMode="numeric"
              aria-label="Jour du prélèvement"
              placeholder="–"
              value={c.day ?? ''}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, '').slice(0, 2), 10);
                upd('charges', c.id, { day: Number.isFinite(n) && n >= 1 ? Math.min(n, 31) : null });
              }}
            />
          </label>
          <button className="x" onClick={() => del('charges', c.id)} aria-label={`Supprimer ${c.name || 'cette charge'}`}>
            <Icon name="close" />
          </button>
        </div>
      ))}
      <button className="dashed" onClick={() => setD({ ...d, charges: [...d.charges, { id: uid(), name: '', icon: '🧾', color: nextColor(d.charges.length + 2), iconAuto: true, day: null, amount: 0 }] })}>
        + Ajouter une charge fixe
      </button>

      {/* ---------- enveloppes ---------- */}
      <span className="label" style={{ marginTop: 28 }}>
        Enveloppes du quotidien
      </span>
      <p className="help">Ce qu'on s'autorise à dépenser par mois. Touchez l'icône pour la changer, ainsi que sa couleur.</p>
      {d.envelopes.map((e) => (
        <div className="setrow" key={e.id}>
          <button className="icobtn" style={{ '--c': e.color } as CSSProperties} onClick={() => setPick({ list: 'envelopes', id: e.id })} aria-label={`Changer l'icône de ${e.name || 'cette enveloppe'}`}>
            {e.icon}
          </button>
          <input className="field grow" value={e.name} placeholder="ex. Courses" aria-label="Nom de l'enveloppe" onChange={(ev) => upd('envelopes', e.id, { name: ev.target.value })} />
          <div style={{ width: 104, flex: 'none' }}>
            <MoneyInput label={`Budget mensuel ${e.name}`} value={e.budget} onChange={(v) => upd('envelopes', e.id, { budget: v })} placeholder="€/mois" />
          </div>
          <button className="x" onClick={() => del('envelopes', e.id)} aria-label={`Supprimer ${e.name || 'cette enveloppe'}`}>
            <Icon name="close" />
          </button>
        </div>
      ))}
      <button className="dashed" onClick={() => setD({ ...d, envelopes: [...d.envelopes, { id: uid(), name: '', icon: '📦', color: nextColor(d.envelopes.length), budget: 0 }] })}>
        + Ajouter une enveloppe
      </button>

      {/* ---------- cagnottes ---------- */}
      <span className="label" style={{ marginTop: 28 }}>
        Cagnottes d'épargne
      </span>
      <p className="help">Livret A, vacances, voiture… « Objectif » est facultatif. « Déjà » = ce qu'il y a dessus aujourd'hui.</p>
      {d.pots.length > 0 && (
        <div className="cols">
          <span style={{ width: 50 }}>Icône</span>
          <span className="grow">Nom</span>
          <span style={{ width: 76, textAlign: 'center' }}>Objectif</span>
          <span style={{ width: 76 + 28 + 6, paddingLeft: 26 }}>Déjà</span>
        </div>
      )}
      {d.pots.map((p) => (
        <div className="setrow" key={p.id}>
          <button className="icobtn" style={{ '--c': p.color } as CSSProperties} onClick={() => setPick({ list: 'pots', id: p.id })} aria-label={`Changer l'icône de ${p.name || 'cette cagnotte'}`}>
            {p.icon}
          </button>
          <input className="field grow" value={p.name} placeholder="ex. Vacances" aria-label="Nom de la cagnotte" onChange={(ev) => upd('pots', p.id, { name: ev.target.value })} />
          <div style={{ width: 76, flex: 'none' }}>
            <MoneyInput label="Objectif" value={p.goal ?? 0} onChange={(v) => upd('pots', p.id, { goal: v > 0 ? v : null })} placeholder="–" />
          </div>
          <div style={{ width: 76, flex: 'none' }}>
            <MoneyInput label="Déjà sur la cagnotte" value={p.initial} onChange={(v) => upd('pots', p.id, { initial: v })} placeholder="0" />
          </div>
          <button className="x" onClick={() => del('pots', p.id)} aria-label={`Supprimer ${p.name || 'cette cagnotte'}`}>
            <Icon name="close" />
          </button>
        </div>
      ))}
      <button className="dashed" onClick={() => setD({ ...d, pots: [...d.pots, { id: uid(), name: '', icon: '🐷', color: nextColor(d.pots.length + 7), goal: null, initial: 0 }] })}>
        + Ajouter une cagnotte
      </button>

      {/* ---------- apparence ---------- */}
      <span className="label" style={{ marginTop: 32 }}>
        Apparence (sur ce téléphone)
      </span>
      <div className="themes">
        {(
          [
            ['auto', 'Auto'],
            ['light', '☀️ Clair'],
            ['dark', '🌙 Sombre'],
          ] as [ThemeChoice, string][]
        ).map(([k, l]) => (
          <button key={k} className={`mode${theme === k ? ' on' : ''}`} onClick={() => setTheme(k)}>
            {l}
          </button>
        ))}
      </div>

      {/* ---------- foyer ---------- */}
      <span className="label" style={{ marginTop: 32 }}>
        Notre foyer
      </span>
      {isDemo ? (
        <p className="help">
          <b>Mode démo</b> : les données restent sur cet appareil. Une fois Supabase branché (voir le guide), vous aurez chacun votre compte et un foyer partagé.
        </p>
      ) : info ? (
        <>
          <p className="help">
            {info.members >= 2
              ? 'Vous êtes deux dans ce foyer. Tout ce que l’un note apparaît chez l’autre.'
              : 'Pour relier le 2ᵉ téléphone : créez un compte dessus, choisissez « Rejoindre un foyer » et tapez ce code :'}
          </p>
          {info.members < 2 && <div className="code">{info.code}</div>}
          {info.members < 2 && txs.length === 0 && (
            <button
              className="textlink"
              onClick={async () => {
                if (!window.confirm("Quitter ce foyer vide pour rejoindre celui de votre moitié avec son code ?")) return;
                try {
                  await leaveEmptyHousehold();
                  store.clearLocal();
                  window.location.reload();
                } catch (e) {
                  setInfoErr(frError(e));
                }
              }}
            >
              Vous avez plutôt un code pour rejoindre l'autre foyer ?
            </button>
          )}
          {infoErr && <div className="error-msg">{infoErr}</div>}
        </>
      ) : (
        <p className="help">{infoErr ?? 'Chargement…'}</p>
      )}

      {/* ---------- sauvegarde ---------- */}
      <span className="label" style={{ marginTop: 32 }}>
        Export et sauvegarde
      </span>
      <p className="help">Le CSV s'ouvre dans Excel, Numbers ou Google Sheets. La sauvegarde (.json) contient tout et peut être restaurée ici.</p>
      <div className="grid2">
        <button className="btn ghost small" onClick={exportCsv}>
          📄 Export CSV
        </button>
        <button className="btn ghost small" onClick={exportJson}>
          💾 Sauvegarde
        </button>
      </div>
      <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
        ♻️ Restaurer une sauvegarde
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
            Compte
          </span>
          <p className="help">Connecté avec {email ?? 'votre e-mail'}.</p>
          <button
            className="btn danger small"
            onClick={async () => {
              if (!window.confirm('Se déconnecter de Gecko Budget sur ce téléphone ?')) return;
              store.clearLocal();
              store.close();
              await signOut();
              window.location.reload();
            }}
          >
            Se déconnecter
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
