"use client";
import type { Analisis } from "./useAnalisis";
import { Vacio } from "@/components/ui";

export function Segmentos({ a }: { a: Analisis }) {
  return <Vacio titulo="Segmentos en construcción" detalle={`${a.filas.length} filas`} />;
}
