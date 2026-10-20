"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseCliente } from "@/lib/supabase/cliente";
import { FormularioAuth, CampoAuth, traducirError } from "@/components/auth/FormularioAuth";

export default function Registrar() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clave.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setCargando(true);
    setError(null);
    const { data, error } = await supabaseCliente().auth.signUp({
      email: correo,
      password: clave,
      options: { data: { nombre }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setCargando(false);
    if (error) return setError(traducirError(error.message));
    if (data.session) window.location.href = "/mis-dashboards";
    else setListo(true);
  };

  if (listo) {
    return (
      <FormularioAuth titulo="Revisa tu correo">
        <p className="text-sm">
          Te enviamos un enlace a <b>{correo}</b> para confirmar la cuenta. Después podrás{" "}
          <Link href="/auth/entrar" className="text-acento hover:underline">
            iniciar sesión
          </Link>
          .
        </p>
      </FormularioAuth>
    );
  }

  return (
    <FormularioAuth titulo="Crear cuenta" onSubmit={enviar} error={error} cargando={cargando} textoBoton="Registrarme">
      <CampoAuth id="nombre" label="Nombre" value={nombre} onChange={setNombre} autoComplete="name" />
      <CampoAuth id="correo" label="Correo" type="email" value={correo} onChange={setCorreo} autoComplete="email" />
      <CampoAuth id="clave" label="Contraseña (mínimo 8 caracteres)" type="password" value={clave} onChange={setClave} autoComplete="new-password" />
      <p className="text-sm text-texto-suave">
        ¿Ya tienes cuenta?{" "}
        <Link href="/auth/entrar" className="text-acento hover:underline">
          Inicia sesión
        </Link>
      </p>
    </FormularioAuth>
  );
}
