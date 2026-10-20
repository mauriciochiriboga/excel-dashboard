"use client";
import { useStore, useTablaActiva } from "@/lib/store";
import type { Agregacion, Columna, TipoColumna } from "@/lib/tipos";
import { Boton, Etiqueta, Tarjeta, Vacio, cx } from "@/components/ui";
import { fmtNumero } from "@/lib/formato";
import { ArrowRight, Info, Star } from "lucide-react";

const TIPOS: { v: TipoColumna; t: string }[] = [
  { v: "fecha", t: "Fecha" },
  { v: "categoria", t: "Categoría" },
  { v: "medida", t: "Medida" },
  { v: "identificador", t: "Identificador" },
  { v: "estado", t: "Estado" },
  { v: "texto", t: "Texto libre" },
];

const TONO: Record<TipoColumna, "neutro" | "acento" | "positivo" | "aviso" | "negativo"> = {
  fecha: "aviso",
  categoria: "acento",
  medida: "positivo",
  identificador: "neutro",
  estado: "acento",
  texto: "neutro",
};

export function nombreTipo(t: TipoColumna) {
  return TIPOS.find((x) => x.v === t)?.t ?? t;
}

export function Entendimiento() {
  const tablas = useStore((s) => s.tablas);
  const archivoActivo = useStore((s) => s.archivoActivo);
  const seleccionarTabla = useStore((s) => s.seleccionarTabla);
  const setVista = useStore((s) => s.setVista);
  const cambiarTipo = useStore((s) => s.cambiarTipo);
  const cambiarAgregacion = useStore((s) => s.cambiarAgregacion);
  const marcarPrincipal = useStore((s) => s.marcarPrincipal);
  const tabla = useTablaActiva();
  const archivo = useStore((s) => s.archivos.find((a) => a.id === s.archivoActivo));
  const lista = tablas.filter((t) => t.archivoId === archivoActivo);

  if (!tabla) return <Vacio titulo="No hay ninguna tabla seleccionada" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Tarjeta titulo={`Tablas detectadas (${lista.length})`} className="lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-auto">
        {archivo && (
          <p className="mb-2 text-xs text-texto-suave">
            {archivo.hojas.length} hoja(s) · leído en {fmtNumero(archivo.tiempoMs / 1000, 1)} s
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {lista.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => seleccionarTabla(t.id)}
                className={cx(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  t.id === tabla.id ? "bg-acento-suave text-acento" : "hover:bg-superficie-2",
                )}
              >
                <span className="block truncate font-medium" title={t.nombre}>
                  {t.nombre}
                </span>
                <span className="block text-xs text-texto-suave">
                  Hoja {t.hoja} · {fmtNumero(t.filas.length)} filas × {t.columnas.length} columnas
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <div className="flex min-w-0 flex-col gap-4">
        <Tarjeta
          titulo={tabla.nombre}
          accion={
            <Boton variante="primario" onClick={() => setVista("dashboard")}>
              Ver dashboard <ArrowRight size={16} />
            </Boton>
          }
        >
          <p className="text-sm text-texto-suave">
            Hoja <span className="font-medium text-texto">{tabla.hoja}</span>, celdas {celda(tabla.rango.c0, tabla.rango.r0)}:{celda(tabla.rango.c1, tabla.rango.r1)} ·{" "}
            {fmtNumero(tabla.filas.length)} filas · {tabla.columnas.length} columnas
          </p>
          {tabla.avisos.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {tabla.avisos.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-texto-suave">
                  <Info size={14} className="mt-0.5 shrink-0 text-acento" /> {a}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Columnas y cómo las interpreté">
          <p className="mb-3 text-sm text-texto-suave">Corrige cualquier interpretación aquí. El dashboard se recalcula al instante.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-texto-suave">
                <tr className="border-b border-borde">
                  <th className="py-2 pr-3 font-medium">Columna</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Agregación</th>
                  <th className="py-2 pr-3 font-medium text-right">Distintos</th>
                  <th className="py-2 pr-3 font-medium text-right">Vacíos</th>
                  <th className="py-2 pr-3 font-medium">Ejemplo</th>
                  <th className="py-2 font-medium">Principal</th>
                </tr>
              </thead>
              <tbody>
                {tabla.columnas.map((c) => (
                  <FilaColumna
                    key={c.id}
                    c={c}
                    onTipo={(t) => cambiarTipo(tabla.id, c.id, t)}
                    onAgregacion={(a) => cambiarAgregacion(tabla.id, c.id, a)}
                    onPrincipal={() => marcarPrincipal(tabla.id, c.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Jerarquías detectadas">
          {tabla.jerarquias.length === 0 ? (
            <p className="text-sm text-texto-suave">No encontré jerarquías entre categorías (por ejemplo región → sucursal).</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tabla.jerarquias.map((j, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1 text-sm">
                  {j.niveles.map((id, k) => (
                    <span key={id} className="flex items-center gap-1">
                      <Etiqueta tono="acento">{tabla.columnas.find((c) => c.id === id)?.nombre}</Etiqueta>
                      {k < j.niveles.length - 1 && <ArrowRight size={14} className="text-texto-suave" />}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

function FilaColumna({ c, onTipo, onAgregacion, onPrincipal }: { c: Columna; onTipo: (t: TipoColumna) => void; onAgregacion: (a: Agregacion) => void; onPrincipal: () => void }) {
  const corregida = c.tipo !== c.tipoDetectado;
  return (
    <tr className="border-b border-borde/60 last:border-0">
      <td className="max-w-[220px] py-2 pr-3">
        <span className="block truncate font-medium" title={c.nombre}>
          {c.nombre}
        </span>
        {corregida && <span className="text-xs text-aviso">corregido (detecté {nombreTipo(c.tipoDetectado).toLowerCase()})</span>}
      </td>
      <td className="py-2 pr-3">
        <select aria-label={`Tipo de ${c.nombre}`} value={c.tipo} onChange={(e) => onTipo(e.target.value as TipoColumna)} className="rounded-md border border-borde bg-superficie px-2 py-1">
          {TIPOS.map((t) => (
            <option key={t.v} value={t.v}>
              {t.t}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        {c.tipo === "medida" ? (
          <select aria-label={`Agregación de ${c.nombre}`} value={c.agregacion} onChange={(e) => onAgregacion(e.target.value as Agregacion)} className="rounded-md border border-borde bg-superficie px-2 py-1">
            <option value="suma">Suma</option>
            <option value="promedio">Promedio</option>
          </select>
        ) : (
          <Etiqueta tono={TONO[c.tipo]}>{c.tipo === "fecha" && c.granularidad ? `por ${c.granularidad === "anio" ? "año" : c.granularidad}` : "conteo"}</Etiqueta>
        )}
      </td>
      <td className="py-2 pr-3 text-right tabular">{fmtNumero(c.distintos)}</td>
      <td className="py-2 pr-3 text-right tabular text-texto-suave">{c.nulos ? fmtNumero(c.nulos) : "—"}</td>
      <td className="max-w-[160px] truncate py-2 pr-3 text-texto-suave" title={c.ejemplo}>
        {c.ejemplo}
      </td>
      <td className="py-2">
        {c.tipo === "medida" && (
          <button
            onClick={onPrincipal}
            aria-pressed={c.esPrincipal}
            title={c.esPrincipal ? "Medida principal" : "Marcar como medida principal"}
            className={cx("rounded p-1", c.esPrincipal ? "text-aviso" : "text-texto-suave hover:text-texto")}
          >
            <Star size={16} fill={c.esPrincipal ? "currentColor" : "none"} />
          </button>
        )}
      </td>
    </tr>
  );
}

function celda(c: number, r: number) {
  let s = "";
  let n = c;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${s}${r + 1}`;
}
