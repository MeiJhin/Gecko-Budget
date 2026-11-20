import { useMemo, useState } from 'react';
import { categoryOf, expenses, incomes, total } from '../lib/calc';
import { INCOME_TYPES } from '../lib/defaults';
import { euros } from '../lib/format';
import { Avatar, Empty, Icon, TxGroups, signed } from '../components/ui';
import type { DepFilter, ScreenProps } from '../App';
import type { Person } from '../lib/types';
import { L, P } from '../lib/i18n';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function Depenses({ data, nav }: ScreenProps) {
  const { settings, txs } = data;
  const f = nav.depFilter;
  const setF = nav.setDepFilter;
  const [q, setQ] = useState('');
  const [byAmount, setByAmount] = useState(false);

  const monthTxs = useMemo(() => txs.filter((t) => t.date.startsWith(nav.month) && t.kind !== 'saving'), [txs, nav.month]);
  const spent = total(expenses(monthTxs));
  const inc = total(incomes(monthTxs));

  const list = useMemo(() => {
    const nq = norm(q.trim());
    let l = monthTxs.filter((t) => {
      if (f.kind && t.kind !== f.kind) return false;
      if (f.person && t.person !== f.person) return false;
      if (f.cat && t.category !== f.cat) return false;
      if (nq) {
        const hay = norm([t.note, categoryOf(settings, t).name, settings.names[t.person - 1]].join(' '));
        if (!hay.includes(nq)) return false;
      }
      return true;
    });
    if (byAmount) l = [...l].sort((a, b) => b.amount - a.amount);
    return l;
  }, [monthTxs, f, q, byAmount, settings]);
  const net = list.reduce((a, t) => a + signed(t), 0);

  // enveloppes du mois + types de rentrées utilisés
  const usedEnv = new Set(monthTxs.filter((t) => t.kind === 'expense').map((t) => t.category));
  const envChips = settings.envelopes.filter((e) => !e.archived || usedEnv.has(e.id));
  const usedInc = new Set(monthTxs.filter((t) => t.kind === 'income').map((t) => t.category));
  const incChips = INCOME_TYPES.filter((i) => usedInc.has(i.id));

  const all = !f.kind && !f.person && !f.cat;
  const toggle = (p: Partial<typeof f>) => {
    const next: DepFilter = { ...f };
    if (p.kind) next.kind = f.kind === p.kind ? undefined : p.kind;
    if (p.person) next.person = f.person === p.person ? undefined : p.person;
    if (p.cat) next.cat = f.cat === p.cat ? undefined : p.cat;
    // en changeant Dépenses/Rentrées, on oublie la catégorie choisie
    if (p.kind) next.cat = undefined;
    setF(next);
  };

  return (
    <div className="fade-in">
      <div className="stats3">
        <div className="stat">
          <div className="k">{L('Dépensé', 'Spent')}</div>
          <div className="v num">{euros(spent)}</div>
        </div>
        <div className="stat">
          <div className="k">{L('Rentrées', 'Extra income')}</div>
          <div className="v num" style={{ color: 'var(--income)' }}>
            +{euros(inc)}
          </div>
        </div>
        <div className="stat">
          <div className="k">{L('Opérations', 'Transactions')}</div>
          <div className="v num">{monthTxs.length}</div>
        </div>
      </div>

      <label className="search">
        <span className="muted">
          <Icon name="search" />
        </span>
        <span className="sr">{L('Rechercher', 'Search')}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Rechercher : Leclerc, resto, Vinted…', 'Search: Tesco, restaurant, eBay…')} enterKeyHint="search" />
        {q && (
          <button onClick={() => setQ('')} aria-label={L('Effacer la recherche', 'Clear search')} className="muted">
            <Icon name="close" size={18} />
          </button>
        )}
      </label>

      <div className="chips" role="group" aria-label={L('Filtres', 'Filters')}>
        <button className={`chip${all ? ' on' : ''}`} onClick={() => setF({})}>
          {L('Tout', 'All')}
        </button>
        <button className={`chip${f.kind === 'expense' ? ' on' : ''}`} onClick={() => toggle({ kind: 'expense' })}>
          💸 {L('Dépenses', 'Expenses')}
        </button>
        <button className={`chip${f.kind === 'income' ? ' on' : ''}`} onClick={() => toggle({ kind: 'income' })}>
          💰 {L('Rentrées', 'Income')}
        </button>
        {([1, 2] as Person[]).map((p) => (
          <button key={p} className={`chip${f.person === p ? ' on' : ''}`} onClick={() => toggle({ person: p })}>
            <Avatar person={p} names={settings.names} size={24} /> {settings.names[p - 1]}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label={L('Filtrer par catégorie', 'Filter by category')}>
        {f.kind !== 'income' &&
          envChips.map((e) => (
            <button key={e.id} className={`chip${f.cat === e.id ? ' on' : ''}`} onClick={() => toggle({ cat: e.id })}>
              <span aria-hidden="true">{e.icon}</span> {e.name}
            </button>
          ))}
        {f.kind !== 'expense' &&
          incChips.map((i) => (
            <button key={i.id} className={`chip${f.cat === i.id ? ' on' : ''}`} onClick={() => toggle({ cat: i.id })}>
              <span aria-hidden="true">{i.icon}</span> {i.name}
            </button>
          ))}
      </div>

      <div className="listbar">
        <span className="num">
          <b>{list.length}</b> {P(list.length, 'opération', 'transaction')} · <b>{euros(net, { decimals: true, sign: true })}</b>
        </span>
        <button className="link" onClick={() => setByAmount(!byAmount)}>
          {L('Trier : ', 'Sort: ')}{byAmount ? L('plus gros montants', 'largest amounts') : L('plus récentes', 'most recent')}
        </button>
      </div>

      {list.length === 0 ? (
        <Empty emoji="🔍">{monthTxs.length === 0 ? L('Aucune opération ce mois-ci.', 'No transactions this month.') : L('Aucune opération ne correspond.', 'No matching transactions.')}</Empty>
      ) : (
        <TxGroups txs={list} settings={settings} onOpen={nav.openEdit} today={nav.today} sortByAmount={byAmount} />
      )}
    </div>
  );
}
