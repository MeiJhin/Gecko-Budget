import type { Envelope, Pot, Settings, Visual } from './types';
import { todayKey, monthOf } from './format';

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

export const ICON_GROUPS: { title: string; icons: string[] }[] = [
  { title: 'Courses & repas', icons: ['🛒', '🥖', '🍎', '🥩', '🧀', '🍽️', '🍕', '🍔', '🍣', '☕', '🍷', '🍺'] },
  { title: 'Maison & énergie', icons: ['🏠', '🔑', '💡', '🔥', '💧', '🛋️', '🧹', '🔧', '🪴', '🧺', '🛠️', '🏡'] },
  { title: 'Transport', icons: ['⛽', '🚗', '🚙', '🚐', '🚆', '🛵', '🚲', '✈️', '🅿️', '🔋', '🛞', '🚕'] },
  { title: 'Loisirs & sorties', icons: ['🎮', '🎬', '🎵', '📚', '⚽', '🏋️', '🎨', '🎟️', '🏖️', '🎉', '🎲', '🍿'] },
  { title: 'Santé & perso', icons: ['💊', '🩺', '🦷', '👓', '💇', '💅', '🧴', '👕', '👟', '👜', '🧘', '💄'] },
  { title: 'Famille & animaux', icons: ['👶', '🧸', '🎒', '🍼', '🐶', '🐱', '🎁', '💍', '🎂', '👪', '🏫', '❤️'] },
  { title: 'Abonnements & finances', icons: ['📱', '🌐', '📺', '🎧', '☁️', '🛡️', '🏦', '💳', '💶', '📈', '🧾', '🏛️', '🎓', '💼', '📦', '🐷', '🛟', '🎯'] },
];

/** Types de rentrées ponctuelles (fixes) */
export const INCOME_TYPES: Visual[] = [
  { id: 'prime', name: 'Prime/bonus', icon: '💼', color: '#7DD3AE' },
  { id: 'vente', name: 'Vente Vinted/Leboncoin', icon: '🏷️', color: '#7DD6E8' },
  { id: 'rembours', name: 'Remboursement', icon: '💸', color: '#C5E17A' },
  { id: 'cadeau', name: 'Cadeau', icon: '🎁', color: '#F4A6C8' },
  { id: 'aide', name: 'Aide/CAF', icon: '🏛️', color: '#8AB4F8' },
  { id: 'heures', name: 'Heures sup/extra', icon: '⏱️', color: '#FDD46B' },
  { id: 'autre', name: 'Autre', icon: '✨', color: '#C9A7F9' },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Mots-clés → icône pour les charges fixes (ordre = priorité) */
const GUESSES: [RegExp, string][] = [
  [/loyer|appart|logement/, '🏠'],
  [/credit|pret|emprunt|immo/, '🏦'],
  [/mutuelle|sante/, '🩺'],
  [/assurance|assu\b|maif|macif|matmut|axa|gmf/, '🛡️'],
  [/edf|electri|engie|totalenergies|enercoop/, '💡'],
  [/gaz|chauffage|fioul/, '🔥'],
  [/\beau\b|veolia|saur/, '💧'],
  [/box|internet|fibre|livebox|freebox|bbox|adsl/, '🌐'],
  [/forfait|mobile|telephone|portable|sosh|free mobile|bouygues|sfr|orange/, '📱'],
  [/netflix|canal|disney|prime video|molotov|\btv\b|television|ocs|max\b/, '📺'],
  [/spotify|deezer|musique|apple music/, '🎧'],
  [/impot|taxe|tresor/, '🏛️'],
  [/creche|nounou|garde|assistante mat|baby/, '👶'],
  [/cantine|ecole|scolar|etude/, '🏫'],
  [/sport|salle|gym|fitness|basic fit|club/, '🏋️'],
  [/icloud|cloud|google one|drive|dropbox/, '☁️'],
  [/voiture|auto|leasing|lld|loa/, '🚗'],
  [/navigo|transport|train|sncf|bus|metro|tcl|pass/, '🚆'],
  [/parking/, '🅿️'],
  [/epargne|livret|placement/, '🐷'],
  [/banque|frais bancaire|carte/, '💳'],
  [/chien|chat|veto|animal/, '🐶'],
  [/menage|aide a domicile/, '🧹'],
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

export const DEFAULT_ENVELOPES: Omit<Envelope, 'id'>[] = [
  { name: 'Courses', icon: '🛒', color: COLORS[0] },
  { name: 'Restos & sorties', icon: '🍽️', color: COLORS[1] },
  { name: 'Essence & transport', icon: '⛽', color: COLORS[2] },
  { name: 'Maison', icon: '🏠', color: COLORS[3] },
  { name: 'Loisirs', icon: '🎮', color: COLORS[4] },
  { name: 'Santé', icon: '💊', color: COLORS[5] },
  { name: 'Vêtements & shopping', icon: '👕', color: COLORS[6] },
  { name: 'Divers', icon: '📦', color: COLORS[8] },
];

export function defaultSettings(): Settings {
  const envelopes: Envelope[] = DEFAULT_ENVELOPES.map((e, i) => ({ ...e, id: `env-${i + 1}` }));
  const pots: Pot[] = [{ id: 'pot-1', name: 'Livret A', icon: '🐷', color: COLORS[7], goal: null, initial: 0 }];
  return {
    names: ['Moi', 'Ma femme'],
    envelopes,
    charges: [],
    pots,
    versions: {
      [monthOf(todayKey())]: { income: 0, charges: {}, envelopes: Object.fromEntries(envelopes.map((e) => [e.id, 0])) },
    },
    onboarded: false,
  };
}
