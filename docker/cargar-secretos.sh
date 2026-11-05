#!/bin/sh
# Carga las variables generadas por el servicio "secretos" y ejecuta el comando del contenedor.
set -eu
set -a
. /secretos/backend.env
set +a
exec "$@"
