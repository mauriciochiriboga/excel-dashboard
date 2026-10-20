import type { Celda } from "../tipos";

export interface Bloque {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

const esVacia = (v: Celda) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/**
 * Encuentra bloques rectangulares separados por filas o columnas completamente vacías.
 * Algoritmo: segmenta por filas vacías; dentro de cada segmento, segmenta por columnas vacías.
 * Luego vuelve a segmentar por filas dentro de cada sub-bloque (tablas lado a lado con
 * distinta altura).
 */
export function encontrarBloques(filas: Celda[][]): Bloque[] {
  const nFilas = filas.length;
  let nCols = 0;
  for (const f of filas) if (f && f.length > nCols) nCols = f.length;
  if (nFilas === 0 || nCols === 0) return [];

  const get = (r: number, c: number): Celda => (filas[r] ? (filas[r][c] ?? null) : null);

  const resultado: Bloque[] = [];
  const pendientes: Bloque[] = [{ r0: 0, c0: 0, r1: nFilas - 1, c1: nCols - 1 }];

  while (pendientes.length) {
    const b = pendientes.pop()!;
    // Segmentar por filas vacías
    const segFilas = segmentar(b.r0, b.r1, (r) => {
      for (let c = b.c0; c <= b.c1; c++) if (!esVacia(get(r, c))) return false;
      return true;
    });
    if (segFilas.length > 1) {
      for (const [r0, r1] of segFilas) pendientes.push({ ...b, r0, r1 });
      continue;
    }
    if (segFilas.length === 0) continue;
    const [r0, r1] = segFilas[0];
    // Segmentar por columnas vacías
    const segCols = segmentar(b.c0, b.c1, (c) => {
      for (let r = r0; r <= r1; r++) if (!esVacia(get(r, c))) return false;
      return true;
    });
    if (segCols.length > 1) {
      for (const [c0, c1] of segCols) pendientes.push({ r0, r1, c0, c1 });
      continue;
    }
    if (segCols.length === 0) continue;
    resultado.push({ r0, r1, c0: segCols[0][0], c1: segCols[0][1] });
  }
  resultado.sort((a, b) => a.r0 - b.r0 || a.c0 - b.c0);
  return unirEncabezadosSeparados(resultado, filas);
}

/**
 * Un bloque corto (≤ 3 filas) cuya última fila es mayormente texto, seguido a ≤ 2 filas de
 * distancia por un bloque cuya primera fila es mayormente no-texto y que solapa en columnas,
 * es un encabezado separado de sus datos por una fila vacía: se fusionan.
 */
function unirEncabezadosSeparados(bloques: Bloque[], filas: Celda[][]): Bloque[] {
  const propTexto = (r: number, c0: number, c1: number) => {
    let n = 0, t = 0;
    for (let c = c0; c <= c1; c++) {
      const v = filas[r]?.[c];
      if (!esVacia(v)) { n++; if (typeof v === "string") t++; }
    }
    return n === 0 ? 0 : t / n;
  };
  const out: Bloque[] = [];
  const usados = new Set<number>();
  for (let i = 0; i < bloques.length; i++) {
    if (usados.has(i)) continue;
    const a = bloques[i];
    if (a.r1 - a.r0 + 1 <= 3) {
      const j = bloques.findIndex((b, k) => k !== i && !usados.has(k) && b.r0 > a.r1 && b.r0 - a.r1 <= 2 && b.c0 <= a.c1 && b.c1 >= a.c0 && b.r1 - b.r0 >= 1);
      if (j >= 0) {
        const b = bloques[j];
        if (propTexto(a.r1, a.c0, a.c1) >= 0.7 && propTexto(b.r0, b.c0, b.c1) < 0.7) {
          usados.add(i); usados.add(j);
          out.push({ r0: a.r0, r1: b.r1, c0: Math.min(a.c0, b.c0), c1: Math.max(a.c1, b.c1) });
          continue;
        }
      }
    }
    usados.add(i);
    out.push(a);
  }
  out.sort((a, b) => a.r0 - b.r0 || a.c0 - b.c0);
  return out;
}

/** Devuelve rangos [inicio, fin] contiguos donde `vacio(i)` es false. */
function segmentar(desde: number, hasta: number, vacio: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let ini: number | null = null;
  for (let i = desde; i <= hasta; i++) {
    if (vacio(i)) {
      if (ini !== null) out.push([ini, i - 1]);
      ini = null;
    } else if (ini === null) ini = i;
  }
  if (ini !== null) out.push([ini, hasta]);
  return out;
}

/**
 * Une un bloque de título (1 fila, pocas celdas) con el bloque de datos inmediatamente
 * debajo (separados por ≤ 2 filas vacías y solapados en columnas). Devuelve pares.
 */
export function asociarTitulos(bloques: Bloque[], filas: Celda[][]): { bloque: Bloque; titulo: string | null; notas: Bloque[] }[] {
  const usados = new Set<number>();
  const out: { bloque: Bloque; titulo: string | null; notas: Bloque[] }[] = [];
  const esTexto = (b: Bloque) => {
    let celdas = 0;
    let textos = 0;
    for (let r = b.r0; r <= b.r1; r++)
      for (let c = b.c0; c <= b.c1; c++) {
        const v = filas[r]?.[c];
        if (!esVacia(v)) {
          celdas++;
          if (typeof v === "string") textos++;
        }
      }
    return { celdas, textos };
  };

  for (let i = 0; i < bloques.length; i++) {
    if (usados.has(i)) continue;
    const b = bloques[i];
    const alto = b.r1 - b.r0 + 1;
    const ancho = b.c1 - b.c0 + 1;
    if (alto < 2 || ancho < 2) continue; // no es tabla
    usados.add(i);
    // Buscar título: bloque de 1-2 filas justo arriba, pocas celdas, texto.
    let titulo: string | null = null;
    for (let j = 0; j < bloques.length; j++) {
      if (usados.has(j)) continue;
      const t = bloques[j];
      const { celdas, textos } = esTexto(t);
      const alturaT = t.r1 - t.r0 + 1;
      if (alturaT <= 2 && celdas <= 3 && textos === celdas && t.r1 < b.r0 && b.r0 - t.r1 <= 3 && t.c0 <= b.c1 && t.c1 >= b.c0) {
        const partes: string[] = [];
        for (let r = t.r0; r <= t.r1; r++)
          for (let c = t.c0; c <= t.c1; c++) {
            const v = filas[r]?.[c];
            if (typeof v === "string") partes.push(v.trim());
          }
        titulo = partes.join(" ").replace(/\s+/g, " ").trim();
        usados.add(j);
        break;
      }
    }
    // Notas al pie: bloques de solo texto, ≤ 2 columnas, justo debajo.
    const notas: Bloque[] = [];
    for (let j = 0; j < bloques.length; j++) {
      if (usados.has(j)) continue;
      const t = bloques[j];
      const { celdas, textos } = esTexto(t);
      if (t.r0 > b.r1 && t.r0 - b.r1 <= 3 && t.c1 - t.c0 + 1 <= 2 && textos === celdas && t.c0 <= b.c1 && t.c1 >= b.c0) {
        notas.push(t);
        usados.add(j);
      }
    }
    out.push({ bloque: b, titulo, notas });
  }
  return out;
}
