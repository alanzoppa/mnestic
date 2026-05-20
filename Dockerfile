# --- Stage 1: Builder ---
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build deps needed for torch/numpy/scikit-learn compilation
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        g++ \
        && rm -rf /var/lib/apt/lists/*

# Create venv and install Python deps
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Stage 2: Runtime ---
FROM python:3.11-slim

WORKDIR /app

# Runtime deps: libgomp1 for OpenMP (PyTorch), curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgomp1 \
        curl \
        && rm -rf /var/lib/apt/lists/*

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy backend source
COPY backend/ .

# Create data directories (will be overridden by bind mounts at runtime)
RUN mkdir -p /data/chroma_data /data/notes /data/images /data/data /data/logs

# Health check via /api/health (lightweight, no ChromaDB query)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Single uvicorn worker — ChromaDB PersistentClient is not thread-safe
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]