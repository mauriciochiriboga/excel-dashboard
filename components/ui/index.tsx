"use client";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function Boton({
  variante = "secundario",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "fantasma" | "peligro" }) {
  const base = "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const v = {
    primario: "bg-acento text-white hover:opacity-90 dark:text-fondo",
    secundario: "border border-borde bg-superficie hover:bg-superficie-2",
    fantasma: "hover:bg-superficie-2",
    peligro: "border border-negativo/40 text-negativo hover:bg-negativo/10",
  }[variante];
  return <button className={cx(base, v, className)} {...props} />;
}

export function Tarjeta({ children, className, titulo, accion }: { children: ReactNode; className?: string; titulo?: ReactNode; accion?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-borde bg-superficie p-4 min-w-0", className)}>
      {(titulo || accion) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
          {titulo && <h3 className="text-sm font-semibold text-texto">{titulo}</h3>}
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

export function Etiqueta({ children, tono = "neutro", className }: { children: ReactNode; tono?: "neutro" | "acento" | "positivo" | "negativo" | "aviso"; className?: string }) {
  const t = {
    neutro: "bg-superficie-2 text-texto-suave",
    acento: "bg-acento-suave text-acento",
    positivo: "bg-positivo/15 text-positivo",
    negativo: "bg-negativo/15 text-negativo",
    aviso: "bg-aviso/15 text-aviso",
  }[tono];
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", t, className)}>{children}</span>;
}

export function ConmutadorTema() {
  const { theme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return <div className="h-8 w-24" />;
  const opciones = [
    { v: "light", I: Sun, t: "Claro" },
    { v: "system", I: Monitor, t: "Sistema" },
    { v: "dark", I: Moon, t: "Oscuro" },
  ] as const;
  return (
    <div className="inline-flex rounded-md border border-borde bg-superficie p-0.5" role="group" aria-label="Tema">
      {opciones.map(({ v, I, t }) => (
        <button
          key={v}
          type="button"
          title={t}
          aria-label={t}
          aria-pressed={theme === v}
          onClick={() => setTheme(v)}
          className={cx("rounded p-1.5 transition-colors", theme === v ? "bg-acento-suave text-acento" : "text-texto-suave hover:text-texto")}
        >
          <I size={16} />
        </button>
      ))}
    </div>
  );
}

export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-borde p-6 text-center">
      <p className="text-sm font-medium">{titulo}</p>
      {detalle && <p className="mt-1 text-sm text-texto-suave">{detalle}</p>}
    </div>
  );
}
