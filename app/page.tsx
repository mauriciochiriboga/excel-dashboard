"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Encabezado } from "@/components/carga/Encabezado";
import { ZonaCarga } from "@/components/carga/ZonaCarga";
import { Entendimiento } from "@/components/entendimiento/Entendimiento";

const Dashboard = dynamic(() => import("@/components/dashboard/Dashboard").then((m) => m.Dashboard), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-texto-suave">Cargando gráficos…</p>,
});
const Paleta = dynamic(() => import("@/components/paleta/PaletaComandos").then((m) => m.PaletaComandos), { ssr: false });

let urlInicialProcesada = false;

export default function Pagina() {
  const vista = useStore((s) => s.vista);
  const hayDatos = useStore((s) => s.archivos.length > 0);
  const cargarDesdeUrl = useStore((s) => s.cargarDesdeUrl);

  // ?url=... abre un archivo directamente (base para dashboards compartidos).
  useEffect(() => {
    if (urlInicialProcesada) return;
    urlInicialProcesada = true;
    const u = new URLSearchParams(window.location.search).get("url");
    if (u && useStore.getState().archivos.length === 0) void cargarDesdeUrl(u);
  }, [cargarDesdeUrl]);

  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        {vista === "carga" || !hayDatos ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
            {!hayDatos && (
              <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight">De Excel a dashboard en segundos</h1>
                <p className="mt-2 text-texto-suave">
                  Sube un archivo con tablas y obtén KPIs, tendencias, segmentos y hallazgos automáticos. Todo se procesa en tu navegador.
                </p>
              </div>
            )}
            <ZonaCarga />
          </div>
        ) : vista === "entendimiento" ? (
          <Entendimiento />
        ) : (
          <Dashboard />
        )}
      </main>
      {hayDatos && <Paleta />}
      <footer className="border-t border-borde px-4 py-3 text-center text-xs text-texto-suave">
        Excel Dashboard · los archivos nunca salen de tu navegador
      </footer>
    </>
  );
}
