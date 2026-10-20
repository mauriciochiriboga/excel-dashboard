import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";

/** Intercambia el código del enlace de confirmación o recuperación por una sesión. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const siguiente = url.searchParams.get("siguiente") ?? "/mis-dashboards";
  if (code) {
    const sb = await supabaseServidor();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(siguiente, url.origin));
  }
  return NextResponse.redirect(new URL("/auth/entrar?error=enlace", url.origin));
}
