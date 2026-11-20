import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Nettoie une valeur collée : espaces, guillemets, « NOM= » copié avec */
const clean = (v: unknown) =>
  typeof v === 'string' ? v.trim().replace(/^[A-Z_]+=/, '').replace(/^["']|["']$/g, '').trim() : '';

/** Ne garde que « https://xxxx.supabase.co », même si on a collé /rest/v1/ ou une barre finale */
export function cleanUrl(v: unknown): string {
  const t = clean(v);
  if (!t) return '';
  // lien du tableau de bord collé par erreur : supabase.com/dashboard/project/<ref>
  const dash = t.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  try {
    return new URL(/^https?:\/\//.test(t) ? t : `https://${t}`).origin;
  } catch {
    return t.replace(/\/+$/, '');
  }
}

const url = cleanUrl(import.meta.env.VITE_SUPABASE_URL);
const key = clean(import.meta.env.VITE_SUPABASE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

/** null = pas de Supabase configuré → mode démo (données sur cet appareil uniquement) */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'gecko-budget-auth' },
        realtime: { params: { eventsPerSecond: 5 } },
      })
    : null;

export const isDemo = supabase === null;
