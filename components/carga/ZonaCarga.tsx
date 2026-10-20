"use client";
import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, X, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Boton, cx } from "@/components/ui";

const ACEPTA = ".xlsx,.xlsm,.xls,.csv,.tsv,.txt";

export function ZonaCarga({ compacta = false }: { compacta?: boolean }) {
  const cargarArchivos = useStore((s) => s.cargarArchivos);
  const cargarMuestra = useStore((s) => s.cargarMuestra);
  const cargas = useStore((s) => s.cargas);
  const errores = useStore((s) => s.errores);
  const quitarError = useStore((s) => s.quitarError);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = useCallback(
    (lista: FileList | null) => {
      if (!lista) return;
      const files = Array.from(lista).filter((f) => /\.(xlsx|xlsm|xls|csv|tsv|txt)$/i.test(f.name));
      if (files.length) void cargarArchivos(files);
    },
    [cargarArchivos],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona para arrastrar archivos Excel o CSV"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed text-center transition-colors",
          compacta ? "p-4" : "p-10",
          arrastrando ? "border-acento bg-acento-suave" : "border-borde bg-superficie hover:border-acento/60",
        )}
      >
        <FileSpreadsheet className="text-acento" size={compacta ? 24 : 40} />
        <div>
          <p className="font-medium">Arrastra aquí tu archivo Excel o CSV</p>
          <p className="text-sm text-texto-suave">.xlsx, .csv o .tsv · se procesa en tu navegador, nada se envía a un servidor</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Boton variante="primario" onClick={() => inputRef.current?.click()}>
            <Upload size={16} /> Subir Excel o CSV
          </Boton>
          <Boton onClick={() => void cargarMuestra()}>Probar con el archivo de muestra</Boton>
        </div>
        <input ref={inputRef} type="file" accept={ACEPTA} multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </div>

      {cargas.map((c) => (
        <div key={c.id} className="rounded-md border border-borde bg-superficie p-3 text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin text-acento" size={16} />
            <span className="truncate font-medium">{c.nombre}</span>
            <span className="ml-auto tabular text-texto-suave">{c.porcentaje} %</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-superficie-2">
            <div className={cx("h-full bg-acento transition-[width]", c.porcentaje < 30 && "animate-pulse")} style={{ width: `${Math.max(c.porcentaje, 8)}%` }} />
          </div>
          <p className="mt-1 text-xs text-texto-suave">{c.detalle}</p>
        </div>
      ))}

      {errores.map((e, i) => (
        <div key={i} role="alert" className="flex items-start gap-2 rounded-md border border-negativo/40 bg-negativo/10 p-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-negativo">No se pudo cargar {e.archivo}</p>
            <p className="text-texto">{e.mensaje}</p>
          </div>
          <button aria-label="Cerrar" onClick={() => quitarError(i)} className="text-texto-suave hover:text-texto">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
