# Guía de réplica

Cómo levantar el buzón desde cero en una máquina limpia, sin cuentas, sin costo y solo con herramientas libres. Usa **datos de prueba**: no envíes denuncias reales.

Sirve en **macOS, Linux y Windows**. Los comandos van en dos variantes cuando difieren: `bash` (macOS, Linux, WSL) y `PowerShell` (Windows). Lo que está dentro de los contenedores es igual en los tres.

## 1. Requisitos

| Herramienta                 | Para qué                  | Versión comprobada       |
| --------------------------- | ------------------------- | ------------------------ |
| Docker con Compose          | Despliegue                | Docker 29.9.2, Compose 5.6.1 en macOS. En Windows, Docker Desktop con el motor **WSL2** (contenedores Linux) |
| Git                         | Obtener el código         | Cualquiera reciente      |
| Node.js y npm (opcional)    | Pruebas y desarrollo      | Node 22.23 en el equipo; 24.22 en imágenes y CI |

Puertos libres: 80 y 443. Se pueden cambiar (ver el paso 2).

**Windows, antes de clonar.** Los archivos que entran a los contenedores (`.sh`, `Dockerfile`, `docker/`) deben conservar finales de línea LF; con CRLF el contenedor falla con `no such file or directory`. El repositorio lo fija en `.gitattributes`, y además conviene desactivar la conversión automática de Git:

```powershell
git config --global core.autocrlf false
```

Si ya habías clonado con `autocrlf=true`, vuelve a sacar los archivos: `git rm -r --cached . ; git reset --hard`.

## 2. Levantarlo

```bash
git clone https://github.com/VictorBrito13/dataton-buzon-anonimo.git
cd dataton-buzon-anonimo
docker compose up --build
```

Los tres comandos son iguales en PowerShell. No hay pasos previos en el anfitrión: todo lo que se ejecuta corre dentro de contenedores Linux, así que no depende de `bash` ni de permisos del sistema de archivos de Windows (los volúmenes son nombrados, no carpetas del anfitrión; el único montaje desde el repositorio es `docker/generar-secretos.mjs`, de solo lectura).

No hay nada que configurar: el servicio `secretos` genera la pimienta y la contraseña de la base en un volumen de Docker la primera vez. La primera construcción tarda varios minutos. También descarga el modelo NER opcional, de unos 135 MB; para omitirlo, usa `DESCARGAR_MODELO_NER=0`, y el depurador funcionará solo con reglas.

Abre <https://localhost>. El certificado lo emite Caddy para uso local, así que el navegador mostrará una advertencia que debes aceptar. Si los puertos están ocupados:

```bash
PUERTO_HTTP=8080 PUERTO_HTTPS=8443 docker compose up --build
# Abre https://localhost:8443
```

```powershell
$env:PUERTO_HTTP = "8080"; $env:PUERTO_HTTPS = "8443"
docker compose up --build
```

En PowerShell las variables de entorno se fijan con `$env:NOMBRE = "valor"` y duran lo que dura la terminal; la forma `NOMBRE=valor comando` de bash no existe ahí. Cualquier variable de esta guía (`DESCARGAR_MODELO_NER`, `CLAVE_PUBLICA_AUTORIDAD`, `SITIO_HOST`…) se pasa igual.

### Qué se levanta

```text
Navegador ──HTTPS──▶ Caddy ──▶ frontend (Next.js standalone)
                          └──▶ backend (Express) ──▶ PostgreSQL
                                                     ▲
                     secretos y migraciones (terminan al iniciar)
```

| Servicio      | Función                                                         | Publica puertos |
| ------------- | --------------------------------------------------------------- | --------------- |
| `secretos`    | Genera secretos si faltan y termina. La clave privada de demostración va a su propio volumen | No |
| `clave-autoridad` | Solo a mano (`docker compose run`): lee ese volumen e imprime la clave. Perfil `demo`, sin red | No |
| `db`          | PostgreSQL                                                      | No              |
| `migraciones` | Aplica `apps/backend/migrations`, cambia la contraseña del rol público, crea el usuario demo del panel y termina | No |
| `backend`     | API en `/api`                                                   | No              |
| `frontend`    | Aplicación Next.js                                              | No              |
| `caddy`       | HTTPS, HSTS y único punto de entrada; sin bitácora de peticiones | 80 y 443        |

Backend, frontend y base de datos están en una red interna sin salida a internet.

### La clave de la autoridad

El servidor no puede abrir relatos ni evidencias: se sellan para la clave pública de la autoridad y solo la privada los abre (D3). Hay dos modos.

**Demostración (lo que hace `docker compose up` sin configurar nada).** Para que el prototipo arranque con un comando, `secretos` genera el par de claves y escribe la privada en el volumen `clave-autoridad-demo`, separado del volumen `secretos` que leen el backend y la base. **Ningún servicio en ejecución monta ese volumen**: ni backend, ni frontend, ni db, ni caddy, ni migraciones; solo lo lee el servicio manual `clave-autoridad`, que no tiene red y no arranca con `up`. La prueba `docker/compose.test.mjs` lo verifica sobre `docker compose config` en cada PR, y falla si algún servicio llega a montarlo. Sé honesto al presentarlo: en este modo **la clave vive en la misma máquina que el servidor**, en un volumen aparte; quien administre el Docker del anfitrión podría leerla. Es una demostración, no un despliegue real.

Para obtener la clave y entrar al panel en una demostración:

```bash
docker compose run --rm --no-deps clave-autoridad > autoridad.jwk
docker compose run --rm --no-deps clave-autoridad cat /clave-autoridad/acceso_panel.txt
```

Los dos comandos son iguales en PowerShell (el primero deja `autoridad.jwk` en la carpeta actual; el panel acepta el archivo aunque PowerShell le agregue BOM). Después abre <https://localhost/autoridad>, inicia sesión con el usuario y la contraseña que imprime el segundo comando, y carga `autoridad.jwk` en «Cargar clave privada». La clave se queda solo en la memoria de esa pestaña.

**Uso real.** El par se genera **fuera del servidor**, en el equipo de la autoridad, y al despliegue llega solo la pública. Con `CLAVE_PUBLICA_AUTORIDAD` definida, `secretos` **no genera ninguna clave privada** (también lo cubre `docker/generar-secretos.test.mjs`):

```bash
npm run claves:autoridad -w @dataton/backend   # imprime la pública y la privada; guarda la privada en el equipo de la autoridad
CLAVE_PUBLICA_AUTORIDAD='{"kty":"EC","crv":"P-256","x":"…","y":"…"}' docker compose up --build
```

```powershell
npm run claves:autoridad -w @dataton/backend
$env:CLAVE_PUBLICA_AUTORIDAD = '{"kty":"EC","crv":"P-256","x":"…","y":"…"}'
docker compose up --build
```

Debe ser antes del primer arranque: la pública se escribe una vez en el volumen `secretos` y se conserva.

### Tablero y datos sintéticos

El despliegue arranca sin denuncias, por lo que el tablero público no tendrá datos que mostrar. **Pendiente de verificar:** cargar datos sintéticos en este modo; `npm run sintetico` y `npm run agregar` del backend están pensados para el modo de desarrollo (sección 6), porque la base no publica puertos aquí.

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
| `ANONIMATO_PROYECTO`             | Nombre del proyecto de Compose (`dataton-infra`)           |
| `ANONIMATO_PUERTO_HTTP`, `ANONIMATO_PUERTO_HTTPS` | Puertos del despliegue de prueba          |

## 5. Apagar y reiniciar

```bash
docker compose down      # Conserva datos y secretos
docker compose down -v   # Borra datos y secretos
```

**Los secretos y los datos van juntos.** Sin la pimienta, ningún folio ni frase existente vuelve a funcionar. Para respaldar el despliegue, respalda los volúmenes `secretos` y `db-data`. El volumen `clave-autoridad-demo` solo existe en la demostración; en uso real está vacío y la clave la resguarda la autoridad.

## 6. Desarrollo local

```bash
npm ci
docker compose up -d postgres   # Solo PostgreSQL en localhost:5432, con credenciales de desarrollo
cp apps/backend/.env.example apps/backend/.env
npm run migrate
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:3000
```

En PowerShell cambia solo la copia: `Copy-Item apps/backend/.env.example apps/backend/.env`. Los scripts npm del backend no usan sintaxis de bash: `scripts/con-entorno.mjs` fija `NODE_ENV=development` cuando falta y respeta el valor que ya exista, también en `cmd.exe`. Para otro puerto de Postgres: `$env:POSTGRES_PORT = "5433"` antes de `docker compose up -d postgres`, y la misma `DATABASE_URL` en `apps/backend/.env`.

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
- **Windows, sin Docker:** el trabajo `windows` de CI corre en `windows-latest` `npm ci`, `npm run build` (Next.js con `output: standalone`), `npm run typecheck`, `npm run lint`, los verificadores y las pruebas unitarias que no necesitan Postgres, además de un script npm del backend para comprobar que arrancan en `cmd.exe`.
- **Pendiente de verificar:** `docker compose up --build` en Windows con Docker Desktop y WSL2. El ejecutor de GitHub para Windows no corre contenedores Linux, así que la CI no lo cubre; falta probarlo en un equipo Windows real, igual que una persona ajena al equipo siguiendo la guía.
