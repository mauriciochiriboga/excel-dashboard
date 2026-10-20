"use client";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Boton } from "@/components/ui";

export function FormularioAuth({
  titulo,
  children,
  onSubmit,
  error,
  cargando,
  textoBoton,
}: {
  titulo: string;
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  error?: string | null;
  cargando?: boolean;
  textoBoton?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="flex items-center justify-center gap-2 font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-acento text-white dark:text-fondo">
          <BarChart3 size={18} />
        </span>
        Excel Dashboard
      </Link>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-borde bg-superficie p-6">
        <h1 className="text-lg font-semibold">{titulo}</h1>
        {children}
        {error && (
          <p role="alert" className="rounded-md bg-negativo/10 px-3 py-2 text-sm text-negativo">
            {error}
          </p>
        )}
        {onSubmit && (
          <Boton type="submit" variante="primario" disabled={cargando} className="justify-center">
            {cargando ? "Un momento…" : textoBoton}
          </Boton>
        )}
      </form>
    </main>
  );
}

export function CampoAuth({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="rounded-md border border-borde bg-fondo px-3 py-2 text-base"
      />
    </label>
  );
}

export function traducirError(m: string): string {
  const t = m.toLowerCase();
  if (t.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (t.includes("already registered") || t.includes("already been registered")) return "Ese correo ya tiene una cuenta. Inicia sesión.";
  if (t.includes("email not confirmed")) return "Confirma tu correo con el enlace que te enviamos antes de entrar.";
  if (t.includes("password") && t.includes("at least")) return "La contraseña debe tener al menos 8 caracteres.";
  if (t.includes("rate limit")) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  if (t.includes("invalid email")) return "El correo no es válido.";
  return m;
}
