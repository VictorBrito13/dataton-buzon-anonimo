# Modelo de amenazas

La tesis de este proyecto es que **el anonimato no se afirma, se demuestra**. Este documento dice de quién se protege a la persona denunciante, con qué medidas, cómo se comprueba cada una y qué riesgo queda aunque todo funcione bien.

Complementa a [`decisiones-arquitectura.md`](./decisiones-arquitectura.md). Los resultados de la última corrida están en [`evidencia/reporte-anonimato.md`](./evidencia/reporte-anonimato.md).

**Estados usados en la matriz:**

- **Verificado:** una prueba automática lo comprobó contra el despliegue real con Docker.
- **Prueba escrita:** la prueba existe en `e2e/anonimato/`, pero espera a que se integre lo que comprueba (`fixme`).
- **Pendiente de verificar:** depende de otro módulo y aún no hay prueba que lo demuestre aquí. No debe leerse como garantía.
- **Sin mitigación técnica:** límite conocido; solo se informa a la persona.

## 1. Alcance y supuestos

**Dentro del alcance:** recepción, trámite y seguimiento de una denuncia, y las estadísticas públicas derivadas.

**Supuestos:**

- El navegador y el dispositivo de la persona no están comprometidos.
- La criptografía estándar utilizada (Argon2id, HMAC-SHA-256, ECDH P-256, AES-256-GCM) es sólida.
- La clave privada de la autoridad se resguarda fuera del servidor (D3).
- Esto es un prototipo: usa datos sintéticos y no llega a ninguna autoridad (D9).

## 2. Activos

| Activo                              | Por qué importa                                  | Dónde vive                                                 |
| ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Identidad de quien denuncia         | Es lo que se protege; su exposición permite represalias | No se recolecta; podría inferirse de los activos siguientes |
| Frase de recuperación               | Da acceso a la denuncia                          | Solo en el dispositivo; el servidor guarda un HMAC de su derivado |
| Folio                               | Da acceso a la denuncia                          | Se muestra una vez; el servidor guarda su HMAC             |
| Relato y personas involucradas      | Su contenido puede identificar                   | Sellado en el navegador para la autoridad                  |
| Evidencias                          | Sus metadatos y su contenido pueden identificar  | Selladas en el servidor tras verificarlas                  |
| Metadatos de conexión (IP, navegador, hora) | Vinculan a la persona con la denuncia    | Caddy los recibe; no se reenvían ni se guardan             |
| Pimienta y secretos del despliegue  | Con ellos y un volcado se podrían comprobar credenciales | Volumen `secretos`, fuera de la base y del repositorio     |
| Clave privada de la autoridad       | Abre relatos y evidencias                        | Navegador de la autoridad, nunca en el servidor            |
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
| Leer relato, frase o folio en un volcado    | Sellado en navegador; HMAC con pimienta fuera de la base                              | `flujo.spec.ts`: busca en `pg_dump`, también en hexadecimal y base64                | Prueba escrita         | Quien tiene pimienta y volcado puede probar candidatos; la entropía (66 y 80 bits) lo hace inviable |
| Leer el relato en tránsito por el servidor  | El navegador sella antes de enviar                                                    | `flujo.spec.ts`: inspecciona cuerpo, URL y cabeceras de cada petición               | Prueba escrita         | Depende de que se sirva el código publicado. Ver sección 5                      |
| Leer evidencias                             | Se sellan en el servidor tras verificarlas y se descarta el original (D3)             | Pendiente del módulo de evidencias                                                  | Pendiente de verificar | **El servidor ve cada evidencia durante su verificación.** Ver sección 5        |
| Ver contraseña o claves en imágenes o repositorio | Volumen generado al desplegar; `.dockerignore` excluye `.env` y claves          | Revisión de `docker-compose.yml`, `.dockerignore` y `docker/generar-secretos.sh`    | Revisión manual        | Quien administra Docker puede leer el volumen                                   |
| Que un servicio interno envíe datos fuera   | Red `interna` sin salida a internet; telemetría de Next apagada                       | `despliegue.spec.ts`: backend y frontend intentan salir y fallan                    | Verificado             | El sitio no llama a la PDN en tiempo de ejecución (D8); un adaptador real del S5 requeriría una salida controlada |

### A2. Observador de red

| Amenaza                                    | Mitigación                                          | Cómo se prueba                                              | Estado         | Riesgo residual                                                                     |
| ------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| Leer el contenido                          | HTTPS, HSTS y redirección desde HTTP                | `despliegue.spec.ts`: cabeceras y redirección 308           | Verificado     | La primera visita por HTTP puede interceptarse antes de recibir HSTS                |
| Aprender algo por dominios de terceros     | Sin recursos externos; CSP restrictiva              | `despliegue.spec.ts` y `flujo.spec.ts`: registran toda petición | Verificado en `/` y `/como-te-protegemos`; el resto, prueba escrita | Ninguno por esta vía                                   |
| Filtrar la página de origen                | `Referrer-Policy: no-referrer`                      | `despliegue.spec.ts`                                        | Verificado     | Ninguno por esta vía                                                                |
| Saber que alguien visitó el buzón          | Ninguna en el sitio; se recomienda otra red o Tor Browser | No aplica                                              | Sin mitigación técnica | **El dominio y el momento siguen siendo visibles.** Ver sección 5           |

### A3. Ente denunciado

| Amenaza                                      | Mitigación                                                       | Cómo se prueba                       | Estado                 | Riesgo residual                                                   |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| Metadatos de archivos (autor, GPS)           | Limpieza en el navegador y verificación en el servidor           | Pendiente de los módulos de privacidad y evidencias | Pendiente de verificar | Formatos no contemplados; contenido visible del archivo (una foto) |
| Datos directos en el texto (CURP, teléfono)  | Depurador local con reglas                                       | Pendiente del módulo de privacidad   | Pendiente de verificar | La persona decide; el depurador sugiere, no obliga                |
| Nombres, cargos y lugares en el texto        | Modelo NER local y opcional                                      | Pendiente del módulo de privacidad   | Pendiente de verificar | Un modelo comete errores en ambos sentidos                        |
| Detalles que solo una persona conoce         | Avisos de riesgo contextual                                      | Pendiente del módulo de privacidad   | Pendiente de verificar | **No es automatizable por completo.** Ver sección 5               |
| Estilo de redacción                          | Ninguna                                                          | No aplica                            | Sin mitigación técnica | **Estilometría.** Ver sección 5                                   |
| Relación entre fecha y un hecho conocido     | Se guarda el día, sin hora; estadísticas por trimestre con rezago | Esquema verificado; rezago pendiente del módulo de datos | Pendiente de verificar | **Correlación por momento de envío.** Ver sección 5 |

### A4. Quien obtiene la frase o el folio

| Amenaza                        | Mitigación                                                         | Cómo se prueba                     | Estado                 | Riesgo residual                                           |
| ------------------------------ | ------------------------------------------------------------------ | ---------------------------------- | ---------------------- | --------------------------------------------------------- |
| Adivinar credenciales          | 66 y 80 bits; prueba de trabajo; límite en memoria; error uniforme | Pendiente del módulo de backend    | Pendiente de verificar | Inviable por fuerza bruta                                 |
| Revelar si un folio existe     | Mismo `401` y tiempo mínimo fijo                                   | Pendiente del módulo de backend    | Pendiente de verificar | Variaciones de tiempo no detectadas                       |
| Usar una frase robada          | Instrucciones de resguardo; no se muestra el relato al consultar   | Pendiente del flujo de seguimiento | Pendiente de verificar | Quien la tiene ve etapas y mensajes, y puede escribir como si fuera la persona |

### A5. Analista de las estadísticas

| Amenaza                                 | Mitigación                                             | Cómo se prueba                             | Estado                 | Riesgo residual                                         |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------ | ---------------------- | ------------------------------------------------------- |
| Celdas pequeñas                         | Umbral k = 5 (D6)                                      | Pruebas de ataque del módulo de datos      | Pendiente de verificar | Un valor de k bajo en un municipio muy pequeño          |
| Resta en fila, columna, nivel y periodo | Supresión complementaria; trimestres cerrados          | Pruebas de ataque del módulo de datos      | Pendiente de verificar | Cruces con fuentes externas que no se pueden anticipar  |
| Llegar a denuncias desde el tablero     | Rol de base de datos limitado a `agregados_publicos`   | Pendiente del módulo de datos              | Pendiente de verificar | Ninguno por esta vía si se aplica el rol                |

### A6. Dueño de un equipo compartido

| Amenaza                           | Mitigación                                       | Cómo se prueba                                                | Estado                                   | Riesgo residual                                      |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Cookies o almacenamiento local    | Sin cookies; borrador solo si se activa          | `despliegue.spec.ts` y `flujo.spec.ts`                        | Verificado en páginas públicas; flujo con prueba escrita | Si activa el borrador, queda en el equipo; se avisa |
| Encontrar la frase en la URL      | La credencial viaja en el cuerpo, nunca en la URL (D1) | `flujo.spec.ts`                                         | Prueba escrita                           | Portapapeles e impresiones escapan al sitio          |
| Salir de golpe                    | Botón de salida rápida (HU-12)                   | Pendiente del flujo de denuncia                               | Pendiente de verificar                   | El historial del navegador conserva la visita        |
| Software espía en el equipo       | Ninguna                                          | No aplica                                                     | Sin mitigación técnica                   | Quedó fuera de los supuestos: usar otro dispositivo  |

## 5. Límites honestos

Ninguna de estas situaciones se resuelve del todo con tecnología. Se comunican en lenguaje claro en [`/como-te-protegemos`](../apps/frontend/dashboard/app/como-te-protegemos/page.tsx).

- **Estilometría.** La forma de escribir puede reconocerse, sobre todo por quien ya conoce los textos de la persona. El sistema no reescribe el relato: hacerlo podría cambiar los hechos.
- **Contenido que identifica.** Si la persona cuenta algo que solo ella pudo presenciar, ninguna herramienta lo impide. El sistema avisa; no garantiza.
- **Correlación por momento de envío.** Guardar solo el día y publicar por trimestre reduce el riesgo, pero quien observa la red o sabe de un conflicto reciente puede relacionar fechas. El propio trámite también hace visible el momento para la autoridad.
- **Ventana en que el servidor ve evidencias.** Para verificar tipo y metadatos, el servidor procesa el archivo antes de sellarlo. En ese lapso depende de que corra el código publicado.
- **Proveedor de red.** Ve que un dispositivo se conectó a este dominio, cuándo y cuántos datos envió, aunque no el contenido.
- **Proveedor de hospedaje y operador.** Quien controla el servidor o su red puede activar bitácoras o capturar IPs. Las pruebas demuestran el comportamiento del código publicado, no lo que corre en un servidor ajeno. Un despliegue real necesitaría medidas adicionales, como auditoría independiente y verificación de la versión desplegada.
- **Compromiso del propio frontend.** El sellado ocurre en código que entrega el servidor. Si se altera, puede enviar la frase o el relato en claro. La CSP reduce la inyección de código ajeno, pero no protege de un servidor comprometido. Las pruebas detectan este tipo de cambio en el código del repositorio, no en un sitio ya modificado.

## 6. Contrato con el flujo de denuncia

`flujo.spec.ts` no supone el orden de los pasos: en cada paso llena lo visible y avanza. Necesita estos `data-testid` en `/denunciar`:

| `data-testid`        | Elemento                                                  |
| -------------------- | --------------------------------------------------------- |
| `denuncia-formulario` | Contenedor del formulario; su presencia activa las pruebas |
| `denuncia-relato`    | Campo del relato                                          |
| `denuncia-siguiente` | Botón para avanzar de paso                                |
| `denuncia-enviar`    | Botón de envío final                                      |
| `frase-recuperacion` | Elemento cuyo texto es la frase de seis palabras          |
| `frase-confirmar`    | Casilla "ya la guardé"                                    |
| `folio-denuncia`     | Elemento cuyo texto es el folio final                     |

Los `<select>` visibles vacíos se llenan con su primera opción. Con `ANONIMATO_EXIGIR_FLUJO=1`, si el formulario falta, la suite falla en lugar de quedar pendiente.

## 7. Hallazgos al construir la infraestructura

Decisiones que un despliegue común pasa por alto:

- **Caddy registra IP y user-agent en sus errores, no solo en el registro de acceso.** Quitar `log` del sitio no basta: comprobamos que, con la configuración por omisión de Caddy 2.11.8, un 502 escribe `remote_ip` y `User-Agent` en `http.log.error`. El `Caddyfile` excluye esos registros, y la prueba lo comprueba deteniendo el backend.
- **Caddy reenvía la IP al backend por omisión** en `X-Forwarded-For`. Se quitan esa cabecera, sus variantes y el `User-Agent`, de modo que lo que está detrás nunca los recibe.
- **Next.js envía telemetría por omisión.** Se apaga al construir y al ejecutar, y la red interna impediría la salida de todos modos.
- **`pg_dump` muestra las columnas binarias en hexadecimal.** Un relato guardado sin sellar en una columna `bytea` no aparecería como texto. Por eso la búsqueda incluye las formas hexadecimal y base64.

## 8. Mejoras futuras

- **Servicio .onion.** Publicar el buzón como servicio de Tor eliminaría la exposición de la IP ante el servidor y dificultaría al observador de red saber que se usa el buzón. El sitio ya funciona sin terceros, lo que facilita esa ruta. **Pendiente de verificar** su funcionamiento con Tor Browser en nivel de seguridad "Más seguro", porque Argon2id usa WebAssembly.
- **Rellenado de tamaño y envío diferido** para reducir la información que deja el volumen del tráfico y el momento del envío.
- **Compilaciones reproducibles y verificación de la versión desplegada**, para acotar el compromiso del frontend.
- **Escaneo antimalware** de evidencias (HU-19).
- **Sellado de evidencias en el navegador**, para cerrar la ventana en que el servidor las ve, a cambio de no poder verificarlas allí.
