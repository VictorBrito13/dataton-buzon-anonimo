# Buzón Anónimo — Datatón Anticorrupción 2026

Buzón anónimo de denuncias para el S5. Las denuncias se envían sin cuentas, correo ni teléfono, y se consultan mediante una frase de recuperación de seis palabras generada en el dispositivo.

La planeación y los requerimientos están en [`docs/`](./docs).

## Stack

| Capa                  | Tecnología                   |
| --------------------- | ---------------------------- |
| Frontend              | TypeScript + React (Next.js) |
| Backend               | Node + TypeScript (Express)  |
| Base de datos         | PostgreSQL                   |
| Frase de recuperación | Argon2id                     |
| Despliegue            | Docker Compose               |

## Estructura del repositorio

```text
.
├── apps/
│   ├── backend/              # API con Express + TypeScript
│   └── frontend/dashboard/   # Aplicación Next.js
├── docs/                     # Requerimientos y planeación
├── docker-compose.yml        # PostgreSQL para desarrollo local
└── package.json              # Raíz de npm workspaces
```

## Requisitos

- Node.js >= 20 (se recomienda LTS 24)
- npm >= 10
- Docker y Docker Compose

## Primeros pasos

```bash
npm install
docker compose up -d      # PostgreSQL en localhost:5432
npm run dev:backend       # http://localhost:4000
npm run dev:frontend      # http://localhost:3000
```

La configuración del backend se lee de variables de entorno. Copia
`apps/backend/.env.example` a `apps/backend/.env` y ajústala si es necesario; los
valores por defecto coinciden con `docker-compose.yml`.

Para usar otro puerto de PostgreSQL (por ejemplo, si el 5432 ya está ocupado),
define `POSTGRES_PORT` y mantén `DATABASE_URL` sincronizada:

```bash
POSTGRES_PORT=5433 docker compose up -d
DATABASE_URL=postgres://dataton:dataton@localhost:5433/dataton npm run dev:backend
```

## Scripts disponibles

| Comando                | Descripción                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run dev:backend`  | Inicia la API en modo watch en el puerto 4000  |
| `npm run dev:frontend` | Inicia la aplicación Next.js en el puerto 3000 |
| `npm run build`        | Compila todos los workspaces                   |
| `npm run lint`         | Ejecuta ESLint en todos los workspaces         |
| `npm run typecheck`    | Verifica tipos en todos los workspaces         |
| `npm run format`       | Formatea el repositorio con Prettier           |
| `npm run format:check` | Verifica el formato sin escribir cambios       |

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

No se registran ni se persisten direcciones IP ni user agents.

## Licencia

Esta obra está bajo la
[licencia Creative Commons Atribución-NoComercial 4.0 Internacional](./LICENSE).
