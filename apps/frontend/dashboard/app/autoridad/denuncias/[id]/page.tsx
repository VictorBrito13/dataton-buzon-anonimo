import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { DetalleDenuncia } from "@/components/autoridad/detalle-denuncia";

export const metadata: Metadata = { title: "Detalle de denuncia" };

export default async function PaginaDenuncia({ params }: PageProps<"/autoridad/denuncias/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <DetalleDenuncia id={id} />;
}
