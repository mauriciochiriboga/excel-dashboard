"use client";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { EChartsCoreOption } from "echarts/core";
import type { Analisis } from "./useAnalisis";
import { Tarjeta, Vacio } from "@/components/ui";
import { Grafico, colorDe, tokensTema, truncar } from "@/components/graficos/Grafico";
import { claveValor, matrizCorrelacion } from "@/lib/analisis";
import { fmtCompacto, fmtNumero } from "@/lib/formato";

/** Matriz de correlación entre medidas y dispersión de dos medidas coloreada por categoría. */
export function Relaciones({ a }: { a: Analisis }) {
  const { resolvedTheme } = useTheme();
  const t = tokensTema(resolvedTheme === "dark");
  const corr = useMemo(() => matrizCorrelacion(a.filas, a.tabla), [a]);
  const [xId, setXId] = useState<string | null>(null);
  const [yId, setYId] = useState<string | null>(null);
  const [catId, setCatId] = useState<string>("");

  const x = a.medidas.find((m) => m.id === xId) ?? corr.pares[0]?.a ?? a.medidas[0];
  const y = a.medidas.find((m) => m.id === yId) ?? corr.pares[0]?.b ?? a.medidas[1];
  const cat = a.categorias.find((c) => c.id === catId) ?? a.categorias.find((c) => c.distintos <= 12) ?? null;

  const opcionMatriz = useMemo<EChartsCoreOption | null>(() => {
    const n = corr.medidas.length;
    if (n < 2) return null;
    const nombres = corr.medidas.map((m) => truncar(m.nombre, 16));
    const datos: [number, number, number][] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) datos.push([j, i, Number.isFinite(corr.matriz[i][j]) ? Math.round(corr.matriz[i][j] * 100) / 100 : 0]);
    return {
      grid: { left: 8, right: 16, top: 8, bottom: 60, containLabel: true },
      xAxis: { type: "category", data: nombres, axisLabel: { color: t.suave, rotate: 30, hideOverlap: true }, splitArea: { show: false } },
      yAxis: { type: "category", data: nombres, axisLabel: { color: t.suave } },
      visualMap: { min: -1, max: 1, calculable: false, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: t.suave }, inRange: { color: ["#b3261e", t.fondo, "#2e7d4f"] } },
      tooltip: { formatter: (p: { value: [number, number, number] }) => `${corr.medidas[p.value[1]].nombre} × ${corr.medidas[p.value[0]].nombre}<br/>r = ${fmtNumero(p.value[2], 2)}` },
      series: [{ type: "heatmap", data: datos, label: { show: true, color: t.texto, fontSize: 11, formatter: (p: { value: [number, number, number] }) => fmtNumero(p.value[2], 2) }, itemStyle: { borderColor: t.linea, borderWidth: 1 } }],
    };
  }, [corr, t]);

  const opcionDispersion = useMemo<EChartsCoreOption | null>(() => {
    if (!x || !y || x.id === y.id) return null;
    const xi = a.tabla.columnas.indexOf(x);
    const yi = a.tabla.columnas.indexOf(y);
    const ci = cat ? a.tabla.columnas.indexOf(cat) : -1;
    const grupos = new Map<string, [number, number][]>();
    let total = 0;
    // Muestreo para mantener fluidez con muchas filas
    const paso = Math.max(1, Math.ceil(a.filas.length / 5000));
    for (let r = 0; r < a.filas.length; r += paso) {
      const f = a.filas[r];
      const vx = f[xi], vy = f[yi];
      if (typeof vx !== "number" || typeof vy !== "number") continue;
      const k = ci >= 0 ? claveValor(f[ci], cat!) || "(vacío)" : "Todos";
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push([vx, vy]);
      total++;
    }
    const series = [...grupos.entries()].slice(0, 12).map(([k, pts], i) => ({
      type: "scatter",
      name: k,
      data: pts,
      symbolSize: total > 2000 ? 4 : 7,
      itemStyle: { color: colorDe(i), opacity: 0.75 },
      large: total > 2000,
    }));
    return {
      grid: { left: 8, right: 16, top: 40, bottom: 32, containLabel: true },
      legend: { top: 0, type: "scroll", textStyle: { color: t.texto } },
      xAxis: { name: x.nombre, nameLocation: "middle", nameGap: 28, nameTextStyle: { color: t.suave }, axisLabel: { color: t.suave, formatter: (v: number) => fmtCompacto(v) }, splitLine: { lineStyle: { color: t.linea } } },
      yAxis: { name: y.nombre, nameTextStyle: { color: t.suave, align: "left" }, axisLabel: { color: t.suave, formatter: (v: number) => fmtCompacto(v) }, splitLine: { lineStyle: { color: t.linea } } },
      tooltip: { trigger: "item", formatter: (p: { seriesName: string; value: [number, number] }) => `${p.seriesName}<br/>${x.nombre}: ${fmtNumero(p.value[0])}<br/>${y.nombre}: ${fmtNumero(p.value[1])}` },
      dataZoom: [{ type: "inside" }, { type: "inside", yAxisIndex: 0 }],
      series,
    };
  }, [a, x, y, cat, t]);

  if (a.medidas.length < 2) return <Vacio titulo="Se necesitan al menos dos medidas numéricas" detalle="Marca otra columna como Medida en «Cómo lo entendí»." />;

  const sel = "rounded-md border border-borde bg-superficie px-2 py-1";
  return (
    <div className="flex flex-col gap-4">
      {opcionMatriz && (
        <Tarjeta titulo="Correlación entre medidas (Pearson)">
          <Grafico opcion={opcionMatriz} alto={Math.max(260, 40 * corr.medidas.length + 100)} />
        </Tarjeta>
      )}
      <Tarjeta titulo="Dispersión">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Eje X
            <select value={x?.id} onChange={(e) => setXId(e.target.value)} className={sel}>
              {a.medidas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Eje Y
            <select value={y?.id} onChange={(e) => setYId(e.target.value)} className={sel}>
              {a.medidas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Color por
            <select value={cat?.id ?? ""} onChange={(e) => setCatId(e.target.value)} className={sel}>
              <option value="">(ninguna)</option>
              {a.categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
        </div>
        {opcionDispersion ? <Grafico opcion={opcionDispersion} alto={380} /> : <Vacio titulo="Elige dos medidas distintas" />}
      </Tarjeta>
    </div>
  );
}
