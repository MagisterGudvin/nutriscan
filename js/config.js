/* ============================================
   NutriForce — Runtime Config
   --------------------------------------------
   Этот файл задаёт URL Cloudflare Worker'а.
   Меняется один раз после деплоя воркера.
   ============================================ */
window.NUTRI_CONFIG = {
  // URL бэкенда. Сейчас живёт на Timeweb Cloud Apps в РФ —
  // быстрее и без блокировок CF/GitHub Pages.
  // Старый Cloudflare-воркер: https://nutri-worker.michaelgublin.workers.dev
  // (оставлен включённым как страховка, можно удалить через неделю стабильной работы)
  WORKER_URL: 'https://api.nutriforce.ru'
};
