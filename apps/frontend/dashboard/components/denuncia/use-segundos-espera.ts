"use client";

import { useEffect, useState } from "react";

/** Segundos desde que empezó la espera; vuelve a cero cuando termina. */
export const useSegundosEspera = (esperando: boolean): number => {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (!esperando) return;
    const inicio = Date.now();
    const reloj = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => {
      clearInterval(reloj);
      setSegundos(0);
    };
  }, [esperando]);
  return segundos;
};
