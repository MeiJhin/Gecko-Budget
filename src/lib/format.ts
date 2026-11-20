import type { Cents, DateKey, MonthKey } from './types';

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Espaces fines insécables → espaces insécables normales (rendu homogène). */
const clean = (s: string) => s.replace(/ /g, ' ');

/** 1234.5 € → « 1 234,50 € » */
export function euros(c: Cents, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const v = c / 100;
  const abs = Math.abs(v);
  const decimals = opts.decimals ?? false;
  const body = clean(decimals ? nf2.format(abs) : nf0.format(Math.round(abs)));
  const rounded0 = !decimals && Math.round(abs) === 0;
  let sign = '';
  if (v < 0 && !rounded0) sign = '−';
  else if (opts.sign && v > 0) sign = '+';
  return `${sign}${body} €`;
}

/** Montant sans symbole, pour les champs de saisie : 123450 → « 1234,5 » */
export function centsToInput(c: Cents | null | undefined): string {
  if (c == null || c === 0) return '';
  const v = c / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',').replace(/0$/, '');
}

/** « 1 234,50 » / « 1234.5 » → centimes ; null si vide/invalide */
export function parseEuros(s: string): Cents | null {
  const t = s.replace(/[\s  €]/g, '').replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d*(\.\d{0,2})?$/.test(t)) return null;
  const v = Number(t);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const monthKey = (y: number, m: number): MonthKey => `${y}-${pad2(m)}`;
export const parseMonth = (k: MonthKey) => {
  const [y, m] = k.split('-').map(Number);
  return { y, m };
};
export const dateKey = (d: Date): DateKey => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const monthOf = (d: DateKey): MonthKey => d.slice(0, 7);
export const todayKey = (): DateKey => dateKey(new Date());

export function addMonths(k: MonthKey, n: number): MonthKey {
  const { y, m } = parseMonth(k);
  const idx = y * 12 + (m - 1) + n;
  return monthKey(Math.floor(idx / 12), (idx % 12) + 1);
}
export const daysInMonth = (k: MonthKey) => {
  const { y, m } = parseMonth(k);
  return new Date(y, m, 0).getDate();
};

/** « Novembre 2026 » */
export const monthLabel = (k: MonthKey, capital = true) => {
  const { y, m } = parseMonth(k);
  const s = `${MONTHS[m - 1]} ${y}`;
  return capital ? cap(s) : s;
};
export const monthName = (k: MonthKey) => MONTHS[parseMonth(k).m - 1];
export const monthShort = (k: MonthKey) => {
  const n = monthName(k);
  return n.length <= 4 ? n : n.slice(0, 3) + '.';
};

/** « Bilan de juin à novembre 2026 » / « de décembre 2025 à mai 2026 » */
export function periodLabel(start: MonthKey, end: MonthKey): string {
  if (start === end) return monthLabel(end);
  const a = parseMonth(start);
  const b = parseMonth(end);
  const de = /^[aeiouyéèh]/i.test(MONTHS[a.m - 1]) ? "d'" : 'de ';
  if (a.y === b.y) return `${de}${MONTHS[a.m - 1]} à ${MONTHS[b.m - 1]} ${b.y}`;
  return `${de}${MONTHS[a.m - 1]} ${a.y} à ${MONTHS[b.m - 1]} ${b.y}`;
}

const parseDate = (d: DateKey) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
};

/** « Aujourd'hui », « Hier », « mercredi 18 novembre » */
export function dayLabel(d: DateKey, today = todayKey()): string {
  if (d === today) return "Aujourd'hui";
  const t = parseDate(today);
  t.setDate(t.getDate() - 1);
  if (d === dateKey(t)) return 'Hier';
  const x = parseDate(d);
  const base = `${DAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`;
  return x.getFullYear() === parseDate(today).getFullYear() ? base : `${base} ${x.getFullYear()}`;
}

/** « 20 nov. » */
export function shortDate(d: DateKey): string {
  const x = parseDate(d);
  const n = MONTHS[x.getMonth()];
  return `${x.getDate()} ${n.length <= 4 ? n : n.slice(0, 3) + '.'}`;
}

/** « 20/11/2026 » */
export const frDate = (d: DateKey) => d.split('-').reverse().join('/');

export const pct = (v: number) => `${Math.round(v)} %`;
