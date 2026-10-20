"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseCliente } from "@/lib/supabase/cliente";
import { FormularioAuth, CampoAuth, traducirError } from "@/components/auth/FormularioAuth";

function Entrar() {
  const router = useRouter();
  const params = useSearchParams();
  const siguiente = params.get("siguiente") || "/mis-dashboards";
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { error } = await supabaseCliente().auth.signInWithPassword({ email: correo, password: clave });
    setCargando(false);
    if (error) return setError(traducirError(error.message));
    router.push(siguiente);
    router.refresh();
  };

  return (
    <FormularioAuth titulo="Iniciar sesión" onSubmit={enviar} error={error} cargando={cargando} textoBoton="Entrar">
      <CampoAuth id="correo" label="Correo" type="email" value={correo} onChange={setCorreo} autoComplete="email" />
      <CampoAuth id="clave" label="Contraseña" type="password" value={clave} onChange={setClave} autoComplete="current-password" />
      <p className="text-sm text-texto-suave">
        <Link href="/auth/recuperar" className="text-acento hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="text-sm text-texto-suave">
        ¿No tienes cuenta?{" "}
        <Link href="/auth/registrar" className="text-acento hover:underline">
          Regístrate
        </Link>
      </p>
    </FormularioAuth>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <Entrar />
    </Suspense>
  );
}
