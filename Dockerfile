FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN npm install -g pnpm
COPY package*.json ./
RUN pnpm install --prod
COPY --from=builder /app/dist ./dist
VOLUME ["/app/data", "/app/config"]
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]