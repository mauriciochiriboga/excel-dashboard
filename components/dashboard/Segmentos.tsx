"use client";
import { useMemo, useState } from "react";
import type { Analisis } from "./useAnalisis";
import { useStore } from "@/lib/store";
import { Tarjeta, Vacio } from "@/components/ui";
import { GraficoBarras } from "@/components/graficos/Series";
import { agruparPor, claveValor } from "@/lib/analisis";

/** Barras por cada categoría relevante. Clic en una barra filtra todo el dashboard. */
export function Segmentos({ a }: { a: Analisis }) {
  const alternarFiltro = useStore((s) => s.alternarFiltro);
  const filtros = useStore((s) => s.filtros);
  const [medidaId, setMedidaId] = useState<string | null>(null);
  const [limite, setLimite] = useState(15);
  const medida = a.medidas.find((m) => m.id === medidaId) ?? a.medida;

  const grupos = useMemo(
    () =>
      a.categorias.map((c) => {
        const idx = a.tabla.columnas.indexOf(c);
        const puntos = agruparPor(a.filas, a.tabla, c.id, medida, limite);
        return { col: c, idx, puntos };
      }),
    [a, medida, limite],
  );

  if (a.categorias.length === 0) return <Vacio titulo="No hay columnas de categoría" detalle="Marca alguna columna como Categoría o Estado en «Cómo lo entendí»." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Medida
          <select value={medida?.id ?? ""} onChange={(e) => setMedidaId(e.target.value)} className="rounded-md border border-borde bg-superficie px-2 py-1">
            {a.medidas.length === 0 && <option value="">Registros</option>}
            {a.medidas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Mostrar
          <select value={limite} onChange={(e) => setLimite(Number(e.target.value))} className="rounded-md border border-borde bg-superficie px-2 py-1">
            {[10, 15, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} principales
              </option>
            ))}
          </select>
        </label>
        <span className="text-texto-suave">Clic en una barra para filtrar; otro clic la quita.</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map(({ col, idx, puntos }) =>
          puntos.length === 0 ? null : (
            <Tarjeta key={col.id} titulo={`${medida ? medida.nombre : "Registros"} por ${col.nombre} · ${col.distintos} valores`}>
              <GraficoBarras
                puntos={puntos}
                nombre={medida?.nombre ?? "Registros"}
                porcentaje={medida?.esPorcentaje}
                seleccionados={(filtros.find((f) => f.columnaId === col.id)?.valores ?? []).map((v) => claveValor(v, col))}
                onClick={(p) => {
                  const crudo = a.tabla.filas.find((f) => claveValor(f[idx], col) === p.clave)?.[idx] ?? p.clave;
                  alternarFiltro(col.id, crudo);
                }}
              />
            </Tarjeta>
          ),
        )}
      </div>
    </div>
  );
}
