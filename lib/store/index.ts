"use client";
import { create } from "zustand";
import type { ArchivoCrudo, Tabla, Filtro, Columna, TipoColumna, Agregacion, Celda } from "../tipos";
import { leerArchivo } from "../parsing/leerArchivo";
import { procesarArchivo } from "../deteccion";
import { reclasificarColumna } from "../clasificacion";

export type Vista = "carga" | "entendimiento" | "dashboard";
export type Pestana = "resumen" | "tendencias" | "segmentos" | "distribucion" | "relaciones" | "explorador" | "datos";

interface Carga {
  id: string;
  nombre: string;
  porcentaje: number;
  detalle: string;
}

interface Estado {
  archivos: ArchivoCrudo[];
  tablas: Tabla[];
  archivoActivo: string | null;
  tablaActiva: string | null;
  vista: Vista;
  pestana: Pestana;
  filtros: Filtro[];
  cargas: Carga[];
  errores: { archivo: string; mensaje: string }[];
  paletaAbierta: boolean;

  cargarArchivos: (files: File[]) => Promise<void>;
  cargarMuestra: () => Promise<void>;
  /** Carga un archivo desde una URL (misma origen o CORS habilitado). */
  cargarDesdeUrl: (url: string, nombre?: string) => Promise<void>;
  seleccionarArchivo: (id: string) => void;
  seleccionarTabla: (id: string) => void;
  setVista: (v: Vista) => void;
  setPestana: (p: Pestana) => void;
  quitarError: (i: number) => void;
  quitarArchivo: (id: string) => void;

  // Esquema
  cambiarTipo: (tablaId: string, columnaId: string, tipo: TipoColumna) => void;
  cambiarAgregacion: (tablaId: string, columnaId: string, ag: Agregacion) => void;
  marcarPrincipal: (tablaId: string, columnaId: string) => void;

  // Filtros
  alternarFiltro: (columnaId: string, valor: Celda) => void;
  fijarFiltro: (f: Filtro) => void;
  quitarFiltro: (columnaId: string) => void;
  limpiarFiltros: () => void;
  setPaletaAbierta: (v: boolean) => void;
}

const CLAVE_ESQUEMA = "excel-dashboard:esquemas";

function leerEsquemasGuardados(): Record<string, Partial<Columna>[]> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_ESQUEMA) ?? "{}");
  } catch {
    return {};
  }
}

function guardarEsquema(tabla: Tabla) {
  try {
    const todos = leerEsquemasGuardados();
    todos[claveTabla(tabla)] = tabla.columnas.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      agregacion: c.agregacion,
      esPrincipal: c.esPrincipal,
    }));
    localStorage.setItem(CLAVE_ESQUEMA, JSON.stringify(todos));
  } catch {
    /* sin localStorage */
  }
}

/** Clave estable por nombre de archivo + hoja + nombre de tabla + número de columnas. */
function claveTabla(t: Tabla, nombreArchivo?: string) {
  return `${nombreArchivo ?? t.archivoId}|${t.hoja}|${t.nombre}|${t.columnas.length}`;
}

function aplicarEsquemaGuardado(tablas: Tabla[], nombreArchivo: string): Tabla[] {
  const todos = leerEsquemasGuardados();
  return tablas.map((t) => {
    const guardado = todos[claveTabla(t, nombreArchivo)];
    if (!guardado) return t;
    let out = t;
    for (const g of guardado) {
      const col = out.columnas.find((c) => c.id === g.id);
      if (!col) continue;
      if (g.tipo && g.tipo !== col.tipo) out = reclasificarColumna(out, col.id, g.tipo);
      out = {
        ...out,
        columnas: out.columnas.map((c) =>
          c.id === g.id ? { ...c, agregacion: g.agregacion ?? c.agregacion, esPrincipal: g.esPrincipal ?? c.esPrincipal } : c,
        ),
      };
    }
    return out;
  });
}

export const useStore = create<Estado>((set, get) => ({
  archivos: [],
  tablas: [],
  archivoActivo: null,
  tablaActiva: null,
  vista: "carga",
  pestana: "resumen",
  filtros: [],
  cargas: [],
  errores: [],
  paletaAbierta: false,

  cargarArchivos: async (files) => {
    for (const file of files) {
      const cargaId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      set((s) => ({ cargas: [...s.cargas, { id: cargaId, nombre: file.name, porcentaje: 0, detalle: "Iniciando…" }] }));
      const actualizar = (porcentaje: number, detalle: string) =>
        set((s) => ({ cargas: s.cargas.map((c) => (c.id === cargaId ? { ...c, porcentaje, detalle } : c)) }));
      try {
        const crudo = await leerArchivo(file, { onProgreso: actualizar });
        actualizar(100, "Detectando tablas…");
        await new Promise((r) => setTimeout(r, 0));
        const tablas = aplicarEsquemaGuardado(procesarArchivo(crudo), crudo.nombre);
        if (tablas.length === 0) {
          throw new Error(
            "No se detectó ninguna tabla. El archivo debe tener bloques rectangulares con una fila de encabezados y al menos dos filas de datos.",
          );
        }
        set((s) => ({
          archivos: [...s.archivos, crudo],
          tablas: [...s.tablas, ...tablas],
          archivoActivo: crudo.id,
          tablaActiva: tablas[0].id,
          vista: "entendimiento",
          filtros: [],
          cargas: s.cargas.filter((c) => c.id !== cargaId),
        }));
      } catch (e) {
        set((s) => ({
          cargas: s.cargas.filter((c) => c.id !== cargaId),
          errores: [...s.errores, { archivo: file.name, mensaje: (e as Error).message }],
        }));
      }
    }
  },

  cargarMuestra: () => get().cargarDesdeUrl("/muestra.xlsx", "muestra.xlsx"),

  cargarDesdeUrl: async (url, nombre) => {
    const nombreFinal = nombre ?? decodeURIComponent(url.split("/").pop() ?? "archivo.xlsx");
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`No se pudo descargar el archivo (HTTP ${r.status}).`);
      const blob = await r.blob();
      await get().cargarArchivos([new File([blob], nombreFinal, { type: blob.type })]);
    } catch (e) {
      set((s) => ({ errores: [...s.errores, { archivo: nombreFinal, mensaje: (e as Error).message }] }));
    }
  },

  seleccionarArchivo: (id) => {
    const primera = get().tablas.find((t) => t.archivoId === id);
    set({ archivoActivo: id, tablaActiva: primera?.id ?? null, filtros: [] });
  },
  seleccionarTabla: (id) => {
    const t = get().tablas.find((x) => x.id === id);
    set({ tablaActiva: id, archivoActivo: t?.archivoId ?? get().archivoActivo, filtros: [] });
  },
  setVista: (vista) => set({ vista }),
  setPestana: (pestana) => set({ pestana }),
  quitarError: (i) => set((s) => ({ errores: s.errores.filter((_, j) => j !== i) })),
  quitarArchivo: (id) =>
    set((s) => {
      const archivos = s.archivos.filter((a) => a.id !== id);
      const tablas = s.tablas.filter((t) => t.archivoId !== id);
      const activo = archivos[0]?.id ?? null;
      return {
        archivos,
        tablas,
        archivoActivo: activo,
        tablaActiva: tablas.find((t) => t.archivoId === activo)?.id ?? null,
        vista: archivos.length === 0 ? "carga" : s.vista,
        filtros: [],
      };
    }),

  cambiarTipo: (tablaId, columnaId, tipo) =>
    set((s) => ({
      tablas: s.tablas.map((t) => {
        if (t.id !== tablaId) return t;
        const nueva = reclasificarColumna(t, columnaId, tipo);
        guardarEsquema({ ...nueva, archivoId: nombreDe(s, t.archivoId) });
        return nueva;
      }),
      filtros: s.filtros.filter((f) => f.columnaId !== columnaId),
    })),
  cambiarAgregacion: (tablaId, columnaId, ag) =>
    set((s) => ({
      tablas: s.tablas.map((t) => {
        if (t.id !== tablaId) return t;
        const nueva = { ...t, columnas: t.columnas.map((c) => (c.id === columnaId ? { ...c, agregacion: ag } : c)) };
        guardarEsquema({ ...nueva, archivoId: nombreDe(s, t.archivoId) });
        return nueva;
      }),
    })),
  marcarPrincipal: (tablaId, columnaId) =>
    set((s) => ({
      tablas: s.tablas.map((t) => {
        if (t.id !== tablaId) return t;
        const nueva = { ...t, columnas: t.columnas.map((c) => ({ ...c, esPrincipal: c.id === columnaId })) };
        guardarEsquema({ ...nueva, archivoId: nombreDe(s, t.archivoId) });
        return nueva;
      }),
    })),

  alternarFiltro: (columnaId, valor) =>
    set((s) => {
      const existente = s.filtros.find((f) => f.columnaId === columnaId);
      if (!existente) return { filtros: [...s.filtros, { columnaId, valores: [valor] }] };
      const ya = existente.valores.some((v) => igual(v, valor));
      const valores = ya ? existente.valores.filter((v) => !igual(v, valor)) : [...existente.valores, valor];
      const filtros = valores.length === 0
        ? s.filtros.filter((f) => f.columnaId !== columnaId)
        : s.filtros.map((f) => (f.columnaId === columnaId ? { ...f, valores, rango: undefined } : f));
      return { filtros };
    }),
  fijarFiltro: (f) =>
    set((s) => ({ filtros: [...s.filtros.filter((x) => x.columnaId !== f.columnaId), f] })),
  quitarFiltro: (columnaId) => set((s) => ({ filtros: s.filtros.filter((f) => f.columnaId !== columnaId) })),
  limpiarFiltros: () => set({ filtros: [] }),
  setPaletaAbierta: (paletaAbierta) => set({ paletaAbierta }),
}));

function nombreDe(s: Estado, archivoId: string) {
  return s.archivos.find((a) => a.id === archivoId)?.nombre ?? archivoId;
}

export function igual(a: Celda, b: Celda): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** Selectores de conveniencia. */
export const useTablaActiva = () =>
  useStore((s) => s.tablas.find((t) => t.id === s.tablaActiva) ?? null);
