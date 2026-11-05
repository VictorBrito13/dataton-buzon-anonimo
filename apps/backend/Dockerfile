# Se construye desde la raíz del repositorio (ver docker-compose.yml).
FROM node:24.22.2-bookworm-slim AS construccion
WORKDIR /repo
# npm valida el lockfile contra todos los workspaces. @dataton/shared compila en `prepare`,
# por eso sus fuentes deben estar antes de instalar.
COPY package.json package-lock.json ./
COPY packages/shared/ packages/shared/
COPY apps/frontend/dashboard/package.json apps/frontend/dashboard/
COPY apps/backend/package.json apps/backend/
RUN npm ci -w @dataton/shared -w @dataton/backend
COPY apps/backend/ apps/backend/
RUN npm run build -w @dataton/backend \
  && npm prune --omit=dev --ignore-scripts -w @dataton/shared -w @dataton/backend

FROM node:24.22.2-bookworm-slim AS ejecucion
ENV NODE_ENV=production
WORKDIR /app
COPY --from=construccion /repo/package.json ./
COPY --from=construccion /repo/node_modules/ node_modules/
COPY --from=construccion /repo/packages/shared/package.json packages/shared/
COPY --from=construccion /repo/packages/shared/dist/ packages/shared/dist/
COPY --from=construccion /repo/apps/backend/package.json apps/backend/
COPY --from=construccion /repo/apps/backend/dist/ apps/backend/dist/
COPY --from=construccion /repo/apps/backend/migrations/ apps/backend/migrations/
COPY docker/cargar-secretos.sh /usr/local/bin/cargar-secretos.sh
RUN chmod 555 /usr/local/bin/cargar-secretos.sh
WORKDIR /app/apps/backend
USER node
ENTRYPOINT ["/usr/local/bin/cargar-secretos.sh"]
CMD ["node", "dist/server.js"]
