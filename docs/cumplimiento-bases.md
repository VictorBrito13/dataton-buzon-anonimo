# Cumplimiento de las bases

Matriz de las bases de la [convocatoria](./convocatoria-bases-dataton-2026.pdf) y de sus criterios de evaluación, con su evidencia y su **estado real**. Se actualiza al integrar cada módulo.

**Estados:**

- **Cumple:** hay evidencia comprobada en el repositorio.
- **Parcial:** parte está comprobada; se indica qué falta.
- **Pendiente de verificar:** depende de un módulo aún sin integrar o de una acción aún no realizada.
- **Del equipo:** depende de información o de acciones que el repositorio no puede demostrar.

Última revisión: 4 de noviembre de 2026, en la rama `feat/infra-pruebas-docs`.

## Bases

| Base                  | Requisito                                                 | Estado                 | Evidencia                                                                                                                  |
| --------------------- | --------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Segunda               | Equipo de máximo cinco, con representante                 | Del equipo             | Formulario de inscripción. El plan prevé cinco personas                                                                    |
| Segunda               | Al menos una persona con disponibilidad de viajar a CDMX  | Del equipo             | Por confirmar por el equipo                                                                                                |
| Tercera               | Proyecto original, no concursando ni premiado en otro lado | Del equipo            | Por confirmar por el equipo                                                                                                |
| Cuarta                | Entrega el 13 de noviembre, a las 23:59                   | Pendiente de verificar | Calendario en [`plan-desarrollo-buzon-anonimo.md`](./plan-desarrollo-buzon-anonimo.md#6-calendario)                        |
| Cuarta                | Presentación el 17 y 18 de noviembre                      | Pendiente de verificar | Mismo calendario                                                                                                           |
| Quinta                | Fortalecer el S5 con solución de código abierto           | Parcial                | [Investigación del S5](./investigacion-s5-pdn.md) y [metodología](./metodologia.md). Falta integrar el flujo               |
| Quinta (obligatorio)  | Confidencialidad y anonimato en recepción, trámite y seguimiento | Parcial          | [Modelo de amenazas](./modelo-de-amenazas.md) y [reporte](./evidencia/reporte-anonimato.md). Las pruebas del flujo están pendientes |
| Sexta                 | Licencia CC BY-NC                                         | Cumple                 | [`LICENSE`](../LICENSE): CC BY-NC 4.0                                                                                      |
| Sexta                 | Público, con código y documentación en repositorio abierto | Cumple                | Repositorio público en GitHub, comprobado el 4 de noviembre de 2026                                                        |
| Sexta                 | Sin código malicioso                                      | Parcial                | [`verificar-sin-terceros.mjs`](../scripts/verificar-sin-terceros.mjs) y CI. Validación de evidencias pendiente del módulo correspondiente; `npm audit` es informativo |
| Sexta                 | Sin datos personales sensibles, reservados ni confidenciales | Parcial             | Decisión D9 y aviso en la interfaz. Generador sintético y revisión de instantáneas de la PDN pendientes                    |
| Sexta                 | Declarar el uso de IA, finalidad y alcance                | Parcial                | [`uso-de-ia.md`](./uso-de-ia.md). Falta confirmar la integración del modelo NER en el flujo                                                            |
| Sexta, producto 1     | Presentación ejecutiva con evidencia de funcionamiento    | Pendiente de verificar | Aún no está en el repositorio                                                                                              |
| Sexta, producto 2     | Repositorio con lo necesario para reproducir              | Parcial                | [`docker-compose.yml`](../docker-compose.yml) y [guía de réplica](./guia-de-replica.md). Falta integrar todos los módulos  |
| Sexta, producto 3     | Documentación de metodología y tecnologías                | Parcial                | [`metodologia.md`](./metodologia.md), [`guia-de-replica.md`](./guia-de-replica.md). Se actualiza en la integración         |
| Sexta, descalificación | Presentar en tiempo y forma; conducta apropiada          | Del equipo             | Por atender por el equipo                                                                                                  |
| Décima segunda        | Aceptar CC BY-NC; ceder uso y modificación a SESNA si se gana | Del equipo         | Licencia aplicada; la aceptación corresponde al equipo                                                                     |

## Criterios de evaluación (base Octava)

| #   | Criterio                                   | Estado                 | Evidencia                                                                                                                                                  | Falta                                                                     |
| --- | ------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Confidencialidad y protección de identidad | Parcial                | [Modelo de amenazas](./modelo-de-amenazas.md), [pruebas](../e2e/anonimato) y [reporte](./evidencia/reporte-anonimato.md), [`/como-te-protegemos`](../apps/frontend/dashboard/app/como-te-protegemos/page.tsx) | Correr las pruebas del flujo, frase y `pg_dump` con el flujo integrado    |
| 2   | Valor público                              | Pendiente de verificar | [Propuesta](./buzon-anonimo-propuesta.md), D8 en [decisiones](./decisiones-arquitectura.md)                                                                | Tablero e indicadores por ente                                            |
| 3   | Funcionalidad técnica y operativa          | Parcial                | Despliegue en un comando: [`evidencia/despliegue-local.md`](./evidencia/despliegue-local.md). [CI](../.github/workflows/ci.yml)                            | Flujo completo integrado                                                  |
| 4   | Explotación de datos de la PDN             | Pendiente de verificar | S3, S6, Cobertura y catálogos del prototipo; consultas en la [investigación](./investigacion-s5-pdn.md#datos-abiertos)                                     | Instantáneas, cruces y datos abiertos del módulo de datos                 |
| 5   | Experiencia de usuario y accesibilidad     | Parcial                | axe-core sin violaciones WCAG A y AA en `/como-te-protegemos`, en modo claro y oscuro: [reporte](./evidencia/reporte-anonimato.md). Panel de autoridad con sus propias pruebas | Auditoría del flujo de denuncia, del seguimiento y del tablero            |
| 6   | Creatividad e innovación                   | Parcial                | Anonimato con pruebas y controles reproducibles, frase en el dispositivo, sellado para la autoridad (D1, D3)                                               | Depurador local y k-anonimato integrados                                  |
| 7   | Calidad de la presentación                 | Pendiente de verificar | Sin material aún en el repositorio                                                                                                                         | Presentación y guion de demostración                                      |
| 8   | Calidad de la documentación                | Parcial                | [Metodología](./metodologia.md), [guía de réplica](./guia-de-replica.md), [modelo de amenazas](./modelo-de-amenazas.md), [decisiones](./decisiones-arquitectura.md), [investigación](./investigacion-s5-pdn.md) | Actualizar estados en la integración; que un tercero siga la guía         |

## Lo que SESNA señaló en el taller

Marcas aproximadas de los subtítulos automáticos; el detalle está en la [investigación](./investigacion-s5-pdn.md#qué-valora-sesna-taller-subtítulos-automáticos-marcas-aproximadas).

| Señalamiento                                        | Estado  | Evidencia                                                                                           |
| --------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| Replicable en local, sin costo, herramientas libres (~01:19:13) | Parcial | Compose sin servicios de pago: [guía de réplica](./guia-de-replica.md). Falta que un tercero la siga |
| Mejora verificable de una parte (~01:10:52)         | Parcial | [Reporte de pruebas](./evidencia/reporte-anonimato.md), con lo pendiente a la vista                 |
| Identidad protegida desde el diseño (~01:10:52)     | Parcial | [Modelo de amenazas](./modelo-de-amenazas.md); esquema sin IP ni user-agent, comprobado             |
