# CampusConnect web app (Next.js) for Railway (or any Docker host).
# Build context is the campus-connect/ folder (the npm workspace root):
#   docker build -f apps/web/Dockerfile --build-arg API_ORIGIN=http://api:4000 -t campus-connect-web .

FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=web

COPY tsconfig.base.json ./
COPY apps/web apps/web

# next.config.ts bakes the /api -> API rewrite into the build, so the API address is needed here
# (not only at runtime). On Railway it comes from the service variable of the same name.
ARG API_ORIGIN
RUN test -n "$API_ORIGIN" || (echo "Set the API_ORIGIN variable on this service, for example http://api.railway.internal:4000" && exit 1)
ENV API_ORIGIN=$API_ORIGIN
RUN npm run build --workspace=web

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
WORKDIR /app/apps/web
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
