#!/bin/bash
set -e

APP_NAME="maxim-production-tg"
APP_DIR="/var/www/$APP_NAME"
REPO_URL="https://github.com/vanyok174/maxim-production-tg.git"
DOMAIN="exlius.ru"
BASE_PATH="/mxprod"
PORT=3847

BOT_TOKEN="7043462076:AAFM0L5xfMw92EcR3Zh4ESR7tIspPi63s3c"
ADMIN_TG_ID="458454663"

echo "=== Деплой $APP_NAME на $DOMAIN$BASE_PATH/ ==="

# 1. Клонируем или обновляем репо
if [ -d "$APP_DIR" ]; then
  echo "→ Обновляем репозиторий..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/main
else
  echo "→ Клонируем репозиторий..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# 2. Устанавливаем зависимости
echo "→ Устанавливаем зависимости..."
npm install --cache ./.npm-cache

# 3. Создаём .env
echo "→ Создаём .env..."
cat > .env << EOF
PUBLIC_BASE_PATH=$BASE_PATH/
PORT=$PORT
SQLITE_PATH=./data/app.db
BOT_TOKEN=$BOT_TOKEN
ADMIN_TELEGRAM_IDS=$ADMIN_TG_ID
EOF

# 4. Создаём client/.env
echo "→ Создаём client/.env..."
echo "VITE_BASE_PATH=$BASE_PATH/" > client/.env

# 5. Импортируем данные (если БД ещё нет)
if [ ! -f "./data/app.db" ]; then
  echo "→ Импортируем seed..."
  npm run import-seed -w server -- ../seed.json
else
  echo "→ БД уже существует, пропускаем импорт"
fi

# 6. Собираем проект
echo "→ Собираем проект..."
npm run build

# 7. Создаём systemd сервис
echo "→ Настраиваем systemd..."
sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null << EOF
[Unit]
Description=$APP_NAME Telegram Mini App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server/dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME
sudo systemctl restart $APP_NAME

echo "→ Сервис запущен"
sudo systemctl status $APP_NAME --no-pager || true

# 8. Выводим конфиг nginx
echo ""
echo "=========================================="
echo "ДОБАВЬ В КОНФИГ NGINX (сайт $DOMAIN):"
echo "=========================================="
cat << 'NGINX'

location /mxprod/ {
    proxy_pass http://127.0.0.1:3847/mxprod/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

NGINX
echo "=========================================="
echo "После добавления выполни:"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "Затем в @BotFather → Menu Button:"
echo "  https://$DOMAIN$BASE_PATH/"
echo "=========================================="
echo ""
echo "✅ Деплой завершён!"
