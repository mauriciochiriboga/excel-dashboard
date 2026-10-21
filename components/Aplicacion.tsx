"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Encabezado } from "@/components/carga/Encabezado";
import { ZonaCarga } from "@/components/carga/ZonaCarga";
import { Entendimiento } from "@/components/entendimiento/Entendimiento";
import { Vacio } from "@/components/ui";

const Dashboard = dynamic(() => import("@/components/dashboard/Dashboard").then((m) => m.Dashboard), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-texto-suave">Cargando gráficos…</p>,
});
const Paleta = dynamic(() => import("@/components/paleta/PaletaComandos").then((m) => m.PaletaComandos), { ssr: false });
const Asistente = dynamic(() => import("@/components/ia/Asistente").then((m) => m.Asistente), { ssr: false });

let urlInicialProcesada = false;

/**
 * Pantalla principal. Sin parámetros: analizar archivos locales. Con `dashboardId` abre un
 * dashboard guardado (requiere sesión y permiso). Con `slugPublico` abre uno publicado sin sesión.
 */
export function Aplicacion({ dashboardId, slugPublico }: { dashboardId?: string; slugPublico?: string }) {
  const vista = useStore((s) => s.vista);
  const hayDatos = useStore((s) => s.archivos.length > 0);
  const cargarDesdeUrl = useStore((s) => s.cargarDesdeUrl);
  const abrirDashboard = useStore((s) => s.abrirDashboard);
  const abrirPublico = useStore((s) => s.abrirPublico);
  const dashboardActual = useStore((s) => s.dashboardActual);
  const errores = useStore((s) => s.errores);
  const cargas = useStore((s) => s.cargas);

  useEffect(() => {
    if (dashboardId) {
      if (useStore.getState().dashboardActual?.id !== dashboardId) void abrirDashboard(dashboardId);
      return;
    }
    if (slugPublico) {
      if (useStore.getState().dashboardActual?.publico_slug !== slugPublico) void abrirPublico(slugPublico);
      return;
    }
    if (urlInicialProcesada) return;
    urlInicialProcesada = true;
    const u = new URLSearchParams(window.location.search).get("url");
    if (u && useStore.getState().archivos.length === 0) void cargarDesdeUrl(u);
  }, [dashboardId, slugPublico, cargarDesdeUrl, abrirDashboard, abrirPublico]);

  const abriendoRemoto = (dashboardId || slugPublico) && !hayDatos;

  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        {abriendoRemoto ? (
          <div className="mx-auto max-w-xl py-10">
            {errores.length > 0 ? (
              <Vacio titulo="No se pudo abrir el dashboard" detalle={errores[errores.length - 1].mensaje} />
            ) : (
              <Vacio titulo="Abriendo dashboard…" detalle={cargas[0]?.detalle ?? "Descargando el archivo"} />
            )}
          </div>
        ) : vista === "carga" || !hayDatos ? (
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
      {hayDatos && <Asistente />}
      <footer className="border-t border-borde px-4 py-3 text-center text-xs text-texto-suave">
        {dashboardActual
          ? `Dashboard guardado · ${dashboardActual.puedeEditar ? "puedes editarlo" : "solo lectura"}`
          : "Excel Dashboard · los archivos no salen de tu navegador hasta que pulses Guardar"}
      </footer>
    </>
  );
}
