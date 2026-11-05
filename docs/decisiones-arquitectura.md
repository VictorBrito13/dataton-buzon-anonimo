# Decisiones de arquitectura

Complementa a [`buzon-anonimo-propuesta.md`](./buzon-anonimo-propuesta.md) y a
[`plan-desarrollo-buzon-anonimo.md`](./plan-desarrollo-buzon-anonimo.md). Cuando haya diferencias,
manda este documento. Cada decisión se puede revertir por PR si el equipo no está de acuerdo.

## Ajustes a la propuesta

| # | La propuesta o el plan decía | Problema | Decisión |
|---|---|---|---|
| D1 | Identificador de la frase con Argon2id en el servidor | Argon2 con sal aleatoria no permite buscar por frase; el servidor tendría que probar cada fila | Argon2id **en el navegador** con sal fija por versión, y HMAC con pimienta en el servidor |
| D2 | Folio como acceso principal, sin definir su formato | Un folio corto se adivina y da acceso a la denuncia | Folio de **80 bits** (`BZ-XXXX-XXXX-XXXX-XXXX`), guardado solo como HMAC y mostrado una vez |
| D3 | Evidencias cifradas en reposo con clave del servidor | El operador puede leer todo; no protege la etapa de trámite | **Sellado con la clave pública de la autoridad**: el servidor no puede abrir relatos ni evidencias |
| D4 | Supresión complementaria "por total" | Quedan fugas: total estatal menos municipios visibles, y resta entre periodos | Reglas endurecidas (D6) y pruebas que ejecutan cada ataque |
| D5 | Datos de la PDN solo vía S5 | El criterio 4 evalúa la explotación de datos de la PDN y el criterio 2 la priorización de riesgos | Cruce de agregados por ente con otros sistemas de la PDN (D8) |

## D1 y D2. Acceso sin cuenta

```text
Navegador                                     Servidor
frase (66 bits, 6 palabras BIP39 español)
  └─ Argon2id(m=19 MiB, t=2, sal fija) ─ accesoId ─▶ HMAC-SHA-256(pimienta, accesoId) ─▶ acceso_hmac
                                                     folio aleatorio (80 bits)
                                        ◀─ folio ─── HMAC-SHA-256(pimienta, folio) ───▶ folio_hmac
```

- La frase nunca sale del navegador. Una prueba E2E lo verifica interceptando el tráfico.
- Argon2id encarece el ataque en el cliente; en el servidor basta HMAC porque la entrada ya tiene
  al menos 66 bits de entropía. La pimienta vive fuera de la base de datos, por lo que un volcado
  no permite comprobar frases ni folios.
- La sal es fija porque la búsqueda debe ser determinista. Es aceptable por la entropía de la frase.
- Sin sesión para quien denuncia: la credencial viaja en el cuerpo de cada `POST`, nunca en la URL.
- Toda falla devuelve el mismo `401 ERROR_ACCESO`, con tiempo de respuesta mínimo fijo.
- **Límite de intentos sin IP:** prueba de trabajo por petición, contador en memoria por HMAC de la
  credencial y límite global. Con 66 y 80 bits, la fuerza bruta por ID no es viable.
- `apps/backend/src/security/argon2.ts` queda solo para las contraseñas del panel de autoridad.

## D3. Sellado para la autoridad

Implementado en `packages/shared/src/sello.ts` (ECDH P-256, HKDF-SHA-256, AES-256-GCM, WebCrypto).

| Dato | Quién lo sella | ¿Quién lo lee? |
|---|---|---|
| Relato y personas involucradas | El navegador | Solo la autoridad |
| Evidencias | El servidor, tras verificar tipo y metadatos, y descarta el original | Solo la autoridad |
| Mensajes del denunciante | El navegador | Solo la autoridad |
| Mensajes de la autoridad | Cifrado en reposo con clave del servidor | El denunciante, con su credencial |
| Estado, municipio, tipo de falta, ente, etapa | Sin sellar: alimentan el tablero | Sistema y autoridad |

**Límite honesto:** el servidor ve las evidencias durante su verificación, por lo que esa etapa
depende de confiar en el código publicado. La clave privada se carga en el navegador de la
autoridad y no se guarda en el servidor.

## D6. k-anonimato

Reglas del motor (k inicial = 5, configurable):

1. Celdas con `0 < conteo < k` se suprimen. Los ceros se publican: no identifican a nadie.
2. En cada fila y columna con supresiones, deben quedar **al menos dos celdas suprimidas y su suma
   debe ser ≥ k**. Si no, se suprime además la celda publicada más pequeña.
3. La misma regla aplica entre niveles: municipios de un estado contra el total estatal.
4. Los totales se publican solo si no permiten deducir ninguna celda.
5. Máximo dos dimensiones por consulta. Cortes por **trimestre cerrado**, nunca acumulados móviles,
   para impedir la resta entre publicaciones. Rezago configurable (inicial: 14 días tras el cierre).
6. Nunca se publica nada sobre la persona denunciada.
7. El tablero solo lee `agregados_publicos`, con un rol de base de datos sin acceso a `denuncias`.

Pruebas obligatorias: ataque por resta en fila, columna, entre niveles y entre periodos.

## D7. Sin terceros, comprobable

- CSP por nonce en `apps/frontend/dashboard/proxy.ts`. Exige render dinámico, por eso `layout.tsx`
  llama a `connection()` y no se usa PPR ni `cacheComponents`.
- La CSP bloquea estilos inline: nada de atributos `style=`. Los SVG usan atributos de presentación
  o clases. Esto excluye librerías de gráficas que inyectan estilos.
- Solo fuentes del sistema (se retiró `next/font/google`).
- Frontend y API comparten origen mediante `rewrites`.
- **Evidencia, no promesa:** la página `/como-te-protegemos` enlaza a las pruebas E2E que demuestran
  cero dominios externos, ninguna IP guardada y frase nunca transmitida.

## D8. Priorización con datos de la PDN

Indicadores por ente que combinan denuncias agregadas (con k aplicado) con conteos públicos de
otros sistemas de la PDN. Son **señales para priorizar revisión, nunca acusaciones**: solo conteos
por institución, sin nombres de personas, y con la metodología publicada.

Fuentes confirmadas en [`investigacion-s5-pdn.md`](./investigacion-s5-pdn.md): S3 (sanciones), S6
(contrataciones hasta 2021) y Cobertura (entes). Se versionan instantáneas agregadas: el sitio no llama a
la PDN en tiempo de ejecución. El acceso al S5 pasa por `AdaptadorS5`; sus lecturas públicas están
comprobadas y **no se envían denuncias al entorno de pruebas** sin autorización de SESNA.

## D9. Prototipo responsable

Aviso permanente de que no se envíen denuncias reales (`components/aviso-prototipo.tsx`): las bases
prohíben datos reales y esta versión no llega a ninguna autoridad.

## D10. TDD y DDD

**TDD:** toda regla de negocio nace de una prueba que falla. Se corre en rojo, se implementa lo mínimo
para pasar a verde y luego se refactoriza. Los commits muestran pruebas junto con su implementación.

**DDD:** el lenguaje ubicuo es el de los catálogos (denuncia, folio, frase, etapa, sello, agregado, ente).
Contextos delimitados:

| Contexto | Responsabilidad | Ubicación |
|---|---|---|
| Recepción y acceso | Crear denuncias, credenciales, seguimiento | `apps/backend/src/contextos/denuncias` |
| Evidencias | Verificar, limpiar y sellar archivos | `apps/backend/src/contextos/evidencias` |
| Trámite | Etapas, mensajes, bitácora de la autoridad | `apps/backend/src/contextos/tramite` |
| Transparencia | k-anonimato, agregados, datos abiertos | `apps/backend/src/contextos/transparencia` |
| Privacidad en el cliente | Depurador y limpieza de archivos | `apps/frontend/dashboard/lib/privacidad` |

Cada contexto del backend se divide en:

- `dominio/`: entidades, objetos de valor y reglas. **Sin Express, `pg` ni variables de entorno**;
  se prueba sin base de datos.
- `aplicacion/`: casos de uso que orquestan el dominio y dependen de puertos (interfaces).
- `infraestructura/`: repositorios con `pg`, rutas HTTP y adaptadores (S5 incluido).

Las dependencias apuntan hacia adentro: `infraestructura` → `aplicacion` → `dominio`. Las reglas
como `TRANSICIONES` o el umbral k viven en el dominio, no en rutas ni en SQL.

**Definición de terminado de un PR:** `npm run build`, `npm run typecheck`, `npm run lint`,
`npm run format:check` y `npm test` en verde, con la CI de GitHub en verde.

## Convenciones

- **Contratos:** `@dataton/shared` es la única fuente de esquemas y catálogos.
- **Migraciones:** archivos numerados en `apps/backend/migrations`. Nunca editar una ya publicada.
- **Datos ligados a una denuncia:** sin IP, user-agent ni hora, solo el día.
- **Instalación:** usar `npm ci`. Evitar dependencias nuevas; las previstas ya están instaladas.
- **Idioma:** dominio y textos en español; textos para el público en lenguaje claro.
