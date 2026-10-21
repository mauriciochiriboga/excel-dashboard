import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODELOS_PERMITIDOS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"]);

/** GET: indica si el servidor tiene clave propia (para no pedírsela al usuario). */
export async function GET() {
  return NextResponse.json({ claveServidor: Boolean(process.env.ANTHROPIC_API_KEY) });
}

/** POST: reenvía la conversación a Claude y devuelve el texto en streaming (texto plano). */
export async function POST(request: Request) {
  const claveUsuario = request.headers.get("x-clave-usuario")?.trim();
  const apiKey = claveUsuario || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No hay clave de Anthropic. Añade la tuya en la configuración del asistente o define ANTHROPIC_API_KEY en el servidor." }, { status: 401 });
  }
  const cuerpo = (await request.json()) as { modelo: string; sistema: string; mensajes: Anthropic.MessageParam[] };
  const modelo = MODELOS_PERMITIDOS.has(cuerpo.modelo) ? cuerpo.modelo : "claude-opus-5-5";
  if (!Array.isArray(cuerpo.mensajes) || cuerpo.mensajes.length === 0) {
    return NextResponse.json({ error: "Conversación vacía." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controlador) {
      try {
        const s = client.messages.stream({
          model: modelo,
          max_tokens: 4096,
          system: [{ type: "text", text: cuerpo.sistema, cache_control: { type: "ephemeral" } }],
          messages: cuerpo.mensajes,
          output_config: { effort: modelo === "claude-haiku-4-5" ? undefined : "low" },
        });
        for await (const evento of s) {
          if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") {
            controlador.enqueue(encoder.encode(evento.delta.text));
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") controlador.enqueue(encoder.encode("\n\n(El modelo declinó responder a esta consulta.)"));
        controlador.close();
      } catch (e) {
        const msg = e instanceof Anthropic.AuthenticationError ? "Clave de Anthropic inválida." : e instanceof Anthropic.RateLimitError ? "Límite de uso alcanzado; inténtalo en unos segundos." : (e as Error).message;
        controlador.enqueue(encoder.encode(`\n\n⚠ ${msg}`));
        controlador.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
