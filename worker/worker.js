/* ============================================
   NutriForce — Cloudflare Worker
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
  // Индексы кожи включаем — рекомендации зависят от них.
  const sk = {};
  ['skin_acne','skin_aging','skin_dryness','skin_seborrhea','skin_itch','skin_qol'].forEach(k => {
    if (n[k] != null) sk[k] = n[k];
  });
  return JSON.stringify({
    b: (m.breakfast || '').trim().toLowerCase(),
    l: (m.lunch || '').trim().toLowerCase(),
    s: (m.snack || '').trim().toLowerCase(),
    d: (m.dinner || '').trim().toLowerCase(),
    n: { c: n.calories|0, p: n.protein|0, f: n.fat|0, ch: n.carbs|0 },
    sk: sk
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
  const url = new URL(request.url);
  const noCache = url.searchParams.get('nocache') === '1' || body.nocache === true;

  // Cache lookup
  const cacheKey = analyzeCacheKey(body);
  if (!noCache) {
    const cached = getCached(cacheKey);
    if (cached) {
      return jsonResponse(Object.assign({}, cached, { _cached: true }));
    }
  } else {
    ANALYZE_CACHE.delete(cacheKey);
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
      max_tokens: 8000
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

  const parsed = extractJson(content);

  if (!parsed) {
    return jsonResponse({
      totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      deficits: [],
      imbalances: [],
      recommendations: ['Не удалось проанализировать рацион. Попробуйте описать блюда подробнее.'],
      sources: [],
      raw: (content || '').slice(0, 4000)
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
  // Не кэшируем "пустышки" (нулевые totals или пустые meals/sources) —
  // иначе один неудачный запрос отравит кэш на час.
  if (isMeaningfulAnalyze(adapted)) {
    setCached(cacheKey, adapted);
  }
  return jsonResponse(adapted);
}

function isMeaningfulAnalyze(r) {
  if (!r || !r.totals) return false;
  const t = r.totals;
  const hasNumbers = (t.calories || 0) > 0 || (t.protein || 0) > 0 || (t.fat || 0) > 0 || (t.carbs || 0) > 0;
  const hasSources = Array.isArray(r.sources) && r.sources.length > 0;
  return hasNumbers || hasSources;
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

  // 1) Если агент уже отдал готовые totals — копируем ВСЕ известные нутриенты
  if (p.totals && typeof p.totals === 'object') {
    ALL_NUTRIENT_KEYS.forEach(k => {
      if (p.totals[k] != null) out.totals[k] = num(p.totals[k]);
    });
  }

  // 2) Если есть детализация по блюдам — суммируем + собираем sources
  if (p.meals && typeof p.meals === 'object' && !Array.isArray(p.meals)) {
    const sum = {};
    ALL_NUTRIENT_KEYS.forEach(k => { sum[k] = 0; });
    let any = false;
    for (const meal of Object.values(p.meals)) {
      if (!Array.isArray(meal)) continue;
      for (const item of meal) {
        if (!item || typeof item !== 'object') continue;
        any = true;
        ALL_NUTRIENT_KEYS.forEach(k => { sum[k] += num(item[k]); });
        if (item.product) {
          let rawSrc = item.source || 'Оценка преподавателя';
          rawSrc = normalizeSourceLabel(rawSrc);
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
    // Заполняем per-key: если в p.totals ключа нет, подставляем сумму по блюдам.
    // Это важно, т.к. агент часто присылает макро в totals, но микро — только по продуктам.
    if (any) {
      const hasTotalKey = k => p.totals && p.totals[k] != null;
      const macroRound = { calories: round, protein: round1, fat: round1, carbs: round1, omega3: round2, omega6: round2 };
      MACRO_KEYS.forEach(k => {
        if (!hasTotalKey(k)) out.totals[k] = (macroRound[k] || round2)(sum[k]);
      });
      MICRO_KEYS.forEach(k => {
        if (!hasTotalKey(k)) out.totals[k] = round2(sum[k]);
      });
    }
  }

  // 3) Если агент сам отдал sources — берём их (с нормализацией "Оценка" и сплитом source/detail)
  if (Array.isArray(p.sources) && p.sources.length) {
    out.sources = p.sources.map(function(s) {
      if (!s || typeof s !== 'object') return s;
      var src = normalizeSourceLabel(s.source || '');
      var sd = splitSourceDetail(src, s.detail);
      return Object.assign({}, s, { source: sd.source, detail: sd.detail });
    });
  }

  return out;
}

/* Унификация лейбла источника. Любые варианты вроде "Оценка ИИ",
   "Оценка AI", "AI estimate", голое "Оценка" — превращаем в
   "Оценка преподавателя", чтобы UI/отчёты были консистентны. */
function normalizeSourceLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Оценка преподавателя';
  if (/^оценка(\s+(ии|и\.и\.|ai|gpt|llm|нейросет\w*|модел\w*))?$/i.test(s)) {
    return 'Оценка преподавателя';
  }
  if (/^(ai|llm)\s*(estimate|оценка)$/i.test(s)) {
    return 'Оценка преподавателя';
  }
  return s;
}

/* Несколько попыток вытащить JSON из ответа модели:
   1) очистить markdown-обёртки и попробовать JSON.parse целиком,
   2) вырезать первый сбалансированный {...} (учитывая вложенность и строки),
   3) жадный regex {[\s\S]*}. */
function extractJson(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  try { return JSON.parse(s); } catch (e) {}

  const balanced = sliceFirstJsonObject(s);
  if (balanced) {
    try { return JSON.parse(balanced); } catch (e) {}
  }

  const greedy = s.match(/\{[\s\S]*\}/);
  if (greedy) {
    try { return JSON.parse(greedy[0]); } catch (e) {}
  }

  // Попытка «зашить» обрезанный JSON (truncated ответ из-за max_tokens):
  // обрезаем хвост до ближайшей корректной позиции и закрываем скобки/строки.
  const salvaged = salvageTruncatedJson(s);
  if (salvaged) {
    try { return JSON.parse(salvaged); } catch (e) {}
  }
  return null;
}

function salvageTruncatedJson(s) {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  let lastValidEnd = -1;  // позиция последней "чистой" точки, где можно закрыть объект
  let braceStack = [];    // стек символов-брекетов
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{' || ch === '[') { braceStack.push(ch); depth++; }
    else if (ch === '}' || ch === ']') { braceStack.pop(); depth--; }
    if (!inStr && (ch === ',' || ch === '}' || ch === ']')) {
      lastValidEnd = i;
    }
  }
  if (lastValidEnd === -1) return null;
  let head = s.slice(start, lastValidEnd + 1);
  // Закрываем незакрытую строку
  if (inStr) head += '"';
  // Убираем висячую запятую
  head = head.replace(/,\s*$/, '');
  // Достраиваем парные закрывающие скобки в обратном порядке
  for (let i = braceStack.length - 1; i >= 0; i--) {
    head += braceStack[i] === '{' ? '}' : ']';
  }
  return head;
}

function sliceFirstJsonObject(s) {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
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
function round2(v) { return Math.round(v * 100) / 100; }

/* Реестр нутриентов (должен быть синхронизирован с js/nutrients.js).
   Держим здесь копию ключей — Worker изолирован от фронтовых модулей.
   Ключи без calories/protein/fat/carbs/omega3/omega6 (они обрабатываются отдельно). */
const MICRO_KEYS = [
  'vit_c','vit_b1','vit_b2','vit_b6','niacin','vit_b12','folate',
  'pantothenic','biotin','vit_a','beta_carotene','vit_e','vit_d','vit_k',
  'calcium','phosphorus','magnesium','potassium','sodium','chloride',
  'iron','zinc','iodine','copper','manganese','molybdenum','selenium',
  'chromium','cobalt','fluoride','silicon','vanadium',
  'inositol','l_carnitine','coq10','lipoic_acid','smm','orotic_acid','paba','choline'
];
const MACRO_KEYS = ['calories','protein','fat','carbs','omega3','omega6'];
const ALL_NUTRIENT_KEYS = MACRO_KEYS.concat(MICRO_KEYS);


function buildSystemPrompt() {
  // Самодостаточная инструкция со схемой — не зависим от того, что прописано
  // в dashboard агента. Без неё не-reasoning модели возвращают пустой/невалидный
  // JSON и фронт получает нули.
  return [
    'Ты — нутрициолог-аналитик NutriForce. Анализируй дневной рацион студента,',
    'опираясь на ДВА документа в подключённой базе знаний:',
    '  • Скурихин И. М. «Химический состав российских пищевых продуктов» —',
    '    источник КБЖУ и микронутриентов ПО ПРОДУКТАМ (на 100 г съедобной части).',
    '  • МР 2.3.1.0253-21 «Нормы физиологических потребностей в энергии и пищевых',
    '    веществах для различных групп населения РФ» — источник суточных норм',
    '    (RDA/UL) для оценки дефицитов, избытков и формулировки рекомендаций.',
    '',
    '=== ЖЕЛЕЗНЫЕ ПРАВИЛА ===',
    'A. КАЖДЫЙ продукт, перечисленный пользователем, ОБЯЗАН попасть в соответствующий',
    '   массив meals.breakfast/lunch/snack/dinner. ЗАПРЕЩЕНО молча выкидывать продукты,',
    '   даже если ты не уверен в КБЖУ.',
    'B. Перед тем как поставить source="Оценка преподавателя", ОБЯЗАТЕЛЬНО ищи',
    '   в Скурихине минимум по 2-3 вариантам названия:',
    '   "кофе" → "кофе натуральный жареный", "кофе растворимый", "напиток кофейный";',
    '   "хлеб" → "хлеб ржаной формовой", "хлеб пшеничный из муки 1 сорта";',
    '   "чай"  → "чай чёрный байховый", "чай зелёный".',
    '   Для любых коротких бытовых названий пробуй развёрнутые формы.',
    'C. Если в Скурихине нашёлся точный или близкий аналог — используй ЕГО значения,',
    '   source="Скурихин", в detail укажи таблицу/страницу. Если это аналог —',
    '   допиши "(аналог: <название из KB>)".',
    'D. source="Оценка преподавателя" допустим ТОЛЬКО как последний шанс, когда',
    '   ни одно название не дало результата в KB. Всё равно заполни КБЖУ своими',
    '   лучшими оценками — НЕ ставь нули в макро.',
    'E. ЗАПРЕЩЕНО возвращать полностью пустые meals, если пользователь что-то перечислил.',
    '   Пустой массив [] для приёма пищи допустим только если он реально не указан.',
    'F. Все значения нутриентов в meals[*] — за УКАЗАННУЮ ПОРЦИЮ (portion_g),',
    '   НЕ на 100 г. Если порция не указана — считай разумную бытовую порцию',
    '   (тарелка супа ~300 г, хлеб ломоть ~30 г, яйцо ~50 г и т. п.).',
    '',
    '=== ПРИОРИТЕТ ИСТОЧНИКОВ КБЖУ ===',
    '1) "Справочник преподавателя" из user-сообщения — высший приоритет.',
    '   Совпало — source/detail берутся ОТТУДА, не из KB.',
    '2) Скурихин (KB) — таблицы химического состава.',
    '3) Fallback — собственная оценка с source="Оценка преподавателя".',
    '',
    'Поле source = ТОЛЬКО название источника:',
    '  "Скурихин" | "База преподавателя" | "Оценка преподавателя".',
    'Поле detail = ТОЛЬКО локализация: "табл. 6.6.4, стр. 148" / "(аналог: …)".',
    'НЕ дублируй название источника в detail.',
    '',
    '=== РЕКОМЕНДАЦИИ И ДЕФИЦИТЫ (МР 2.3.1.0253-21) ===',
    'Поля deficits / imbalances / recommendations формируй, сравнивая totals с НОРМАМИ',
    'из user-сообщения (они уже посчитаны под пол/возраст/массу/активность студента',
    'на основе МР 2.3.1.0253-21). Дополнительно для рекомендаций сверяйся с самим',
    'документом МР 2.3.1.0253-21 в KB:',
    '  • для каждого нутриента, где факт <80% нормы → пункт в "deficits"',
    '    с указанием продуктов-источников из Скурихина (3-5 примеров с цифрами);',
    '  • факт >130% нормы (или >UL для микро, если МР задаёт верхний предел) →',
    '    пункт в "imbalances";',
    '  • в "recommendations" дай 3-6 практичных шагов: какие конкретные продукты',
    '    добавить/убрать сегодня-завтра, чтобы выйти к норме. Цитируй МР коротко',
    '    (например, "по МР 2.3.1.0253-21 норма Fe для женщин 18 мг/сут").',
    'Учитывай взаимосвязи: Ca↔витамин D, Fe↔витамин C, Mg↔B6, Zn↔Cu, Na↔K.',
    '',
    '=== СВЯЗЬ С СОСТОЯНИЕМ КОЖИ ===',
    'Если пользователь указал в норме индексы кожи (skin_acne, skin_aging, skin_dryness,',
    'skin_seborrhea, skin_itch — шкала 0-10), добавь в recommendations отдельные пункты',
    'по принципам:',
    '  • acne ≥5 → Zn, Ω-3, vit_a; ограничить молочные/высокий ГИ;',
    '  • aging ≥5 → vit_c, vit_e, selenium, silicon, полифенолы;',
    '  • dryness ≥5 → Ω-3, Ω-6, vit_e, vit_a, вода 30 мл/кг;',
    '  • seborrhea ≥5 → vit_b2, vit_b6, zinc; ограничить простые сахара;',
    '  • itch ≥5 → Ω-3, vit_e; ограничить гистамин-богатые продукты.',
    'Эти связи опираются на современные клинические данные (нутрициологический подход',
    'к дермато-косметологии). Если индексов нет — пункты по коже не пиши.',
    '',
    '=== ФОРМАТ ОТВЕТА ===',
    'Возвращай СТРОГО один JSON-объект без markdown, без ```json, без текста вокруг.',
    'Все числовые поля — числа (не строки). Все тексты — на русском.',
    '',
    '{',
    '  "meals": {',
    '    "breakfast": [ {',
    '      "product":"...", "portion_g":0,',
    '      "calories":0, "protein":0, "fat":0, "carbs":0,',
    '      "omega3":0, "omega6":0,',
    '      /* любой набор микро-ключей; нулевые МОЖНО опустить (экономит токены) */',
    '      "vit_c":0, "calcium":0, "iron":0, "zinc":0,',
    '      "source":"Скурихин", "detail":"табл. 1.2, стр. 42"',
    '    } ],',
    '    "lunch":  [],',
    '    "snack":  [],',
    '    "dinner": []',
    '  },',
    '  "totals": { "calories":0, "protein":0, "fat":0, "carbs":0 /* + любые микро-ключи */ },',
    '  "deficits":        ["Железо: 8 мг при норме 18 мг (44%)"],',
    '  "imbalances":      ["Натрий: 4500 мг (>UL 2300 мг по МР 2.3.1.0253-21)"],',
    '  "recommendations": ["...","...","..."]',
    '}',
    '',
    '=== ЕДИНИЦЫ ===',
    'calories — ккал; protein/fat/carbs/omega3/omega6 — г.',
    'мг:  vit_c, vit_b1, vit_b2, vit_b6, niacin, pantothenic, beta_carotene, vit_e,',
    '     calcium, phosphorus, magnesium, potassium, sodium, chloride, iron, zinc,',
    '     copper, manganese, fluoride, silicon,',
    '     inositol, l_carnitine, coq10, lipoic_acid, smm, orotic_acid, paba, choline.',
    'мкг: vit_b12, folate, biotin, vit_a (РЭ), vit_d, vit_k,',
    '     iodine, molybdenum, selenium, chromium, cobalt, vanadium.',
    '',
    'Допустимые ключи микронутриентов (можно опускать нулевые):',
    'vit_c, vit_b1, vit_b2, vit_b6, niacin, vit_b12, folate, pantothenic, biotin,',
    'vit_a, beta_carotene, vit_e, vit_d, vit_k,',
    'calcium, phosphorus, magnesium, potassium, sodium, chloride,',
    'iron, zinc, iodine, copper, manganese, molybdenum, selenium, chromium, cobalt,',
    'fluoride, silicon, vanadium,',
    'inositol, l_carnitine, coq10, lipoic_acid, smm, orotic_acid, paba, choline.',
    '',
    '=== ПРАВИЛА ДЛЯ МИКРОНУТРИЕНТОВ ===',
    '- Если в Скурихине нет данных по микронутриенту — ПРОСТО ОПУСТИ ключ',
    '  (не пиши 0 и не выдумывай). Это короче и надёжнее.',
    '- Витаминоподобные вещества (coq10, lipoic_acid, orotic_acid, paba, smm,',
    '  l_carnitine, inositol) обычно отсутствуют в Скурихине — опускай.',
    '- Макро (calories, protein, fat, carbs) обязательны в каждом продукте.',
    '',
    'Никаких лишних полей сверх схемы (amino_acids, norms, code и т. п. — НЕЛЬЗЯ).'
  ].join('\n');
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

  // Микронормы (если фронт прислал их в norms) — короткой строкой
  const microNormKeys = Object.keys(n).filter(k => MICRO_KEYS.indexOf(k) !== -1);
  if (microNormKeys.length) {
    prompt += 'МИКРОНОРМЫ: ' + microNormKeys.map(k => `${k}=${n[k]}`).join(', ') + '\n';
  }

  // Индексы кожи (0-10) — если есть, агент учтёт их в recommendations
  const skinKeys = ['skin_acne','skin_aging','skin_dryness','skin_seborrhea','skin_itch','skin_qol'];
  const skinPresent = skinKeys.filter(k => n[k] != null);
  if (skinPresent.length) {
    prompt += 'ИНДЕКСЫ КОЖИ (0-10): ' + skinPresent.map(k => `${k}=${n[k]}`).join(', ') + '\n';
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
    'User-Agent': 'NutriForce-Worker',
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
      'User-Agent': 'NutriForce-Worker',
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

