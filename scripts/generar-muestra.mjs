// Genera public/muestra.xlsx: un libro genérico de ventas con dos hojas y varias tablas.
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";

let seed = 42;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];

const regiones = { Norte: ["Monterrey", "Chihuahua", "Tijuana"], Centro: ["CDMX", "Puebla", "Querétaro"], Sur: ["Mérida", "Oaxaca", "Veracruz"] };
const categorias = ["Electrónica", "Hogar", "Ropa", "Deportes", "Juguetes"];
const canales = ["Tienda", "En línea", "Distribuidor"];
const estados = ["Pagado", "Pendiente", "Cancelado"];
const vendedores = ["Ana", "Luis", "Marta", "Jorge", "Sofía", "Pedro", "Lucía", "Diego"];

const filas = [["Ventas 2023-2024"], [], ["ID", "Fecha", "Región", "Sucursal", "Categoría", "Canal", "Vendedor", "Estado", "Unidades", "Ventas", "Costo", "Margen %"]];
let id = 1000;
for (let d = new Date(2023, 0, 1); d < new Date(2025, 0, 1); d.setDate(d.getDate() + 1)) {
  const n = 2 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const region = pick(Object.keys(regiones));
    const sucursal = pick(regiones[region]);
    const cat = pick(categorias);
    const unidades = 1 + Math.floor(rnd() * 20);
    const precio = { Electrónica: 450, Hogar: 120, Ropa: 60, Deportes: 90, Juguetes: 35 }[cat] * (0.7 + rnd() * 0.6);
    const estacional = 1 + 0.35 * Math.sin(((d.getMonth() + 1) / 12) * Math.PI * 2) + (d.getMonth() === 11 ? 0.5 : 0);
    const ventas = Math.round(unidades * precio * estacional * (d.getFullYear() === 2024 ? 1.12 : 1) * 100) / 100;
    const costo = Math.round(ventas * (0.55 + rnd() * 0.2) * 100) / 100;
    filas.push([id++, new Date(d), region, sucursal, cat, pick(canales), pick(vendedores), pick(estados), unidades, ventas, costo, Math.round(((ventas - costo) / ventas) * 1000) / 1000]);
  }
}
const ws1 = XLSX.utils.aoa_to_sheet(filas, { cellDates: true });
ws1["!cols"] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 9 }];

// Hoja 2: dos tablas resumen con título, fila de totales y una tabla al lado
const metas = [["Metas por región"], ["Región", "Meta 2024", "Cumplimiento %"], ["Norte", 1800000, 0.94], ["Centro", 2200000, 1.03], ["Sur", 1500000, 0.88], ["Total", 5500000, null], [], [], ["Clientes por canal"], ["Canal", "Clientes", "Ticket promedio"], ["Tienda", 1240, 310.5], ["En línea", 2980, 190.2], ["Distribuidor", 310, 1480.75]];
const ws2 = XLSX.utils.aoa_to_sheet(metas);
// tabla lateral (columnas F-H) en la misma hoja
XLSX.utils.sheet_add_aoa(ws2, [["Vendedor", "Antigüedad (años)", "Ventas 2024"], ...vendedores.map((v, i) => [v, 1 + (i % 6), Math.round(400000 + rnd() * 600000)])], { origin: "F2" });

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws1, "Ventas");
XLSX.utils.book_append_sheet(wb, ws2, "Resumen");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellDates: true });
writeFileSync("public/muestra.xlsx", buf);
console.log("filas de ventas:", filas.length - 3, "bytes:", buf.length);
