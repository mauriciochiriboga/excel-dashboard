"use client";
import { supabaseCliente } from "./cliente";

export type RolEquipo = "propietario" | "editor" | "lector";

export interface Equipo {
  id: string;
  nombre: string;
  creado_por: string;
  creado_en: string;
  miembros?: Miembro[];
  invitaciones?: Invitacion[];
}
export interface Miembro {
  equipo_id: string;
  usuario_id: string;
  rol: RolEquipo;
  perfil?: { nombre: string | null; correo: string } | null;
}
export interface Invitacion {
  id: string;
  equipo_id: string;
  correo: string;
  rol: "editor" | "lector";
}

const SELECT = "id, nombre, creado_por, creado_en, miembros:miembros_equipo(equipo_id, usuario_id, rol, perfil:perfiles(nombre, correo)), invitaciones:invitaciones_equipo(id, equipo_id, correo, rol)";

export async function listarEquipos(): Promise<Equipo[]> {
  const { data, error } = await supabaseCliente().from("equipos").select(SELECT).order("creado_en");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Equipo[];
}

export async function crearEquipo(nombre: string): Promise<string> {
  const sb = supabaseCliente();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Inicia sesión.");
  const { data, error } = await sb.from("equipos").insert({ nombre, creado_por: u.user.id }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function renombrarEquipo(id: string, nombre: string) {
  const { error } = await supabaseCliente().from("equipos").update({ nombre }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function borrarEquipo(id: string) {
  const { error } = await supabaseCliente().from("equipos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Invita por correo: si el usuario existe se añade directo; si no, queda una invitación pendiente. */
export async function invitarMiembro(equipoId: string, correo: string, rol: "editor" | "lector"): Promise<"añadido" | "invitado"> {
  const sb = supabaseCliente();
  const { data: usuarios, error: eBusq } = await sb.rpc("buscar_usuario", { p_correo: correo.trim() });
  if (eBusq) throw new Error(eBusq.message);
  const u = (usuarios as { id: string }[] | null)?.[0];
  if (u) {
    const { error } = await sb.from("miembros_equipo").upsert({ equipo_id: equipoId, usuario_id: u.id, rol });
    if (error) throw new Error(error.message);
    return "añadido";
  }
  const { error } = await sb.from("invitaciones_equipo").upsert({ equipo_id: equipoId, correo: correo.trim().toLowerCase(), rol }, { onConflict: "equipo_id,correo" });
  if (error) throw new Error(error.message);
  return "invitado";
}

export async function cambiarRolMiembro(equipoId: string, usuarioId: string, rol: RolEquipo) {
  const { error } = await supabaseCliente().from("miembros_equipo").update({ rol }).eq("equipo_id", equipoId).eq("usuario_id", usuarioId);
  if (error) throw new Error(error.message);
}

export async function quitarMiembro(equipoId: string, usuarioId: string) {
  const { error } = await supabaseCliente().from("miembros_equipo").delete().eq("equipo_id", equipoId).eq("usuario_id", usuarioId);
  if (error) throw new Error(error.message);
}

export async function cancelarInvitacion(id: string) {
  const { error } = await supabaseCliente().from("invitaciones_equipo").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------- permisos explícitos por dashboard ---------- */

export interface PermisoDashboard {
  dashboard_id: string;
  usuario_id: string;
  nivel: "lector" | "editor";
  perfil?: { nombre: string | null; correo: string } | null;
}

export async function listarPermisos(dashboardId: string): Promise<PermisoDashboard[]> {
  const { data, error } = await supabaseCliente().from("permisos_dashboard").select("dashboard_id, usuario_id, nivel, perfil:perfiles(nombre, correo)").eq("dashboard_id", dashboardId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PermisoDashboard[];
}

export async function compartirDashboard(dashboardId: string, correo: string, nivel: "lector" | "editor") {
  const sb = supabaseCliente();
  const { data: usuarios, error: eBusq } = await sb.rpc("buscar_usuario", { p_correo: correo.trim() });
  if (eBusq) throw new Error(eBusq.message);
  const u = (usuarios as { id: string }[] | null)?.[0];
  if (!u) throw new Error("No hay ningún usuario registrado con ese correo. Pídele que cree su cuenta primero.");
  const { error } = await sb.from("permisos_dashboard").upsert({ dashboard_id: dashboardId, usuario_id: u.id, nivel });
  if (error) throw new Error(error.message);
}

export async function quitarPermiso(dashboardId: string, usuarioId: string) {
  const { error } = await supabaseCliente().from("permisos_dashboard").delete().eq("dashboard_id", dashboardId).eq("usuario_id", usuarioId);
  if (error) throw new Error(error.message);
}
