# CampusConnect API for Railway (or any Docker host).
# Build context is the campus-connect/ folder (the npm workspace root):
#   docker build -f apps/api/Dockerfile -t campus-connect-api .

FROM node:22-slim AS build
WORKDIR /app

# Only the API workspace is installed, so the web app's dependencies stay out of this image.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=api

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run build --workspace=api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=:: \
    PORT=4000 \
    TRUST_PROXY=true \
    COOKIE_SECURE=true \
    LOG_PRETTY=false

# Production dependencies only (sharp and argon2 ship prebuilt binaries for Debian).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=api --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist

WORKDIR /app/apps/api
USER node
EXPOSE 4000

# bootstrap creates the first college and admin when BOOTSTRAP_ADMIN_* is set (otherwise it does
# nothing), then the server starts. exec keeps Node as PID 1 so Railway's SIGTERM reaches it.
CMD ["sh", "-c", "node dist/scripts/bootstrap.js && exec node dist/src/server.js"]
