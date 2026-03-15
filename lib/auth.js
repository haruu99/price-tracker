import { redirect } from "next/navigation";
import { ensureProfile } from "./db.js";
import { createSupabaseServerClient } from "./supabase-server.js";

function buildAuthRedirect(message) {
  const params = new URLSearchParams({
    kind: "error",
    message
  });

  return `/?${params.toString()}`;
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }

  return data.user ?? null;
}

export async function getCurrentAccount() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const profile = await ensureProfile({
    userId: user.id,
    email: user.email || ""
  });

  return {
    user,
    profile
  };
}

export async function requireCurrentAccount() {
  const account = await getCurrentAccount();
  if (!account) {
    redirect(buildAuthRedirect("Sign in to access your dashboard."));
  }

  return account;
}
