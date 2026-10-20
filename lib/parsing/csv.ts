/** Detecta separador de campos y si el decimal usa coma, mirando las primeras líneas. */
export function detectarCsv(texto: string): { separador: string; decimalComa: boolean } {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 50);
  const candidatos = [",", ";", "\t", "|"];
  let mejor = ",";
  let mejorPuntaje = -1;
  for (const sep of candidatos) {
    const conteos = lineas.map((l) => contarFuera(l, sep));
    if (conteos.length === 0) continue;
    const media = conteos.reduce((a, b) => a + b, 0) / conteos.length;
    if (media < 1) continue;
    // Consistencia: cuántas líneas tienen exactamente la moda.
    const moda = modaDe(conteos);
    const consistencia = conteos.filter((c) => c === moda).length / conteos.length;
    const puntaje = consistencia * 10 + moda;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = sep;
    }
  }
  // Decimal con coma: si el separador no es "," y aparecen números tipo 12,5 sin punto decimal.
  let decimalComa = false;
  if (mejor !== ",") {
    const cuerpo = lineas.slice(1).join("\n");
    const conComa = (cuerpo.match(/\d,\d/g) ?? []).length;
    const conPunto = (cuerpo.match(/\d\.\d/g) ?? []).length;
    decimalComa = conComa > conPunto;
  }
  return { separador: mejor, decimalComa };
}

function contarFuera(linea: string, sep: string): number {
  let n = 0;
  let enComillas = false;
  for (const ch of linea) {
    if (ch === '"') enComillas = !enComillas;
    else if (!enComillas && ch === sep) n++;
  }
  return n;
}

function modaDe(xs: number[]): number {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  let mejor = xs[0];
  let mejorN = 0;
  for (const [k, v] of m) if (v > mejorN) ((mejorN = v), (mejor = k));
  return mejor;
}
