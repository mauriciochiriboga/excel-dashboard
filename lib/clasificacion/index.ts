import type { Celda, Columna, Tabla, TipoColumna, Agregacion, Jerarquia } from "../tipos";
import { aTexto } from "../deteccion/encabezados";

const RE_ID = /\b(id|c[oó]digo|cod|n[uú]mero|nro|n[º°]|folio|clave|ref|referencia|sku|dni|ruc|cedula|cédula|identificador)\b/i;
const RE_FECHA = /\b(fecha|date|d[ií]a|day|periodo|período|mes|month|a[ñn]o|anio|year)\b/i;
const RE_PORC = /(%|porcentaje|porc\.?|tasa|ratio|proporci[oó]n|margen|rate|pct|share|participaci[oó]n)/i;
const RE_MONTO = /\b(venta|ventas|monto|importe|ingreso|ingresos|total|valor|precio|costo|coste|gasto|utilidad|facturaci[oó]n|cantidad|unidades|revenue|amount|sales|defunciones|casos|poblaci[oó]n|n[uú]mero)\b/i;
const RE_ESTADO = /\b(estado|status|situaci[oó]n|etapa|fase|condici[oó]n)\b/i;
const VOCAB_ESTADO = /^(activo|inactivo|pendiente|cerrado|abierto|en proceso|completado|cancelado|aprobado|rechazado|pagado|vencido|nuevo|finalizado|active|inactive|pending|closed|open|done|cancelled|approved|rejected|paid|si|sí|no|true|false)$/i;
const RE_ANIO = /^(19|20)\d{2}$/;
const RE_ANIO_TXT = /^((19|20)\d{2})\s*[\(\[]?\s*[a-zA-Z]{0,3}\**\s*[\)\]]?\s*\/?\s*$/;
const RE_FECHA_TXT = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$|^(\d{4})-(\d{2})-(\d{2})/;

export interface Perfil {
  n: number;
  nulos: number;
  numeros: number;
  fechas: number;
  textos: number;
  distintos: number;
  enteros: number;
  entre0y1: number;
  ejemplo: string;
  aniosEnteros: number;
  /** Enteros que forman una secuencia casi consecutiva (rango ≤ 2·n). */
  secuencial: boolean;
  /** Todos los números tienen la misma cantidad de dígitos (≥ 4), típico de códigos. */
  mismaLongitud: boolean;
}

export function perfilar(valores: Celda[]): Perfil {
  const set = new Set<string>();
  let nulos = 0, numeros = 0, fechas = 0, textos = 0, enteros = 0, entre0y1 = 0, aniosEnteros = 0;
  let ejemplo = "";
  let min = Infinity, max = -Infinity;
  const longitudes = new Set<number>();
  for (const v of valores) {
    if (v === null || v === undefined || v === "") { nulos++; continue; }
    if (!ejemplo) ejemplo = aTexto(v);
    if (v instanceof Date) { fechas++; set.add(v.getTime().toString()); continue; }
    if (typeof v === "number") {
      numeros++;
      set.add(String(v));
      if (Number.isInteger(v)) { enteros++; if (RE_ANIO.test(String(v))) aniosEnteros++; longitudes.add(String(Math.abs(v)).length); }
      if (v < min) min = v;
      if (v > max) max = v;
      if (v >= 0 && v <= 1) entre0y1++;
      continue;
    }
    if (typeof v === "boolean") { textos++; set.add(String(v)); continue; }
    const s = String(v).trim();
    if (RE_FECHA_TXT.test(s)) fechas++;
    else if (RE_ANIO_TXT.test(s)) { fechas++; aniosEnteros++; }
    else textos++;
    set.add(s);
  }
  const secuencial = numeros > 0 && enteros === numeros && max - min + 1 <= numeros * 2;
  const mismaLongitud = numeros > 0 && longitudes.size === 1 && [...longitudes][0] >= 4;
  return { n: valores.length, nulos, numeros, fechas, textos, distintos: set.size, enteros, entre0y1, ejemplo, aniosEnteros, secuencial, mismaLongitud };
}

export function inferirTipo(nombre: string, p: Perfil): { tipo: TipoColumna; esPorcentaje: boolean; agregacion: Agregacion; granularidad?: Columna["granularidad"] } {
  const noNulos = p.n - p.nulos;
  if (noNulos === 0) return { tipo: "texto", esPorcentaje: false, agregacion: "conteo" };
  const fr = (x: number) => x / noNulos;

  // Años (enteros o texto "2024 (p)") en casi toda la columna
  if (fr(p.aniosEnteros) >= 0.95 && p.distintos >= 2 && p.distintos <= 150) {
    return { tipo: "fecha", esPorcentaje: false, agregacion: "conteo", granularidad: "anio" };
  }
  // Fecha
  if (fr(p.fechas) >= 0.9) {
    return { tipo: "fecha", esPorcentaje: false, agregacion: "conteo", granularidad: fr(p.aniosEnteros) >= 0.9 ? "anio" : undefined };
  }
  // Año entero
  if (fr(p.numeros) >= 0.9 && fr(p.aniosEnteros) >= 0.9 && RE_FECHA.test(nombre)) {
    return { tipo: "fecha", esPorcentaje: false, agregacion: "conteo", granularidad: "anio" };
  }
  if (fr(p.numeros) >= 0.9 && fr(p.aniosEnteros) >= 0.95 && p.distintos <= 150 && p.distintos >= 2) {
    return { tipo: "fecha", esPorcentaje: false, agregacion: "conteo", granularidad: "anio" };
  }

  if (fr(p.numeros) >= 0.9) {
    // Identificador: cardinalidad ≈ filas, o nombre lo indica
    if (noNulos >= 5 && p.distintos >= noNulos * 0.95 && fr(p.enteros) >= 0.99 && !RE_MONTO.test(nombre)) {
      const pareceCodigo = RE_ID.test(nombre) || p.secuencial || p.mismaLongitud;
      if (pareceCodigo) return { tipo: "identificador", esPorcentaje: false, agregacion: "conteo" };
    }
    if (RE_ID.test(nombre) && fr(p.enteros) >= 0.99 && !RE_MONTO.test(nombre)) {
      return { tipo: "identificador", esPorcentaje: false, agregacion: "conteo" };
    }
    // Entero con pocos valores distintos: categoría (plazo, año, nivel)
    if (fr(p.enteros) >= 0.99 && p.distintos <= 12 && noNulos >= 10 && !RE_MONTO.test(nombre) && !RE_PORC.test(nombre)) {
      return { tipo: "categoria", esPorcentaje: false, agregacion: "conteo" };
    }
    const esPorc = RE_PORC.test(nombre) || (fr(p.entre0y1) >= 0.95 && p.distintos > 2 && fr(p.enteros) < 0.5);
    return { tipo: "medida", esPorcentaje: esPorc, agregacion: esPorc ? "promedio" : "suma" };
  }

  // Texto
  if (noNulos >= 20 && p.distintos >= noNulos * 0.95) {
    return { tipo: RE_ID.test(nombre) ? "identificador" : "texto", esPorcentaje: false, agregacion: "conteo" };
  }
  if (RE_ID.test(nombre) && p.distintos >= noNulos * 0.8) return { tipo: "identificador", esPorcentaje: false, agregacion: "conteo" };
  if (p.distintos <= 8 && (RE_ESTADO.test(nombre) || p.ejemplo && VOCAB_ESTADO.test(p.ejemplo))) {
    return { tipo: "estado", esPorcentaje: false, agregacion: "conteo" };
  }
  if (p.distintos <= Math.max(50, noNulos * 0.5)) return { tipo: "categoria", esPorcentaje: false, agregacion: "conteo" };
  return { tipo: "texto", esPorcentaje: false, agregacion: "conteo" };
}

/** Convierte una columna a Date[] si su tipo es fecha; deja igual el resto. */
export function normalizarFechas(filas: Celda[][], c: number, granularidad?: Columna["granularidad"]): Columna["granularidad"] {
  let diasDistintos = new Set<string>();
  let mesesDistintos = new Set<string>();
  for (const f of filas) {
    const v = f[c];
    let d: Date | null = null;
    if (v instanceof Date) d = v;
    else if (typeof v === "number" && RE_ANIO.test(String(v))) d = new Date(v, 0, 1);
    else if (typeof v === "string") d = parsearFechaTexto(v);
    if (d && !isNaN(d.getTime())) {
      f[c] = d;
      diasDistintos.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      mesesDistintos.add(`${d.getFullYear()}-${d.getMonth()}`);
    } else if (v !== null) f[c] = null;
  }
  if (granularidad) return granularidad;
  // Granularidad: si todos los días son 1 → mes; si todos son 1 de enero → año.
  let todosDia1 = true, todosEnero = true;
  for (const f of filas) {
    const d = f[c];
    if (!(d instanceof Date)) continue;
    if (d.getDate() !== 1) todosDia1 = false;
    if (d.getMonth() !== 0 || d.getDate() !== 1) todosEnero = false;
  }
  if (todosEnero) return "anio";
  if (todosDia1) return "mes";
  return "dia";
}

function parsearFechaTexto(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return new Date(y, +m[2] - 1, +m[1]);
  }
  m = t.match(RE_ANIO_TXT);
  if (m) return new Date(+m[1], 0, 1);
  return null;
}

/** Jerarquías: A → B si cada valor de B pertenece a un único A. */
export function detectarJerarquias(filas: Celda[][], columnas: Columna[]): Jerarquia[] {
  const cats = columnas.map((c, i) => ({ c, i })).filter((x) => x.c.tipo === "categoria" || x.c.tipo === "estado").slice(0, 12);
  const padres = new Map<number, number[]>(); // hijo -> padres directos
  const pares: [number, number][] = [];
  for (const a of cats) {
    for (const b of cats) {
      if (a.i === b.i) continue;
      if (a.c.distintos >= b.c.distintos) continue; // padre debe tener menos valores
      const mapa = new Map<string, string>();
      let ok = true;
      for (const f of filas) {
        const va = f[a.i], vb = f[b.i];
        if (va === null || vb === null) continue;
        const kb = aTexto(vb), ka = aTexto(va);
        const prev = mapa.get(kb);
        if (prev === undefined) mapa.set(kb, ka);
        else if (prev !== ka) { ok = false; break; }
      }
      if (ok && mapa.size > 0) pares.push([a.i, b.i]);
    }
  }
  for (const [p, h] of pares) padres.set(h, [...(padres.get(h) ?? []), p]);
  // Construir cadenas: partir de columnas sin padre y descender.
  const hijosDe = (p: number) => pares.filter(([a]) => a === p).map(([, b]) => b);
  const cadenas: number[][] = [];
  const raices = cats.filter((x) => !padres.has(x.i)).map((x) => x.i);
  const recorrer = (cadena: number[]) => {
    const ult = cadena[cadena.length - 1];
    // hijos directos: aquellos cuyos padres están todos en la cadena
    const hijos = hijosDe(ult).filter((h) => (padres.get(h) ?? []).every((p) => cadena.includes(p)));
    if (hijos.length === 0) { if (cadena.length >= 2) cadenas.push(cadena); return; }
    for (const h of hijos) recorrer([...cadena, h]);
  };
  for (const r of raices) recorrer([r]);
  // Quitar cadenas contenidas en otras
  const unicas = cadenas.filter((c, i) => !cadenas.some((o, j) => j !== i && o.length > c.length && c.every((x) => o.includes(x))));
  return unicas.slice(0, 5).map((c) => ({ niveles: c.map((i) => columnas[i].id) }));
}

export function elegirPrincipal(columnas: Columna[], filas: Celda[][]): string | null {
  const medidas = columnas.map((c, i) => ({ c, i })).filter((x) => x.c.tipo === "medida");
  if (medidas.length === 0) return null;
  let mejor = medidas[0];
  let mejorPuntaje = -Infinity;
  for (const m of medidas) {
    let puntaje = 0;
    if (m.c.agregacion === "suma") puntaje += 3;
    if (RE_MONTO.test(m.c.nombre)) puntaje += 2;
    if (/^total/i.test(m.c.nombre)) puntaje += 1;
    if (m.c.esPorcentaje) puntaje -= 2;
    // Varianza relativa
    const vals = filas.map((f) => f[m.i]).filter((v): v is number => typeof v === "number");
    if (vals.length > 1) {
      const media = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - media) ** 2, 0) / vals.length);
      if (media !== 0) puntaje += Math.min(2, sd / Math.abs(media));
    }
    puntaje -= m.i * 0.01; // preferir columnas a la izquierda en empate
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = m; }
  }
  return mejor.c.id;
}

/** Construye las columnas clasificadas y normaliza fechas en las filas (muta filas). */
export function clasificarColumnas(nombres: string[], filas: Celda[][]): Columna[] {
  const columnas: Columna[] = nombres.map((nombre, i) => {
    const valores = filas.map((f) => f[i] ?? null);
    const p = perfilar(valores);
    const inf = inferirTipo(nombre, p);
    let granularidad = inf.granularidad;
    if (inf.tipo === "fecha") granularidad = normalizarFechas(filas, i, inf.granularidad);
    return {
      id: `c${i}`,
      nombre,
      tipo: inf.tipo,
      tipoDetectado: inf.tipo,
      agregacion: inf.agregacion,
      esPrincipal: false,
      esPorcentaje: inf.esPorcentaje,
      distintos: p.distintos,
      nulos: p.nulos,
      ejemplo: p.ejemplo,
      granularidad,
    };
  });
  const principal = elegirPrincipal(columnas, filas);
  for (const c of columnas) c.esPrincipal = c.id === principal;
  return columnas;
}

/** Cambia el tipo de una columna y recalcula agregación, principal y jerarquías. */
export function reclasificarColumna(tabla: Tabla, columnaId: string, tipo: TipoColumna): Tabla {
  const idx = tabla.columnas.findIndex((c) => c.id === columnaId);
  if (idx < 0) return tabla;
  const filas = tabla.filas.map((f) => [...f]);
  const columnas = tabla.columnas.map((c) => ({ ...c }));
  const col = columnas[idx];
  col.tipo = tipo;
  if (tipo === "fecha") col.granularidad = normalizarFechas(filas, idx);
  if (tipo === "medida") {
    col.agregacion = col.esPorcentaje ? "promedio" : "suma";
    // Convertir textos numéricos si los hubiera
    for (const f of filas) {
      const v = f[idx];
      if (typeof v === "string") {
        const n = Number(v.replace(/\./g, "").replace(",", "."));
        f[idx] = Number.isFinite(n) ? n : null;
      } else if (v instanceof Date) f[idx] = null;
    }
  } else {
    col.agregacion = "conteo";
    if (col.esPrincipal) col.esPrincipal = false;
  }
  if (!columnas.some((c) => c.esPrincipal)) {
    const p = elegirPrincipal(columnas, filas);
    for (const c of columnas) c.esPrincipal = c.id === p;
  }
  return { ...tabla, filas, columnas, jerarquias: detectarJerarquias(filas, columnas) };
}
