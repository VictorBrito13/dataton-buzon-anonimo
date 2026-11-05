# Reporte de las pruebas de anonimato

Generado por `npm run test:anonimato`. No se edita a mano.

- **Fecha:** 2026-11-05
- **Commit:** `8959207`
- **Resultado de la corrida:** passed

| Aprobadas | Fallidas | Pendientes (fixme) | Omitidas | Total |
|---|---|---|---|---|
| 44 | 0 | 0 | 0 | 44 |

Ninguna prueba queda pendiente ni omitida: todas corren contra el despliegue real.

## como-te-protegemos.spec.ts

| Prueba | Estado | Evidencia |
|---|---|---|
| Página /como-te-protegemos › responde las preguntas del público y distingue lo pendiente | Aprobada |  |
| Página /como-te-protegemos › declara que la salida rápida abre un sitio ajeno y qué borra | Aprobada |  |
| Página /como-te-protegemos › sin fallas de accesibilidad WCAG A y AA en modo light | Aprobada | axe-core: 22 reglas aprobadas, 0 violaciones |
| Página /como-te-protegemos › sin fallas de accesibilidad WCAG A y AA en modo dark | Aprobada | axe-core: 22 reglas aprobadas, 0 violaciones |
| Página /como-te-protegemos › funciona a 320 px de ancho, sin desplazamiento horizontal | Aprobada |  |

## controles.spec.ts

| Prueba | Estado | Evidencia |
|---|---|---|
| Controles de los detectores › la grabadora detecta una petición a un tercero | Aprobada | Detectó https://tercero.invalid/rastreo.png |
| Controles de los detectores › el buscador detecta un secreto en claro y codificado | Aprobada |  |
| Controles de los detectores › antes y después: un Caddy con bitácora de acceso sí registra IP y user-agent | Aprobada | Con `log` activado, Caddy guarda el user-agent marcador y remote_ip. El despliegue real no lo hace: ver despliegue.spec.ts. |

## despliegue.spec.ts

| Prueba | Estado | Evidencia |
|---|---|---|
| Cabeceras de seguridad › página /: CSP estricta, HSTS, no-referrer y sin X-Powered-By | Aprobada | script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval' |
| Cabeceras de seguridad › página /como-te-protegemos: CSP estricta, HSTS, no-referrer y sin X-Powered-By | Aprobada | script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval' |
| Cabeceras de seguridad › API: HSTS, no-referrer y sin X-Powered-By | Aprobada |  |
| Cabeceras de seguridad › archivos estáticos: HSTS y sin servidor identificado | Aprobada |  |
| Cabeceras de seguridad › HTTP redirige a HTTPS | Aprobada |  |
| Páginas públicas › /: cero terceros, sin cookies, sin almacenamiento y sin violar la CSP | Aprobada | 8 peticiones observadas, todas al propio dominio |
| Páginas públicas › /como-te-protegemos: cero terceros, sin cookies, sin almacenamiento y sin violar la CSP | Aprobada | 8 peticiones observadas, todas al propio dominio |
| Páginas públicas › /denunciar: cero terceros, sin cookies, sin almacenamiento y sin violar la CSP | Aprobada | 13 peticiones observadas, todas al propio dominio |
| Páginas públicas › /seguimiento: cero terceros, sin cookies, sin almacenamiento y sin violar la CSP | Aprobada | 10 peticiones observadas, todas al propio dominio |
| Páginas públicas › /tablero: cero terceros, sin cookies, sin almacenamiento y sin violar la CSP | Aprobada | 9 peticiones observadas, todas al propio dominio |
| Infraestructura › Postgres no publica ningún puerto | Aprobada |  |
| Infraestructura › solo Caddy publica puertos | Aprobada |  |
| Infraestructura › backend: usuario no root | Aprobada |  |
| Infraestructura › frontend: usuario no root | Aprobada |  |
| Infraestructura › caddy: usuario no root | Aprobada |  |
| Infraestructura › db: sistema de archivos de solo lectura y sin privilegios nuevos | Aprobada |  |
| Infraestructura › backend: sistema de archivos de solo lectura y sin privilegios nuevos | Aprobada |  |
| Infraestructura › frontend: sistema de archivos de solo lectura y sin privilegios nuevos | Aprobada |  |
| Infraestructura › caddy: sistema de archivos de solo lectura y sin privilegios nuevos | Aprobada |  |
| Infraestructura › backend y frontend no tienen salida a internet | Aprobada |  |
| Bitácoras y base de datos › las bitácoras no guardan IP ni user-agent, incluso con errores 404 y 502 | Aprobada | 74 líneas revisadas; sin 203.0.113.77, sin la IP del anfitrión (172.29.0.1) y sin el user-agent marcador |
| Bitácoras y base de datos › el volcado de pg_dump incluye los datos, así que buscar en él sí significa algo | Aprobada |  |
| Bitácoras y base de datos › el rol de la API pública no acepta la contraseña de desarrollo y no lee denuncias | Aprobada |  |
| Bitácoras y base de datos › el esquema no tiene columnas de IP ni de user-agent | Aprobada |  |
| Marcadores › el navegador marcado envía de verdad los marcadores que se buscan | Aprobada |  |

## flujo.spec.ts

| Prueba | Estado | Evidencia |
|---|---|---|
| Flujo de denuncia › el flujo se completó y envió la denuncia | Aprobada |  |
| Flujo de denuncia › ningún request sale a un dominio distinto del propio | Aprobada | 21 peticiones observadas |
| Flujo de denuncia › la frase y el relato no aparecen en cuerpo, URL ni cabeceras | Aprobada |  |
| Flujo de denuncia › sin cookies ni almacenamiento local si no se activó el borrador | Aprobada |  |
| Flujo de denuncia › pg_dump no contiene relato, frase, folio ni IP de prueba | Aprobada |  |
| Flujo de denuncia › las bitácoras de backend y Caddy no contienen IP ni user-agent | Aprobada |  |

## tablero.spec.ts

| Prueba | Estado | Evidencia |
|---|---|---|
| Tablero con datos de demostración › el servicio de demostración publica trimestres y los marca como sintéticos | Aprobada | 5 trimestres publicados; el más reciente, 2026-T3, con k = 5 |
| Tablero con datos de demostración › el tablero muestra el trimestre y avisa que las denuncias son sintéticas | Aprobada |  |
| Tablero con datos de demostración › ninguna celda publicada vale entre 1 y k − 1, en ninguna tabla ni descarga | Aprobada | 3476 celdas en 10 tablas; 765 ocultas y ninguna publicada entre 1 y 4 |
| Tablero con datos de demostración › los indicadores de un ente con alguna etapa oculta no traen porcentajes, tiempos ni señal | Aprobada | 8 entes; 8 con alguna etapa oculta y sin derivados |
| Tablero con datos de demostración › el generador se niega sin la bandera de demostración, aunque corra en la misma imagen | Aprobada |  |
