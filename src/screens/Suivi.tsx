import type { CSSProperties } from 'react';
import { monthSummary, type Status } from '../lib/calc';
import { euros, monthName, shortDate } from '../lib/format';
import { DailyBars, Ring } from '../components/charts';
import { Empty, Ico, STATUS_LABEL, TxGroups } from '../components/ui';
import type { ScreenProps } from '../App';
import { isDemo } from '../lib/supabase';
import { L, P } from '../lib/i18n';

const MOOD: Record<Status, { text: string; color: string }> = {
  ok: { get text() { return L('Dans les clous, bravo !', 'On track, well done!'); }, color: '#6EE7C5' },
  warn: { get text() { return L('On dépense un peu vite', 'Spending a bit fast'); }, color: '#FFB357' },
  over: { get text() { return L('Budget dépassé', 'Over budget'); }, color: '#FF6B6B' },
};

export default function Suivi({ data, nav }: ScreenProps) {
  const { settings, txs } = data;
  const m = monthSummary(settings, txs, nav.month, nav.today);
  const { clock } = m;
  const monthTxs = txs.filter((t) => t.date.startsWith(nav.month) && t.kind !== 'saving');
  const hasBudget = m.budget > 0;

  let kicker = L('Il nous reste ce mois-ci', 'Left to spend this month');
  if (clock.when === 'past') kicker = L(`Il nous est resté en ${monthName(nav.month)}`, `Left over in ${monthName(nav.month)}`);
  if (clock.when === 'future') kicker = L(`Budget de ${monthName(nav.month)}`, `${monthName(nav.month)} budget`);

  return (
    <div className="fade-in">
      {!settings.onboarded && (
        <div className="welcome">
          <h3>{L('Bienvenue sur Gecko Budget 🦎', 'Welcome to Gecko Budget 🦎')}</h3>
          <p>
            {L(
              "Pour commencer, indiquez vos prénoms, vos revenus, vos charges fixes et ce que vous vous autorisez à dépenser chaque mois dans chaque enveloppe. Ça prend 3 minutes, et c'est modifiable à tout moment.",
              'To get started, enter your names, your income, your fixed bills and how much you allow yourselves to spend each month in each envelope. It takes 3 minutes and you can change it at any time.',
            )}
          </p>
          <button className="btn" onClick={nav.openSettings}>
            {L('Remplir nos réglages', 'Fill in our settings')}
          </button>
          {isDemo && (
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={nav.loadDemo}>
              {L('Essayer avec des exemples', 'Try with sample data')}
            </button>
          )}
        </div>
      )}

      <section className="hero" aria-label={L("Le mois en un coup d'œil", 'The month at a glance')}>
        <div className="hero-top">
          <div className="grow" style={{ position: 'relative', zIndex: 1 }}>
            <div className="kicker">{kicker}</div>
            <div className={`big num${m.left < 0 ? ' neg' : ''}`}>{euros(clock.when === 'future' ? m.budget : m.left)}</div>
            <div className="perday">
              {clock.when === 'current' && m.left > 0 && (
                <>
                  {L('Soit', "That's")} <b>{euros(m.perDay)} {L('par jour', 'a day')}</b>
                  <br />
                  {L('pendant', 'for')} {clock.remainingDays} {P(clock.remainingDays, 'jour', 'day')}
                </>
              )}
              {clock.when === 'current' && m.left <= 0 && hasBudget && <>{L('On a dépassé de', "We're over by")} {euros(-m.left)}</>}
              {clock.when === 'past' && <>{L(`sur ${euros(m.budget)} prévus`, `out of ${euros(m.budget)} planned`)}</>}
              {clock.when === 'future' && hasBudget && (
                <>
                  {L('Soit', "That's")} <b>{euros(m.dailyBudget)} {L('par jour', 'a day')}</b>
                </>
              )}
              {!hasBudget && <>{L('Fixez vos enveloppes dans les réglages', 'Set your envelopes in the settings')}</>}
            </div>
          </div>
          <Ring ratio={m.ratio} pace={clock.pace} status={m.status} showPace={clock.when === 'current'} />
        </div>
        <div className="hero-bottom">
          <span className="mood" style={{ '--dot': MOOD[m.status].color } as CSSProperties}>
            <i />
            {MOOD[m.status].text}
          </span>
          {clock.when === 'current' && (
            <span className="dayof">
              {L(`Jour ${clock.day} sur ${clock.days}`, `Day ${clock.day} of ${clock.days}`)}
            </span>
          )}
        </div>
      </section>

      {m.incomes > 0 && (
        <button className="banner-income" onClick={() => nav.go('depenses', { kind: 'income' })}>
          <span aria-hidden="true">💰</span>
          <span className="num">{L(`+${euros(m.incomes)} de rentrées ce mois-ci`, `+${euros(m.incomes)} extra income this month`)}</span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      <div className="section-head">
        <h2>{L('Le rythme du mois', 'Pace of the month')}</h2>
        {m.dailyBudget > 0 && <span className="aside num">≈ {euros(m.dailyBudget)} {L('par jour prévu', 'a day planned')}</span>}
      </div>
      <div className="card">
        <DailyBars daily={m.daily} dailyBudget={m.dailyBudget} today={clock.when === 'current' ? clock.day : 0} label={(d) => shortDate(`${nav.month}-${String(d).padStart(2, '0')}`)} />
      </div>

      <div className="section-head">
        <h2>{L('Nos enveloppes', 'Our envelopes')}</h2>
        {clock.when === 'current' && <span className="aside">{L('le trait = où on devrait en être', 'the line = where we should be')}</span>}
      </div>
      {m.lines.length === 0 ? (
        <Empty emoji="✉️">{L("Aucune enveloppe pour l'instant : créez-les dans les réglages.", 'No envelopes yet: create them in the settings.')}</Empty>
      ) : (
        <div className="tiles">
          {m.lines.map((l) => {
            const w = Math.min(l.ratio, 1) * 100;
            return (
              <button
                key={l.env.id}
                className={`tile${l.status === 'over' ? ' over' : ''}`}
                style={{ '--c': l.env.color } as CSSProperties}
                onClick={() => nav.go('depenses', { cat: l.env.id })}
                aria-label={`${l.env.name} : ${l.left >= 0 ? L(`${euros(l.left)} restants`, `${euros(l.left)} left`) : L(`dépassé de ${euros(-l.left)}`, `over by ${euros(-l.left)}`)}`}
              >
                <div className="tile-head">
                  <Ico icon={l.env.icon} color={l.env.color} size={46} />
                  {l.status !== 'none' && <span className={`badge ${l.status}`}>{STATUS_LABEL()[l.status]}</span>}
                </div>
                <div className="name">{l.env.name}</div>
                <div className={`left num${l.left < 0 ? ' neg' : ''}`}>{l.left < 0 ? `−${euros(-l.left)}` : euros(l.left)}</div>
                <div className="sub num">
                  {l.left < 0 ? L('de dépassement', 'over') : L('restants', 'left')} · {euros(l.spent)} / {euros(l.budget)}
                </div>
                <div className="progress">
                  <b className="grow-x" style={{ width: `${w}%`, background: l.status === 'over' ? 'var(--over)' : undefined }} />
                  {clock.when === 'current' && <i style={{ left: `${clock.pace * 100}%` }} />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="section-head">
        <h2>{L('Dernières opérations', 'Latest transactions')}</h2>
        {monthTxs.length > 0 && (
          <button className="link" onClick={() => nav.go('depenses', {})}>
            {L('Tout voir →', 'See all →')}
          </button>
        )}
      </div>
      {monthTxs.length === 0 ? (
        <Empty emoji="📝">
          {L('Rien de noté ce mois-ci.', 'Nothing recorded this month.')}
          <br />
          {L('Touchez le bouton', 'Tap the')} <b>+</b> {L('pour ajouter une dépense.', 'button to add an expense.')}
        </Empty>
      ) : (
        <TxGroups txs={monthTxs.slice(0, 5)} settings={settings} onOpen={nav.openEdit} today={nav.today} />
      )}
    </div>
  );
}
