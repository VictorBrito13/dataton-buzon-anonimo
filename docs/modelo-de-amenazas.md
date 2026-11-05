# Modelo de amenazas

La tesis de este proyecto es que **el anonimato no se afirma, se demuestra**. Este documento dice de quién se protege a la persona denunciante, con qué medidas, cómo se comprueba cada una y qué riesgo queda aunque todo funcione bien.

Complementa a [`decisiones-arquitectura.md`](./decisiones-arquitectura.md). Los resultados de la última corrida están en [`evidencia/reporte-anonimato.md`](./evidencia/reporte-anonimato.md).

**Estados usados en la matriz:**

- **Verificado:** una prueba automática lo comprobó contra el despliegue real con Docker (`e2e/anonimato/`, 38 pruebas en el último [reporte](./evidencia/reporte-anonimato.md) antes de este cambio; ninguna pendiente ni omitida).
- **Pruebas del módulo:** lo comprueban pruebas unitarias o de integración (Vitest, con Postgres cuando hace falta), pero no una prueba contra el despliegue. Es evidencia, no garantía sobre lo desplegado.
- **Pendiente de verificar:** aún no hay prueba que lo demuestre. No debe leerse como garantía.
- **Sin mitigación técnica:** límite conocido; solo se informa a la persona.

## 1. Alcance y supuestos

**Dentro del alcance:** recepción, trámite y seguimiento de una denuncia, y las estadísticas públicas derivadas.

**Supuestos:**

- El navegador y el dispositivo de la persona no están comprometidos.
- La criptografía estándar utilizada (Argon2id, HMAC-SHA-256, ECDH P-256, AES-256-GCM) es sólida.
- La clave privada de la autoridad se resguarda fuera del servidor (D3). En la demostración de `docker compose up` se genera en la misma máquina, en un volumen (`clave-autoridad-demo`) que ningún servicio en ejecución monta; quien administre ese Docker podría leerla, y por eso ese modo no es un despliegue real.
- Esto es un prototipo: usa datos sintéticos y no llega a ninguna autoridad (D9).

## 2. Activos

| Activo                              | Por qué importa                                  | Dónde vive                                                 |
| ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Identidad de quien denuncia         | Es lo que se protege; su exposición permite represalias | No se recolecta; podría inferirse de los activos siguientes |
| Frase de recuperación               | Da acceso a la denuncia                          | Solo en el dispositivo; el servidor guarda un HMAC de su derivado |
| Folio                               | Da acceso a la denuncia                          | Se muestra una vez; el servidor guarda su HMAC             |
| Relato y personas involucradas      | Su contenido puede identificar                   | Sellado en el navegador para la autoridad                  |
| Evidencias                          | Sus metadatos y su contenido pueden identificar  | Selladas en el servidor tras verificarlas                  |
| Metadatos de conexión (IP, navegador, hora) | Vinculan a la persona con la denuncia    | Caddy los recibe; no se reenvían ni se guardan. Google los recibe si la persona usa la salida rápida |
| Pimienta y secretos del despliegue  | Con ellos y un volcado se podrían comprobar credenciales | Volumen `secretos`, fuera de la base y del repositorio     |
| Clave privada de la autoridad       | Abre relatos y evidencias                        | Navegador de la autoridad; nunca en un servicio del servidor. En la demostración, volumen `clave-autoridad-demo` de la misma máquina, que backend, frontend, db, caddy y migraciones no montan (lo comprueba `docker/compose.test.mjs`) |
| Estadísticas públicas               | Una celda pequeña puede señalar a alguien        | `agregados_publicos`, tras el motor de k-anonimato         |

## 3. Adversarios

| Adversario                         | Capacidad                                                                      | Objetivo                                     |
| ---------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| **A1. Operador del sistema**       | Acceso a servidores, base de datos, bitácoras y configuración                  | Saber quién denunció o leer el contenido     |
| **A2. Observador de red**          | Ve el tráfico entre la persona y el sitio: proveedor de internet, red laboral  | Saber quién usa el buzón y cuándo            |
| **A3. Ente denunciado**            | Recibe información del caso; conoce a su personal y sus conflictos             | Deducir quién denunció                       |
| **A4. Quien obtiene la frase o el folio** | Robo, descuido, coacción                                                | Entrar al seguimiento y leer mensajes        |
| **A5. Analista de las estadísticas** | Descarga los datos abiertos y cruza publicaciones                            | Deducir un caso individual                   |
| **A6. Dueño de un equipo compartido** | Acceso físico o de administración al dispositivo usado                      | Encontrar rastros de la denuncia             |

## 4. Matriz de amenazas

### A1. Operador del sistema

| Amenaza                                     | Mitigación                                                                            | Cómo se prueba                                                                      | Estado                 | Riesgo residual                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Leer IP o user-agent en bitácoras           | Caddy sin registro de acceso ni de errores; backend y frontend no reciben esas cabeceras | `despliegue.spec.ts`: envía marcadores, provoca 404 y 502, y busca en todas las bitácoras | Verificado             | Quien controla el servidor puede cambiar la configuración o capturar tráfico. Ver sección 5 |
| Encontrar IP o user-agent en la base        | El esquema no tiene esas columnas (`001_inicial.sql`)                                 | `despliegue.spec.ts`: revisa el catálogo de columnas                                | Verificado             | Una migración futura podría agregarlas; la prueba fallaría                      |
| Leer relato, frase o folio en un volcado    | Sellado en navegador; HMAC con pimienta fuera de la base                              | `flujo.spec.ts`: busca en `pg_dump`, también en hexadecimal y base64                | Verificado             | Quien tiene pimienta y volcado puede probar candidatos; la entropía (66 y 80 bits) lo hace inviable. Un volcado físico conserva rastros internos (`xmin`, `ctid`) que acotan el orden y la hora aproximada de llegada. Ver sección 5 |
| Leer el relato en tránsito por el servidor  | El navegador sella antes de enviar                                                    | `flujo.spec.ts`: inspecciona cuerpo, URL y cabeceras de cada petición               | Verificado             | Depende de que se sirva el código publicado. Ver sección 5                      |
| Leer evidencias                             | Se sellan en el servidor tras verificarlas y se descarta el original (D3)             | `apps/backend/test/integracion/flujo.test.ts`: `POST /evidencias` elimina GPS y autor, limpia PDF y Office, y guarda solo el sello. El flujo E2E de anonimato aún no sube un archivo | Pruebas del módulo | **El servidor ve cada evidencia durante su verificación.** Ver sección 5        |
| Ver contraseña o claves en imágenes o repositorio | Volumen generado al desplegar; `.dockerignore` excluye `.env` y claves; la contraseña demo del panel va en un volumen que solo lee `migraciones` | `docker/generar-secretos.test.mjs` y `docker/compose.test.mjs` sobre `docker-compose.yml` y `docker/generar-secretos.mjs`; `despliegue.spec.ts`: imágenes sin secretos en su entorno | Verificado | Quien administra Docker puede leer los volúmenes                                |
| Que un servicio interno envíe datos fuera   | Red `interna` sin salida a internet; telemetría de Next apagada                       | `despliegue.spec.ts`: backend y frontend intentan salir y fallan                    | Verificado             | El sitio no llama a la PDN en tiempo de ejecución (D8); un adaptador real del S5 requeriría una salida controlada |

### A2. Observador de red

| Amenaza                                    | Mitigación                                          | Cómo se prueba                                              | Estado         | Riesgo residual                                                                     |
| ------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| Leer el contenido                          | HTTPS, HSTS y redirección desde HTTP                | `despliegue.spec.ts`: cabeceras y redirección 308           | Verificado     | La primera visita por HTTP puede interceptarse antes de recibir HSTS                |
| Aprender algo por dominios de terceros     | Sin recursos externos; CSP restrictiva              | `despliegue.spec.ts` y `flujo.spec.ts`: registran toda petición, también durante el envío | Verificado | **La salida rápida abre Google**, un sitio ajeno que recibe la IP y la hora de esa visita. Es una decisión, no un recurso incrustado: nada se carga de terceros mientras se usa el buzón. Ver sección 5 |
| Filtrar la página de origen                | `Referrer-Policy: no-referrer`                      | `despliegue.spec.ts`                                        | Verificado     | Ninguno por esta vía                                                                |
| Saber que alguien visitó el buzón          | Ninguna en el sitio; se recomienda otra red o Tor Browser | No aplica                                              | Sin mitigación técnica | **El dominio y el momento siguen siendo visibles.** Ver sección 5           |

### A3. Ente denunciado

| Amenaza                                      | Mitigación                                                       | Cómo se prueba                       | Estado                 | Riesgo residual                                                   |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| Metadatos de archivos (autor, GPS)           | Limpieza en el navegador y verificación en el servidor           | Pruebas del módulo en `lib/privacidad`; en el servidor, `test/integracion/flujo.test.ts` (GPS y autor eliminados, PDF y Office limpios). El flujo E2E de anonimato aún no sube un archivo | Pruebas del módulo | Formatos no contemplados; contenido visible del archivo (una foto) |
| Datos directos en el texto (CURP, teléfono)  | Depurador local con reglas                                       | Pruebas del módulo en `lib/privacidad`; en el flujo, `apps/frontend/dashboard/e2e/denunciante.spec.ts` y `busqueda-modelo.spec.ts` (el teléfono del relato aparece como sugerencia) | Pruebas del módulo | La persona decide; el depurador sugiere, no obliga                |
| Nombres, cargos y lugares en el texto        | Modelo NER local y opcional, integrado en la revisión de `/denunciar` | `busqueda-modelo.spec.ts` con el modelo real: sugiere nombres sin que el relato salga del dispositivo; precisión no medida ([README](../apps/frontend/dashboard/lib/privacidad/README.md)) | Pruebas del módulo | Un modelo comete errores en ambos sentidos                        |
| Detalles que solo una persona conoce         | Avisos de riesgo contextual                                      | Pruebas del módulo en `lib/privacidad` y en `denunciante.spec.ts` | Pruebas del módulo | **No es automatizable por completo.** Ver sección 5               |
| Estilo de redacción                          | Ninguna                                                          | No aplica                            | Sin mitigación técnica | **Estilometría.** Ver sección 5                                   |
| Relación entre fecha y un hecho conocido     | Se guarda el día, sin hora; estadísticas por trimestre cerrado con rezago | Esquema verificado en `despliegue.spec.ts`; rezago y trimestres congelados en `agregar-periodos.test.ts`; publicación en el despliegue en `tablero.spec.ts` | Verificado | **Correlación por momento de envío**, y rastros internos del volcado (`xmin`, `ctid`). Ver sección 5 |

### A4. Quien obtiene la frase o el folio

| Amenaza                        | Mitigación                                                         | Cómo se prueba                     | Estado                 | Riesgo residual                                           |
| ------------------------------ | ------------------------------------------------------------------ | ---------------------------------- | ---------------------- | --------------------------------------------------------- |
| Adivinar credenciales          | 66 y 80 bits; prueba de trabajo; límite en memoria; error uniforme | `test/integracion/flujo.test.ts`: exige prueba de trabajo de un solo uso y límites por credencial y globales; `flujo.spec.ts`: folio de 80 bits y frase de 6 palabras en el despliegue | Pruebas del módulo | Inviable por fuerza bruta                                 |
| Revelar si un folio existe     | Mismo `401` y tiempo mínimo fijo                                   | `test/integracion/flujo.test.ts`: responde byte a byte igual exista o no la credencial, y ante cualquier fallo | Pruebas del módulo | Variaciones de tiempo no medidas en el despliegue         |
| Usar una frase robada          | Instrucciones de resguardo; no se muestra el relato al consultar   | `test/integracion/flujo.test.ts`: la consulta devuelve etapas y mensajes, nunca el relato sellado | Pruebas del módulo | Quien la tiene ve etapas y mensajes, y puede escribir como si fuera la persona |

### A5. Analista de las estadísticas

| Amenaza                                 | Mitigación                                             | Cómo se prueba                             | Estado                 | Riesgo residual                                         |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------ | ---------------------- | ------------------------------------------------------- |
| Celdas pequeñas                         | Umbral k = 5 (D6)                                      | Pruebas de ataque del módulo de datos (`npm run test:ataques -w @dataton/backend`); `tablero.spec.ts`: en el despliegue con datos sintéticos, ninguna celda publicada vale entre 1 y k − 1 en ninguna tabla ni descarga | Verificado | Un valor de k bajo en un municipio muy pequeño          |
| Resta en fila, columna, nivel y periodo | Supresión complementaria; trimestres cerrados; atacante automático antes de publicar | Pruebas de ataque del módulo de datos (`npm run test:ataques -w @dataton/backend`): resta en fila, columna, nivel y periodo, eliminación de variables, propagación de intervalos y enumeración exacta en tablas pequeñas | Pruebas del módulo | Cruces con fuentes externas que no se pueden anticipar; lo que el atacante no modela está en `dominio/metodologia.ts` (`NO_CUBRE`) |
| Deducir una celda oculta desde los indicadores por ente | Los porcentajes, tiempos promedio y señal de un ente se publican solo si todas sus celdas `ente × etapa` están publicadas | `publicacion.test.ts` y `agregar-periodos.test.ts`: un atacante lee tablas, descargas e indicadores a la vez (`dominio/ataque-indicadores.ts`), sobre el caso que antes revelaba cuatro celdas exactas y sobre 100 publicaciones al azar; `tablero.spec.ts`: en el despliegue, los entes con alguna etapa oculta no traen derivados | Verificado | De un porcentaje omitido se podría deducir una disyunción débil que el atacante no modela (`NO_CUBRE`) |
| Llegar a denuncias desde el tablero     | Rol de base de datos limitado a `agregados_publicos`, con contraseña generada al desplegar | `despliegue.spec.ts`: rechaza la contraseña de desarrollo y `SELECT` sobre `denuncias` | Verificado | Ninguno por esta vía                                    |

### A6. Dueño de un equipo compartido

| Amenaza                           | Mitigación                                       | Cómo se prueba                                                | Estado                                   | Riesgo residual                                      |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Cookies o almacenamiento local    | Sin cookies; borrador solo si se activa          | `despliegue.spec.ts` (páginas públicas) y `flujo.spec.ts` (tras enviar una denuncia) | Verificado | Si activa el borrador o elige un tema, queda en el equipo; se avisa |
| Ver el modelo NER en la caché del navegador | Es opcional y se avisa antes de activarlo | `busqueda-modelo.spec.ts`: sin activarlo no se pide ningún archivo del modelo; la opción avisa | Pruebas del módulo | Si se activa, queda en el equipo y muestra que se usó este sitio; la salida rápida no lo borra |
| Encontrar la frase en la URL      | La credencial viaja en el cuerpo, nunca en la URL (D1) | `flujo.spec.ts`: la frase no aparece en URL, cuerpo ni cabeceras | Verificado                        | Portapapeles e impresiones escapan al sitio          |
| Salir de golpe                    | Botón de salida rápida y Esc tres veces (HU-12); borra borrador y tema | `apps/frontend/dashboard/e2e/denunciante.spec.ts` y `responsive.spec.ts` | Pruebas del módulo | **Abre Google, un sitio ajeno, que recibe IP y hora.** El historial del navegador conserva la visita y el modelo NER sigue en la caché. Ver sección 5 |
| Software espía en el equipo       | Ninguna                                          | No aplica                                                     | Sin mitigación técnica                   | Quedó fuera de los supuestos: usar otro dispositivo  |

## 5. Límites honestos

Ninguna de estas situaciones se resuelve del todo con tecnología. Se comunican en lenguaje claro en [`/como-te-protegemos`](../apps/frontend/dashboard/app/como-te-protegemos/page.tsx).

- **Estilometría.** La forma de escribir puede reconocerse, sobre todo por quien ya conoce los textos de la persona. El sistema no reescribe el relato: hacerlo podría cambiar los hechos.
- **Contenido que identifica.** Si la persona cuenta algo que solo ella pudo presenciar, ninguna herramienta lo impide. El sistema avisa; no garantiza.
- **Correlación por momento de envío.** Guardar solo el día y publicar por trimestre reduce el riesgo, pero quien observa la red o sabe de un conflicto reciente puede relacionar fechas. El propio trámite también hace visible el momento para la autoridad.
- **Rastros internos del volcado.** El esquema guarda solo el día, y `pg_dump` no muestra más. Pero quien obtenga una copia física de la base (los archivos de PostgreSQL, no un volcado lógico) puede leer columnas de sistema como `xmin` y `ctid`: no dicen la hora, pero sí el orden en que se insertaron las filas y, comparado con filas cuyo momento se conozca, una hora aproximada de llegada. Es un matiz, no una fuga de la hora: no hay forma de evitarlo sin reescribir la tabla periódicamente, y se comunica en `/como-te-protegemos`.
- **Salida rápida y terceros.** El botón «Salida rápida» (y Esc tres veces) borra el borrador y el tema guardados y lleva a Google (`lib/denuncia/salida-rapida.ts`). Es el único momento en que el sitio dirige a un tercero: ese sitio recibe la IP y la hora de la visita, como cualquier página que la persona abra, y el historial del navegador conserva la visita al buzón. No borra el modelo NER descargado si la persona lo activó. Se declara en `/como-te-protegemos` y en la página de inicio.
- **Ventana en que el servidor ve evidencias.** Para verificar tipo y metadatos, el servidor procesa el archivo antes de sellarlo. En ese lapso depende de que corra el código publicado.
- **Proveedor de red.** Ve que un dispositivo se conectó a este dominio, cuándo y cuántos datos envió, aunque no el contenido.
- **Proveedor de hospedaje y operador.** Quien controla el servidor o su red puede activar bitácoras o capturar IPs. Las pruebas demuestran el comportamiento del código publicado, no lo que corre en un servidor ajeno. Un despliegue real necesitaría medidas adicionales, como auditoría independiente y verificación de la versión desplegada.
- **Compromiso del propio frontend.** El sellado ocurre en código que entrega el servidor. Si se altera, puede enviar la frase o el relato en claro. La CSP reduce la inyección de código ajeno, pero no protege de un servidor comprometido. Las pruebas detectan este tipo de cambio en el código del repositorio, no en un sitio ya modificado.

## 6. Qué recorre la prueba del flujo

`flujo.spec.ts` recorre el formulario real de `/denunciar` con sus etiquetas visibles, con un navegador marcado (IP de documentación y user-agent único), y envía una denuncia. Formulario y API ya están integrados: si algo falta, la prueba **falla**; no existe un estado pendiente ni una variable para exigirlo. Después examina las peticiones, el almacenamiento, `pg_dump` y las bitácoras. `tablero.spec.ts` carga datos sintéticos con `docker compose run --rm sintetico` y revisa lo que publican `/agregados`, las descargas e `/indicadores`. Lo que el flujo aún no hace: subir una evidencia; por eso esa fila sigue en "Pruebas del módulo".

## 7. Hallazgos al construir la infraestructura

Decisiones que un despliegue común pasa por alto:

- **Caddy registra IP y user-agent en sus errores, no solo en el registro de acceso.** Quitar `log` del sitio no basta: comprobamos que, con la configuración por omisión de Caddy 2.11.8, un 502 escribe `remote_ip` y `User-Agent` en `http.log.error`. El `Caddyfile` excluye esos registros, y la prueba lo comprueba deteniendo el backend.
- **Caddy reenvía la IP al backend por omisión** en `X-Forwarded-For`. Se quitan esa cabecera, sus variantes y el `User-Agent`, de modo que lo que está detrás nunca los recibe.
- **El modelo NER se descarga al construir la imagen, no en el navegador.** Se contacta a Hugging Face desde la máquina que construye, con revisión y SHA-256 fijos, nunca desde el dispositivo de quien denuncia. `DESCARGAR_MODELO_NER=0` lo omite.
- **Next.js envía telemetría por omisión.** Se apaga al construir y al ejecutar, y la red interna impediría la salida de todos modos.
- **`pg_dump` muestra las columnas binarias en hexadecimal.** Un relato guardado sin sellar en una columna `bytea` no aparecería como texto. Por eso la búsqueda incluye las formas hexadecimal y base64.

## 8. Mejoras futuras

- **Servicio .onion.** Publicar el buzón como servicio de Tor eliminaría la exposición de la IP ante el servidor y dificultaría al observador de red saber que se usa el buzón. El sitio ya funciona sin terceros, lo que facilita esa ruta. **Pendiente de verificar** su funcionamiento con Tor Browser en nivel de seguridad "Más seguro", porque Argon2id usa WebAssembly.
- **Salida rápida sin terceros.** Una opción simple que no contacta a nadie: navegar a `about:blank` y reemplazar la entrada actual del historial (`location.replace`), de modo que ni el servidor del buzón ni un tercero vean la salida. Pierde la apariencia de "estaba en Google", que es lo que da credibilidad frente a quien mira la pantalla; otra variante es abrir una página neutra servida por el propio sitio con otra ruta, que tampoco contacta terceros pero deja la visita al dominio en el historial. No se aplicó en este cambio: se propone para que el equipo decida.
- **Rellenado de tamaño y envío diferido** para reducir la información que deja el volumen del tráfico y el momento del envío.
- **Compilaciones reproducibles y verificación de la versión desplegada**, para acotar el compromiso del frontend.
- **Escaneo antimalware** de evidencias (HU-19).
- **Sellado de evidencias en el navegador**, para cerrar la ventana en que el servidor las ve, a cambio de no poder verificarlas allí.
