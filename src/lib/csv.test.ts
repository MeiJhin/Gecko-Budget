import { describe, expect, it } from 'vitest';
import { parseBackup, toBackup, toCsv } from './csv';
import { defaultSettings } from './defaults';
import type { Tx } from './types';

const base = { person: 1 as const, note: '', created_at: '', updated_at: '' };
const txs: Tx[] = [
  { ...base, id: 'a', kind: 'expense', amount: 12830, category: 'env-1', date: '2026-11-18', note: 'Leclerc; drive' },
  { ...base, id: 'b', kind: 'income', amount: 4000, category: 'vente', date: '2026-11-02', person: 2 },
  { ...base, id: 'c', kind: 'saving', amount: -5000, category: 'pot-1', date: '2026-11-19', note: 'Garage' },
];

describe('export', () => {
  it('CSV au format français', () => {
    const csv = toCsv(defaultSettings(), txs);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('Date;Type;Catégorie;Montant (€);Qui;Note');
    expect(lines[1]).toBe('02/11/2026;Rentrée;Vente Vinted/Leboncoin;40,00;Ma femme;');
    expect(lines[2]).toBe('18/11/2026;Dépense;Courses;-128,30;Moi;"Leclerc; drive"');
    expect(lines[3]).toBe('19/11/2026;Épargne (retrait);Livret A;-50,00;Moi;Garage');
  });
  it('sauvegarde complète aller-retour', () => {
    const s = defaultSettings();
    const back = parseBackup(toBackup(s, txs));
    expect(back.txs).toEqual(txs);
    expect(back.settings.envelopes).toEqual(s.envelopes);
    expect(() => parseBackup('{"foo":1}')).toThrow(/sauvegarde/);
    expect(() => parseBackup('pas du json')).toThrow(/sauvegarde/);
  });
});
