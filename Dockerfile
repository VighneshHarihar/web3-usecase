# ── build ─────────────────────────────────────────────
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY e2e/package.json ./e2e/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @loyallink/web build && pnpm --filter @loyallink/api build

# ── runtime: self-contained bundle, no node_modules ──
FROM node:22-slim
ENV NODE_ENV=production PORT=8080 WEB_DIST=/app/web LOG_PRETTY=false
WORKDIR /app/api
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/drizzle ./drizzle
COPY --from=build /app/apps/web/dist /app/web
RUN mkdir -p /app/api/.deployments && chown node /app/api/.deployments
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
