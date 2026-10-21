"use client";
// Configuración del asistente: proveedores, modelos y preferencias (localStorage).

export type Proveedor = "ollama" | "claude";

export interface ModeloIA {
  id: string;
  nombre: string;
  proveedor: Proveedor;
  detalle?: string;
  recomendado?: boolean;
}

export interface ConfigIA {
  proveedor: Proveedor;
  modelo: string;
  ollamaUrl: string;
  /** Clave de Anthropic del usuario (opcional; si el servidor tiene la suya, no hace falta). */
  claveAnthropic: string;
  leerEnVozAlta: boolean;
  voz: string | null;
}

export const MODELOS_CLAUDE: ModeloIA[] = [
  { id: "claude-opus-5-5", nombre: "Claude Opus 5.5", proveedor: "claude", detalle: "Recomendado · máxima calidad de razonamiento", recomendado: true },
  { id: "claude-sonnet-5-5", nombre: "Claude Sonnet 5.5", proveedor: "claude", detalle: "Rápido y económico", recomendado: true },
  { id: "claude-haiku-4-5", nombre: "Claude Haiku 4.5", proveedor: "claude", detalle: "El más veloz, respuestas cortas" },
];

/** Modelos locales recomendados si el usuario quiere descargarlos en Ollama. */
export const OLLAMA_RECOMENDADOS = ["qwen2.5:7b", "llama3.1:8b", "gemma3:12b", "mistral:7b", "deepseek-r1:8b"];

const CLAVE = "excel-dashboard:ia";
const POR_DEFECTO: ConfigIA = { proveedor: "ollama", modelo: "", ollamaUrl: "http://localhost:11434", claveAnthropic: "", leerEnVozAlta: false, voz: null };

export function leerConfigIA(): ConfigIA {
  try {
    return { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE) ?? "{}") };
  } catch {
    return POR_DEFECTO;
  }
}

export function guardarConfigIA(c: ConfigIA) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(c));
  } catch {
    /* sin almacenamiento */
  }
}

export interface EstadoOllama {
  disponible: boolean;
  modelos: ModeloIA[];
  /** Mensaje de diagnóstico cuando no se puede usar. */
  problema?: "no-responde" | "cors" | "permiso";
}

/** Chrome distingue «loopback» (localhost/127.0.0.1) de «local» (IP de la red privada). */
export function espacioDireccion(url: string): "loopback" | "local" {
  return /^(https?:\/\/)?(localhost|127\.|\[::1\])/i.test(url) ? "loopback" : "local";
}

/** Detecta Ollama en la máquina del usuario y lista sus modelos. */
export async function detectarOllama(url: string): Promise<EstadoOllama> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000); // margen para el aviso de permiso de red local de Chrome
  try {
    // targetAddressSpace: Chrome exige declararlo para llamar a localhost desde una página https (Local Network Access).
    const r = await fetch(`${url.replace(/\/$/, "")}/api/tags`, { signal: ctrl.signal, ...({ targetAddressSpace: espacioDireccion(url) } as RequestInit) });
    if (!r.ok) return { disponible: false, modelos: [], problema: "no-responde" };
    const j = (await r.json()) as { models?: { name: string; details?: { parameter_size?: string; family?: string } }[] };
    const modelos: ModeloIA[] = (j.models ?? []).map((m) => ({
      id: m.name,
      nombre: m.name,
      proveedor: "ollama",
      detalle: [m.details?.family, m.details?.parameter_size].filter(Boolean).join(" · "),
    }));
    return { disponible: true, modelos };
  } catch (e) {
    // Chrome bloquea https → localhost hasta que el usuario concede «acceso a la red local»;
    // mientras el permiso está pendiente la petición se queda colgada (abort) o falla.
    const permiso = await estadoPermisoRedLocal();
    if (permiso === "prompt" || permiso === "denied") return { disponible: false, modelos: [], problema: "permiso" };
    const esAbort = (e as Error).name === "AbortError";
    return { disponible: false, modelos: [], problema: esAbort ? "no-responde" : "cors" };
  } finally {
    clearTimeout(t);
  }
}

/** Estado del permiso de red local de Chrome (null si el navegador no lo expone). */
export async function estadoPermisoRedLocal(): Promise<PermissionState | null> {
  try {
    const p = await navigator.permissions.query({ name: "local-network-access" as PermissionName });
    return p.state;
  } catch {
    return null;
  }
}

/** Comprueba si el servidor tiene clave de Anthropic configurada. */
export async function servidorTieneClave(): Promise<boolean> {
  try {
    const r = await fetch("/api/ia", { method: "GET" });
    const j = (await r.json()) as { claveServidor: boolean };
    return j.claveServidor;
  } catch {
    return false;
  }
}

/** Comando para autorizar el origen de la app en Ollama (Windows PowerShell). */
export function comandoOllamaOrigins(origen: string) {
  return `[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS','${origen},http://localhost:3000','User'); Get-Process ollama* -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Process "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama app.exe"`;
}
