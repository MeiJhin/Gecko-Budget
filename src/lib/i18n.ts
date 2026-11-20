import { useSyncExternalStore } from 'react';

/** Langue de l'appli, choisie sur chaque téléphone (français par défaut). */
export type Lang = 'fr' | 'en';

const KEY = 'gb:lang';
const listeners = new Set<() => void>();

function detect(): Lang {
  if (typeof window === 'undefined') return 'fr';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.languages?.[0] ?? navigator.language ?? 'fr').toLowerCase();
  return nav.startsWith('fr') ? 'fr' : nav.startsWith('en') ? 'en' : 'fr';
}

let current: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const getLang = () => current;

export function setLang(l: Lang) {
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    getLang,
    getLang,
  );
}

/** Texte selon la langue : L('Bonjour', 'Hello') */
export const L = (fr: string, en: string) => (current === 'en' ? en : fr);
/** Accord simple : P(2, 'jour', 'day') → « jours » / « days » */
export const P = (n: number, fr: string, en: string) => L(fr, en) + (Math.abs(n) > 1 ? 's' : '');
