FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html tsconfig.json vite.config.ts server.ts ./
COPY src/ ./src/
COPY public/ ./public/
RUN pnpm exec tsc --noEmit && pnpm exec vite build
RUN pnpm prune --prod

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/node_modules/ ./node_modules/
COPY package.json server.ts ./
COPY src/workspaceSchema.ts ./src/workspaceSchema.ts
COPY src/colorBounds.ts ./src/colorBounds.ts
RUN mkdir /data && chown node:node /data
USER node
ENV PORT=3000 SHARE_DB_PATH=/data/shares.sqlite
EXPOSE 3000
CMD ["node", "server.ts"]
