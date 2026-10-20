"use client";
import { Command } from "cmdk";
import { useEffect, useMemo } from "react";
import { FileSpreadsheet, Table2, Columns3, Tag, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { aTexto } from "@/lib/deteccion/encabezados";

/** Paleta Ctrl/Cmd+K: busca archivos, tablas, columnas y valores de categoría. */
export function PaletaComandos() {
  const abierta = useStore((s) => s.paletaAbierta);
  const setAbierta = useStore((s) => s.setPaletaAbierta);
  const archivos = useStore((s) => s.archivos);
  const tablas = useStore((s) => s.tablas);
  const tablaActiva = useStore((s) => s.tablaActiva);
  const seleccionarArchivo = useStore((s) => s.seleccionarArchivo);
  const seleccionarTabla = useStore((s) => s.seleccionarTabla);
  const setVista = useStore((s) => s.setVista);
  const setPestana = useStore((s) => s.setPestana);
  const alternarFiltro = useStore((s) => s.alternarFiltro);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierta(!useStore.getState().paletaAbierta);
      }
      if (e.key === "Escape") setAbierta(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAbierta]);

  const tabla = tablas.find((t) => t.id === tablaActiva);
  const valores = useMemo(() => {
    if (!tabla) return [];
    const out: { columnaId: string; columna: string; valor: string; crudo: unknown }[] = [];
    for (const c of tabla.columnas) {
      if (c.tipo !== "categoria" && c.tipo !== "estado") continue;
      const idx = tabla.columnas.indexOf(c);
      const vistos = new Set<string>();
      for (const f of tabla.filas) {
        const v = f[idx];
        if (v === null) continue;
        const k = aTexto(v);
        if (vistos.has(k)) continue;
        vistos.add(k);
        out.push({ columnaId: c.id, columna: c.nombre, valor: k, crudo: v });
        if (vistos.size >= 200) break;
      }
    }
    return out;
  }, [tabla]);

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={() => setAbierta(false)}>
      <Command
        label="Buscar"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-borde bg-superficie shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-borde px-3">
          <Command.Input autoFocus placeholder="Buscar tablas, columnas o valores…" className="h-11 w-full bg-transparent text-sm outline-none" />
          <button aria-label="Cerrar" onClick={() => setAbierta(false)} className="text-texto-suave">
            <X size={16} />
          </button>
        </div>
        <Command.List className="max-h-[50vh] overflow-auto p-2 text-sm">
          <Command.Empty className="p-3 text-texto-suave">Sin resultados.</Command.Empty>
          {archivos.length > 1 && (
            <Command.Group heading="Archivos" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-texto-suave">
              {archivos.map((a) => (
                <Item key={a.id} onSelect={() => { seleccionarArchivo(a.id); setAbierta(false); }}>
                  <FileSpreadsheet size={14} /> {a.nombre}
                </Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading="Tablas" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-texto-suave">
            {tablas.map((t) => (
              <Item key={t.id} value={`tabla ${t.nombre} ${t.hoja}`} onSelect={() => { seleccionarTabla(t.id); setVista("dashboard"); setAbierta(false); }}>
                <Table2 size={14} /> {t.nombre} <span className="text-texto-suave">· {t.hoja}</span>
              </Item>
            ))}
          </Command.Group>
          {tabla && (
            <Command.Group heading="Columnas" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-texto-suave">
              {tabla.columnas.map((c) => (
                <Item key={c.id} value={`columna ${c.nombre}`} onSelect={() => { setVista("entendimiento"); setAbierta(false); }}>
                  <Columns3 size={14} /> {c.nombre} <span className="text-texto-suave">· {c.tipo}</span>
                </Item>
              ))}
            </Command.Group>
          )}
          {valores.length > 0 && (
            <Command.Group heading="Valores (aplica filtro)" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-texto-suave">
              {valores.map((v) => (
                <Item
                  key={`${v.columnaId}:${v.valor}`}
                  value={`valor ${v.columna} ${v.valor}`}
                  onSelect={() => {
                    alternarFiltro(v.columnaId, v.crudo as never);
                    setVista("dashboard");
                    setPestana("resumen");
                    setAbierta(false);
                  }}
                >
                  <Tag size={14} /> {v.valor} <span className="text-texto-suave">· {v.columna}</span>
                </Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

function Item({ children, onSelect, value }: { children: React.ReactNode; onSelect: () => void; value?: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 data-[selected=true]:bg-acento-suave data-[selected=true]:text-acento"
    >
      {children}
    </Command.Item>
  );
}
