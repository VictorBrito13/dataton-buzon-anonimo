# Buzón Anónimo — Datatón Anticorrupción 2026

Buzón anónimo de denuncias para el S5. Las denuncias se envían sin cuentas, correo ni teléfono, y se consultan mediante una frase de recuperación de seis palabras generada en el dispositivo.

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
├── docker/                   # Caddy y generación de secretos
├── e2e/anonimato/            # Pruebas que demuestran el anonimato
├── scripts/                  # Verificadores de arquitectura y de terceros
├── docker-compose.yml        # Despliegue completo y PostgreSQL de desarrollo
└── package.json              # Raíz de npm workspaces
```

## Requisitos

- Node.js >= 20 (se recomienda LTS 24)
- npm >= 10
- Docker y Docker Compose

## Despliegue en un comando

```bash
docker compose up --build
```

Abre <https://localhost> y acepta el certificado local. Levanta PostgreSQL, migraciones, backend,
frontend y Caddy, y genera los secretos en un volumen. Los pasos completos y la solución de
problemas están en la [guía de réplica](./docs/guia-de-replica.md).

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

| Comando                          | Descripción                                            |
| -------------------------------- | ------------------------------------------------------ |
| `npm run dev:backend`            | Inicia la API en modo watch en el puerto 4000          |
| `npm run dev:frontend`           | Inicia la aplicación Next.js en el puerto 3000         |
| `npm run build`                  | Compila todos los workspaces                           |
| `npm run lint`                   | Ejecuta ESLint en todos los workspaces                 |
| `npm run typecheck`              | Verifica tipos en todos los workspaces                 |
| `npm test`                       | Ejecuta las pruebas de todos los workspaces            |
| `npm run migrate`                | Aplica las migraciones de la base de datos             |
| `npm run format`                 | Formatea el repositorio con Prettier                   |
| `npm run format:check`           | Verifica el formato sin escribir cambios               |
| `npm run test:anonimato`         | Levanta el despliegue y corre las pruebas de anonimato |
| `npm run test:cobertura-dominio` | Exige cobertura mínima en `dominio/`                   |
| `npm run verificar:arquitectura` | Revisa las dependencias entre capas (D10)              |
| `npm run verificar:terceros`     | Busca terceros y lectura de IP o user-agent            |

## API

| Método | Ruta             | Descripción                           |
| ------ | ---------------- | ------------------------------------- |
| GET    | `/api/health`    | Estado del proceso                    |
| GET    | `/api/health/db` | Verificación de conexión a PostgreSQL |

## Base de datos

PostgreSQL se ejecuta desde la imagen oficial `postgres:17-alpine` y guarda los
datos en el volumen nombrado administrado por Docker `dataton_postgres-data`.
Los datos sobreviven a `docker compose down`; usa `docker compose down -v` para
reiniciarlos.

```bash
docker volume inspect dataton_postgres-data
docker compose exec postgres pg_dump -U dataton dataton > backup.sql
```

No se registran ni se persisten direcciones IP ni user agents: ver el
[modelo de amenazas](./docs/modelo-de-amenazas.md) y el
[último reporte de pruebas](./docs/evidencia/reporte-anonimato.md).

## Documentación

| Documento                                                 | Contenido                                    |
| --------------------------------------------------------- | -------------------------------------------- |
| [Modelo de amenazas](./docs/modelo-de-amenazas.md)        | Adversarios, mitigaciones, pruebas y límites |
| [Metodología](./docs/metodologia.md)                      | Cómo se construyó y con qué tecnologías      |
| [Guía de réplica](./docs/guia-de-replica.md)              | Cómo levantarlo desde cero                   |
| [Uso de IA](./docs/uso-de-ia.md)                          | Declaración exigida por las bases            |
| [Cumplimiento de las bases](./docs/cumplimiento-bases.md) | Cada base y criterio, con su evidencia       |

## Licencia

Esta obra está bajo la
[licencia Creative Commons Atribución-NoComercial 4.0 Internacional](./LICENSE).
