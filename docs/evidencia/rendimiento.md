# Evidencia de rendimiento

Mediciones del 5 de noviembre de 2026 para celulares baratos y mala señal. **Son mediciones simuladas en una computadora, no en un celular físico.** Sirven para comparar antes y después; no predicen el tiempo exacto en un teléfono real.

## Cómo se midió

- **Despliegue real:** `docker compose` completo, con Caddy, Next en producción, API y Postgres reales, no simulados. Base con 30,000 denuncias sintéticas (`sintetico`).
- **Equipo:** Apple M5 Pro, Chromium de Playwright, emulación de Moto G Power (`devices["Moto G Power"]`). Índice de referencia de Lighthouse: de 4,417 a 4,573.
- **Repeticiones:** mediana de 3 cargas sin caché por celda; 5 envíos reales por modo para el folio; 3 corridas de Lighthouse por ruta.
- **INP:** mayor duración de Event Timing con clics y teclado reales (selector de tema en todas las rutas; validación y escritura en `/denunciar`; pestaña y escritura en `/seguimiento`).
- **Scripts:** están en [`scripts/rendimiento/`](../../scripts/rendimiento/). Antes y después usan la misma medición. Lighthouse se instaló fuera del repositorio.

### Tres advertencias sobre las herramientas

1. **"Slow 4G" y "Fast 3G" son el mismo perfil.** DevTools y Lighthouse los unificaron (1.44 Mbps de bajada, 675 Kbps de subida, 562.5 ms; `crbug.com/342406608`, visible en `PredefinedNetworkConditions` de puppeteer). Medirlos por separado daría la misma cifra dos veces. Por eso se midió ese perfil una vez, y se agregó **Slow 3G** (400 Kbps, 2 s de latencia), que sí representa mala señal.
2. **La reducción de CPU de CDP no alcanza a los Workers ni a WebCrypto.** `Emulation.setCPUThrottlingRate` solo frena el hilo principal; en un Worker responde `Operation is only supported for pages, not workers`. Con solo CDP, Argon2id y la prueba de trabajo tardan lo mismo en 1× que en 6×. Por eso el folio tiene un segundo modo, **"SO"**, que alterna `SIGSTOP` y `SIGCONT` sobre los renderers de ese navegador, por PID, y sí frena todos sus hilos.
3. **El modo SO frena más de lo que dice su nombre.** Se calibró con un bucle y con PBKDF2 dentro de un Worker:

| Modo             | Hilo principal | Bucle en Worker | PBKDF2 en Worker |
| ---------------- | -------------- | --------------- | ---------------- |
| CDP 6×           | 6.0×           | **1.0×**        | **1.0×**         |
| SO "4×", real    | 5.5×           | 5.6×            | 5.8×             |
| SO "6×", real    | 9.9×           | 9.7×            | 11.2×            |

La cifra honesta para Argon2id y prueba de trabajo es la de SO. Frenar el tiempo de CPU no simula la memoria lenta de un teléfono, que importa en Argon2id, un algoritmo que depende de la memoria.

## Antes y después

### Carga de rutas

LCP en ms, peso total transferido en KB, CPU con CDP. INP: entre 24 y 56 ms en todas las celdas, antes y después. CLS: menos de 0.002 en todas. Errores de CSP: 0 en todas.

| Ruta                  | Red     | CPU | LCP antes | LCP después | Peso antes | Peso después |
| --------------------- | ------- | --- | --------- | ----------- | ---------- | ------------ |
| `/`                   | Slow 4G | 4×  | 1288      | 1320        | 155        | 147          |
| `/`                   | Slow 4G | 6×  | 1304      | 1348        | 155        | 147          |
| `/`                   | Slow 3G | 6×  | 4428      | 4504        | 155        | 147          |
| `/denunciar`          | Slow 4G | 4×  | 3764      | **2880**    | 252        | **200**      |
| `/denunciar`          | Slow 4G | 6×  | 3868      | **2940**    | 252        | **200**      |
| `/denunciar`          | Slow 3G | 4×  | 12984     | **9928**    | 252        | **200**      |
| `/denunciar`          | Slow 3G | 6×  | 13060     | **9984**    | 252        | **200**      |
| `/seguimiento`        | Slow 4G | 4×  | 1292      | 1292        | 209        | **151**      |
| `/seguimiento`        | Slow 4G | 6×  | 1316      | 1288        | 209        | **151**      |
| `/seguimiento`        | Slow 3G | 6×  | 4392      | 4444        | 209        | **151**      |
| `/tablero`            | Slow 4G | 4×  | 1292      | 1292        | 173        | 160          |
| `/tablero`            | Slow 4G | 6×  | 1332      | 1316        | 173        | 160          |
| `/tablero`            | Slow 3G | 6×  | 4324      | 4340        | 173        | 160          |
| `/como-te-protegemos` | Slow 4G | 4×  | 1280      | 1296        | 154        | 146          |
| `/como-te-protegemos` | Slow 4G | 6×  | 1312      | 1324        | 154        | 146          |
| `/como-te-protegemos` | Slow 3G | 6×  | 4408      | 4492        | 154        | 146          |

El LCP de `/denunciar` es además el momento en que el formulario se puede usar. Las diferencias de menos de 100 ms en las demás rutas son ruido: su LCP depende del HTML y del CSS, que casi no cambiaron.

**Peso por tipo, en bytes, con Slow 4G y CPU 6×:**

| Ruta                  | JS antes | JS después | HTML antes | HTML después | CSS antes | CSS después | JSON (antes y después) |
| --------------------- | -------- | ---------- | ---------- | ------------ | --------- | ----------- | ---------------------- |
| `/`                   | 140,654  | 134,893    | 11,819     | 9,074        | 6,460     | 6,443       | 0                      |
| `/denunciar`          | 225,310  | 172,434    | 6,207      | 5,308        | 6,460     | 6,443       | 20,529 y 20,381        |
| `/seguimiento`        | 201,072  | 142,883    | 6,560      | 5,557        | 6,460     | 6,443       | 0                      |
| `/tablero`            | 140,586  | 134,842    | 29,567     | 21,846       | 6,975     | 6,930       | 0                      |
| `/como-te-protegemos` | 140,562  | 134,893    | 11,015     | 8,135        | 6,551     | 6,443       | 0                      |

**Segunda visita, con caché, Slow 4G y CPU 6×:** `/` baja de 155 KB a unos 9 KB (LCP 644 ms); `/denunciar`, a 25 KB (LCP 764 ms). Ya pasaba antes de este trabajo; los catálogos ahora ni siquiera revalidan durante un día.

### Lighthouse móvil

Parámetros por omisión: Slow 4G simulada, CPU 4×, método `simulate`.

| Ruta                  | Puntaje      | LCP (ms)      | TBT (ms)  | CLS | Peso (KB)  |
| --------------------- | ------------ | ------------- | --------- | --- | ---------- |
| `/`                   | 100 → 100    | 903 → 904     | 15 → 11   | 0   | 157 → 148  |
| `/denunciar`          | 99 → 100     | 2181 → 1804   | 35 → 20   | 0   | 254 → 201  |
| `/seguimiento`        | 100 → 100    | 780 → 781     | 7 → 4     | 0   | 211 → 153  |
| `/tablero`            | 100 → 100    | 949 → 944     | 10 → 11   | 0   | 174 → 161  |
| `/como-te-protegemos` | 100 → 100    | 903 → 781     | 8 → 10    | 0   | 156 → 147  |

Estos puntajes no significan que la aplicación vuele en un celular: el TBT simulado parte de un M5 Pro.

### De "Enviar mi denuncia" al folio

API real, Slow 4G. Mediana de 5 envíos reales, en ms. El contador de la prueba de trabajo es aleatorio (de 1 a 2000), así que varía por corrida. **No se cambió ningún parámetro de seguridad:** Argon2id sigue con 19 MiB y t=2, y la prueba de trabajo con costo 1000 y contador máximo 2000.

| Modo                  | Total antes | Total después | Argon2id antes | Argon2id después | Prueba de trabajo antes | Prueba de trabajo después |
| --------------------- | ----------- | ------------- | -------------- | ---------------- | ----------------------- | ------------------------- |
| Sin freno de CPU      | 4876        | 1355          | 3238           | 26               | 679                     | 697                       |
| CDP 4× (Worker libre) | 4896        | 1373          | 3225           | 22               | 670                     | 619                       |
| CDP 6× (Worker libre) | 4914        | 1388          | 3234           | 22               | 673                     | 616                       |
| SO "4×" (real 5.6×)   | 5266        | 2082          | 3497           | 177              | 856                     | 1052                      |
| SO "6×" (real 9.7×)   | 5435        | **3307**      | 3493           | 305              | 1040                    | 1898                      |

**Cómo leer esta tabla:**

- **Argon2id nunca fue el problema; lo era la descarga.** Los 3.2 s de "antes" eran, casi por completo, el código del Worker: seis peticiones, con 562 ms de latencia cada una. Argon2id en sí tarda de 125 a 367 ms con SO "6×".
- **La descarga se adelantó, no desapareció.** El Worker ahora arranca en el paso de la frase, que siempre toma más que esos 3 s porque hay que guardar seis palabras. La medición le da 15 s a ese paso. Si la descarga no alcanzara a terminar, el total volvería a ser de unos 6 s (5.8 y 6.4 s en una prueba de dos envíos, con el Worker arrancando al mostrar el botón).
- **La prueba de trabajo de "después" no empeoró.** Depende del contador, que es aleatorio: las dos series de 5 no son comparables entre sí. Con SO "6×" se midió cerca de 1 ms por contador más los 560 ms de pedir el reto. Con el mayor contador observado (1948) tardó 2.3 s; el reto expira a los 120 s.

**Sigue respondiendo y no bloquea (después, con SO "6×"):**

| Comprobación                          | Resultado                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Worker                                | Sí, un Worker dedicado (`turbopack-worker-*.js`) en todas las corridas     |
| Mayor silencio del hilo principal     | 62 ms, casi todo por el freno, que detiene el proceso 50 ms; 25 ms con CDP |
| Tarea larga más larga                 | 58 ms                                                                      |
| Clic durante el trabajo (Event Timing) | 64 ms como máximo                                                          |
| Errores de CSP                        | 0                                                                          |

**Progreso anunciado:** ya había una `role="status"` con cada etapa. Ahora también hay una barra (`<progress>`, paso N de 4). A los 15 s y a los 45 s se agrega un aviso para no cerrar la página, sin cambiar cada segundo, para que el lector de pantalla no lo repita sin parar. `/seguimiento` usa los mismos avisos.

## Catálogos

| Archivo           | Sin comprimir | Antes (gzip) | Después (zstd) | Cuándo se baja, antes         | Cuándo se baja, después        |
| ----------------- | ------------- | ------------ | -------------- | ----------------------------- | ------------------------------ |
| `entes.json`      | 619,705 B     | 106,755 B    | 94,479 B       | Al enfocar el buscador        | Con la primera letra escrita   |
| `municipios.json` | 61,933 B      | 20,290 B     | 20,154 B       | Al abrir `/denunciar`         | Igual                          |
| `fuente.json`     | 742 B         | No se pide   | No se pide     | Nunca, en estas mediciones    | Nunca, en estas mediciones     |

- **Búsqueda sin fugas:** la medición buscó "secretaria" y el texto no apareció en URL ni en cuerpo de ninguna petición. El archivo es el mismo para todas las personas.
- **Indexar 10,144 entes con CPU 6×:** de 45 a 78 ms entre `JSON.parse`, normalizar y ordenar; la tarea larga más larga de la búsqueda fue de 50 ms. No hizo falta llevarlo a un Worker.

**Decisión sobre municipios: un único archivo, cargado siempre.** Un archivo por estado revelaría a la red qué estado eligió la persona antes de enviar nada, aunque sea una petición a un archivo público, y por eso no se hizo. Pedir el archivo único recién al elegir un estado tampoco: delataría esa acción, a cambio de 20 KB que casi toda denuncia necesita de todos modos.

## Tablero con 30,000 denuncias

Respuesta por Caddy, en una conexión HTTP/2 ya abierta. Después de los cambios, 30 muestras; no se tocó la API.

| Petición                                   | p50 (ms) | p95 (ms) | Sin comprimir | zstd     |
| ------------------------------------------ | -------- | -------- | ------------- | -------- |
| `/periodos`                                | 2        | 3        | 193 B         | 193 B    |
| `/agregados?dimensiones=estado`            | 1        | 3        | 2,021 B       | 310 B    |
| `/agregados?dimensiones=tipoFalta`         | 1        | 3        | 1,081 B       | 323 B    |
| `/agregados?dimensiones=etapa`             | 1        | 1        | 746 B         | 256 B    |
| `/agregados?dimensiones=tipoFalta,etapa`   | 1        | 1        | 12,140 B      | 987 B    |
| `/agregados?dimensiones=municipio`         | 5        | 6        | 164,544 B     | 5,173 B  |
| `/indicadores`                             | 1        | 1        | 2,453 B       | 557 B    |
| `/metodologia`                             | 1        | 1        | 3,341 B       | 1,554 B  |
| `/pdn`                                     | 1        | 1        | 3,509 B       | 1,322 B  |
| `/tablero` (HTML, render completo)         | 20       | 26       | 200,212 B     | 20,988 B |

La API lee agregados ya publicados, así que no hay nada que optimizar ahí con este volumen. El navegador no la llama para pintar el tablero: la llama el servidor.

## Compresión y caché

- **Ya había compresión.** Next comprimía con gzip y Caddy dejaba pasar ese resultado, por lo que su zstd casi nunca se usaba en páginas ni en estáticos. Ahora `compress: false` en Next y `encode { zstd best; gzip 6 }` en Caddy.
- **Por qué `best`:** con el nivel por omisión, zstd queda más grande que gzip, y con `better` el JavaScript total subió de 137 a 139 KB en `/`. Con `best`: HTML de `/tablero` de 28.7 a 21.0 KB; `entes.json` de 106.8 a 94.5 KB; React de 72.0 a 69.0 KB.
- **Costo:** unos 11 ms de servidor por el archivo de React, medidos en este equipo. Caddy no guarda el resultado, así que se paga en cada petición sin caché.
- **Navegadores sin zstd:** reciben gzip de Caddy, cerca de 3% más grande que el de Next en el archivo de React (74.2 contra 72.0 KB).
- **Brotli no está disponible.** La imagen estándar de Caddy no lo trae. Precomprimido con calidad 11 ahorraría cerca de 20% en estáticos, pero exigiría compartir `.next/static` con Caddy. No se hizo.

| Recurso                     | `Cache-Control`                       | Cambio                                                                     |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| HTML de las 5 rutas         | `no-store`                            | Ninguno; lo prueba `e2e/anonimato/despliegue.spec.ts`                      |
| `/api/v1/configuracion`     | `no-store`                            | Ninguno; lo prueba el mismo archivo                                        |
| `/_next/static/*`           | `public, max-age=31536000, immutable` | Ninguno: ya venía de Next; ahora tiene prueba                              |
| `/catalogos/*` y `/iconos/*` | `public, max-age=86400`               | Antes `public, max-age=0`. Son públicos e iguales para todas las personas  |
| `/api/v1/publico/*`         | `public, max-age=300`                 | Ninguno; son agregados públicos                                            |

## JavaScript por ruta

La CI corre `npm run verificar:presupuesto` después del build. Suma bytes en gzip de los archivos de carga inicial de cada ruta, sin mediciones de tiempo, y falla si una ruta rebasa su límite o si `pdf-lib`, `jszip`, Transformers.js o `qrcode` entran en la carga inicial.

| Ruta                  | Antes (KB gzip) | Después (KB gzip) | Límite (KB) |
| --------------------- | --------------- | ----------------- | ----------- |
| `/`                   | 136.8           | 136.5             | 150         |
| `/denunciar`          | 138.7 + diferido | 173.3             | 190         |
| `/seguimiento`        | 195.6           | 144.2             | 160         |
| `/tablero`            | 136.8           | 136.5             | 150         |
| `/como-te-protegemos` | 136.8           | 136.5             | 150         |
| `/autoridad`          | 195.6           | 176.0             | 195         |

`/denunciar` sube en esta tabla porque el formulario ya no es una carga diferida: viaja con los scripts de la ruta y evita un viaje de red más. Lo que de verdad baja es el total de la tabla de carga de rutas.

**Cómo se consiguió:**

- `@dataton/shared` declara `sideEffects: false` y separa `normalizar`, `frase` y `acceso`. Zod, la lista de palabras y Argon2 ya no viajan juntos.
- Zod y el sellado se importan al usarse. El adaptador HTTP baja los esquemas **antes** de cada petición: si los bajara después de crear la denuncia y la señal se cayera, se perdería el folio.
- Ya eran diferidos, y sigue comprobándolo la barrera: QR, `pdf-lib`, `jszip` y Transformers.js. Argon2 y `altcha-lib` viven solo en el Worker.

## Qué no mejoró

- **LCP de `/`, `/seguimiento`, `/tablero` y `/como-te-protegemos`:** ya dependía casi solo de la latencia, el HTML y el CSS.
- **Base de 136.5 KB de gzip en todas las rutas:** es React y Next, salvo 8 KB propios del encabezado. Sobre Slow 3G sigue pesando: 4.4 s de LCP en cualquier ruta y casi 10 s para usar el formulario.
- **INP:** ya era bajo (de 24 a 56 ms), y sigue igual dentro del ruido.
- **Primer resultado al buscar institución:** empeoró. Con CPU 6× pasó de 872 a 1690 ms, incluidos los 800 ms de teclear, porque ahora la descarga ocurre al buscar y no al enfocar. Es el costo de no gastar 94 KB en quien solo pasa por el campo.

## Qué no se verificó

- **Un celular físico.** Ninguna cifra salió de uno. Falta probar sobre todo la memoria en Argon2id (19 MiB) en un teléfono con poca RAM, donde el navegador podría además cerrar la pestaña.
- **Red real.** Se emuló latencia y ancho de banda; no pérdida de paquetes ni cortes.
- **Tiempo de `/seguimiento` al entrar con frase.** Ahora baja código diferido al primer foco, y no se cronometró. Pasa las pruebas E2E.
- **Navegadores distintos de Chromium**, por ejemplo Safari y su uso de gzip en vez de zstd.
- **Carga concurrente sobre Caddy.** El costo de `zstd best` se midió con una sola persona.
- **El modelo NER.** Se midió sin los 165 MB de modelo publicados. Su Worker no se carga si la persona no lo pide.

## Cómo repetirlo

```bash
POSTGRES_PORT=5566 PUERTO_HTTP=3980 PUERTO_HTTPS=3943 DESCARGAR_MODELO_NER=0 \
  docker compose --profile dev -p dataton-rend up -d --build --wait
docker compose --profile demo -p dataton-rend run --rm sintetico

node scripts/rendimiento/cabeceras.mjs https://localhost:3943
node scripts/rendimiento/medir-api.mjs https://localhost:3943
node scripts/rendimiento/medir-rutas.mjs --base https://localhost:3943
node scripts/rendimiento/medir-entes.mjs --base https://localhost:3943
node scripts/rendimiento/medir-folio.mjs --base https://localhost:3943
node scripts/rendimiento/medir-lighthouse.mjs --base https://localhost:3943 --lighthouse <carpeta con lighthouse>
```
