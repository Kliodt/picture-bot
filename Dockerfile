FROM node:22-bookworm-slim AS website
WORKDIR /build
COPY website/package.json website/package-lock.json ./
RUN npm ci
COPY website/ ./
RUN npm run build

FROM python:3.13-slim-bookworm AS python-base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM python-base AS development
RUN pip install --no-cache-dir watchfiles==1.1.1
RUN mkdir -p /app/static
ENV STATIC_DIR=/app/static

FROM python-base AS production
COPY bot/ ./bot/
COPY server/ ./server/
COPY --from=website /build/dist/ ./server/static/
CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
