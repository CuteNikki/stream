# Built with Bun, run on Node: Next's own standalone server, with just what it needs.
FROM oven/bun:1.4.0-alpine AS build
WORKDIR /app
# Dependencies first, so a change to the code alone reuses them
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
# Prisma's migrations engine isn't needed to generate its client, nor by
# Stream, only by the migrate stage below. Saying it's there keeps Prisma from
# downloading it, which from Docker's network, with no IPv6, can time out.
# Generating the client reads DATABASE_URL, which isn't used to build: any
# address will do.
ENV PRISMA_SCHEMA_ENGINE_BINARY=/bin/true DATABASE_URL=postgresql://build@localhost/build
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# The database's migrations, which compose's migrate runs before Stream starts:
# Prisma and the migrations alone, at the version package.json names. Its
# engine is downloaded with it, as it's built: from Docker's network, with no
# IPv6, a connection to Prisma's host now and then times out. Tries, each
# waiting longer, ride out a while of it not answering, and each checks the
# engine came, as Prisma's own download fails quietly
FROM oven/bun:1.4.0-alpine AS migrate
WORKDIR /app
COPY package.json ./app.json
RUN echo '{ "private": true, "trustedDependencies": ["prisma", "@prisma/engines"] }' > package.json \
  && for try in 1 2 3 4 5 6; do \
    bun add prisma@$(bun -e 'console.log(require("./app.json").devDependencies.prisma)') \
    && ls node_modules/@prisma/engines/schema-engine-* >/dev/null 2>&1 \
    && break; \
    [ "$try" = 6 ] && { echo "Couldn't download Prisma's engine" >&2; exit 1; }; \
    rm -rf node_modules; \
    sleep $((try * 10)); \
  done
COPY prisma.config.ts ./
COPY prisma ./prisma
CMD ["bunx", "prisma", "migrate", "deploy"]

FROM node:24-alpine
WORKDIR /app
# Next listens on HOSTNAME, which Docker sets to the container's id; every address instead
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
EXPOSE 3000
# Not root: it needs nothing of the server's beyond its port
USER node
CMD ["node", "server.js"]
