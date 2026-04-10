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
async function handleAnalyze(request, env) {
  const body = await request.json();

  const prompt = buildAnalysisPrompt(body);

  const response = await fetch('https://api.timeweb.cloud/v2/ai/agent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TIMEWEB_TOKEN}`
    },
    body: JSON.stringify({
      model: 'gemma-3-12b-it',
      messages: [
        {
          role: 'system',
          content: 'Ты диетолог-нутрициолог. Анализируй рацион питания студента. Используй базу знаний (загруженные книги и справочники) для определения КБЖУ продуктов. Отвечай строго в JSON формате без markdown. Формат ответа: {"totals":{"calories":число,"protein":число,"fat":число,"carbs":число},"deficits":["строка"],"imbalances":["строка"],"recommendations":["строка"],"sources":[{"product":"название продукта","value":"КБЖУ значение","source":"название книги/справочника","detail":"таблица, страница или раздел откуда взяты данные"}]}'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
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

  // Parse JSON from response
  try {
    // Strip markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(content);
    return jsonResponse(parsed);
  } catch (e) {
    // Try to extract JSON from text
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return jsonResponse(parsed);
      } catch (e2) {}
    }
    return jsonResponse({
      totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      deficits: [],
      imbalances: [],
      recommendations: ['Не удалось проанализировать рацион. Попробуйте описать блюда подробнее.'],
      sources: [],
      raw: content
    });
  }
}

function buildAnalysisPrompt(body) {
  let prompt = 'Проанализируй рацион питания за день:\n\n';

  if (body.meals) {
    if (body.meals.breakfast) prompt += `Завтрак: ${body.meals.breakfast}\n`;
    if (body.meals.lunch) prompt += `Обед: ${body.meals.lunch}\n`;
    if (body.meals.snack) prompt += `Полдник: ${body.meals.snack}\n`;
    if (body.meals.dinner) prompt += `Ужин: ${body.meals.dinner}\n`;
  }

  if (body.norms) {
    prompt += `\nНормы студента: ${body.norms.calories} ккал, белок ${body.norms.protein}г, жиры ${body.norms.fat}г, углеводы ${body.norms.carbs}г\n`;
  }

  if (body.products && body.products.length) {
    prompt += '\nСправочник продуктов (на 100г):\n';
    body.products.slice(0, 50).forEach(p => {
      prompt += `- ${p.name}: ${p.calories} ккал, Б${p.protein} Ж${p.fat} У${p.carbs}\n`;
    });
  }

  prompt += '\nРассчитай КБЖУ каждого приёма пищи и суммарно за день. Определи дефициты и дисбалансы относительно норм. Дай 3-5 конкретных рекомендаций.';
  prompt += '\nОБЯЗАТЕЛЬНО укажи источники данных для каждого продукта: из какой книги/справочника взяты показатели КБЖУ, номер таблицы и страницы если есть. Если продукт из переданного справочника — укажи "Справочник продуктов (пользовательский)". Если из базы знаний — укажи название книги.';
  prompt += '\nОтвечай строго в JSON: {"totals":{"calories":число,"protein":число,"fat":число,"carbs":число},"deficits":[""],"imbalances":[""],"recommendations":[""],"sources":[{"product":"название","value":"ккал/Б/Ж/У","source":"название источника","detail":"таблица/страница/раздел"}]}';

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
  return {
    content: atob(data.content.replace(/\n/g, '')),
    sha: data.sha
  };
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
