import { describe, expect, it } from 'vitest';
import { fromDraft, normalizeSettings, toDraft } from './settings';
import { defaultSettings } from './defaults';
import { versionFor } from './calc';

describe('réglages', () => {
  it('un changement de budget vaut à partir du mois en cours, pas avant', () => {
    const s0 = defaultSettings();
    s0.versions = { '2026-09': { income: 300000, charges: {}, envelopes: { 'env-1': 20000 } } };
    const d = toDraft(s0, '2026-11');
    expect(d.income).toBe(300000);
    d.income = 380000;
    d.envelopes[0].budget = 25000;
    const s1 = fromDraft(s0, d, '2026-11');
    expect(versionFor(s1, '2026-10').income).toBe(300000);
    expect(versionFor(s1, '2026-10').envelopes['env-1']).toBe(20000);
    expect(versionFor(s1, '2026-11').income).toBe(380000);
    expect(versionFor(s1, '2027-03').envelopes['env-1']).toBe(25000);
    expect(s1.onboarded).toBe(true);
  });
  it('supprimer une enveloppe l’archive (l’historique reste juste)', () => {
    const s0 = defaultSettings();
    const d = toDraft(s0, '2026-11');
    d.envelopes = d.envelopes.filter((e) => e.name !== 'Divers');
    d.envelopes.push({ id: 'new', name: '  Voiture ', icon: '🚗', color: '#7DD3AE', budget: 35000 });
    d.envelopes.push({ id: 'vide', name: '   ', icon: '📦', color: '#7DD3AE', budget: 0 });
    const s1 = fromDraft(s0, d, '2026-11');
    expect(s1.envelopes.find((e) => e.name === 'Divers')?.archived).toBe(true);
    expect(s1.envelopes.find((e) => e.id === 'new')?.name).toBe('Voiture');
    expect(s1.envelopes.some((e) => e.id === 'vide')).toBe(false);
    expect(Object.keys(versionFor(s1, '2026-11').envelopes)).not.toContain('env-8');
    expect((s1.envelopes.find((e) => e.id === 'new') as unknown as Record<string, unknown>).budget).toBeUndefined();
    // et ça survit à un aller-retour par la base
    expect(normalizeSettings(JSON.parse(JSON.stringify(s1)))).toEqual(s1);
  });
});
