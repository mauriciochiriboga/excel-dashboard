import * as XLSX from "xlsx";
import type { Celda, HojaCruda } from "../tipos";

/** Convierte el valor de una celda SheetJS a nuestro tipo Celda. */
function normalizar(c: XLSX.CellObject | undefined): Celda {
  if (!c || c.v === undefined || c.v === null) return null;
  if (c.t === "e") return null; // #N/A, #DIV/0!...
  if (c.t === "d") {
    // SheetJS entrega la fecha como medianoche UTC; la reconstruimos en hora local
    // con los mismos componentes para que no retroceda un día en zonas negativas.
    const d = c.v as Date;
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  }
  if (c.t === "b") return Boolean(c.v);
  if (c.t === "n") {
    const n = c.v as number;
    return Number.isFinite(n) ? n : null;
  }
  const s = String(c.v).trim();
  return s === "" ? null : s;
}

/** Extrae una hoja densa a matriz compacta, recortando filas/columnas vacías al final. */
export function extraerHoja(nombre: string, ws: XLSX.WorkSheet): HojaCruda {
  const data = (ws as unknown as { "!data"?: (XLSX.CellObject | undefined)[][] })["!data"] ?? [];
  let maxC = -1;
  let maxR = -1;
  const filas: Celda[][] = [];
  for (let r = 0; r < data.length; r++) {
    const fila = data[r];
    if (!fila) {
      filas.push([]);
      continue;
    }
    const out: Celda[] = [];
    let ultimo = -1;
    for (let c = 0; c < fila.length; c++) {
      const v = normalizar(fila[c]);
      out.push(v);
      if (v !== null) ultimo = c;
    }
    out.length = ultimo + 1;
    if (ultimo >= 0) {
      maxR = r;
      if (ultimo > maxC) maxC = ultimo;
    }
    filas.push(out);
  }
  filas.length = maxR + 1;
  const combinadas: [number, number, number, number][] = (ws["!merges"] ?? [])
    .filter((m) => m.s.r <= maxR && m.s.c <= maxC)
    .map((m) => [m.s.r, m.s.c, m.e.r, m.e.c]);
  return { nombre, filas, combinadas };
}


/** Para CSV con coma decimal: reinterpreta celdas de texto "1.234,56" como número. */
export function convertirDecimalComa(wb: XLSX.WorkBook) {
  const re = /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/;
  for (const n of wb.SheetNames) {
    const ws = wb.Sheets[n] as unknown as { "!data"?: (XLSX.CellObject | undefined)[][] };
    for (const fila of ws["!data"] ?? []) {
      if (!fila) continue;
      for (const c of fila) {
        if (c && c.t === "s" && typeof c.v === "string" && re.test(c.v.trim())) {
          const num = Number(c.v.trim().replace(/\./g, "").replace(",", "."));
          if (Number.isFinite(num)) { c.t = "n"; c.v = num; }
        }
      }
    }
  }
}
