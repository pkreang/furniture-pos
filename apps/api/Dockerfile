FROM node:20-slim AS build
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace apps/api
COPY apps/api apps/api
COPY legacy-demo legacy-demo
RUN npm run prisma:generate --workspace apps/api && npm run build --workspace apps/api

FROM node:20-slim
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo/apps/api
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/legacy-demo /repo/legacy-demo
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed/index.js && node dist/server.js"]
