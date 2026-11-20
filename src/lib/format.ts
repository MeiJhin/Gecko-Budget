import type { Cents, DateKey, MonthKey } from './types';
import { getLang } from './i18n';

const fmt = {
  fr: { n0: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }), n2: new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  en: { n0: new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }), n2: new Intl.NumberFormat('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
};

/** Espaces fines insécables → espaces insécables normales (rendu homogène). */
const clean = (s: string) => s.replace(/ /g, ' ');

/** fr : « 1 234,50 € » — en : « €1,234.50 » */
export function euros(c: Cents, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const lang = getLang();
  const v = c / 100;
  const abs = Math.abs(v);
  const decimals = opts.decimals ?? false;
  const f = fmt[lang];
  const body = clean(decimals ? f.n2.format(abs) : f.n0.format(Math.round(abs)));
  const rounded0 = !decimals && Math.round(abs) === 0;
  let sign = '';
  if (v < 0 && !rounded0) sign = '−';
  else if (opts.sign && v > 0) sign = '+';
  return lang === 'en' ? `${sign}€${body}` : `${sign}${body} €`;
}

/** Séparateur décimal de la langue */
export const decimalSep = () => (getLang() === 'en' ? '.' : ',');

/** Montant sans symbole, pour les champs de saisie : 123450 → « 1234,5 » (« 1234.5 » en anglais) */
export function centsToInput(c: Cents | null | undefined): string {
  if (c == null || c === 0) return '';
  const v = c / 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
  return s.replace('.', decimalSep());
}

/** « 1 234,50 » / « 1234.5 » / « 1,234.50 » (anglais) → centimes ; null si vide/invalide */
export function parseEuros(s: string): Cents | null {
  let t = s.replace(/[\s  €]/g, '');
  t = getLang() === 'en' ? t.replace(/,/g, '') : t.replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d*(\.\d{0,2})?$/.test(t)) return null;
  const v = Number(t);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = () => (getLang() === 'en' ? MONTHS_EN : MONTHS_FR);
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

/** « Novembre 2026 » / « November 2026 » */
export const monthLabel = (k: MonthKey, capital = true) => {
  const { y, m } = parseMonth(k);
  const s = `${months()[m - 1]} ${y}`;
  return capital ? cap(s) : s;
};
export const monthName = (k: MonthKey) => months()[parseMonth(k).m - 1];
export const monthShort = (k: MonthKey) => {
  const n = monthName(k);
  if (getLang() === 'en') return n.slice(0, 3);
  return n.length <= 4 ? n : n.slice(0, 3) + '.';
};

/** fr : « de juin à novembre 2026 » — en : « June to November 2026 » */
export function periodLabel(start: MonthKey, end: MonthKey): string {
  if (start === end) return monthLabel(end);
  const a = parseMonth(start);
  const b = parseMonth(end);
  const M = months();
  if (getLang() === 'en') return a.y === b.y ? `${M[a.m - 1]} to ${M[b.m - 1]} ${b.y}` : `${M[a.m - 1]} ${a.y} to ${M[b.m - 1]} ${b.y}`;
  const de = /^[aeiouyéèh]/i.test(M[a.m - 1]) ? "d'" : 'de ';
  if (a.y === b.y) return `${de}${M[a.m - 1]} à ${M[b.m - 1]} ${b.y}`;
  return `${de}${M[a.m - 1]} ${a.y} à ${M[b.m - 1]} ${b.y}`;
}

const parseDate = (d: DateKey) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
};

/** « Aujourd'hui », « Hier », « mercredi 18 novembre » / « Today », « Wednesday, November 18 » */
export function dayLabel(d: DateKey, today = todayKey()): string {
  const en = getLang() === 'en';
  if (d === today) return en ? 'Today' : "Aujourd'hui";
  const t = parseDate(today);
  t.setDate(t.getDate() - 1);
  if (d === dateKey(t)) return en ? 'Yesterday' : 'Hier';
  const x = parseDate(d);
  const sameYear = x.getFullYear() === parseDate(today).getFullYear();
  if (en) return `${DAYS_EN[x.getDay()]}, ${MONTHS_EN[x.getMonth()]} ${x.getDate()}${sameYear ? '' : `, ${x.getFullYear()}`}`;
  const base = `${DAYS_FR[x.getDay()]} ${x.getDate()} ${MONTHS_FR[x.getMonth()]}`;
  return sameYear ? base : `${base} ${x.getFullYear()}`;
}

/** « 20 nov. » / « Nov 20 » */
export function shortDate(d: DateKey): string {
  const x = parseDate(d);
  if (getLang() === 'en') return `${MONTHS_EN[x.getMonth()].slice(0, 3)} ${x.getDate()}`;
  const n = MONTHS_FR[x.getMonth()];
  return `${x.getDate()} ${n.length <= 4 ? n : n.slice(0, 3) + '.'}`;
}

/** « 20/11/2026 » */
export const frDate = (d: DateKey) => d.split('-').reverse().join('/');

export const pct = (v: number) => (getLang() === 'en' ? `${Math.round(v)}%` : `${Math.round(v)} %`);
