import { Encabezado } from "@/components/carga/Encabezado";
import { ListaDashboards } from "@/components/dashboards/ListaDashboards";

export default function MisDashboards() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <ListaDashboards />
      </main>
    </>
  );
}
