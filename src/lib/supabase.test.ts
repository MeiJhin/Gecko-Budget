import { describe, expect, it } from 'vitest';
import { cleanUrl } from './supabase';

describe('adresse Supabase collée', () => {
  it.each([
    'https://abcd.supabase.co',
    'https://abcd.supabase.co/',
    'https://abcd.supabase.co/rest/v1/',
    ' "https://abcd.supabase.co/rest/v1" ',
    'NEXT_PUBLIC_SUPABASE_URL=https://abcd.supabase.co',
    'abcd.supabase.co',
    'https://supabase.com/dashboard/project/abcd/settings/api',
  ])('%s', (v) => expect(cleanUrl(v)).toBe('https://abcd.supabase.co'));
});
