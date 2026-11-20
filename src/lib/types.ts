/** Montants : toujours en centimes (entiers) pour éviter les erreurs d'arrondi. */
export type Cents = number;
export type Person = 1 | 2;
export type Kind = 'expense' | 'income' | 'saving';
/** 'YYYY-MM' */
export type MonthKey = string;
/** 'YYYY-MM-DD' */
export type DateKey = string;

export interface Tx {
  id: string;
  kind: Kind;
  /** Dépense / rentrée : positif. Épargne : positif = versement, négatif = retrait. */
  amount: Cents;
  /** id d'enveloppe (dépense), de type de rentrée (rentrée) ou de cagnotte (épargne) */
  category: string;
  person: Person;
  date: DateKey;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Visual {
  id: string;
  name: string;
  icon: string;
  color: string;
  archived?: boolean;
}

export interface Envelope extends Visual {}

export interface Charge extends Visual {
  /** l'icône est encore devinée d'après le nom */
  iconAuto: boolean;
  /** jour de prélèvement 1-31, facultatif */
  day: number | null;
}

export interface Pot extends Visual {
  goal: Cents | null;
  /** « Déjà » : solde de départ */
  initial: Cents;
}

/** Montants du budget en vigueur à partir d'un mois donné */
export interface BudgetVersion {
  income: Cents;
  charges: Record<string, Cents>;
  envelopes: Record<string, Cents>;
}

export interface Settings {
  names: [string, string];
  envelopes: Envelope[];
  charges: Charge[];
  pots: Pot[];
  /** clé = premier mois où ces montants s'appliquent */
  versions: Record<MonthKey, BudgetVersion>;
  onboarded: boolean;
}

export interface AppData {
  settings: Settings;
  txs: Tx[];
}
