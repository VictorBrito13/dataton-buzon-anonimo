import type { Metadata } from "next";
import { Seguimiento } from "@/components/seguimiento/seguimiento";

export const metadata: Metadata = { title: "Seguimiento de tu denuncia" };

export default function PaginaSeguimiento() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Seguimiento de tu denuncia</h1>
      <Seguimiento />
    </div>
  );
}
