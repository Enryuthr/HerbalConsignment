import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

function projectUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export const supabase = hasSupabaseConfig ? createClient(projectUrl(supabaseUrl), supabaseAnonKey) : null;
