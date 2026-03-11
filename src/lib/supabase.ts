import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase 환경변수가 세팅되어 있는지 여부 */
export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseKey &&
    supabaseUrl !== 'your-supabase-url' &&
    supabaseKey !== 'your-supabase-anon-key');

export const supabase = createClient(
  supabaseUrl  ?? 'https://placeholder.supabase.co',
  supabaseKey  ?? 'placeholder-key',
);
