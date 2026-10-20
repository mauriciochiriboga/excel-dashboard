"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import type { Analisis } from "./useAnalisis";
import { useStore } from "@/lib/store";
import { Boton, Tarjeta, Vacio } from "@/components/ui";
import { GraficoBarras } from "@/components/graficos/Series";
import { agruparPor, claveValor, etiquetaValor } from "@/lib/analisis";
import type { Celda } from "@/lib/tipos";
import { fmtCelda, fmtNumero } from "@/lib/formato";

/** Drill-down por jerarquía: región → sucursal → registro. Cada nivel filtra el siguiente. */
export function Explorador({ a }: { a: Analisis }) {
  const [jerIdx, setJerIdx] = useState(0);
  const [ruta, setRuta] = useState<{ columnaId: string; valor: Celda; etiqueta: string }[]>([]);
  const fijarFiltro = useStore((s) => s.fijarFiltro);
  const setPestana = useStore((s) => s.setPestana);

  // Si no hay jerarquías, se construye una con las categorías de menor a mayor cardinalidad.
  const jerarquias = useMemo(() => {
    if (a.tabla.jerarquias.length > 0) return a.tabla.jerarquias;
    const cats = [...a.categorias].sort((x, y) => x.distintos - y.distintos).slice(0, 3);
    return cats.length >= 1 ? [{ niveles: cats.map((c) => c.id) }] : [];
  }, [a]);
  const jer = jerarquias[Math.min(jerIdx, jerarquias.length - 1)];

  const nivel = ruta.length;
  const columnaNivel = jer ? a.tabla.columnas.find((c) => c.id === jer.niveles[nivel]) : undefined;

  const filasRuta = useMemo(() => {
    let filas = a.filas;
    for (const paso of ruta) {
      const col = a.tabla.columnas.find((c) => c.id === paso.columnaId)!;
      const idx = a.tabla.columnas.indexOf(col);
      const k = claveValor(paso.valor, col);
      filas = filas.filter((f) => claveValor(f[idx], col) === k);
    }
    return filas;
  }, [a, ruta]);

  const puntos = useMemo(() => (columnaNivel ? agruparPor(filasRuta, a.tabla, columnaNivel.id, a.medida, 30) : []), [filasRuta, a, columnaNivel]);

  if (!jer) return <Vacio titulo="No hay categorías para explorar" />;

  const nombreNivel = (id: string) => a.tabla.columnas.find((c) => c.id === id)?.nombre ?? id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {jerarquias.length > 1 && (
          <label className="flex items-center gap-2">
            Jerarquía
            <select value={jerIdx} onChange={(e) => { setJerIdx(Number(e.target.value)); setRuta([]); }} className="rounded-md border border-borde bg-superficie px-2 py-1">
              {jerarquias.map((j, i) => (
                <option key={i} value={i}>
                  {j.niveles.map(nombreNivel).join(" → ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1">
          <button onClick={() => setRuta([])} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-superficie-2">
            <Home size={14} /> Todo
          </button>
          {ruta.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-texto-suave" />
              <button onClick={() => setRuta(ruta.slice(0, i + 1))} className="rounded px-2 py-1 hover:bg-superficie-2">
                {nombreNivel(p.columnaId)}: <b>{p.etiqueta}</b>
              </button>
            </span>
          ))}
        </nav>
        <span className="ml-auto tabular text-texto-suave">{fmtNumero(filasRuta.length)} registros</span>
        {ruta.length > 0 && (
          <Boton
            onClick={() => {
              for (const p of ruta) fijarFiltro({ columnaId: p.columnaId, valores: [p.valor] });
              setPestana("resumen");
            }}
          >
            Aplicar como filtro global
          </Boton>
        )}
      </div>

      {columnaNivel ? (
        <Tarjeta titulo={`${a.medida ? a.medida.nombre : "Registros"} por ${columnaNivel.nombre} · clic para bajar un nivel`}>
          <GraficoBarras
            puntos={puntos}
            nombre={a.medida?.nombre ?? "Registros"}
            porcentaje={a.medida?.esPorcentaje}
            onClick={(p) => {
              const idx = a.tabla.columnas.indexOf(columnaNivel);
              const crudo = filasRuta.find((f) => claveValor(f[idx], columnaNivel) === p.clave)?.[idx] ?? p.clave;
              setRuta([...ruta, { columnaId: columnaNivel.id, valor: crudo, etiqueta: etiquetaValor(crudo, columnaNivel) }]);
            }}
          />
        </Tarjeta>
      ) : (
        <Tarjeta titulo={`Registros (${fmtNumero(filasRuta.length)})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-texto-suave">
                <tr className="border-b border-borde">
                  {a.tabla.columnas.map((c) => (
                    <th key={c.id} className="whitespace-nowrap py-2 pr-3 font-medium">{c.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasRuta.slice(0, 200).map((f, i) => (
                  <tr key={i} className="border-b border-borde/50">
                    {a.tabla.columnas.map((c, j) => (
                      <td key={c.id} className={`whitespace-nowrap py-1.5 pr-3 ${c.tipo === "medida" ? "text-right tabular" : ""}`}>{fmtCelda(f[j], c.esPorcentaje)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filasRuta.length > 200 && <p className="mt-2 text-xs text-texto-suave">Se muestran 200 de {fmtNumero(filasRuta.length)}. Usa la pestaña Datos para ver todo.</p>}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
