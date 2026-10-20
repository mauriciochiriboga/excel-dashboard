"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseCliente } from "@/lib/supabase/cliente";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { FormularioAuth, CampoAuth, traducirError } from "@/components/auth/FormularioAuth";

/** Dos modos: pedir enlace de recuperación, o fijar nueva contraseña cuando se llega desde el enlace. */
export default function Recuperar() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [modo, setModo] = useState<"pedir" | "nueva">("pedir");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const { data } = supabaseCliente().auth.onAuthStateChange((evento: AuthChangeEvent) => {
      if (evento === "PASSWORD_RECOVERY") setModo("nueva");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const pedir = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { error } = await supabaseCliente().auth.resetPasswordForEmail(correo, { redirectTo: `${window.location.origin}/auth/recuperar` });
    setCargando(false);
    if (error) return setError(traducirError(error.message));
    setMensaje("Si el correo existe, recibirás un enlace para restablecer la contraseña.");
  };

  const cambiar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clave.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setCargando(true);
    setError(null);
    const { error } = await supabaseCliente().auth.updateUser({ password: clave });
    setCargando(false);
    if (error) return setError(traducirError(error.message));
    router.push("/mis-dashboards");
  };

  if (modo === "nueva") {
    return (
      <FormularioAuth titulo="Nueva contraseña" onSubmit={cambiar} error={error} cargando={cargando} textoBoton="Guardar contraseña">
        <CampoAuth id="clave" label="Nueva contraseña" type="password" value={clave} onChange={setClave} autoComplete="new-password" />
      </FormularioAuth>
    );
  }
  return (
    <FormularioAuth titulo="Recuperar contraseña" onSubmit={pedir} error={error} cargando={cargando} textoBoton="Enviar enlace">
      <CampoAuth id="correo" label="Correo" type="email" value={correo} onChange={setCorreo} autoComplete="email" />
      {mensaje && <p className="text-sm text-positivo">{mensaje}</p>}
    </FormularioAuth>
  );
}
