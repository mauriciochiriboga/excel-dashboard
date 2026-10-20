// Tipos centrales de la aplicación. Todo el pipeline (parsing → detección →
// clasificación → análisis) trabaja sobre estas estructuras y es puro: no
// depende de React.

/** Celda cruda tal como la entrega SheetJS, ya normalizada. */
export type Celda = string | number | boolean | Date | null;

/** Matriz de una hoja. Filas × columnas, sin rangos inflados. */
export interface HojaCruda {
  nombre: string;
  filas: Celda[][];
  /** Rangos combinados (merges) en coordenadas 0-based: [r0,c0,r1,c1]. */
  combinadas: [number, number, number, number][];
}

export interface ArchivoCrudo {
  id: string;
  nombre: string;
  tamano: number;
  hojas: HojaCruda[];
  /** Milisegundos que tardó el parsing. */
  tiempoMs: number;
  /** Archivo original, para poder subirlo al guardar. */
  file?: File;
}

export type TipoColumna =
  | "fecha"
  | "categoria"
  | "medida"
  | "identificador"
  | "estado"
  | "texto";

export type Agregacion = "suma" | "promedio" | "conteo";

export interface Columna {
  id: string;
  nombre: string;
  tipo: TipoColumna;
  /** Tipo que detectó el sistema, para mostrar "corregido por el usuario". */
  tipoDetectado: TipoColumna;
  agregacion: Agregacion;
  esPrincipal: boolean;
  /** Para medidas: valores en 0-1 o encabezado con % → se muestran como %. */
  esPorcentaje: boolean;
  distintos: number;
  nulos: number;
  ejemplo: string;
  /** Para fechas: granularidad dominante detectada. */
  granularidad?: "dia" | "mes" | "anio";
}

/** Jerarquía detectada: cada valor de `hijo` pertenece a un único `padre`. */
export interface Jerarquia {
  niveles: string[]; // ids de columna, de más general a más específico
}

export interface Tabla {
  id: string;
  archivoId: string;
  hoja: string;
  nombre: string;
  /** Rango original en la hoja (0-based, inclusive). */
  rango: { r0: number; c0: number; r1: number; c1: number };
  columnas: Columna[];
  filas: Celda[][];
  jerarquias: Jerarquia[];
  /** Avisos del detector (filas de totales descartadas, encabezado fusionado, etc.). */
  avisos: string[];
  /** true si la tabla fue despivotada desde formato ancho. */
  despivotada: boolean;
}

export interface Filtro {
  columnaId: string;
  valores: Celda[];
  /** Rango para fechas o medidas. */
  rango?: [number, number];
}

export interface ErrorCarga {
  archivo: string;
  mensaje: string;
}
