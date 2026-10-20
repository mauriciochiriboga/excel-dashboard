"use client";
import type { Analisis } from "./useAnalisis";
import { Vacio } from "@/components/ui";

export function Datos({ a }: { a: Analisis }) {
  return <Vacio titulo="Datos en construcción" detalle={`${a.filas.length} filas`} />;
}
