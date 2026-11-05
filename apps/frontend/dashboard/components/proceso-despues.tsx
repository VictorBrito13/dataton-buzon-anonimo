import { procesoDespuesDeDenunciar } from "@/lib/seguimiento/linea-tiempo";

/** Qué pasa después de denunciar, a partir de ETAPAS. Sin estado: sirve en servidor y cliente. */
export function ProcesoDespues({ nivelTitulo: Titulo = "h2" }: { nivelTitulo?: "h2" | "h3" }) {
  const { ruta, cierresAnticipados } = procesoDespuesDeDenunciar();
  return (
    <section aria-labelledby="que-pasa-despues">
      <Titulo id="que-pasa-despues" className="text-2xl font-semibold">
        Qué pasa después de denunciar
      </Titulo>
      <p className="mt-2 max-w-2xl">
        Tu denuncia avanza por estas etapas. Cada vez que entres con tu folio o tu frase verás en
        cuál va. Los plazos son los esperados; la autoridad puede tardar más.
      </p>
      <ol className="mt-4 border-l-2 border-borde-fuerte">
        {ruta.map((etapa) => (
          <li key={etapa.etapa} className="relative pb-5 pl-5 last:pb-0">
            <span
              aria-hidden="true"
              className="absolute top-2 -left-[7px] size-3 rounded-full border-2 border-borde-fuerte bg-papel"
            />
            <p className="font-semibold">{etapa.etiqueta}</p>
            <p>{etapa.explicacion}</p>
            <p className="text-tinta-suave">Plazo esperado: {etapa.plazoEsperado}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 max-w-2xl font-semibold">También puede terminar antes:</p>
      <ul className="mt-1 max-w-2xl list-disc pl-5">
        {cierresAnticipados.map((etapa) => (
          <li key={etapa.etapa}>
            <strong>{etapa.etiqueta}.</strong> {etapa.explicacion}
          </li>
        ))}
      </ul>
    </section>
  );
}
