import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "./supabase-config.js";

let supabaseAdmin;

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseAdmin;
}
