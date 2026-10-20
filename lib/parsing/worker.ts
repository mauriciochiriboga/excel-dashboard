// Web Worker: lee .xlsx y .csv con SheetJS sin bloquear la UI.
// Devuelve una matriz compacta por hoja (sin rangos inflados) y los merges.
import * as XLSX from "xlsx";
import type { HojaCruda } from "../tipos";
import { detectarCsv } from "./csv";
import { extraerHoja, convertirDecimalComa } from "./extraer";

export interface MensajeEntrada {
  id: string;
  nombre: string;
  buffer: ArrayBuffer;
}

export type MensajeSalida =
  | { id: string; tipo: "progreso"; porcentaje: number; detalle: string }
  | { id: string; tipo: "ok"; hojas: HojaCruda[]; tiempoMs: number }
  | { id: string; tipo: "error"; mensaje: string };

const ctx = self as unknown as Worker;

function enviar(m: MensajeSalida) {
  ctx.postMessage(m);
}

ctx.onmessage = (ev: MessageEvent<MensajeEntrada>) => {
  const { id, nombre, buffer } = ev.data;
  const t0 = performance.now();
  try {
    enviar({ id, tipo: "progreso", porcentaje: 5, detalle: "Leyendo archivo… (en archivos grandes puede tardar unos segundos)" });
    const esCsv = /\.(csv|tsv|txt)$/i.test(nombre);
    let wb: XLSX.WorkBook;
    if (esCsv) {
      const texto = new TextDecoder("utf-8").decode(buffer);
      const { separador, decimalComa } = detectarCsv(texto);
      enviar({ id, tipo: "progreso", porcentaje: 30, detalle: `CSV con separador "${separador}"` });
      wb = XLSX.read(texto, {
        type: "string",
        FS: separador,
        dense: true,
        raw: false,
        cellDates: true,
        // SheetJS no convierte "1.234,5" solo; lo resolvemos abajo.
      });
      if (decimalComa) convertirDecimalComa(wb);
    } else {
      wb = XLSX.read(buffer, { type: "array", dense: true, cellDates: true, cellNF: false });
    }
    enviar({ id, tipo: "progreso", porcentaje: 60, detalle: `${wb.SheetNames.length} hoja(s) leídas` });
    const hojas: HojaCruda[] = [];
    wb.SheetNames.forEach((n, i) => {
      const ws = wb.Sheets[n];
      if (!ws) return;
      const h = extraerHoja(n, ws);
      if (h.filas.length > 0) hojas.push(h);
      enviar({
        id,
        tipo: "progreso",
        porcentaje: 60 + Math.round((40 * (i + 1)) / wb.SheetNames.length),
        detalle: `Procesando hoja ${n}`,
      });
    });
    if (hojas.length === 0) {
      enviar({ id, tipo: "error", mensaje: "El archivo no contiene ninguna hoja con datos." });
      return;
    }
    enviar({ id, tipo: "ok", hojas, tiempoMs: Math.round(performance.now() - t0) });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    let amigable = "No se pudo leer el archivo. Verifica que sea un .xlsx o .csv válido.";
    if (/password|encrypt|cfb|protect/i.test(msg)) {
      amigable = "El archivo está protegido con contraseña. Quita la protección en Excel y vuelve a subirlo.";
    } else if (/unsupported|zip|corrupt/i.test(msg)) {
      amigable = "El formato no es compatible o el archivo está dañado. Guárdalo como .xlsx desde Excel e inténtalo de nuevo.";
    }
    enviar({ id, tipo: "error", mensaje: amigable });
  }
};

