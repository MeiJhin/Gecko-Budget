import type { CSSProperties } from 'react';
import { monthSummary, type Status } from '../lib/calc';
import { euros, monthName, shortDate } from '../lib/format';
import { DailyBars, Ring } from '../components/charts';
import { Empty, Ico, STATUS_LABEL, TxGroups } from '../components/ui';
import type { ScreenProps } from '../App';
import { isDemo } from '../lib/supabase';

const MOOD: Record<Status, { text: string; color: string }> = {
  ok: { text: 'Dans les clous, bravo !', color: '#6EE7C5' },
  warn: { text: 'On dépense un peu vite', color: '#FFB357' },
  over: { text: 'Budget dépassé', color: '#FF6B6B' },
};

export default function Suivi({ data, nav }: ScreenProps) {
  const { settings, txs } = data;
  const m = monthSummary(settings, txs, nav.month, nav.today);
  const { clock } = m;
  const monthTxs = txs.filter((t) => t.date.startsWith(nav.month) && t.kind !== 'saving');
  const hasBudget = m.budget > 0;

  let kicker = 'Il nous reste ce mois-ci';
  if (clock.when === 'past') kicker = `Il nous est resté en ${monthName(nav.month)}`;
  if (clock.when === 'future') kicker = `Budget de ${monthName(nav.month)}`;

  return (
    <div className="fade-in">
      {!settings.onboarded && (
        <div className="welcome">
          <h3>Bienvenue sur Gecko Budget 🦎</h3>
          <p>
            Pour commencer, indiquez vos prénoms, vos revenus, vos charges fixes et ce que vous vous autorisez à dépenser chaque mois dans chaque
            enveloppe. Ça prend 3 minutes, et c'est modifiable à tout moment.
          </p>
          <button className="btn" onClick={nav.openSettings}>
            Remplir nos réglages
          </button>
          {isDemo && (
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={nav.loadDemo}>
              Essayer avec des exemples
            </button>
          )}
        </div>
      )}

      <section className="hero" aria-label="Le mois en un coup d'œil">
        <div className="hero-top">
          <div className="grow" style={{ position: 'relative', zIndex: 1 }}>
            <div className="kicker">{kicker}</div>
            <div className={`big num${m.left < 0 ? ' neg' : ''}`}>{euros(clock.when === 'future' ? m.budget : m.left)}</div>
            <div className="perday">
              {clock.when === 'current' && m.left > 0 && (
                <>
                  Soit <b>{euros(m.perDay)} par jour</b>
                  <br />
                  pendant {clock.remainingDays} jour{clock.remainingDays > 1 ? 's' : ''}
                </>
              )}
              {clock.when === 'current' && m.left <= 0 && hasBudget && <>On a dépassé de {euros(-m.left)}</>}
              {clock.when === 'past' && <>sur {euros(m.budget)} prévus</>}
              {clock.when === 'future' && hasBudget && (
                <>
                  Soit <b>{euros(m.dailyBudget)} par jour</b>
                </>
              )}
              {!hasBudget && <>Fixez vos enveloppes dans les réglages</>}
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
              Jour {clock.day} sur {clock.days}
            </span>
          )}
        </div>
      </section>

      {m.incomes > 0 && (
        <button className="banner-income" onClick={() => nav.go('depenses', { kind: 'income' })}>
          <span aria-hidden="true">💰</span>
          <span className="num">+{euros(m.incomes)} de rentrées ce mois-ci</span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      <div className="section-head">
        <h2>Le rythme du mois</h2>
        {m.dailyBudget > 0 && <span className="aside num">≈ {euros(m.dailyBudget)} par jour prévu</span>}
      </div>
      <div className="card">
        <DailyBars daily={m.daily} dailyBudget={m.dailyBudget} today={clock.when === 'current' ? clock.day : 0} label={(d) => shortDate(`${nav.month}-${String(d).padStart(2, '0')}`)} />
      </div>

      <div className="section-head">
        <h2>Nos enveloppes</h2>
        {clock.when === 'current' && <span className="aside">le trait = où on devrait en être</span>}
      </div>
      {m.lines.length === 0 ? (
        <Empty emoji="✉️">Aucune enveloppe pour l'instant : créez-les dans les réglages.</Empty>
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
                aria-label={`${l.env.name} : ${l.left >= 0 ? `${euros(l.left)} restants` : `dépassé de ${euros(-l.left)}`}`}
              >
                <div className="tile-head">
                  <Ico icon={l.env.icon} color={l.env.color} size={46} />
                  {l.status !== 'none' && <span className={`badge ${l.status}`}>{STATUS_LABEL[l.status]}</span>}
                </div>
                <div className="name">{l.env.name}</div>
                <div className={`left num${l.left < 0 ? ' neg' : ''}`}>{l.left < 0 ? `−${euros(-l.left)}` : euros(l.left)}</div>
                <div className="sub num">
                  {l.left < 0 ? 'de dépassement' : 'restants'} · {euros(l.spent)} / {euros(l.budget)}
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
        <h2>Dernières opérations</h2>
        {monthTxs.length > 0 && (
          <button className="link" onClick={() => nav.go('depenses', {})}>
            Tout voir →
          </button>
        )}
      </div>
      {monthTxs.length === 0 ? (
        <Empty emoji="📝">
          Rien de noté ce mois-ci.
          <br />
          Touchez le bouton <b>+</b> pour ajouter une dépense.
        </Empty>
      ) : (
        <TxGroups txs={monthTxs.slice(0, 5)} settings={settings} onOpen={nav.openEdit} today={nav.today} />
      )}
    </div>
  );
}
