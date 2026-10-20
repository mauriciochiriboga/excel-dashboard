// Motor de análisis puro: filtros, agregaciones, series temporales, KPIs,
// hallazgos y correlaciones. Sin React. Todas las funciones son deterministas
// y se memoizan desde los componentes.
import type { Celda, Columna, Filtro, Tabla } from "../tipos";
import { aTexto } from "../deteccion/encabezados";
import { clavePeriodo, etiquetaPeriodo } from "../formato";

export interface Punto {
  clave: string;
  etiqueta: string;
  valor: number;
  n: number;
}

/* ---------- filtros ---------- */

export function aplicarFiltros(tabla: Tabla, filtros: Filtro[]): Celda[][] {
  if (filtros.length === 0) return tabla.filas;
  const reglas = filtros
    .map((f) => {
      const idx = tabla.columnas.findIndex((c) => c.id === f.columnaId);
      if (idx < 0) return null;
      const col = tabla.columnas[idx];
      if (f.rango) {
        const [a, b] = f.rango;
        return (fila: Celda[]) => {
          const v = fila[idx];
          const n = v instanceof Date ? v.getTime() : typeof v === "number" ? v : NaN;
          return n >= a && n <= b;
        };
      }
      const set = new Set(f.valores.map((v) => claveValor(v, col)));
      return (fila: Celda[]) => set.has(claveValor(fila[idx], col));
    })
    .filter((r): r is (fila: Celda[]) => boolean => r !== null);
  return tabla.filas.filter((f) => reglas.every((r) => r(f)));
}

/** Clave de agrupación de un valor. Para fechas usa la granularidad de la columna. */
export function claveValor(v: Celda, col: Columna): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return clavePeriodo(v, col.granularidad ?? "dia");
  return aTexto(v);
}

export function etiquetaValor(v: Celda, col: Columna): string {
  if (v === null || v === undefined) return "(vacío)";
  if (v instanceof Date) return etiquetaPeriodo(clavePeriodo(v, col.granularidad ?? "dia"));
  return aTexto(v);
}

/* ---------- agregación ---------- */

export function indice(tabla: Tabla, id: string): number {
  return tabla.columnas.findIndex((c) => c.id === id);
}

export function medidaPrincipal(tabla: Tabla): Columna | null {
  return tabla.columnas.find((c) => c.esPrincipal) ?? tabla.columnas.find((c) => c.tipo === "medida") ?? null;
}

/** Agrega una medida sobre un conjunto de filas según su tipo de agregación. */
export function agregar(filas: Celda[][], idx: number, agregacion: Columna["agregacion"]): number | null {
  let suma = 0;
  let n = 0;
  for (const f of filas) {
    const v = f[idx];
    if (typeof v === "number" && Number.isFinite(v)) {
      suma += v;
      n++;
    }
  }
  if (agregacion === "conteo") return filas.length;
  if (n === 0) return null;
  return agregacion === "promedio" ? suma / n : suma;
}

/** Agrupa por una columna y agrega una medida. Devuelve puntos ordenados por valor desc (o por clave si es fecha). */
export function agruparPor(filas: Celda[][], tabla: Tabla, columnaId: string, medida: Columna | null, limite = 0): Punto[] {
  const ci = indice(tabla, columnaId);
  if (ci < 0) return [];
  const col = tabla.columnas[ci];
  const mi = medida ? indice(tabla, medida.id) : -1;
  const grupos = new Map<string, { etiqueta: string; suma: number; n: number; nNum: number }>();
  for (const f of filas) {
    const k = claveValor(f[ci], col);
    let g = grupos.get(k);
    if (!g) {
      g = { etiqueta: etiquetaValor(f[ci], col), suma: 0, n: 0, nNum: 0 };
      grupos.set(k, g);
    }
    g.n++;
    if (mi >= 0) {
      const v = f[mi];
      if (typeof v === "number" && Number.isFinite(v)) {
        g.suma += v;
        g.nNum++;
      }
    }
  }
  const puntos: Punto[] = [];
  for (const [clave, g] of grupos) {
    let valor: number;
    if (!medida || medida.agregacion === "conteo") valor = g.n;
    else if (medida.agregacion === "promedio") {
      if (g.nNum === 0) continue;
      valor = g.suma / g.nNum;
    } else valor = g.suma;
    puntos.push({ clave, etiqueta: g.etiqueta, valor, n: g.n });
  }
  if (col.tipo === "fecha") puntos.sort((a, b) => (a.clave < b.clave ? -1 : 1));
  else puntos.sort((a, b) => b.valor - a.valor);
  return limite > 0 ? puntos.slice(0, limite) : puntos;
}

/* ---------- series temporales ---------- */

export function columnaFecha(tabla: Tabla): Columna | null {
  const fechas = tabla.columnas.filter((c) => c.tipo === "fecha");
  if (fechas.length === 0) return null;
  // Preferir la de mayor cardinalidad (más fina)
  return fechas.sort((a, b) => b.distintos - a.distintos)[0];
}

/** Elige la granularidad de serie para que haya entre 6 y 120 puntos. */
export function granularidadSerie(filas: Celda[][], tabla: Tabla, fecha: Columna): "dia" | "mes" | "anio" {
  const idx = indice(tabla, fecha.id);
  let min = Infinity;
  let max = -Infinity;
  for (const f of filas) {
    const v = f[idx];
    if (v instanceof Date) {
      const t = v.getTime();
      if (t < min) min = t;
      if (t > max) max = t;
    }
  }
  if (!Number.isFinite(min)) return fecha.granularidad ?? "mes";
  const dias = (max - min) / 86400000;
  if (fecha.granularidad === "anio") return "anio";
  if (fecha.granularidad === "mes") return dias > 365 * 12 ? "anio" : "mes";
  if (dias <= 120) return "dia";
  if (dias <= 365 * 10) return "mes";
  return "anio";
}

export function serieTemporal(filas: Celda[][], tabla: Tabla, fecha: Columna, medida: Columna | null, gran: "dia" | "mes" | "anio"): Punto[] {
  const colTemp: Columna = { ...fecha, granularidad: gran };
  const tablaTemp: Tabla = { ...tabla, columnas: tabla.columnas.map((c) => (c.id === fecha.id ? colTemp : c)) };
  return agruparPor(filas, tablaTemp, fecha.id, medida);
}

/* ---------- KPIs ---------- */

export interface Kpi {
  columna: Columna;
  valor: number;
  sparkline: number[];
  variacion: number | null;
  periodoActual?: string;
  periodoAnterior?: string;
}

export function calcularKpis(filas: Celda[][], tabla: Tabla, serieBase: { fecha: Columna; gran: "dia" | "mes" | "anio" } | null): Kpi[] {
  const out: Kpi[] = [];
  const medidas = tabla.columnas.filter((c) => c.tipo === "medida");
  const ordenadas = [...medidas].sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal));
  for (const m of ordenadas.slice(0, 6)) {
    const idx = indice(tabla, m.id);
    const valor = agregar(filas, idx, m.agregacion);
    if (valor === null) continue;
    let sparkline: number[] = [];
    let variacion: number | null = null;
    let periodoActual: string | undefined;
    let periodoAnterior: string | undefined;
    if (serieBase) {
      const s = serieTemporal(filas, tabla, serieBase.fecha, m, serieBase.gran);
      sparkline = s.map((p) => p.valor);
      if (s.length >= 2) {
        const ult = s[s.length - 1];
        const ant = s[s.length - 2];
        if (ant.valor !== 0 && Number.isFinite(ant.valor) && Number.isFinite(ult.valor)) {
          variacion = (ult.valor - ant.valor) / Math.abs(ant.valor);
          periodoActual = ult.etiqueta;
          periodoAnterior = ant.etiqueta;
        }
      }
    }
    out.push({ columna: m, valor, sparkline, variacion, periodoActual, periodoAnterior });
  }
  return out;
}

/* ---------- hallazgos ---------- */

export interface Hallazgo {
  id: string;
  texto: string;
  tipo: "concentracion" | "periodo" | "extremo" | "correlacion";
  filtro?: Filtro;
  pestana?: "tendencias" | "segmentos" | "relaciones";
}

export function calcularHallazgos(filas: Celda[][], tabla: Tabla, medida: Columna | null, serie: Punto[], fecha: Columna | null): Hallazgo[] {
  const out: Hallazgo[] = [];
  if (!medida || filas.length < 3) return out;
  const nombreM = medida.nombre;
  const esProm = medida.agregacion === "promedio";
  const fmt = (v: number) => (medida.esPorcentaje ? fmtP(v) : fmtN(v));

  // Concentración por categoría (solo medidas tipo suma)
  const cats = tabla.columnas.filter((c) => (c.tipo === "categoria" || c.tipo === "estado") && c.distintos >= 2 && c.distintos <= 60);
  if (!esProm) {
    for (const c of cats.slice(0, 4)) {
      const puntos = agruparPor(filas, tabla, c.id, medida);
      const total = puntos.reduce((a, p) => a + Math.abs(p.valor), 0);
      if (total <= 0 || puntos.length < 3) continue;
      const top = puntos[0];
      const parte = Math.abs(top.valor) / total;
      if (parte >= 0.4) {
        out.push({
          id: `conc-${c.id}`,
          tipo: "concentracion",
          texto: `${top.etiqueta} concentra el ${fmtP(parte)} de ${nombreM} entre ${puntos.length} valores de ${c.nombre}.`,
          filtro: { columnaId: c.id, valores: [valorCrudo(filas, tabla, c, top.clave)] },
          pestana: "segmentos",
        });
      } else {
        const top3 = puntos.slice(0, 3).reduce((a, p) => a + Math.abs(p.valor), 0) / total;
        if (top3 >= 0.7 && puntos.length >= 5) {
          out.push({
            id: `conc3-${c.id}`,
            tipo: "concentracion",
            texto: `Los 3 primeros valores de ${c.nombre} (${puntos.slice(0, 3).map((p) => p.etiqueta).join(", ")}) suman el ${fmtP(top3)} de ${nombreM}.`,
            filtro: { columnaId: c.id, valores: puntos.slice(0, 3).map((p) => valorCrudo(filas, tabla, c, p.clave)) },
            pestana: "segmentos",
          });
        }
      }
    }
  }

  // Mejor y peor periodo
  if (serie.length >= 3 && fecha) {
    const max = serie.reduce((a, p) => (p.valor > a.valor ? p : a));
    const min = serie.reduce((a, p) => (p.valor < a.valor ? p : a));
    const prom = serie.reduce((a, p) => a + p.valor, 0) / serie.length;
    out.push({
      id: "mejor-periodo",
      tipo: "periodo",
      texto: `El mejor periodo fue ${max.etiqueta} con ${fmt(max.valor)}${prom !== 0 ? ` (${fmtP(max.valor / prom - 1, true)} sobre el promedio)` : ""}.`,
      filtro: filtroPeriodo(filas, tabla, fecha, max.clave),
      pestana: "tendencias",
    });
    out.push({
      id: "peor-periodo",
      tipo: "periodo",
      texto: `El peor periodo fue ${min.etiqueta} con ${fmt(min.valor)}${prom !== 0 ? ` (${fmtP(min.valor / prom - 1, true)} respecto al promedio)` : ""}.`,
      filtro: filtroPeriodo(filas, tabla, fecha, min.clave),
      pestana: "tendencias",
    });
    // Tendencia global: primera mitad vs segunda mitad
    if (serie.length >= 6) {
      const mitad = Math.floor(serie.length / 2);
      const a = serie.slice(0, mitad).reduce((x, p) => x + p.valor, 0) / mitad;
      const b = serie.slice(mitad).reduce((x, p) => x + p.valor, 0) / (serie.length - mitad);
      if (a !== 0 && Math.abs(b / a - 1) >= 0.1) {
        out.push({
          id: "tendencia",
          tipo: "periodo",
          texto: `${nombreM} ${b > a ? "creció" : "cayó"} un ${fmtP(Math.abs(b / a - 1))} entre la primera y la segunda mitad del periodo.`,
          pestana: "tendencias",
        });
      }
    }
  }

  // Extremos por categoría (promedio por grupo vs global)
  for (const c of cats.slice(0, 3)) {
    const medProm: Columna = { ...medida, agregacion: "promedio" };
    const puntos = agruparPor(filas, tabla, c.id, medProm).filter((p) => p.n >= 3);
    if (puntos.length < 3) continue;
    const global = agregar(filas, indice(tabla, medida.id), "promedio");
    if (global === null || global === 0) continue;
    const alto = puntos[0];
    const bajo = puntos[puntos.length - 1];
    if (alto.valor / global >= 1.3) {
      out.push({
        id: `alto-${c.id}`,
        tipo: "extremo",
        texto: `${c.nombre} = ${alto.etiqueta} tiene un promedio de ${nombreM} de ${fmt(alto.valor)}, ${fmtP(alto.valor / global - 1, true)} sobre la media.`,
        filtro: { columnaId: c.id, valores: [valorCrudo(filas, tabla, c, alto.clave)] },
        pestana: "segmentos",
      });
    }
    if (bajo.valor / global <= 0.7 && bajo.valor >= 0) {
      out.push({
        id: `bajo-${c.id}`,
        tipo: "extremo",
        texto: `${c.nombre} = ${bajo.etiqueta} tiene el promedio más bajo de ${nombreM}: ${fmt(bajo.valor)}, ${fmtP(1 - bajo.valor / global)} por debajo de la media.`,
        filtro: { columnaId: c.id, valores: [valorCrudo(filas, tabla, c, bajo.clave)] },
        pestana: "segmentos",
      });
    }
  }

  // Correlaciones fuertes entre medidas
  const corr = matrizCorrelacion(filas, tabla);
  for (const r of corr.pares.filter((p) => Math.abs(p.r) >= 0.7).slice(0, 3)) {
    out.push({
      id: `corr-${r.a.id}-${r.b.id}`,
      tipo: "correlacion",
      texto: `${r.a.nombre} y ${r.b.nombre} tienen correlación ${r.r > 0 ? "positiva" : "negativa"} fuerte (r = ${r.r.toLocaleString("es-ES", { maximumFractionDigits: 2 })}).`,
      pestana: "relaciones",
    });
  }

  return out.slice(0, 8);
}

function valorCrudo(filas: Celda[][], tabla: Tabla, col: Columna, clave: string): Celda {
  const idx = indice(tabla, col.id);
  for (const f of filas) if (claveValor(f[idx], col) === clave) return f[idx];
  return clave;
}

function filtroPeriodo(filas: Celda[][], tabla: Tabla, fecha: Columna, clave: string): Filtro {
  // Rango de fechas que cubre la clave del periodo ("2024", "2024-03", "2024-03-15")
  const p = clave.split("-").map(Number);
  let ini: Date;
  let fin: Date;
  if (p.length === 1) {
    ini = new Date(p[0], 0, 1);
    fin = new Date(p[0] + 1, 0, 1);
  } else if (p.length === 2) {
    ini = new Date(p[0], p[1] - 1, 1);
    fin = new Date(p[0], p[1], 1);
  } else {
    ini = new Date(p[0], p[1] - 1, p[2]);
    fin = new Date(p[0], p[1] - 1, p[2] + 1);
  }
  return { columnaId: fecha.id, valores: [], rango: [ini.getTime(), fin.getTime() - 1] };
}

/* ---------- correlación ---------- */

export interface ParCorrelacion {
  a: Columna;
  b: Columna;
  r: number;
}

export function matrizCorrelacion(filas: Celda[][], tabla: Tabla): { medidas: Columna[]; matriz: number[][]; pares: ParCorrelacion[] } {
  const medidas = tabla.columnas.filter((c) => c.tipo === "medida").slice(0, 10);
  const idx = medidas.map((m) => indice(tabla, m.id));
  const n = medidas.length;
  const matriz: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
  const pares: ParCorrelacion[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = pearson(filas, idx[i], idx[j]);
      matriz[i][j] = matriz[j][i] = r;
      if (Number.isFinite(r)) pares.push({ a: medidas[i], b: medidas[j], r });
    }
  }
  pares.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return { medidas, matriz, pares };
}

export function pearson(filas: Celda[][], i: number, j: number): number {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const f of filas) {
    const x = f[i], y = f[j];
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  if (n < 5) return NaN;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (den === 0) return NaN;
  return (n * sxy - sx * sy) / den;
}

/* ---------- distribución ---------- */

export function histograma(filas: Celda[][], idx: number, bins = 20): { x0: number; x1: number; n: number }[] {
  const vals: number[] = [];
  for (const f of filas) {
    const v = f[idx];
    if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length === 0) return [];
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) return [{ x0: min, x1: max, n: vals.length }];
  const k = Math.min(bins, Math.max(5, Math.round(Math.sqrt(vals.length))));
  const ancho = (max - min) / k;
  const out = Array.from({ length: k }, (_, i) => ({ x0: min + i * ancho, x1: min + (i + 1) * ancho, n: 0 }));
  for (const v of vals) {
    let b = Math.floor((v - min) / ancho);
    if (b >= k) b = k - 1;
    out[b].n++;
  }
  return out;
}

export function estadisticas(filas: Celda[][], idx: number) {
  const vals: number[] = [];
  for (const f of filas) {
    const v = f[idx];
    if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length === 0) return null;
  vals.sort((a, b) => a - b);
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))];
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - media) ** 2, 0) / vals.length);
  return { n: vals.length, min: vals[0], max: vals[vals.length - 1], media, mediana: q(0.5), q1: q(0.25), q3: q(0.75), sd };
}

/* ---------- formato local (evita dependencia circular con React) ---------- */
function fmtN(v: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 }).format(v);
}
function fmtP(v: number, signo = false) {
  const s = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(Math.abs(v));
  return signo ? (v >= 0 ? `+${s}` : `−${s}`) : s;
}
