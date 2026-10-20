import { Aplicacion } from "@/components/Aplicacion";

export default async function DashboardGuardado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Aplicacion dashboardId={id} />;
}
