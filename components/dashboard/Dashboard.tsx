"use client";
import { useTablaActiva } from "@/lib/store";
import { Vacio } from "@/components/ui";

export function Dashboard() {
  const tabla = useTablaActiva();
  if (!tabla) return <Vacio titulo="Selecciona una tabla" />;
  return <Vacio titulo="Dashboard en construcción" detalle={`Tabla activa: ${tabla.nombre}`} />;
}
