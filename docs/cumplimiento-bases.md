# Cumplimiento de las bases

Matriz de las bases de la [convocatoria](./convocatoria-bases-dataton-2026.pdf) y de sus criterios de evaluación, con su evidencia y su **estado real**. Se actualiza al integrar cada módulo.

**Estados:**

- **Cumple:** hay evidencia comprobada en el repositorio.
- **Parcial:** parte está comprobada; se indica qué falta.
- **Pendiente de verificar:** depende de un módulo aún sin integrar o de una acción aún no realizada.
- **Del equipo:** depende de información o de acciones que el repositorio no puede demostrar.

Última revisión: 5 de noviembre de 2026, en la rama `fix/auditoria-final`, con todos los módulos integrados en `dev`.

## Bases

| Base                  | Requisito                                                 | Estado                 | Evidencia                                                                                                                  |
| --------------------- | --------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Segunda               | Equipo de máximo cinco, con representante                 | Del equipo             | Formulario de inscripción. El plan prevé cinco personas                                                                    |
| Segunda               | Al menos una persona con disponibilidad de viajar a CDMX  | Del equipo             | Por confirmar por el equipo                                                                                                |
| Tercera               | Proyecto original, no concursando ni premiado en otro lado | Del equipo            | Por confirmar por el equipo                                                                                                |
| Cuarta                | Entrega el 13 de noviembre, a las 23:59                   | Pendiente de verificar | Calendario en [`plan-desarrollo-buzon-anonimo.md`](./plan-desarrollo-buzon-anonimo.md#6-calendario)                        |
| Cuarta                | Presentación el 17 y 18 de noviembre                      | Pendiente de verificar | Mismo calendario                                                                                                           |
| Quinta                | Fortalecer el S5 con solución de código abierto           | Parcial                | [Investigación del S5](./investigacion-s5-pdn.md), [metodología](./metodologia.md) y flujo completo integrado. Es una propuesta sobre la versión de pruebas: el `AdaptadorS5` existe con lecturas comprobadas, pero el flujo no envía al S5 ([README](../README.md#relación-con-el-s5)) |
| Quinta (obligatorio)  | Confidencialidad y anonimato en recepción, trámite y seguimiento | Cumple, con límites declarados | [Modelo de amenazas](./modelo-de-amenazas.md) y [reporte](./evidencia/reporte-anonimato.md): el flujo de denuncia, el seguimiento y el tablero corren contra el despliegue real. Los límites (salida rápida hacia Google, rastros internos del volcado, contenido visible y texto oculto de las evidencias) están en la sección 5 del modelo |
| Sexta                 | Licencia CC BY-NC                                         | Cumple                 | [`LICENSE`](../LICENSE): CC BY-NC 4.0; `license` en cada `package.json`; titularidad y año en el [README](../README.md#licencia-y-titularidad); lo ajeno en [`AVISOS-TERCEROS.md`](../AVISOS-TERCEROS.md) |
| Sexta                 | Público, con código y documentación en repositorio abierto | Cumple                | Repositorio público en GitHub, comprobado el 4 de noviembre de 2026                                                        |
| Sexta                 | Sin código malicioso                                      | Cumple, con `npm audit` informativo | [`verificar-sin-terceros.mjs`](../scripts/verificar-sin-terceros.mjs) y CI; las evidencias se validan por tipo real, se limpian y se sellan (`test/integracion/flujo.test.ts`); `npm audit --audit-level=high` corre en CI sin bloquear |
| Sexta                 | Sin datos personales sensibles, reservados ni confidenciales | Cumple              | Decisión D9 y aviso en la interfaz. Denuncias solo sintéticas (`docker compose run --rm sintetico`, entes ficticios); de la PDN se versionan solo conteos por institución, nunca registros ([avisos](../AVISOS-TERCEROS.md#fuentes-de-datos)) |
| Sexta                 | Declarar el uso de IA, finalidad y alcance                | Cumple                 | [`uso-de-ia.md`](./uso-de-ia.md): Claude Code en el desarrollo; modelo NER local, opcional e integrado en la revisión de `/denunciar` |
| Sexta, producto 1     | Presentación ejecutiva con evidencia de funcionamiento    | Pendiente de verificar | Aún no está en el repositorio                                                                                              |
| Sexta, producto 2     | Repositorio con lo necesario para reproducir              | Cumple                 | [`docker-compose.yml`](../docker-compose.yml) y [guía de réplica](./guia-de-replica.md), con datos de demostración en un comando. Falta que una persona ajena al equipo la siga, y probar Docker en Windows |
| Sexta, producto 3     | Documentación de metodología y tecnologías                | Cumple                 | [`metodologia.md`](./metodologia.md), [`guia-de-replica.md`](./guia-de-replica.md), [`decisiones-arquitectura.md`](./decisiones-arquitectura.md) |
| Sexta, descalificación | Presentar en tiempo y forma; conducta apropiada          | Del equipo             | Por atender por el equipo                                                                                                  |
| Décima segunda        | Aceptar CC BY-NC; ceder uso y modificación a SESNA si se gana | Del equipo         | Licencia aplicada; la aceptación corresponde al equipo                                                                     |

## Criterios de evaluación (base Octava)

| #   | Criterio                                   | Estado                 | Evidencia                                                                                                                                                  | Falta                                                                     |
| --- | ------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Confidencialidad y protección de identidad | Cumple, con límites declarados | [Modelo de amenazas](./modelo-de-amenazas.md), [pruebas](../e2e/anonimato) y [reporte](./evidencia/reporte-anonimato.md) con el flujo real, frase, evidencias (foto con GPS y hoja de cálculo con ruta de usuario), `pg_dump` y tablero; [`/como-te-protegemos`](../apps/frontend/dashboard/app/como-te-protegemos/page.tsx) | Opción de salida rápida sin terceros (propuesta en el modelo, sección 8) |
| 2   | Valor público                              | Cumple                 | Tablero público con k-anonimato, indicadores por ente y datos abiertos, comprobado en el despliegue con datos sintéticos (`tablero.spec.ts`); D8 en [decisiones](./decisiones-arquitectura.md) | Validar los indicadores con una autoridad real                            |
| 3   | Funcionalidad técnica y operativa          | Cumple                 | Despliegue en un comando con datos de demostración: [`evidencia/despliegue-local.md`](./evidencia/despliegue-local.md). [CI](../.github/workflows/ci.yml) en cada PR y en `push` a `dev` y `main` | Docker Desktop en Windows sin comprobar por la CI                     |
| 4   | Explotación de datos de la PDN             | Parcial                | S3, S6, Cobertura y catálogos del prototipo en `/tablero` y `/api/v1/publico/pdn`, desde instantáneas versionadas con fecha y fuente; consultas en la [investigación](./investigacion-s5-pdn.md#datos-abiertos) | Cruce por nombre con homónimos: prueba de concepto, no conclusión; licencia de los catálogos pendiente con SESNA |
| 5   | Experiencia de usuario y accesibilidad     | Parcial                | axe-core sin violaciones WCAG A y AA en `/como-te-protegemos` y en el tablero (`tablero.spec.ts` del dashboard), en modo claro y oscuro; pruebas responsive y de zoom del texto; panel de autoridad con sus propias pruebas | Pruebas con personas usuarias reales                                     |
| 6   | Creatividad e innovación                   | Cumple                 | Anonimato con pruebas y controles reproducibles, frase en el dispositivo, sellado para la autoridad (D1, D3), depurador local con modelo opcional, k-anonimato con atacante que lee todos los canales públicos | —                                                                        |
| 7   | Calidad de la presentación                 | Pendiente de verificar | Sin material aún en el repositorio                                                                                                                         | Presentación y guion de demostración                                      |
| 8   | Calidad de la documentación                | Cumple                 | [Metodología](./metodologia.md), [guía de réplica](./guia-de-replica.md), [modelo de amenazas](./modelo-de-amenazas.md), [decisiones](./decisiones-arquitectura.md), [investigación](./investigacion-s5-pdn.md), [avisos de terceros](../AVISOS-TERCEROS.md) | Que un tercero siga la guía                                             |

## Lo que SESNA señaló en el taller

Marcas aproximadas de los subtítulos automáticos; el detalle está en la [investigación](./investigacion-s5-pdn.md#qué-valora-sesna-taller-subtítulos-automáticos-marcas-aproximadas).

| Señalamiento                                        | Estado  | Evidencia                                                                                           |
| --------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| Replicable en local, sin costo, herramientas libres (~01:19:13) | Cumple | Compose sin servicios de pago y datos de demostración en un comando: [guía de réplica](./guia-de-replica.md). Falta que un tercero la siga |
| Mejora verificable de una parte (~01:10:52)         | Cumple  | [Reporte de pruebas](./evidencia/reporte-anonimato.md) contra el despliegue real, con los límites a la vista en el [modelo](./modelo-de-amenazas.md#5-límites-honestos) |
| Identidad protegida desde el diseño (~01:10:52)     | Cumple  | [Modelo de amenazas](./modelo-de-amenazas.md); sin IP ni user-agent en esquema ni bitácoras, frase que no sale del dispositivo, relato sellado: todo comprobado en el despliegue |
