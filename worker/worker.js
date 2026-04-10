/* ============================================
   NutriCheck — Cloudflare Worker
   ============================================ */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(body, status, contentType) {
  const headers = { ...CORS_HEADERS };
  if (contentType) headers['Content-Type'] = contentType;
  return new Response(body, { status, headers });
}

function jsonResponse(data, status) {
  return corsResponse(JSON.stringify(data), status || 200, 'application/json');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // POST /api/analyze
      if (path === '/api/analyze' && method === 'POST') {
        return handleAnalyze(request, env);
      }

      // GET /data/:file
      if (path.startsWith('/data/') && method === 'GET') {
        const file = path.slice(6);
        return handleGetData(env, file);
      }

      // PUT /data/:file
      if (path.startsWith('/data/') && method === 'PUT') {
        const file = path.slice(6);
        const body = await request.json();
        return handlePutData(env, file, body);
      }

      // GET /books/index
      if (path === '/books/index' && method === 'GET') {
        return handleListBooks(env);
      }

      // GET /books/:file
      if (path.startsWith('/books/') && method === 'GET') {
        const file = decodeURIComponent(path.slice(7));
        return handleGetBook(env, file);
      }

      // PUT /books/:file
      if (path.startsWith('/books/') && method === 'PUT') {
        const file = decodeURIComponent(path.slice(7));
        const content = await request.text();
        return handlePutBook(env, file, content);
      }

      // DELETE /books/:file
      if (path.startsWith('/books/') && method === 'DELETE') {
        const file = decodeURIComponent(path.slice(7));
        return handleDeleteBook(env, file);
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};

/* ---- Analyze (proxy to Timeweb AI Agent) ---- */
// In-memory кэш ответов агента (живёт пока isolate worker'а активен)
const ANALYZE_CACHE = new Map();
const ANALYZE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 час
const ANALYZE_CACHE_MAX = 200;

function analyzeCacheKey(body) {
  const m = body.meals || {};
  const n = body.norms || {};
  // Не включаем справочник преподавателя в ключ — обычно стабилен,
  // и его изменение всё равно даст другой ответ только при совпадении блюд.
  return JSON.stringify({
    b: (m.breakfast || '').trim().toLowerCase(),
    l: (m.lunch || '').trim().toLowerCase(),
    s: (m.snack || '').trim().toLowerCase(),
    d: (m.dinner || '').trim().toLowerCase(),
    n: { c: n.calories|0, p: n.protein|0, f: n.fat|0, ch: n.carbs|0 }
  });
}

function getCached(key) {
  const hit = ANALYZE_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > ANALYZE_CACHE_TTL_MS) {
    ANALYZE_CACHE.delete(key);
    return null;
  }
  return hit.v;
}

function setCached(key, value) {
  if (ANALYZE_CACHE.size >= ANALYZE_CACHE_MAX) {
    // Простой LRU-подобный сброс: удаляем самую старую запись
    const firstKey = ANALYZE_CACHE.keys().next().value;
    if (firstKey) ANALYZE_CACHE.delete(firstKey);
  }
  ANALYZE_CACHE.set(key, { t: Date.now(), v: value });
}

async function handleAnalyze(request, env) {
  const body = await request.json();

  // Cache lookup
  const cacheKey = analyzeCacheKey(body);
  const cached = getCached(cacheKey);
  if (cached) {
    return jsonResponse(Object.assign({}, cached, { _cached: true }));
  }

  const prompt = buildAnalysisPrompt(body);

  const agentId = env.TIMEWEB_AGENT_ID;
  if (!agentId) {
    return jsonResponse({ error: 'TIMEWEB_AGENT_ID not configured' }, 500);
  }

  const endpoint = `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${agentId}/v1/chat/completions`;

  const systemPrompt = buildSystemPrompt();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TIMEWEB_TOKEN}`
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2500
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse({ error: 'AI service error', details: errText }, 502);
  }

  const result = await response.json();

  let content = '';
  if (result.choices && result.choices[0]) {
    content = result.choices[0].message?.content || '';
  } else if (result.result) {
    content = result.result;
  } else if (typeof result === 'string') {
    content = result;
  }

  // Strip markdown code blocks if present
  content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch (e2) {}
    }
  }

  if (!parsed) {
    return jsonResponse({
      totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      deficits: [],
      imbalances: [],
      recommendations: ['Не удалось проанализировать рацион. Попробуйте описать блюда подробнее.'],
      sources: [],
      raw: content
    });
  }

  const adapted = adaptAgentResponse(parsed);
  // Если продукт совпадает с записью в teacher's справочнике — перекрываем source/detail оттуда
  if (Array.isArray(body.products) && adapted.sources) {
    const dict = body.products.filter(p => p && p.name);
    adapted.sources = adapted.sources.map(s => {
      if (!s || !s.product) return s;
      const name = String(s.product).toLowerCase();
      const hit = dict.find(p => name.indexOf(String(p.name).toLowerCase()) !== -1 || String(p.name).toLowerCase().indexOf(name) !== -1);
      if (hit && hit.source) {
        return Object.assign({}, s, {
          source: hit.source,
          detail: hit.detail || s.detail || ''
        });
      }
      return s;
    });
  }
  setCached(cacheKey, adapted);
  return jsonResponse(adapted);
}

/* Адаптирует ответ Timeweb-агента к схеме фронта.
   Агент может вернуть либо плоский { totals, deficits, ... },
   либо детальный { meals: { breakfast:[{product, calories, ...}], ... }, totals, ... } */
function adaptAgentResponse(p) {
  const out = {
    totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    deficits: Array.isArray(p.deficits) ? p.deficits : [],
    imbalances: Array.isArray(p.imbalances) ? p.imbalances : [],
    recommendations: Array.isArray(p.recommendations) ? p.recommendations : [],
    sources: []
  };

  // 1) Если агент уже отдал готовые totals — используем их
  if (p.totals && typeof p.totals === 'object') {
    out.totals.calories = num(p.totals.calories);
    out.totals.protein  = num(p.totals.protein);
    out.totals.fat      = num(p.totals.fat);
    out.totals.carbs    = num(p.totals.carbs);
    if (p.totals.omega3 != null) out.totals.omega3 = num(p.totals.omega3);
    if (p.totals.omega6 != null) out.totals.omega6 = num(p.totals.omega6);
  }

  // 2) Если есть детализация по блюдам — суммируем + собираем sources
  if (p.meals && typeof p.meals === 'object' && !Array.isArray(p.meals)) {
    let sum = { calories: 0, protein: 0, fat: 0, carbs: 0, omega3: 0, omega6: 0 };
    let any = false;
    for (const meal of Object.values(p.meals)) {
      if (!Array.isArray(meal)) continue;
      for (const item of meal) {
        if (!item || typeof item !== 'object') continue;
        any = true;
        sum.calories += num(item.calories);
        sum.protein  += num(item.protein);
        sum.fat      += num(item.fat);
        sum.carbs    += num(item.carbs);
        sum.omega3   += num(item.omega3);
        sum.omega6   += num(item.omega6);
        if (item.product) {
          let rawSrc = item.source || 'Оценка преподавателя';
          if (/^оценка$/i.test(String(rawSrc).trim())) rawSrc = 'Оценка преподавателя';
          const sd = splitSourceDetail(rawSrc, item.detail);
          out.sources.push({
            product: item.product,
            value: `${num(item.calories)} ккал, Б${num(item.protein)} Ж${num(item.fat)} У${num(item.carbs)}`,
            source: sd.source,
            detail: sd.detail
          });
        }
      }
    }
    if (any && (!p.totals || !num(p.totals.calories))) {
      out.totals.calories = round(sum.calories);
      out.totals.protein  = round(sum.protein);
      out.totals.fat      = round(sum.fat);
      out.totals.carbs    = round(sum.carbs);
      out.totals.omega3   = round1(sum.omega3);
      out.totals.omega6   = round1(sum.omega6);
    }
  }

  // 3) Если агент сам отдал sources — берём их (с нормализацией "Оценка" и сплитом source/detail)
  if (Array.isArray(p.sources) && p.sources.length) {
    out.sources = p.sources.map(function(s) {
      if (!s || typeof s !== 'object') return s;
      var src = s.source || '';
      if (/^оценка$/i.test(String(src).trim())) src = 'Оценка преподавателя';
      var sd = splitSourceDetail(src, s.detail);
      return Object.assign({}, s, { source: sd.source, detail: sd.detail });
    });
  }

  return out;
}

/* Если агент кладёт source одной строкой типа
   "Скурихин, табл. 6.6.4 (ЗЕРНО..., стр. 148)" — разделяем на
   source ("Скурихин") и detail ("табл. 6.6.4 (ЗЕРНО..., стр. 148)"). */
function splitSourceDetail(rawSource, rawDetail) {
  let source = String(rawSource || '').trim();
  let detail = String(rawDetail || '').trim();
  if (!source) return { source, detail };
  if (detail) return { source, detail };

  const m = source.match(/^(.*?)[,;:\s]+((?:табл|стр|раздел|глав|разд\.|табл\.|стр\.)[^\n]*)$/i);
  if (m) {
    return { source: m[1].trim().replace(/[,;:]+$/, ''), detail: m[2].trim() };
  }
  return { source, detail };
}

function num(v) {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}
function round(v) { return Math.round(v); }
function round1(v) { return Math.round(v * 10) / 10; }


function buildSystemPrompt() {
  // Полная инструкция должна быть задана в самом агенте Timeweb (dashboard).
  // Здесь оставляем короткое напоминание — это резко уменьшает время ответа.
  return 'Ты — нутрициолог-аналитик NutriCheck. Используй подключённую базу знаний (Скурихин) и приоритетный справочник преподавателя из user-сообщения. Возвращай ТОЛЬКО один JSON-объект по схеме из настроек агента, без markdown и без текста вокруг. source = только название книги, detail = только таблица/страница.';
}

function buildAnalysisPrompt(body) {
  const m = body.meals || {};
  const n = body.norms || {};

  let prompt = 'РАЦИОН:\n';
  if (m.breakfast) prompt += `Завтрак: ${m.breakfast}\n`;
  if (m.lunch)     prompt += `Обед: ${m.lunch}\n`;
  if (m.snack)     prompt += `Полдник: ${m.snack}\n`;
  if (m.dinner)    prompt += `Ужин: ${m.dinner}\n`;

  if (n.calories) {
    prompt += `\nНОРМЫ: ${n.calories} ккал, Б${n.protein} Ж${n.fat} У${n.carbs}`;
    if (n.omega3 != null) prompt += `, Ω3≥${n.omega3}`;
    if (n.omega6 != null) prompt += `, Ω6≤${n.omega6}`;
    prompt += '\n';
  }

  if (Array.isArray(body.products) && body.products.length) {
    prompt += '\nСПРАВОЧНИК ПРЕПОДАВАТЕЛЯ (приоритет, на 100 г):\n';
    body.products.slice(0, 25).forEach(p => {
      let line = `- ${p.name}: ${p.calories}/${p.protein}/${p.fat}/${p.carbs}`;
      if (p.source) line += ` [${p.source}${p.detail ? ', ' + p.detail : ''}]`;
      prompt += line + '\n';
    });
  }

  prompt += '\nВерни JSON по схеме из системной инструкции. Никакого текста вокруг.';
  return prompt;
}

/* ---- GitHub Data Storage ---- */
async function githubRequest(env, path, method, body, contentType) {
  const headers = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'NutriCheck-Worker',
  };
  if (contentType) headers['Content-Type'] = contentType;

  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || 'main'}`;

  const opts = { method: method || 'GET', headers };
  if (body) opts.body = JSON.stringify(body);

  return fetch(url, opts);
}

async function getGithubFile(env, path) {
  const resp = await githubRequest(env, path, 'GET');
  if (!resp.ok) return null;
  const data = await resp.json();
  // base64 → UTF-8 (атоб даёт latin-1 binary string, нужно перекодировать в UTF-8)
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const content = new TextDecoder('utf-8').decode(bytes);
  return { content, sha: data.sha };
}

async function putGithubFile(env, path, content, message) {
  // Get current sha
  const existing = await getGithubFile(env, path);
  const body = {
    message: message || `Update ${path}`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: env.GITHUB_BRANCH || 'main'
  };
  if (existing) body.sha = existing.sha;

  const resp = await githubRequest(env, path, 'PUT', body, 'application/json');
  return resp.ok;
}

async function deleteGithubFile(env, path) {
  const existing = await getGithubFile(env, path);
  if (!existing) return false;

  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'NutriCheck-Worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Delete ${path}`,
      sha: existing.sha,
      branch: env.GITHUB_BRANCH || 'main'
    })
  });
  return resp.ok;
}

/* ---- Data handlers ---- */
async function handleGetData(env, file) {
  const result = await getGithubFile(env, `data/${file}`);
  if (!result) return jsonResponse([], 200);
  try {
    return jsonResponse(JSON.parse(result.content));
  } catch {
    return jsonResponse([], 200);
  }
}

async function handlePutData(env, file, data) {
  const content = JSON.stringify(data, null, 2);
  const ok = await putGithubFile(env, `data/${file}`, content, `Update ${file}`);
  return jsonResponse({ success: ok });
}

/* ---- Books handlers ---- */
async function handleListBooks(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/books?ref=${env.GITHUB_BRANCH || 'main'}`;
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'NutriCheck-Worker',
    }
  });

  if (!resp.ok) return jsonResponse([]);

  const files = await resp.json();
  if (!Array.isArray(files)) return jsonResponse([]);

  const names = files
    .filter(f => f.name.endsWith('.md'))
    .map(f => f.name);

  return jsonResponse(names);
}

async function handleGetBook(env, file) {
  const result = await getGithubFile(env, `books/${file}`);
  if (!result) return corsResponse('Not found', 404, 'text/plain');
  return corsResponse(result.content, 200, 'text/plain; charset=utf-8');
}

async function handlePutBook(env, file, content) {
  const ok = await putGithubFile(env, `books/${file}`, content, `Upload book ${file}`);
  return jsonResponse({ success: ok });
}

async function handleDeleteBook(env, file) {
  const ok = await deleteGithubFile(env, `books/${file}`);
  return jsonResponse({ success: ok });
}
