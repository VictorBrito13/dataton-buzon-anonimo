"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { cerrarSesion } from "@/lib/autoridad/api";
import { ErrorClave } from "@/lib/autoridad/clave";
import { usePanel } from "./contexto";
import { ALERTA, BOTON_SECUNDARIO, ETIQUETA, SECCION } from "./estilos";

export function BarraSesion() {
  const router = useRouter();
  const { boveda, clave, terminarSesion } = usePanel();
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [errorSalida, setErrorSalida] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  const cargarClave = async (evento: ChangeEvent<HTMLInputElement>) => {
    const entrada = evento.target;
    const archivo = entrada.files?.[0];
    if (!archivo) return;
    setErrorClave(null);
    try {
      await boveda.cargar(archivo);
    } catch (causa) {
      setErrorClave(causa instanceof ErrorClave ? causa.message : "No pudimos leer el archivo.");
    } finally {
      // Permite volver a elegir el mismo archivo y no deja referencia al archivo en el formulario.
      entrada.value = "";
    }
  };

  const salir = async () => {
    // La clave se borra aunque falle la red: es lo primero que debe desaparecer.
    boveda.olvidar();
    setSaliendo(true);
    setErrorSalida(null);
    try {
      await cerrarSesion();
      terminarSesion();
      router.replace("/autoridad");
    } catch {
      setErrorSalida("La clave se borró, pero no pudimos cerrar la sesión. Inténtalo de nuevo.");
      setSaliendo(false);
    }
  };

  return (
    <section
      aria-label="Sesión y clave privada"
      className={`${SECCION} flex flex-wrap items-end justify-between gap-4`}
    >
      <div className="min-w-[min(16rem,100%)] flex-1">
        <p role="status" className="mb-2 text-sm">
          {clave ? (
            <>
              <strong className="text-exito">Clave privada cargada</strong> solo en la memoria de
              esta pestaña. Se borra al recargar o al cerrar sesión.
            </>
          ) : (
            <>
              <strong className="text-aviso">Sin clave privada:</strong> el contenido permanece
              sellado.
            </>
          )}
        </p>
        {clave ? (
          <button type="button" className={BOTON_SECUNDARIO} onClick={() => boveda.olvidar()}>
            Olvidar clave
          </button>
        ) : (
          <>
            <label htmlFor="archivo-clave" className={ETIQUETA}>
              Cargar clave privada (archivo JWK)
            </label>
            <input
              id="archivo-clave"
              type="file"
              accept=".jwk,.json,application/json"
              onChange={cargarClave}
              className="block min-h-11 w-full max-w-md text-sm text-tinta file:mr-3 file:min-h-11 file:rounded-sm file:border file:border-borde-fuerte file:bg-superficie file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-tinta"
            />
          </>
        )}
        {errorClave && (
          <p role="alert" className={`${ALERTA} mt-2`}>
            {errorClave}
          </p>
        )}
        {errorSalida && (
          <p role="alert" className={`${ALERTA} mt-2`}>
            {errorSalida}
          </p>
        )}
      </div>
      <button type="button" className={BOTON_SECUNDARIO} onClick={salir} disabled={saliendo}>
        {saliendo ? "Cerrando…" : "Cerrar sesión"}
      </button>
    </section>
  );
}
