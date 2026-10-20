"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import type { Analisis } from "./useAnalisis";
import { Boton, Tarjeta, cx } from "@/components/ui";
import { fmtCelda, fmtNumero } from "@/lib/formato";
import { aTexto } from "@/lib/deteccion/encabezados";
import type { Celda } from "@/lib/tipos";

const ALTO_FILA = 34;

/** Tabla virtualizada con búsqueda, orden por columna y exportación CSV (separador ; y coma decimal). */
export function Datos({ a }: { a: Analisis }) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ col: number; asc: boolean } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [altoVisible, setAltoVisible] = useState(480);
  const contRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAltoVisible(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filas = useMemo(() => {
    let out = a.filas;
    const q = busqueda.trim().toLowerCase();
    if (q) out = out.filter((f) => f.some((v) => v !== null && aTexto(v).toLowerCase().includes(q)));
    if (orden) {
      const { col, asc } = orden;
      out = [...out].sort((x, y) => {
        const vx = x[col], vy = y[col];
        if (vx === null) return 1;
        if (vy === null) return -1;
        let r: number;
        if (typeof vx === "number" && typeof vy === "number") r = vx - vy;
        else if (vx instanceof Date && vy instanceof Date) r = vx.getTime() - vy.getTime();
        else r = aTexto(vx).localeCompare(aTexto(vy), "es");
        return asc ? r : -r;
      });
    }
    return out;
  }, [a.filas, busqueda, orden]);

  const inicio = Math.max(0, Math.floor(scrollTop / ALTO_FILA) - 5);
  const fin = Math.min(filas.length, Math.ceil((scrollTop + altoVisible) / ALTO_FILA) + 5);
  const visibles = filas.slice(inicio, fin);

  const exportar = () => {
    const esc = (v: Celda, porc: boolean) => {
      if (v === null) return "";
      if (typeof v === "number") return String(porc ? v : v).replace(".", ",");
      const s = v instanceof Date ? fmtCelda(v) : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = [a.tabla.columnas.map((c) => esc(c.nombre, false)).join(";")];
    for (const f of filas) lineas.push(a.tabla.columnas.map((c, i) => esc(f[i], c.esPorcentaje)).join(";"));
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `${a.tabla.nombre.replace(/[^\w\dáéíóúñ -]/gi, "").slice(0, 60) || "datos"}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Tarjeta
      titulo={`${fmtNumero(filas.length)} filas`}
      accion={
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en la tabla…"
            aria-label="Buscar en la tabla"
            className="w-44 rounded-md border border-borde bg-superficie px-2 py-1 text-sm"
          />
          <Boton onClick={exportar}>
            <Download size={14} /> Exportar CSV
          </Boton>
        </div>
      }
    >
      <div ref={contRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="max-h-[70vh] overflow-auto rounded border border-borde">
        <table className="w-max min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
            <tr>
              {a.tabla.columnas.map((c, i) => (
                <th key={c.id} className="whitespace-nowrap px-3 py-2 font-medium">
                  <button onClick={() => setOrden(orden?.col === i ? (orden.asc ? { col: i, asc: false } : null) : { col: i, asc: true })} className="flex items-center gap-1 hover:text-texto">
                    {c.nombre}
                    {orden?.col === i && (orden.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inicio > 0 && (
              <tr style={{ height: inicio * ALTO_FILA }}>
                <td colSpan={a.tabla.columnas.length} />
              </tr>
            )}
            {visibles.map((f, k) => (
              <tr key={inicio + k} className="border-t border-borde/50" style={{ height: ALTO_FILA }}>
                {a.tabla.columnas.map((c, j) => (
                  <td key={c.id} className={cx("max-w-[280px] truncate whitespace-nowrap px-3", c.tipo === "medida" && "text-right tabular")} title={fmtCelda(f[j], c.esPorcentaje)}>
                    {fmtCelda(f[j], c.esPorcentaje)}
                  </td>
                ))}
              </tr>
            ))}
            {fin < filas.length && (
              <tr style={{ height: (filas.length - fin) * ALTO_FILA }}>
                <td colSpan={a.tabla.columnas.length} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}
