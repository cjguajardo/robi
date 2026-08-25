FROM node:24-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app


FROM base AS build-dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile


FROM build-dependencies AS build

COPY astro.config.mjs tsconfig.json ./
COPY public ./public
COPY assets/sonidos/audios.json ./assets/sonidos/audios.json
COPY src ./src

RUN pnpm build


FROM base AS production-dependencies

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile


FROM base AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json server.mjs tsconfig.json ./
COPY --from=build --chown=node:node /app/assets/sonidos/audios.json ./assets/sonidos/audios.json
COPY --chown=node:node src ./src

USER node

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4321/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["./node_modules/.bin/tsx", "./server.mjs"]
