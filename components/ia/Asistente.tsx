"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Mic, MicOff, Send, Settings2, Square, Volume2, VolumeX, X, RefreshCw, Copy, Check, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAnalisis } from "@/components/dashboard/useAnalisis";
import { Boton, Etiqueta, cx } from "@/components/ui";
import { contextoDatos } from "@/lib/ia/contexto";
import { promptSistema, sugerencias } from "@/lib/ia/prompt";
import { enviarChat, type MensajeChat } from "@/lib/ia/chat";
import {
  MODELOS_CLAUDE,
  OLLAMA_RECOMENDADOS,
  comandoOllamaOrigins,
  detectarOllama,
  guardarConfigIA,
  leerConfigIA,
  servidorTieneClave,
  type ConfigIA,
  type EstadoOllama,
  type ModeloIA,
} from "@/lib/ia/config";

type Reconocimiento = { start(): void; stop(): void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

/** Panel flotante del asistente: chat con contexto de la sección visible, dictado y lectura en voz alta. */
export function Asistente() {
  const a = useAnalisis();
  const vista = useStore((s) => s.vista);
  const pestana = useStore((s) => s.pestana);
  const filtros = useStore((s) => s.filtros);
  const todasTablas = useStore((s) => s.tablas);
  const archivoActivo = useStore((s) => s.archivoActivo);
  const tablasArchivo = useMemo(() => todasTablas.filter((t) => t.archivoId === archivoActivo), [todasTablas, archivoActivo]);

  const [abierto, setAbierto] = useState(false);
  const [config, setConfig] = useState<ConfigIA | null>(null);
  const [ollama, setOllama] = useState<EstadoOllama | null>(null);
  const [claveServidor, setClaveServidor] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [hablando, setHablando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<Reconocimiento | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const soportaVoz = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const soportaTTS = typeof window !== "undefined" && "speechSynthesis" in window;

  /** Detección automática: Ollama local + clave del servidor. Elige un modelo por defecto sensato. */
  const detectar = useCallback(async (cfg: ConfigIA) => {
    const [o, cs] = await Promise.all([detectarOllama(cfg.ollamaUrl), servidorTieneClave()]);
    setOllama(o);
    setClaveServidor(cs);
    let nueva = { ...cfg };
    const tieneOllama = o.disponible && o.modelos.length > 0;
    const ollamaValido = tieneOllama && (cfg.proveedor !== "ollama" || o.modelos.some((m) => m.id === cfg.modelo));
    if (cfg.proveedor === "ollama" && !ollamaValido) {
      if (tieneOllama) nueva = { ...nueva, modelo: o.modelos[0].id };
      else if (cs || cfg.claveAnthropic) nueva = { ...nueva, proveedor: "claude", modelo: MODELOS_CLAUDE[0].id };
      else nueva = { ...nueva, modelo: "" };
    }
    if (cfg.proveedor === "claude" && !cfg.modelo) nueva = { ...nueva, modelo: MODELOS_CLAUDE[0].id };
    setConfig(nueva);
    guardarConfigIA(nueva);
  }, []);

  useEffect(() => {
    const cfg = leerConfigIA();
    setConfig(cfg);
    void detectar(cfg);
  }, [detectar]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, pensando]);

  const contexto = useMemo(() => contextoDatos(a, vista, pestana, filtros, tablasArchivo, config?.proveedor === "ollama"), [a, vista, pestana, filtros, tablasArchivo, config?.proveedor]);
  const modelosDisponibles: ModeloIA[] = useMemo(() => [...(ollama?.modelos ?? []), ...(claveServidor || config?.claveAnthropic ? MODELOS_CLAUDE : [])], [ollama, claveServidor, config?.claveAnthropic]);
  const listo = !!config && !!config.modelo && (config.proveedor === "ollama" ? !!ollama?.disponible : claveServidor || !!config.claveAnthropic);

  const actualizarConfig = (c: Partial<ConfigIA>) => {
    if (!config) return;
    const n = { ...config, ...c };
    setConfig(n);
    guardarConfigIA(n);
  };

  const hablar = useCallback(
    (texto: string) => {
      if (!soportaTTS || !config?.leerEnVozAlta) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto.replace(/\*\*/g, "").replace(/[•\-]\s/g, ""));
      u.lang = "es-ES";
      const voces = window.speechSynthesis.getVoices();
      const v = voces.find((x) => x.name === config.voz) ?? voces.find((x) => x.lang.startsWith("es"));
      if (v) u.voice = v;
      u.rate = 1.02;
      u.onstart = () => setHablando(true);
      u.onend = () => setHablando(false);
      u.onerror = () => setHablando(false);
      window.speechSynthesis.speak(u);
    },
    [config, soportaTTS],
  );

  const enviar = useCallback(
    async (texto: string) => {
      const t = texto.trim();
      if (!t || !config || pensando) return;
      if (!listo) {
        setMostrarConfig(true);
        return;
      }
      setError(null);
      const historial: MensajeChat[] = [...mensajes, { rol: "usuario", texto: t }];
      setMensajes([...historial, { rol: "asistente", texto: "" }]);
      setEntrada("");
      setPensando(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let acumulado = "";
      try {
        await enviarChat(config, promptSistema(contexto, config.proveedor === "ollama"), historial.slice(-12), (frag) => {
          acumulado += frag;
          setMensajes((m) => {
            const copia = [...m];
            copia[copia.length - 1] = { rol: "asistente", texto: acumulado };
            return copia;
          });
        }, ctrl.signal);
        hablar(acumulado);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
          setMensajes((m) => m.slice(0, -1));
        }
      } finally {
        setPensando(false);
        abortRef.current = null;
      }
    },
    [config, pensando, listo, mensajes, contexto, hablar],
  );

  const alternarDictado = () => {
    if (!soportaVoz) return;
    if (escuchando) {
      recRef.current?.stop();
      return;
    }
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Reconocimiento }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "es-ES";
    rec.interimResults = true;
    rec.continuous = false;
    let final = "";
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      final = txt;
      setEntrada(txt);
    };
    rec.onend = () => {
      setEscuchando(false);
      recRef.current = null;
      if (final.trim()) void enviar(final);
    };
    rec.onerror = () => setEscuchando(false);
    recRef.current = rec;
    setEscuchando(true);
    rec.start();
  };

  const detener = () => {
    abortRef.current?.abort();
    if (soportaTTS) window.speechSynthesis.cancel();
    setHablando(false);
  };

  const origen = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <button
        onClick={() => setAbierto(!abierto)}
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente de IA"}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-acento text-white shadow-lg transition hover:scale-105 dark:text-fondo"
      >
        {abierto ? <X size={22} /> : <Bot size={22} />}
      </button>

      {abierto && (
        <aside
          role="dialog"
          aria-label="Asistente de IA"
          className="fixed bottom-20 right-3 z-40 flex h-[min(78vh,640px)] w-[min(94vw,420px)] flex-col overflow-hidden rounded-xl border border-borde bg-superficie shadow-2xl"
        >
          <header className="flex items-center gap-2 border-b border-borde px-3 py-2">
            <Sparkles size={16} className="text-acento" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Asistente de datos</p>
              <p className="truncate text-[11px] text-texto-suave">
                {config?.modelo ? `${config.proveedor === "ollama" ? "Local · " : "Claude · "}${config.modelo}` : "Sin modelo configurado"}
                {a ? ` · ${a.tabla.nombre}` : ""}
              </p>
            </div>
            {soportaTTS && (
              <button title={config?.leerEnVozAlta ? "Desactivar lectura en voz alta" : "Leer respuestas en voz alta"} aria-pressed={config?.leerEnVozAlta} onClick={() => actualizarConfig({ leerEnVozAlta: !config?.leerEnVozAlta })} className={cx("rounded p-1.5", config?.leerEnVozAlta ? "bg-acento-suave text-acento" : "text-texto-suave hover:text-texto")}>
                {config?.leerEnVozAlta ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            )}
            <button title="Configurar modelos" aria-label="Configurar modelos" onClick={() => setMostrarConfig(!mostrarConfig)} className={cx("rounded p-1.5", mostrarConfig ? "bg-acento-suave text-acento" : "text-texto-suave hover:text-texto")}>
              <Settings2 size={16} />
            </button>
          </header>

          {mostrarConfig ? (
            <Configuracion
              config={config}
              ollama={ollama}
              claveServidor={claveServidor}
              modelos={modelosDisponibles}
              origen={origen}
              onCambio={actualizarConfig}
              onDetectar={() => config && detectar(config)}
              onCerrar={() => setMostrarConfig(false)}
            />
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
                {mensajes.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-texto-suave">
                      Pregúntame por los datos que ves en pantalla{a ? ` (${vista === "entendimiento" ? "clasificación de columnas" : `pestaña ${pestana}`})` : ""}. Razono con las cifras reales del dashboard.
                    </p>
                    {!listo && (
                      <p className="rounded-md bg-aviso/15 px-2 py-1.5 text-xs text-aviso">
                        {ollama && !ollama.disponible && !claveServidor && !config?.claveAnthropic
                          ? "No detecté Ollama ni una clave de Claude. Abre la configuración para activarlo."
                          : "Elige un modelo en la configuración."}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {sugerencias(pestana, vista).map((s) => (
                        <button key={s} onClick={() => void enviar(s)} className="rounded-full border border-borde px-2.5 py-1 text-xs hover:border-acento hover:text-acento">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {mensajes.map((m, i) => (
                  <div key={i} className={cx("group relative max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 leading-relaxed", m.rol === "usuario" ? "ml-auto bg-acento text-white dark:text-fondo" : "bg-superficie-2")}>
                    {m.texto || (pensando && i === mensajes.length - 1 ? <span className="animate-pulse text-texto-suave">Pensando…</span> : "")}
                    {m.rol === "asistente" && m.texto && (
                      <button
                        aria-label="Copiar respuesta"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(m.texto);
                            setCopiado(i);
                            setTimeout(() => setCopiado(null), 1200);
                          } catch {
                            /* sin portapapeles */
                          }
                        }}
                        className="absolute -right-1 -top-1 hidden rounded bg-superficie p-1 text-texto-suave shadow group-hover:block"
                      >
                        {copiado === i ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                ))}
                {error && (
                  <p role="alert" className="rounded-md bg-negativo/10 px-2 py-1.5 text-xs text-negativo">
                    {error}
                  </p>
                )}
                <div ref={finRef} />
              </div>

              <form
                className="flex items-end gap-1.5 border-t border-borde p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar(entrada);
                }}
              >
                {soportaVoz && (
                  <button type="button" onClick={alternarDictado} title={escuchando ? "Detener dictado" : "Hablar"} aria-pressed={escuchando} className={cx("rounded-md p-2", escuchando ? "animate-pulse bg-negativo/15 text-negativo" : "text-texto-suave hover:bg-superficie-2")}>
                    {escuchando ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
                <textarea
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void enviar(entrada);
                    }
                  }}
                  rows={1}
                  placeholder={escuchando ? "Escuchando…" : "Escribe o dicta tu pregunta"}
                  aria-label="Pregunta"
                  className="max-h-28 min-h-[38px] flex-1 resize-y rounded-md border border-borde bg-fondo px-2 py-1.5 text-sm"
                />
                {pensando || hablando ? (
                  <Boton type="button" variante="secundario" onClick={detener} title="Detener">
                    <Square size={16} />
                  </Boton>
                ) : (
                  <Boton type="submit" variante="primario" disabled={!entrada.trim()} title="Enviar">
                    <Send size={16} />
                  </Boton>
                )}
              </form>
            </>
          )}
        </aside>
      )}
    </>
  );
}

function Configuracion({
  config,
  ollama,
  claveServidor,
  modelos,
  origen,
  onCambio,
  onDetectar,
  onCerrar,
}: {
  config: ConfigIA | null;
  ollama: EstadoOllama | null;
  claveServidor: boolean;
  modelos: ModeloIA[];
  origen: string;
  onCambio: (c: Partial<ConfigIA>) => void;
  onDetectar: () => void;
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const cargar = () => setVoces(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("es")));
    cargar();
    window.speechSynthesis.onvoiceschanged = cargar;
  }, []);
  if (!config) return null;
  const comando = comandoOllamaOrigins(origen);
  const locales = modelos.filter((m) => m.proveedor === "ollama");
  const claude = modelos.filter((m) => m.proveedor === "claude");

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3 text-sm">
      <section>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-semibold">Modelos locales (Ollama)</h4>
          <button onClick={onDetectar} className="flex items-center gap-1 text-xs text-acento">
            <RefreshCw size={12} /> Volver a detectar
          </button>
        </div>
        {ollama?.disponible ? (
          <>
            <Etiqueta tono="positivo">Ollama detectado · {locales.length} modelo(s)</Etiqueta>
            <ul className="mt-2 space-y-1">
              {locales.map((m) => (
                <OpcionModelo key={m.id} m={m} activo={config.proveedor === "ollama" && config.modelo === m.id} onClick={() => onCambio({ proveedor: "ollama", modelo: m.id })} />
              ))}
            </ul>
            <p className="mt-2 text-xs text-texto-suave">
              Para añadir otro modelo recomendado, en tu terminal: <code className="rounded bg-superficie-2 px-1">ollama pull {OLLAMA_RECOMENDADOS.find((r) => !locales.some((l) => l.id === r)) ?? OLLAMA_RECOMENDADOS[0]}</code>
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <Etiqueta tono="aviso">{ollama?.problema === "cors" ? "Ollama no acepta llamadas desde esta web" : "Ollama no responde"}</Etiqueta>
            <p className="text-xs text-texto-suave">
              {ollama?.problema === "cors"
                ? "Ollama no acepta llamadas desde esta web, o el navegador pidió permiso de red local y se denegó. Ejecuta una vez este comando en PowerShell, acepta el aviso de Chrome «permitir acceso a la red local» y pulsa «Volver a detectar»:"
                : "Instala Ollama desde ollama.com, descarga un modelo (por ejemplo «ollama pull qwen2.5:7b») y autoriza esta web con este comando en PowerShell:"}
            </p>
            <div className="flex items-start gap-1">
              <code className="block max-h-24 flex-1 overflow-auto whitespace-pre-wrap break-all rounded bg-superficie-2 p-2 text-[11px]">{comando}</code>
              <button
                aria-label="Copiar comando"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(comando);
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1200);
                  } catch {
                    /* copiar a mano */
                  }
                }}
                className="rounded border border-borde p-1.5"
              >
                {copiado ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
        <label className="mt-2 flex items-center gap-2 text-xs">
          URL de Ollama
          <input value={config.ollamaUrl} onChange={(e) => onCambio({ ollamaUrl: e.target.value })} className="flex-1 rounded-md border border-borde bg-fondo px-2 py-1" />
        </label>
      </section>

      <section>
        <h4 className="mb-1 font-semibold">Modelos Claude (recomendados)</h4>
        {claveServidor ? (
          <Etiqueta tono="positivo">Clave configurada en el servidor</Etiqueta>
        ) : (
          <label className="flex flex-col gap-1 text-xs">
            Tu clave de Anthropic (se guarda solo en este navegador)
            <input type="password" value={config.claveAnthropic} onChange={(e) => onCambio({ claveAnthropic: e.target.value })} placeholder="sk-ant-…" autoComplete="off" className="rounded-md border border-borde bg-fondo px-2 py-1" />
          </label>
        )}
        <ul className="mt-2 space-y-1">
          {(claude.length ? claude : MODELOS_CLAUDE).map((m) => (
            <OpcionModelo key={m.id} m={m} activo={config.proveedor === "claude" && config.modelo === m.id} deshabilitado={!claveServidor && !config.claveAnthropic} onClick={() => onCambio({ proveedor: "claude", modelo: m.id })} />
          ))}
        </ul>
      </section>

      {"speechSynthesis" in window && (
        <section>
          <h4 className="mb-1 font-semibold">Voz</h4>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={config.leerEnVozAlta} onChange={(e) => onCambio({ leerEnVozAlta: e.target.checked })} /> Leer las respuestas en voz alta
          </label>
          {voces.length > 0 && (
            <label className="mt-1 flex items-center gap-2 text-xs">
              Voz
              <select value={config.voz ?? ""} onChange={(e) => onCambio({ voz: e.target.value || null })} className="flex-1 rounded-md border border-borde bg-fondo px-2 py-1">
                <option value="">Automática (español)</option>
                {voces.map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            </label>
          )}
          <p className="mt-1 text-xs text-texto-suave">El dictado y la lectura usan la voz del propio navegador; no se envía audio a ningún servidor.</p>
        </section>
      )}

      <Boton variante="primario" onClick={onCerrar} className="w-full justify-center">
        Listo
      </Boton>
    </div>
  );
}

function OpcionModelo({ m, activo, deshabilitado, onClick }: { m: ModeloIA; activo: boolean; deshabilitado?: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={deshabilitado}
        aria-pressed={activo}
        className={cx("flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left disabled:opacity-50", activo ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2")}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{m.nombre}</span>
          {m.detalle && <span className="block truncate text-xs text-texto-suave">{m.detalle}</span>}
        </span>
        {m.recomendado && <Etiqueta tono="acento">Recomendado</Etiqueta>}
      </button>
    </li>
  );
}
