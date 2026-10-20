import type { Celda } from "../tipos";

const RE_TOTAL = /^\s*(total(es)?|sub\s*total(es)?|suma|gran total|total general|total nacional)\b/i;

/**
 * Devuelve los índices de filas que son totales: por etiqueta ("Total…") o porque sus
 * medidas igualan la suma del resto (tolerancia 0,5 %). Solo revisa las últimas filas
 * del cuerpo y filas con etiqueta explícita en cualquier posición.
 */
export function detectarTotales(filas: Celda[][], colsNumericas: number[]): Set<number> {
  const out = new Set<number>();
  if (filas.length < 3) return out;

  for (let r = 0; r < filas.length; r++) {
    const primera = primeraCeldaTexto(filas[r]);
    if (primera && RE_TOTAL.test(primera)) out.add(r);
  }

  // Última(s) fila(s) sin etiqueta pero cuya suma coincide.
  if (colsNumericas.length > 0) {
    for (let k = filas.length - 1; k >= Math.max(0, filas.length - 2); k--) {
      if (out.has(k)) continue;
      let coincide = 0;
      let comparables = 0;
      for (const c of colsNumericas) {
        const v = filas[k][c];
        if (typeof v !== "number") continue;
        let suma = 0;
        for (let r = 0; r < filas.length; r++) {
          if (r === k || out.has(r)) continue;
          const x = filas[r][c];
          if (typeof x === "number") suma += x;
        }
        comparables++;
        if (Math.abs(suma - v) <= Math.abs(v) * 0.005 + 1e-9 && v !== 0) coincide++;
      }
      if (comparables >= 1 && coincide === comparables) out.add(k);
    }
  }
  return out;
}

function primeraCeldaTexto(fila: Celda[]): string | null {
  for (const v of fila ?? []) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}
