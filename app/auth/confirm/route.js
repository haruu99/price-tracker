import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (!code) {
    const missingCodeUrl = new URL("/", origin);
    missingCodeUrl.searchParams.set("kind", "error");
    missingCodeUrl.searchParams.set("message", "The sign-in link is incomplete or expired.");
    return NextResponse.redirect(missingCodeUrl);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const missingEnvUrl = new URL("/", origin);
    missingEnvUrl.searchParams.set("kind", "error");
    missingEnvUrl.searchParams.set("message", "Supabase auth is not configured yet.");
    return NextResponse.redirect(missingEnvUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const errorUrl = new URL("/", origin);
    errorUrl.searchParams.set("kind", "error");
    errorUrl.searchParams.set("message", error.message || "The sign-in link expired. Try again.");
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL(next, origin));
}
