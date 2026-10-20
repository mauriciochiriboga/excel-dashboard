import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada petición y protege las rutas privadas.
 * Rutas públicas: inicio (analizar sin cuenta), /p/<slug> (dashboards publicados) y /auth/*.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return respuesta;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error && process.env.NODE_ENV !== "production") console.warn("[proxy] getUser:", error.message, "cookies:", request.cookies.getAll().map((c) => c.name).join(","));

  const ruta = request.nextUrl.pathname;
  const privada = ruta.startsWith("/mis-dashboards") || ruta.startsWith("/equipos") || ruta.startsWith("/admin") || ruta.startsWith("/d/");
  if (privada && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/entrar";
    url.searchParams.set("siguiente", ruta);
    return NextResponse.redirect(url);
  }
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|muestra.xlsx|pruebas/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xlsx|csv)$).*)"],
};
