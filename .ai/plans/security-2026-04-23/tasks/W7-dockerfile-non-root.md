# W7 — Dockerfile: drop to non-root user

**Wave:** A (independent)
**Model:** `claude-haiku-4-5-20251001` — single-file mechanical edit.
**Findings:** F11 (Low)
**Status:** done

## Goal

Final container runs as a non-root user. Any future Playwright/Chromium or Node CVE lands at a lower privilege level inside the container.

## Changes

### `Dockerfile`

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
RUN pnpm install --prod --filter primecache-backend
COPY --from=builder /app/backend/dist ./backend/dist
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
```

## Definition of Done

- `docker run ... id` inside the image prints `uid=<non-zero> gid=<non-zero>`.
- Volumes `/app/data` and `/app/config` remain writable (chown set).
- `docker-compose up --build` boots the service, migrations run, HTTP 200 on `/health`.
- No code changes beyond the Dockerfile.
