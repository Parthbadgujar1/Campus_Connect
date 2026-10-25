# CampusConnect: API + web app in one image, deployed as a single Railway service.
# Railway picks this file up automatically; nothing needs to be configured for the build.
#   docker build -t campus-connect .

FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY apps apps
COPY scripts scripts

# The web build bakes the /api -> API forwarding address in. Both run in this container, on the
# port scripts/start.mjs gives the API (API_PORT there).
ENV API_ORIGIN=http://127.0.0.1:4001 \
    NEXT_TELEMETRY_DISABLED=1
# Next can stop a first build to show a one-off upgrade notice; a retry continues normally.
RUN npm run build --workspace=api && (npm run build --workspace=web || npm run build --workspace=web)

RUN rm -rf apps/web/.next/cache /root/.npm

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
