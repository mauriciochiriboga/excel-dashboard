// Genera public/pruebas/grande.xlsx con N filas (por defecto 50.000) para medir rendimiento.
import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "node:fs";
const N = Number(process.argv[2] ?? 50000);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const filas = [["ID", "Fecha", "Región", "Sucursal", "Producto", "Cliente", "Unidades", "Ventas", "Descuento %"]];
const base = new Date(2022, 0, 1).getTime();
for (let i = 0; i < N; i++) {
  const d = new Date(base + Math.floor(rnd() * 1095) * 86400000);
  const reg = pick(["Norte", "Centro", "Sur", "Este", "Oeste"]);
  filas.push([100000 + i, d, reg, `${reg}-${1 + Math.floor(rnd() * 6)}`, `Producto ${1 + Math.floor(rnd() * 40)}`, `Cliente ${1 + Math.floor(rnd() * 3000)}`, 1 + Math.floor(rnd() * 50), Math.round(rnd() * 5000 * 100) / 100, Math.round(rnd() * 30) / 100]);
}
const ws = XLSX.utils.aoa_to_sheet(filas);
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ventas");
mkdirSync("public/pruebas", { recursive: true });
writeFileSync("public/pruebas/grande.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
console.log("filas", N);
