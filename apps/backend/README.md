# Backend del buzón anónimo

Express + TypeScript + Postgres, sin ORM. Las decisiones que lo explican están en
[`docs/decisiones-arquitectura.md`](../../docs/decisiones-arquitectura.md).

## Arrancar

```bash
cp apps/backend/.env.example apps/backend/.env
docker compose up -d --wait
npm run migrate
npm run semilla:autoridad -w @dataton/backend   # usuario demo del panel
npm run dev:backend
```

## Estructura (D10)

```text
src/
  compartido/{dominio,aplicacion,infraestructura}   Reloj, PoW, HMAC, cifrado, registro de errores
  contextos/
    denuncias/   Recepción y acceso: folio, credenciales, seguimiento, adaptador S5
    evidencias/  Verificar, limpiar y sellar archivos
    tramite/     Etapas, mensajes, sesión y bitácora de la autoridad
  composicion.ts   Único lugar que une configuración, casos de uso y adaptadores
```

`infraestructura` → `aplicacion` → `dominio`. `test/arquitectura.test.ts` falla si el dominio o la
aplicación importan Express, `pg`, `env` o infraestructura.

## Rutas (`/api/v1`)

El contrato es `packages/shared/src/api.ts`. Lo que el contrato deja abierto se indica aquí.

| Método y ruta                                  | Descripción                                              | Respuesta                                 |
| ---------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- |
| `GET /configuracion`                           | Clave pública y límites de evidencias                    | `respuestaConfiguracion`                  |
| `GET /pow/reto`                                | Reto Altcha v2 (PBKDF2/SHA-256), firmado, con expiración | Reto del widget `altcha` 3                |
| `POST /denuncias`                              | Crea la denuncia y devuelve el folio una sola vez        | 201 `{ folio }`                           |
| `POST /evidencias?pow=…`                       | Binario en el cuerpo; se limpia y se sella               | 201 `respuestaEvidencia`                  |
| `POST /acceso/consulta`                        | Seguimiento con folio o frase                            | 200 `respuestaConsulta`                   |
| `POST /acceso/mensajes`                        | Mensaje sellado del denunciante                          | 201 `{ ok: true }`                        |
| `POST /autoridad/sesion`                       | Inicia sesión; cookie `sesion_autoridad`                 | 200 `{ usuario }`                         |
| `GET /autoridad/sesion`                        | Sesión actual                                            | 200 `{ usuario }`                         |
| `DELETE /autoridad/sesion`                     | Cierra la sesión                                         | 204                                       |
| `GET /autoridad/denuncias`                     | Hasta 500 resúmenes, por día e id                        | 200 arreglo de `resumenDenunciaAutoridad` |
| `GET /autoridad/denuncias/:id`                 | Detalle con relato y mensajes sellados                   | 200 `detalleDenunciaAutoridad`            |
| `POST /autoridad/denuncias/:id/etapa`          | Cambio validado con `TRANSICIONES`                       | 200 `{ etapa }`                           |
| `POST /autoridad/denuncias/:id/mensajes`       | Mensaje de la autoridad                                  | 201 `{ ok: true }`                        |
| `GET /autoridad/denuncias/:id/evidencias/:eid` | Blob sellado; tipo en `X-Evidencia-Tipo`                 | 200 binario                               |

La prueba de trabajo es el valor en base64 que produce el widget. `/publico/*` lo implementa el
contexto de transparencia.

**Errores:** `{ error: { message, details? } }`; `details` solo nombra campos, nunca valores.

| Estado        | Cuándo                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| 400           | Solicitud inválida, relato sin sellar, municipio de otro estado, evidencia inexistente o ya ligada        |
| 401           | `ERROR_ACCESO` en `/acceso/*` ante **cualquier** fallo; sin sesión o credenciales incorrectas en el panel |
| 403           | Prueba de trabajo inválida, expirada o ya usada, salvo en `/acceso/*`                                     |
| 404, 409      | No existe; transición inválida o frase ya usada                                                           |
| 413, 415, 422 | Excede el tamaño o las 500 páginas; tipo no permitido; dañado, cifrado, con macros o con residuales       |
| 429           | Demasiados intentos: inicio de sesión (por usuario y global) o `POST /denuncias` (por frase y global)     |
| 503           | Cuota global de subidas sin denuncia agotada, o demasiadas limpiezas de archivos en curso                 |

## Variables de entorno

`.env.example` trae valores de desarrollo. **Solo existen con `NODE_ENV` exactamente
`development` o `test`.** Con cualquier otro valor, o sin `NODE_ENV`, cada secreto marcado es
obligatorio, se rechazan los valores de desarrollo y el servidor no arranca. `npm run dev:backend`
fija `NODE_ENV=development`; `npm run migrate` y los scripts lo leen de `.env`.

| Variable                                                    | Obligatoria     | Por defecto                      | Uso                                                                        |
| ----------------------------------------------------------- | --------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`                                                  | Sí              | Ninguno                          | `development` o `test` habilitan los valores de desarrollo                 |
| `DATABASE_URL`                                              | Sí              | Postgres local (solo desarrollo) | Conexión                                                                   |
| `PIMIENTA_ACCESO`                                           | Sí              | Desarrollo                       | HMAC de folios y frases (64 hex)                                           |
| `ALTCHA_CLAVE_HMAC`                                         | Sí              | Desarrollo                       | Firma de los retos (64 hex)                                                |
| `CLAVE_MENSAJES`                                            | Sí              | Desarrollo                       | Cifrado de mensajes de la autoridad (64 hex)                               |
| `CLAVE_PUBLICA_AUTORIDAD`                                   | Sí              | Desarrollo                       | JWK público P-256; `npm run claves:autoridad -w @dataton/backend`          |
| `PORT`, `CORS_ORIGIN`                                       | No              | `4000`, `http://localhost:3000`  | Servidor                                                                   |
| `POW_COSTO`, `POW_CONTADOR_MAX`, `POW_EXPIRA_SEG`           | No              | `1000`, `2000`, `120`            | Dificultad y vigencia de los retos                                         |
| `MAX_BYTES_EVIDENCIA`                                       | No              | 20 MiB                           | Por archivo                                                                |
| `MAX_BYTES_EVIDENCIAS_TOTAL`                                | No              | 100 MiB                          | Por denuncia. El máximo de 5 archivos es regla de dominio                  |
| `CUOTA_HUERFANAS_BYTES`, `CUOTA_HUERFANAS_FILAS`            | No              | 2 GiB, `2000`                    | Cuota global de subidas sin denuncia; al llegar, 503                       |
| `LIMPIEZAS_SIMULTANEAS`, `LIMPIEZAS_ESPERA_MS`              | No              | `2`, `10000`                     | Limpiezas de archivos a la vez y espera máxima antes de 503                |
| `ACCESO_TIEMPO_MINIMO_MS`                                   | No              | `400`                            | Tiempo mínimo de `/acceso/*`                                               |
| `ACCESO_INTENTOS_CREDENCIAL`, `ACCESO_VENTANA_MS`           | No              | `30`, 15 min                     | Límite por HMAC de credencial, en `/acceso/*` y en `POST /denuncias`       |
| `ACCESO_LIMITE_GLOBAL`                                      | No              | `600`                            | Intentos por minuto entre todas las credenciales                           |
| `SESION_DURACION_MS`                                        | No              | 8 h                              | Sesión del panel                                                           |
| `SESION_LIMITE_GLOBAL`                                      | No              | `60`                             | Inicios de sesión por minuto en todo el panel                              |
| `SEMILLA_AUTORIDAD_USUARIO`, `SEMILLA_AUTORIDAD_CONTRASENA` | Para la semilla | Ninguno                          | Solo los lee el script de semilla                                          |
| `S5_ADAPTADOR`                                              | No              | `mock`                           | `mock` o `real`                                                            |
| `S5_BASE_URL`                                               | No              | Versión de pruebas               | Base del S5                                                                |
| `S5_ENVIO_AUTORIZADO`                                       | No              | `false`                          | Ver abajo                                                                  |
| `TEST_DATABASE_URL`                                         | Solo pruebas    | `localhost:5551`                 | Las pruebas vacían tablas. En CI usan `DATABASE_URL` si `CI` está definida |

## Adaptador S5

Puerto: `AdaptadorS5` en `contextos/denuncias/aplicacion/puerto-s5.ts`, con `MockS5` y `RealS5`.
Se elige con `S5_ADAPTADOR`. **Ningún caso de uso lo usa todavía**: la composición lo expone como
`adaptadorS5`, y una denuncia del buzón nunca sale hacia el S5.

| Operación                                           | Ruta en `S5_BASE_URL`                      | Estado                                  |
| --------------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| `catalogo("entidades" \| "municipios" \| "faltas")` | `GET /next-api/public/catalogos?catalog=…` | Comprobada contra la versión de pruebas |
| `estadisticas()`                                    | `GET /next-api/public/estadisticas`        | Comprobada contra la versión de pruebas |
| `registrarDenuncia()`                               | `POST /next-api/public/denuncias`          | **Bloqueada**                           |

**Por qué el envío está bloqueado:** `POST /next-api/public/denuncias`, `/evidencias` y
`/seguimiento` (`{ folio, trackingSecret }`) se conocen solo por el JavaScript del prototipo; no
están probadas, y **SESNA no ha autorizado enviar datos de prueba**. `RealS5.registrarDenuncia`
lanza "no autorizado" sin tocar la red, salvo con `S5_ENVIO_AUTORIZADO=true`. Aun con esa bandera,
la forma del cuerpo es una suposición sin verificar. No la actives sin el aval de SESNA.
`/evidencias` y `/seguimiento` no están implementadas.

### Correspondencia de etapas con el trámite del S5

**Pendiente de confirmar con SESNA.** Es una lectura inicial del prototipo, no una equivalencia
validada; nuestras etapas (`ETAPAS` en `@dataton/shared`) no cambian y hoy nada usa esta tabla.

| Trámite del S5                   | Tipo   | Etapa nuestra (propuesta)                                               |
| -------------------------------- | ------ | ----------------------------------------------------------------------- |
| Aceptar                          | Acción | `analisis_competencia` → `en_investigacion`                             |
| Reasignar                        | Acción | Sin cambio de etapa, o `turnada_investigadora` si cambia de autoridad   |
| Devolver                         | Acción | Sin equivalente directo: no hay transición de regreso en `TRANSICIONES` |
| Cierre: atendido                 | Cierre | `resuelta`                                                              |
| Cierre: canalizado               | Cierre | `sin_competencia`                                                       |
| Cierre: improcedente             | Cierre | `archivada`                                                             |
| Cierre: información insuficiente | Cierre | `archivada`                                                             |
| Cierre: acumulado                | Cierre | Sin equivalente directo; quizá `archivada`                              |
| Cierre: otro                     | Cierre | Sin equivalente directo; quizá `archivada`                              |

## Limpieza de evidencias: lo que sí y lo que no

Se valida el tipo real por magic bytes contra una lista de permitidos. El original solo vive en
memoria durante la petición; a disco y a la base de datos llega únicamente el sello.

| Formato          | Se elimina                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No está garantizado                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JPEG, PNG, WebP  | Todo lo que no sean píxeles: se recodifica con `sharp`. EXIF, GPS, XMP, IPTC, perfil de color, datos pegados al final                                                                                                                                                                                                                                                                                                                                                                                                                            | La recodificación con pérdida altera la imagen, y esto importa si su valor probatorio depende de los bytes originales. Lo visible en la foto sigue ahí |
| PDF              | Se reescribe copiando solo las páginas a un documento nuevo: Info, XMP, adjuntos, JavaScript, marcadores, revisiones incrementales, objetos huérfanos, anotaciones, `Metadata`/`PieceInfo` en objetos, EXIF de JPEG incrustados (filtro único `DCTDecode`)                                                                                                                                                                                                                                                                                       | Ver abajo                                                                                                                                              |
| DOCX, XLSX, PPTX | `docProps/`, `customXml/`, sus referencias, autores y fechas de comentarios y control de cambios, fechas del ZIP, metadatos de imágenes JPEG/PNG/WebP y de documentos Office incrustados, ruta absoluta y usuario compartido del libro (`absPath`, `fileSharing`), rutas locales en cualquier `.rels` (plantillas, vínculos, orígenes de datos: `file:`, unidades, UNC y todo lo externo que no sea http(s), vaciado a `about:blank`), `rsid` de Word y autores del historial de revisiones de Excel. Rechaza macros, ActiveX, OLE y ejecutables | Ver abajo                                                                                                                                              |

**Límites conocidos en PDF** (pdf-lib no es una herramienta forense):

- No toca el contenido de las páginas: el texto oculto, blanco sobre blanco o tapado con un
  rectángulo **sigue en el archivo**. Una "censura" hecha así no protege a nadie.
- Las capas opcionales referenciadas desde las páginas pueden conservarse.
- Imágenes con otros filtros (JPEG2000, JBIG2, filtros encadenados) no se inspeccionan.
- Fuentes, ICC y marcas de agua incrustadas pueden identificar el programa o la organización.
- Los comentarios y enlaces se eliminan, y los campos de formulario se aplanan. Si no se pueden
  aplanar se pierden, y la respuesta lo avisa.
- Rechaza los PDF cifrados, porque no se pueden inspeccionar.
- Comprueba el resultado buscando marcas (`/Metadata`, `/Author`, `/JavaScript`…) y rechaza el
  archivo si queda alguna, por lo que un PDF legítimo con esas cadenas sin comprimir se rechazaría.
- Rechaza más de 500 páginas o 50,000 objetos indirectos antes de aplanar y copiar páginas. El
  análisis inicial (`PDFDocument.load`) sí se ejecuta y para 100,000 páginas tarda unos 2 s.

**Límites conocidos en Office.** Regla: lo que no se sabe limpiar no se da por limpio, se rechaza.

- Imágenes en `media/` que no sean JPEG, PNG o WebP (TIFF, GIF, BMP, EMF, WMF) y objetos en
  `embeddings/` que no sean DOCX/XLSX/PPTX (`.docm`, `.xlsm`, `.pptm`, `.dotm`, `.pdf`, `.bin`)
  se reportan como residuales y el archivo se rechaza con 422.
- Tras limpiar, se vuelve a recorrer cada parte de texto buscando `file:`, rutas de disco, UNC,
  `absPath`, `rsid` y referencias a `docProps/`; si algo sobrevive, también se rechaza.
- No se revisan texto oculto, `printerSettings/` (binarios con nombres de impresoras) ni fuentes
  incrustadas, que pueden identificar al programa o la organización.
- Tamaño anti-bomba: 50 MB inflados. Se comprueba el tamaño real inflando cada parte en flujo,
  sin retenerla, además del declarado; un ZIP que mienta en sus cabeceras se rechaza igual.

**Sin antimalware:** ClamAV (HU-19, prioridad "Could") no está integrado. La defensa actual es la
lista de permitidos, el rechazo de contenido activo y la recodificación.

## Garantías de privacidad y sus límites

- Nada lee ni registra IP, user-agent, cuerpos ni credenciales. `registrarError` escribe solo
  nombre, código y marcos de pila del error: **nunca su mensaje**.
- El proxy o balanceador que esté delante sí puede registrar IP. Hay que configurarlo aparte.
- `POST /denuncias` con una frase ya usada responde 409: revela que ese identificador existe. Con
  66 bits más Argon2id no es explotable en la práctica, pero no es un error uniforme.
- El límite global de `/acceso/*` puede bloquear a todos si alguien lo agota; la prueba de trabajo
  encarece ese ataque, no lo impide.
- Límites, retos usados y sesiones viven en memoria: se pierden al reiniciar y no se comparten
  entre instancias. El backend asume **una sola instancia**.
- **Orden de llegada en el almacenamiento físico (riesgo residual).** El comentario de
  `001_inicial.sql` dice que los identificadores aleatorios impiden inferir el orden de llegada.
  Eso vale para quien consulta por SQL con el rol de la aplicación, no para quien tenga un volcado
  físico: las columnas de sistema `xmin` y `ctid` de Postgres revelan el orden en que se insertó
  cada fila de `denuncias`, `evidencias` y `mensajes`. Como la bitácora del panel comparte base,
  ese orden se puede cruzar con sus marcas de tiempo. La migración `101` trunca `creado_en` a la
  hora para que la ventana sea de una hora y no de segundos; **no elimina el riesgo**. Quitarlo
  exige separar la bitácora en otra base o reescribir las tablas periódicamente (`VACUUM FULL` o
  `CLUSTER` por una columna aleatoria), y ninguna de las dos está hecha.
- La limpieza de archivos corre en el mismo proceso que atiende peticiones: `LIMPIEZAS_SIMULTANEAS`
  acota cuántas a la vez y el resto espera o recibe 503. No corre en `worker_threads`, así que una
  limpieza lenta sigue ocupando el hilo principal mientras dura.

## Pruebas

```bash
POSTGRES_PORT=5551 docker compose -p dataton-backend up -d --wait
npm test -w @dataton/backend
POSTGRES_PORT=5551 docker compose -p dataton-backend down -v
```

Dominio sin base de datos, aplicación con puertos falsos en memoria e integración (`test/integracion`)
contra Postgres real.
