"use client";
import { supabaseCliente } from "./cliente";
import type { Tabla, Filtro, Agregacion, TipoColumna } from "../tipos";

/** Esquema serializable que se guarda en Postgres: correcciones por tabla y estado de vista. */
export interface EsquemaGuardado {
  version: 1;
  tablas: {
    hoja: string;
    nombre: string;
    columnas: { id: string; tipo: TipoColumna; agregacion: Agregacion; esPrincipal: boolean }[];
  }[];
  tablaActiva?: { hoja: string; nombre: string };
  filtros?: Filtro[];
  pestana?: string;
}

export interface DashboardResumen {
  id: string;
  titulo: string;
  propietario_id: string;
  equipo_id: string | null;
  archivo_nombre: string;
  archivo_tamano: number;
  visibilidad: "privado" | "equipo" | "publico";
  publico_slug: string | null;
  creado_en: string;
  actualizado_en: string;
  propietario?: { nombre: string | null; correo: string } | null;
  equipo?: { nombre: string } | null;
}

export interface DashboardCompleto extends DashboardResumen {
  archivo_ruta: string;
  esquema: EsquemaGuardado;
}

export function construirEsquema(tablas: Tabla[], tablaActiva: Tabla | null, filtros: Filtro[], pestana: string): EsquemaGuardado {
  return {
    version: 1,
    tablas: tablas.map((t) => ({
      hoja: t.hoja,
      nombre: t.nombre,
      columnas: t.columnas.map((c) => ({ id: c.id, tipo: c.tipo, agregacion: c.agregacion, esPrincipal: c.esPrincipal })),
    })),
    tablaActiva: tablaActiva ? { hoja: tablaActiva.hoja, nombre: tablaActiva.nombre } : undefined,
    filtros: filtros.map((f) => ({ ...f, valores: f.valores.map((v) => (v instanceof Date ? v.toISOString() : v)) })),
    pestana,
  };
}

const CAMPOS_RESUMEN = "id, titulo, propietario_id, equipo_id, archivo_nombre, archivo_tamano, visibilidad, publico_slug, creado_en, actualizado_en, propietario:perfiles!dashboards_propietario_id_fkey(nombre, correo), equipo:equipos(nombre)";

export async function listarDashboards(): Promise<DashboardResumen[]> {
  const { data, error } = await supabaseCliente().from("dashboards").select(CAMPOS_RESUMEN).order("actualizado_en", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DashboardResumen[];
}

export async function obtenerDashboard(id: string): Promise<DashboardCompleto> {
  const { data, error } = await supabaseCliente().from("dashboards").select(`${CAMPOS_RESUMEN}, archivo_ruta, esquema`).eq("id", id).single();
  if (error) throw new Error(error.code === "PGRST116" ? "No existe ese dashboard o no tienes acceso." : error.message);
  return data as unknown as DashboardCompleto;
}

export async function obtenerDashboardPublico(slug: string): Promise<DashboardCompleto> {
  const { data, error } = await supabaseCliente().from("dashboards").select(`${CAMPOS_RESUMEN}, archivo_ruta, esquema`).eq("publico_slug", slug).eq("visibilidad", "publico").single();
  if (error) throw new Error("Este dashboard no está publicado o el enlace no es válido.");
  return data as unknown as DashboardCompleto;
}

/** Crea el registro, sube el archivo al bucket y guarda la ruta. Devuelve el id. */
export async function crearDashboard(titulo: string, archivo: File, esquema: EsquemaGuardado, equipoId: string | null = null): Promise<string> {
  const sb = supabaseCliente();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Inicia sesión para guardar.");
  const { data, error } = await sb
    .from("dashboards")
    .insert({ titulo, propietario_id: user.id, equipo_id: equipoId, archivo_ruta: "", archivo_nombre: archivo.name, archivo_tamano: archivo.size, esquema })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = data.id as string;
  const ruta = `${id}/${nombreSeguro(archivo.name)}`;
  const { error: eSubida } = await sb.storage.from("archivos").upload(ruta, archivo, { upsert: true, contentType: archivo.type || "application/octet-stream" });
  if (eSubida) {
    await sb.from("dashboards").delete().eq("id", id);
    throw new Error(`No se pudo subir el archivo: ${eSubida.message}`);
  }
  const { error: eRuta } = await sb.from("dashboards").update({ archivo_ruta: ruta }).eq("id", id);
  if (eRuta) throw new Error(eRuta.message);
  return id;
}

export async function actualizarEsquema(id: string, esquema: EsquemaGuardado): Promise<void> {
  const { error } = await supabaseCliente().from("dashboards").update({ esquema }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function actualizarDashboard(id: string, cambios: Partial<Pick<DashboardCompleto, "titulo" | "visibilidad" | "publico_slug" | "equipo_id">>): Promise<void> {
  const { error } = await supabaseCliente().from("dashboards").update(cambios).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function borrarDashboard(d: Pick<DashboardCompleto, "id" | "archivo_ruta">): Promise<void> {
  const sb = supabaseCliente();
  if (d.archivo_ruta) await sb.storage.from("archivos").remove([d.archivo_ruta]);
  const { error } = await sb.from("dashboards").delete().eq("id", d.id);
  if (error) throw new Error(error.message);
}

/** Descarga el archivo del bucket como File. */
export async function descargarArchivo(d: Pick<DashboardCompleto, "archivo_ruta" | "archivo_nombre">): Promise<File> {
  const { data, error } = await supabaseCliente().storage.from("archivos").download(d.archivo_ruta);
  if (error || !data) throw new Error(`No se pudo descargar el archivo: ${error?.message ?? "sin datos"}`);
  return new File([data], d.archivo_nombre, { type: data.type });
}

export function nombreSeguro(n: string) {
  return n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export function generarSlug(titulo: string) {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "dashboard";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
