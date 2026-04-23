FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

# Copy workspace manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install

# Copy source (node_modules and dist excluded via .dockerignore)
COPY backend ./backend
COPY frontend ./frontend

# Build backend (outputs to /app/dist via outDir: "../dist")
RUN cd backend && pnpm build

# Build frontend (outputs to /app/frontend/dist)
RUN cd frontend && pnpm build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
RUN pnpm install --prod --filter primecache-backend
COPY --from=builder /app/backend/dist ./backend/dist
# Ensure migrations directory exists and is copied
RUN mkdir -p ./backend/dist/db/migrations
COPY --from=builder /app/backend/db/migrations/ ./backend/dist/db/migrations/
COPY --from=builder /app/frontend/dist ./frontend/dist

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/data /app/config \
    && chown -R app:app /app
USER app

VOLUME ["/app/data", "/app/config"]
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/index.js"]
