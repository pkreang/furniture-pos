FROM node:20-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace apps/api
COPY apps/api apps/api
RUN npm run prisma:generate --workspace apps/api && npm run build --workspace apps/api

FROM node:20-slim
WORKDIR /repo/apps/api
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed/index.js && node dist/server.js"]
