"use client";
import { X, FilterX } from "lucide-react";
import { useStore, type Pestana } from "@/lib/store";
import { useAnalisis } from "./useAnalisis";
import { Boton, Etiqueta, Vacio, cx } from "@/components/ui";
import { etiquetaValor } from "@/lib/analisis";
import { fmtFecha, fmtNumero } from "@/lib/formato";
import { Resumen } from "./Resumen";
import { Tendencias } from "./Tendencias";
import { Segmentos } from "./Segmentos";
import { Distribucion } from "./Distribucion";
import { Relaciones } from "./Relaciones";
import { Explorador } from "./Explorador";
import { Datos } from "./Datos";

const PESTANAS: { v: Pestana; t: string }[] = [
  { v: "resumen", t: "Resumen" },
  { v: "tendencias", t: "Tendencias" },
  { v: "segmentos", t: "Segmentos" },
  { v: "distribucion", t: "Distribución" },
  { v: "relaciones", t: "Relaciones" },
  { v: "explorador", t: "Explorador" },
  { v: "datos", t: "Datos" },
];

export function Dashboard() {
  const a = useAnalisis();
  const pestana = useStore((s) => s.pestana);
  const setPestana = useStore((s) => s.setPestana);
  if (!a) return <Vacio titulo="Selecciona una tabla" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold" title={a.tabla.nombre}>
          {a.tabla.nombre}
        </h1>
        <span className="text-sm text-texto-suave tabular">
          {fmtNumero(a.filas.length)}
          {a.filtrado ? ` de ${fmtNumero(a.tabla.filas.length)}` : ""} filas
        </span>
      </div>

      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Pestañas del dashboard">
        <div className="flex w-max gap-1 border-b border-borde">
          {PESTANAS.map((p) => (
            <button
              key={p.v}
              onClick={() => setPestana(p.v)}
              aria-current={pestana === p.v ? "page" : undefined}
              className={cx(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
                pestana === p.v ? "border-acento font-medium text-acento" : "border-transparent text-texto-suave hover:text-texto",
              )}
            >
              {p.t}
            </button>
          ))}
        </div>
      </nav>

      <CintaFiltros />

      {pestana === "resumen" && <Resumen a={a} />}
      {pestana === "tendencias" && <Tendencias a={a} />}
      {pestana === "segmentos" && <Segmentos a={a} />}
      {pestana === "distribucion" && <Distribucion a={a} />}
      {pestana === "relaciones" && <Relaciones a={a} />}
      {pestana === "explorador" && <Explorador a={a} />}
      {pestana === "datos" && <Datos a={a} />}
    </div>
  );
}

export function CintaFiltros() {
  const filtros = useStore((s) => s.filtros);
  const tabla = useStore((s) => s.tablas.find((t) => t.id === s.tablaActiva));
  const quitarFiltro = useStore((s) => s.quitarFiltro);
  const limpiarFiltros = useStore((s) => s.limpiarFiltros);
  if (!tabla || filtros.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-borde bg-superficie px-3 py-2 text-sm">
      <span className="text-texto-suave">Filtros:</span>
      {filtros.map((f) => {
        const col = tabla.columnas.find((c) => c.id === f.columnaId);
        if (!col) return null;
        const texto = f.rango
          ? `${col.nombre}: ${col.tipo === "fecha" ? `${fmtFecha(new Date(f.rango[0]))} – ${fmtFecha(new Date(f.rango[1]))}` : `${fmtNumero(f.rango[0])} – ${fmtNumero(f.rango[1])}`}`
          : `${col.nombre}: ${f.valores.map((v) => etiquetaValor(v, col)).join(", ")}`;
        return (
          <Etiqueta key={f.columnaId} tono="acento" className="gap-1 pr-1">
            <span className="max-w-[60vw] truncate">{texto}</span>
            <button aria-label={`Quitar filtro ${col.nombre}`} onClick={() => quitarFiltro(f.columnaId)} className="rounded-full p-0.5 hover:bg-acento/20">
              <X size={12} />
            </button>
          </Etiqueta>
        );
      })}
      <Boton variante="fantasma" className="ml-auto" onClick={limpiarFiltros}>
        <FilterX size={14} /> Limpiar
      </Boton>
    </div>
  );
}
