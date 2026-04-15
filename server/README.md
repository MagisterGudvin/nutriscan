# NutriForce Server (Node.js)

Замена Cloudflare Worker'у на российском хостинге. Логика 1-в-1 с `worker/worker.js`.

## Что внутри
- `server.js` — Express-сервер: `/api/analyze`, `/data/:file` (GET/PUT), `/health`.
- `Dockerfile` — образ для Timeweb Cloud Apps / любого Docker-хостинга.
- `package.json` — единственная runtime-зависимость: `express`. Node 20+.

## Локальный запуск (для проверки)
```bash
cd server
cp .env.example .env   # вписать TIMEWEB_TOKEN и GITHUB_TOKEN
npm install
node --env-file=.env server.js
# → http://localhost:3000/health
```

## Деплой на Timeweb Cloud Apps (рекомендуемый путь)

1. **Создать приложение**:
   Timeweb Панель → Облако → Приложения → «Создать приложение».
   - Источник: GitHub (привязать репозиторий `nutriscan`)
   - Корневая директория: `server`
   - Тип: **Docker** (Timeweb сам найдёт `Dockerfile`)
   - Регион: Москва / СПб
   - Тариф: минимальный (256 МБ хватает с запасом)

2. **Environment Variables** (вкладка «Переменные окружения»):
   ```
   PORT=3000
   ALLOWED_ORIGIN=*
   TIMEWEB_AGENT_ID=d43b70f8-5d42-476b-9de3-1ccdeac62b78
   TIMEWEB_TOKEN=<тот же токен, что был в wrangler secret>
   GITHUB_REPO=MagisterGudvin/nutri-data
   GITHUB_BRANCH=main
   GITHUB_TOKEN=<fine-grained PAT, Contents:RW>
   ```
   `TIMEWEB_TOKEN` — берётся в Timeweb → Cloud AI → ваш агент → «API-ключи».
   `GITHUB_TOKEN` — github.com → Settings → Developer settings → Fine-grained tokens →
   только репозиторий `nutri-data`, права `Contents: Read and write`.

3. **Деплой**: жмёте «Развернуть». Timeweb соберёт образ, поднимет контейнер,
   выдаст домен вида `https://nutri-server-xxxx.twc1.net`.

4. **Проверка**:
   ```
   curl https://nutri-server-xxxx.twc1.net/health
   curl https://nutri-server-xxxx.twc1.net/data/users.json
   ```

5. **Кастомный домен** (по желанию): в настройках приложения «Домены» →
   привязать `api.nutriforce.ru` (или любой ваш). Timeweb выдаст бесплатный
   Let's Encrypt автоматически.

## Переключение фронта

В `js/config.js`:
```js
window.NUTRI_CONFIG = {
  WORKER_URL: 'https://nutri-server-xxxx.twc1.net'  // или https://api.nutriforce.ru
};
```
Закоммитить + push. GitHub Pages (или новый российский статик-хостинг для фронта)
подхватит изменения. Старый Cloudflare Worker можно оставить на месяц «на всякий»,
потом удалить.

## Перенос фронта на Timeweb (опционально, но желательно)

GitHub Pages в РФ тоже троттлится. Самый простой путь:
1. Timeweb → Хостинг → залить содержимое `nutriscan/` (всё кроме `worker/` и `server/`)
   через FTP / git-deploy.
2. Привязать домен.

Альтернатива — Yandex Object Storage + CDN: заливаете статику как сайт,
получаете URL вида `https://nutriforce.website.yandexcloud.net`.

## Откат
Если что-то пойдёт не так — в `js/config.js` вернуть старый
`https://nutri-worker.michaelgublin.workers.dev`. Cloudflare-воркер не трогаем
до полной валидации Timeweb-версии.
