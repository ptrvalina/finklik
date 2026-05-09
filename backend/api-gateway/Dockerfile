# syntax=docker/dockerfile:1
# Контекст сборки — корень репозитория (render.yaml: dockerContext: .).
# Фронт собирается в образ и раздаётся с того же хоста, что и API (same-origin на Render).

FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/web/package.json frontend/web/package-lock.json ./
RUN npm ci
COPY frontend/web/ ./
ENV VITE_BASE_PATH=/
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
COPY backend/api-gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/api-gateway/ .
COPY --from=web /web/dist ./static/spa
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
