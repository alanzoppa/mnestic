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

# --- Stage 2: Runtime (standalone) ---
FROM node:24-alpine

WORKDIR /app

# Copy standalone server + static assets only.
# Standalone mode bundles only the needed node_modules into .next/standalone,
# so we don't need a separate npm ci --omit=dev step (~700 MB → ~30 MB).
COPY --from=builder /build/.next/standalone ./
COPY --from=builder /build/.next/static ./.next/static
COPY --from=builder /build/public public

ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Health check via wget (alpine has no curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]