import type { Settings, Tx } from './types';
import { addMonths, daysInMonth, monthOf, pad2, todayKey } from './format';

/** Des données d'exemple réalistes pour essayer l'appli en mode démo */
export function demoData(): { settings: Settings; txs: Tx[] } {
  const m0 = monthOf(todayKey());
  const first = addMonths(m0, -5);
  const settings: Settings = {
    names: ['Alex', 'Camille'],
    envelopes: [
      { id: 'env-1', name: 'Courses', icon: '🛒', color: '#7DD3AE' },
      { id: 'env-2', name: 'Restos & sorties', icon: '🍽️', color: '#FDAA80' },
      { id: 'env-3', name: 'Essence & transport', icon: '⛽', color: '#8AB4F8' },
      { id: 'env-4', name: 'Maison', icon: '🏠', color: '#F4A6C8' },
      { id: 'env-5', name: 'Loisirs', icon: '🎮', color: '#C5E17A' },
      { id: 'env-6', name: 'Santé', icon: '💊', color: '#C9A7F9' },
      { id: 'env-7', name: 'Vêtements & shopping', icon: '👕', color: '#7DD6E8' },
      { id: 'env-8', name: 'Divers', icon: '📦', color: '#BFC5D2' },
    ],
    charges: [
      { id: 'c1', name: 'Loyer', icon: '🏠', color: '#8AB4F8', iconAuto: true, day: 5 },
      { id: 'c2', name: 'Crédit auto', icon: '🏦', color: '#C9A7F9', iconAuto: true, day: 10 },
      { id: 'c3', name: 'EDF', icon: '💡', color: '#FDD46B', iconAuto: true, day: 12 },
      { id: 'c4', name: 'Assurance habitation', icon: '🛡️', color: '#7DD3AE', iconAuto: true, day: 8 },
      { id: 'c5', name: 'Box internet', icon: '🌐', color: '#7DD6E8', iconAuto: true, day: 15 },
      { id: 'c6', name: 'Forfaits mobiles', icon: '📱', color: '#F4A6C8', iconAuto: true, day: 22 },
      { id: 'c7', name: 'Mutuelle', icon: '🩺', color: '#C5E17A', iconAuto: true, day: 1 },
      { id: 'c8', name: 'Netflix', icon: '📺', color: '#FF9C8F', iconAuto: true, day: 27 },
    ],
    pots: [
      { id: 'p1', name: 'Livret A', icon: '🐷', color: '#FDD46B', goal: 1000000, initial: 420000 },
      { id: 'p2', name: 'Vacances', icon: '🏖️', color: '#7DD6E8', goal: 200000, initial: 35000 },
      { id: 'p3', name: 'Voiture', icon: '🚗', color: '#8AB4F8', goal: null, initial: 80000 },
    ],
    versions: {
      [first]: {
        income: 420000,
        charges: { c1: 95000, c2: 18000, c3: 8500, c4: 2400, c5: 3000, c6: 2500, c7: 9000, c8: 1400 },
        envelopes: { 'env-1': 55000, 'env-2': 20000, 'env-3': 20000, 'env-4': 8000, 'env-5': 6000, 'env-6': 5000, 'env-7': 9000, 'env-8': 5000 },
      },
    },
    onboarded: true,
  };

  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const txs: Tx[] = [];
  let n = 0;
  const today = todayKey();
  const add = (kind: Tx['kind'], amount: number, category: string, date: string, note = '', person?: 1 | 2) => {
    if (date > today) return;
    txs.push({ id: `demo-${++n}`, kind, amount: Math.round(amount), category, person: person ?? (rnd() < 0.55 ? 1 : 2), date, note, created_at: `${date}T12:00:${pad2(n % 60)}Z`, updated_at: '' });
  };
  const plan: [string, number, number, string[]][] = [
    ['env-1', 9, 6200, ['Leclerc', 'Carrefour', 'Marché', 'Lidl', 'Biocoop', '']],
    ['env-2', 3, 4200, ['Pizzeria', 'Sushi', 'Ciné + resto', 'Brunch']],
    ['env-3', 4, 5200, ['Essence', 'Total', 'Péage', 'Parking']],
    ['env-4', 2, 3500, ['Ikea', 'Leroy Merlin', 'Action']],
    ['env-5', 2, 2600, ['Escape game', 'Concert', 'Livres']],
    ['env-6', 1, 3000, ['Pharmacie', 'Ostéo']],
    ['env-7', 1, 6000, ['Zara', 'Décathlon', 'Kiabi']],
  ];
  for (let i = 0; i < 6; i++) {
    const m = addMonths(first, i);
    const dim = daysInMonth(m);
    const heavy = i === 3 ? 1.35 : 1;
    for (const [cat, count, avg, notes] of plan) {
      for (let k = 0; k < count; k++) {
        const day = 1 + Math.floor(rnd() * dim);
        add('expense', avg * (0.5 + rnd()) * heavy, cat, `${m}-${pad2(day)}`, pick(notes));
      }
    }
    add('saving', 20000, 'p1', `${m}-06`, '', 1);
    if (i % 2 === 0) add('saving', 10000, 'p2', `${m}-07`, '', 2);
  }
  add('income', 4500, 'vente', `${m0}-03`, 'Poussette', 2);
  add('income', 12000, 'prime', `${addMonths(m0, -2)}-25`, 'Prime de fin de projet', 1);
  add('saving', -15000, 'p3', `${addMonths(m0, -1)}-14`, 'Pneus neufs', 1);
  txs.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { settings, txs };
}
