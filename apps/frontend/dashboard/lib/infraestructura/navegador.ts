import type { AlmacenBorrador } from "@/lib/denuncia/borrador";
import { ejecutarSalidaRapida } from "@/lib/denuncia/salida-rapida";

/** Acceder a localStorage puede lanzar un error en modo privado o con datos bloqueados. */
export const almacenLocal = (): AlmacenBorrador => ({
  getItem: (clave) => localStorage.getItem(clave),
  setItem: (clave, valor) => localStorage.setItem(clave, valor),
  removeItem: (clave) => localStorage.removeItem(clave),
});

/** `replace` saca esta página del historial: el botón Atrás no regresa aquí. */
export const salirAhora = (): void =>
  ejecutarSalidaRapida({
    obtenerLocal: () => localStorage,
    obtenerSesion: () => sessionStorage,
    navegar: (url) => window.location.replace(url),
  });
