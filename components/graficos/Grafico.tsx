"use client";
// Envoltorio de ECharts con importación selectiva (tree-shaking) y tema claro/oscuro.
import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart, HeatmapChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  BrushComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ECharts, EChartsCoreOption } from "echarts/core";

echarts.use([
  BarChart, LineChart, ScatterChart, HeatmapChart, PieChart,
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, BrushComponent,
  MarkLineComponent, MarkPointComponent, VisualMapComponent, ToolboxComponent, CanvasRenderer,
]);

/** 12 colores categóricos distinguibles en claro y oscuro. */
export const PALETA = ["#2f7d6d", "#d9822b", "#4f6fd9", "#c84b8a", "#8a9a2b", "#7b5cd6", "#1f9bb5", "#c24d3a", "#a07a1e", "#3f8f4f", "#b35fc2", "#5b7b8a"];

export function colorDe(i: number) {
  return PALETA[i % PALETA.length];
}

export interface EventosGrafico {
  onClick?: (p: { name: string; dataIndex: number; seriesIndex: number; value: unknown }) => void;
  onBrush?: (indices: number[]) => void;
}

export function tokensTema(oscuro: boolean) {
  return {
    texto: oscuro ? "#e8ebe4" : "#1b1f1a",
    suave: oscuro ? "#9aa196" : "#5c645a",
    linea: oscuro ? "#30352f" : "#d8dcd4",
    fondo: oscuro ? "#1b1e1b" : "#ffffff",
    acento: oscuro ? "#6fc7b0" : "#1f6f5f",
  };
}

export function Grafico({ opcion, alto = 300, eventos, className }: { opcion: EChartsCoreOption; alto?: number | string; eventos?: EventosGrafico; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<ECharts | null>(null);
  const { resolvedTheme } = useTheme();
  const oscuro = resolvedTheme === "dark";
  const t = useMemo(() => tokensTema(oscuro), [oscuro]);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    inst.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = inst.current;
    if (!chart) return;
    const base: EChartsCoreOption = {
      color: PALETA,
      textStyle: { color: t.texto, fontFamily: "inherit" },
      backgroundColor: "transparent",
      animationDuration: 500,
      tooltip: {
        backgroundColor: t.fondo,
        borderColor: t.linea,
        textStyle: { color: t.texto },
        confine: true,
      },
      ...opcion,
    };
    chart.setOption(base, { notMerge: true });
    chart.off("click");
    chart.off("brushSelected");
    if (eventos?.onClick) chart.on("click", (p) => eventos.onClick?.(p as never));
    if (eventos?.onBrush) {
      chart.on("brushSelected", (p: unknown) => {
        const batch = (p as { batch?: { selected?: { dataIndex: number[] }[] }[] }).batch?.[0]?.selected ?? [];
        eventos.onBrush?.(batch.flatMap((s) => s.dataIndex));
      });
    }
  }, [opcion, eventos, t]);

  return <div ref={ref} className={className} style={{ height: alto, width: "100%", minWidth: 0 }} role="img" />;
}

/** Trunca etiquetas largas para ejes y añade "…" */
export function truncar(s: string, n = 18) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
