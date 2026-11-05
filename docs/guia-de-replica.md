# Guía de réplica

## Búsqueda opcional de nombres, cargos y lugares

En el paso de revisión de `/denunciar`, la opción "Buscar también nombres, cargos y lugares" usa un modelo que corre en el navegador. El sitio lo sirve desde `public/modelos`, que no se versiona. Sin esos archivos todo funciona con las reglas, y la opción aparece desactivada con un aviso. No hace falta configurar nada más.

### Activarlo

Desde la raíz del repositorio, después de `npm ci`:

```bash
node apps/frontend/dashboard/scripts/descargar-modelo.mjs
```

Descarga el modelo de Hugging Face, con revisión y SHA-256 fijos, y copia el WASM de `node_modules`. En total, unos 165 MB. Luego **reinicia el servidor**: `next start` y el servidor standalone leen `public/` al arrancar.

| Forma de ejecutar | Qué hacer                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `next start`      | Descargarlo y reiniciar. No hay que volver a construir                                                                   |
| Standalone        | Copiar también `public/` junto a `server.js`, como con cualquier archivo público                                         |
| Docker            | La imagen debe correr el script y copiar `public/` a la etapa final. Si omite el modelo, la opción lo dice y sigue todo |

### Comprobarlo

1. Abre `/denunciar` y llega a la revisión. La casilla debe estar activa y sin aviso de "no está disponible".
2. Actívala con un relato que tenga un nombre inventado. Debe avanzar hasta "Búsqueda terminada" y marcar el nombre como sugerencia.
3. En las herramientas de red no debe aparecer ningún otro dominio, y sin activarla no debe aparecer ninguna petición a `/modelos/`.

Las pruebas E2E lo cubren en `apps/frontend/dashboard/e2e/busqueda-modelo.spec.ts`. Eligen sus casos según exista o no el modelo.

### Límites

- Su precisión con denuncias y nombres mexicanos no se ha medido. Ver [`lib/privacidad/README.md`](../apps/frontend/dashboard/lib/privacidad/README.md#capa-2-modelo).
- Queda en la caché del navegador de quien lo activa, y la salida rápida no lo borra. La opción lo avisa antes de activarla.
- La comprobación mira si los archivos existen en el servidor de Next. Si `public/` se sirve desde otro lado, la opción puede aparecer disponible y fallar al cargar: en ese caso avisa y sigue con las reglas.
