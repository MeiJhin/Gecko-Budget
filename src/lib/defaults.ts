import type { Envelope, Pot, Settings, Visual } from './types';
import { todayKey, monthOf } from './format';
import { L } from './i18n';

/** Les 10 couleurs pastel du sélecteur */
export const COLORS = [
  '#7DD3AE', // menthe
  '#FDAA80', // pêche
  '#8AB4F8', // bleu
  '#F4A6C8', // rose
  '#C5E17A', // vert anis
  '#C9A7F9', // lavande
  '#7DD6E8', // turquoise
  '#FDD46B', // jaune
  '#BFC5D2', // gris
  '#FF9C8F', // corail
];

export const PERSON_COLORS: Record<1 | 2, string> = { 1: '#4F6BED', 2: '#E05A7A' };

export const ICON_GROUPS: { readonly title: string; icons: string[] }[] = [
  { get title() { return L('Courses & repas', 'Food & groceries'); }, icons: ['🛒', '🥖', '🍎', '🥩', '🧀', '🍽️', '🍕', '🍔', '🍣', '☕', '🍷', '🍺'] },
  { get title() { return L('Maison & énergie', 'Home & energy'); }, icons: ['🏠', '🔑', '💡', '🔥', '💧', '🛋️', '🧹', '🔧', '🪴', '🧺', '🛠️', '🏡'] },
  { get title() { return L('Transport', 'Transport'); }, icons: ['⛽', '🚗', '🚙', '🚐', '🚆', '🛵', '🚲', '✈️', '🅿️', '🔋', '🛞', '🚕'] },
  { get title() { return L('Loisirs & sorties', 'Leisure & outings'); }, icons: ['🎮', '🎬', '🎵', '📚', '⚽', '🏋️', '🎨', '🎟️', '🏖️', '🎉', '🎲', '🍿'] },
  { get title() { return L('Santé & perso', 'Health & personal'); }, icons: ['💊', '🩺', '🦷', '👓', '💇', '💅', '🧴', '👕', '👟', '👜', '🧘', '💄'] },
  { get title() { return L('Famille & animaux', 'Family & pets'); }, icons: ['👶', '🧸', '🎒', '🍼', '🐶', '🐱', '🎁', '💍', '🎂', '👪', '🏫', '❤️'] },
  { get title() { return L('Abonnements & finances', 'Subscriptions & finance'); }, icons: ['📱', '🌐', '📺', '🎧', '☁️', '🛡️', '🏦', '💳', '💶', '📈', '🧾', '🏛️', '🎓', '💼', '📦', '🐷', '🛟', '🎯'] },
];

/** Types de rentrées ponctuelles (fixes) */
export const INCOME_TYPES: Visual[] = [
  { id: 'prime', get name() { return L('Prime/bonus', 'Bonus'); }, icon: '💼', color: '#7DD3AE' },
  { id: 'vente', get name() { return L('Vente Vinted/Leboncoin', 'Resale (Vinted, eBay…)'); }, icon: '🏷️', color: '#7DD6E8' },
  { id: 'rembours', get name() { return L('Remboursement', 'Refund'); }, icon: '💸', color: '#C5E17A' },
  { id: 'cadeau', get name() { return L('Cadeau', 'Gift'); }, icon: '🎁', color: '#F4A6C8' },
  { id: 'aide', get name() { return L('Aide/CAF', 'Benefits'); }, icon: '🏛️', color: '#8AB4F8' },
  { id: 'heures', get name() { return L('Heures sup/extra', 'Overtime/extra work'); }, icon: '⏱️', color: '#FDD46B' },
  { id: 'autre', get name() { return L('Autre', 'Other'); }, icon: '✨', color: '#C9A7F9' },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Mots-clés → icône pour les charges fixes (ordre = priorité) */
const GUESSES: [RegExp, string][] = [
  [/loyer|appart|logement|\brent\b|mortgage/, '🏠'],
  [/credit|pret|emprunt|immo|loan/, '🏦'],
  [/mutuelle|sante|health/, '🩺'],
  [/assurance|assu\b|maif|macif|matmut|axa|gmf|insurance/, '🛡️'],
  [/edf|electri|engie|totalenergies|enercoop|power/, '💡'],
  [/gaz|chauffage|fioul|\bgas\b|heating/, '🔥'],
  [/\beau\b|veolia|saur|water/, '💧'],
  [/box|internet|fibre|livebox|freebox|bbox|adsl/, '🌐'],
  [/forfait|mobile|telephone|portable|sosh|free mobile|bouygues|sfr|orange|phone/, '📱'],
  [/netflix|canal|disney|prime video|molotov|\btv\b|television|ocs|max\b/, '📺'],
  [/spotify|deezer|musique|apple music/, '🎧'],
  [/impot|taxe|tresor|\btax/, '🏛️'],
  [/creche|nounou|garde|assistante mat|baby|daycare|nursery|childcare/, '👶'],
  [/cantine|ecole|scolar|etude|school/, '🏫'],
  [/sport|salle|gym|fitness|basic fit|club/, '🏋️'],
  [/icloud|cloud|google one|drive|dropbox/, '☁️'],
  [/voiture|auto|leasing|lld|loa|\bcar\b/, '🚗'],
  [/navigo|transport|train|sncf|bus|metro|tcl|pass/, '🚆'],
  [/parking/, '🅿️'],
  [/epargne|livret|placement|saving/, '🐷'],
  [/banque|frais bancaire|carte|bank/, '💳'],
  [/chien|chat|veto|animal|\bdog|\bcat\b|\bvet\b|\bpet/, '🐶'],
  [/menage|aide a domicile|cleaning/, '🧹'],
  [/jeu|playstation|xbox|nintendo|steam/, '🎮'],
  [/presse|journal|magazine|abonnement/, '🧾'],
];

export function guessIcon(name: string): string | null {
  const n = norm(name);
  for (const [re, icon] of GUESSES) if (re.test(n)) return icon;
  return null;
}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Enveloppes par défaut, dans la langue de la personne qui crée le foyer */
export const defaultEnvelopes = (): Omit<Envelope, 'id'>[] => [
  { name: L('Courses', 'Groceries'), icon: '🛒', color: COLORS[0] },
  { name: L('Restos & sorties', 'Restaurants & outings'), icon: '🍽️', color: COLORS[1] },
  { name: L('Essence & transport', 'Fuel & transport'), icon: '⛽', color: COLORS[2] },
  { name: L('Maison', 'Home'), icon: '🏠', color: COLORS[3] },
  { name: L('Loisirs', 'Leisure'), icon: '🎮', color: COLORS[4] },
  { name: L('Santé', 'Health'), icon: '💊', color: COLORS[5] },
  { name: L('Vêtements & shopping', 'Clothes & shopping'), icon: '👕', color: COLORS[6] },
  { name: L('Divers', 'Misc.'), icon: '📦', color: COLORS[8] },
];

export function defaultSettings(): Settings {
  const envelopes: Envelope[] = defaultEnvelopes().map((e, i) => ({ ...e, id: `env-${i + 1}` }));
  const pots: Pot[] = [{ id: 'pot-1', name: L('Livret A', 'Savings account'), icon: '🐷', color: COLORS[7], goal: null, initial: 0 }];
  return {
    names: [L('Moi', 'Me'), L('Ma femme', 'My partner')],
    envelopes,
    charges: [],
    pots,
    versions: {
      [monthOf(todayKey())]: { income: 0, charges: {}, envelopes: Object.fromEntries(envelopes.map((e) => [e.id, 0])) },
    },
    onboarded: false,
  };
}
