import { useState, type CSSProperties } from 'react';
import type { Kind, Person, Settings, Tx } from '../lib/types';
import { INCOME_TYPES, uid } from '../lib/defaults';
import { centsToInput, euros, todayKey } from '../lib/format';
import { potBalance } from '../lib/calc';
import { store } from '../lib/store';
import { Avatar, Icon, Ico, Sheet, useToast } from './ui';

export interface AddInit {
  kind?: Kind;
  /** épargne : 1 = je mets de côté, -1 = je retire */
  dir?: 1 | -1;
  pot?: string;
  tx?: Tx;
}

const LAST_PERSON = 'gb:lastPerson';
const readLastPerson = (): Person => {
  try {
    return localStorage.getItem(LAST_PERSON) === '2' ? 2 : 1;
  } catch {
    return 1;
  }
};

const TITLES: Record<Kind, [string, string]> = {
  expense: ['Nouvelle dépense', 'Modifier la dépense'],
  income: ['Nouvelle rentrée', 'Modifier la rentrée'],
  saving: ['Épargne', 'Modifier le mouvement'],
};

/** Affiche « 1234,5 » en « 1 234,5 » */
function pretty(s: string) {
  if (!s) return '0';
  const [i, d] = s.split(',');
  const int = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return d !== undefined ? `${int},${d}` : int;
}

export default function AddSheet({ init, settings, txs, onClose }: { init: AddInit; settings: Settings; txs: Tx[]; onClose: () => void }) {
  const toast = useToast();
  const editing = init.tx;
  const [kind, setKind] = useState<Kind>(editing?.kind ?? init.kind ?? 'expense');
  const [amount, setAmount] = useState(editing ? centsToInput(Math.abs(editing.amount)) : '');
  const [dir, setDir] = useState<1 | -1>(editing ? (editing.amount < 0 ? -1 : 1) : (init.dir ?? 1));
  const [cat, setCat] = useState<string | null>(editing?.category ?? (init.kind === 'saving' ? (init.pot ?? (settings.pots.filter((p) => !p.archived).length === 1 ? settings.pots.find((p) => !p.archived)!.id : null)) : null));
  const [person, setPerson] = useState<Person>(editing?.person ?? readLastPerson());
  const [date, setDate] = useState(editing?.date ?? todayKey());
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [closing, setClosing] = useState(false);

  const switchKind = (k: Kind) => {
    if (k === kind) return;
    setKind(k);
    setCat(k === 'saving' && settings.pots.filter((p) => !p.archived).length === 1 ? settings.pots.find((p) => !p.archived)!.id : null);
    setError(null);
  };

  const press = (k: string) => {
    setError(null);
    setAmount((a) => {
      if (k === 'del') return a.slice(0, -1);
      if (k === ',') return a.includes(',') ? a : (a || '0') + ',';
      const [i, d] = a.split(',');
      if (d !== undefined && d.length >= 2) return a;
      if (d === undefined && (i ?? '').length >= 7) return a;
      if (a === '0') return k;
      return a + k;
    });
  };

  const cents = Math.round(Number((amount || '0').replace(',', '.')) * 100);

  const envs = settings.envelopes.filter((e) => !e.archived || e.id === editing?.category);
  const pots = settings.pots.filter((p) => !p.archived || p.id === editing?.category);
  const choices = kind === 'expense' ? envs : kind === 'income' ? INCOME_TYPES : pots;

  const submit = () => {
    if (!cents || cents <= 0) return setError('Indiquez un montant avec le pavé numérique.');
    if (!cat)
      return setError(kind === 'expense' ? 'Choisissez une enveloppe.' : kind === 'income' ? "Choisissez d'où vient l'argent." : 'Choisissez une cagnotte.');
    if (!date) return setError('Choisissez une date.');
    if (kind === 'saving' && dir === -1) {
      if (!note.trim()) return setError('Dites pourquoi vous retirez cet argent (champ « Pourquoi ? »).');
      const pot = settings.pots.find((p) => p.id === cat);
      if (pot) {
        const others = txs.filter((t) => t.id !== editing?.id);
        const bal = potBalance(pot, others);
        if (cents > bal) return setError(`Il n'y a que ${euros(bal, { decimals: true })} dans « ${pot.name} ».`);
      }
    }
    const tx: Tx = {
      id: editing?.id ?? uid(),
      kind,
      amount: kind === 'saving' ? dir * cents : cents,
      category: cat,
      person,
      date,
      note: note.trim(),
      created_at: editing?.created_at ?? '',
      updated_at: '',
    };
    store.saveTx(tx);
    try {
      localStorage.setItem(LAST_PERSON, String(person));
    } catch {
      /* ignore */
    }
    const what = kind === 'expense' ? 'Dépense' : kind === 'income' ? 'Rentrée' : dir === 1 ? 'Versement' : 'Retrait';
    toast(`${what} ${editing ? 'modifié' : 'ajouté'}${kind === 'expense' || kind === 'income' ? 'e' : ''} ✓${navigator.onLine ? '' : ' — sera envoyé au retour du réseau'}`);
    setClosing(true);
  };

  const remove = () => {
    if (!editing) return;
    if (!confirmDel) return setConfirmDel(true);
    store.deleteTx(editing.id);
    toast('Opération supprimée');
    setClosing(true);
  };

  const whoLabel = kind === 'expense' ? 'Qui a payé ?' : kind === 'income' ? "Qui l'a reçu ?" : 'Qui ?';
  const catLabel = kind === 'expense' ? 'Enveloppe' : kind === 'income' ? "D'où vient l'argent ?" : 'Cagnotte';
  const amountClass = !amount || cents === 0 ? ' zero' : kind === 'income' ? ' income' : kind === 'saving' ? ' saving' : '';

  return (
    <Sheet
      title={TITLES[kind][editing ? 1 : 0]}
      onClose={onClose}
      closeSignal={closing}
      footer={
        <>
          {editing && (
            <button className="btn danger" style={{ width: confirmDel ? '100%' : 120, flex: 'none' }} onClick={remove}>
              {confirmDel ? 'Vraiment supprimer ?' : 'Supprimer'}
            </button>
          )}
          {!confirmDel && (
            <button className="btn" onClick={submit}>
              {editing ? 'Enregistrer' : 'Ajouter'}
            </button>
          )}
        </>
      }
    >
      <div className="modes" role="tablist" aria-label="Type d'opération">
        {(
          [
            ['expense', '💸 Dépense'],
            ['income', '💰 Rentrée'],
            ['saving', '🐷 Épargne'],
          ] as [Kind, string][]
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={`mode${kind === k ? ' on' : ''}`} onClick={() => switchKind(k)}>
            {l}
          </button>
        ))}
      </div>

      {kind === 'saving' && (
        <div className="dir">
          <button className={`mode${dir === 1 ? ' on' : ''}`} onClick={() => setDir(1)}>
            ＋ Je mets de côté
          </button>
          <button className={`mode${dir === -1 ? ' on' : ''}`} onClick={() => setDir(-1)}>
            − Je retire
          </button>
        </div>
      )}

      <div className={`big-amount${amountClass}`} aria-live="polite" aria-label={`Montant : ${pretty(amount)} euros`}>
        {kind === 'income' && cents > 0 ? '+' : kind === 'saving' && dir === -1 && cents > 0 ? '−' : ''}
        {pretty(amount)}
        <small>€</small>
      </div>

      <span className="label">{catLabel}</span>
      {choices.length === 0 ? (
        <div className="help">{kind === 'saving' ? 'Aucune cagnotte : créez-en une dans les réglages (⚙️).' : 'Aucune enveloppe : créez-en dans les réglages (⚙️).'}</div>
      ) : (
        <div className="pickchips" role="radiogroup" aria-label={catLabel}>
          {choices.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={cat === c.id}
              className={`pickchip${cat === c.id ? ' on' : ''}`}
              onClick={() => {
                setCat(c.id);
                setError(null);
              }}
              style={{ '--c': c.color } as CSSProperties}
            >
              <Ico icon={c.icon} color={c.color} size={40} radius={12} />
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map((k) => (
          <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? 'Effacer' : k === ',' ? 'Virgule' : k}>
            {k === 'del' ? <Icon name="back" size={28} /> : k}
          </button>
        ))}
      </div>

      <span className="label">{whoLabel}</span>
      <div className="persons" role="radiogroup" aria-label={whoLabel}>
        {([1, 2] as Person[]).map((p) => (
          <button key={p} role="radio" aria-checked={person === p} className={`person${person === p ? ' on' : ''}`} onClick={() => setPerson(p)}>
            <Avatar person={p} names={settings.names} size={28} />
            <span className="ellipsis">{settings.names[p - 1]}</span>
          </button>
        ))}
      </div>

      <div className="grid2">
        <div>
          <label className="label" htmlFor="op-date">
            Date
          </label>
          <input id="op-date" className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="op-note">
            {kind === 'saving' && dir === -1 ? 'Pourquoi ? *' : 'Note'}
          </label>
          <input
            id="op-note"
            className={`field${error && kind === 'saving' && dir === -1 && !note.trim() ? ' err' : ''}`}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError(null);
            }}
            placeholder={kind === 'expense' ? 'ex. Leclerc' : kind === 'income' ? 'ex. vente vélo' : dir === -1 ? 'ex. réparation voiture' : 'facultatif'}
            maxLength={80}
            enterKeyHint="done"
          />
        </div>
      </div>

      {error && (
        <div className="error-msg" role="alert">
          {error}
        </div>
      )}
    </Sheet>
  );
}
