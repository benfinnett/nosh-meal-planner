FROM node:24-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /app

FROM base AS development
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile

FROM development AS build
RUN pnpm build

FROM base AS api
COPY --from=build /app /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATABASE_PATH=/data/nosh.sqlite
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]

FROM nginx:stable-alpine AS web
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
