# Guía de réplica

Cómo levantar el buzón desde cero en una máquina limpia, sin cuentas, sin costo y solo con herramientas libres. Usa **datos de prueba**: no envíes denuncias reales.

## 1. Requisitos

| Herramienta                 | Para qué                  | Versión comprobada       |
| --------------------------- | ------------------------- | ------------------------ |
| Docker con Compose          | Despliegue                | Docker 29.9.2, Compose 5.6.1 |
| Git                         | Obtener el código         | Cualquiera reciente      |
| Node.js y npm (opcional)    | Pruebas y desarrollo      | Node 22.23 en el equipo; 24.22 en imágenes y CI |

Puertos libres: 80 y 443. Se pueden cambiar (ver el paso 2).

## 2. Levantarlo

```bash
git clone https://github.com/VictorBrito13/dataton-buzon-anonimo.git
cd dataton-buzon-anonimo
docker compose up --build
```

No hay nada que configurar: el servicio `secretos` genera la pimienta y la contraseña de la base en un volumen de Docker la primera vez. La primera construcción tarda varios minutos. También descarga el modelo NER opcional, de unos 135 MB; para omitirlo, usa `DESCARGAR_MODELO_NER=0`, y el depurador funcionará solo con reglas.

Abre <https://localhost>. El certificado lo emite Caddy para uso local, así que el navegador mostrará una advertencia que debes aceptar. Si los puertos están ocupados:

```bash
PUERTO_HTTP=8080 PUERTO_HTTPS=8443 docker compose up --build
# Abre https://localhost:8443
```

### Qué se levanta

```text
Navegador ──HTTPS──▶ Caddy ──▶ frontend (Next.js standalone)
                          └──▶ backend (Express) ──▶ PostgreSQL
                                                     ▲
                     secretos y migraciones (terminan al iniciar)
```

| Servicio      | Función                                                         | Publica puertos |
| ------------- | --------------------------------------------------------------- | --------------- |
| `secretos`    | Genera secretos si faltan y termina                             | No              |
| `db`          | PostgreSQL                                                      | No              |
| `migraciones` | Aplica `apps/backend/migrations` y termina                      | No              |
| `backend`     | API en `/api`                                                   | No              |
| `frontend`    | Aplicación Next.js                                              | No              |
| `caddy`       | HTTPS, HSTS y único punto de entrada; sin bitácora de peticiones | 80 y 443        |

Backend, frontend y base de datos están en una red interna sin salida a internet.

## 3. Comprobar que funciona

```bash
curl -k -I https://localhost/
curl -k https://localhost/api/health/db
# {"status":"ok","database":"up"}
```

En las cabeceras deben aparecer `strict-transport-security`, `content-security-policy` y `referrer-policy: no-referrer`, sin `server` ni `x-powered-by`.

## 4. Correr las pruebas de anonimato

Requieren Node.js y levantan su propio despliegue en los puertos 18080 y 18443, que eliminan al terminar:

```bash
npm ci
npx playwright install chromium
npm run test:anonimato
```

El resultado queda en [`docs/evidencia/reporte-anonimato.md`](./evidencia/reporte-anonimato.md).

| Variable                         | Efecto                                                     |
| -------------------------------- | ---------------------------------------------------------- |
| `ANONIMATO_DESPLIEGUE_EXISTENTE=1` | Usa un despliegue ya levantado y no lo apaga             |
| `ANONIMATO_CONSERVAR=1`          | No lo apaga al terminar, para revisarlo                    |
| `ANONIMATO_EXIGIR_FLUJO=1`       | Si falta el formulario, falla en lugar de quedar pendiente |
| `ANONIMATO_PROYECTO`             | Nombre del proyecto de Compose (`dataton-infra`)           |
| `ANONIMATO_PUERTO_HTTP`, `ANONIMATO_PUERTO_HTTPS` | Puertos del despliegue de prueba          |

## 5. Apagar y reiniciar

```bash
docker compose down      # Conserva datos y secretos
docker compose down -v   # Borra datos y secretos
```

**Los secretos y los datos van juntos.** Sin la pimienta, ningún folio ni frase existente vuelve a funcionar. Para respaldar el despliegue, respalda los volúmenes `secretos` y `db-data`.

## 6. Desarrollo local

```bash
npm ci
docker compose up -d postgres   # Solo PostgreSQL en localhost:5432, con credenciales de desarrollo
cp apps/backend/.env.example apps/backend/.env
npm run migrate
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:3000
```

Antes de abrir un PR, los comandos de la definición de terminado (D10) deben pasar:

```bash
npm run build && npm run typecheck && npm run lint && npm run format:check && npm test
```

## 7. Solución de problemas

| Síntoma                                         | Causa y solución                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `port is already allocated`                     | Usa `PUERTO_HTTP` y `PUERTO_HTTPS`, o `POSTGRES_PORT` para el Postgres de desarrollo                                                  |
| El navegador rechaza el certificado             | Es esperado con `tls internal`. Acepta la advertencia                                                                                 |
| `http://localhost:3000` redirige a HTTPS tras usar el despliegue | El navegador guardó HSTS para `localhost`, lo que solo ocurre si confía en el certificado. Borra el registro de HSTS, o usa `HSTS_MAX_AGE=0` |
| No aparece ninguna bitácora de peticiones       | Es intencional                                                                                                                        |
| Un servicio no arranca                          | `docker compose ps -a` y `docker compose logs <servicio>`                                                                             |
| `npm ci` falla en `prepare`                     | `@dataton/shared` compila al instalar: revisa sus errores de TypeScript                                                               |

## 8. Pasar de local a un servidor

Esta guía cubre el prototipo. Para exponerlo con un dominio real:

1. Define `SITIO_HOST=tu-dominio`.
2. Quita `tls internal` de [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile) para obtener un certificado público.
3. Respalda los volúmenes `secretos` y `db-data` por separado.
4. Revisa los límites de hospedaje en el [modelo de amenazas](./modelo-de-amenazas.md#5-límites-honestos).

**Pendiente de verificar:** estos pasos no se han probado con un dominio público.

## Qué se comprobó de esta guía

- **Comprobado** en macOS (arm64) con las versiones de la tabla, desde volúmenes vacíos: [`evidencia/despliegue-local.md`](./evidencia/despliegue-local.md).
- **Linux x86-64:** el trabajo de CI construye y prueba en `ubuntu-latest`. Su resultado se consulta en cada PR.
- **Pendiente de verificar:** Windows y una persona ajena al equipo siguiendo la guía.
