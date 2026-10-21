"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Users, LayoutGrid, UserCog } from "lucide-react";
import { useUsuario, type Perfil } from "@/lib/supabase/useUsuario";
import { supabaseCliente } from "@/lib/supabase/cliente";
import { listarDashboards, borrarDashboard, obtenerDashboard, type DashboardResumen } from "@/lib/supabase/dashboards";
import { listarEquipos, borrarEquipo, type Equipo } from "@/lib/supabase/equipos";
import { Boton, Etiqueta, Tarjeta, Vacio, cx } from "@/components/ui";
import { fmtBytes, fmtFecha } from "@/lib/formato";

type Seccion = "usuarios" | "equipos" | "dashboards";

/** Panel de administración global: solo para perfiles con rol_global = admin. */
export function PanelAdmin() {
  const { usuario, perfil, cargando, esAdmin } = useUsuario();
  const [seccion, setSeccion] = useState<Seccion>("usuarios");
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [dashboards, setDashboards] = useState<DashboardResumen[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recargar = async () => {
    try {
      setError(null);
      const sb = supabaseCliente();
      const { data, error: e } = await sb.from("perfiles").select("id, correo, nombre, rol_global, activo, creado_en").order("creado_en");
      if (e) throw new Error(e.message);
      setPerfiles((data ?? []) as Perfil[]);
      setEquipos(await listarEquipos());
      setDashboards(await listarDashboards());
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (esAdmin) void recargar();
  }, [esAdmin]);

  if (cargando) return <p className="text-sm text-texto-suave">Cargando…</p>;
  if (!usuario) return <Vacio titulo="Inicia sesión" />;
  if (!esAdmin) {
    return (
      <Vacio
        titulo="403 · Acceso restringido"
        detalle={`Esta sección es solo para administradores. Tu cuenta (${perfil?.correo ?? usuario.email}) tiene rol de usuario.`}
      />
    );
  }

  const cambiarPerfil = async (id: string, cambios: Partial<Perfil>) => {
    const { error: e } = await supabaseCliente().from("perfiles").update(cambios).eq("id", id);
    if (e) setError(e.message);
    else void recargar();
  };

  const tabs: { v: Seccion; t: string; I: typeof Users; n: number }[] = [
    { v: "usuarios", t: "Usuarios", I: UserCog, n: perfiles.length },
    { v: "equipos", t: "Equipos", I: Users, n: equipos.length },
    { v: "dashboards", t: "Dashboards", I: LayoutGrid, n: dashboards.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <Shield size={20} className="text-acento" /> Administración
      </h1>
      <nav className="flex gap-1 border-b border-borde">
        {tabs.map(({ v, t, I, n }) => (
          <button
            key={v}
            onClick={() => setSeccion(v)}
            className={cx("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm", seccion === v ? "border-acento font-medium text-acento" : "border-transparent text-texto-suave hover:text-texto")}
          >
            <I size={15} /> {t} <span className="rounded-full bg-superficie-2 px-1.5 text-xs">{n}</span>
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="rounded-md bg-negativo/10 px-3 py-2 text-sm text-negativo">
          {error}
        </p>
      )}

      {seccion === "usuarios" && (
        <Tarjeta>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-texto-suave">
                <tr className="border-b border-borde">
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Correo</th>
                  <th className="py-2 pr-3 font-medium">Rol global</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium">Alta</th>
                </tr>
              </thead>
              <tbody>
                {perfiles.map((p) => (
                  <tr key={p.id} className="border-b border-borde/60 last:border-0">
                    <td className="py-2 pr-3">{p.nombre ?? "—"}{p.id === usuario.id && <span className="text-texto-suave"> (tú)</span>}</td>
                    <td className="py-2 pr-3">{p.correo}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={p.rol_global}
                        disabled={p.id === usuario.id}
                        onChange={(e) => void cambiarPerfil(p.id, { rol_global: e.target.value as Perfil["rol_global"] })}
                        className="rounded-md border border-borde bg-superficie px-2 py-1"
                        aria-label={`Rol de ${p.correo}`}
                      >
                        <option value="usuario">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        disabled={p.id === usuario.id}
                        onClick={() => void cambiarPerfil(p.id, { activo: !p.activo })}
                        title={p.activo ? "Desactivar cuenta" : "Reactivar cuenta"}
                        className="disabled:opacity-50"
                      >
                        <Etiqueta tono={p.activo ? "positivo" : "negativo"}>{p.activo ? "Activa" : "Desactivada"}</Etiqueta>
                      </button>
                    </td>
                    <td className="py-2 text-texto-suave">{fmtFecha(new Date((p as Perfil & { creado_en: string }).creado_en))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-texto-suave">
            El primer usuario registrado es administrador. Un administrador no puede cambiar su propio rol ni desactivarse. Una cuenta desactivada conserva sus datos pero pierde acceso a lo compartido.
          </p>
        </Tarjeta>
      )}

      {seccion === "equipos" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {equipos.length === 0 && <Vacio titulo="No hay equipos" />}
          {equipos.map((eq) => (
            <Tarjeta key={eq.id} titulo={eq.nombre} accion={<Boton variante="peligro" onClick={() => void borrarEquipo(eq.id).then(recargar).catch((e) => setError((e as Error).message))}>Borrar</Boton>}>
              <ul className="text-sm">
                {eq.miembros?.map((m) => (
                  <li key={m.usuario_id} className="flex justify-between gap-2 py-0.5">
                    <span className="truncate">{m.perfil?.nombre ?? m.perfil?.correo}</span>
                    <Etiqueta tono={m.rol === "propietario" ? "acento" : "neutro"}>{m.rol}</Etiqueta>
                  </li>
                ))}
                {eq.invitaciones?.map((i) => (
                  <li key={i.id} className="py-0.5 text-texto-suave">{i.correo} · pendiente</li>
                ))}
              </ul>
            </Tarjeta>
          ))}
        </div>
      )}

      {seccion === "dashboards" && (
        <Tarjeta>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-texto-suave">
                <tr className="border-b border-borde">
                  <th className="py-2 pr-3 font-medium">Título</th>
                  <th className="py-2 pr-3 font-medium">Propietario</th>
                  <th className="py-2 pr-3 font-medium">Visibilidad</th>
                  <th className="py-2 pr-3 font-medium">Archivo</th>
                  <th className="py-2 pr-3 font-medium">Actualizado</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {dashboards.map((d) => (
                  <tr key={d.id} className="border-b border-borde/60 last:border-0">
                    <td className="py-2 pr-3"><Link href={`/d/${d.id}`} className="hover:text-acento">{d.titulo}</Link></td>
                    <td className="py-2 pr-3">{d.propietario?.nombre ?? d.propietario?.correo}</td>
                    <td className="py-2 pr-3"><Etiqueta tono={d.visibilidad === "publico" ? "positivo" : d.visibilidad === "equipo" ? "acento" : "neutro"}>{d.visibilidad}</Etiqueta></td>
                    <td className="py-2 pr-3 text-texto-suave">{d.archivo_nombre} · {fmtBytes(d.archivo_tamano)}</td>
                    <td className="py-2 pr-3 text-texto-suave">{fmtFecha(new Date(d.actualizado_en))}</td>
                    <td className="py-2">
                      <Boton variante="peligro" onClick={() => void obtenerDashboard(d.id).then(borrarDashboard).then(recargar).catch((e) => setError((e as Error).message))}>Borrar</Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
