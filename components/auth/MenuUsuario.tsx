"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, LayoutGrid, Users, Shield, UserCircle2, ChevronDown } from "lucide-react";
import { useUsuario } from "@/lib/supabase/useUsuario";
import { supabaseCliente, supabaseConfigurado } from "@/lib/supabase/cliente";
import { Boton, cx } from "@/components/ui";

export function MenuUsuario() {
  const { usuario, perfil, cargando, esAdmin } = useUsuario();
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  if (!supabaseConfigurado) return null;
  if (cargando) return <div className="h-8 w-20" />;

  if (!usuario) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/auth/entrar" className="rounded-md px-2.5 py-1.5 text-sm hover:bg-superficie-2">
          Entrar
        </Link>
        <Link href="/auth/registrar" className="rounded-md bg-acento px-2.5 py-1.5 text-sm font-medium text-white dark:text-fondo">
          Crear cuenta
        </Link>
      </div>
    );
  }

  const salir = async () => {
    await supabaseCliente().auth.signOut();
    setAbierto(false);
    router.push("/");
    router.refresh();
  };

  const nombre = perfil?.nombre || usuario.email?.split("@")[0] || "Cuenta";
  return (
    <div className="relative">
      <Boton variante="fantasma" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-haspopup="menu">
        <UserCircle2 size={18} />
        <span className="max-w-[120px] truncate">{nombre}</span>
        <ChevronDown size={14} />
      </Boton>
      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div role="menu" className="absolute right-0 z-40 mt-1 w-56 rounded-md border border-borde bg-superficie p-1 text-sm shadow-lg">
            <p className="truncate px-2 py-1.5 text-xs text-texto-suave">{usuario.email}</p>
            <Item href="/mis-dashboards" onClick={() => setAbierto(false)}>
              <LayoutGrid size={16} /> Mis dashboards
            </Item>
            <Item href="/equipos" onClick={() => setAbierto(false)}>
              <Users size={16} /> Equipos
            </Item>
            {esAdmin && (
              <Item href="/admin" onClick={() => setAbierto(false)}>
                <Shield size={16} /> Administración
              </Item>
            )}
            <button role="menuitem" onClick={salir} className={cx("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-superficie-2")}>
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Item({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link role="menuitem" href={href} onClick={onClick} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-superficie-2">
      {children}
    </Link>
  );
}
