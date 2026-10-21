import { Encabezado } from "@/components/carga/Encabezado";
import { PanelAdmin } from "@/components/admin/PanelAdmin";

export default function PaginaAdmin() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <PanelAdmin />
      </main>
    </>
  );
}
