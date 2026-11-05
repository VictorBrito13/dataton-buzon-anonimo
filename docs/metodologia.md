# Metodología

Cómo se construyó el buzón, con qué tecnologías y cómo se comprueba. Para levantarlo, ver la [guía de réplica](./guia-de-replica.md).

## 1. Problema y enfoque

Una denuncia "anónima" puede dejar de serlo por detalles técnicos: una bitácora con IP, un recurso de terceros, los metadatos de una foto o el propio texto. El miedo a las represalias reduce las denuncias.

Este proyecto mejora una parte concreta del S5, el **eje obligatorio de confidencialidad y anonimato**, y complementa el sistema con transparencia pública sobre su seguimiento. Es un aporte sobre la versión de pruebas, no un reemplazo. La [investigación del S5 y de la PDN](./investigacion-s5-pdn.md) documenta lo observado, la correspondencia de campos y las preguntas abiertas.

El enfoque responde a lo que SESNA señaló en el [taller para la explotación de datos de la PDN](./investigacion-s5-pdn.md#qué-valora-sesna-taller-subtítulos-automáticos-marcas-aproximadas):

| Lo que SESNA valora                                  | Cómo se atiende                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Mejora verificable de una parte (~01:10:52)          | Cada garantía tiene una prueba: [modelo de amenazas](./modelo-de-amenazas.md)          |
| Identidad protegida desde el diseño (~01:10:52)      | Lo que no se recolecta no se puede filtrar: sin cuentas, IP ni terceros                |
| Datos permitidos o sintéticos (~01:10:52)            | Solo datos sintéticos; de la PDN, solo conteos por institución                         |
| Replicable en local, sin costo y con herramientas libres (~01:19:13) | Un comando, sin cuentas ni servicios de pago: [guía de réplica](./guia-de-replica.md) |

## 2. Principios

1. **Minimizar:** no recolectar lo que no se necesita.
2. **Local primero:** el análisis del texto y la limpieza de archivos ocurren en el dispositivo.
3. **Sin terceros:** ni scripts, ni fuentes, ni captchas, ni analítica externos.
4. **Verificable:** cada afirmación debe poder comprobarse. Lo no comprobado se marca como **Pendiente de verificar**.

## 3. Proceso

### Del problema a las decisiones

1. Análisis de las bases y de la versión de pruebas del S5.
2. Propuesta y requerimientos: [`buzon-anonimo-propuesta.md`](./buzon-anonimo-propuesta.md) y [`plan-desarrollo-buzon-anonimo.md`](./plan-desarrollo-buzon-anonimo.md).
3. Decisiones de arquitectura, reversibles por PR: [`decisiones-arquitectura.md`](./decisiones-arquitectura.md).
4. Modelo de amenazas: [`modelo-de-amenazas.md`](./modelo-de-amenazas.md).

### TDD y DDD (D10)

- **TDD:** toda regla de negocio nace de una prueba que falla, se implementa lo mínimo y luego se refactoriza.
- **DDD:** el lenguaje del dominio es el de los catálogos (denuncia, folio, frase, etapa, sello, agregado, ente). Los contextos delimitados son recepción y acceso, evidencias, trámite, transparencia y privacidad en el cliente.
- **Capas:** `infraestructura` → `aplicacion` → `dominio`. El dominio no conoce Express, `pg` ni variables de entorno.

### Barrera de calidad

Cada PR hacia `dev`, `main` o `feat/**` pasa por [GitHub Actions](../.github/workflows/ci.yml). El check `ci-ok` agrega los trabajos requeridos:

| Trabajo      | Comprueba                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| `calidad`    | Sin terceros ni lectura de IP; dependencias entre capas; build; tipos; lint; formato                      |
| `pruebas`    | Migraciones y pruebas contra PostgreSQL; cobertura mínima del dominio (85 % en líneas, 80 % en ramas)     |
| `imagenes`   | Construcción de las imágenes Docker                                                                       |
| `playwright` | Pruebas de anonimato contra el despliegue real y demás suites E2E                                         |
| `tablero`    | Tablero contra la API real, con datos sintéticos agregados                                                |
| `auditoria`  | `npm audit --audit-level=high`, informativo: no bloquea                                                   |

Las acciones de GitHub están fijadas por SHA, y las imágenes de Docker, por versión.

## 4. Tecnologías

Todas son libres o de código abierto y no requieren pago ni cuentas.

| Capa                 | Tecnología                                       | Motivo                                                  |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| Frontend             | Next.js 16, React 19, Tailwind CSS 4             | Render dinámico compatible con CSP por nonce (D7)       |
| Backend              | Node.js, Express 5, TypeScript                   | Tipos compartidos con el frontend                       |
| Contratos            | Zod, en `@dataton/shared`                        | Una sola fuente de esquemas y catálogos                 |
| Base de datos        | PostgreSQL 17                                    | Sin columnas de IP, user-agent ni hora en denuncias     |
| Credenciales         | Argon2id en el navegador; HMAC-SHA-256 con pimienta | Búsqueda determinista sin guardar la frase (D1)      |
| Sellado              | ECDH P-256, HKDF-SHA-256, AES-256-GCM (WebCrypto) | El servidor no puede abrir los relatos (D3)            |
| Prueba de trabajo    | Altcha, autoalojado (integración pendiente de verificar) | Frenar abuso sin un captcha de terceros |
| Despliegue           | Docker Compose, Caddy 2                          | Un comando, HTTPS local, sin bitácora de peticiones     |
| Pruebas              | Vitest, Playwright, axe-core, `node:test`        | Unidad, navegador real y accesibilidad                  |
| Asistencia de IA     | Ver [`uso-de-ia.md`](./uso-de-ia.md)             | Declaración exigida por las bases                       |

## 5. Datos

- **Denuncias:** solo sintéticas. No se envían denuncias al entorno de pruebas del S5 sin autorización de SESNA.
- **PDN:** para la explotación de datos se usan S3, S6, Cobertura y los catálogos del prototipo. Las fuentes, consultas y limitaciones están en la [investigación](./investigacion-s5-pdn.md) y no se repiten aquí. Solo se versionan conteos por institución, nunca registros individuales. Son señales para priorizar revisión, no conclusiones (D8).
- **Datos abiertos:** agregados protegidos con k-anonimato (D6). **Pendiente de verificar** al integrar el módulo de datos.

## 6. Cómo se demuestra el anonimato

Las pruebas corren contra el despliegue real, no contra un servidor de desarrollo:

1. `e2e/anonimato/` levanta el `docker-compose.yml` completo.
2. Un navegador real recorre el sitio con marcadores: una IP de un rango reservado para documentación y un user-agent único.
3. Se registra todo lo que sale del navegador y se revisan el volcado de la base y las bitácoras de cada servicio.
4. **Controles:** otras pruebas confirman que los detectores detectan. Por ejemplo, un Caddy con bitácora activada sí registra el marcador, que es el "antes" frente al despliegue real.
5. El resultado se escribe en [`evidencia/reporte-anonimato.md`](./evidencia/reporte-anonimato.md). Las pruebas que dependen de funciones aún no integradas aparecen como pendientes, no como aprobadas.

Para quien no programa, [`/como-te-protegemos`](../apps/frontend/dashboard/app/como-te-protegemos/page.tsx) lo explica en lenguaje claro y enseña a comprobarlo con el navegador.

## 7. Uso de IA

La declaración completa, con finalidad y alcance, está en [`uso-de-ia.md`](./uso-de-ia.md).

## 8. Limitaciones

- **Prototipo:** no llega a ninguna autoridad (D9).
- Los límites de privacidad están en el [modelo de amenazas](./modelo-de-amenazas.md#5-límites-honestos).
- El estado de cada base y criterio está en [`cumplimiento-bases.md`](./cumplimiento-bases.md).
