import type { ArchivoCrudo } from "../tipos";
import type { MensajeEntrada, MensajeSalida } from "./worker";

export interface OpcionesLectura {
  onProgreso?: (porcentaje: number, detalle: string) => void;
}

let contador = 0;

/** Lee un File en un Web Worker y devuelve las hojas crudas. */
export function leerArchivo(file: File, opts: OpcionesLectura = {}): Promise<ArchivoCrudo> {
  return new Promise((resolve, reject) => {
    const id = `a${Date.now()}_${contador++}`;
    const worker = new Worker(new URL("./worker.ts", import.meta.url));
    worker.onmessage = (ev: MessageEvent<MensajeSalida>) => {
      const m = ev.data;
      if (m.id !== id) return;
      if (m.tipo === "progreso") opts.onProgreso?.(m.porcentaje, m.detalle);
      else if (m.tipo === "ok") {
        worker.terminate();
        resolve({ id, nombre: file.name, tamano: file.size, hojas: m.hojas, tiempoMs: m.tiempoMs });
      } else {
        worker.terminate();
        reject(new Error(m.mensaje));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Error interno al leer el archivo."));
    };
    file.arrayBuffer().then((buffer) => {
      const msg: MensajeEntrada = { id, nombre: file.name, buffer };
      worker.postMessage(msg, [buffer]);
    }, reject);
  });
}
