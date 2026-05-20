# --- Stage 1: Builder ---
FROM node:24-alpine AS builder

WORKDIR /build

# API_REWRITE_TARGET is evaluated at build time by Next.js rewrites()
ARG API_REWRITE_TARGET=http://localhost:8000/api/:path*
ENV API_REWRITE_TARGET=$API_REWRITE_TARGET

# Install deps first (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# --- Stage 2: Runtime ---
FROM node:24-alpine

WORKDIR /app

# Copy build artifacts and runtime config
COPY --from=builder /build/.next .next
COPY --from=builder /build/public public
COPY --from=builder /build/package.json .
COPY --from=builder /build/package-lock.json* .
COPY --from=builder /build/next.config.ts .
COPY --from=builder /build/tsconfig.json .

# Install production deps only
RUN npm ci --omit=dev

ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Health check via wget (alpine has no curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --spider http://localhost:3000/ || exit 1

CMD ["node", "node_modules/.bin/next", "start", "-p", "3000"]