"use client";

import { ESTADOS, TIPOS_FALTA } from "@dataton/shared";
import type { EstadoAsistente } from "@/lib/denuncia/asistente";
import { municipiosDeEstado, nombreEnte } from "@/lib/denuncia/catalogos-locales";
import { describirCuando } from "@/lib/denuncia/relato";
import { personasConDatos } from "@/lib/denuncia/validaciones";
import { useEntes, useMunicipios } from "./catalogos";

const buscar = <T extends string>(mapa: Record<T, unknown>, clave: string) =>
  mapa[clave as T] as unknown;

function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-borde py-2">
      <dt className="font-semibold">{titulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Lo que se enviará, sin el relato: ese se muestra aparte, con sus hallazgos. */
export function ResumenDenuncia({ estado }: { estado: EstadoAsistente }) {
  const { hechos } = estado;
  const { datos: municipios } = useMunicipios();
  const { datos: entes } = useEntes(Boolean(hechos.enteId));
  const municipio =
    municipios &&
    municipiosDeEstado(municipios, hechos.estado).find((m) => m.clave === hechos.municipio)?.nombre;
  const tipo = buscar(TIPOS_FALTA, hechos.tipoFalta) as { etiqueta: string } | undefined;
  const personas = personasConDatos(estado.personas);

  return (
    <dl>
      <Fila titulo="Estado">{buscar(ESTADOS, hechos.estado) as string}</Fila>
      <Fila titulo="Municipio">{municipio ?? "Sin indicar"}</Fila>
      <Fila titulo="Tipo de falta">{tipo?.etiqueta}</Fila>
      <Fila titulo="Institución">
        {hechos.enteId ? (entes && nombreEnte(entes, hechos.enteId)) || "Elegida" : "Sin indicar"}
      </Fila>
      <Fila titulo="Cuándo pasó, aproximadamente (sellado)">
        {hechos.cuando ? describirCuando(hechos.cuando) : "Sin indicar"}
      </Fila>
      <Fila titulo="Personas o entes (sellado)">
        {personas.length === 0 ? (
          "Ninguno"
        ) : (
          <ul className="list-disc pl-5">
            {personas.map((p, i) => (
              <li key={i}>{[p.nombre, p.cargo].filter(Boolean).join(", ")}</li>
            ))}
          </ul>
        )}
      </Fila>
      <Fila titulo="Archivos limpios">
        {estado.evidencias.length === 0 ? (
          "Ninguno"
        ) : (
          <ul className="list-disc pl-5">
            {estado.evidencias.map((e) => (
              <li key={e.evidenciaId} className="break-words">
                {e.nombre}
              </li>
            ))}
          </ul>
        )}
      </Fila>
    </dl>
  );
}
