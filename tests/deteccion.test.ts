import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import * as fs from "node:fs";
XLSX.set_fs(fs);
const existsSync = fs.existsSync;
import { extraerHoja } from "../lib/parsing/extraer";
import { procesarArchivo, procesarHoja } from "../lib/deteccion";
import { detectarCsv } from "../lib/parsing/csv";
import type { Celda, HojaCruda } from "../lib/tipos";

function hojaDe(filas: Celda[][], nombre = "Hoja1"): HojaCruda {
  return { nombre, filas, combinadas: [] };
}

describe("detección en hojas sintéticas", () => {
  it("detecta una tabla simple con título y fila de totales", () => {
    const filas: Celda[][] = [
      ["Ventas por región"],
      [],
      ["Región", "Sucursal", "Fecha", "Ventas", "Margen %", "ID"],
      ["Norte", "A", new Date(2024, 0, 5), 100, 0.2, 1],
      ["Norte", "B", new Date(2024, 1, 5), 150, 0.25, 2],
      ["Sur", "C", new Date(2024, 2, 5), 200, 0.3, 3],
      ["Sur", "D", new Date(2024, 3, 5), 250, 0.35, 4],
      ["Sur", "E", new Date(2024, 4, 5), 300, 0.4, 5],
      ["Total", "", null, 1000, null, null],
    ];
    const t = procesarHoja(hojaDe(filas), "a");
    expect(t).toHaveLength(1);
    expect(t[0].nombre).toBe("Ventas por región");
    expect(t[0].filas).toHaveLength(5);
    const tipos = Object.fromEntries(t[0].columnas.map((c) => [c.nombre, c.tipo]));
    expect(tipos).toEqual({ Región: "categoria", Sucursal: "categoria", Fecha: "fecha", Ventas: "medida", "Margen %": "medida", ID: "identificador" });
    const margen = t[0].columnas.find((c) => c.nombre === "Margen %")!;
    expect(margen.agregacion).toBe("promedio");
    expect(margen.esPorcentaje).toBe(true);
    expect(t[0].columnas.find((c) => c.esPrincipal)!.nombre).toBe("Ventas");
    expect(t[0].jerarquias[0]?.niveles.length).toBe(2); // Región → Sucursal
  });

  it("detecta dos tablas lado a lado separadas por columna vacía", () => {
    const filas: Celda[][] = [
      ["Producto", "Unidades", null, "Cliente", "Monto"],
      ["A", 1, null, "X", 10],
      ["B", 2, null, "Y", 20],
      ["C", 3, null, "Z", 30],
    ];
    const t = procesarHoja(hojaDe(filas), "a");
    expect(t).toHaveLength(2);
  });

  it("fusiona encabezados de dos filas y despivota años", () => {
    const filas: Celda[][] = [
      ["Región", "2022", null, "2023", null],
      [null, "Total", "Hombre", "Total", "Hombre"],
      ["Norte", 10, 5, 12, 6],
      ["Sur", 20, 9, 22, 10],
      ["Este", 30, 14, 33, 15],
    ];
    const t = procesarHoja(hojaDe(filas), "a");
    expect(t).toHaveLength(1);
    expect(t[0].despivotada).toBe(true);
    expect(t[0].columnas.map((c) => c.nombre)).toEqual(["Región", "Año", "Total", "Hombre"]);
    expect(t[0].filas).toHaveLength(6);
    expect(t[0].columnas.find((c) => c.nombre === "Año")!.tipo).toBe("fecha");
  });

  it("detecta separador y decimal de CSV", () => {
    expect(detectarCsv("a;b;c\n1,5;2;3\n4,2;5;6")).toEqual({ separador: ";", decimalComa: true });
    expect(detectarCsv("a,b,c\n1.5,2,3\n4.2,5,6")).toEqual({ separador: ",", decimalComa: false });
  });
});

const RUTA = "datos/Tabulados_y_series_EDG_2024_VF.xlsx";
describe.skipIf(!existsSync(RUTA))("archivo real de datos/", () => {
  it("lee y detecta tablas en menos de 5 s", () => {
    const t0 = performance.now();
    const wb = XLSX.readFile(RUTA, { dense: true, cellDates: true });
    const hojas = wb.SheetNames.map((n) => extraerHoja(n, wb.Sheets[n]));
    const tLectura = performance.now() - t0;
    const t1 = performance.now();
    const tablas = procesarArchivo({ id: "x", nombre: RUTA, tamano: 0, hojas, tiempoMs: 0 });
    const tDeteccion = performance.now() - t1;
    console.log(`lectura ${Math.round(tLectura)} ms, detección ${Math.round(tDeteccion)} ms, ${tablas.length} tablas`);
    for (const t of tablas.slice(0, 80)) {
      console.log(`[${t.hoja}] ${t.nombre.slice(0, 60)} | ${t.filas.length} filas | ${t.columnas.map((c) => `${c.nombre.slice(0, 18)}:${c.tipo[0]}${c.esPrincipal ? "*" : ""}`).join(", ").slice(0, 200)}`);
    }
    expect(tablas.length).toBeGreaterThan(30);
    expect(tDeteccion).toBeLessThan(3500);
  }, 60000);
});
