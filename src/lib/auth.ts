import { L } from './i18n';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Settings } from './types';

/** Traduit les messages d'erreur de Supabase en français simple */
export function frError(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e ?? '');
  if (/invalid login credentials/i.test(m)) return L('E-mail ou mot de passe incorrect.', 'Wrong e-mail or password.');
  if (/email not confirmed/i.test(m)) return L("Confirmez d'abord votre adresse : cliquez sur le lien reçu par e-mail.", 'Please confirm your address first: click the link in the e-mail you received.');
  if (/already registered|already been registered|user_already_exists/i.test(m)) return L('Un compte existe déjà avec cet e-mail : connectez-vous.', 'An account already exists with this e-mail: please sign in.');
  if (/password should be at least|weak/i.test(m)) return L('Mot de passe trop court : 8 caractères minimum.', 'Password too short: 8 characters minimum.');
  if (/rate limit|too many|over_email_send_rate_limit/i.test(m)) return L('Trop de tentatives : réessayez dans quelques minutes.', 'Too many attempts: try again in a few minutes.');
  if (/invalid.*email|unable to validate email/i.test(m)) return L("Cette adresse e-mail n'a pas l'air valide.", "This e-mail address doesn't look valid.");
  if (/CODE_INCONNU/.test(m)) return L('Code inconnu : vérifiez les 6 caractères.', 'Unknown code: check the 6 characters.');
  if (/FOYER_COMPLET/.test(m)) return L('Ce foyer a déjà ses deux membres.', 'This household already has its two members.');
  if (/DEJA_DANS_UN_FOYER/.test(m)) return L('Ce compte fait déjà partie d’un autre foyer.', 'This account already belongs to another household.');
  if (/FOYER_NON_VIDE/.test(m)) return L('Votre foyer contient déjà des opérations : impossible de le quitter.', 'Your household already has transactions: you can’t leave it.');
  if (/FOYER_PARTAGE/.test(m)) return L('Votre foyer est déjà partagé : impossible de le quitter.', 'Your household is already shared: you can’t leave it.');
  if (/fetch|network|load failed/i.test(m)) return L('Pas de connexion internet. Réessayez quand le réseau revient.', 'No internet connection. Try again when you’re back online.');
  return m || L('Une erreur est survenue.', 'Something went wrong.');
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, loading, recovery, endRecovery: () => setRecovery(false) };
}

const sb = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};
const redirect = () => window.location.origin + window.location.pathname;

export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Renvoie true si un e-mail de confirmation a été envoyé */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await sb().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect() } });
  if (error) throw error;
  if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('already registered');
  return !data.session;
}

export async function resetPassword(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await sb().auth.signOut();
}

const hidKey = (uid: string) => `gb:hid:${uid}`;

/** Foyer de l'utilisateur (mémorisé sur le téléphone pour marcher hors connexion) */
export async function findHousehold(uid: string): Promise<string | null> {
  const cached = localStorage.getItem(hidKey(uid));
  try {
    const { data, error } = await sb().from('household_members').select('household_id').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    const hid = (data?.household_id as string | undefined) ?? null;
    if (hid) localStorage.setItem(hidKey(uid), hid);
    else localStorage.removeItem(hidKey(uid));
    return hid;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}

export async function createHousehold(uid: string, settings: Settings): Promise<string> {
  const { data, error } = await sb().rpc('create_household', { initial_settings: settings });
  if (error) throw error;
  localStorage.setItem(hidKey(uid), data as string);
  return data as string;
}

export async function joinHousehold(uid: string, code: string): Promise<string> {
  const { data, error } = await sb().rpc('join_household', { code: code.trim().toUpperCase() });
  if (error) throw error;
  localStorage.setItem(hidKey(uid), data as string);
  return data as string;
}

export async function leaveEmptyHousehold() {
  const { error } = await sb().rpc('leave_empty_household');
  if (error) throw error;
  const { data } = await sb().auth.getSession();
  if (data.session) localStorage.removeItem(hidKey(data.session.user.id));
}

export async function householdInfo(hid: string): Promise<{ code: string; members: number } | null> {
  const [{ data: h }, { count }] = await Promise.all([
    sb().from('households').select('invite_code').eq('id', hid).maybeSingle(),
    sb().from('household_members').select('user_id', { count: 'exact', head: true }).eq('household_id', hid),
  ]);
  if (!h) return null;
  return { code: h.invite_code as string, members: count ?? 1 };
}
