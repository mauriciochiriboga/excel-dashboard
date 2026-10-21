"use client";
import { useEffect, useState } from "react";
import { Users, UserPlus, Trash2, X } from "lucide-react";
import { useUsuario } from "@/lib/supabase/useUsuario";
import {
  listarEquipos,
  crearEquipo,
  renombrarEquipo,
  borrarEquipo,
  invitarMiembro,
  cambiarRolMiembro,
  quitarMiembro,
  cancelarInvitacion,
  type Equipo,
  type RolEquipo,
} from "@/lib/supabase/equipos";
import { Boton, Etiqueta, Tarjeta, Vacio } from "@/components/ui";

const ROLES: { v: RolEquipo; t: string }[] = [
  { v: "propietario", t: "Propietario" },
  { v: "editor", t: "Editor" },
  { v: "lector", t: "Lector" },
];

export function Equipos() {
  const { usuario, cargando } = useUsuario();
  const [equipos, setEquipos] = useState<Equipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");

  const recargar = () => listarEquipos().then(setEquipos).catch((e) => setError((e as Error).message));
  useEffect(() => {
    if (usuario) void recargar();
  }, [usuario]);

  if (cargando) return <p className="text-sm text-texto-suave">Cargando…</p>;
  if (!usuario) return <Vacio titulo="Inicia sesión para gestionar equipos" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Equipos</h1>
        <form
          className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nuevo.trim()) return;
            try {
              await crearEquipo(nuevo.trim());
              setNuevo("");
              await recargar();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre del equipo" aria-label="Nombre del equipo" className="rounded-md border border-borde bg-superficie px-2 py-1.5 text-sm" />
          <Boton type="submit" variante="primario">
            <Users size={16} /> Crear equipo
          </Boton>
        </form>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-negativo/10 px-3 py-2 text-sm text-negativo">
          {error}
        </p>
      )}
      {equipos && equipos.length === 0 && <Vacio titulo="Todavía no perteneces a ningún equipo" detalle="Crea uno e invita a tus compañeros por correo." />}
      {equipos?.map((eq) => (
        <TarjetaEquipo key={eq.id} eq={eq} usuarioId={usuario.id} onCambio={recargar} onError={setError} />
      ))}
    </div>
  );
}

function TarjetaEquipo({ eq, usuarioId, onCambio, onError }: { eq: Equipo; usuarioId: string; onCambio: () => void; onError: (m: string | null) => void }) {
  const miRol = eq.miembros?.find((m) => m.usuario_id === usuarioId)?.rol;
  const soyPropietario = miRol === "propietario";
  const puedoInvitar = miRol === "propietario" || miRol === "editor";
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState<"editor" | "lector">("lector");
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(eq.nombre);
  const [confirmando, setConfirmando] = useState(false);

  const accion = async (fn: () => Promise<unknown>) => {
    try {
      onError(null);
      await fn();
      onCambio();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <Tarjeta
      titulo={
        editando ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              setEditando(false);
              void accion(() => renombrarEquipo(eq.id, nombre.trim() || eq.nombre));
            }}
          >
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className="rounded-md border border-borde bg-fondo px-2 py-1 text-sm" aria-label="Nombre" />
            <Boton type="submit" variante="primario">OK</Boton>
          </form>
        ) : (
          <span className="flex items-center gap-2">
            <Users size={16} className="text-acento" /> {eq.nombre}
            <Etiqueta tono="neutro">{ROLES.find((r) => r.v === miRol)?.t ?? miRol}</Etiqueta>
          </span>
        )
      }
      accion={
        soyPropietario && !editando ? (
          <div className="flex items-center gap-1">
            <Boton variante="fantasma" onClick={() => setEditando(true)}>Renombrar</Boton>
            {confirmando ? (
              <>
                <Boton variante="peligro" onClick={() => void accion(() => borrarEquipo(eq.id))}>Confirmar borrado</Boton>
                <Boton variante="fantasma" onClick={() => setConfirmando(false)}>Cancelar</Boton>
              </>
            ) : (
              <Boton variante="fantasma" onClick={() => setConfirmando(true)}><Trash2 size={14} /> Borrar</Boton>
            )}
          </div>
        ) : undefined
      }
    >
      <ul className="divide-y divide-borde/60 text-sm">
        {eq.miembros?.map((m) => (
          <li key={m.usuario_id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate">
              <b>{m.perfil?.nombre ?? m.perfil?.correo ?? m.usuario_id}</b>
              {m.perfil?.nombre && <span className="text-texto-suave"> · {m.perfil.correo}</span>}
              {m.usuario_id === usuarioId && <span className="text-texto-suave"> (tú)</span>}
            </span>
            {soyPropietario && m.usuario_id !== usuarioId ? (
              <>
                <select value={m.rol} onChange={(e) => void accion(() => cambiarRolMiembro(eq.id, m.usuario_id, e.target.value as RolEquipo))} className="rounded-md border border-borde bg-superficie px-2 py-1" aria-label="Rol">
                  {ROLES.map((r) => (
                    <option key={r.v} value={r.v}>{r.t}</option>
                  ))}
                </select>
                <button aria-label="Quitar del equipo" title="Quitar del equipo" onClick={() => void accion(() => quitarMiembro(eq.id, m.usuario_id))} className="text-texto-suave hover:text-negativo">
                  <X size={16} />
                </button>
              </>
            ) : (
              <Etiqueta tono={m.rol === "propietario" ? "acento" : "neutro"}>{ROLES.find((r) => r.v === m.rol)?.t}</Etiqueta>
            )}
          </li>
        ))}
        {eq.invitaciones?.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-texto-suave">
            <span className="min-w-0 flex-1 truncate">{i.correo} · invitación pendiente ({i.rol})</span>
            {puedoInvitar && (
              <button aria-label="Cancelar invitación" onClick={() => void accion(() => cancelarInvitacion(i.id))} className="hover:text-negativo">
                <X size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {puedoInvitar && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!correo.trim()) return;
            void accion(async () => {
              const r = await invitarMiembro(eq.id, correo, rol);
              setAviso(r === "añadido" ? "Miembro añadido." : "Invitación guardada: se unirá al equipo cuando cree su cuenta con ese correo.");
              setCorreo("");
            });
          }}
        >
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@empresa.com" aria-label="Correo a invitar" className="min-w-[200px] flex-1 rounded-md border border-borde bg-superficie px-2 py-1.5 text-sm" />
          <select value={rol} onChange={(e) => setRol(e.target.value as "editor" | "lector")} className="rounded-md border border-borde bg-superficie px-2 py-1.5 text-sm" aria-label="Rol del invitado">
            <option value="lector">Lector</option>
            <option value="editor">Editor</option>
          </select>
          <Boton type="submit">
            <UserPlus size={16} /> Invitar
          </Boton>
          {aviso && <span className="text-xs text-texto-suave">{aviso}</span>}
        </form>
      )}
      {miRol !== "propietario" && (
        <div className="mt-3">
          <Boton variante="fantasma" onClick={() => void accion(() => quitarMiembro(eq.id, usuarioId))}>Salir del equipo</Boton>
        </div>
      )}
    </Tarjeta>
  );
}
