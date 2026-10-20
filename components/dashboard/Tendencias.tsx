"use client";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { EChartsCoreOption } from "echarts/core";
import type { Analisis } from "./useAnalisis";
import { useStore } from "@/lib/store";
import { Tarjeta, Vacio } from "@/components/ui";
import { GraficoSerie } from "@/components/graficos/Series";
import { Grafico, colorDe, tokensTema } from "@/components/graficos/Grafico";
import { agruparPor, claveValor, serieTemporal } from "@/lib/analisis";
import { fmtCompacto, fmtNumero, fmtPorcentaje } from "@/lib/formato";

export function Tendencias({ a }: { a: Analisis }) {
  const fijarFiltro = useStore((s) => s.fijarFiltro);
  const [medidaId, setMedidaId] = useState<string | null>(null);
  const [catId, setCatId] = useState<string>("");
  const { resolvedTheme } = useTheme();
  const t = tokensTema(resolvedTheme === "dark");

  const medida = a.medidas.find((m) => m.id === medidaId) ?? a.medida;
  const serie = useMemo(() => (a.fecha && a.gran && medida ? serieTemporal(a.filas, a.tabla, a.fecha, medida, a.gran) : []), [a, medida]);

  // Serie por categoría (hasta 8 series)
  const porCategoria = useMemo(() => {
    if (!catId || !a.fecha || !a.gran || !medida) return null;
    const cat = a.tabla.columnas.find((c) => c.id === catId);
    if (!cat) return null;
    const ci = a.tabla.columnas.indexOf(cat);
    const top = agruparPor(a.filas, a.tabla, cat.id, medida, 8).map((p) => p.clave);
    const periodos = serie.map((p) => p.clave);
    const etiquetas = serie.map((p) => p.etiqueta);
    const series = top.map((clave) => {
      const filas = a.filas.filter((f) => claveValor(f[ci], cat) === clave);
      const s = serieTemporal(filas, a.tabla, a.fecha!, medida, a.gran!);
      const mapa = new Map(s.map((p) => [p.clave, p.valor]));
      const etiqueta = s[0] ? agruparPor(filas, a.tabla, cat.id, medida, 1)[0]?.etiqueta ?? clave : clave;
      return { nombre: etiqueta, datos: periodos.map((k) => mapa.get(k) ?? null) };
    });
    return { etiquetas, series };
  }, [a, catId, medida, serie]);

  const opcionCat = useMemo<EChartsCoreOption | null>(() => {
    if (!porCategoria) return null;
    return {
      grid: { left: 8, right: 16, top: 48, bottom: 32, containLabel: true },
      legend: { top: 0, textStyle: { color: t.texto }, type: "scroll" },
      xAxis: { type: "category", data: porCategoria.etiquetas, axisLabel: { color: t.suave, hideOverlap: true }, axisLine: { lineStyle: { color: t.linea } } },
      yAxis: { type: "value", axisLabel: { color: t.suave, formatter: (v: number) => (medida?.esPorcentaje ? fmtPorcentaje(v, 0) : fmtCompacto(v)) }, splitLine: { lineStyle: { color: t.linea } } },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => (medida?.esPorcentaje ? fmtPorcentaje(v) : fmtNumero(v)) },
      dataZoom: [{ type: "inside" }],
      series: porCategoria.series.map((s, i) => ({ type: "line", name: s.nombre, data: s.datos, smooth: 0.2, showSymbol: false, connectNulls: true, lineStyle: { width: 2 }, itemStyle: { color: colorDe(i) } })),
    };
  }, [porCategoria, medida, t]);

  if (!a.fecha) return <Vacio titulo="Esta tabla no tiene columna de fecha" detalle="Marca una columna como Fecha en «Cómo lo entendí» para ver tendencias." />;
  if (!medida) return <Vacio titulo="No hay medidas para graficar" />;

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
        <label className="flex items-center gap-2">
          Desglosar por
          <select value={catId} onChange={(e) => setCatId(e.target.value)} className="rounded-md border border-borde bg-superficie px-2 py-1">
            <option value="">(ninguna)</option>
            {a.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <span className="text-texto-suave">Arrastra en el gráfico para seleccionar un rango y filtrar.</span>
      </div>

      <Tarjeta titulo={`${medida.nombre} por ${a.gran === "anio" ? "año" : a.gran === "mes" ? "mes" : "día"} · máximo, mínimo y promedio marcados`}>
        {serie.length < 2 ? (
          <Vacio titulo="No hay suficientes periodos" />
        ) : (
          <GraficoSerie
            puntos={serie}
            nombre={medida.nombre}
            porcentaje={medida.esPorcentaje}
            alto={360}
            onBrush={(pts) => {
              if (pts.length === 0 || !a.fecha) return;
              const claves = pts.map((p) => p.clave).sort();
              const ini = inicioPeriodo(claves[0]);
              const fin = finPeriodo(claves[claves.length - 1]);
              fijarFiltro({ columnaId: a.fecha.id, valores: [], rango: [ini, fin] });
            }}
          />
        )}
      </Tarjeta>

      {opcionCat && (
        <Tarjeta titulo={`${medida.nombre} por ${a.tabla.columnas.find((c) => c.id === catId)?.nombre} (8 principales)`}>
          <Grafico opcion={opcionCat} alto={360} />
        </Tarjeta>
      )}
    </div>
  );
}

function inicioPeriodo(clave: string) {
  const p = clave.split("-").map(Number);
  return new Date(p[0], (p[1] ?? 1) - 1, p[2] ?? 1).getTime();
}
function finPeriodo(clave: string) {
  const p = clave.split("-").map(Number);
  if (p.length === 1) return new Date(p[0] + 1, 0, 1).getTime() - 1;
  if (p.length === 2) return new Date(p[0], p[1], 1).getTime() - 1;
  return new Date(p[0], p[1] - 1, p[2] + 1).getTime() - 1;
}
