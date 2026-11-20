import type { Cents, Charge, Envelope, MonthKey, Pot, Settings } from './types';
import { versionFor } from './calc';
import { COLORS, defaultSettings } from './defaults';
import { monthOf, todayKey } from './format';

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown, d: string) => (typeof x === 'string' ? x : d);
const int = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : d);

/** Remet d'aplomb des réglages venant de la base / d'une sauvegarde (champs manquants, types). */
export function normalizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(raw)) return d;
  const names = Array.isArray(raw.names) ? raw.names : [];
  const visual = (x: Record<string, unknown>, i: number) => ({
    id: str(x.id, `x-${i}`),
    name: str(x.name, ''),
    icon: str(x.icon, '📦'),
    color: str(x.color, COLORS[i % COLORS.length]),
    ...(x.archived ? { archived: true } : {}),
  });
  const list = (x: unknown) => (Array.isArray(x) ? x.filter(isObj) : null);
  const envelopes = list(raw.envelopes)?.map(visual) ?? d.envelopes;
  const charges =
    list(raw.charges)?.map((x, i) => ({
      ...visual(x, i),
      iconAuto: x.iconAuto !== false,
      day: typeof x.day === 'number' && x.day >= 1 && x.day <= 31 ? Math.round(x.day) : null,
    })) ?? d.charges;
  const pots =
    list(raw.pots)?.map((x, i) => ({
      ...visual(x, i),
      goal: typeof x.goal === 'number' && x.goal > 0 ? Math.round(x.goal) : null,
      initial: int(x.initial, 0),
    })) ?? d.pots;
  const versions: Settings['versions'] = {};
  if (isObj(raw.versions)) {
    for (const [k, v] of Object.entries(raw.versions)) {
      if (!/^\d{4}-\d{2}$/.test(k) || !isObj(v)) continue;
      const rec = (x: unknown) =>
        isObj(x) ? Object.fromEntries(Object.entries(x).map(([id, a]) => [id, int(a, 0)])) : {};
      versions[k] = { income: int(v.income, 0), charges: rec(v.charges), envelopes: rec(v.envelopes) };
    }
  }
  if (Object.keys(versions).length === 0) versions[monthOf(todayKey())] = d.versions[monthOf(todayKey())];
  return {
    names: [str(names[0], d.names[0]), str(names[1], d.names[1])],
    envelopes,
    charges,
    pots,
    versions,
    onboarded: raw.onboarded === true,
  };
}

/* ------------------------------------------------------------------ */
/*  Brouillon des réglages (formulaire) → Settings                     */
/* ------------------------------------------------------------------ */


export interface Draft {
  names: [string, string];
  income: Cents;
  charges: (Charge & { amount: Cents })[];
  envelopes: (Envelope & { budget: Cents })[];
  pots: Pot[];
}

export function toDraft(s: Settings, month: MonthKey): Draft {
  const v = versionFor(s, month);
  return {
    names: [...s.names] as [string, string],
    income: v.income,
    charges: s.charges.filter((c) => !c.archived).map((c) => ({ ...c, amount: v.charges[c.id] ?? 0 })),
    envelopes: s.envelopes.filter((e) => !e.archived).map((e) => ({ ...e, budget: v.envelopes[e.id] ?? 0 })),
    pots: s.pots.filter((p) => !p.archived),
  };
}

/** Applique le formulaire : les montants valent à partir du mois `month` ;
 *  ce qui a été supprimé est archivé (l'historique reste juste). */
export function fromDraft(old: Settings, d: Draft, month: MonthKey): Settings {
  const keep = <T extends { id: string; name: string }>(xs: T[]) => xs.filter((x) => x.name.trim() !== '').map((x) => ({ ...x, name: x.name.trim() }));
  const charges = keep(d.charges);
  const envelopes = keep(d.envelopes);
  const pots = keep(d.pots);
  const archive = <T extends { id: string; archived?: boolean }>(prev: T[], now: { id: string }[]) => {
    const ids = new Set(now.map((x) => x.id));
    return prev.filter((x) => !ids.has(x.id)).map((x) => ({ ...x, archived: true }));
  };
  const strip = <T extends object>(x: T, k: string) => {
    const { [k]: _omit, archived: _a, ...rest } = x as Record<string, unknown>;
    return rest;
  };
  const versions = Object.fromEntries(Object.entries(old.versions).filter(([k]) => k < month));
  versions[month] = {
    income: Math.max(0, d.income),
    charges: Object.fromEntries(charges.map((c) => [c.id, Math.max(0, c.amount)])),
    envelopes: Object.fromEntries(envelopes.map((e) => [e.id, Math.max(0, e.budget)])),
  };
  return {
    names: [d.names[0].trim() || old.names[0], d.names[1].trim() || old.names[1]],
    charges: [...(charges.map((c) => strip(c, 'amount')) as unknown as Charge[]), ...archive(old.charges, charges)],
    envelopes: [...(envelopes.map((e) => strip(e, 'budget')) as unknown as Envelope[]), ...archive(old.envelopes, envelopes)],
    pots: [...(pots.map((p) => strip(p, '_')) as unknown as Pot[]), ...archive(old.pots, pots)],
    versions,
    onboarded: true,
  };
}
