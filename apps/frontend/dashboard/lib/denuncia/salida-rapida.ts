/** Destino común que no delata lo que se estaba haciendo. */
export const SITIO_NEUTRO = "https://www.google.com/";
const PREFIJO = "buzon:";
const VENTANA_ESCAPE_MS = 1500;
const PULSACIONES = 3;

export const limpiarRastro = (local: Storage, sesion: Storage): void => {
  for (const clave of Object.keys(local)) {
    if (clave.startsWith(PREFIJO)) local.removeItem(clave);
  }
  sesion.clear();
};

/** Recibe funciones porque acceder a `localStorage` puede lanzar un error en modo privado. */
export const ejecutarSalidaRapida = ({
  obtenerLocal,
  obtenerSesion,
  navegar,
}: {
  obtenerLocal: () => Storage;
  obtenerSesion: () => Storage;
  navegar: (url: string) => void;
}): void => {
  try {
    limpiarRastro(obtenerLocal(), obtenerSesion());
  } catch {
    // Salir siempre tiene prioridad sobre limpiar.
  } finally {
    navegar(SITIO_NEUTRO);
  }
};

export const crearDetectorEscape = (ventanaMs: number = VENTANA_ESCAPE_MS) => {
  let pulsaciones: number[] = [];
  return (ahora: number): boolean => {
    pulsaciones = [...pulsaciones.filter((t) => ahora - t <= ventanaMs), ahora];
    if (pulsaciones.length < PULSACIONES) return false;
    pulsaciones = [];
    return true;
  };
};
