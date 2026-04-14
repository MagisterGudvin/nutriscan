# NutriCheck

Веб-приложение для анализа питания студентов. Чистый HTML/CSS/JS без сборки и npm,
бэкендом служит Cloudflare Worker, который проксирует запросы к Timeweb AI Agent
и хранит данные в JSON-файлах внутри отдельного GitHub-репозитория.

**Никакие данные пользователей не хранятся в `localStorage`** — всё лежит в репо
с данными, фронтенд держит только in-memory кэш и токен текущей сессии в
`sessionStorage` (per-tab).

---

## Архитектура

```
┌────────────────┐    HTTPS     ┌──────────────────┐    GitHub API   ┌──────────────────┐
│ GitHub Pages   │ ───────────► │ Cloudflare Worker│ ───────────────►│ data-репозиторий │
│ (статика SPA)  │              │ (api + storage)  │                 │ users/reports/…  │
└────────────────┘              └──────────────────┘                 └──────────────────┘
                                         │
                                         │  Timeweb AI
                                         ▼
                                ┌──────────────────┐
                                │  AI Agent (LLM)  │
                                └──────────────────┘
```

* **Фронтенд** — этот репозиторий, деплоится на GitHub Pages.
* **Worker** — каталог `worker/`, деплоится в Cloudflare через wrangler.
* **Данные** — отдельный приватный GitHub-репозиторий, хранит:
  * `data/users.json`
  * `data/reports.json`
  * `data/products_override.json`

---

## Требования к репозиторию с данными

Создайте отдельный приватный репозиторий, например `your-username/nutri-data`,
с такой структурой:

```
nutri-data/
└── data/
    ├── users.json              # []
    ├── reports.json            # {}
    └── products_override.json  # []
```

Worker сам создаёт/обновляет файлы через GitHub Contents API.

---

## Деплой

### 1. Cloudflare Worker

В Cloudflare Dashboard:

1. Создайте API Token с правами `Edit Cloudflare Workers`.
2. Скопируйте Account ID.

В GitHub-репозитории этого фронтенда добавьте **Secrets** (Settings → Secrets and variables → Actions):

| Имя                  | Назначение                                                    |
|----------------------|---------------------------------------------------------------|
| `CLOUDFLARE_API_TOKEN` | API-токен Cloudflare с правами на воркеры                  |
| `CLOUDFLARE_ACCOUNT_ID`| Account ID из Cloudflare                                   |
| `GH_DATA_TOKEN`        | Fine-grained PAT с правами `Contents: Read & Write` на data-репо |
| `TIMEWEB_TOKEN`        | Bearer-токен Timeweb AI Agent                              |

В `worker/wrangler.toml` укажите свой `GITHUB_REPO`.

После пуша в `main` workflow `Deploy Cloudflare Worker` сам зальёт воркер
и пробросит секреты.

Альтернативно — локально:

```bash
cd worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put TIMEWEB_TOKEN
npx wrangler deploy
```

После деплоя получите URL вида `https://nutri-worker.your-subdomain.workers.dev`.

### 2. GitHub Pages (фронтенд)

В **Settings → Pages** включите Source: `GitHub Actions`.

В **Settings → Secrets and variables → Actions → Variables** добавьте:

| Имя          | Значение                                            |
|--------------|-----------------------------------------------------|
| `WORKER_URL` | URL вашего воркера, например `https://nutri-worker.your-subdomain.workers.dev` |

Workflow `Deploy to GitHub Pages` подставит URL в `js/config.js` на сборке.

Альтернативно — отредактируйте `js/config.js` вручную и закоммитьте.

### 3. Готово

После двух workflow'ов фронтенд доступен по адресу
`https://<user>.github.io/<repo>/` и общается с воркером, который пишет данные
в data-репозиторий.

---

## Локальный запуск

```powershell
./serve.ps1
```

Откроется на `http://localhost:8080`. Не забудьте указать рабочий
`WORKER_URL` в `js/config.js` (или временно поднять воркер локально через
`npx wrangler dev`).

---

## Учётка преподавателя

Логин `teacher`, пароль `teacher123` (захардкожены в `js/auth.js`).
Студенты регистрируются сами через форму регистрации.
