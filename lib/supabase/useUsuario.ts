"use client";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabaseCliente, supabaseConfigurado } from "./cliente";

export interface Perfil {
  id: string;
  correo: string;
  nombre: string | null;
  rol_global: "admin" | "usuario";
  activo: boolean;
}

/** Usuario autenticado y su perfil; null si no hay sesión. `cargando` mientras se resuelve. */
export function useUsuario() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(supabaseConfigurado);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    const sb = supabaseCliente();
    let activo = true;
    const cargarPerfil = async (u: User | null) => {
      if (!u) {
        setPerfil(null);
        return;
      }
      const { data } = await sb.from("perfiles").select("id, correo, nombre, rol_global, activo").eq("id", u.id).maybeSingle();
      if (activo) setPerfil((data as Perfil | null) ?? null);
    };
    sb.auth.getUser().then(async ({ data }: { data: { user: User | null } }) => {
      if (!activo) return;
      setUsuario(data.user);
      await cargarPerfil(data.user);
      setCargando(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e: AuthChangeEvent, sesion: Session | null) => {
      const u = sesion?.user ?? null;
      setUsuario(u);
      void cargarPerfil(u);
    });
    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { usuario, perfil, cargando, esAdmin: perfil?.rol_global === "admin" };
}
