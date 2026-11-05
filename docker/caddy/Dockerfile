FROM caddy:2.11.8-alpine

# La imagen oficial corre como root; aquí se usa un usuario propio. Se quita la capacidad de
# archivo del binario porque el contenedor arranca sin capacidades y con no-new-privileges.
RUN apk add --no-cache libcap \
  && setcap -r /usr/bin/caddy \
  && apk del libcap \
  && addgroup -g 1000 -S caddy \
  && adduser -u 1000 -S -G caddy -H caddy \
  && mkdir -p /data /config \
  && chown -R caddy:caddy /data /config

COPY Caddyfile /etc/caddy/Caddyfile

USER caddy
