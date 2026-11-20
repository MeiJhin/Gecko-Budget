import { useState, type CSSProperties } from 'react';
import type { Kind, Person, Settings, Tx } from '../lib/types';
import { INCOME_TYPES, uid } from '../lib/defaults';
import { centsToInput, decimalSep, euros, todayKey } from '../lib/format';
import { potBalance } from '../lib/calc';
import { store } from '../lib/store';
import { Avatar, Icon, Ico, Sheet, useToast } from './ui';
import { L, getLang } from '../lib/i18n';

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

const TITLES = (): Record<Kind, [string, string]> => ({
  expense: [L('Nouvelle dépense', 'New expense'), L('Modifier la dépense', 'Edit expense')],
  income: [L('Nouvelle rentrée', 'New extra income'), L('Modifier la rentrée', 'Edit income')],
  saving: [L('Épargne', 'Savings'), L('Modifier le mouvement', 'Edit movement')],
});

/** Affiche « 1234,5 » en « 1 234,5 » */
function pretty(s: string) {
  if (!s) return '0';
  const en = getLang() === 'en';
  const [i, d] = s.split(',');
  const int = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : '\u00a0');
  return d !== undefined ? `${int}${en ? '.' : ','}${d}` : int;
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
    if (!cents || cents <= 0) return setError(L('Indiquez un montant avec le pavé numérique.', 'Enter an amount with the keypad.'));
    if (!cat)
      return setError(
        kind === 'expense' ? L('Choisissez une enveloppe.', 'Choose an envelope.') : kind === 'income' ? L("Choisissez d'où vient l'argent.", 'Choose where the money comes from.') : L('Choisissez une cagnotte.', 'Choose a savings pot.'),
      );
    if (!date) return setError(L('Choisissez une date.', 'Choose a date.'));
    if (kind === 'saving' && dir === -1) {
      if (!note.trim()) return setError(L('Dites pourquoi vous retirez cet argent (champ « Pourquoi ? »).', 'Say why you are withdrawing this money (“Why?” field).'));
      const pot = settings.pots.find((p) => p.id === cat);
      if (pot) {
        const others = txs.filter((t) => t.id !== editing?.id);
        const bal = potBalance(pot, others);
        if (cents > bal) return setError(L(`Il n'y a que ${euros(bal, { decimals: true })} dans « ${pot.name} ».`, `There is only ${euros(bal, { decimals: true })} in “${pot.name}”.`));
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
    const offline = navigator.onLine ? '' : L(' — sera envoyé au retour du réseau', ' — will sync when back online');
    if (getLang() === 'en') {
      const what = kind === 'expense' ? 'Expense' : kind === 'income' ? 'Income' : dir === 1 ? 'Deposit' : 'Withdrawal';
      toast(`${what} ${editing ? 'updated' : 'added'} ✓${offline}`);
    } else {
      const what = kind === 'expense' ? 'Dépense' : kind === 'income' ? 'Rentrée' : dir === 1 ? 'Versement' : 'Retrait';
      toast(`${what} ${editing ? 'modifié' : 'ajouté'}${kind === 'expense' || kind === 'income' ? 'e' : ''} ✓${offline}`);
    }
    setClosing(true);
  };

  const remove = () => {
    if (!editing) return;
    if (!confirmDel) return setConfirmDel(true);
    store.deleteTx(editing.id);
    toast(L('Opération supprimée', 'Transaction deleted'));
    setClosing(true);
  };

  const whoLabel = kind === 'expense' ? L('Qui a payé ?', 'Who paid?') : kind === 'income' ? L("Qui l'a reçu ?", 'Who received it?') : L('Qui ?', 'Who?');
  const catLabel = kind === 'expense' ? L('Enveloppe', 'Envelope') : kind === 'income' ? L("D'où vient l'argent ?", 'Where does the money come from?') : L('Cagnotte', 'Savings pot');
  const amountClass = !amount || cents === 0 ? ' zero' : kind === 'income' ? ' income' : kind === 'saving' ? ' saving' : '';

  return (
    <Sheet
      title={TITLES()[kind][editing ? 1 : 0]}
      onClose={onClose}
      closeSignal={closing}
      footer={
        <>
          {editing && (
            <button className="btn danger" style={{ width: confirmDel ? '100%' : 120, flex: 'none' }} onClick={remove}>
              {confirmDel ? L('Vraiment supprimer ?', 'Really delete?') : L('Supprimer', 'Delete')}
            </button>
          )}
          {!confirmDel && (
            <button className="btn" onClick={submit}>
              {editing ? L('Enregistrer', 'Save') : L('Ajouter', 'Add')}
            </button>
          )}
        </>
      }
    >
      <div className="modes" role="tablist" aria-label={L("Type d'opération", 'Transaction type')}>
        {(
          [
            ['expense', L('💸 Dépense', '💸 Expense')],
            ['income', L('💰 Rentrée', '💰 Income')],
            ['saving', L('🐷 Épargne', '🐷 Savings')],
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
            ＋ {L('Je mets de côté', 'Put aside')}
          </button>
          <button className={`mode${dir === -1 ? ' on' : ''}`} onClick={() => setDir(-1)}>
            − {L('Je retire', 'Withdraw')}
          </button>
        </div>
      )}

      <div className={`big-amount${amountClass}`} aria-live="polite" aria-label={L(`Montant : ${pretty(amount)} euros`, `Amount: ${pretty(amount)} euros`)}>
        {kind === 'income' && cents > 0 ? '+' : kind === 'saving' && dir === -1 && cents > 0 ? '−' : ''}
        {getLang() === 'en' && <small style={{ marginLeft: 0, marginRight: 4 }}>€</small>}
        {pretty(amount)}
        {getLang() !== 'en' && <small>€</small>}
      </div>

      <span className="label">{catLabel}</span>
      {choices.length === 0 ? (
        <div className="help">{kind === 'saving' ? L('Aucune cagnotte : créez-en une dans les réglages (⚙️).', 'No savings pots: create one in the settings (⚙️).') : L('Aucune enveloppe : créez-en dans les réglages (⚙️).', 'No envelopes: create some in the settings (⚙️).')}</div>
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
          <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? L('Effacer', 'Delete') : k === ',' ? L('Virgule', 'Decimal point') : k}>
            {k === 'del' ? <Icon name="back" size={28} /> : k === ',' ? decimalSep() : k}
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
            {L('Date', 'Date')}
          </label>
          <input id="op-date" className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="op-note">
            {kind === 'saving' && dir === -1 ? L('Pourquoi ? *', 'Why? *') : L('Note', 'Note')}
          </label>
          <input
            id="op-note"
            className={`field${error && kind === 'saving' && dir === -1 && !note.trim() ? ' err' : ''}`}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError(null);
            }}
            placeholder={kind === 'expense' ? L('ex. Leclerc', 'e.g. Tesco') : kind === 'income' ? L('ex. vente vélo', 'e.g. sold bike') : dir === -1 ? L('ex. réparation voiture', 'e.g. car repair') : L('facultatif', 'optional')}
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
