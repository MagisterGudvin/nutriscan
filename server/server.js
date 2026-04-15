/* ============================================
   NutriForce — Node.js Server
   --------------------------------------------
   Порт Cloudflare Worker'а на чистый Node + Express
   для размещения на российском хостинге (Timeweb).
   Логика 1-в-1 совпадает с worker/worker.js — это
   важно для отладки: если что-то ломается, можно
   сравнить два файла построчно.

   ENV:
     PORT             — слушать порт (default 3000)
     TIMEWEB_AGENT_ID — id агента Timeweb AI
     TIMEWEB_TOKEN    — Bearer-токен агента
     GITHUB_REPO      — owner/repo с data/*.json
     GITHUB_BRANCH    — ветка (default main)
     GITHUB_TOKEN     — fine-grained PAT (Contents:RW)
     ALLOWED_ORIGIN   — CORS-домен (default *)
   ============================================ */
import express from 'express';

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const env = {
  TIMEWEB_AGENT_ID: process.env.TIMEWEB_AGENT_ID || '',
  TIMEWEB_TOKEN:    process.env.TIMEWEB_TOKEN    || '',
  GITHUB_REPO:      process.env.GITHUB_REPO      || '',
  GITHUB_BRANCH:    process.env.GITHUB_BRANCH    || 'main',
  GITHUB_TOKEN:     process.env.GITHUB_TOKEN     || '',
};

const app = express();
app.use(express.json({ limit: '4mb' }));

// CORS — одинаково с воркером
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Healthcheck — Timeweb опрашивает /health для проверки контейнера
app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

/* ---- Routes ---- */
app.post('/api/analyze', wrap(handleAnalyze));
app.get('/data/:file',   wrap((req, res) => handleGetData(res, req.params.file)));
app.put('/data/:file',   wrap((req, res) => handlePutData(res, req.params.file, req.body)));

app.use((err, _req, res, _next) => {
  console.error('[server] unhandled:', err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`[NutriServer] listening on :${PORT}`);
  if (!env.TIMEWEB_TOKEN) console.warn('  ! TIMEWEB_TOKEN не задан — /api/analyze не сработает');
  if (!env.GITHUB_TOKEN)  console.warn('  ! GITHUB_TOKEN не задан — /data/* не сработает');
});

function wrap(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch(err => {
    console.error('[server] route error:', err);
    res.status(500).json({ error: err.message });
  });
}

/* ============================================
   Analyze (proxy to Timeweb AI Agent)
   ============================================ */
const ANALYZE_CACHE = new Map();
const ANALYZE_CACHE_TTL_MS = 60 * 60 * 1000;
const ANALYZE_CACHE_MAX = 200;

function analyzeCacheKey(body) {
  const m = body.meals || {};
  const n = body.norms || {};
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
    sk
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
    const firstKey = ANALYZE_CACHE.keys().next().value;
    if (firstKey) ANALYZE_CACHE.delete(firstKey);
  }
  ANALYZE_CACHE.set(key, { t: Date.now(), v: value });
}

async function handleAnalyze(req, res) {
  const body = req.body || {};
  const noCache = req.query.nocache === '1' || body.nocache === true;

  const cacheKey = analyzeCacheKey(body);
  if (!noCache) {
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, _cached: true });
  } else {
    ANALYZE_CACHE.delete(cacheKey);
  }

  if (!env.TIMEWEB_AGENT_ID) return res.status(500).json({ error: 'TIMEWEB_AGENT_ID not configured' });
  if (!env.TIMEWEB_TOKEN)    return res.status(500).json({ error: 'TIMEWEB_TOKEN not configured' });

  const endpoint = `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${env.TIMEWEB_AGENT_ID}/v1/chat/completions`;
  const systemPrompt = buildSystemPrompt();
  const prompt = buildAnalysisPrompt(body);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TIMEWEB_TOKEN}`
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 8000
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    return res.status(502).json({ error: 'AI service error', details: errText });
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
    return res.json({
      totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      deficits: [],
      imbalances: [],
      recommendations: ['Не удалось проанализировать рацион. Попробуйте описать блюда подробнее.'],
      sources: [],
      raw: (content || '').slice(0, 4000)
    });
  }

  const adapted = adaptAgentResponse(parsed);
  if (Array.isArray(body.products) && adapted.sources) {
    const dict = body.products.filter(p => p && p.name);
    adapted.sources = adapted.sources.map(s => {
      if (!s || !s.product) return s;
      const name = String(s.product).toLowerCase();
      const hit = dict.find(p => name.indexOf(String(p.name).toLowerCase()) !== -1 || String(p.name).toLowerCase().indexOf(name) !== -1);
      if (hit && hit.source) {
        return { ...s, source: hit.source, detail: hit.detail || s.detail || '' };
      }
      return s;
    });
  }
  if (isMeaningfulAnalyze(adapted)) setCached(cacheKey, adapted);
  res.json(adapted);
}

function isMeaningfulAnalyze(r) {
  if (!r || !r.totals) return false;
  const t = r.totals;
  const hasNumbers = (t.calories || 0) > 0 || (t.protein || 0) > 0 || (t.fat || 0) > 0 || (t.carbs || 0) > 0;
  const hasSources = Array.isArray(r.sources) && r.sources.length > 0;
  return hasNumbers || hasSources;
}

function adaptAgentResponse(p) {
  const out = {
    totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    deficits: Array.isArray(p.deficits) ? p.deficits : [],
    imbalances: Array.isArray(p.imbalances) ? p.imbalances : [],
    recommendations: Array.isArray(p.recommendations) ? p.recommendations : [],
    sources: []
  };
  if (p.totals && typeof p.totals === 'object') {
    ALL_NUTRIENT_KEYS.forEach(k => {
      if (p.totals[k] != null) out.totals[k] = num(p.totals[k]);
    });
  }
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
  if (Array.isArray(p.sources) && p.sources.length) {
    out.sources = p.sources.map(s => {
      if (!s || typeof s !== 'object') return s;
      const src = normalizeSourceLabel(s.source || '');
      const sd = splitSourceDetail(src, s.detail);
      return { ...s, source: sd.source, detail: sd.detail };
    });
  }
  return out;
}

function normalizeSourceLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Оценка преподавателя';
  if (/^оценка(\s+(ии|и\.и\.|ai|gpt|llm|нейросет\w*|модел\w*))?$/i.test(s)) return 'Оценка преподавателя';
  if (/^(ai|llm)\s*(estimate|оценка)$/i.test(s)) return 'Оценка преподавателя';
  return s;
}

function extractJson(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch {}
  const balanced = sliceFirstJsonObject(s);
  if (balanced) { try { return JSON.parse(balanced); } catch {} }
  const greedy = s.match(/\{[\s\S]*\}/);
  if (greedy) { try { return JSON.parse(greedy[0]); } catch {} }
  const salvaged = salvageTruncatedJson(s);
  if (salvaged) { try { return JSON.parse(salvaged); } catch {} }
  return null;
}

function salvageTruncatedJson(s) {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  let lastValidEnd = -1;
  const braceStack = [];
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
    if (!inStr && (ch === ',' || ch === '}' || ch === ']')) lastValidEnd = i;
  }
  if (lastValidEnd === -1) return null;
  let head = s.slice(start, lastValidEnd + 1);
  if (inStr) head += '"';
  head = head.replace(/,\s*$/, '');
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

function splitSourceDetail(rawSource, rawDetail) {
  let source = String(rawSource || '').trim();
  let detail = String(rawDetail || '').trim();
  if (!source) return { source, detail };
  if (detail) return { source, detail };
  const m = source.match(/^(.*?)[,;:\s]+((?:табл|стр|раздел|глав|разд\.|табл\.|стр\.)[^\n]*)$/i);
  if (m) return { source: m[1].trim().replace(/[,;:]+$/, ''), detail: m[2].trim() };
  return { source, detail };
}

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }
function round(v)  { return Math.round(v); }
function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }

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
  const microNormKeys = Object.keys(n).filter(k => MICRO_KEYS.indexOf(k) !== -1);
  if (microNormKeys.length) {
    prompt += 'МИКРОНОРМЫ: ' + microNormKeys.map(k => `${k}=${n[k]}`).join(', ') + '\n';
  }
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

/* ============================================
   GitHub Data Storage
   ============================================ */
async function githubRequest(path, method, body, contentType) {
  const headers = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'NutriForce-Server',
  };
  if (contentType) headers['Content-Type'] = contentType;
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || 'main'}`;
  const opts = { method: method || 'GET', headers };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

async function getGithubFile(path) {
  const resp = await githubRequest(path, 'GET');
  if (!resp.ok) return null;
  const data = await resp.json();
  // base64 → UTF-8 (Node: Buffer + TextDecoder)
  const buf = Buffer.from(String(data.content || '').replace(/\n/g, ''), 'base64');
  const content = new TextDecoder('utf-8').decode(buf);
  return { content, sha: data.sha };
}

async function putGithubFile(path, content, message) {
  const existing = await getGithubFile(path);
  const body = {
    message: message || `Update ${path}`,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: env.GITHUB_BRANCH || 'main'
  };
  if (existing) body.sha = existing.sha;
  const resp = await githubRequest(path, 'PUT', body, 'application/json');
  return resp.ok;
}

async function handleGetData(res, file) {
  if (!env.GITHUB_REPO || !env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GitHub storage not configured' });
  }
  const result = await getGithubFile(`data/${file}`);
  if (!result) return res.json([]);
  try { return res.json(JSON.parse(result.content)); }
  catch { return res.json([]); }
}

async function handlePutData(res, file, data) {
  if (!env.GITHUB_REPO || !env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GitHub storage not configured' });
  }
  const content = JSON.stringify(data, null, 2);
  const ok = await putGithubFile(`data/${file}`, content, `Update ${file}`);
  res.json({ success: ok });
}
