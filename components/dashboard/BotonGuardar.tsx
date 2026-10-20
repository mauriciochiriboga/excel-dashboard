"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUsuario } from "@/lib/supabase/useUsuario";
import { supabaseConfigurado } from "@/lib/supabase/cliente";
import { Boton } from "@/components/ui";

/** Guarda el archivo y el esquema en Supabase. Si ya es un dashboard guardado, actualiza el esquema. */
export function BotonGuardar() {
  const router = useRouter();
  const { usuario, cargando } = useUsuario();
  const hayDatos = useStore((s) => s.archivos.length > 0);
  const dashboardActual = useStore((s) => s.dashboardActual);
  const cambiosSinGuardar = useStore((s) => s.cambiosSinGuardar);
  const guardarActual = useStore((s) => s.guardarActual);
  const archivoActivo = useStore((s) => s.archivos.find((a) => a.id === s.archivoActivo));
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pidiendoTitulo, setPidiendoTitulo] = useState(false);
  const [titulo, setTitulo] = useState("");

  if (!supabaseConfigurado || !hayDatos || cargando) return null;
  if (dashboardActual && !dashboardActual.puedeEditar) return null;

  const ejecutar = async (t?: string) => {
    setEstado("guardando");
    setError(null);
    try {
      const id = await guardarActual(t);
      setEstado("ok");
      setTimeout(() => setEstado("idle"), 2000);
      if (!dashboardActual && id) router.push(`/d/${id}`);
    } catch (e) {
      setEstado("error");
      setError((e as Error).message);
    }
  };

  if (!usuario) {
    return (
      <Boton onClick={() => router.push(`/auth/entrar?siguiente=${encodeURIComponent(window.location.pathname)}`)} title="Inicia sesión para guardar y compartir">
        <Save size={16} /> Guardar
      </Boton>
    );
  }

  if (pidiendoTitulo) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          setPidiendoTitulo(false);
          void ejecutar(titulo.trim() || archivoActivo?.nombre || "Dashboard");
        }}
      >
        <input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título del dashboard"
          aria-label="Título del dashboard"
          className="w-48 rounded-md border border-borde bg-superficie px-2 py-1 text-sm"
        />
        <Boton type="submit" variante="primario">
          Guardar
        </Boton>
        <Boton type="button" variante="fantasma" onClick={() => setPidiendoTitulo(false)}>
          Cancelar
        </Boton>
      </form>
    );
  }

  const etiqueta = estado === "guardando" ? "Guardando…" : estado === "ok" ? "Guardado" : dashboardActual ? (cambiosSinGuardar ? "Guardar cambios" : "Guardado") : "Guardar";
  return (
    <div className="flex items-center gap-2">
      <Boton
        variante={dashboardActual && !cambiosSinGuardar ? "secundario" : "primario"}
        disabled={estado === "guardando" || (!!dashboardActual && !cambiosSinGuardar && estado !== "error")}
        onClick={() => {
          if (dashboardActual) void ejecutar();
          else {
            setTitulo(archivoActivo?.nombre.replace(/\.[^.]+$/, "") ?? "");
            setPidiendoTitulo(true);
          }
        }}
        title={dashboardActual ? "Guarda las correcciones y filtros actuales" : "Sube el archivo a tu cuenta para volver a abrirlo y compartirlo"}
      >
        {estado === "guardando" ? <Loader2 size={16} className="animate-spin" /> : estado === "ok" ? <Check size={16} /> : <Save size={16} />}
        {etiqueta}
      </Boton>
      {error && <span className="max-w-[240px] truncate text-xs text-negativo" title={error}>{error}</span>}
    </div>
  );
}
