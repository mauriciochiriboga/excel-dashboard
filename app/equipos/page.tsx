import { Encabezado } from "@/components/carga/Encabezado";
import { Equipos } from "@/components/equipos/Equipos";

export default function PaginaEquipos() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Equipos />
      </main>
    </>
  );
}
