import type { Settings, Tx } from './types';
import { categoryOf } from './calc';
import { frDate } from './format';
import { normalizeSettings } from './settings';

const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const money = (c: number) => (c / 100).toFixed(2).replace('.', ',');

/** CSV lisible par Excel / Numbers / Google Sheets en français (séparateur « ; », virgule décimale) */
export function toCsv(settings: Settings, txs: Tx[]): string {
  const head = ['Date', 'Type', 'Catégorie', 'Montant (€)', 'Qui', 'Note'];
  const rows = [...txs]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((t) => {
      const type = t.kind === 'expense' ? 'Dépense' : t.kind === 'income' ? 'Rentrée' : t.amount >= 0 ? 'Épargne (versement)' : 'Épargne (retrait)';
      const signed = t.kind === 'expense' ? -t.amount : t.amount;
      return [frDate(t.date), type, categoryOf(settings, t).name, money(signed), settings.names[t.person - 1], t.note];
    });
  return '﻿' + [head, ...rows].map((r) => r.map((v) => cell(String(v))).join(';')).join('\r\n') + '\r\n';
}

export interface Backup {
  app: 'gecko-budget';
  version: 1;
  exported_at: string;
  settings: Settings;
  transactions: Tx[];
}

export function toBackup(settings: Settings, txs: Tx[]): string {
  const b: Backup = { app: 'gecko-budget', version: 1, exported_at: new Date().toISOString(), settings, transactions: txs };
  return JSON.stringify(b, null, 1);
}

/** Lit une sauvegarde ; lève une erreur en français si le fichier n'est pas bon */
export function parseBackup(text: string): { settings: Settings; txs: Tx[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde Gecko Budget (.json).");
  }
  const b = raw as Partial<Backup>;
  if (!b || b.app !== 'gecko-budget' || !Array.isArray(b.transactions)) throw new Error("Ce fichier n'est pas une sauvegarde Gecko Budget.");
  const txs: Tx[] = b.transactions
    .filter((t) => t && typeof t.id === 'string' && ['expense', 'income', 'saving'].includes(t.kind) && Number.isFinite(t.amount) && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
    .map((t) => ({
      id: t.id,
      kind: t.kind,
      amount: Math.round(t.amount),
      category: String(t.category),
      person: t.person === 2 ? 2 : 1,
      date: t.date,
      note: String(t.note ?? ''),
      created_at: String(t.created_at ?? ''),
      updated_at: String(t.updated_at ?? ''),
    }));
  return { settings: normalizeSettings(b.settings), txs };
}

/** Enregistre un fichier : feuille de partage sur téléphone, téléchargement sinon */
export async function saveFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
