// Formato en español: coma decimal, punto de miles, meses en español.

const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const nfCompacto = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtNumero(v: number | null | undefined, decimales?: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (decimales !== undefined) {
    return new Intl.NumberFormat("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
  }
  if (Number.isInteger(v)) return nf0.format(v);
  return nf.format(v);
}

export function fmtCompacto(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (Math.abs(v) < 10000) return fmtNumero(v);
  return nfCompacto.format(v);
}

export function fmtPorcentaje(v: number | null | undefined, decimales = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
}

/** Variación relativa entre dos valores; null si no aplica. */
export function variacion(actual: number, anterior: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(anterior) || anterior === 0) return null;
  return (actual - anterior) / Math.abs(anterior);
}

export function fmtFecha(d: Date, granularidad: "dia" | "mes" | "anio" = "dia"): string {
  if (granularidad === "anio") return String(d.getFullYear());
  if (granularidad === "mes") return `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Clave de periodo para agrupar: "2024", "2024-03" o "2024-03-15". */
export function clavePeriodo(d: Date, granularidad: "dia" | "mes" | "anio"): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  if (granularidad === "anio") return String(y);
  if (granularidad === "mes") return `${y}-${m}`;
  return `${y}-${m}-${String(d.getDate()).padStart(2, "0")}`;
}

export function etiquetaPeriodo(clave: string): string {
  const p = clave.split("-").map(Number);
  if (p.length === 1) return String(p[0]);
  if (p.length === 2) return `${MESES_CORTOS[p[1] - 1]} ${p[0]}`;
  return `${String(p[2]).padStart(2, "0")} ${MESES_CORTOS[p[1] - 1]} ${p[0]}`;
}

export function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${fmtNumero(b / 1024, 0)} KB`;
  return `${fmtNumero(b / (1024 * 1024), 1)} MB`;
}

/** Formatea cualquier celda para mostrar en tabla. */
export function fmtCelda(v: unknown, esPorcentaje = false): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return fmtFecha(v);
  if (typeof v === "number") return esPorcentaje ? fmtPorcentaje(v) : fmtNumero(v);
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}
