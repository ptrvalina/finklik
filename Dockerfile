# syntax=docker/dockerfile:1
# Важно: контекст сборки — корень репозитория (иначе COPY frontend/... не найдёт файлов).
# Локально: docker build -f Dockerfile .
# Render Dashboard → Docker: Context = `.` (или пусто), Dockerfile = `./Dockerfile`

FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/web/package.json frontend/web/package-lock.json ./
RUN npm ci
COPY frontend/web/ ./
ENV VITE_BASE_PATH=/
ENV NODE_OPTIONS=--max-old-space-size=4096
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
