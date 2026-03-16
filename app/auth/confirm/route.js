import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/supabase-config";

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

  const config = getPublicSupabaseConfig({ optional: true });
  if (!config) {
    const missingEnvUrl = new URL("/", origin);
    missingEnvUrl.searchParams.set("kind", "error");
    missingEnvUrl.searchParams.set("message", "Supabase auth is not configured yet.");
    return NextResponse.redirect(missingEnvUrl);
  }

  const redirectUrl = new URL(next, origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const errorUrl = new URL("/", origin);
    errorUrl.searchParams.set("kind", "error");
    errorUrl.searchParams.set("message", error.message || "The sign-in link expired. Try again.");
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
