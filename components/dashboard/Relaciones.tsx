"use client";
import type { Analisis } from "./useAnalisis";
import { Vacio } from "@/components/ui";

export function Relaciones({ a }: { a: Analisis }) {
  return <Vacio titulo="Relaciones en construcción" detalle={`${a.filas.length} filas`} />;
}
