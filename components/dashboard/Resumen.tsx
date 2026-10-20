"use client";
import { TrendingDown, TrendingUp, Lightbulb, Filter } from "lucide-react";
import type { Analisis } from "./useAnalisis";
import { useStore } from "@/lib/store";
import { Boton, Tarjeta, Vacio, cx } from "@/components/ui";
import { fmtCompacto, fmtNumero, fmtPorcentaje } from "@/lib/formato";
import { agruparPor } from "@/lib/analisis";
import { GraficoBarras, GraficoSerie, Sparkline } from "@/components/graficos/Series";
import { useMemo } from "react";

export function Resumen({ a }: { a: Analisis }) {
  const setPestana = useStore((s) => s.setPestana);
  const fijarFiltro = useStore((s) => s.fijarFiltro);
  const alternarFiltro = useStore((s) => s.alternarFiltro);
  const filtros = useStore((s) => s.filtros);

  const barras = useMemo(
    () =>
      a.categorias.slice(0, 4).map((c) => ({
        col: c,
        puntos: agruparPor(a.filas, a.tabla, c.id, a.medida, 12),
      })),
    [a],
  );

  if (a.medidas.length === 0 && a.categorias.length === 0) {
    return <Vacio titulo="No hay medidas ni categorías para resumir" detalle="Marca alguna columna como medida o categoría en «Cómo lo entendí»." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {a.kpis.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {a.kpis.map((k) => {
            const porc = k.columna.esPorcentaje;
            const valor = porc ? fmtPorcentaje(k.valor) : Math.abs(k.valor) >= 1e6 ? fmtCompacto(k.valor) : fmtNumero(k.valor);
            const sube = (k.variacion ?? 0) >= 0;
            return (
              <Tarjeta key={k.columna.id} className={cx(k.columna.esPrincipal && "border-acento/60")}>
                <p className="truncate text-xs font-medium uppercase tracking-wide text-texto-suave" title={k.columna.nombre}>
                  {k.columna.nombre} <span className="normal-case">· {k.columna.agregacion === "promedio" ? "promedio" : "total"}</span>
                </p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="text-2xl font-semibold tabular" title={fmtNumero(k.valor)}>
                    {valor}
                  </p>
                  <Sparkline valores={k.sparkline} positivo={sube} />
                </div>
                {k.variacion !== null && (
                  <p className={cx("mt-1 flex items-center gap-1 text-xs", sube ? "text-positivo" : "text-negativo")}>
                    {sube ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {sube ? "+" : "−"}
                    {fmtPorcentaje(Math.abs(k.variacion))} <span className="text-texto-suave">{k.periodoActual} vs {k.periodoAnterior}</span>
                  </p>
                )}
              </Tarjeta>
            );
          })}
        </div>
      )}

      {a.hallazgos.length > 0 && (
        <Tarjeta titulo={<span className="flex items-center gap-2"><Lightbulb size={16} className="text-aviso" /> Hallazgos clave</span>}>
          <ul className="grid gap-2 md:grid-cols-2">
            {a.hallazgos.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-2 rounded-md bg-superficie-2 p-3 text-sm">
                <span>{h.texto}</span>
                {h.filtro ? (
                  <Boton
                    variante="fantasma"
                    className="shrink-0 text-acento"
                    title="Aplicar este filtro"
                    onClick={() => {
                      fijarFiltro(h.filtro!);
                      if (h.pestana) setPestana(h.pestana);
                    }}
                  >
                    <Filter size={14} /> Filtrar
                  </Boton>
                ) : h.pestana ? (
                  <Boton variante="fantasma" className="shrink-0 text-acento" onClick={() => setPestana(h.pestana!)}>
                    Ver
                  </Boton>
                ) : null}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {a.serie.length >= 2 && a.medida && a.fecha && (
        <Tarjeta titulo={`${a.medida.nombre} por ${a.gran === "anio" ? "año" : a.gran === "mes" ? "mes" : "día"}`}>
          <GraficoSerie puntos={a.serie} nombre={a.medida.nombre} porcentaje={a.medida.esPorcentaje} alto={280} />
        </Tarjeta>
      )}

      {barras.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {barras.map(({ col, puntos }) =>
            puntos.length === 0 ? null : (
              <Tarjeta key={col.id} titulo={`${a.medida ? a.medida.nombre : "Registros"} por ${col.nombre}`}>
                <GraficoBarras
                  puntos={puntos}
                  nombre={a.medida?.nombre ?? "Registros"}
                  porcentaje={a.medida?.esPorcentaje}
                  seleccionados={filtros.find((f) => f.columnaId === col.id)?.valores.map(String) ?? []}
                  onClick={(p) => {
                    const idx = a.tabla.columnas.findIndex((c) => c.id === col.id);
                    const crudo = a.filas.find((f) => String(f[idx]) === p.clave || p.clave === "")?.[idx] ?? p.clave;
                    alternarFiltro(col.id, crudo);
                  }}
                />
              </Tarjeta>
            ),
          )}
        </div>
      )}
    </div>
  );
}
