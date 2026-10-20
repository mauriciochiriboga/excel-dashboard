"use client";
import { useMemo } from "react";
import { useStore, useTablaActiva } from "@/lib/store";
import {
  aplicarFiltros,
  calcularHallazgos,
  calcularKpis,
  columnaFecha,
  granularidadSerie,
  medidaPrincipal,
  serieTemporal,
} from "@/lib/analisis";
import type { Columna, Tabla } from "@/lib/tipos";

export function useAnalisis() {
  const tabla = useTablaActiva();
  const filtros = useStore((s) => s.filtros);

  return useMemo(() => {
    if (!tabla) return null;
    const filas = aplicarFiltros(tabla, filtros);
    const medida = medidaPrincipal(tabla);
    const fecha = columnaFecha(tabla);
    const gran = fecha ? granularidadSerie(filas, tabla, fecha) : null;
    const serie = fecha && gran ? serieTemporal(filas, tabla, fecha, medida, gran) : [];
    const kpis = calcularKpis(filas, tabla, fecha && gran ? { fecha, gran } : null);
    const hallazgos = calcularHallazgos(filas, tabla, medida, serie, fecha);
    const categorias = tabla.columnas.filter((c) => (c.tipo === "categoria" || c.tipo === "estado") && c.distintos >= 2);
    const medidas = tabla.columnas.filter((c) => c.tipo === "medida");
    return { tabla, filas, medida, fecha, gran, serie, kpis, hallazgos, categorias, medidas, filtrado: filtros.length > 0 };
  }, [tabla, filtros]);
}

export type Analisis = NonNullable<ReturnType<typeof useAnalisis>>;
export type { Columna, Tabla };
