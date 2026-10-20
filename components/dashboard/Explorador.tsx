"use client";
import type { Analisis } from "./useAnalisis";
import { Vacio } from "@/components/ui";

export function Explorador({ a }: { a: Analisis }) {
  return <Vacio titulo="Explorador en construcción" detalle={`${a.filas.length} filas`} />;
}
