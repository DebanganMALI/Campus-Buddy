# One image serves both the API and the built web app from a single origin
# (same-origin is required by the cookie/CSRF design, see docs/AGENTS.md §6).
# Build:  docker build -t campus-buddy .
# Deploy: Render reads this via render.yaml. Full steps: docs/DEPLOY.md

############################ build ############################
FROM node:22-slim AS build
WORKDIR /app
# Skip the in-memory MongoDB download that a dev dependency would otherwise do.
ENV MONGOMS_DISABLE_POSTINSTALL=1

# Backend workspaces: manifests first so the install layer is cached.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY packages/db/package.json packages/db/
COPY backend/package.json backend/
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY packages/db/ packages/db/
COPY backend/ backend/
RUN npm run build:libs && npm run build -w @scc/backend

# Frontend is a separate install (not a root workspace).
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm ci --ignore-scripts --prefix frontend
COPY frontend/ frontend/
RUN npm run build --prefix frontend

# Keep only production dependencies for the runtime image.
RUN npm prune --omit=dev --ignore-scripts

########################### runtime ###########################
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    CLIENT_DIR=/app/client
WORKDIR /app

# Workspace packages resolve through symlinks in node_modules/@scc/*, so each
# package keeps its own folder (package.json + compiled dist).
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/shared/package.json ./shared/
COPY --from=build --chown=node:node /app/shared/dist ./shared/dist
COPY --from=build --chown=node:node /app/packages/db/package.json ./packages/db/
COPY --from=build --chown=node:node /app/packages/db/dist ./packages/db/dist
COPY --from=build --chown=node:node /app/backend/package.json ./backend/
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/frontend/dist ./client

# Never run as root.
USER node
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
