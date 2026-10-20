"use client";
import { BarChart3, FileSpreadsheet, Search, Table2, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Boton, ConmutadorTema, cx } from "@/components/ui";
import { fmtNumero } from "@/lib/formato";
import { MenuUsuario } from "@/components/auth/MenuUsuario";
import { BotonGuardar } from "@/components/dashboard/BotonGuardar";
import Link from "next/link";

export function Encabezado() {
  const archivos = useStore((s) => s.archivos);
  const tablas = useStore((s) => s.tablas);
  const archivoActivo = useStore((s) => s.archivoActivo);
  const tablaActiva = useStore((s) => s.tablaActiva);
  const vista = useStore((s) => s.vista);
  const seleccionarArchivo = useStore((s) => s.seleccionarArchivo);
  const seleccionarTabla = useStore((s) => s.seleccionarTabla);
  const setVista = useStore((s) => s.setVista);
  const quitarArchivo = useStore((s) => s.quitarArchivo);
  const setPaletaAbierta = useStore((s) => s.setPaletaAbierta);

  const tablasDelArchivo = tablas.filter((t) => t.archivoId === archivoActivo);
  const hayDatos = archivos.length > 0;

  return (
    <header className="sticky top-0 z-30 border-b border-borde bg-fondo/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
        <Link href="/" onClick={() => setVista(hayDatos ? vista : "carga")} className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-acento text-white dark:text-fondo">
            <BarChart3 size={16} />
          </span>
          <span className="hidden sm:inline">Excel Dashboard</span>
        </Link>

        {hayDatos && (
          <>
            <label className="flex min-w-0 items-center gap-1 text-sm">
              <FileSpreadsheet size={16} className="shrink-0 text-texto-suave" />
              <select
                aria-label="Archivo"
                value={archivoActivo ?? ""}
                onChange={(e) => seleccionarArchivo(e.target.value)}
                className="max-w-[40vw] truncate rounded-md border border-borde bg-superficie px-2 py-1 sm:max-w-xs"
              >
                {archivos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
            {tablasDelArchivo.length > 0 && (
              <label className="flex min-w-0 items-center gap-1 text-sm">
                <Table2 size={16} className="shrink-0 text-texto-suave" />
                <select
                  aria-label="Tabla"
                  value={tablaActiva ?? ""}
                  onChange={(e) => seleccionarTabla(e.target.value)}
                  className="max-w-[40vw] truncate rounded-md border border-borde bg-superficie px-2 py-1 sm:max-w-xs"
                >
                  {tablasDelArchivo.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({fmtNumero(t.filas.length)} filas)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Boton variante="fantasma" title="Quitar archivo" aria-label="Quitar archivo" onClick={() => archivoActivo && quitarArchivo(archivoActivo)}>
              <Trash2 size={16} />
            </Boton>
          </>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hayDatos && (
            <nav className="inline-flex rounded-md border border-borde bg-superficie p-0.5 text-sm">
              {(
                [
                  ["carga", "Archivos"],
                  ["entendimiento", "Entendí"],
                  ["dashboard", "Dashboard"],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  aria-current={vista === v ? "page" : undefined}
                  className={cx("whitespace-nowrap rounded px-2.5 py-1 transition-colors", vista === v ? "bg-acento-suave text-acento font-medium" : "text-texto-suave hover:text-texto")}
                >
                  {t}
                </button>
              ))}
            </nav>
          )}
          {hayDatos && (
            <Boton variante="fantasma" onClick={() => setPaletaAbierta(true)} title="Buscar (Ctrl+K)" aria-label="Buscar">
              <Search size={16} />
              <kbd className="hidden rounded border border-borde px-1 font-mono text-[10px] text-texto-suave md:inline">Ctrl K</kbd>
            </Boton>
          )}
          <BotonGuardar />
          <ConmutadorTema />
          <MenuUsuario />
        </div>
      </div>
    </header>
  );
}
