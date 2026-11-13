# Telegram-бот и сайт с фотографиями

Версии поддерживаются совместимыми как память

- `/v1/` (гала-концерт весна 2026) — первая версия с вращающимися фотографиями. Показываются только недавно загруженные фото.
- `/v2/` (гала-концерт осень 2026) — неподвижная фотодоска. Все одобренные фотографии остаются на доске без ограничения по давности. Новые фотографии перекрывают старые, а старые постепенно затемняются.

## Запуск

1. Запустите Docker Desktop или Docker Engine с Compose v2.
2. Если файла `.env` ещё нет, скопируйте `.env.example` в `.env`. Заполните `BOT_TOKEN`, `ADMIN_CHAT` и `SUPPORT_CHAT`. Задайте случайные значения для `POSTGRES_PASSWORD` и `API_WRITE_TOKEN`.
3. Положите ключ сервисного аккаунта Google Cloud Vision в корень проекта под именем `google_key.json`.
4. Выполните в корне проекта: `docker compose up --build -d`

## Разработка в Docker

```sh
docker compose -f compose.dev.yml up --build
```

Сайт доступен на http://localhost:5173. Сервер перезапускается при изменении файлов в `server`, бот — при изменении файлов в `bot`. Запросы API идут через прокси Vite.

Dev-режим использует те же тома базы и фотографий, что и основной Compose. Для остановки:

```sh
docker compose -f compose.dev.yml down
```

Для возврата к обычному запуску:

```sh
docker compose up --build -d --remove-orphans
```

## Развертывание

В docker на сервере. Перенести файлы на сервер (вместе с .env и google_key.json) можно командой

```sh
rsync -avz --delete --progress \
  --exclude='.git/' \
  --exclude='.venv/' \
  --exclude='__pycache__/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='sharedImages/' \
  ./ user@server:/picture_bot/
```

Собрать/пересобрать и запустить на сервере:

```sh
docker compose up -d --build
```

