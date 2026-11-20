import { useState, type CSSProperties } from 'react';
import { monthEnd, potBalance, savings, savingsFlow, savingsSeries, savingsTotal } from '../lib/calc';
import { euros, monthLabel, monthName, monthOf } from '../lib/format';
import { GoldArea } from '../components/charts';
import { Empty, Icon, Ico, TxRow } from '../components/ui';
import type { ScreenProps } from '../App';
import type { Tx } from '../lib/types';

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
      <section className="savehero" aria-label="Notre épargne">
        <div style={{ opacity: 0.85 }}>{isCurrent || !upTo ? 'Notre épargne' : `Notre épargne fin ${monthName(nav.month)}`}</div>
        <div className="big num">{euros(totalNow)}</div>
        <div className="delta num" style={{ opacity: 0.92 }}>
          {flow.in === 0 && flow.out === 0 ? (
            <>{isCurrent ? 'Ce mois-ci' : `En ${monthName(nav.month)}`} : pas encore de mouvement</>
          ) : (
            <>
              {isCurrent ? 'Ce mois-ci' : `En ${monthName(nav.month)}`} : <b>{euros(flow.in - flow.out, { sign: true })}</b>
              <span className="small" style={{ opacity: 0.8 }}>
                {' '}
                (versé {euros(flow.in)}
                {flow.out > 0 && <> · retiré {euros(flow.out)}</>})
              </span>
            </>
          )}
        </div>
        <div style={{ marginTop: 14 }}>
          <GoldArea points={series.map((p) => p.total)} firstLabel={monthName(series[0].month)} lastLabel={isCurrent ? "aujourd'hui" : monthName(nav.month)} />
        </div>
      </section>

      <div className="btn2">
        <button className="btn-gold" onClick={() => nav.openAdd({ kind: 'saving', dir: 1, pot: potFilter ?? undefined })}>
          ＋ Mettre de côté
        </button>
        <button className="btn-soft" onClick={() => nav.openAdd({ kind: 'saving', dir: -1, pot: potFilter ?? undefined })}>
          − Retirer
        </button>
      </div>

      <div className="section-head">
        <h2>Nos cagnottes</h2>
        <button className="link" onClick={nav.openSettings}>
          Gérer
        </button>
      </div>
      {pots.length === 0 ? (
        <Empty emoji="🐷">Aucune cagnotte : créez-en une dans les réglages (Livret A, Vacances, Voiture…).</Empty>
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
                      {Math.round((bal / p.goal) * 100)} % de l'objectif · {euros(p.goal)}
                    </span>
                  </>
                ) : (
                  <span className="small muted">Pas d'objectif fixé</span>
                )}
              </span>
              <span className="bal num">{euros(bal)}</span>
            </button>
          );
        })
      )}

      <div className="section-head">
        <h2>Mouvements</h2>
        {filtered && (
          <button className="filter-tag" onClick={() => setPotFilter(null)} aria-label={`Retirer le filtre ${filtered.name}`}>
            {filtered.name} <Icon name="close" size={16} />
          </button>
        )}
      </div>
      {byMonth.length === 0 ? (
        <Empty emoji="🪙">Aucun mouvement pour l'instant. Touchez « Mettre de côté » pour commencer.</Empty>
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
