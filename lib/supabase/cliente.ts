"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let instancia: SupabaseClient | null = null;

/** Cliente Supabase para componentes de cliente (singleton). */
export function supabaseCliente(): SupabaseClient {
  if (!instancia) {
    instancia = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return instancia;
}

export const supabaseConfigurado = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
