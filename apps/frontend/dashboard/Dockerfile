# Se construye desde la raíz del repositorio (ver docker-compose.yml).
FROM node:24.22.2-bookworm-slim AS construccion
# Next envía telemetría por omisión: se apaga al construir y al ejecutar.
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
# npm valida el lockfile contra todos los workspaces. @dataton/shared compila en `prepare`,
# por eso sus fuentes deben estar antes de instalar.
COPY package.json package-lock.json ./
COPY packages/shared/ packages/shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/dashboard/package.json apps/frontend/dashboard/
RUN npm ci -w @dataton/shared -w @dataton/dashboard
COPY apps/frontend/dashboard/ apps/frontend/dashboard/
# `rewrites` se congela al construir. En despliegue Caddy envía /api directo al backend;
# esto cubre cualquier petición que aun así llegue a Next.
ARG API_INTERNA=http://backend:4000
ENV API_INTERNA=$API_INTERNA
RUN npm run build -w @dataton/dashboard

FROM node:24.22.2-bookworm-slim AS ejecucion
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
# standalone no incluye public/ ni .next/static/: se copian aparte.
COPY --from=construccion /repo/apps/frontend/dashboard/.next/standalone/ ./
COPY --from=construccion /repo/apps/frontend/dashboard/.next/static/ apps/frontend/dashboard/.next/static/
COPY --from=construccion /repo/apps/frontend/dashboard/public/ apps/frontend/dashboard/public/
WORKDIR /app/apps/frontend/dashboard
USER node
CMD ["node", "server.js"]
