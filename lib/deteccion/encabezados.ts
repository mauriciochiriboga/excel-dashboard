import type { Celda } from "../tipos";
import type { Bloque } from "./bloques";

const esTexto = (v: Celda) => typeof v === "string" && v.trim() !== "";
const esVacia = (v: Celda) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

export interface Encabezado {
  /** Número de filas de encabezado (1 o 2). */
  filas: number;
  /** Nombre final por columna (ya fusionado "Padre · Hijo" si aplica). */
  nombres: string[];
  /** Nivel superior por columna cuando hay dos filas (para despivotar). */
  nivel1: (string | null)[];
  nivel2: (string | null)[];
  avisos: string[];
}

/**
 * Determina cuántas filas de encabezado tiene el bloque y construye los nombres.
 * Soporta 1 o 2 filas; expande celdas combinadas y rellena hacia la derecha el nivel 1.
 */
export function detectarEncabezado(filas: Celda[][], b: Bloque, combinadas: [number, number, number, number][]): Encabezado {
  const ancho = b.c1 - b.c0 + 1;
  const get = (r: number, c: number): Celda => filas[r]?.[c] ?? null;
  const avisos: string[] = [];

  // Expandir merges dentro del bloque: copiar valor de la esquina a todo el rango.
  const valorConMerge = (r: number, c: number): Celda => {
    const v = get(r, c);
    if (!esVacia(v)) return v;
    for (const [mr0, mc0, mr1, mc1] of combinadas) {
      if (r >= mr0 && r <= mr1 && c >= mc0 && c <= mc1) return get(mr0, mc0);
    }
    return null;
  };

  const fila = (r: number) => Array.from({ length: ancho }, (_, i) => valorConMerge(r, b.c0 + i));
  const proporcionTexto = (vals: Celda[]) => {
    const noVacios = vals.filter((v) => !esVacia(v));
    if (noVacios.length === 0) return 0;
    return noVacios.filter(esTexto).length / noVacios.length;
  };

  const f0 = fila(b.r0);
  const f1 = b.r1 > b.r0 ? fila(b.r0 + 1) : [];
  const f2 = b.r1 > b.r0 + 1 ? fila(b.r0 + 2) : [];

  const p0 = proporcionTexto(f0);
  const p1 = proporcionTexto(f1);
  const p2 = proporcionTexto(f2);

  let nFilasEnc = 1;
  // Dos filas si: fila 1 también es mayormente texto, y la fila 2 ya tiene datos (no texto puro),
  // o la fila 0 tiene huecos que la fila 1 completa (encabezado combinado).
  const huecosF0 = f0.filter(esVacia).length;
  // Huecos "crudos" de la fila 0, sin expandir merges: un encabezado combinado horizontal
  // tiene texto en la esquina y vacío a su derecha.
  const huecosF0Crudos = Array.from({ length: ancho }, (_, i) => get(b.r0, b.c0 + i)).filter(esVacia).length;
  const huecosF1 = f1.filter(esVacia).length;
  const f1Llena = f1.length > 0 && huecosF1 <= ancho * 0.1;
  const f0ConHuecos = huecosF0Crudos >= ancho * 0.3 && huecosF0Crudos < ancho;
  if (f1.length && f0ConHuecos && f1Llena && p0 >= 0.8) {
    nFilasEnc = 2; // nivel 1 combinado + nivel 2 completo (texto o números)
  } else if (f1.length && p1 >= 0.6 && (p2 < 0.9 || huecosF0 > 0) && (huecosF0 > 0 || p2 < p1)) {
    // Evitar tomar la primera fila de datos (texto en columnas categóricas) como encabezado:
    // si fila 0 no tiene huecos y fila 2 es tan "texto" como fila 1, es una sola fila.
    if (!(huecosF0 === 0 && huecosF1 === 0 && p2 >= p1 && p2 >= 0.9)) nFilasEnc = 2;
  }
  if (p0 < 0.5) avisos.push("La primera fila no parece un encabezado claro; se usó igual.");

  const nivel1: (string | null)[] = [];
  const nivel2: (string | null)[] = [];
  const nombres: string[] = [];

  if (nFilasEnc === 1) {
    for (let i = 0; i < ancho; i++) {
      const v = f0[i];
      nivel1.push(null);
      nivel2.push(null);
      nombres.push(aTexto(v) || `Columna ${i + 1}`);
    }
  } else {
    // Rellenar nivel 1 hacia la derecha cuando está vacío (celdas combinadas sin merge explícito).
    let ultimo: string | null = null;
    for (let i = 0; i < ancho; i++) {
      const v = aTexto(f0[i]);
      if (v) ultimo = v;
      nivel1.push(v || ultimo);
    }
    // Columnas de la izquierda sin nivel 2 son etiquetas de fila: su nombre es el nivel 1 propio.
    for (let i = 0; i < ancho; i++) {
      const propio = aTexto(f0[i]);
      let v2 = aTexto(f1[i]);
      if (v2 && v2 === propio) v2 = ""; // celda combinada vertical: no hay segundo nivel
      nivel2.push(v2 || null);
      if (v2 && propio) nombres.push(`${propio} · ${v2}`);
      else if (v2 && nivel1[i]) nombres.push(`${nivel1[i]} · ${v2}`);
      else if (v2) nombres.push(v2);
      else nombres.push(nivel1[i] || `Columna ${i + 1}`);
      if (!v2) nivel1[i] = propio || nivel1[i];
    }
    avisos.push("Encabezado de dos filas fusionado.");
  }

  // Deduplicar nombres
  const vistos = new Map<string, number>();
  for (let i = 0; i < nombres.length; i++) {
    const n = nombres[i];
    const k = vistos.get(n) ?? 0;
    if (k > 0) nombres[i] = `${n} (${k + 1})`;
    vistos.set(n, k + 1);
  }

  return { filas: nFilasEnc, nombres, nivel1, nivel2, avisos };
}

export function aTexto(v: Celda): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
}
