# Investigación: S5 de pruebas y datos de la PDN

Consulta del 4 de noviembre de 2026. Solo se hicieron lecturas anónimas: no se iniciaron sesiones ni se
enviaron denuncias. **Comprobado** significa que se probó contra el servicio; **leído en el JS** significa que
se dedujo del código público del prototipo y puede cambiar.

## Versión de pruebas del S5

- **URL:** <https://dev-denuncias.plataformadigitalnacional.org/>, publicada en el
  [informe PIENS de SESNA, avance 2026](https://www.sesna.gob.mx/wp-content/uploads/2026/08/47-PIENS-SESNA-2025-2030-Avance-2026.pdf), p. 8.
- **Acceso ciudadano:** sin credenciales (comprobado). El módulo institucional requiere sesión.
- **Documentación de la API y código fuente:** no encontrados. `PDNMX/api_docs` no incluye el S5.

| Endpoint público | Estado | Resultado |
|---|---|---|
| `GET /next-api/public/catalogos?catalog=entidades` | Comprobado | 33 registros |
| `GET /next-api/public/catalogos?catalog=municipios` | Comprobado | 2,478 registros |
| `GET /next-api/public/catalogos?catalog=faltas` | Comprobado | 3,559 registros por entidad, con ley y artículo |
| `GET /next-api/public/estadisticas` | Comprobado | Métricas agregadas |
| `POST /next-api/public/denuncias`, `/evidencias`, `/seguimiento` | Leído en el JS | Sin probar: no se envían datos sin autorización de SESNA |

**Formulario (leído en el JS):** asistente de 5 pasos con anonimato, hecho, persona, relato, y pruebas y envío.
Hasta 5 archivos de 20 MB y 100 MB en total. ALTCHA como verificación. Borrador local de 24 horas.

## Lo que aporta este proyecto al prototipo

SESNA presentó el prototipo como una base y pidió partir de un problema concreto con una mejora verificable.

| Aspecto | Prototipo (lo observado) | Este proyecto |
|---|---|---|
| Búsqueda de lugar | Geocodificación mediante Mapbox (leído en el JS) | Selectores locales, sin terceros |
| Búsqueda de institución | Consulta al servicio de Cobertura | Catálogo servido desde el mismo origen |
| Cabeceras en `/` | Sin CSP ni HSTS detectadas en la versión de pruebas (comprobado solo en `/`) | CSP por nonce y HSTS, con prueba automática |
| Depuración del relato | No vista en el JS; podría existir en el servidor | Depurador local por capas |
| Metadatos de evidencias | No vista en el JS; podría existir en el servidor | Limpieza en el dispositivo y en el servidor |
| Acceso | Folio y secreto de seguimiento | Folio o frase de 6 palabras, derivada en el dispositivo |
| Lectura por la institución | Al aceptar ve todo el contenido | Relatos sellados que el servidor no puede abrir |
| Clasificación | Reglas y catálogo, orientativa | Orientador en lenguaje común, también orientativo |

## Correspondencia con los campos del S5

Los campos del S5 se leyeron en su JS, sin diccionario de datos oficial, por lo que pueden cambiar. Esta tabla
indica cómo se conectaría este proyecto al S5 y qué falta resolver con SESNA.

**Estado de la conexión en el código.** `AdaptadorS5` (`apps/backend/src/contextos/denuncias/aplicacion/puerto-s5.ts`)
tiene las lecturas públicas comprobadas (`catalogo`, `estadisticas`) y un envío diseñado pero bloqueado. El flujo de
denuncia no lo invoca: hoy la tabla siguiente es una correspondencia documental, no un mapeo que se ejecute. Las
lecturas reales se usan en `scripts/pdn/regenerar-instantaneas.mts` para el catálogo de municipios; los catálogos de
`apps/frontend/dashboard/public/catalogos/` se generaron a partir de las mismas respuestas el 2026-11-04
(`fuente.json` ahí mismo). La correspondencia de etapas con el trámite del S5 está en el
[README del backend](../apps/backend/README.md#correspondencia-de-etapas-con-el-trámite-del-s5).

| Este proyecto | Campo del S5 | Situación |
|---|---|---|
| Sin datos de contacto | `denunciante.anonimo` = verdadero | Compatible. No se ofrece la denuncia identificada del S5 |
| `estado`, `municipio` | `ubicacionHecho.estado`, `ciudad` | Compatible, con catálogos del S5 |
| Periodo aproximado, dentro del relato sellado | `ubicacionHecho.fechaHecho` (obligatoria) | **Diferencia:** la fecha exacta puede identificar a quien denuncia |
| `enteId` | `personaDenunciada.entePublico` | Compatible, con catálogo de Cobertura |
| `tipoFalta` | `faltaCometida.{faltaGrave,faltaNoGrave,hechosCorrupcion}` | Compatible por categoría; el S5 detalla por ley y artículo |
| `relatoSellado` | `narracionHechos` | **Diferencia:** el S5 espera texto claro; integrarlo requiere abrir el sello en el lado institucional |
| Evidencias selladas | `archivosEvidencia` | **Diferencia:** igual que el relato |
| Frase y folio | Folio y `trackingSecret` | Convivirían: la frase protege el acceso en el dispositivo |

## Qué valora SESNA (taller, subtítulos automáticos, marcas aproximadas)

Video: [Taller para la explotación de datos de la PDN](https://www.youtube.com/live/k9o__B38Kg4).

- ~01:10:52: partir de un problema concreto, mostrar una mejora verificable, proteger la identidad desde el
  diseño y usar solo datos permitidos o sintéticos.
- ~01:15:18: catálogos de faltas y de entes para orientar a quien denuncia.
- ~01:18:07: la clasificación usa reglas, es orientativa y se presenta como oportunidad de innovación.
- ~01:19:13: replicable en local, sin costo y con herramientas libres.
- ~01:20:55: basta mejorar una parte o complementar el sistema.

## Datos abiertos

Base: `https://api.plataformadigitalnacional.org`, sin credenciales.

| Sistema | Consulta comprobada | Resultado |
|---|---|---|
| S6 | `GET /s6/api/v1/summary` | 1,060,983 procedimientos y 408 instituciones, con ciclos de 2015 a 2021 |
| S6 | `POST /s6/api/v1/search` con `{"buyer_name":"…","page":0,"pageSize":1}` | Conteo por institución en `pagination.total` |
| S3 | `GET /s3-wrapper/api/v1/providers` | 23 proveedores |
| S2 | `GET /s2/api/v0/getTotalInstituciones` | 273 instituciones |
| Cobertura | `https://cobertura.plataformadigitalnacional.org/directus/items/entes?limit=-1` | 10,144 entes, sin datos de personas |

Limitaciones para el cruce por ente:

- `buyer_id` no filtra en S6, y `buyer_name` es una expresión regular, por lo que un nombre contenido en otro
  infla el conteo.
- S3 cubre 22 estados más el IFT, sin un proveedor federal general, con nombres sin normalizar.
- SESNA advierte de homónimos: estos cruces son prueba de concepto, no conclusiones.
- **Este proyecto solo versiona conteos por institución, nunca registros individuales.**

## Pendientes con SESNA

1. ¿Hay cuenta de prueba del módulo institucional para participantes?
2. ¿Se pueden enviar denuncias de prueba a `dev-denuncias`?
3. ¿Cuál es la licencia de los catálogos de faltas y de entes?
