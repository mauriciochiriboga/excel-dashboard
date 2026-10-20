import type { Celda } from "../tipos";
import type { Encabezado } from "./encabezados";

const RE_ANIO = /^((19|20)\d{2})\s*[\(\[]?\s*[a-zA-Z]{0,3}\**\s*[\)\]]?\s*\/?\s*$/;
const RE_MES = /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i;

export interface ResultadoDespivote {
  nombres: string[];
  filas: Celda[][];
  descripcion: string;
}

/**
 * Convierte tablas "anchas" a formato largo cuando el encabezado contiene una dimensión
 * repetida en columnas (años, meses, o un nivel 1 que se repite con el mismo nivel 2).
 *
 * Caso A (1 fila): [Región, 2019, 2020, 2021] → [Región, Año, Valor]
 * Caso B (2 filas): [Región, 2019·Total, 2019·Hombre, 2020·Total, 2020·Hombre]
 *                  → [Región, Año, Total, Hombre]
 * Devuelve null si no aplica.
 */
export function despivotar(enc: Encabezado, filas: Celda[][]): ResultadoDespivote | null {
  const ancho = enc.nombres.length;

  if (enc.filas === 2) {
    // Columnas con nivel 2 son "valor"; sin nivel 2 son etiquetas.
    const etiquetas: number[] = [];
    const valores: number[] = [];
    for (let i = 0; i < ancho; i++) (enc.nivel2[i] ? valores : etiquetas).push(i);
    if (valores.length < 2 || etiquetas.length === 0) return null;
    // Agrupar por nivel 1
    const grupos = new Map<string, number[]>();
    for (const i of valores) {
      const k = enc.nivel1[i] ?? "";
      grupos.set(k, [...(grupos.get(k) ?? []), i]);
    }
    if (grupos.size < 2) return null;
    // Todos los grupos deben tener el mismo conjunto de nivel 2
    const firmas = [...grupos.values()].map((idx) => idx.map((i) => enc.nivel2[i]).join("|"));
    if (new Set(firmas).size !== 1) return null;
    const subcols = grupos.values().next().value!.map((i) => enc.nivel2[i] as string);
    const clavesGrupo = [...grupos.keys()];
    const nombreDim = nombrarDimension(clavesGrupo);
    const nombres = [...etiquetas.map((i) => enc.nombres[i]), nombreDim, ...subcols];
    const out: Celda[][] = [];
    for (const f of filas) {
      for (const [k, idx] of grupos) {
        const fila: Celda[] = etiquetas.map((i) => f[i] ?? null);
        fila.push(convertirClave(k));
        for (const i of idx) fila.push(f[i] ?? null);
        if (idx.every((i) => f[i] === null || f[i] === undefined)) continue;
        out.push(fila);
      }
    }
    return { nombres, filas: out, descripcion: `Tabla ancha convertida a formato largo: ${grupos.size} grupos de "${nombreDim}" × ${subcols.length} medidas.` };
  }

  // Caso A: una fila, varias columnas cuyo nombre es año o mes.
  const esDim = (n: string) => RE_ANIO.test(n.trim()) || RE_MES.test(n.trim());
  const dimCols = enc.nombres.map((n, i) => (esDim(n) ? i : -1)).filter((i) => i >= 0);
  if (dimCols.length < 3) return null;
  const etiquetas = enc.nombres.map((_, i) => i).filter((i) => !dimCols.includes(i));
  if (etiquetas.length === 0) return null;
  const nombreDim = nombrarDimension(dimCols.map((i) => enc.nombres[i]));
  const nombres = [...etiquetas.map((i) => enc.nombres[i]), nombreDim, "Valor"];
  const out: Celda[][] = [];
  for (const f of filas) {
    for (const i of dimCols) {
      const v = f[i];
      if (v === null || v === undefined) continue;
      out.push([...etiquetas.map((j) => f[j] ?? null), convertirClave(enc.nombres[i]), v]);
    }
  }
  return { nombres, filas: out, descripcion: `Tabla ancha convertida a formato largo: ${dimCols.length} columnas de "${nombreDim}" → una columna Valor.` };
}

function nombrarDimension(claves: string[]): string {
  if (claves.every((k) => RE_ANIO.test(k.trim()))) return "Año";
  if (claves.every((k) => RE_MES.test(k.trim()))) return "Mes";
  return "Serie";
}

function convertirClave(k: string): Celda {
  const t = k.trim();
  const m = t.match(/^((19|20)\d{2})/);
  if (m && RE_ANIO.test(t)) return Number(m[1]);
  return t;
}

/**
 * Rellena hacia abajo las columnas de etiqueta cuyas celdas vacías heredan el valor
 * anterior (celdas combinadas verticales o formato de informe). Solo si la columna
 * es de texto y tiene ≥ 30 % de huecos y ningún número.
 */
export function rellenarHaciaAbajo(filas: Celda[][], nombres: string[]): string[] {
  const avisos: string[] = [];
  const ancho = nombres.length;
  for (let c = 0; c < ancho; c++) {
    let textos = 0, vacios = 0, numeros = 0;
    for (const f of filas) {
      const v = f[c];
      if (v === null || v === undefined) vacios++;
      else if (typeof v === "number") numeros++;
      else textos++;
    }
    if (numeros > 0 || textos === 0 || vacios / filas.length < 0.3) continue;
    // Solo columnas a la izquierda de la primera medida numérica
    let ultimo: Celda = null;
    for (const f of filas) {
      if (f[c] === null || f[c] === undefined) f[c] = ultimo;
      else ultimo = f[c];
    }
    avisos.push(`Columna "${nombres[c]}": celdas vacías rellenadas con el valor superior.`);
  }
  return avisos;
}
