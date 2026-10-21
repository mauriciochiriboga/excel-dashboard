"use client";
import { espacioDireccion, type ConfigIA } from "./config";

export interface MensajeChat {
  rol: "usuario" | "asistente";
  texto: string;
}

/**
 * Envía la conversación al proveedor elegido y entrega el texto en streaming.
 * Ollama se llama directamente desde el navegador (los datos no salen de la máquina del usuario).
 * Claude pasa por /api/ia, que añade la clave del servidor o la del usuario.
 */
export async function enviarChat(
  config: ConfigIA,
  sistema: string,
  historial: MensajeChat[],
  onTexto: (fragmento: string) => void,
  senal: AbortSignal,
): Promise<void> {
  if (config.proveedor === "ollama") return chatOllama(config, sistema, historial, onTexto, senal);
  return chatClaude(config, sistema, historial, onTexto, senal);
}

async function chatOllama(config: ConfigIA, sistema: string, historial: MensajeChat[], onTexto: (s: string) => void, senal: AbortSignal) {
  const r = await fetch(`${config.ollamaUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: senal,
    ...({ targetAddressSpace: espacioDireccion(config.ollamaUrl) } as RequestInit),
    body: JSON.stringify({
      model: config.modelo,
      stream: true,
      keep_alive: "30m",
      options: { temperature: 0.3, num_ctx: 8192 },
      messages: [{ role: "system", content: sistema }, ...historial.map((m) => ({ role: m.rol === "usuario" ? "user" : "assistant", content: m.texto }))],
    }),
  });
  if (!r.ok || !r.body) throw new Error(`Ollama respondió ${r.status}. ¿Está en marcha y con el modelo «${config.modelo}» descargado?`);
  const lector = r.body.getReader();
  const dec = new TextDecoder();
  let resto = "";
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const lineas = resto.split("\n");
    resto = lineas.pop() ?? "";
    for (const l of lineas) {
      if (!l.trim()) continue;
      try {
        const j = JSON.parse(l) as { message?: { content?: string }; error?: string };
        if (j.error) throw new Error(j.error);
        if (j.message?.content) onTexto(j.message.content);
      } catch (e) {
        if ((e as Error).message && !(e instanceof SyntaxError)) throw e;
      }
    }
  }
}

async function chatClaude(config: ConfigIA, sistema: string, historial: MensajeChat[], onTexto: (s: string) => void, senal: AbortSignal) {
  const r = await fetch("/api/ia", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(config.claveAnthropic ? { "x-clave-usuario": config.claveAnthropic } : {}) },
    signal: senal,
    body: JSON.stringify({ modelo: config.modelo, sistema, mensajes: historial.map((m) => ({ role: m.rol === "usuario" ? "user" : "assistant", content: m.texto })) }),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `El servidor respondió ${r.status}.`);
  }
  if (!r.body) return;
  const lector = r.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    onTexto(dec.decode(value, { stream: true }));
  }
}
