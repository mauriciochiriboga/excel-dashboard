import type { ArchivoCrudo, Celda, HojaCruda, Tabla } from "../tipos";
import { encontrarBloques, asociarTitulos } from "./bloques";
import { detectarEncabezado } from "./encabezados";
import { detectarTotales } from "./totales";
import { despivotar, rellenarHaciaAbajo } from "./despivotar";
import { clasificarColumnas, detectarJerarquias } from "../clasificacion";

const MAX_FILAS_ESCANEO = 200_000;

/** Procesa todas las hojas de un archivo y devuelve las tablas detectadas. */
export function procesarArchivo(archivo: ArchivoCrudo): Tabla[] {
  const tablas: Tabla[] = [];
  let n = 0;
  for (const hoja of archivo.hojas) {
    for (const t of procesarHoja(hoja, archivo.id)) {
      t.id = `${archivo.id}_t${n++}`;
      tablas.push(t);
    }
  }
  return tablas;
}

/** Si hay un hueco de más de 5.000 filas vacías, descarta lo que viene después (notas al pie lejanas). */
function recortarCola(filas: Celda[][]): Celda[][] {
  let ultimaNoVacia = -1;
  for (let r = 0; r < filas.length; r++) {
    const f = filas[r];
    const vacia = !f || f.length === 0 || f.every((v) => v === null);
    if (!vacia) {
      if (ultimaNoVacia >= 0 && r - ultimaNoVacia > 5000) return filas.slice(0, ultimaNoVacia + 1);
      ultimaNoVacia = r;
    }
  }
  return filas;
}

export function procesarHoja(hoja: HojaCruda, archivoId: string): Tabla[] {
  const filas = recortarCola(hoja.filas.length > MAX_FILAS_ESCANEO ? hoja.filas.slice(0, MAX_FILAS_ESCANEO) : hoja.filas);
  const bloques = encontrarBloques(filas);
  const candidatos = asociarTitulos(bloques, filas);
  const out: Tabla[] = [];
  let k = 0;
  for (const { bloque: b0, titulo: titulo0 } of candidatos) {
    const avisos: string[] = [];
    // Filas de título dentro del bloque (una sola celda de texto en una fila ancha)
    const b = { ...b0 };
    let titulo = titulo0;
    for (let intentos = 0; intentos < 3 && b.r1 - b.r0 >= 2; intentos++) {
      const f = filas[b.r0] ?? [];
      const noVacias: Celda[] = [];
      for (let c = b.c0; c <= b.c1; c++) if (f[c] !== null && f[c] !== undefined) noVacias.push(f[c]);
      const textos = noVacias.filter((v): v is string => typeof v === "string");
      const esTitulo =
        (noVacias.length === 1 && textos.length === 1 && b.c1 - b.c0 >= 1) ||
        (noVacias.length === 2 && textos.length === 2 && b.c1 - b.c0 >= 3 && Math.max(...textos.map((t) => t.length)) >= 25);
      if (esTitulo) {
        const largo = textos.sort((x, y) => y.length - x.length)[0];
        titulo = titulo ?? largo.replace(/\s+/g, " ").trim();
        b.r0++;
      } else break;
    }
    const enc = detectarEncabezado(filas, b, hoja.combinadas);
    avisos.push(...enc.avisos);
    let cuerpo: Celda[][] = [];
    const ancho = b.c1 - b.c0 + 1;
    for (let r = b.r0 + enc.filas; r <= b.r1; r++) {
      const f = filas[r] ?? [];
      cuerpo.push(Array.from({ length: ancho }, (_, i) => f[b.c0 + i] ?? null));
    }
    if (cuerpo.length < 2) continue;

    // Quitar columnas totalmente vacías (p. ej. columna separadora dentro del bloque)
    const colsVacias = new Set<number>();
    for (let c = 0; c < ancho; c++) if (cuerpo.every((f) => f[c] === null)) colsVacias.add(c);
    let nombres = enc.nombres;
    let nivel1 = enc.nivel1, nivel2 = enc.nivel2;
    if (colsVacias.size) {
      const keep = [...Array(ancho).keys()].filter((c) => !colsVacias.has(c));
      cuerpo = cuerpo.map((f) => keep.map((c) => f[c]));
      nombres = keep.map((c) => nombres[c]);
      nivel1 = keep.map((c) => nivel1[c]);
      nivel2 = keep.map((c) => nivel2[c]);
    }

    // Quitar filas vacías al final
    while (cuerpo.length && cuerpo[cuerpo.length - 1].every((v) => v === null)) cuerpo.pop();

    // Rellenar etiquetas hacia abajo
    avisos.push(...rellenarHaciaAbajo(cuerpo, nombres));

    // Totales
    const colsNum = nombres.map((_, c) => c).filter((c) => cuerpo.filter((f) => typeof f[c] === "number").length >= cuerpo.length * 0.6);
    const totales = detectarTotales(cuerpo, colsNum);
    if (totales.size) {
      cuerpo = cuerpo.filter((_, i) => !totales.has(i));
      avisos.push(`${totales.size} fila(s) de totales o subtotales excluidas.`);
    }
    if (cuerpo.length < 2) continue;

    // Despivotar
    let despivotada = false;
    const d = despivotar({ ...enc, nombres, nivel1, nivel2 }, cuerpo);
    if (d) {
      nombres = d.nombres;
      cuerpo = d.filas;
      despivotada = true;
      avisos.push(d.descripcion);
    }

    const columnas = clasificarColumnas(nombres, cuerpo);
    // Debe haber al menos una columna con contenido útil
    if (!columnas.some((c) => c.tipo === "medida" || c.tipo === "categoria" || c.tipo === "fecha")) continue;

    const nombre = (titulo && titulo.length <= 120 ? titulo : null) ?? `${hoja.nombre}${candidatos.length > 1 ? ` · tabla ${k + 1}` : ""}`;
    out.push({
      id: "",
      archivoId,
      hoja: hoja.nombre,
      nombre: nombre.trim(),
      rango: b,
      columnas,
      filas: cuerpo,
      jerarquias: detectarJerarquias(cuerpo, columnas),
      avisos,
      despivotada,
    });
    k++;
  }
  return out;
}
