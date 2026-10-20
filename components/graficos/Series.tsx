"use client";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { EChartsCoreOption } from "echarts/core";
import { Grafico, colorDe, tokensTema, truncar } from "./Grafico";
import type { Punto } from "@/lib/analisis";
import { fmtCompacto, fmtNumero, fmtPorcentaje } from "@/lib/formato";

function fmtValor(v: number, porcentaje: boolean) {
  return porcentaje ? fmtPorcentaje(v) : fmtNumero(v);
}

/** Serie temporal con máximo, mínimo y promedio marcados; brush/zoom activados. */
export function GraficoSerie({
  puntos,
  nombre,
  porcentaje = false,
  alto = 320,
  onClickPunto,
  onBrush,
}: {
  puntos: Punto[];
  nombre: string;
  porcentaje?: boolean;
  alto?: number;
  onClickPunto?: (p: Punto) => void;
  onBrush?: (puntos: Punto[]) => void;
}) {
  const { resolvedTheme } = useTheme();
  const t = tokensTema(resolvedTheme === "dark");
  const opcion = useMemo<EChartsCoreOption>(() => {
    const vals = puntos.map((p) => p.valor);
    const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return {
      grid: { left: 8, right: 16, top: 36, bottom: puntos.length > 40 ? 56 : 32, containLabel: true },
      xAxis: {
        type: "category",
        data: puntos.map((p) => p.etiqueta),
        axisLabel: { color: t.suave, hideOverlap: true, rotate: puntos.length > 24 ? 45 : 0 },
        axisLine: { lineStyle: { color: t.linea } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: t.suave, formatter: (v: number) => (porcentaje ? fmtPorcentaje(v, 0) : fmtCompacto(v)) },
        splitLine: { lineStyle: { color: t.linea } },
      },
      tooltip: {
        trigger: "axis",
        formatter: (ps: { name: string; value: number; dataIndex: number }[]) => {
          const p = ps[0];
          const pt = puntos[p.dataIndex];
          return `<b>${p.name}</b><br/>${nombre}: ${fmtValor(p.value, porcentaje)}<br/><span style="color:${t.suave}">${fmtNumero(pt?.n ?? 0)} registros</span>`;
        },
      },
      dataZoom: puntos.length > 40 ? [{ type: "slider", height: 18, bottom: 6, borderColor: t.linea, textStyle: { color: t.suave } }, { type: "inside" }] : [{ type: "inside" }],
      toolbox: onBrush ? { right: 8, top: 0, feature: { brush: { type: ["lineX", "clear"], title: { lineX: "Seleccionar rango", clear: "Quitar selección" } } }, iconStyle: { borderColor: t.suave } } : undefined,
      brush: onBrush ? { xAxisIndex: 0, brushStyle: { color: t.acento, opacity: 0.15 }, throttleType: "debounce", throttleDelay: 300 } : undefined,
      series: [
        {
          type: "line",
          name: nombre,
          data: vals,
          smooth: 0.2,
          showSymbol: puntos.length <= 60,
          symbolSize: 6,
          lineStyle: { width: 2, color: t.acento },
          itemStyle: { color: t.acento },
          areaStyle: { color: t.acento, opacity: 0.08 },
          markPoint: {
            symbolSize: 44,
            label: { color: "#fff", fontSize: 10, formatter: (p: { value: number }) => fmtCompacto(p.value) },
            data: [
              { type: "max", name: "Máximo", itemStyle: { color: "#2e7d4f" } },
              { type: "min", name: "Mínimo", itemStyle: { color: "#b3261e" } },
            ],
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: t.suave },
            label: { position: "insideEndTop", color: t.suave, formatter: () => `Promedio ${fmtValor(prom, porcentaje)}` },
            data: [{ yAxis: prom }],
          },
        },
      ],
    };
  }, [puntos, nombre, porcentaje, t]);

  return (
    <Grafico
      opcion={opcion}
      alto={alto}
      eventos={{
        onClick: onClickPunto ? (p) => puntos[p.dataIndex] && onClickPunto(puntos[p.dataIndex]) : undefined,
        onBrush: onBrush ? (idx) => onBrush(idx.map((i) => puntos[i]).filter(Boolean)) : undefined,
      }}
    />
  );
}

/** Barras horizontales por categoría; clic filtra. Colores únicos por categoría. */
export function GraficoBarras({
  puntos,
  nombre,
  porcentaje = false,
  seleccionados = [],
  onClick,
  alto,
}: {
  puntos: Punto[];
  nombre: string;
  porcentaje?: boolean;
  seleccionados?: string[];
  onClick?: (p: Punto) => void;
  alto?: number;
}) {
  const { resolvedTheme } = useTheme();
  const t = tokensTema(resolvedTheme === "dark");
  const altura = alto ?? Math.max(160, Math.min(520, 28 * puntos.length + 40));
  const opcion = useMemo<EChartsCoreOption>(() => {
    const invertidos = [...puntos].reverse();
    const haySel = seleccionados.length > 0;
    return {
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        splitNumber: 4,
        axisLabel: { color: t.suave, hideOverlap: true, formatter: (v: number) => (porcentaje ? fmtPorcentaje(v, 0) : fmtCompacto(v)) },
        splitLine: { lineStyle: { color: t.linea } },
      },
      yAxis: {
        type: "category",
        data: invertidos.map((p) => p.etiqueta),
        axisLabel: { color: t.texto, formatter: (v: string) => truncar(v, 22), width: 150, overflow: "truncate" },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: t.linea } },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: { name: string; value: number; dataIndex: number }) => {
          const pt = invertidos[p.dataIndex];
          return `<b>${p.name}</b><br/>${nombre}: ${fmtValor(p.value, porcentaje)}<br/><span style="color:${t.suave}">${fmtNumero(pt?.n ?? 0)} registros · clic para filtrar</span>`;
        },
      },
      series: [
        {
          type: "bar",
          name: nombre,
          data: invertidos.map((p, i) => ({
            value: p.valor,
            itemStyle: {
              color: colorDe(puntos.length - 1 - i),
              opacity: haySel && !seleccionados.includes(p.clave) ? 0.3 : 1,
              borderRadius: [0, 3, 3, 0],
            },
          })),
          label: { show: true, position: "right", color: t.suave, fontSize: 11, formatter: (p: { value: number }) => fmtValor(p.value, porcentaje) },
          barMaxWidth: 22,
          cursor: onClick ? "pointer" : "default",
        },
      ],
    };
  }, [puntos, nombre, porcentaje, seleccionados, t]);

  return <Grafico opcion={opcion} alto={altura} eventos={{ onClick: onClick ? (p) => onClick([...puntos].reverse()[p.dataIndex]) : undefined }} />;
}

/** Sparkline SVG ligero para tarjetas KPI (sin ECharts para no pagar un canvas por tarjeta). */
export function Sparkline({ valores, positivo = true }: { valores: number[]; positivo?: boolean }) {
  if (valores.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * w, h - 2 - ((v - min) / rango) * (h - 4)]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const color = positivo ? "var(--positivo)" : "var(--negativo)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible" aria-hidden="true">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}
