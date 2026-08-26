# QR4Life — produkční image (Next.js standalone + Prisma migrate)
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- závislosti ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma CLI pro migrace při startu
RUN npm i -g prisma@6.19.3 && npm cache clean --force
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
USER node
EXPOSE 3000
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
