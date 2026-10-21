"use client";
import { useEffect, useState } from "react";
import { Share2, Globe, Lock, Users, Copy, Check, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUsuario } from "@/lib/supabase/useUsuario";
import { actualizarDashboard, generarSlug } from "@/lib/supabase/dashboards";
import { listarEquipos, listarPermisos, compartirDashboard, quitarPermiso, type Equipo, type PermisoDashboard } from "@/lib/supabase/equipos";
import { Boton, Etiqueta, cx } from "@/components/ui";

/** Panel de compartir: visibilidad (privado / equipo / público), permisos por usuario y enlace público. */
export function Compartir() {
  const d = useStore((s) => s.dashboardActual);
  const setDashboardActual = useStore((s) => s.setDashboardActual);
  const { usuario } = useUsuario();
  const [abierto, setAbierto] = useState(false);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [permisos, setPermisos] = useState<PermisoDashboard[]>([]);
  const [correo, setCorreo] = useState("");
  const [nivel, setNivel] = useState<"lector" | "editor">("lector");
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const esPropietario = !!d && !!usuario && d.propietario_id === usuario.id;

  useEffect(() => {
    if (!abierto || !d || !esPropietario) return;
    listarEquipos().then(setEquipos).catch(() => setEquipos([]));
    listarPermisos(d.id).then(setPermisos).catch(() => setPermisos([]));
  }, [abierto, d, esPropietario]);

  if (!d || !esPropietario) return null;

  const urlPublica = d.publico_slug ? `${window.location.origin}/p/${d.publico_slug}` : null;

  const cambiar = async (cambios: Parameters<typeof actualizarDashboard>[1]) => {
    try {
      setError(null);
      await actualizarDashboard(d.id, cambios);
      setDashboardActual({ ...d, ...cambios } as typeof d);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setVisibilidad = (v: "privado" | "equipo" | "publico") => {
    if (v === "publico") return void cambiar({ visibilidad: v, publico_slug: d.publico_slug ?? generarSlug(d.titulo) });
    if (v === "equipo") return void cambiar({ visibilidad: v, equipo_id: d.equipo_id ?? equipos[0]?.id ?? null });
    void cambiar({ visibilidad: v });
  };

  return (
    <div className="relative">
      <Boton onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <Share2 size={16} /> Compartir
      </Boton>
      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-40 mt-1 w-[min(92vw,380px)] rounded-lg border border-borde bg-superficie p-4 text-sm shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Compartir «{d.titulo}»</h3>
              <button aria-label="Cerrar" onClick={() => setAbierto(false)} className="text-texto-suave"><X size={16} /></button>
            </div>

            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-xs uppercase tracking-wide text-texto-suave">Quién puede verlo</legend>
              {(
                [
                  ["privado", Lock, "Privado", "Solo tú y las personas con permiso explícito"],
                  ["equipo", Users, "Mi equipo", "Todos los miembros del equipo elegido"],
                  ["publico", Globe, "Público con enlace", "Cualquiera con el enlace, sin iniciar sesión"],
                ] as const
              ).map(([v, I, t, desc]) => (
                <label key={v} className={cx("flex cursor-pointer items-start gap-2 rounded-md border p-2", d.visibilidad === v ? "border-acento bg-acento-suave" : "border-borde")}>
                  <input type="radio" name="visibilidad" value={v} checked={d.visibilidad === v} onChange={() => setVisibilidad(v)} className="mt-1" />
                  <span>
                    <span className="flex items-center gap-1 font-medium"><I size={14} /> {t}</span>
                    <span className="text-xs text-texto-suave">{desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {d.visibilidad === "equipo" && (
              <label className="mt-2 flex items-center gap-2">
                Equipo
                {equipos.length === 0 ? (
                  <span className="text-xs text-texto-suave">No perteneces a ningún equipo todavía.</span>
                ) : (
                  <select value={d.equipo_id ?? ""} onChange={(e) => void cambiar({ equipo_id: e.target.value || null })} className="flex-1 rounded-md border border-borde bg-fondo px-2 py-1">
                    {equipos.map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                    ))}
                  </select>
                )}
              </label>
            )}

            {d.visibilidad === "publico" && urlPublica && (
              <div className="mt-2 flex items-center gap-1">
                <input readOnly value={urlPublica} className="min-w-0 flex-1 rounded-md border border-borde bg-fondo px-2 py-1 text-xs" aria-label="Enlace público" onFocus={(e) => e.currentTarget.select()} />
                <Boton
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(urlPublica);
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 1500);
                    } catch {
                      /* el usuario puede copiar a mano */
                    }
                  }}
                >
                  {copiado ? <Check size={14} /> : <Copy size={14} />}
                </Boton>
              </div>
            )}

            <div className="mt-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-texto-suave">Personas con acceso</p>
              <ul className="mb-2 flex flex-col gap-1">
                {permisos.length === 0 && <li className="text-xs text-texto-suave">Nadie más por ahora.</li>}
                {permisos.map((p) => (
                  <li key={p.usuario_id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{p.perfil?.nombre ?? p.perfil?.correo}</span>
                    <Etiqueta tono={p.nivel === "editor" ? "acento" : "neutro"}>{p.nivel}</Etiqueta>
                    <button aria-label="Quitar acceso" onClick={() => void quitarPermiso(d.id, p.usuario_id).then(() => listarPermisos(d.id).then(setPermisos))} className="text-texto-suave hover:text-negativo"><X size={14} /></button>
                  </li>
                ))}
              </ul>
              <form
                className="flex flex-wrap items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!correo.trim()) return;
                  compartirDashboard(d.id, correo, nivel)
                    .then(() => {
                      setCorreo("");
                      setError(null);
                      return listarPermisos(d.id).then(setPermisos);
                    })
                    .catch((err) => setError((err as Error).message));
                }}
              >
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@empresa.com" aria-label="Correo" className="min-w-0 flex-1 rounded-md border border-borde bg-fondo px-2 py-1" />
                <select value={nivel} onChange={(e) => setNivel(e.target.value as "lector" | "editor")} className="rounded-md border border-borde bg-fondo px-2 py-1" aria-label="Nivel">
                  <option value="lector">Lector</option>
                  <option value="editor">Editor</option>
                </select>
                <Boton type="submit" variante="primario">Dar acceso</Boton>
              </form>
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-negativo">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
