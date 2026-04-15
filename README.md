# NutriForce

Веб-приложение для анализа питания и состояния кожи студентов. Чистый HTML/CSS/JS
без сборки и npm. Бэкендом служит небольшой Node.js-сервис (`server/`), который
проксирует запросы к Timeweb AI Agent и хранит данные в JSON-файлах отдельного
приватного GitHub-репозитория.

Фронт держит **in-memory кэш + localStorage-зеркало** (только для отказоустойчивости
в РФ-сети — при падении бэкенда даёт вход в read-only режиме). Сессия — в
`sessionStorage` (per-tab).

---

## Архитектура

```
┌────────────────┐   HTTPS    ┌──────────────────┐   GitHub API   ┌──────────────────┐
│ Frontend (SPA) │ ─────────► │ Node.js backend  │ ─────────────► │ data-репозиторий │
│ GH Pages /     │            │ (Timeweb Cloud   │                │ users/reports/…  │
│ Timeweb Хостинг│            │  Apps, Docker)   │                │                  │
└────────────────┘            └──────────────────┘                └──────────────────┘
                                       │
                                       │  Bearer-токен агента
                                       ▼
                              ┌──────────────────┐
                              │ Timeweb AI Agent │
                              │ (LLM + Скурихин  │
                              │  + МР 2.3.1.0253)│
                              └──────────────────┘
```

* **Фронтенд** — этот репозиторий, деплоится на GitHub Pages workflow-ом
  `deploy-pages.yml`.
* **Бэкенд** — каталог `server/`, разворачивается на Timeweb Cloud Apps через
  `Dockerfile`. Подробности — `server/README.md`.
* **Данные** — отдельный приватный GitHub-репозиторий, хранит:
  * `data/users.json`
  * `data/reports.json`
  * `data/products_override.json`

> **История.** До апреля 2026 бэкенд жил на Cloudflare Workers. Из-за троттлинга
> CF в РФ переехали на Timeweb. Код воркера доступен в истории git до коммита,
> предшествующего удалению `worker/`.

---

## Требования к репозиторию с данными

Создайте отдельный приватный репозиторий, например `your-username/nutri-data`,
со структурой:

```
nutri-data/
└── data/
    ├── users.json              # []
    ├── reports.json            # {}
    └── products_override.json  # []
```

Сервер сам создаёт/обновляет файлы через GitHub Contents API.

---

## Деплой

### 1. Бэкенд — Timeweb Cloud Apps

Подробная пошаговая инструкция: [`server/README.md`](server/README.md).

Кратко: Timeweb → Облако → Приложения → «Создать» → тип **Docker** → источник
**GitHub** → репозиторий `nutriscan`, корневая директория `server`. Задайте
переменные окружения:

| Имя                | Назначение                                   |
|--------------------|----------------------------------------------|
| `PORT`             | `3000`                                       |
| `ALLOWED_ORIGIN`   | `https://ваш-фронтенд-домен` (или `*`)       |
| `TIMEWEB_AGENT_ID` | ID агента Timeweb AI                         |
| `TIMEWEB_TOKEN`    | Bearer-токен агента                          |
| `GITHUB_REPO`      | `your-username/nutri-data`                   |
| `GITHUB_BRANCH`    | `main`                                       |
| `GITHUB_TOKEN`     | fine-grained PAT, Contents: Read & Write     |

Timeweb выдаст технический домен (`*.twc1.net`) — привяжите свой (вкладка
«Домены», Let's Encrypt выдаётся автоматически).

### 2. Фронтенд — GitHub Pages

**Settings → Pages** → Source: `GitHub Actions`.

В `js/config.js` укажите URL вашего бэкенда:

```js
window.NUTRI_CONFIG = {
  WORKER_URL: 'https://api.your-domain.ru'
};
```

После пуша в `main` workflow `Deploy to GitHub Pages` (`deploy-pages.yml`)
опубликует сайт.

> При смене `WORKER_URL` увеличьте `?v=…` на `<script src="js/config.js?v=…">`
> в `index.html` — это cache-buster против 10-минутного Fastly-кэша GH Pages.

### 3. Альтернатива: фронтенд на российском хостинге

GitHub Pages в РФ нестабилен. Для продакшена рекомендуется перенести статику
на Timeweb Хостинг / Yandex Object Storage + CDN / VK Cloud Static. Просто
залейте содержимое этого репозитория (без `server/` и `.github/`) — это
обычный статический сайт.

---

## Локальный запуск фронта

```powershell
./serve.ps1
```

Откроется на `http://localhost:8080`. В `js/config.js` укажите URL работающего
бэкенда (Timeweb или локальный `http://localhost:3000`).

## Локальный запуск бэкенда

```bash
cd server
cp .env.example .env   # заполнить TIMEWEB_TOKEN + GITHUB_TOKEN
npm install
node --env-file=.env server.js
# → http://localhost:3000/health
```

---

## Учётка преподавателя

Логин `teacher`, пароль `teacher123` (захардкожены в `js/auth.js`).
Студенты регистрируются сами через форму регистрации.
