# ---- base ----
FROM node:20-bullseye AS base
WORKDIR /app
ENV CI=true
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

# ---- deps ----
FROM base AS deps

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/cms/package.json ./apps/cms/package.json
COPY . .

RUN pnpm install --frozen-lockfile

# ---- build ----
FROM base AS builder
COPY --from=deps /app ./
RUN pnpm --filter cms build

# ---- run ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 1337
CMD ["pnpm", "--filter", "cms", "start"]
