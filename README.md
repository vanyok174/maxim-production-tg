# maxim-production-tg

Telegram Mini App + API: учёт сборки по сценарию «админ выбирает сотрудника, вводит строки артикул × количество». Справочники — из seed/импорта; средние продажи — обновление по Wildberries Statistics API.

## Ветки

- `main` — стабильные релизы
- `develop` — текущая разработка

```bash
git checkout develop
```

## Требования

- Node 20+
- Токен бота (`@BotFather`), HTTPS-домен

## Быстрый старт (локально)

```bash
cp .env.example .env
# Заполни BOT_TOKEN, ADMIN_TELEGRAM_IDS (свой telegram user id)
# Для браузера без TG: DEV_SKIP_AUTH=1
cp .env.example client/.env
# В client/.env: VITE_BASE_PATH=/

npm install
npm run import-seed -- ./seed.example.json
npm run dev
```

- API: http://localhost:3847/api/me (с заголовком `X-Telegram-Init-Data` или с `DEV_SKIP_AUTH`)
- Web (dev): Vite прокси на API — см. `client/vite.config.ts`

## Сборка под VPS (подпуть, не корень сайта)

1. В `.env` (корень) и `client/.env`:

   `PUBLIC_BASE_PATH=/prod-uchet/`  
   `VITE_BASE_PATH=/prod-uchet/`

2. `npm run build` — клиент соберётся в `client/dist`, сервер в `server/dist`.

3. На VPS запуск (например systemd): `node server/dist/index.js` из корня репозитория, `WorkingDirectory` = корень, переменные окружения из `.env`.

4. **Nginx** — сайт на `/`, приложение на префиксе:

```nginx
location /prod-uchet/ {
    proxy_pass http://127.0.0.1:3847/prod-uchet/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

5. В BotFather → Bot → Web App: URL `https://твой-домен.ru/prod-uchet/` (со слэшем в конце по желанию — главное совпадение с `PUBLIC_BASE_PATH`).

## Импорт из таблицы

Пока: JSON как в `seed.example.json` или выгрузка в такой формат. Команда:

```bash
npm run import-seed -- /path/to/seed.json
```

Или после деплоя: `POST /prod-uchet/api/admin/import` (тело как в seed, только админ из `ADMIN_TELEGRAM_IDS` + валидный `initData`).

## Wildberries

Нужен токен с доступом к **statistics-api** (как для отчётов/продаж). Кнопка в UI «Обновить средние продажи» дергает `POST .../api/admin/sync-wb-sales`. Поле `wbSupplierArticle` в артикуле должно совпадать с `supplierArticle` в ответах WB (или совпадёт по `name`).

Документация: [dev.wildberries.ru](https://dev.wildberries.ru) (раздел аналитика / statistics-api).

## Связанный проект (контекст заказчика)

Логика и прототип таблицы: репозиторий «Максим учет работ», файл `artifacts/prototype-logic.md` и скрипты `production-system-prototype`.
