import { Aplicacion } from "@/components/Aplicacion";

export default async function DashboardPublico({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Aplicacion slugPublico={slug} />;
}
