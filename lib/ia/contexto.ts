// Construye el contexto textual que recibe el modelo: qué está viendo el usuario y los números clave.
import type { Analisis } from "@/components/dashboard/useAnalisis";
import type { Tabla, Filtro } from "../tipos";
import { agruparPor, matrizCorrelacion, estadisticas, etiquetaValor } from "../analisis";
import { fmtNumero, fmtPorcentaje, fmtFecha } from "../formato";

const NOMBRE_PESTANA: Record<string, string> = {
  resumen: "Resumen (KPIs, hallazgos, serie y barras)",
  tendencias: "Tendencias (serie temporal con máximo, mínimo y promedio; desglose por categoría)",
  segmentos: "Segmentos (barras por cada categoría; clic filtra)",
  distribucion: "Distribución (histograma y estadísticas de una medida)",
  relaciones: "Relaciones (matriz de correlación y dispersión)",
  explorador: "Explorador (drill-down por jerarquía)",
  datos: "Datos (tabla completa filtrable con exportación CSV)",
};

export function contextoDatos(a: Analisis | null, vista: string, pestana: string, filtros: Filtro[], tablas: Tabla[], compacto = false): string {
  const partes: string[] = [];
  partes.push(`## Dónde está el usuario\nVista: ${vista === "entendimiento" ? "«Cómo lo entendí» (tablas detectadas y clasificación de columnas)" : vista === "dashboard" ? `Dashboard, pestaña ${NOMBRE_PESTANA[pestana] ?? pestana}` : "Carga de archivos"}.`);

  if (tablas.length > 1) {
    partes.push(`## Tablas disponibles en el archivo\n${tablas.map((t) => `- ${t.nombre} (hoja ${t.hoja}): ${fmtNumero(t.filas.length)} filas × ${t.columnas.length} columnas`).join("\n")}`);
  }
  if (!a) return partes.join("\n\n");

  const { tabla, filas, medida, fecha, gran, serie, kpis, hallazgos, categorias, medidas } = a;
  const f = (v: number, porc = false) => (porc ? fmtPorcentaje(v) : fmtNumero(v));

  partes.push(
    `## Tabla activa: ${tabla.nombre}\nHoja ${tabla.hoja}. ${fmtNumero(filas.length)} filas${filtros.length ? ` tras filtros (de ${fmtNumero(tabla.filas.length)})` : ""}. Columnas:\n` +
      tabla.columnas.map((c) => `- ${c.nombre}: ${c.tipo}${c.tipo === "medida" ? ` (${c.agregacion}${c.esPorcentaje ? ", porcentaje" : ""}${c.esPrincipal ? ", MEDIDA PRINCIPAL" : ""})` : ""}, ${fmtNumero(c.distintos)} valores distintos, ejemplo «${c.ejemplo}»`).join("\n") +
      (tabla.jerarquias.length ? `\nJerarquías: ${tabla.jerarquias.map((j) => j.niveles.map((id) => tabla.columnas.find((c) => c.id === id)?.nombre).join(" → ")).join("; ")}` : "") +
      (tabla.avisos.length ? `\nAvisos de detección: ${tabla.avisos.join(" ")}` : ""),
  );

  if (filtros.length) {
    partes.push(
      `## Filtros activos\n` +
        filtros
          .map((fl) => {
            const col = tabla.columnas.find((c) => c.id === fl.columnaId);
            if (!col) return "";
            if (fl.rango) return `- ${col.nombre}: ${col.tipo === "fecha" ? `${fmtFecha(new Date(fl.rango[0]))} a ${fmtFecha(new Date(fl.rango[1]))}` : `${f(fl.rango[0])} a ${f(fl.rango[1])}`}`;
            return `- ${col.nombre} = ${fl.valores.map((v) => etiquetaValor(v, col)).join(", ")}`;
          })
          .join("\n"),
    );
  }

  if (kpis.length) {
    partes.push(
      `## KPIs (sobre las filas filtradas)\n` +
        kpis
          .map((k) => `- ${k.columna.nombre} (${k.columna.agregacion}): ${f(k.valor, k.columna.esPorcentaje)}${k.variacion !== null ? `; variación ${k.variacion >= 0 ? "+" : ""}${fmtPorcentaje(k.variacion)} (${k.periodoActual} vs ${k.periodoAnterior})` : ""}`)
          .join("\n"),
    );
  }

  if (hallazgos.length) partes.push(`## Hallazgos automáticos\n${hallazgos.map((h) => `- ${h.texto}`).join("\n")}`);

  if (serie.length && medida && fecha) {
    const max = serie.reduce((x, p) => (p.valor > x.valor ? p : x));
    const min = serie.reduce((x, p) => (p.valor < x.valor ? p : x));
    const prom = serie.reduce((x, p) => x + p.valor, 0) / serie.length;
    const muestra = compacto ? serie.slice(-8) : serie.length > 24 ? [...serie.slice(0, 6), ...serie.slice(-12)] : serie;
    partes.push(
      `## Serie temporal de ${medida.nombre} por ${gran === "anio" ? "año" : gran === "mes" ? "mes" : "día"} (${serie.length} periodos, de ${serie[0].etiqueta} a ${serie[serie.length - 1].etiqueta})\nMáximo ${max.etiqueta}: ${f(max.valor, medida.esPorcentaje)}. Mínimo ${min.etiqueta}: ${f(min.valor, medida.esPorcentaje)}. Promedio: ${f(prom, medida.esPorcentaje)}.\n` +
        muestra.map((p) => `${p.etiqueta}: ${f(p.valor, medida.esPorcentaje)}`).join(" | ") +
        (compacto ? " (últimos 8 periodos)" : serie.length > 24 ? " (se muestran los 6 primeros y 12 últimos periodos)" : ""),
    );
  }

  const cats = categorias.slice(0, compacto ? 3 : 5);
  if (cats.length) {
    partes.push(
      `## Segmentos (${medida ? medida.nombre : "registros"} por categoría, hasta 8 principales)\n` +
        cats
          .map((c) => {
            const pts = agruparPor(filas, tabla, c.id, medida, compacto ? 5 : 8);
            const total = pts.reduce((x, p) => x + Math.abs(p.valor), 0);
            return `- ${c.nombre} (${c.distintos} valores): ` + pts.map((p) => `${p.etiqueta} ${f(p.valor, medida?.esPorcentaje)}${total > 0 && medida?.agregacion !== "promedio" ? ` (${fmtPorcentaje(Math.abs(p.valor) / total, 0)})` : ""}`).join("; ");
          })
          .join("\n"),
    );
  }

  if (medidas.length) {
    partes.push(
      `## Estadísticas de las medidas\n` +
        medidas
          .slice(0, compacto ? 3 : 6)
          .map((m) => {
            const e = estadisticas(filas, tabla.columnas.indexOf(m));
            if (!e) return `- ${m.nombre}: sin valores`;
            return `- ${m.nombre}: n=${fmtNumero(e.n)}, mín ${f(e.min, m.esPorcentaje)}, Q1 ${f(e.q1, m.esPorcentaje)}, mediana ${f(e.mediana, m.esPorcentaje)}, media ${f(e.media, m.esPorcentaje)}, Q3 ${f(e.q3, m.esPorcentaje)}, máx ${f(e.max, m.esPorcentaje)}, desv. ${f(e.sd, m.esPorcentaje)}`;
          })
          .join("\n"),
    );
  }

  if (medidas.length >= 2) {
    const corr = matrizCorrelacion(filas, tabla);
    const pares = corr.pares.slice(0, 6);
    if (pares.length) partes.push(`## Correlaciones (Pearson)\n${pares.map((p) => `- ${p.a.nombre} × ${p.b.nombre}: r = ${fmtNumero(p.r, 2)}`).join("\n")}`);
  }

  const texto = partes.join("\n\n");
  return texto.length > 12000 ? texto.slice(0, 12000) + "\n(contexto recortado)" : texto;
}
