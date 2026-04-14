/* ============================================
   NutriForce — Runtime Config
   --------------------------------------------
   Этот файл задаёт URL Cloudflare Worker'а.
   Меняется один раз после деплоя воркера.
   ============================================ */
window.NUTRI_CONFIG = {
  // URL вашего Cloudflare Worker (без слеша на конце)
  WORKER_URL: 'nutri-worker.michaelgublin.workers.dev'
};
