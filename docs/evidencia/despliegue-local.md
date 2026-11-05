# Evidencia del despliegue local

Corrida del 4 de noviembre de 2026 en macOS (arm64), con Docker 29.9.2 y Compose 5.6.1, desde volúmenes vacíos. Se usaron otros puertos y otro nombre de proyecto para no chocar con otros servicios del equipo; es la única diferencia con `docker compose up`.

```bash
PUERTO_HTTP=18080 PUERTO_HTTPS=18443 docker compose -p dataton-infra up
```

Este registro se transcribió de la salida real. El reporte automático está en [`reporte-anonimato.md`](./reporte-anonimato.md).

## Servicios

```text
SERVICE       STATUS                      PORTS
backend       Up (healthy)
caddy         Up                          0.0.0.0:18080->80/tcp, 0.0.0.0:18443->443/tcp
db            Up (healthy)                5432/tcp
frontend      Up (healthy)
migraciones   Exited (0)
secretos      Exited (0)
```

`5432/tcp` es un puerto interno del contenedor: no está publicado en el anfitrión.

## Cabeceras: `curl -k -D - https://localhost:18443/`

El valor del nonce, que cambia en cada petición, se sustituyó por `…`.

```text
HTTP/2 200
cache-control: no-store
content-security-policy: default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval'; style-src 'self' 'nonce-…'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
content-type: text/html; charset=utf-8
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: no-referrer
strict-transport-security: max-age=31536000
x-content-type-options: nosniff
```

No aparecen `server`, `x-powered-by` ni `set-cookie`.

## Base de datos: `curl -k https://localhost:18443/api/health/db`

```json
{ "status": "ok", "database": "up" }
```

## Redirección: `curl -D - http://localhost:18080/`

```text
HTTP/1.1 308 Permanent Redirect
Location: https://localhost:18443/
```

## Por qué se excluyeron los registros de error de Caddy

Con Caddy 2.11.8 **sin** la exclusión del `Caddyfile`, y sin ningún registro de acceso activado, una respuesta 502 escribe la IP y el user-agent. Se probó con `caddy reverse-proxy` hacia un puerto cerrado:

```json
{
  "logger": "http.log.error",
  "msg": "dial tcp 127.0.0.1:9: connect: connection refused",
  "request": {
    "remote_ip": "172.17.0.1",
    "client_ip": "172.17.0.1",
    "headers": { "User-Agent": ["UA-MARCADOR-ERR"], "Accept": ["*/*"] }
  },
  "status": 502
}
```

En el despliegue del proyecto, `despliegue.spec.ts` provoca el mismo 502 y comprueba que el marcador no aparece en ninguna bitácora.

## Imágenes

`docker image inspect` muestra que `dataton/backend`, `dataton/frontend` y `dataton/caddy` corren con usuario no root (`node`, `node`, `caddy`) y sin secretos en sus variables de entorno. Los secretos se generan al desplegar, en el volumen `secretos`.

## Postgres de desarrollo

`POSTGRES_PORT=15432 docker compose up -d --wait postgres` lo levantó como servicio aparte, y `npm run migrate` se aplicó contra él. No forma parte de `docker compose up`.

## Límites de esta evidencia

- Es un solo equipo. El trabajo `imagenes` de CI cubre Linux x86-64.
- El flujo de denuncia aún no está integrado: lo que depende de él sigue pendiente en el [reporte](./reporte-anonimato.md).
