"use client";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { EChartsCoreOption } from "echarts/core";
import type { Analisis } from "./useAnalisis";
import { useStore } from "@/lib/store";
import { Tarjeta, Vacio } from "@/components/ui";
import { Grafico, tokensTema } from "@/components/graficos/Grafico";
import { estadisticas, histograma } from "@/lib/analisis";
import { fmtCompacto, fmtNumero, fmtPorcentaje } from "@/lib/formato";

/** Histograma y estadísticas de cada medida. Arrastrar (brush) filtra por rango. */
export function Distribucion({ a }: { a: Analisis }) {
  const fijarFiltro = useStore((s) => s.fijarFiltro);
  const [medidaId, setMedidaId] = useState<string | null>(null);
  const medida = a.medidas.find((m) => m.id === medidaId) ?? a.medida;
  const { resolvedTheme } = useTheme();
  const t = tokensTema(resolvedTheme === "dark");

  const idx = medida ? a.tabla.columnas.indexOf(medida) : -1;
  const bins = useMemo(() => (idx >= 0 ? histograma(a.filas, idx) : []), [a, idx]);
  const est = useMemo(() => (idx >= 0 ? estadisticas(a.filas, idx) : null), [a, idx]);
  const porc = medida?.esPorcentaje ?? false;
  const f = (v: number) => (porc ? fmtPorcentaje(v) : fmtNumero(v));

  const opcion = useMemo<EChartsCoreOption>(
    () => ({
      grid: { left: 8, right: 16, top: 24, bottom: 32, containLabel: true },
      xAxis: {
        type: "category",
        data: bins.map((b) => `${porc ? fmtPorcentaje(b.x0, 0) : fmtCompacto(b.x0)}`),
        axisLabel: { color: t.suave, hideOverlap: true },
        axisLine: { lineStyle: { color: t.linea } },
      },
      yAxis: { type: "value", axisLabel: { color: t.suave, formatter: (v: number) => fmtCompacto(v) }, splitLine: { lineStyle: { color: t.linea } } },
      tooltip: {
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const b = bins[ps[0].dataIndex];
          return b ? `<b>${f(b.x0)} – ${f(b.x1)}</b><br/>${fmtNumero(b.n)} registros` : "";
        },
      },
      toolbox: { right: 8, top: 0, feature: { brush: { type: ["lineX", "clear"], title: { lineX: "Seleccionar rango", clear: "Quitar selección" } } }, iconStyle: { borderColor: t.suave } },
      brush: { xAxisIndex: 0, brushStyle: { color: t.acento, opacity: 0.15 }, throttleType: "debounce", throttleDelay: 300 },
      series: [{ type: "bar", data: bins.map((b) => b.n), barCategoryGap: "8%", itemStyle: { color: t.acento, borderRadius: [3, 3, 0, 0] } }],
    }),
    [bins, porc, t], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!medida) return <Vacio titulo="No hay medidas numéricas" />;

  const celdas = est
    ? [
        ["Registros", fmtNumero(est.n)],
        ["Mínimo", f(est.min)],
        ["Cuartil 1", f(est.q1)],
        ["Mediana", f(est.mediana)],
        ["Promedio", f(est.media)],
        ["Cuartil 3", f(est.q3)],
        ["Máximo", f(est.max)],
        ["Desv. típica", f(est.sd)],
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Medida
          <select value={medida.id} onChange={(e) => setMedidaId(e.target.value)} className="rounded-md border border-borde bg-superficie px-2 py-1">
            {a.medidas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <span className="text-texto-suave">Usa la herramienta de selección del gráfico para filtrar por rango.</span>
      </div>

      {est && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {celdas.map(([k, v]) => (
            <div key={k} className="rounded-md border border-borde bg-superficie p-2">
              <p className="text-[11px] uppercase tracking-wide text-texto-suave">{k}</p>
              <p className="truncate text-sm font-semibold tabular" title={v}>
                {v}
              </p>
            </div>
          ))}
        </div>
      )}

      <Tarjeta titulo={`Distribución de ${medida.nombre}`}>
        {bins.length === 0 ? (
          <Vacio titulo="Sin valores numéricos" />
        ) : (
          <Grafico
            opcion={opcion}
            alto={340}
            eventos={{
              onBrush: (ids) => {
                if (ids.length === 0) return;
                const sel = ids.map((i) => bins[i]).filter(Boolean);
                fijarFiltro({ columnaId: medida.id, valores: [], rango: [Math.min(...sel.map((b) => b.x0)), Math.max(...sel.map((b) => b.x1))] });
              },
            }}
          />
        )}
      </Tarjeta>
    </div>
  );
}
