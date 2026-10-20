"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Globe, Lock, Users, Trash2, Pencil, ExternalLink } from "lucide-react";
import { listarDashboards, borrarDashboard, actualizarDashboard, obtenerDashboard, type DashboardResumen } from "@/lib/supabase/dashboards";
import { useUsuario } from "@/lib/supabase/useUsuario";
import { Boton, Etiqueta, Tarjeta, Vacio } from "@/components/ui";
import { fmtBytes, fmtFecha } from "@/lib/formato";

export function ListaDashboards() {
  const { usuario, cargando } = useUsuario();
  const [lista, setLista] = useState<DashboardResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = () => listarDashboards().then(setLista).catch((e) => setError((e as Error).message));
  useEffect(() => {
    if (usuario) void recargar();
  }, [usuario]);

  if (cargando) return <p className="text-sm text-texto-suave">Cargando…</p>;
  if (!usuario) return <Vacio titulo="Inicia sesión para ver tus dashboards" />;
  if (error) return <Vacio titulo="No se pudieron cargar los dashboards" detalle={error} />;
  if (!lista) return <p className="text-sm text-texto-suave">Cargando…</p>;

  const mios = lista.filter((d) => d.propietario_id === usuario.id);
  const compartidos = lista.filter((d) => d.propietario_id !== usuario.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Mis dashboards</h1>
        <Link href="/" className="rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-white dark:text-fondo">
          Nuevo dashboard
        </Link>
      </div>
      {lista.length === 0 && (
        <Vacio titulo="Todavía no has guardado ningún dashboard" detalle="Analiza un archivo en la página principal y pulsa «Guardar»." />
      )}
      {mios.length > 0 && <Grupo titulo="Creados por mí" items={mios} usuarioId={usuario.id} onCambio={recargar} />}
      {compartidos.length > 0 && <Grupo titulo="Compartidos conmigo" items={compartidos} usuarioId={usuario.id} onCambio={recargar} />}
    </div>
  );
}

function Grupo({ titulo, items, usuarioId, onCambio }: { titulo: string; items: DashboardResumen[]; usuarioId: string; onCambio: () => void }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-texto-suave">{titulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => (
          <TarjetaDashboard key={d.id} d={d} esMio={d.propietario_id === usuarioId} onCambio={onCambio} />
        ))}
      </div>
    </section>
  );
}

function TarjetaDashboard({ d, esMio, onCambio }: { d: DashboardResumen; esMio: boolean; onCambio: () => void }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(d.titulo);
  const [confirmando, setConfirmando] = useState(false);
  const Vis = d.visibilidad === "publico" ? Globe : d.visibilidad === "equipo" ? Users : Lock;
  const visTexto = d.visibilidad === "publico" ? "Público" : d.visibilidad === "equipo" ? `Equipo${d.equipo?.nombre ? `: ${d.equipo.nombre}` : ""}` : "Privado";

  return (
    <Tarjeta className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        {editando ? (
          <form
            className="flex flex-1 items-center gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              await actualizarDashboard(d.id, { titulo: titulo.trim() || d.titulo });
              setEditando(false);
              onCambio();
            }}
          >
            <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded-md border border-borde bg-fondo px-2 py-1 text-sm" aria-label="Título" />
            <Boton type="submit" variante="primario">OK</Boton>
          </form>
        ) : (
          <Link href={`/d/${d.id}`} className="min-w-0 flex-1 font-semibold hover:text-acento">
            <span className="block truncate" title={d.titulo}>{d.titulo}</span>
          </Link>
        )}
        {esMio && !editando && (
          <button aria-label="Renombrar" title="Renombrar" onClick={() => setEditando(true)} className="text-texto-suave hover:text-texto">
            <Pencil size={15} />
          </button>
        )}
      </div>
      <p className="flex items-center gap-1 truncate text-xs text-texto-suave" title={d.archivo_nombre}>
        <FileSpreadsheet size={13} /> {d.archivo_nombre} · {fmtBytes(d.archivo_tamano)}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
        <Etiqueta tono={d.visibilidad === "publico" ? "positivo" : d.visibilidad === "equipo" ? "acento" : "neutro"} className="gap-1">
          <Vis size={11} /> {visTexto}
        </Etiqueta>
        {!esMio && d.propietario && <span>de {d.propietario.nombre ?? d.propietario.correo}</span>}
        <span className="ml-auto">{fmtFecha(new Date(d.actualizado_en))}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Link href={`/d/${d.id}`} className="inline-flex items-center gap-1 rounded-md border border-borde px-2 py-1 text-sm hover:bg-superficie-2">
          <ExternalLink size={14} /> Abrir
        </Link>
        {esMio &&
          (confirmando ? (
            <>
              <Boton
                variante="peligro"
                onClick={async () => {
                  const completo = await obtenerDashboard(d.id);
                  await borrarDashboard(completo);
                  onCambio();
                }}
              >
                Confirmar borrado
              </Boton>
              <Boton variante="fantasma" onClick={() => setConfirmando(false)}>Cancelar</Boton>
            </>
          ) : (
            <Boton variante="fantasma" onClick={() => setConfirmando(true)} title="Borrar">
              <Trash2 size={14} /> Borrar
            </Boton>
          ))}
      </div>
    </Tarjeta>
  );
}
