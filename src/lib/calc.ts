import type { BudgetVersion, Cents, Charge, DateKey, Envelope, MonthKey, Person, Pot, Settings, Tx, Visual } from './types';
import { addMonths, daysInMonth, monthOf, parseMonth } from './format';
import { INCOME_TYPES } from './defaults';

/* ------------------------------------------------------------------ */
/*  Versions du budget                                                 */
/* ------------------------------------------------------------------ */

const EMPTY_VERSION: BudgetVersion = { income: 0, charges: {}, envelopes: {} };

/** Montants en vigueur pour un mois : la dernière version qui commence au plus tard ce mois-là
 *  (ou la plus ancienne si le mois est antérieur à toutes les versions). */
export function versionFor(s: Settings, month: MonthKey): BudgetVersion {
  const keys = Object.keys(s.versions).sort();
  if (keys.length === 0) return EMPTY_VERSION;
  let pick = keys[0];
  for (const k of keys) if (k <= month) pick = k;
  return s.versions[pick];
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const incomeFor = (s: Settings, m: MonthKey) => versionFor(s, m).income;
export const chargesTotalFor = (s: Settings, m: MonthKey) => sum(Object.values(versionFor(s, m).charges));
export const envelopesTotalFor = (s: Settings, m: MonthKey) => sum(Object.values(versionFor(s, m).envelopes));

/* ------------------------------------------------------------------ */
/*  Filtres d'opérations                                               */
/* ------------------------------------------------------------------ */

export const inMonth = (txs: Tx[], m: MonthKey) => txs.filter((t) => monthOf(t.date) === m);
export const inMonths = (txs: Tx[], months: MonthKey[]) => {
  const set = new Set(months);
  return txs.filter((t) => set.has(monthOf(t.date)));
};
export const expenses = (txs: Tx[]) => txs.filter((t) => t.kind === 'expense');
export const incomes = (txs: Tx[]) => txs.filter((t) => t.kind === 'income');
export const savings = (txs: Tx[]) => txs.filter((t) => t.kind === 'saving');
export const total = (txs: Tx[]) => sum(txs.map((t) => t.amount));

/* ------------------------------------------------------------------ */
/*  Le mois : rythme, reste à dépenser, par jour                      */
/* ------------------------------------------------------------------ */

export type Status = 'ok' | 'warn' | 'over';

export interface MonthClock {
  /** nombre de jours du mois */
  days: number;
  /** jour « actuel » : jour du mois (en cours), days (passé), 0 (futur) */
  day: number;
  /** jours restants en comptant aujourd'hui */
  remainingDays: number;
  /** où on devrait en être : 0 → 1 */
  pace: number;
  when: 'past' | 'current' | 'future';
}

export function monthClock(month: MonthKey, today: DateKey): MonthClock {
  const days = daysInMonth(month);
  const tm = monthOf(today);
  if (month < tm) return { days, day: days, remainingDays: 0, pace: 1, when: 'past' };
  if (month > tm) return { days, day: 0, remainingDays: days, pace: 0, when: 'future' };
  const day = Number(today.slice(8, 10));
  return { days, day, remainingDays: days - day + 1, pace: day / days, when: 'current' };
}

/** Règle commune aux enveloppes et au total :
 *  dépassé si on a dépensé plus que le budget ;
 *  attention si le % dépensé dépasse le rythme du mois de plus de 10 points. */
export function statusOf(spent: Cents, budget: Cents, pace: number): Status {
  if (spent > budget) return 'over';
  if (budget <= 0) return 'ok';
  const pctSpent = (spent / budget) * 100;
  if (pctSpent - pace * 100 > 10) return 'warn';
  return 'ok';
}

export interface EnvelopeLine {
  env: Envelope;
  budget: Cents;
  spent: Cents;
  left: Cents;
  status: Status | 'none';
  ratio: number;
}

const UNKNOWN = (id: string): Envelope => ({ id, name: 'Enveloppe supprimée', icon: '📦', color: '#BFC5D2', archived: true });

export function envelopeById(s: Settings, id: string): Envelope {
  return s.envelopes.find((e) => e.id === id) ?? UNKNOWN(id);
}

/** Enveloppes à afficher pour un mois : celles du budget de ce mois + celles où on a dépensé. */
export function envelopeLines(s: Settings, txs: Tx[], month: MonthKey, pace: number): EnvelopeLine[] {
  const v = versionFor(s, month);
  const exp = expenses(inMonth(txs, month));
  const spentBy = new Map<string, Cents>();
  for (const t of exp) spentBy.set(t.category, (spentBy.get(t.category) ?? 0) + t.amount);
  const ids = new Set<string>([...Object.keys(v.envelopes), ...spentBy.keys()]);
  const order = s.envelopes.map((e) => e.id);
  const sorted = [...ids].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
  });
  return sorted.map((id) => {
    const budget = v.envelopes[id] ?? 0;
    const spent = spentBy.get(id) ?? 0;
    const status: EnvelopeLine['status'] = budget === 0 && spent === 0 ? 'none' : statusOf(spent, budget, pace);
    return { env: envelopeById(s, id), budget, spent, left: budget - spent, status, ratio: budget > 0 ? spent / budget : spent > 0 ? 1 : 0 };
  });
}

export interface MonthSummary {
  clock: MonthClock;
  budget: Cents;
  spent: Cents;
  /** total des enveloppes − total dépensé */
  left: Cents;
  /** reste par jour sur les jours restants (0 si rien ne reste ou mois passé) */
  perDay: Cents;
  /** 0 → 1+ */
  ratio: number;
  status: Status;
  incomes: Cents;
  /** budget prévu par jour */
  dailyBudget: Cents;
  lines: EnvelopeLine[];
  /** dépenses par jour (index 0 = le 1er) */
  daily: Cents[];
}

export function monthSummary(s: Settings, txs: Tx[], month: MonthKey, today: DateKey): MonthSummary {
  const clock = monthClock(month, today);
  const budget = envelopesTotalFor(s, month);
  const mtx = inMonth(txs, month);
  const exp = expenses(mtx);
  const spent = total(exp);
  const left = budget - spent;
  const perDay = left > 0 && clock.remainingDays > 0 ? Math.floor(left / clock.remainingDays) : 0;
  const daily = new Array(clock.days).fill(0);
  for (const t of exp) daily[Number(t.date.slice(8, 10)) - 1] += t.amount;
  return {
    clock,
    budget,
    spent,
    left,
    perDay,
    ratio: budget > 0 ? spent / budget : spent > 0 ? 1 : 0,
    status: statusOf(spent, budget, clock.pace),
    incomes: total(incomes(mtx)),
    dailyBudget: Math.round(budget / clock.days),
    lines: envelopeLines(s, txs, month, clock.pace),
    daily,
  };
}

/* ------------------------------------------------------------------ */
/*  Épargne                                                            */
/* ------------------------------------------------------------------ */

/** Solde d'une cagnotte = « Déjà » + versements − retraits (jusqu'à une date incluse si fournie) */
export function potBalance(pot: Pot, txs: Tx[], upTo?: DateKey): Cents {
  return pot.initial + sum(savings(txs).filter((t) => t.category === pot.id && (!upTo || t.date <= upTo)).map((t) => t.amount));
}

export function savingsTotal(s: Settings, txs: Tx[], upTo?: DateKey): Cents {
  // une cagnotte supprimée (archivée) ne compte plus dans le total
  return sum(s.pots.filter((p) => !p.archived).map((p) => potBalance(p, txs, upTo)));
}

export function savingsFlow(txs: Tx[], months: MonthKey[]): { in: Cents; out: Cents } {
  const sv = savings(inMonths(txs, months));
  return { in: sum(sv.filter((t) => t.amount > 0).map((t) => t.amount)), out: -sum(sv.filter((t) => t.amount < 0).map((t) => t.amount)) };
}

export const monthEnd = (m: MonthKey): DateKey => `${m}-${String(daysInMonth(m)).padStart(2, '0')}`;

/** Total épargné à la fin de chacun des n derniers mois (le dernier = mois affiché) */
export function savingsSeries(s: Settings, txs: Tx[], end: MonthKey, n = 6): { month: MonthKey; total: Cents }[] {
  return monthsBack(end, n).map((m) => ({ month: m, total: savingsTotal(s, txs, monthEnd(m)) }));
}

/* ------------------------------------------------------------------ */
/*  Bilan                                                              */
/* ------------------------------------------------------------------ */

export function monthsBack(end: MonthKey, n: number): MonthKey[] {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - n + 1));
}

export interface MonthBar {
  month: MonthKey;
  spent: Cents;
  budget: Cents;
  current: boolean;
  future: boolean;
  over: boolean;
}

export interface Bilan {
  months: MonthKey[];
  n: number;
  income: Cents;
  extra: Cents;
  charges: Cents;
  envelopes: Cents;
  spent: Cents;
  /** 1 mois : revenus + rentrées − charges − enveloppes ; plusieurs : revenus + rentrées − charges − dépenses réelles */
  toSave: Cents;
  savedIn: Cents;
  savedOut: Cents;
  bars: MonthBar[];
  /** moyenne des dépenses sur les mois complets qui ont des données (null si aucun) */
  average: Cents | null;
  overCount: number;
  byEnvelope: { env: Envelope; spent: Cents; planned: Cents }[];
  byPerson: Record<Person, Cents>;
}

export function bilan(s: Settings, txs: Tx[], end: MonthKey, n: number, today: DateKey): Bilan {
  const months = monthsBack(end, n);
  const tm = monthOf(today);
  const ptx = inMonths(txs, months);
  const exp = expenses(ptx);
  const income = sum(months.map((m) => incomeFor(s, m)));
  const extra = total(incomes(ptx));
  const charges = sum(months.map((m) => chargesTotalFor(s, m)));
  const envelopes = sum(months.map((m) => envelopesTotalFor(s, m)));
  const spent = total(exp);
  const toSave = n === 1 ? income + extra - charges - envelopes : income + extra - charges - spent;
  const flow = savingsFlow(txs, months);

  const bars: MonthBar[] = months.map((m) => {
    const sp = total(expenses(inMonth(txs, m)));
    const b = envelopesTotalFor(s, m);
    return { month: m, spent: sp, budget: b, current: m === tm, future: m > tm, over: sp > b };
  });
  const complete = months.filter((m) => m < tm && inMonth(txs, m).length > 0);
  const average = complete.length ? Math.round(sum(complete.map((m) => bars.find((b) => b.month === m)!.spent)) / complete.length) : null;
  const overCount = bars.filter((b) => !b.future && b.over).length;

  const spentBy = new Map<string, Cents>();
  for (const t of exp) spentBy.set(t.category, (spentBy.get(t.category) ?? 0) + t.amount);
  const planned = new Map<string, Cents>();
  for (const m of months) for (const [id, v] of Object.entries(versionFor(s, m).envelopes)) planned.set(id, (planned.get(id) ?? 0) + v);
  const ids = new Set([...planned.keys(), ...spentBy.keys()]);
  const order = s.envelopes.map((e) => e.id);
  const byEnvelope = [...ids]
    .sort((a, b) => (order.indexOf(a) < 0 ? 1e9 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 1e9 : order.indexOf(b)))
    .map((id) => ({ env: envelopeById(s, id), spent: spentBy.get(id) ?? 0, planned: planned.get(id) ?? 0 }));

  const byPerson: Record<Person, Cents> = { 1: 0, 2: 0 };
  for (const t of exp) byPerson[t.person] += t.amount;

  return { months, n, income, extra, charges, envelopes, spent, toSave, savedIn: flow.in, savedOut: flow.out, bars, average, overCount, byEnvelope, byPerson };
}

/** « Notre mois type » pour un mois donné */
export function typicalMonth(s: Settings, m: MonthKey) {
  const income = incomeFor(s, m);
  const charges = chargesTotalFor(s, m);
  const envelopes = envelopesTotalFor(s, m);
  const rest = income - charges - envelopes;
  return { income, charges, envelopes, saving: Math.max(rest, 0), missing: Math.max(-rest, 0) };
}

/* ------------------------------------------------------------------ */
/*  Charges fixes                                                      */
/* ------------------------------------------------------------------ */

export type ChargeState = { kind: 'done' } | { kind: 'soon'; days: number } | { kind: 'later' } | { kind: 'free' };

export interface ChargeLine {
  charge: Charge;
  amount: Cents;
  share: number;
  state: ChargeState;
  /** jour effectif dans le mois affiché (31 → 30 en novembre) */
  effDay: number | null;
}

export function chargeLines(s: Settings, month: MonthKey, today: DateKey): { lines: ChargeLine[]; total: Cents; incomeShare: number | null } {
  const v = versionFor(s, month);
  const clock = monthClock(month, today);
  const totalC = sum(Object.values(v.charges));
  const lines: ChargeLine[] = Object.entries(v.charges).map(([id, amount]) => {
    const charge: Charge = s.charges.find((c) => c.id === id) ?? { id, name: 'Charge supprimée', icon: '🧾', color: '#BFC5D2', iconAuto: false, day: null, archived: true };
    const effDay = charge.day ? Math.min(charge.day, clock.days) : null;
    let state: ChargeState;
    if (effDay == null) state = { kind: 'free' };
    else if (clock.when === 'past') state = { kind: 'done' };
    else if (clock.when === 'future') state = { kind: 'later' };
    else if (effDay < clock.day) state = { kind: 'done' };
    else if (effDay - clock.day <= 3) state = { kind: 'soon', days: effDay - clock.day };
    else state = { kind: 'later' };
    return { charge, amount, share: totalC > 0 ? amount / totalC : 0, state, effDay };
  });
  lines.sort((a, b) => (a.effDay ?? 99) - (b.effDay ?? 99) || b.amount - a.amount);
  const income = v.income;
  return { lines, total: totalC, incomeShare: income > 0 ? totalC / income : null };
}

/** Prochain prélèvement à partir d'aujourd'hui (aujourd'hui compris). */
export function nextCharge(s: Settings, today: DateKey): { charge: Charge; amount: Cents; inDays: number } | null {
  const tm = monthOf(today);
  const todayDay = Number(today.slice(8, 10));
  const best: { charge: Charge; amount: Cents; inDays: number }[] = [];
  for (const [m, offset] of [
    [tm, 0],
    [addMonths(tm, 1), daysInMonth(tm) - todayDay],
  ] as const) {
    const v = versionFor(s, m);
    const dim = daysInMonth(m);
    for (const [id, amount] of Object.entries(v.charges)) {
      const c = s.charges.find((x) => x.id === id);
      if (!c?.day || c.archived) continue;
      const eff = Math.min(c.day, dim);
      const inDays = m === tm ? eff - todayDay : offset + eff;
      if (inDays >= 0) best.push({ charge: c, amount, inDays });
    }
    if (best.length) break;
  }
  best.sort((a, b) => a.inDays - b.inDays || b.amount - a.amount);
  return best[0] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Libellés                                                           */
/* ------------------------------------------------------------------ */

export function categoryOf(s: Settings, t: Pick<Tx, 'kind' | 'category'>): Visual {
  if (t.kind === 'expense') return envelopeById(s, t.category);
  if (t.kind === 'income') return INCOME_TYPES.find((i) => i.id === t.category) ?? INCOME_TYPES[INCOME_TYPES.length - 1];
  return s.pots.find((p) => p.id === t.category) ?? { id: t.category, name: 'Cagnotte supprimée', icon: '🐷', color: '#FDD46B' };
}

export const yearOf = (m: MonthKey) => parseMonth(m).y;
