import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/carga/Encabezado";


export default async function MisDashboards() {
  const sb = await supabaseServidor();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/auth/entrar?siguiente=/mis-dashboards");
  const { data: perfil } = await sb.from("perfiles").select("nombre, correo, rol_global").eq("id", user.id).maybeSingle();

  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Mis dashboards</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Sesión iniciada como <b>{perfil?.nombre ?? perfil?.correo}</b>
          {perfil?.rol_global === "admin" && " · administrador"}.
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-borde p-6 text-center text-sm text-texto-suave">
          Todavía no has guardado ningún dashboard.{" "}
          <Link href="/" className="text-acento hover:underline">
            Analiza un archivo
          </Link>{" "}
          y pulsa «Guardar» (disponible en la fase 10).
        </div>
      </main>
    </>
  );
}
