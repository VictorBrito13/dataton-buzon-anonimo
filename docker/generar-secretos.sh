#!/bin/sh
# Crea los secretos del despliegue en el volumen, una sola vez. Conservarlos importa: sin la
# pimienta ningún folio ni frase existente vuelve a funcionar. `down -v` los borra junto con la base.
set -eu
umask 077

DIR=/secretos
UID_BACKEND=1000

aleatorio_hex() {
  head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
}

escribir_si_falta() {
  [ -s "$1" ] && return 0
  aleatorio_hex 32 >"$1.tmp"
  mv "$1.tmp" "$1"
}

escribir_si_falta "$DIR/db_password"

ENV_BACKEND="$DIR/backend.env"
touch "$ENV_BACKEND"

# Variables aleatorias de 32 bytes que necesita el backend. Agregar aquí las nuevas: las que
# ya existan se conservan, de modo que actualizar la lista no invalida las anteriores.
for variable in PIMIENTA_ACCESO; do
  if ! grep -q "^$variable=" "$ENV_BACKEND"; then
    echo "$variable=$(aleatorio_hex 32)" >>"$ENV_BACKEND"
  fi
done

if ! grep -q "^DATABASE_URL=" "$ENV_BACKEND"; then
  echo "DATABASE_URL=postgres://dataton:$(cat "$DIR/db_password")@db:5432/dataton" >>"$ENV_BACKEND"
fi

# Postgres lee su contraseña como root antes de bajar de privilegios; el backend, como uid 1000.
chmod 400 "$DIR/db_password"
chown "$UID_BACKEND:$UID_BACKEND" "$ENV_BACKEND"
chmod 400 "$ENV_BACKEND"
echo "[secretos] listos"
