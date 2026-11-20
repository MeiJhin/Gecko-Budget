import { useState, type CSSProperties } from 'react';
import { bilan, chargeLines, nextCharge, potBalance, savingsTotal, typicalMonth } from '../lib/calc';
import { addMonths, euros, monthOf, periodLabel, pct } from '../lib/format';
import { Donut, MonthBars } from '../components/charts';
import { Avatar, Empty, Ico } from '../components/ui';
import type { ScreenProps } from '../App';
import type { Person } from '../lib/types';
import { L, P } from '../lib/i18n';

const ordinal = (n: number) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

const PERIODS = (): { n: number; label: string }[] => [
  { n: 1, label: L('1 mois', '1 month') },
  { n: 2, label: L('2 mois', '2 months') },
  { n: 3, label: L('3 mois', '3 months') },
  { n: 6, label: L('6 mois', '6 months') },
  { n: 12, label: L('1 an', '1 year') },
];

export default function Bilan(props: ScreenProps) {
  const { nav } = props;
  return (
    <div className="fade-in">
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={nav.bilanView === 'bilan'} className={nav.bilanView === 'bilan' ? 'on' : ''} onClick={() => nav.setBilanView('bilan')}>
          {L('Bilan', 'Report')}
        </button>
        <button role="tab" aria-selected={nav.bilanView === 'charges'} className={nav.bilanView === 'charges' ? 'on' : ''} onClick={() => nav.setBilanView('charges')}>
          {L('Charges fixes', 'Fixed bills')}
        </button>
      </div>
      {nav.bilanView === 'bilan' ? <BilanView {...props} /> : <Charges {...props} />}
    </div>
  );
}

function BilanView({ data, nav }: ScreenProps) {
  const { settings, txs } = data;
  const [n, setN] = useState(1);
  const b = bilan(settings, txs, nav.month, n, nav.today);
  const start = addMonths(nav.month, -(n - 1));
  const tm = typicalMonth(settings, nav.month);
  const noIncome = b.income === 0;
  const donutParts = b.byEnvelope.filter((e) => e.spent > 0).sort((a, z) => z.spent - a.spent);
  const scope = n === 1 ? (nav.month === monthOf(nav.today) ? L('ce mois-ci', 'this month') : L('sur le mois', 'over the month')) : L(`sur ${n === 12 ? '1 an' : `${n} mois`}`, `over ${n === 12 ? '1 year' : `${n} months`}`);
  const pots = settings.pots.filter((p) => !p.archived);

  return (
    <>
      <div className="chips" role="group" aria-label={L('Période', 'Period')}>
        {PERIODS().map((p) => (
          <button key={p.n} className={`chip${n === p.n ? ' on' : ''}`} onClick={() => setN(p.n)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: '6px 2px 14px' }}>
        {L(`Bilan ${n === 1 ? 'de ' : ''}`, 'Report for ')}
        <b style={{ color: 'var(--text)' }}>{periodLabel(start, nav.month)}</b>
      </p>

      <section className={`savecard${!noIncome && b.toSave < 0 ? ' neg' : ''}`}>
        <Ico icon={!noIncome && b.toSave < 0 ? '⚠️' : '🌱'} color="transparent" size={56} />
        <div className="grow">
          {noIncome ? (
            <>
              <div className="v">—</div>
              <p>{L('Indiquez vos revenus dans les réglages pour voir ce que vous pouvez mettre de côté.', 'Enter your income in the settings to see what you can put aside.')}</p>
            </>
          ) : (
            <>
              <div className="v num">{euros(b.toSave)}</div>
              <p>
                {n === 1
                  ? b.toSave >= 0
                    ? L('à mettre de côté ce mois-ci si on tient les enveloppes', 'to put aside this month if we stick to the envelopes')
                    : L('manquent ce mois-ci : le budget dépasse les revenus', 'short this month: the budget is higher than our income')
                  : b.toSave >= 0
                    ? L(`restait pour épargner sur ces ${n} mois`, `was left to save over these ${n} months`)
                    : L(`de trop dépensé sur ces ${n} mois`, `overspent over these ${n} months`)}
                <br />
                {L('versé en épargne : ', 'put into savings: ')}<b className="num">{euros(b.savedIn)}</b>
                {b.savedOut > 0 && <span className="num"> ({L('retiré : ', 'withdrawn: ')}{euros(b.savedOut)})</span>}
              </p>
            </>
          )}
        </div>
      </section>

      {n > 1 && (
        <>
          <div className="section-head">
            <h2>{L('Mois par mois', 'Month by month')}</h2>
            <span className="aside">{L('dépenses du quotidien', 'everyday spending')}</span>
          </div>
          <div className="card">
            <MonthBars bars={b.bars} />
            <div className="kv" style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span>{L('Moyenne par mois', 'Monthly average')}</span>
              <span className="val num">{b.average == null ? '—' : euros(b.average)}</span>
            </div>
            <div className="kv">
              <span className="muted small">{b.average == null ? L('calculée sur les mois terminés, quand il y en aura', 'based on completed months, once there are some') : L('sur les mois terminés qui ont des opérations', 'over completed months with transactions')}</span>
              <span className={`badge ${b.overCount ? 'warn' : 'ok'}`} style={{ marginLeft: 'auto' }}>
                {b.overCount ? L(`${b.overCount} mois au-dessus`, `${b.overCount} ${b.overCount > 1 ? 'months' : 'month'} over`) : L('jamais dépassé', 'never over')}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="section-head">
        <h2>{L('Notre épargne', 'Our savings')}</h2>
        <button className="link" onClick={() => nav.go('epargne')}>
          {L('Voir →', 'See →')}
        </button>
      </div>
      <div className="card">
        <div className="kv head">
          <span>{L("Total épargné aujourd'hui", 'Total saved today')}</span>
          <span className="val num">{euros(savingsTotal(settings, txs))}</span>
        </div>
        <div className="kv">
          <i className="dot" style={{ background: 'var(--ok)' }} />
          <span>{L('Versé', 'Deposited')} {scope}</span>
          <span className="val num" style={{ color: 'var(--income)' }}>
            {euros(b.savedIn, { sign: true })}
          </span>
        </div>
        <div className="kv">
          <i className="dot" style={{ background: 'var(--over)' }} />
          <span>{L('Retiré', 'Withdrawn')} {scope}</span>
          <span className="val num">{b.savedOut ? `−${euros(b.savedOut)}` : euros(0)}</span>
        </div>
        {pots.map((p) => (
          <div className="kv" key={p.id}>
            <span aria-hidden="true" style={{ width: 12, textAlign: 'center' }}>
              {p.icon}
            </span>
            <span className="ellipsis">{p.name}</span>
            <span className="val num">{euros(potBalance(p, txs))}</span>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>{L("Où part l'argent", 'Where the money goes')}</h2>
        <span className="aside">{scope}</span>
      </div>
      {donutParts.length === 0 ? (
        <Empty emoji="🍩">{L('Aucune dépense sur cette période.', 'No spending over this period.')}</Empty>
      ) : (
        <div className="card row" style={{ alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Donut parts={donutParts.map((e) => ({ id: e.env.id, value: e.spent, color: e.env.color, label: e.env.name }))} total={b.spent} size={150} />
          <div className="grow" style={{ minWidth: 160 }}>
            {donutParts.map((e) => (
              <div className="kv" key={e.env.id} style={{ padding: '5px 0', fontSize: 14.5 }}>
                <i className="dot" style={{ background: e.env.color }} />
                <span className="ellipsis">
                  {e.env.icon} {e.env.name}
                </span>
                <span className="val num">{euros(e.spent)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-head">
        <h2>{L('Notre mois type', 'Our typical month')}</h2>
        <span className="aside">{L('prévu', 'planned')}</span>
      </div>
      <div className="card">
        <TypicalBar {...tm} />
        <div className="kv head">
          <span>{L('Revenus', 'Income')}</span>
          <span className="val num">{euros(tm.income)}</span>
        </div>
        <div className="kv">
          <i className="dot" style={{ background: '#8C93A3' }} />
          <span>{L('Charges fixes', 'Fixed bills')}</span>
          <span className="val num">{euros(tm.charges)}</span>
        </div>
        <div className="kv">
          <i className="dot" style={{ background: 'var(--bar-under)' }} />
          <span>{L('Enveloppes du quotidien', 'Everyday envelopes')}</span>
          <span className="val num">{euros(tm.envelopes)}</span>
        </div>
        {tm.missing > 0 ? (
          <div className="kv">
            <i className="dot" style={{ background: 'var(--over)' }} />
            <span>{L('Il manque', 'Shortfall')}</span>
            <span className="val num" style={{ color: 'var(--over)' }}>
              {euros(tm.missing)}
            </span>
          </div>
        ) : (
          <div className="kv">
            <i className="dot" style={{ background: 'var(--gold)' }} />
            <span>{L('Épargne prévue', 'Planned savings')}</span>
            <span className="val num">{euros(tm.saving)}</span>
          </div>
        )}
      </div>

      <div className="section-head">
        <h2>{L('Prévu ou dépensé', 'Planned vs spent')}</h2>
        <span className="aside">{scope}</span>
      </div>
      <div className="card">
        {b.byEnvelope.length === 0 && <div className="muted">{L('Aucune enveloppe.', 'No envelopes.')}</div>}
        {b.byEnvelope.map((e) => {
          const over = e.spent > e.planned;
          const w = e.planned > 0 ? Math.min(e.spent / e.planned, 1) : e.spent > 0 ? 1 : 0;
          return (
            <div className="envbar" key={e.env.id}>
              <div className="top">
                <span className="ellipsis">
                  {e.env.icon} {e.env.name}
                </span>
                <span className={`r num${over ? ' over' : ''}`}>
                  {euros(e.spent)} / {euros(e.planned)}
                </span>
              </div>
              <div className="bar">
                <b className="grow-x" style={{ width: `${w * 100}%`, background: over ? 'var(--over)' : e.env.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <h2>{L('Qui a dépensé quoi', 'Who spent what')}</h2>
        <span className="aside">{scope}</span>
      </div>
      <div className="who">
        {([1, 2] as Person[]).map((p) => (
          <div className="card" key={p}>
            <Avatar person={p} names={settings.names} size={48} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="muted small ellipsis">{settings.names[p - 1]}</div>
              <div className="v num">{euros(b.byPerson[p])}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TypicalBar({ income, charges, envelopes, saving, missing }: ReturnType<typeof typicalMonth>) {
  const base = Math.max(income, charges + envelopes, 1);
  const parts = [
    { v: charges, c: '#8C93A3' },
    { v: envelopes, c: 'var(--bar-under)' },
    { v: missing > 0 ? missing : saving, c: missing > 0 ? 'var(--over)' : 'var(--gold)' },
  ].filter((p) => p.v > 0);
  const tot = missing > 0 ? charges + envelopes + missing : base;
  return (
    <div className="stack" role="img" aria-label={L('Répartition des revenus', 'Income breakdown')}>
      {parts.map((p, i) => (
        <span key={i} className="grow-x" style={{ width: `${(p.v / tot) * 100}%`, background: p.c }} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Charges({ data, nav }: ScreenProps) {
  const { settings } = data;
  const { lines, total, incomeShare } = chargeLines(settings, nav.month, nav.today);
  const next = nextCharge(settings, nav.today);
  const bySize = [...lines].sort((a, b) => b.amount - a.amount);
  return (
    <>
      <div className="card">
        <div className="muted">{L('Nos charges fixes', 'Our fixed bills')}</div>
        <div className="t num" style={{ fontWeight: 800, fontSize: 46, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '4px 0 14px' }}>
          {euros(total)}
          <span className="muted" style={{ fontSize: 18, fontWeight: 700 }}>
            {' '}
            {L('/ mois', '/ month')}
          </span>
        </div>
        {bySize.length > 0 && (
          <div className="stack" role="img" aria-label={L('Répartition des charges fixes', 'Fixed bills breakdown')}>
            {bySize.map((l) => (
              <span key={l.charge.id} className="grow-x" style={{ width: `${l.share * 100}%`, background: l.charge.color }} title={l.charge.name} />
            ))}
          </div>
        )}
        <div className="muted" style={{ lineHeight: 1.45 }}>
          {incomeShare == null ? (
            L('Indiquez vos revenus dans les réglages pour voir la part qu’elles représentent.', 'Enter your income in the settings to see what share they take.')
          ) : (
            <>
              {L('soit', "that's")} <b style={{ color: 'var(--text)' }}>{pct(incomeShare * 100)}</b> {L('de nos revenus', 'of our income')}
            </>
          )}
        </div>
      </div>

      {next && (
        <div className="card next">
          <Ico icon={next.charge.icon} color={next.charge.color} size={46} />
          <div className="grow">
            <div className="muted small">{L('Prochain prélèvement', 'Next payment')}</div>
            <div style={{ fontWeight: 700 }}>
              {next.charge.name} {next.inDays === 0 ? L("aujourd'hui", 'today') : next.inDays === 1 ? L('demain', 'tomorrow') : L(`dans ${next.inDays} jours`, `in ${next.inDays} days`)}
            </div>
          </div>
          <div className="t num" style={{ fontWeight: 800, fontSize: 19 }}>
            {euros(next.amount)}
          </div>
        </div>
      )}

      <div className="section-head">
        <h2>{L('Le détail', 'Details')}</h2>
        <span className="aside">
          {lines.length} {P(lines.length, 'prélèvement', 'payment')}
        </span>
      </div>
      {lines.length === 0 && <Empty emoji="🧾">{L("Aucune charge fixe pour l'instant : loyer, crédit, assurances, abonnements…", 'No fixed bills yet: rent, loans, insurance, subscriptions…')}</Empty>}
      {lines.map((l) => (
        <div className="card charge" key={l.charge.id} style={{ '--c': l.charge.color } as CSSProperties}>
          <Ico icon={l.charge.icon} color={l.charge.color} size={52} />
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 17 }} className="ellipsis">
              {l.charge.name}
            </div>
            <div className="row" style={{ gap: '4px 8px', marginTop: 4, flexWrap: 'wrap' }}>
              <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{l.effDay ? L(`le ${l.effDay === 1 ? '1er' : l.effDay} du mois`, `on the ${ordinal(l.effDay)}`) : L('date libre', 'no fixed date')}</span>
              {l.state.kind === 'done' && <span className="badge ok">✓ {L('Prélevé', 'Paid')}</span>}
              {l.state.kind === 'soon' && <span className="badge warn">{l.state.days === 0 ? L("Aujourd'hui", 'Today') : L(`Dans ${l.state.days} j`, `In ${l.state.days} d`)}</span>}
              {l.state.kind === 'later' && <span className="badge neutral">{L('À venir', 'Upcoming')}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="t num" style={{ fontWeight: 800, fontSize: 21 }}>
              {euros(l.amount)}
            </div>
            <div className="muted small num">{pct(l.share * 100)} {L('des charges', 'of bills')}</div>
          </div>
        </div>
      ))}
      <button className="dashed" onClick={nav.openSettings}>
        {L('Modifier les charges fixes', 'Edit fixed bills')}
      </button>
    </>
  );
}
