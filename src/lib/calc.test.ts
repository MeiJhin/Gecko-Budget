import { describe, expect, it } from 'vitest';
import { bilan, chargeLines, monthClock, monthSummary, nextCharge, potBalance, savingsSeries, savingsTotal, statusOf, typicalMonth, versionFor } from './calc';
import { defaultSettings, guessIcon } from './defaults';
import { euros, parseEuros, periodLabel, centsToInput, dayLabel } from './format';
import type { Settings, Tx } from './types';

const TODAY = '2026-11-20';
let n = 0;
const tx = (p: Partial<Tx> & Pick<Tx, 'kind' | 'amount' | 'category' | 'date'>): Tx => ({
  id: `t${++n}`,
  person: 1,
  note: '',
  created_at: '',
  updated_at: '',
  ...p,
});

/** Le budget des captures d'écran */
function screenshotSettings(): Settings {
  const s = defaultSettings();
  s.envelopes.push({ id: 'env-voiture', name: 'Voiture', icon: '🚗', color: '#7DD3AE' });
  s.charges = [{ id: 'ch-loyer', name: 'Loyer', icon: '🏠', color: '#8AB4F8', iconAuto: true, day: null }];
  s.versions = {
    '2026-11': {
      income: 0,
      charges: { 'ch-loyer': 95000 },
      envelopes: { 'env-1': 20000, 'env-2': 20000, 'env-3': 20000, 'env-4': 95000, 'env-5': 5000, 'env-6': 15000, 'env-7': 9000, 'env-8': 0, 'env-voiture': 35000 },
    },
  };
  return s;
}

describe('format', () => {
  it('formate les euros à la française', () => {
    expect(euros(123450, { decimals: true })).toBe('1 234,50 €');
    expect(euros(111170)).toBe('1 112 €');
    expect(euros(-95000, { decimals: true })).toBe('−950,00 €');
    expect(euros(25000, { sign: true })).toBe('+250 €');
    expect(euros(0)).toBe('0 €');
  });
  it('lit les montants saisis', () => {
    expect(parseEuros('1 234,5')).toBe(123450);
    expect(parseEuros('12.34')).toBe(1234);
    expect(parseEuros('')).toBeNull();
    expect(parseEuros('abc')).toBeNull();
    expect(centsToInput(12830)).toBe('128,3');
    expect(centsToInput(95000)).toBe('950');
  });
  it('libellés de période et de jour', () => {
    expect(periodLabel('2026-06', '2026-11')).toBe('de juin à novembre 2026');
    expect(periodLabel('2025-12', '2026-05')).toBe('de décembre 2025 à mai 2026');
    expect(periodLabel('2026-04', '2026-11')).toBe("d'avril à novembre 2026");
    expect(periodLabel('2026-11', '2026-11')).toBe('Novembre 2026');
    expect(dayLabel('2026-11-18', TODAY)).toBe('mercredi 18 novembre');
    expect(dayLabel('2026-11-19', TODAY)).toBe('Hier');
  });
});

describe('le mois en cours (Suivi)', () => {
  const s = screenshotSettings();
  const txs = [
    tx({ kind: 'expense', amount: 95000, category: 'env-4', date: '2026-11-20' }),
    tx({ kind: 'expense', amount: 12830, category: 'env-1', date: '2026-11-18' }),
  ];
  const m = monthSummary(s, txs, '2026-11', TODAY);

  it('reste à dépenser = enveloppes − dépensé', () => {
    expect(m.budget).toBe(219000);
    expect(m.spent).toBe(107830);
    expect(m.left).toBe(111170);
    expect(euros(m.left)).toBe('1 112 €');
  });
  it('par jour sur les jours restants (aujourd’hui compris)', () => {
    expect(m.clock.remainingDays).toBe(11);
    expect(euros(m.perDay)).toBe('101 €');
    expect(euros(m.dailyBudget)).toBe('73 €');
  });
  it('% dépensé, rythme et statut global', () => {
    expect(Math.round(m.ratio * 100)).toBe(49);
    expect(m.clock.pace).toBeCloseTo(20 / 30);
    expect(m.status).toBe('ok');
  });
  it('statut des enveloppes', () => {
    const by = Object.fromEntries(m.lines.map((l) => [l.env.name, l]));
    expect(by['Courses'].status).toBe('ok');
    expect(by['Courses'].left).toBe(7170);
    expect(by['Maison'].status).toBe('warn'); // 100 % dépensé alors qu'on est à 67 % du mois
    expect(by['Divers'].status).toBe('none'); // pas de budget, rien dépensé
    expect(m.lines.map((l) => l.env.name)).toContain('Voiture');
  });
  it('dépenses par jour', () => {
    expect(m.daily[19]).toBe(95000);
    expect(m.daily[17]).toBe(12830);
    expect(m.daily.length).toBe(30);
  });
});

describe('couleurs selon le rythme', () => {
  it('vert / orange / rouge', () => {
    expect(statusOf(5000, 10000, 0.5)).toBe('ok'); // 50 % au milieu du mois
    expect(statusOf(6000, 10000, 0.5)).toBe('ok'); // +10 points pile : encore ok
    expect(statusOf(6100, 10000, 0.5)).toBe('warn'); // +11 points
    expect(statusOf(10001, 10000, 0.9)).toBe('over');
    expect(statusOf(100, 0, 0.5)).toBe('over'); // dépense dans une enveloppe sans budget
  });
  it('mois passés, futurs', () => {
    expect(monthClock('2026-10', TODAY)).toMatchObject({ day: 31, remainingDays: 0, pace: 1, when: 'past' });
    expect(monthClock('2026-12', TODAY)).toMatchObject({ day: 0, remainingDays: 31, pace: 0, when: 'future' });
    expect(monthClock('2026-02', '2026-02-28')).toMatchObject({ days: 28, remainingDays: 1, pace: 1 });
  });
  it('dépassement global', () => {
    const s = screenshotSettings();
    const txs = [tx({ kind: 'expense', amount: 300000, category: 'env-1', date: '2026-11-02' })];
    const m = monthSummary(s, txs, '2026-11', TODAY);
    expect(m.status).toBe('over');
    expect(m.left).toBe(-81000);
    expect(m.perDay).toBe(0);
  });
  it('les rentrées ne rechargent pas les enveloppes', () => {
    const s = screenshotSettings();
    const txs = [tx({ kind: 'income', amount: 40000, category: 'vente', date: '2026-11-05' })];
    const m = monthSummary(s, txs, '2026-11', TODAY);
    expect(m.incomes).toBe(40000);
    expect(m.left).toBe(219000);
  });
});

describe('versions du budget', () => {
  it('un budget reste le même tant qu’on ne le change pas', () => {
    const s = screenshotSettings();
    s.versions['2027-01'] = { ...s.versions['2026-11'], income: 400000 };
    expect(versionFor(s, '2026-05').income).toBe(0); // avant : la plus ancienne
    expect(versionFor(s, '2026-12').income).toBe(0);
    expect(versionFor(s, '2027-01').income).toBe(400000);
    expect(versionFor(s, '2027-08').income).toBe(400000);
  });
});

describe('épargne', () => {
  const s = screenshotSettings();
  s.pots = [
    { id: 'p1', name: 'Livret A', icon: '🐷', color: '#FDD46B', goal: 500000, initial: 100000 },
    { id: 'p2', name: 'Vacances', icon: '🏖️', color: '#7DD6E8', goal: null, initial: 0 },
  ];
  const txs = [
    tx({ kind: 'saving', amount: 25000, category: 'p1', date: '2026-09-03' }),
    tx({ kind: 'saving', amount: 25000, category: 'p1', date: '2026-11-03' }),
    tx({ kind: 'saving', amount: -10000, category: 'p1', date: '2026-11-10', note: 'Réparation' }),
    tx({ kind: 'saving', amount: 30000, category: 'p2', date: '2026-10-01' }),
  ];
  it('solde = Déjà + versements − retraits', () => {
    expect(potBalance(s.pots[0], txs)).toBe(140000);
    expect(potBalance(s.pots[1], txs)).toBe(30000);
    expect(savingsTotal(s, txs)).toBe(170000);
    expect(savingsTotal(s, txs, '2026-10-31')).toBe(155000);
  });
  it('courbe sur 6 mois', () => {
    const serie = savingsSeries(s, txs, '2026-11');
    expect(serie.map((p) => p.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(serie.map((p) => p.total)).toEqual([100000, 100000, 100000, 125000, 155000, 170000]);
  });
  it('une cagnotte supprimée sort du total', () => {
    const s2 = { ...s, pots: [s.pots[0], { ...s.pots[1], archived: true }] };
    expect(savingsTotal(s2, txs)).toBe(140000);
  });
});

describe('bilan', () => {
  const s = screenshotSettings();
  s.versions['2026-11'].income = 380000;
  const txs = [
    tx({ kind: 'expense', amount: 200000, category: 'env-1', date: '2026-09-10' }),
    tx({ kind: 'expense', amount: 250000, category: 'env-4', date: '2026-10-10', person: 2 }),
    tx({ kind: 'expense', amount: 107830, category: 'env-1', date: '2026-11-18' }),
    tx({ kind: 'income', amount: 15000, category: 'vente', date: '2026-10-12' }),
    tx({ kind: 'saving', amount: 25000, category: 'pot-1', date: '2026-11-03' }),
    tx({ kind: 'saving', amount: -5000, category: 'pot-1', date: '2026-11-04', note: 'x' }),
  ];
  it('1 mois : revenus + rentrées − charges − enveloppes', () => {
    const b = bilan(s, txs, '2026-11', 1, TODAY);
    expect(b.toSave).toBe(380000 - 95000 - 219000); // 660 €
    expect(b.savedIn).toBe(25000);
    expect(b.savedOut).toBe(5000);
  });
  it('3 mois : N × revenus + rentrées − N × charges − dépenses réelles', () => {
    const b = bilan(s, txs, '2026-11', 3, TODAY);
    expect(b.months).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(b.toSave).toBe(3 * 380000 + 15000 - 3 * 95000 - (200000 + 250000 + 107830));
    expect(b.spent).toBe(557830);
  });
  it('mois par mois : moyenne sur les mois complets avec données, mois au-dessus', () => {
    const b = bilan(s, txs, '2026-11', 6, TODAY);
    expect(b.average).toBe(Math.round((200000 + 250000 + 15000 * 0) / 2)); // sept. et oct.
    expect(b.overCount).toBe(1); // octobre : 2 500 € > 2 190 €
    expect(b.bars.find((x) => x.month === '2026-11')!.current).toBe(true);
  });
  it('prévu × nombre de mois, et qui a dépensé quoi', () => {
    const b = bilan(s, txs, '2026-11', 3, TODAY);
    const courses = b.byEnvelope.find((e) => e.env.id === 'env-1')!;
    expect(courses.planned).toBe(3 * 20000);
    expect(courses.spent).toBe(307830);
    expect(b.byPerson).toEqual({ 1: 307830, 2: 250000 });
  });
  it('mois type et « il manque »', () => {
    expect(typicalMonth(s, '2026-11')).toMatchObject({ saving: 66000, missing: 0 });
    const s2 = screenshotSettings();
    expect(typicalMonth(s2, '2026-11')).toMatchObject({ income: 0, saving: 0, missing: 314000 });
  });
});

describe('charges fixes', () => {
  const s = screenshotSettings();
  s.charges = [
    { id: 'a', name: 'Loyer', icon: '🏠', color: '#8AB4F8', iconAuto: true, day: 5 },
    { id: 'b', name: 'EDF', icon: '💡', color: '#FDD46B', iconAuto: true, day: 22 },
    { id: 'c', name: 'Box', icon: '🌐', color: '#7DD6E8', iconAuto: true, day: 31 },
    { id: 'd', name: 'Mutuelle', icon: '🩺', color: '#C9A7F9', iconAuto: true, day: null },
  ];
  s.versions['2026-11'] = { ...s.versions['2026-11'], income: 400000, charges: { a: 95000, b: 8000, c: 3000, d: 4000 } };
  it('états de prélèvement', () => {
    const { lines, total, incomeShare } = chargeLines(s, '2026-11', TODAY);
    expect(total).toBe(110000);
    expect(incomeShare).toBeCloseTo(0.275);
    expect(lines.map((l) => [l.charge.name, l.state.kind])).toEqual([
      ['Loyer', 'done'],
      ['EDF', 'soon'],
      ['Box', 'later'],
      ['Mutuelle', 'free'],
    ]);
    expect(lines[1].state).toEqual({ kind: 'soon', days: 2 });
    expect(lines[2].effDay).toBe(30); // le 31 → le 30 en novembre
  });
  it('prochain prélèvement', () => {
    expect(nextCharge(s, TODAY)).toMatchObject({ charge: { name: 'EDF' }, inDays: 2 });
    expect(nextCharge(s, '2026-11-30')).toMatchObject({ charge: { name: 'Box' }, inDays: 0 });
    expect(nextCharge({ ...s, charges: s.charges.filter((c) => c.id === 'a') }, TODAY)).toMatchObject({ inDays: 15 });
  });
});

describe('icônes devinées', () => {
  it.each([
    ['Loyer', '🏠'], ['Crédit auto', '🏦'], ['Assurance habitation', '🛡️'], ['EDF', '💡'], ['Électricité', '💡'],
    ['Gaz', '🔥'], ['Eau', '💧'], ['Box internet', '🌐'], ['Forfait Sosh', '📱'], ['Netflix', '📺'],
    ['Spotify', '🎧'], ['Mutuelle', '🩺'], ['Impôts', '🏛️'], ['Crèche', '👶'],
  ])('%s → %s', (name, icon) => expect(guessIcon(name)).toBe(icon));
  it('rien deviné', () => expect(guessIcon('Truc')).toBeNull());
});
