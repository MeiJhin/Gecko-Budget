import { useState, type CSSProperties } from 'react';
import { monthEnd, potBalance, savings, savingsFlow, savingsSeries, savingsTotal } from '../lib/calc';
import { euros, monthLabel, monthName, monthOf } from '../lib/format';
import { GoldArea } from '../components/charts';
import { Empty, Icon, Ico, TxRow } from '../components/ui';
import type { ScreenProps } from '../App';
import type { Tx } from '../lib/types';
import { L } from '../lib/i18n';

export default function Epargne({ data, nav }: ScreenProps) {
  const { settings, txs } = data;
  const [potFilter, setPotFilter] = useState<string | null>(null);
  const isCurrent = nav.month === monthOf(nav.today);
  const upTo = nav.month >= monthOf(nav.today) ? undefined : monthEnd(nav.month);
  const totalNow = savingsTotal(settings, txs, upTo);
  const flow = savingsFlow(txs, [nav.month]);
  const series = savingsSeries(settings, txs, nav.month, 6);
  const pots = settings.pots.filter((p) => !p.archived);

  const moves = savings(txs).filter((t) => !potFilter || t.category === potFilter);
  const byMonth: { m: string; items: Tx[] }[] = [];
  for (const t of moves) {
    const m = monthOf(t.date);
    const g = byMonth[byMonth.length - 1];
    if (g && g.m === m) g.items.push(t);
    else byMonth.push({ m, items: [t] });
  }
  const filtered = settings.pots.find((p) => p.id === potFilter);

  return (
    <div className="fade-in">
      <section className="savehero" aria-label={L('Notre épargne', 'Our savings')}>
        <div style={{ opacity: 0.85 }}>{isCurrent || !upTo ? L('Notre épargne', 'Our savings') : L(`Notre épargne fin ${monthName(nav.month)}`, `Our savings at the end of ${monthName(nav.month)}`)}</div>
        <div className="big num">{euros(totalNow)}</div>
        <div className="delta num" style={{ opacity: 0.92 }}>
          {flow.in === 0 && flow.out === 0 ? (
            <>{isCurrent ? L('Ce mois-ci', 'This month') : L(`En ${monthName(nav.month)}`, `In ${monthName(nav.month)}`)}{L(' : pas encore de mouvement', ': no movement yet')}</>
          ) : (
            <>
              {isCurrent ? L('Ce mois-ci', 'This month') : L(`En ${monthName(nav.month)}`, `In ${monthName(nav.month)}`)}{L(' : ', ': ')}<b>{euros(flow.in - flow.out, { sign: true })}</b>
              <span className="small" style={{ opacity: 0.8 }}>
                {' '}
                ({L('versé', 'in')} {euros(flow.in)}
                {flow.out > 0 && <> · {L('retiré', 'out')} {euros(flow.out)}</>})
              </span>
            </>
          )}
        </div>
        <div style={{ marginTop: 14 }}>
          <GoldArea points={series.map((p) => p.total)} firstLabel={monthName(series[0].month)} lastLabel={isCurrent ? L("aujourd'hui", 'today') : monthName(nav.month)} />
        </div>
      </section>

      <div className="btn2">
        <button className="btn-gold" onClick={() => nav.openAdd({ kind: 'saving', dir: 1, pot: potFilter ?? undefined })}>
          ＋ {L('Mettre de côté', 'Put aside')}
        </button>
        <button className="btn-soft" onClick={() => nav.openAdd({ kind: 'saving', dir: -1, pot: potFilter ?? undefined })}>
          − {L('Retirer', 'Withdraw')}
        </button>
      </div>

      <div className="section-head">
        <h2>{L('Nos cagnottes', 'Our savings pots')}</h2>
        <button className="link" onClick={nav.openSettings}>
          {L('Gérer', 'Manage')}
        </button>
      </div>
      {pots.length === 0 ? (
        <Empty emoji="🐷">{L('Aucune cagnotte : créez-en une dans les réglages (Livret A, Vacances, Voiture…).', 'No savings pots: create one in the settings (savings account, holidays, car…).')}</Empty>
      ) : (
        pots.map((p) => {
          const bal = potBalance(p, txs, upTo);
          const ratio = p.goal ? Math.min(bal / p.goal, 1) : 0;
          return (
            <button key={p.id} className={`card pot${potFilter === p.id ? ' on' : ''}`} onClick={() => setPotFilter(potFilter === p.id ? null : p.id)} aria-pressed={potFilter === p.id}>
              <Ico icon={p.icon} color={p.color} size={54} />
              <span className="grow">
                <span className="t ellipsis" style={{ display: 'block', fontWeight: 700, fontSize: 18 }}>
                  {p.name}
                </span>
                {p.goal ? (
                  <>
                    <span className="progress" style={{ display: 'block', marginTop: 8, '--c': p.color } as CSSProperties}>
                      <b className="grow-x" style={{ width: `${ratio * 100}%` }} />
                    </span>
                    <span className="small muted num" style={{ display: 'block', marginTop: 6 }}>
                      {L(`${Math.round((bal / p.goal) * 100)} % de l'objectif`, `${Math.round((bal / p.goal) * 100)}% of the goal`)} · {euros(p.goal)}
                    </span>
                  </>
                ) : (
                  <span className="small muted">{L("Pas d'objectif fixé", 'No goal set')}</span>
                )}
              </span>
              <span className="bal num">{euros(bal)}</span>
            </button>
          );
        })
      )}

      <div className="section-head">
        <h2>{L('Mouvements', 'Movements')}</h2>
        {filtered && (
          <button className="filter-tag" onClick={() => setPotFilter(null)} aria-label={L(`Retirer le filtre ${filtered.name}`, `Remove filter ${filtered.name}`)}>
            {filtered.name} <Icon name="close" size={16} />
          </button>
        )}
      </div>
      {byMonth.length === 0 ? (
        <Empty emoji="🪙">{L("Aucun mouvement pour l'instant. Touchez « Mettre de côté » pour commencer.", 'No movements yet. Tap “Put aside” to start.')}</Empty>
      ) : (
        <div className="card">
          {byMonth.map((g) => (
            <div className="daygroup" key={g.m}>
              <div className="dayhead">
                <span>{monthLabel(g.m, false)}</span>
                <span className="num">{euros(g.items.reduce((a, t) => a + t.amount, 0), { sign: true })}</span>
              </div>
              {g.items.map((t) => (
                <TxRow key={t.id} t={t} settings={settings} onOpen={nav.openEdit} today={nav.today} showDate />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
