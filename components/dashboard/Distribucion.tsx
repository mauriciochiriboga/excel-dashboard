"use client";
import type { Analisis } from "./useAnalisis";
import { Vacio } from "@/components/ui";

export function Distribucion({ a }: { a: Analisis }) {
  return <Vacio titulo="Distribucion en construcción" detalle={`${a.filas.length} filas`} />;
}
