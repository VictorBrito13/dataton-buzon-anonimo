"use client";

import { useEffect, useState } from "react";
import { abrirTexto, interpretarRelato, type AperturaDeTexto } from "@/lib/autoridad/sellos";
import { usePanel } from "./contexto";

type Intento = { clave: JsonWebKey; sello: string; apertura: AperturaDeTexto };

const CAJA = "rounded-sm border border-dashed border-borde-fuerte bg-papel px-3 py-2 text-sm";

/** El texto viene de quien denuncia: solo se presenta como texto, nunca como HTML. */
function TextoAbierto({ texto }: { texto: string }) {
  const relato = interpretarRelato(texto);
  if (relato.tipo === "texto") {
    return <p className="text-sm break-words whitespace-pre-wrap">{relato.texto}</p>;
  }
  return (
    <dl className="space-y-2 text-sm">
      {relato.campos.map(({ nombre, valor }) => (
        <div key={nombre}>
          <dt className="font-semibold">{nombre}</dt>
          <dd className="break-words whitespace-pre-wrap">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ContenidoSellado({ sello }: { sello: string }) {
  const { clave } = usePanel();
  const [intento, setIntento] = useState<Intento | null>(null);

  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    void abrirTexto(clave, sello).then((apertura) => {
      if (vigente) setIntento({ clave, sello, apertura });
    });
    return () => {
      vigente = false;
    };
  }, [clave, sello]);

  if (!clave) {
    return (
      <p className={CAJA}>
        <strong>Contenido sellado.</strong> Carga la clave privada para abrirlo en este navegador.
      </p>
    );
  }
  // Un intento con otra clave ya no vale: al olvidar o cambiar la clave no queda texto a la vista.
  if (!intento || intento.clave !== clave || intento.sello !== sello) {
    return <p className={CAJA}>Abriendo en este navegador…</p>;
  }
  if (intento.apertura.estado !== "abierto") {
    return (
      <p className="rounded-sm border border-peligro bg-peligro-suave px-3 py-2 text-sm text-peligro">
        <strong>No se pudo abrir.</strong> La clave cargada no corresponde a este sello o el
        contenido está dañado.
      </p>
    );
  }
  return <TextoAbierto texto={intento.apertura.texto} />;
}
