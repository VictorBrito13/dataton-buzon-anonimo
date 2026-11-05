# Buzón Anónimo — Datatón Anticorrupción 2026

Prototipo de buzón anónimo de denuncias que propone fortalecer el eje de confidencialidad y anonimato del S5 de la Plataforma Digital Nacional. Las denuncias se envían sin cuentas, correo ni teléfono, y se consultan mediante una frase de recuperación de seis palabras generada en el dispositivo. **Hoy no envía nada al S5**: es un prototipo con datos sintéticos (ver [Relación con el S5](#relación-con-el-s5)).

La planeación y los requerimientos están en [`docs/`](./docs). Las decisiones técnicas vigentes están en [`docs/decisiones-arquitectura.md`](./docs/decisiones-arquitectura.md).

## Stack

| Capa                  | Tecnología                   |
| --------------------- | ---------------------------- |
| Frontend              | TypeScript + React (Next.js) |
| Backend               | Node + TypeScript (Express)  |
| Base de datos         | PostgreSQL                   |
| Frase de recuperación | Argon2id                     |
| Despliegue            | Docker Compose y Caddy       |

## Estructura del repositorio

```text
.
├── apps/
│   ├── backend/              # API con Express + TypeScript
│   └── frontend/dashboard/   # Aplicación Next.js
├── packages/shared/          # Contratos de la API, catálogos, frase y sellado
├── docs/                     # Requerimientos y planeación
├── docker/                   # Caddy, generación de secretos y pruebas sobre docker-compose.yml
├── e2e/anonimato/            # Pruebas que demuestran el anonimato
├── scripts/                  # Verificadores de arquitectura y de terceros
├── docker-compose.yml        # Despliegue completo y PostgreSQL de desarrollo
└── package.json              # Raíz de npm workspaces
```

## Requisitos

- Node.js >= 20 (se recomienda LTS 24)
- npm >= 10
- Docker y Docker Compose. En Windows, Docker Desktop con el motor WSL2 (contenedores Linux)

Funciona en macOS, Linux y Windows. En Windows usa PowerShell; antes de clonar, `git config --global core.autocrlf false`
para que los archivos que entran a los contenedores conserven LF. Los scripts npm no dependen de bash.

## Despliegue en un comando

```bash
docker compose up --build
```

Abre <https://localhost> y acepta el certificado local. Levanta PostgreSQL, migraciones, backend,
frontend y Caddy, y genera los secretos en un volumen. La clave privada de demostración de la
autoridad queda en otro volumen que ningún servicio monta; se obtiene con
`docker compose run --rm --no-deps clave-autoridad > autoridad.jwk`.

El tablero arranca vacío. Para una demostración con **denuncias sintéticas** (ninguna real):

```bash
docker compose run --rm sintetico
```

Los pasos completos, las variantes para PowerShell y la solución de problemas están en la
[guía de réplica](./docs/guia-de-replica.md).

## Desarrollo

```bash
npm ci
docker compose up -d postgres   # Solo PostgreSQL, en localhost:5432
npm run migrate           # Crea las tablas
npm run dev:backend       # http://localhost:4000
npm run dev:frontend      # http://localhost:3000
```

La configuración del backend se lee de variables de entorno. Copia
`apps/backend/.env.example` a `apps/backend/.env` y ajústala si es necesario; los
valores por defecto coinciden con `docker-compose.yml`.

Para usar otro puerto de PostgreSQL (por ejemplo, si el 5432 ya está ocupado),
define `POSTGRES_PORT` y mantén `DATABASE_URL` sincronizada:

```bash
POSTGRES_PORT=5433 docker compose up -d postgres
DATABASE_URL=postgres://dataton:dataton@localhost:5433/dataton npm run dev:backend
```

## Scripts disponibles

| Comando                                        | Descripción                                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev:backend`                          | Inicia la API en modo watch en el puerto 4000                                                      |
| `npm run dev:frontend`                         | Inicia la aplicación Next.js en el puerto 3000                                                     |
| `npm run build`                                | Compila todos los workspaces                                                                       |
| `npm run lint`                                 | Ejecuta ESLint en todos los workspaces                                                             |
| `npm run typecheck`                            | Verifica tipos en todos los workspaces                                                             |
| `npm test`                                     | Ejecuta las pruebas de todos los workspaces                                                        |
| `npm run migrate`                              | Aplica las migraciones de la base de datos                                                         |
| `npm run format`                               | Formatea el repositorio con Prettier                                                               |
| `npm run format:check`                         | Verifica el formato sin escribir cambios                                                           |
| `npm run test:anonimato`                       | Levanta el despliegue y corre las pruebas de anonimato                                             |
| `npm run test:compose`                         | Comprueba que ningún servicio pueda leer la clave privada                                          |
| `npm run test:cobertura-dominio`               | Exige cobertura mínima en `dominio/`                                                               |
| `npm run verificar:arquitectura`               | Revisa las dependencias entre capas (D10)                                                          |
| `npm run verificar:terceros`                   | Busca terceros y lectura de IP o user-agent                                                        |
| `npm run sintetico -w @dataton/backend`        | Denuncias sintéticas en el Postgres de desarrollo (en Docker: `docker compose run --rm sintetico`) |
| `npm run agregar -w @dataton/backend`          | Publica los trimestres cerrados con k-anonimato                                                    |
| `npm run test:ataques -w @dataton/backend`     | Suite de ataques al k-anonimato, con salida detallada                                              |
| `npm run pdn:instantaneas -w @dataton/backend` | Regenera las instantáneas de la PDN (`apps/backend/datos/pdn`)                                     |

## API

Todo cuelga de `/api`; Caddy lo envía al backend. Las rutas con credencial la reciben en el cuerpo, nunca en la URL. El detalle de cada contrato está en `packages/shared/src`.

| Método   | Ruta                                                                   | Descripción                                                    |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| GET      | `/api/health`, `/api/health/db`                                        | Estado del proceso y de la conexión a PostgreSQL               |
| GET      | `/api/v1/configuracion`                                                | Clave pública de la autoridad y límites del prototipo          |
| GET      | `/api/v1/pow/reto`                                                     | Reto de prueba de trabajo (Altcha autoalojado)                 |
| POST     | `/api/v1/denuncias`                                                    | Crea una denuncia sellada; devuelve el folio                   |
| POST     | `/api/v1/evidencias`                                                   | Recibe, limpia y sella una evidencia                           |
| POST     | `/api/v1/acceso/*`                                                     | Seguimiento con folio o frase: consulta y mensajes             |
| POST/GET | `/api/v1/autoridad/sesion`, `/api/v1/autoridad/denuncias…`             | Panel de autoridad (cookie de sesión)                          |
| GET      | `/api/v1/publico/periodos`                                             | Trimestres publicados y k                                      |
| GET      | `/api/v1/publico/agregados?periodo=&dimensiones=`                      | Una tabla protegida con k-anonimato                            |
| GET      | `/api/v1/publico/indicadores?periodo=`                                 | Indicadores por ente (señal, nunca acusación)                  |
| GET      | `/api/v1/publico/metodologia`                                          | Reglas, garantía, lo que no cubre y el ejemplo de ataque       |
| GET      | `/api/v1/publico/pdn?estado=`                                          | Conteos públicos de la PDN por institución, desde instantáneas |
| GET      | `/api/v1/publico/catalogos/municipios?estado=`                         | Catálogo de municipios                                         |
| GET      | `/api/v1/publico/descargas/agregados.csv`, `.json`, `diccionario.json` | Datos abiertos con diccionario de datos                        |

## Base de datos y volúmenes del despliegue

En `docker compose up` PostgreSQL corre en el servicio `db` (imagen `postgres:17.11-alpine3.24`), sin puertos publicados, y guarda los datos en el volumen `db-data`. Los demás volúmenes: `secretos` (pimienta, claves y contraseñas generadas al desplegar), `clave-autoridad-demo` (clave privada de demostración; ningún servicio en ejecución lo monta), `semilla-autoridad-demo` (usuario y contraseña demo del panel; solo lo leen `secretos` y `migraciones`) y `caddy-data`. Los datos sobreviven a `docker compose down`; `docker compose down -v` borra datos y secretos juntos, y con ellos todo folio y frase existentes.

```bash
docker compose exec db pg_dump -U dataton dataton > respaldo.sql
docker volume ls --filter label=com.docker.compose.project=dataton-buzon-anonimo
```

El servicio `postgres` (perfil `dev`, puerto en `localhost`) es solo para `npm run dev:*` y usa el volumen `postgres-data`.

No se registran ni se persisten direcciones IP ni user agents: ver el
[modelo de amenazas](./docs/modelo-de-amenazas.md) y el
[último reporte de pruebas](./docs/evidencia/reporte-anonimato.md).

## Relación con el S5

El backend incluye `AdaptadorS5` (`apps/backend/src/contextos/denuncias/aplicacion/puerto-s5.ts`) con dos implementaciones: `MockS5` y `RealS5`. Las **lecturas públicas** de `RealS5` (catálogos y estadísticas de la versión de pruebas) están comprobadas y las usa `npm run pdn:instantaneas` para regenerar el catálogo de municipios. El **flujo de denuncia no lo invoca**: `composicion.ts` lo expone, pero ningún caso de uso envía denuncias al S5, y `RealS5.registrarDenuncia` se niega sin `S5_ENVIO_AUTORIZADO=true` y sin autorización de SESNA. Además, en el despliegue la red interna no tiene salida a internet, así que un envío en tiempo de ejecución no sería posible sin cambiar la red a propósito.

La correspondencia entre nuestros campos y etapas y los del S5, con lo que falta resolver con SESNA, está en [`docs/investigacion-s5-pdn.md`](./docs/investigacion-s5-pdn.md#correspondencia-con-los-campos-del-s5) y en el [README del backend](./apps/backend/README.md#adaptador-s5).

## Documentación

| Documento                                                       | Contenido                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| [Modelo de amenazas](./docs/modelo-de-amenazas.md)              | Adversarios, mitigaciones, pruebas y límites                          |
| [Metodología](./docs/metodologia.md)                            | Cómo se construyó y con qué tecnologías                               |
| [Guía de réplica](./docs/guia-de-replica.md)                    | Cómo levantarlo desde cero                                            |
| [Uso de IA](./docs/uso-de-ia.md)                                | Declaración exigida por las bases                                     |
| [Cumplimiento de las bases](./docs/cumplimiento-bases.md)       | Cada base y criterio, con su evidencia                                |
| [Investigación del S5 y la PDN](./docs/investigacion-s5-pdn.md) | Lo observado, la correspondencia de campos y los pendientes con SESNA |
| [Avisos de terceros](./AVISOS-TERCEROS.md)                      | Licencias y procedencia de lo que no es nuestro                       |

## Licencia y titularidad

© 2026 Daniela Carrate Bahena, Gael Castañeda Beltrán, Martín Antonio Joaquín Landa, Josué Manuel
Rosales García y Víctor Javier Brito Vega.

Esta obra está bajo la
[licencia Creative Commons Atribución-NoComercial 4.0 Internacional](./LICENSE) (`CC-BY-NC-4.0`
en cada `package.json`). Lo que no es nuestro (el modelo NER opcional bajo AFL-3.0, `libvips` bajo
LGPL y las fuentes de datos de la PDN) está en [`AVISOS-TERCEROS.md`](./AVISOS-TERCEROS.md). El uso
de herramientas de IA en el desarrollo se declara en [`docs/uso-de-ia.md`](./docs/uso-de-ia.md).
