FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY . .
CMD ["sh", "-c", "node scripts/migrate.mjs && npx next dev"]

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY next.config.ts ./
COPY db ./db
COPY scripts ./scripts
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && npx next start"]
