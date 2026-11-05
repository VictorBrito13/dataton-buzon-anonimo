"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProcesoDespues } from "@/components/proceso-despues";
import { Aviso, BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/components/ui";

export function PantallaFinal({ folio }: { folio: string }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => titulo.current?.focus(), []);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(folio);
      setAviso("Folio copiado.");
    } catch {
      setAviso("No pudimos copiarlo. Anótalo a mano.");
    }
  };

  return (
    <div className="mt-6 space-y-8">
      <div>
        <h2 ref={titulo} tabIndex={-1} className="text-2xl font-semibold">
          Tu denuncia se envió
        </h2>
        <p className="mt-2">Guarda este folio. Solo se muestra esta vez.</p>
      </div>

      <section
        aria-label="Tu folio"
        className="area-impresion border-2 border-marca bg-superficie p-5"
      >
        <p className="font-semibold">Tu folio</p>
        <p className="mt-2 font-mono text-xl font-semibold break-all sm:text-2xl">{folio}</p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className={BOTON_SECUNDARIO} onClick={copiar}>
          Copiar folio
        </button>
        <button type="button" className={BOTON_SECUNDARIO} onClick={() => window.print()}>
          Imprimir folio
        </button>
      </div>
      <p role="status" className="font-medium">
        {aviso}
      </p>

      <Aviso tono="peligro" titulo="Si pierdes tu folio y tu frase, no hay forma de recuperarlos">
        <p>
          No guardamos tu nombre ni ningún dato para reconocerte, así que nadie podrá devolverte el
          acceso. Tu denuncia seguirá su curso, pero ya no podrás verla ni responder.
        </p>
      </Aviso>
      <Aviso titulo="En un equipo compartido o del trabajo">
        <p>
          No tomes captura de pantalla ni dejes este folio a la vista. Anótalo en papel y cierra
          esta ventana al terminar.
        </p>
      </Aviso>

      <Link prefetch={false} href="/seguimiento" className={`${BOTON_PRIMARIO} w-full sm:w-auto`}>
        Ir a seguimiento
      </Link>

      <ProcesoDespues nivelTitulo="h3" />
    </div>
  );
}
