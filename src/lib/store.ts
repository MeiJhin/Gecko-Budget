import { useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Settings, Tx } from './types';
import { supabase } from './supabase';
import { normalizeSettings } from './settings';
import { defaultSettings } from './defaults';

/* =====================================================================
 *  Le magasin de données de l'appli.
 *  - Tout est d'abord écrit sur le téléphone (cache + file d'attente),
 *    puis envoyé à Supabase dès que le réseau est là.
 *  - Les changements faits par l'autre téléphone arrivent en temps réel.
 * ===================================================================== */

type Op = { t: 'upsert'; tx: Tx } | { t: 'delete'; id: string } | { t: 'settings'; settings: Settings };

export interface StoreState {
  ready: boolean;
  householdId: string | null;
  settings: Settings;
  txs: Tx[];
  /** opérations pas encore envoyées */
  pending: number;
  online: boolean;
  lastError: string | null;
}

const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* stockage plein ou bloqué : on continue en mémoire */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const sortTxs = (txs: Tx[]) =>
  [...txs].sort((a, b) => (a.date === b.date ? (b.created_at > a.created_at ? 1 : -1) : a.date < b.date ? 1 : -1));

function applyOps(settings: Settings, txs: Tx[], ops: Op[]) {
  const map = new Map(txs.map((t) => [t.id, t]));
  let s = settings;
  for (const op of ops) {
    if (op.t === 'upsert') map.set(op.tx.id, op.tx);
    else if (op.t === 'delete') map.delete(op.id);
    else s = op.settings;
  }
  return { settings: s, txs: sortTxs([...map.values()]) };
}

const isNetworkError = (e: unknown) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = String((e as { message?: string })?.message ?? e);
  return /fetch|network|load failed|timeout|abort|connexion/i.test(msg);
};

const rowToTx = (r: Record<string, unknown>): Tx => ({
  id: String(r.id),
  kind: r.kind as Tx['kind'],
  amount: Number(r.amount),
  category: String(r.category),
  person: Number(r.person) === 2 ? 2 : 1,
  date: String(r.date).slice(0, 10),
  note: String(r.note ?? ''),
  created_at: String(r.created_at ?? ''),
  updated_at: String(r.updated_at ?? ''),
});

class Store {
  state: StoreState = {
    ready: false,
    householdId: null,
    settings: defaultSettings(),
    txs: [],
    pending: 0,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastError: null,
  };
  private listeners = new Set<() => void>();
  private server: { settings: Settings; txs: Tx[] } = { settings: defaultSettings(), txs: [] };
  private queue: Op[] = [];
  private flushing = false;
  private channel: RealtimeChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private demo = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getState = () => this.state;
  private set(p: Partial<StoreState>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  }

  private k = (name: string) => `gb:${name}:${this.state.householdId}`;

  /** Recalcule l'état affiché = données serveur + opérations en attente */
  private recompute() {
    const { settings, txs } = applyOps(this.server.settings, this.server.txs, this.queue);
    this.set({ settings, txs, pending: this.queue.length });
    LS.set(this.k('cache'), this.server);
    LS.set(this.k('queue'), this.queue);
  }

  /* ------------------------------------------------------------------ */

  /** Ouvre un foyer : cache local d'abord, puis synchronisation. */
  async open(householdId: string, opts: { demo?: boolean } = {}) {
    this.close();
    this.demo = !!opts.demo;
    this.state.householdId = householdId;
    const cache = LS.get<{ settings: unknown; txs: Tx[] } | null>(this.k('cache'), null);
    this.server = cache ? { settings: normalizeSettings(cache.settings), txs: cache.txs ?? [] } : { settings: defaultSettings(), txs: [] };
    this.queue = LS.get<Op[]>(this.k('queue'), []);
    this.recompute();
    this.set({ ready: !!cache || this.demo, lastError: null });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
      document.addEventListener('visibilitychange', this.onVisible);
      window.addEventListener('storage', this.onStorage);
    }
    if (this.demo) {
      // en démo, la « base » est le cache local : tout est déjà synchronisé
      this.server = applyOps(this.server.settings, this.server.txs, this.queue);
      this.queue = [];
      this.recompute();
      this.set({ ready: true });
      return;
    }
    this.timer = setInterval(() => this.flush(), 30_000);
    this.subscribeRealtime();
    await this.flush();
    await this.refresh();
  }

  close() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
      document.removeEventListener('visibilitychange', this.onVisible);
      window.removeEventListener('storage', this.onStorage);
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.channel && supabase) supabase.removeChannel(this.channel);
    this.channel = null;
    this.state = { ...this.state, ready: false, householdId: null, txs: [], pending: 0 };
  }

  private onOnline = () => {
    this.set({ online: true });
    this.flush().then(() => this.refresh());
  };
  private onOffline = () => this.set({ online: false });
  private onVisible = () => {
    if (document.visibilityState === 'visible' && !this.demo) this.flush().then(() => this.refresh());
  };
  /** Mode démo : synchronise deux onglets du même navigateur */
  private onStorage = (e: StorageEvent) => {
    if (!this.demo || e.key !== this.k('cache') || !e.newValue) return;
    const c = JSON.parse(e.newValue);
    this.server = { settings: normalizeSettings(c.settings), txs: c.txs ?? [] };
    const { settings, txs } = applyOps(this.server.settings, this.server.txs, this.queue);
    this.set({ settings, txs });
  };

  /** Recharge tout depuis Supabase */
  async refresh() {
    if (!supabase || this.demo || !this.state.householdId) return;
    const hid = this.state.householdId;
    try {
      const { data: h, error: e1 } = await supabase.from('households').select('settings').eq('id', hid).single();
      if (e1) throw e1;
      const all: Tx[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id,kind,amount,category,person,date,note,created_at,updated_at')
          .eq('household_id', hid)
          .order('date', { ascending: false })
          .order('id')
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []).map(rowToTx));
        if (!data || data.length < 1000) break;
      }
      if (hid !== this.state.householdId) return;
      this.server = { settings: normalizeSettings(h?.settings), txs: all };
      this.recompute();
      this.set({ ready: true, online: true, lastError: null });
    } catch (e) {
      if (isNetworkError(e)) this.set({ online: false, ready: true });
      else this.set({ lastError: String((e as Error).message ?? e), ready: true });
    }
  }

  private subscribeRealtime() {
    if (!supabase || !this.state.householdId) return;
    const hid = this.state.householdId;
    const onTx = (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      if (payload.eventType === 'DELETE') {
        const id = String(payload.old?.id ?? '');
        if (!this.server.txs.some((t) => t.id === id)) return;
        this.server.txs = this.server.txs.filter((t) => t.id !== id);
      } else {
        const tx = rowToTx(payload.new);
        this.server.txs = sortTxs([...this.server.txs.filter((t) => t.id !== tx.id), tx]);
      }
      this.recompute();
    };
    this.channel = supabase
      .channel(`foyer-${hid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `household_id=eq.${hid}` }, onTx)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `household_id=eq.${hid}` }, onTx)
      // les suppressions ne peuvent pas être filtrées : on ignore celles qu'on ne connaît pas
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, onTx)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${hid}` }, (p) => {
        this.server.settings = normalizeSettings((p.new as { settings?: unknown }).settings);
        this.recompute();
      })
      .subscribe((status) => {
        // après une coupure, on recharge pour ne rien rater
        if (status === 'SUBSCRIBED') this.refresh();
      });
  }

  /** Envoie la file d'attente, dans l'ordre */
  async flush() {
    if (this.flushing || !supabase || this.demo || !this.state.householdId) return;
    this.flushing = true;
    const hid = this.state.householdId;
    try {
      while (this.queue.length) {
        const op = this.queue[0];
        let error: unknown = null;
        if (op.t === 'upsert') {
          const { tx } = op;
          ({ error } = await supabase.from('transactions').upsert({
            id: tx.id,
            household_id: hid,
            kind: tx.kind,
            amount: tx.amount,
            category: tx.category,
            person: tx.person,
            date: tx.date,
            note: tx.note,
            created_at: tx.created_at || new Date().toISOString(),
          }));
        } else if (op.t === 'delete') {
          ({ error } = await supabase.from('transactions').delete().eq('id', op.id));
        } else {
          ({ error } = await supabase.from('households').update({ settings: op.settings }).eq('id', hid));
        }
        if (error) {
          if (isNetworkError(error)) {
            this.set({ online: false });
            return;
          }
          // erreur définitive (droits, données invalides) : on l'abandonne pour ne pas bloquer la file
          this.set({ lastError: String((error as Error).message ?? error) });
        } else {
          // l'opération est acceptée : on l'intègre aux données « serveur »
          this.server = applyOps(this.server.settings, this.server.txs, [op]);
          this.set({ online: true });
        }
        this.queue.shift();
        this.recompute();
      }
    } catch (e) {
      if (isNetworkError(e)) this.set({ online: false });
    } finally {
      this.flushing = false;
    }
  }

  private push(...ops: Op[]) {
    if (this.demo) {
      this.server = applyOps(this.server.settings, this.server.txs, ops);
      this.recompute();
      return;
    }
    this.queue.push(...ops);
    this.recompute();
    void this.flush();
  }

  /* --------------------------- Actions ------------------------------ */

  saveTx(tx: Tx) {
    const now = new Date().toISOString();
    this.push({ t: 'upsert', tx: { ...tx, created_at: tx.created_at || now, updated_at: now } });
  }
  deleteTx(id: string) {
    this.push({ t: 'delete', id });
  }
  saveSettings(settings: Settings) {
    this.push({ t: 'settings', settings });
  }
  /** Import d'une sauvegarde : ajoute / remplace les opérations par leur identifiant */
  importData(settings: Settings | null, txs: Tx[]) {
    const ops: Op[] = txs.map((tx) => ({ t: 'upsert', tx }));
    if (settings) ops.unshift({ t: 'settings', settings });
    this.push(...ops);
  }
  clearLocal() {
    if (!this.state.householdId) return;
    LS.del(this.k('cache'));
    LS.del(this.k('queue'));
  }
}

export const store = new Store();

export function useStore(): StoreState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
