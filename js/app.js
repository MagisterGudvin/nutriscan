/* ============================================
   NutriForce — App Module (Router + Pages)
   ============================================ */
var NutriApp = (function() {
  'use strict';

  var UI = NutriUI;
  var $ = UI.$;
  var $$ = UI.$$;

  // SVG-иконка "Выйти" — стрелка из двери. Не использует emoji (цветной
  // глиф двери выглядел чужеродно в палитре приложения).
  var LOGOUT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
    '<polyline points="16 17 21 12 16 7"/>' +
    '<line x1="21" y1="12" x2="9" y2="12"/>' +
    '</svg>';

  var currentPage = '';
  var selectedDate = UI.todayStr();
  var selectedStudentId = null;
  var weekStart = null; // Понедельник отображаемой недели, независимо от selectedDate

  function fmtLocal(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function mondayOf(dateStr) {
    var parts = dateStr.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var dow = d.getDay(); // 0=Sun..6=Sat
    d.setDate(d.getDate() - ((dow + 6) % 7));
    return fmtLocal(d);
  }

  function shiftDate(dateStr, days) {
    var parts = dateStr.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + days);
    return fmtLocal(d);
  }

  /* ---- Router ---- */
  function navigate(hash) {
    location.hash = hash;
  }

  function getHash() {
    return location.hash.slice(1) || '/';
  }

  function route() {
    var hash = getHash();
    var user = NutriAuth.currentUser();

    if (!user) {
      renderAuth();
      return;
    }

    hideAllPages();

    if (user.role === 'teacher') {
      routeTeacher(hash);
    } else {
      routeStudent(hash);
    }
  }

  function hideAllPages() {
    $$('.page').forEach(function(p) { p.classList.remove('active'); });
  }

  function showPage(id) {
    var page = $('#page-' + id);
    if (page) {
      page.classList.add('active');
      currentPage = id;
    }
  }

  /* ---- Student Routes ---- */
  function routeStudent(hash) {
    $('#app-shell').classList.remove('hidden');
    $('#auth-screen').classList.add('hidden');
    updateStudentNav(hash);

    if (hash.startsWith('/day')) {
      var d = hash.split('/')[2];
      if (d) selectedDate = d;
      showPage('day');
      renderDayPage();
    } else if (hash === '/week') {
      showPage('week');
      renderWeekPage();
    } else if (hash === '/reports') {
      showPage('reports');
      renderReportsPage();
    } else if (hash === '/derm') {
      showPage('derm');
      renderDermPage();
    } else if (hash === '/profile') {
      showPage('profile');
      renderProfilePage();
    } else {
      showPage('home');
      renderHomePage();
    }

    updateFAB('student');
  }

  /* ---- Teacher Routes ---- */
  function routeTeacher(hash) {
    $('#app-shell').classList.remove('hidden');
    $('#auth-screen').classList.add('hidden');
    updateTeacherNav(hash);

    if (hash.startsWith('/student/')) {
      selectedStudentId = hash.split('/')[2];
      showPage('student-detail');
      renderStudentDetailPage();
    } else if (hash === '/products') {
      showPage('products');
      renderProductsPage();
    } else if (hash === '/export') {
      showPage('export');
      renderExportPage();
    } else {
      showPage('students');
      renderStudentsPage();
    }

    updateFAB('teacher');
  }

  /* ---- Navigation ---- */
  function updateStudentNav(hash) {
    var nav = $('#bottom-nav');
    nav.innerHTML =
      '<button class="nav-item' + (hash === '/' || hash === '' ? ' active' : '') + '" data-nav="/">' +
        '<span class="nav-icon">\ud83c\udfe0</span><span class="nav-label">Главная</span>' +
      '</button>' +
      '<button class="nav-item' + (hash.startsWith('/day') ? ' active' : '') + '" data-nav="/day">' +
        '<span class="nav-icon">\ud83c\udf7d</span><span class="nav-label">День</span>' +
      '</button>' +
      '<button class="nav-item' + (hash === '/week' ? ' active' : '') + '" data-nav="/week">' +
        '<span class="nav-icon">\ud83d\udcc5</span><span class="nav-label">Неделя</span>' +
      '</button>' +
      '<button class="nav-item' + (hash === '/reports' ? ' active' : '') + '" data-nav="/reports">' +
        '<span class="nav-icon">\ud83d\udcca</span><span class="nav-label">Отчёты</span>' +
      '</button>' +
      '<button class="nav-item' + (hash === '/derm' ? ' active' : '') + '" data-nav="/derm">' +
        '<span class="nav-icon">\ud83d\udd2c</span><span class="nav-label">Кожа</span>' +
      '</button>' +
      '<button class="nav-item' + (hash === '/profile' ? ' active' : '') + '" data-nav="/profile">' +
        '<span class="nav-icon">\ud83d\udc64</span><span class="nav-label">Профиль</span>' +
      '</button>';
  }

  function updateTeacherNav(hash) {
    var nav = $('#bottom-nav');
    nav.innerHTML =
      '<button class="nav-item' + (hash === '/' || hash.startsWith('/student') ? ' active' : '') + '" data-nav="/">' +
        '<span class="nav-icon">\ud83d\udc65</span><span class="nav-label">Студенты</span>' +
      '</button>' +
      '<button class="nav-item' + (hash === '/products' ? ' active' : '') + '" data-nav="/products">' +
        '<span class="nav-icon">\ud83e\udd66</span><span class="nav-label">Продукты</span>' +
      '</button>' +
      '<button class="nav-item' + (hash === '/export' ? ' active' : '') + '" data-nav="/export">' +
        '<span class="nav-icon">\ud83d\udce4</span><span class="nav-label">Экспорт</span>' +
      '</button>';
  }

  function updateFAB(role) {
    var fab = $('#fab');
    if (role === 'student') {
      fab.classList.remove('hidden');
      fab.innerHTML = '+';
      fab.onclick = function() { navigate('/day'); };
    } else {
      fab.classList.add('hidden');
    }
  }

  /* ---- Header ---- */
  function updateHeader(title, subtitle, actions) {
    var header = $('#top-header');
    var left = '<div><div class="top-header__title">' + title + '</div>';
    if (subtitle) left += '<div class="top-header__subtitle">' + subtitle + '</div>';
    left += '</div>';
    var right = '<div class="top-header__actions">' + (actions || '') + '</div>';
    header.innerHTML = left + right;
  }

  /* ============================================
     STUDENT PAGES
     ============================================ */

  /* ---- Home Page ---- */
  function renderHomePage() {
    var user = NutriAuth.currentUser();
    var reports = NutriDB.getStudentReports(user.id);
    var todayReport = reports.find(function(r) { return r.date === UI.todayStr(); });
    var norms = user.norms || NutriAnalysis.calculateNorms(user);
    var streak = NutriAnalysis.calculateStreak(reports);

    var cal = (todayReport && todayReport.totals) ? todayReport.totals.calories : 0;
    var protein = (todayReport && todayReport.totals) ? todayReport.totals.protein : 0;
    var fat = (todayReport && todayReport.totals) ? todayReport.totals.fat : 0;
    var carbs = (todayReport && todayReport.totals) ? todayReport.totals.carbs : 0;

    var status = NutriAnalysis.getDayStatus(todayReport ? todayReport.totals : null, norms);

    updateHeader('NutriForce', null,
      '<button class="btn btn--logout" title="Выйти" aria-label="Выйти" onclick="NutriApp.logout()">' + LOGOUT_ICON + '</button>');

    var html = '';

    // Greeting
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    html += '<div class="greeting-card">' +
      '<div class="greeting-card__hello">' + greeting + ', ' + user.name + '!</div>' +
      '<div class="greeting-card__date">' + UI.formatDate(UI.todayStr()) + '</div>' +
      (streak > 0 ? '<div class="greeting-card__streak">\ud83d\udd25 ' + streak + ' ' + pluralDays(streak) + ' подряд</div>' : '') +
    '</div>';

    // Calories ring
    html += '<div class="card card--elevated mb-5">' +
      '<div style="display:flex;align-items:center;gap:20px">' +
        '<div class="progress-ring-wrap">' +
          UI.progressRing(cal, norms.calories, 120, 10) +
          '<div class="progress-ring-wrap__label">' +
            '<div class="progress-ring-wrap__value">' + cal + '</div>' +
            '<span class="progress-ring-wrap__unit">/ ' + norms.calories + ' ккал</span>' +
          '</div>' +
        '</div>' +
        '<div style="flex:1">' +
          '<div class="flex items-center justify-between mb-3">' +
            '<span class="font-bold">Сегодня</span>' +
            '<span class="status ' + UI.statusClass(status) + '">' + UI.statusLabel(status) + '</span>' +
          '</div>' +
          '<div class="text-sm text-secondary mb-3">' + NutriAnalysis.getGoalLabel(norms.goal) + '</div>' +
          UI.progressBar(cal, norms.calories) +
        '</div>' +
      '</div>' +
    '</div>';

    // Macros
    html += '<div class="card mb-5">' +
      '<div class="card__header"><div class="card__title">Макронутриенты</div></div>' +
      '<div class="macro-grid">' +
        macroItem('\ud83e\udd69', 'Белок', protein, norms.protein, 'protein', 'progress-bar__fill--blue') +
        macroItem('\ud83e\uddc8', 'Жиры', fat, norms.fat, 'fat', 'progress-bar__fill--orange') +
        macroItem('\ud83c\udf5e', 'Углеводы', carbs, norms.carbs, 'carbs', 'progress-bar__fill--purple') +
      '</div>' +
    '</div>';

    // Recommendations
    if (todayReport && todayReport.recommendations && todayReport.recommendations.length) {
      html += '<div class="card mb-5">' +
        '<div class="card__header"><div class="card__title">Рекомендации</div></div>';
      todayReport.recommendations.slice(0, 3).forEach(function(r) {
        html += '<div class="rec-item"><div class="rec-item__dot"></div><div class="rec-item__text">' + escHtml(r) + '</div></div>';
      });
      html += '</div>';
    }

    // Micronutrient norms (collapsible groups)
    var microHtml = renderMicroNormsGroups(norms);
    if (microHtml) {
      html += '<div class="card mb-5">' +
        '<div class="card__header"><div class="card__title">Ваши нормы по микронутриентам</div></div>' +
        microHtml +
      '</div>';
    }

    $('#page-home').innerHTML = html;
  }

  function macroItem(icon, label, val, norm, cls, barCls) {
    return '<div class="macro-item">' +
      '<div class="macro-item__icon macro-item__icon--' + cls + '">' + icon + '</div>' +
      '<div class="macro-item__value">' + val + '<span class="text-xs text-secondary">/' + norm + '</span></div>' +
      '<div class="macro-item__label">' + label + '</div>' +
      '<div class="mt-2">' + UI.progressBar(val, norm, barCls) + '</div>' +
    '</div>';
  }

  /* ---- Day Page ---- */
  function renderDayPage() {
    var user = NutriAuth.currentUser();
    var reports = NutriDB.getStudentReports(user.id);
    var report = reports.find(function(r) { return r.date === selectedDate; });

    updateHeader('Приём пищи', UI.formatDate(selectedDate));

    var meals = (report && report.meals) || {};

    var html = '';

    html += '<div class="meal-card">' +
      '<div class="meal-card__header">' +
        '<div class="meal-card__icon meal-card__icon--breakfast">\u2600\ufe0f</div>' +
        '<div class="meal-card__name">Завтрак</div>' +
      '</div>' +
      '<textarea class="input input--textarea" id="meal-breakfast" placeholder="Опишите завтрак...">' + escHtml(meals.breakfast || '') + '</textarea>' +
    '</div>';

    html += '<div class="meal-card">' +
      '<div class="meal-card__header">' +
        '<div class="meal-card__icon meal-card__icon--lunch">\u2614</div>' +
        '<div class="meal-card__name">Обед</div>' +
      '</div>' +
      '<textarea class="input input--textarea" id="meal-lunch" placeholder="Опишите обед...">' + escHtml(meals.lunch || '') + '</textarea>' +
    '</div>';

    html += '<div class="meal-card">' +
      '<div class="meal-card__header">' +
        '<div class="meal-card__icon meal-card__icon--snack">\ud83c\udf4e</div>' +
        '<div class="meal-card__name">Полдник</div>' +
      '</div>' +
      '<textarea class="input input--textarea" id="meal-snack" placeholder="Опишите полдник...">' + escHtml(meals.snack || '') + '</textarea>' +
    '</div>';

    html += '<div class="meal-card">' +
      '<div class="meal-card__header">' +
        '<div class="meal-card__icon meal-card__icon--dinner">\ud83c\udf19</div>' +
        '<div class="meal-card__name">Ужин</div>' +
      '</div>' +
      '<textarea class="input input--textarea" id="meal-dinner" placeholder="Опишите ужин...">' + escHtml(meals.dinner || '') + '</textarea>' +
    '</div>';

    html += '<button class="btn btn--primary btn--lg mt-4" id="btn-analyze">' +
      '\ud83d\udd0d Анализировать' +
    '</button>';

    if (report && report.totals) {
      html += renderReportDetail(report);
    }

    $('#page-day').innerHTML = html;

    $('#btn-analyze').addEventListener('click', doAnalyze);
  }

  function doAnalyze() {
    var user = NutriAuth.currentUser();
    var norms = user.norms || NutriAnalysis.calculateNorms(user);

    // Подмешиваем последние индексы кожи из дерматологического профиля
    // и опроса (max по каждой оси), чтобы агент учёл их в рекомендациях.
    var skin = computeLatestSkinIndices(user);
    if (skin) {
      norms = Object.assign({}, norms, skin);
    }

    var meals = {
      breakfast: $('#meal-breakfast').value.trim(),
      snack: $('#meal-snack').value.trim(),
      lunch: $('#meal-lunch').value.trim(),
      dinner: $('#meal-dinner').value.trim()
    };

    if (!meals.breakfast && !meals.lunch && !meals.snack && !meals.dinner) {
      UI.toast('Опишите хотя бы один приём пищи', 'warning');
      return;
    }

    var products = NutriDB.getProducts();

    UI.showLoading('Анализируем рацион');

    NutriAPI.analyze(meals, norms, products).then(function(result) {
      // Если агент не смог распарсить рацион и вернул нулевые totals —
      // подхватываем локальным расчётом вместо пустого отчёта.
      var t = result && result.totals;
      var macroIsZero = !t || (!t.calories && !t.protein && !t.fat && !t.carbs);
      var noSources = !result || !Array.isArray(result.sources) || !result.sources.length;
      if (macroIsZero && noSources) {
        throw new Error('empty analysis');
      }

      UI.hideLoading();

      var report = {
        date: selectedDate,
        meals: meals,
        totals: result.totals || { calories: 0, protein: 0, fat: 0, carbs: 0 },
        norms: norms,
        deficits: result.deficits || NutriAnalysis.getDeficits(result.totals, norms),
        imbalances: result.imbalances || NutriAnalysis.getImbalances(result.totals, norms),
        recommendations: result.recommendations || [],
        sources: result.sources || []
      };

      NutriDB.saveReport(user.id, report);
      UI.toast('Анализ завершён', 'success');
      renderDayPage();
    }).catch(function(err) {
      UI.hideLoading();
      // Fallback: local calculation from products
      var calcResult = localCalculate(meals, products);
      var report = {
        date: selectedDate,
        meals: meals,
        totals: calcResult.totals,
        norms: norms,
        deficits: NutriAnalysis.getDeficits(calcResult.totals, norms),
        imbalances: NutriAnalysis.getImbalances(calcResult.totals, norms),
        recommendations: generateLocalRecommendations(calcResult.totals, norms),
        sources: calcResult.sources
      };
      NutriDB.saveReport(user.id, report);
      UI.toast('Анализ выполнен локально', 'success');
      renderDayPage();
    });
  }

  function localCalculate(meals, products) {
    var text = (meals.breakfast + ' ' + meals.lunch + ' ' + (meals.snack || '') + ' ' + meals.dinner).toLowerCase();
    var totals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
    var sources = [];
    var matchCount = 0;

    products.forEach(function(p) {
      if (text.indexOf(p.name.toLowerCase()) !== -1) {
        totals.calories += p.calories || 0;
        totals.protein += p.protein || 0;
        totals.fat += p.fat || 0;
        totals.carbs += p.carbs || 0;
        matchCount++;
        sources.push({
          product: p.name,
          value: p.calories + ' ккал, Б' + p.protein + ' Ж' + p.fat + ' У' + p.carbs,
          source: p.source || 'Справочник продуктов (пользовательский)',
          detail: p.detail || 'Локальная база продуктов'
        });
      }
    });

    if (matchCount === 0) {
      var mealCount = 0;
      if (meals.breakfast) mealCount++;
      if (meals.lunch) mealCount++;
      if (meals.snack) mealCount++;
      if (meals.dinner) mealCount++;
      totals.calories = mealCount * 550;
      totals.protein = mealCount * 20;
      totals.fat = mealCount * 18;
      totals.carbs = mealCount * 65;
      sources.push({
        product: 'Усреднённая оценка',
        value: '~550 ккал на приём',
        source: 'Приблизительный расчёт',
        detail: 'Средние значения (продукты не найдены в справочнике)'
      });
    }

    totals.calories = Math.round(totals.calories);
    totals.protein = Math.round(totals.protein);
    totals.fat = Math.round(totals.fat);
    totals.carbs = Math.round(totals.carbs);
    return { totals: totals, sources: sources };
  }

  function generateLocalRecommendations(totals, norms) {
    var recs = [];
    if (totals.protein < norms.protein * 0.8) {
      recs.push('Увеличьте потребление белка: добавьте мясо, рыбу, яйца или бобовые.');
    }
    if (totals.fat < norms.fat * 0.7) {
      recs.push('Не хватает жиров: добавьте орехи, авокадо или оливковое масло.');
    }
    if (totals.carbs > norms.carbs * 1.3) {
      recs.push('Избыток углеводов: сократите порцию гарнира, замените простые углеводы на сложные.');
    }
    if (totals.calories < norms.calories * 0.7) {
      recs.push('Калорийность рациона слишком низкая. Добавьте полноценный перекус.');
    }
    if (totals.calories > norms.calories * 1.2) {
      recs.push('Превышение калорий. Уменьшите порции или замените калорийные продукты.');
    }
    if (recs.length === 0) {
      recs.push('Рацион в целом сбалансирован. Продолжайте в том же духе!');
    }
    return recs;
  }

  function renderReportDetail(report) {
    var html = '<div class="mt-5">';

    // Totals
    html += '<div class="card mb-4">' +
      '<div class="card__header"><div class="card__title">Результаты</div>' +
        '<span class="status ' + UI.statusClass(NutriAnalysis.getDayStatus(report.totals, report.norms)) + '">' +
          UI.statusLabel(NutriAnalysis.getDayStatus(report.totals, report.norms)) +
        '</span>' +
      '</div>';

    var metrics = [
      { label: 'Калории', val: report.totals.calories, norm: report.norms.calories, unit: 'ккал', bar: '' },
      { label: 'Белок', val: report.totals.protein, norm: report.norms.protein, unit: 'г', bar: 'progress-bar__fill--blue' },
      { label: 'Жиры', val: report.totals.fat, norm: report.norms.fat, unit: 'г', bar: 'progress-bar__fill--orange' },
      { label: 'Углеводы', val: report.totals.carbs, norm: report.norms.carbs, unit: 'г', bar: 'progress-bar__fill--purple' }
    ];

    metrics.forEach(function(m) {
      var pct = Math.round(m.val / (m.norm || 1) * 100);
      html += '<div class="mb-3">' +
        '<div class="flex justify-between text-sm mb-2">' +
          '<span>' + m.label + '</span>' +
          '<span class="font-bold">' + m.val + ' / ' + m.norm + ' ' + m.unit + ' (' + pct + '%)</span>' +
        '</div>' +
        UI.progressBar(m.val, m.norm, m.bar) +
      '</div>';
    });

    html += '</div>';

    // Микронутриенты — группами (витамины / минералы / витаминоподобные)
    if (typeof NutriList !== 'undefined') {
      var groups = [
        { key: 'vitamin', title: 'Витамины' },
        { key: 'mineral', title: 'Минералы' },
        { key: 'other',   title: 'Витаминоподобные и условно-незаменимые' }
      ];
      groups.forEach(function(g) {
        var items = NutriList.byGroup(g.key);
        if (!items.length) return;
        html += '<details class="card mb-4 micro-group"><summary class="card__title">' + g.title + '</summary>';
        html += '<table class="micro-table"><thead><tr><th>Нутриент</th><th>Факт</th><th>Норма</th><th>%</th></tr></thead><tbody>';
        items.forEach(function(n) {
          var val = report.totals[n.key] != null ? +report.totals[n.key] : 0;
          var norm = report.norms && report.norms[n.key] != null ? +report.norms[n.key] : (n.norm || 0);
          var pct = norm ? Math.round(val / norm * 100) : 0;
          var cls = pct >= 80 && pct <= 130 ? 'ok' : (pct >= 50 ? 'warn' : 'bad');
          html += '<tr class="micro-row micro-row--' + cls + '">' +
            '<td>' + escHtml(n.label) + '</td>' +
            '<td class="num">' + NutriList.format(n.key, val) + ' ' + escHtml(n.unit) + '</td>' +
            '<td class="num">' + NutriList.format(n.key, norm) + ' ' + escHtml(n.unit) + '</td>' +
            '<td class="num">' + pct + '%</td>' +
          '</tr>';
        });
        html += '</tbody></table></details>';
      });
    }

    // Deficits
    if (report.deficits && report.deficits.length) {
      html += '<div class="detail-section">' +
        '<div class="detail-section__title">Дефициты</div>';
      report.deficits.forEach(function(d) {
        html += '<div class="deficit-item">' + escHtml(d) + '</div>';
      });
      html += '</div>';
    }

    // Sources
    if (report.sources && report.sources.length) {
      html += '<div class="detail-section">' +
        '<div class="detail-section__title">Источники данных</div>';
      report.sources.forEach(function(s) {
        html += '<div class="source-item">' +
          '<div class="source-item__product">' + escHtml(s.product) + '</div>' +
          '<div class="source-item__value">' + escHtml(s.value) + '</div>' +
          '<div class="source-item__ref">' +
            '<span class="source-item__book">' + escHtml(s.source) + '</span>' +
            (s.detail ? '<span class="source-item__detail">' + escHtml(s.detail) + '</span>' : '') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    // Recommendations
    if (report.recommendations && report.recommendations.length) {
      html += '<div class="detail-section">' +
        '<div class="detail-section__title">Рекомендации</div>';
      report.recommendations.forEach(function(r) {
        html += '<div class="rec-block">' + escHtml(r) + '</div>';
      });
      html += '</div>';
    }

    // Skin-nutrition correlation (derm recommendations)
    var user = NutriAuth.currentUser();
    var skin = computeSkinRecommendations(report.totals, report.norms, user);
    if (skin.length) {
      html += '<div class="detail-section">' +
        '<div class="detail-section__title">Кожа и питание</div>';
      skin.forEach(function(s) {
        html += '<div class="rec-block rec-block--skin">' + escHtml(s) + '</div>';
      });
      html += '</div>';
    }

    if (report.teacherComment) {
      html += '<div class="detail-section">' +
        '<div class="detail-section__title">Комментарий преподавателя</div>' +
        '<div class="teacher-comment-display">' + escHtml(report.teacherComment) + '</div>' +
      '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ---- Week Page ---- */
  function renderWeekPage() {
    var user = NutriAuth.currentUser();
    var reports = NutriDB.getStudentReports(user.id);

    if (!weekStart) weekStart = mondayOf(selectedDate);
    var weekDates = [];
    for (var k = 0; k < 7; k++) weekDates.push(shiftDate(weekStart, k));
    var names = UI.dayNames();

    updateHeader('Неделя', UI.formatDate(weekDates[0]) + ' — ' + UI.formatDate(weekDates[6]));

    var html = '';

    html += '<div class="week-nav">' +
      '<button class="btn btn--sm btn--ghost" id="week-prev">\u2039 Назад</button>' +
      '<button class="btn btn--sm btn--ghost" id="week-today">Сегодня</button>' +
      '<button class="btn btn--sm btn--ghost" id="week-next">Вперёд \u203a</button>' +
    '</div>';

    html += '<div class="week-scroll mb-5" id="week-scroll">';
    weekDates.forEach(function(date, i) {
      var report = reports.find(function(r) { return r.date === date; });
      var isToday = date === UI.todayStr();
      var isSelected = date === selectedDate;
      var status = report ? NutriAnalysis.getDayStatus(report.totals, report.norms) : 'empty';
      var cls = 'week-day-card' + (isToday ? ' today' : '') + (isSelected ? ' active' : '') + (report ? ' filled' : '');

      html += '<div class="' + cls + '" data-date="' + date + '">' +
        '<div class="week-day-card__day">' + names[i] + '</div>' +
        '<div class="week-day-card__date">' + date.slice(8) + '</div>' +
        '<div class="week-day-card__status">' + UI.statusEmoji(status) + '</div>' +
      '</div>';
    });
    html += '</div>';

    // Weekly summary
    var weekReports = weekDates.map(function(d) {
      return reports.find(function(r) { return r.date === d; });
    }).filter(Boolean);

    if (weekReports.length) {
      var avgCal = Math.round(weekReports.reduce(function(s,r) { return s + (r.totals ? r.totals.calories : 0); }, 0) / weekReports.length);
      var norms = user.norms || {};
      html += '<div class="card mb-4">' +
        '<div class="card__header">' +
          '<div class="card__title">Сводка за неделю</div>' +
          '<div class="card__badge">' + weekReports.length + '/7 дней</div>' +
        '</div>' +
        '<div class="flex justify-between text-sm mb-3">' +
          '<span>Среднее потребление</span><span class="font-bold">' + avgCal + ' ккал/день</span>' +
        '</div>' +
        UI.progressBar(avgCal, norms.calories || 2000) +
      '</div>';
    } else {
      html += UI.emptyState('\ud83d\udcc5', 'Нет данных', 'Начните вносить приёмы пищи, чтобы увидеть статистику за неделю');
    }

    $('#page-week').innerHTML = html;

    // Центрируем карточку сегодняшнего дня (если она присутствует в отображаемой неделе)
    var scrollEl = $('#week-scroll');
    if (scrollEl) {
      var centerTarget = scrollEl.querySelector('.week-day-card.today')
        || scrollEl.querySelector('.week-day-card.active')
        || scrollEl.querySelector('.week-day-card[data-date="' + UI.todayStr() + '"]');
      if (centerTarget) {
        requestAnimationFrame(function() {
          var targetCenter = centerTarget.offsetLeft + centerTarget.offsetWidth / 2;
          scrollEl.scrollLeft = targetCenter - scrollEl.clientWidth / 2;
        });
      }
    }

    // Prev / next / today
    $('#week-prev').addEventListener('click', function() {
      weekStart = shiftDate(weekStart, -7);
      renderWeekPage();
    });
    $('#week-next').addEventListener('click', function() {
      weekStart = shiftDate(weekStart, 7);
      renderWeekPage();
    });
    $('#week-today').addEventListener('click', function() {
      weekStart = mondayOf(UI.todayStr());
      selectedDate = UI.todayStr();
      renderWeekPage();
    });

    // Day click — НЕ меняем weekStart, только selectedDate
    $$('.week-day-card', $('#page-week')).forEach(function(card) {
      card.addEventListener('click', function() {
        selectedDate = this.dataset.date;
        navigate('/day/' + selectedDate);
      });
    });

    // Свайп / drag / колесо / стрелки для смены недели
    var scroll = $('#week-scroll');
    if (scroll) {
      // --- Touch swipe ---
      var sx = 0, sy = 0, moved = false;
      scroll.addEventListener('touchstart', function(e) {
        if (!e.touches || !e.touches[0]) return;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        moved = false;
      }, { passive: true });
      scroll.addEventListener('touchmove', function(e) {
        if (!e.touches || !e.touches[0]) return;
        var dx = e.touches[0].clientX - sx;
        var dy = e.touches[0].clientY - sy;
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) moved = true;
      }, { passive: true });
      scroll.addEventListener('touchend', function(e) {
        if (!moved || !e.changedTouches || !e.changedTouches[0]) return;
        var dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) < 60) return;
        if (dx < 0) weekStart = shiftDate(weekStart, 7);
        else weekStart = shiftDate(weekStart, -7);
        renderWeekPage();
      });

      // --- Mouse drag (PC) ---
      var isDown = false, mouseStartX = 0, scrollStartLeft = 0, dragDist = 0, dragged = false;
      scroll.addEventListener('mousedown', function(e) {
        isDown = true;
        dragged = false;
        dragDist = 0;
        mouseStartX = e.pageX;
        scrollStartLeft = scroll.scrollLeft;
        scroll.classList.add('dragging');
      });
      window.addEventListener('mouseup', function(e) {
        if (!isDown) return;
        isDown = false;
        scroll.classList.remove('dragging');
        // Если «свайпнули» мышью больше чем на 80px — меняем неделю
        if (Math.abs(dragDist) > 80) {
          if (dragDist < 0) weekStart = shiftDate(weekStart, 7);
          else weekStart = shiftDate(weekStart, -7);
          renderWeekPage();
        }
      });
      scroll.addEventListener('mousemove', function(e) {
        if (!isDown) return;
        e.preventDefault();
        var dx = e.pageX - mouseStartX;
        dragDist = dx;
        if (Math.abs(dx) > 5) dragged = true;
        scroll.scrollLeft = scrollStartLeft - dx;
      });
      // Подавить клик по карточке, если был drag
      scroll.addEventListener('click', function(e) {
        if (dragged) {
          e.stopPropagation();
          e.preventDefault();
          dragged = false;
        }
      }, true);

      // --- Wheel: вертикальное колесо -> горизонтальная прокрутка ---
      scroll.addEventListener('wheel', function(e) {
        if (e.deltaY === 0) return;
        // Если горизонтальное колесо уже что-то даёт — не мешаем
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        scroll.scrollLeft += e.deltaY;
      }, { passive: false });

      // --- Клавиатура: стрелки влево/вправо для смены недели ---
      if (!window.__nutriWeekKeys) {
        window.__nutriWeekKeys = true;
        document.addEventListener('keydown', function(e) {
          if (currentPage !== 'week') return;
          var tag = (e.target && e.target.tagName) || '';
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
          if (e.key === 'ArrowLeft') {
            weekStart = shiftDate(weekStart, -7);
            renderWeekPage();
          } else if (e.key === 'ArrowRight') {
            weekStart = shiftDate(weekStart, 7);
            renderWeekPage();
          }
        });
      }
    }
  }

  /* ---- Reports Page ---- */
  function renderReportsPage() {
    var user = NutriAuth.currentUser();
    var reports = NutriDB.getStudentReports(user.id);

    updateHeader('Мои отчёты', reports.length + ' записей',
      '<button class="btn btn--sm btn--secondary" onclick="NutriApp.exportStudentWeek()">\ud83d\udce4</button>');

    var html = '';

    // Filter
    html += '<div class="filter-pills">' +
      '<button class="filter-pill active" data-filter="all">Все</button>' +
      '<button class="filter-pill" data-filter="good">В норме</button>' +
      '<button class="filter-pill" data-filter="warning">Внимание</button>' +
      '<button class="filter-pill" data-filter="bad">Отклонения</button>' +
    '</div>';

    if (!reports.length) {
      html += UI.emptyState('\ud83d\udcca', 'Пока нет отчётов', 'Добавьте приёмы пищи и проведите анализ');
    } else {
      html += '<div id="reports-list">';
      reports.forEach(function(r) {
        var status = NutriAnalysis.getDayStatus(r.totals, r.norms);
        html += '<div class="report-card" data-date="' + r.date + '" data-status="' + status + '">' +
          '<div class="flex justify-between items-center">' +
            '<div class="report-card__date">' + UI.formatDate(r.date) + '</div>' +
            '<span class="status ' + UI.statusClass(status) + '">' + UI.statusLabel(status) + '</span>' +
          '</div>' +
          '<div class="report-card__summary mt-2">' +
            '<span>' + ((r.totals && r.totals.calories) || 0) + ' ккал</span>' +
            '<span>Б: ' + ((r.totals && r.totals.protein) || 0) + 'г</span>' +
            '<span>Ж: ' + ((r.totals && r.totals.fat) || 0) + 'г</span>' +
            '<span>У: ' + ((r.totals && r.totals.carbs) || 0) + 'г</span>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    $('#page-reports').innerHTML = html;

    // Filter logic
    $$('.filter-pill', $('#page-reports')).forEach(function(pill) {
      pill.addEventListener('click', function() {
        $$('.filter-pill', $('#page-reports')).forEach(function(p) { p.classList.remove('active'); });
        this.classList.add('active');
        var filter = this.dataset.filter;
        $$('.report-card', $('#page-reports')).forEach(function(card) {
          card.style.display = (filter === 'all' || card.dataset.status === filter) ? '' : 'none';
        });
      });
    });

    // Click to view
    $$('.report-card', $('#page-reports')).forEach(function(card) {
      card.addEventListener('click', function() {
        selectedDate = this.dataset.date;
        navigate('/day/' + selectedDate);
      });
    });
  }

  /* ============================================
     ДЕРМАТОСКОПИЯ
     Записи хранятся в user.dermatoscopy = [...].
     Каждая запись: { id, date, time, zone, device, exam,
     acneIndex, agingIndex, notes, images:[dataURL,...] }.
     ============================================ */

  var DERM_ZONES = [
    { v: 'face',  l: 'Лицо' },
    { v: 'neck',  l: 'Шея' },
    { v: 'back',  l: 'Спина' },
    { v: 'chest', l: 'Грудь' },
    { v: 'limbs', l: 'Конечности' }
  ];
  var DERM_DEVICES = [
    { v: 'optical', l: 'Дерматоскоп (оптический)' },
    { v: 'digital', l: 'Цифровой дерматоскоп' },
    { v: 'photo',   l: 'Фото-дерматоскоп' }
  ];
  var DERM_EXAMS = [
    { v: 'invivo',      l: 'in vivo' },
    { v: 'contrast',    l: 'С контрастом' },
    { v: 'multimodal',  l: 'Мультимодальный' }
  ];

  function dermZoneLabel(v) { var x = DERM_ZONES.find(function(z){return z.v===v;}); return x ? x.l : v; }
  function dermDeviceLabel(v) { var x = DERM_DEVICES.find(function(z){return z.v===v;}); return x ? x.l : v; }
  function dermExamLabel(v) { var x = DERM_EXAMS.find(function(z){return z.v===v;}); return x ? x.l : v; }

  /* Рендер карточки дерматологической записи.
     editable=true — показать кнопки редактирования (только для преподавателя).
     targetUserId — чей профиль (нужен преподавателю для редактирования). */
  function renderDermRecordCard(r, editable, targetUserId) {
    var imgCount = (r.images || []).length;
    var thumb = imgCount ? '<img class="derm-thumb" src="' + r.images[0] + '" alt="">' : '<div class="derm-thumb derm-thumb--empty">\ud83d\udd2c</div>';
    var actions = '';
    if (editable) {
      actions =
        '<div class="derm-card__actions">' +
          '<button class="btn btn--sm btn--secondary" onclick="NutriApp.dermEditRecord(\'' + escAttr(targetUserId) + '\',\'' + escAttr(r.id) + '\')">\u270f</button>' +
          '<button class="btn btn--sm btn--ghost" onclick="NutriApp.dermDeleteRecord(\'' + escAttr(targetUserId) + '\',\'' + escAttr(r.id) + '\')">\ud83d\uddd1</button>' +
        '</div>';
    }
    return '<div class="card mb-3 derm-card" data-id="' + escAttr(r.id) + '">' +
      '<div class="derm-card__row">' +
        thumb +
        '<div class="derm-card__body">' +
          '<div class="derm-card__title">' + escHtml(dermZoneLabel(r.zone)) + '</div>' +
          '<div class="derm-card__meta">' + escHtml(UI.formatDate(r.date)) + (r.time ? ', ' + escHtml(r.time) : '') + '</div>' +
          '<div class="derm-card__meta">' + escHtml(dermDeviceLabel(r.device)) + ' · ' + escHtml(dermExamLabel(r.exam)) + '</div>' +
          (r.acneIndex != null || r.agingIndex != null
            ? '<div class="derm-card__idx">' +
                (r.acneIndex != null ? '<span class="derm-idx derm-idx--acne">Акне: ' + r.acneIndex + '/10</span>' : '') +
                (r.agingIndex != null ? '<span class="derm-idx derm-idx--aging">Старение: ' + r.agingIndex + '/10</span>' : '') +
              '</div>' : '') +
          (imgCount > 1 ? '<div class="derm-card__meta text-xs">+' + (imgCount - 1) + ' фото</div>' : '') +
        '</div>' +
        actions +
      '</div>' +
      (r.notes ? '<div class="derm-card__notes"><b>Заметки врача:</b> ' + escHtml(r.notes) + '</div>' : '') +
      (r.teacherComment ? '<div class="derm-card__notes derm-card__notes--comment"><b>Комментарий преподавателя:</b> ' + escHtml(r.teacherComment) + '</div>' : '') +
    '</div>';
  }

  /* Страница «Кожа» для СТУДЕНТА: read-only профиль от преподавателя + опрос. */
  function renderDermPage() {
    var user = NutriAuth.currentUser();
    var records = (user.dermatoscopy || []).slice().sort(function(a,b) {
      return (b.date + (b.time||'')).localeCompare(a.date + (a.time||''));
    });
    var surveys = (user.skinSurveys || []).slice().sort(function(a,b) {
      return (b.date + (b.time||'')).localeCompare(a.date + (a.time||''));
    });

    updateHeader('Состояние кожи', 'Дерматологический профиль и самоопрос',
      '<button class="btn btn--logout" title="Выйти" aria-label="Выйти" onclick="NutriApp.logout()">' + LOGOUT_ICON + '</button>');

    var html = '';

    // --- Дерматологический профиль (от преподавателя, read-only) ---
    html += '<div class="section-title">Дерматологический профиль</div>';
    if (!records.length) {
      html += '<div class="card"><div class="empty-state">' +
        '<div class="empty-state__icon">\ud83e\ude7a</div>' +
        '<div class="empty-state__title">Профиль не заполнен</div>' +
        '<div class="empty-state__text">Преподаватель ещё не вносил данные дерматоскопического осмотра. Профиль появится здесь после первого приёма.</div>' +
      '</div></div>';
    } else {
      records.forEach(function(r) {
        html += renderDermRecordCard(r, false, user.id);
      });
    }

    // --- Самоопрос состояния кожи ---
    html += '<div class="section-title mt-5">Опрос состояния кожи</div>';
    html += '<button class="btn btn--primary btn--lg mb-3" style="width:100%" onclick="NutriApp.skinSurveyStart()">\ud83d\udcdd Пройти опрос</button>';
    html += '<div class="text-xs text-secondary mb-4">Заполняйте опрос регулярно — ответы используются для рекомендаций по питанию и для преподавателя.</div>';

    if (surveys.length) {
      html += '<div class="section-title">История опросов</div>';
      surveys.forEach(function(s) {
        html += renderSurveyCard(s, false, user.id);
      });
    }

    $('#page-derm').innerHTML = html;
  }

  /* Универсальная форма дерматологической записи.
     targetUserId — id студента, чей профиль редактируется.
     existingId   — если задан, редактируем существующую запись.
     Форма используется преподавателем; студент к ней доступа не имеет. */
  function dermOpenForm(targetUserId, existingId) {
    var target = NutriDB.findUserById(targetUserId);
    if (!target) { NutriUI.toast('Студент не найден', 'error'); return; }

    var existing = null;
    if (existingId) {
      existing = (target.dermatoscopy || []).find(function(r) { return r.id === existingId; });
    }

    var now = new Date();
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var defDate = existing ? existing.date : (now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()));
    var defTime = existing ? (existing.time || '') : (pad(now.getHours()) + ':' + pad(now.getMinutes()));

    var mkOpts = function(list, sel) {
      return list.map(function(z) {
        return '<option value="' + z.v + '"' + (z.v === sel ? ' selected' : '') + '>' + z.l + '</option>';
      }).join('');
    };
    var zoneOpts = mkOpts(DERM_ZONES,   existing && existing.zone);
    var devOpts  = mkOpts(DERM_DEVICES, existing && existing.device);
    var examOpts = mkOpts(DERM_EXAMS,   existing && existing.exam);

    var gridStyle = 'display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3)';
    var title = existing ? 'Редактирование записи' : 'Новая дерматологическая запись';
    var content =
      '<div class="modal__title">' + title + '</div>' +
      '<div class="text-sm text-secondary mb-3">Студент: ' + escHtml(target.name) + '</div>' +
      '<div class="input-group"><label class="input-label">Зона тела</label>' +
        '<select class="input" id="derm-zone">' + zoneOpts + '</select></div>' +
      '<div style="' + gridStyle + '">' +
        '<div class="input-group"><label class="input-label">Дата</label><input class="input" type="date" id="derm-date" value="' + escAttr(defDate) + '"></div>' +
        '<div class="input-group"><label class="input-label">Время</label><input class="input" type="time" id="derm-time" value="' + escAttr(defTime) + '"></div>' +
      '</div>' +
      '<div class="input-group"><label class="input-label">Тип дерматоскопа</label>' +
        '<select class="input" id="derm-device">' + devOpts + '</select></div>' +
      '<div class="input-group"><label class="input-label">Тип осмотра</label>' +
        '<select class="input" id="derm-exam">' + examOpts + '</select></div>' +
      '<div style="' + gridStyle + '">' +
        '<div class="input-group"><label class="input-label">Индекс акне (0-10)</label><input class="input" type="number" min="0" max="10" step="0.5" id="derm-acne" placeholder="—" value="' + (existing && existing.acneIndex != null ? existing.acneIndex : '') + '"></div>' +
        '<div class="input-group"><label class="input-label">Индекс старения (0-10)</label><input class="input" type="number" min="0" max="10" step="0.5" id="derm-aging" placeholder="—" value="' + (existing && existing.agingIndex != null ? existing.agingIndex : '') + '"></div>' +
      '</div>' +
      '<div class="input-group"><label class="input-label">Клинические заметки (видит студент)</label>' +
        '<textarea class="input" id="derm-notes" rows="3" placeholder="Жалобы, клиническая картина…">' + escHtml((existing && existing.notes) || '') + '</textarea></div>' +
      '<div class="input-group"><label class="input-label">Комментарий преподавателя (видит студент)</label>' +
        '<textarea class="input" id="derm-comment" rows="3" placeholder="Рекомендации, назначения, пояснения…">' + escHtml((existing && existing.teacherComment) || '') + '</textarea></div>' +
      '<div class="input-group"><label class="input-label">Фото с дерматоскопа</label>' +
        '<input type="file" id="derm-files" accept="image/*" multiple>' +
        '<div class="text-xs text-secondary mt-1">Сжимаются до 1600 px (JPEG). Уже сохранённые фото останутся на месте.</div>' +
        '<div id="derm-preview" class="derm-preview"></div>' +
      '</div>' +
      '<div style="display:flex;gap:var(--s-3);margin-top:var(--s-4)">' +
        '<button class="btn btn--secondary" id="derm-cancel-btn" style="flex:1">Отмена</button>' +
        '<button class="btn btn--primary" id="derm-save-btn" style="flex:1">Сохранить</button>' +
      '</div>';

    var modalHandle = NutriUI.showModal(content);
    dermModalHandle = modalHandle;
    $('#derm-cancel-btn').addEventListener('click', function() { modalHandle.close(); });

    var images = existing && Array.isArray(existing.images) ? existing.images.slice() : [];
    // Отрисуем уже имеющиеся превью
    images.forEach(function(dataUrl) {
      var img = document.createElement('img');
      img.src = dataUrl;
      img.className = 'derm-preview__img';
      $('#derm-preview').appendChild(img);
    });

    $('#derm-files').addEventListener('change', function(e) {
      var files = Array.from(e.target.files || []);
      files.forEach(function(f) {
        if (!f.type.startsWith('image/')) return;
        dermReadDownscale(f).then(function(dataUrl) {
          images.push(dataUrl);
          var img = document.createElement('img');
          img.src = dataUrl;
          img.className = 'derm-preview__img';
          $('#derm-preview').appendChild(img);
        }).catch(function(err) {
          NutriUI.toast('Не удалось прочитать файл: ' + err.message, 'error');
        });
      });
    });

    $('#derm-save-btn').addEventListener('click', function() {
      var base = existing || {};
      var record = {
        id: existing ? existing.id : ('d_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
        zone: $('#derm-zone').value,
        date: $('#derm-date').value,
        time: $('#derm-time').value,
        device: $('#derm-device').value,
        exam: $('#derm-exam').value,
        notes: $('#derm-notes').value.trim(),
        teacherComment: $('#derm-comment').value.trim(),
        images: images,
        createdAt: base.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      var a = $('#derm-acne').value;
      var g = $('#derm-aging').value;
      if (a !== '') record.acneIndex = parseFloat(a);
      if (g !== '') record.agingIndex = parseFloat(g);

      if (!record.date) { NutriUI.toast('Укажите дату осмотра', 'error'); return; }

      var list = (target.dermatoscopy || []).slice();
      if (existing) {
        var idx = list.findIndex(function(r) { return r.id === existing.id; });
        if (idx >= 0) list[idx] = record; else list.push(record);
      } else {
        list.push(record);
      }

      NutriDB.updateUser(targetUserId, { dermatoscopy: list }).then(function() {
        NutriUI.toast('Сохранено', 'success');
        modalHandle.close();
        // Ре-рендер соответствующей страницы
        if (currentPage === 'student-detail') renderStudentDetailPage();
        else if (currentPage === 'derm') renderDermPage();
      }).catch(function(err) {
        NutriUI.toast('Не удалось сохранить: ' + err.message, 'error');
      });
    });
  }

  var dermModalHandle = null;
  function dermCloseModal() {
    if (dermModalHandle) { dermModalHandle.close(); dermModalHandle = null; }
  }

  function dermEditRecord(userId, recId) { dermOpenForm(userId, recId); }
  function dermNewRecord(userId) { dermOpenForm(userId, null); }

  function dermDeleteRecord(userId, recId) {
    if (!confirm('Удалить запись?')) return;
    var target = NutriDB.findUserById(userId);
    if (!target) return;
    var list = (target.dermatoscopy || []).filter(function(r) { return r.id !== recId; });
    NutriDB.updateUser(userId, { dermatoscopy: list }).then(function() {
      NutriUI.toast('Удалено', 'success');
      if (currentPage === 'student-detail') renderStudentDetailPage();
      else if (currentPage === 'derm') renderDermPage();
    }).catch(function(err) {
      NutriUI.toast('Ошибка: ' + err.message, 'error');
    });
  }

  /* ======================================================
     Опрос состояния кожи (синтез DLQI / ItchyQoL / PSM-25 / SF-36).
     15 вопросов, шкала 0-4. Результаты агрегируются в индексы
     0-10 и участвуют в анализе «кожа ↔ питание».
     ====================================================== */
  var SKIN_SURVEY = [
    { key: 'q1',  axis: 'dryness',   text: 'Насколько выражена сухость / шелушение кожи за последние 2 недели?' },
    { key: 'q2',  axis: 'seborrhea', text: 'Насколько выражена жирность кожи, блеск, расширенные поры?' },
    { key: 'q3',  axis: 'acne',      text: 'Насколько выражены высыпания (воспаления, комедоны, прыщи)?' },
    { key: 'q4',  axis: 'itch',      text: 'Насколько сильно беспокоит зуд, жжение, покалывание?' },
    { key: 'q5',  axis: 'aging',     text: 'Как Вы оцениваете признаки старения (морщины, потеря упругости, тусклость)?' },
    { key: 'q6',  axis: 'qol',       text: 'Насколько Вы смущаетесь или переживаете из-за состояния своей кожи?' },
    { key: 'q7',  axis: 'qol',       text: 'Насколько состояние кожи мешает учёбе / работе?' },
    { key: 'q8',  axis: 'qol',       text: 'Насколько состояние кожи ограничивает Вас в выборе одежды, косметики, процедур?' },
    { key: 'q9',  axis: 'qol',       text: 'Насколько беспокоит физический дискомфорт кожи (стянутость, боль)?' },
    { key: 'q10', axis: 'qol',       text: 'Насколько состояние кожи мешает общению с людьми?' },
    { key: 'q11', axis: 'qol',       text: 'Насколько состояние кожи влияет на Ваш сон?' },
    { key: 'q12', axis: 'qol',       text: 'Насколько состояние кожи ухудшает Ваше настроение, провоцирует тревогу?' },
    { key: 'q13', axis: 'qol',       text: 'Насколько ощутимы затраты времени и денег на уход за кожей?' },
    { key: 'q14', axis: 'qol',       text: 'Как часто окружающие обращают внимание на состояние или возраст Вашей кожи?' },
    { key: 'q15', axis: 'qol',       text: 'В целом, насколько состояние кожи ухудшает качество Вашей жизни?' }
  ];
  var SKIN_SURVEY_LABELS = ['Нет / никогда', 'Слабо / редко', 'Умеренно / иногда', 'Сильно / часто', 'Очень сильно / постоянно'];

  function computeSurveyIndices(answers) {
    var dry = +answers[0] || 0;
    var seb = +answers[1] || 0;
    var acn = +answers[2] || 0;
    var itc = +answers[3] || 0;
    var age = +answers[4] || 0;
    var qolSum = 0, qolN = 0;
    for (var i = 5; i < 15; i++) { qolSum += (+answers[i] || 0); qolN++; }
    var qol = qolN ? (qolSum / qolN) : 0;
    // Шкала 0-4 → 0-10
    var to10 = function(v) { return Math.round(v * 2.5 * 10) / 10; };
    return {
      dryness:   to10(dry),
      seborrhea: to10(seb),
      acne:      to10(acn),
      itch:      to10(itc),
      aging:     to10(age),
      qol:       to10(qol)
    };
  }

  function renderSurveyCard(s, editable, targetUserId) {
    var idx = s.indices || {};
    var pill = function(label, val) {
      if (val == null) return '';
      var cls = val >= 6 ? 'derm-idx--acne' : (val >= 3 ? 'derm-idx--aging' : '');
      return '<span class="derm-idx ' + cls + '">' + label + ': ' + val + '/10</span>';
    };
    var actions = '';
    if (editable) {
      actions =
        '<div class="derm-card__actions">' +
          '<button class="btn btn--sm btn--ghost" onclick="NutriApp.skinSurveyDelete(\'' + escAttr(targetUserId) + '\',\'' + escAttr(s.id) + '\')">\ud83d\uddd1</button>' +
        '</div>';
    }
    return '<div class="card mb-3 derm-card" data-id="' + escAttr(s.id) + '">' +
      '<div class="derm-card__row">' +
        '<div class="derm-thumb derm-thumb--empty">\ud83d\udcdd</div>' +
        '<div class="derm-card__body">' +
          '<div class="derm-card__title">Опрос состояния кожи</div>' +
          '<div class="derm-card__meta">' + escHtml(UI.formatDate(s.date)) + (s.time ? ', ' + escHtml(s.time) : '') + '</div>' +
          '<div class="derm-card__idx">' +
            pill('Сухость',   idx.dryness) +
            pill('Жирность',  idx.seborrhea) +
            pill('Акне',      idx.acne) +
            pill('Зуд',       idx.itch) +
            pill('Старение',  idx.aging) +
            pill('КЖ',        idx.qol) +
          '</div>' +
        '</div>' +
        actions +
      '</div>' +
    '</div>';
  }

  function skinSurveyStart() {
    var user = NutriAuth.currentUser();
    if (!user) return;

    var rows = SKIN_SURVEY.map(function(q, i) {
      var opts = SKIN_SURVEY_LABELS.map(function(lbl, v) {
        return '<label class="survey-opt"><input type="radio" name="' + q.key + '" value="' + v + '"' + (v === 0 ? ' checked' : '') + '><span>' + v + ' — ' + escHtml(lbl) + '</span></label>';
      }).join('');
      return '<div class="survey-q">' +
        '<div class="survey-q__title">' + (i + 1) + '. ' + escHtml(q.text) + '</div>' +
        '<div class="survey-q__opts">' + opts + '</div>' +
      '</div>';
    }).join('');

    var content =
      '<div class="modal__title">Опрос состояния кожи</div>' +
      '<div class="text-sm text-secondary mb-3">Отметьте в баллах (0 — нет, 4 — очень сильно). 15 вопросов.</div>' +
      '<div class="survey-form">' + rows + '</div>' +
      '<div style="display:flex;gap:var(--s-3);margin-top:var(--s-4)">' +
        '<button class="btn btn--secondary" id="survey-cancel" style="flex:1">Отмена</button>' +
        '<button class="btn btn--primary" id="survey-save" style="flex:1">Сохранить</button>' +
      '</div>';

    var h = NutriUI.showModal(content);
    $('#survey-cancel').addEventListener('click', function() { h.close(); });
    $('#survey-save').addEventListener('click', function() {
      var answers = SKIN_SURVEY.map(function(q) {
        var sel = document.querySelector('input[name="' + q.key + '"]:checked');
        return sel ? parseInt(sel.value, 10) : 0;
      });
      skinSurveySave(answers, h);
    });
  }

  function skinSurveySave(answers, modalHandle) {
    var user = NutriAuth.currentUser();
    if (!user) return;
    var now = new Date();
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var survey = {
      id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      date: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()),
      time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
      answers: answers,
      indices: computeSurveyIndices(answers),
      createdAt: now.toISOString()
    };
    var list = (user.skinSurveys || []).slice();
    list.push(survey);
    NutriDB.updateUser(user.id, { skinSurveys: list }).then(function() {
      NutriUI.toast('Опрос сохранён', 'success');
      if (modalHandle) modalHandle.close();
      if (currentPage === 'derm') renderDermPage();
    }).catch(function(err) {
      NutriUI.toast('Не удалось сохранить: ' + err.message, 'error');
    });
  }

  function skinSurveyDelete(userId, surveyId) {
    if (!confirm('Удалить результат опроса?')) return;
    var target = NutriDB.findUserById(userId);
    if (!target) return;
    var list = (target.skinSurveys || []).filter(function(s) { return s.id !== surveyId; });
    NutriDB.updateUser(userId, { skinSurveys: list }).then(function() {
      NutriUI.toast('Удалено', 'success');
      if (currentPage === 'student-detail') renderStudentDetailPage();
      else if (currentPage === 'derm') renderDermPage();
    });
  }

  // Читает image-файл, сжимает до MAX_SIDE и возвращает data URL (jpeg 0.75).
  function dermReadDownscale(file) {
    var MAX_SIDE = 1600;
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function() { reject(new Error('FileReader error')); };
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var w = img.width, h = img.height;
          var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          } catch (err) { reject(err); }
        };
        img.onerror = function() { reject(new Error('Image decode error')); };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* Связка кожи и питания. Возвращает массив строк-рекомендаций.
     Логика: берём последнюю дерматоскопическую запись, сопоставляем
     её индексы (акне/старение) с фактическим покрытием нутриентов
     по норме. Пороги: индекс ≥ 5 = высокий, покрытие < 80% = дефицит. */
  /* Возвращает последние индексы кожи 0-10 для отправки в Worker.
     Берёт максимум по каждой оси из последней дерматологической записи
     и последнего опроса. Возвращает null, если данных нет вовсе. */
  function computeLatestSkinIndices(user) {
    if (!user) return null;
    var records = user.dermatoscopy || [];
    var surveys = user.skinSurveys || [];
    if (!records.length && !surveys.length) return null;

    var last = records.length ? records.slice().sort(function(a, b) {
      return (b.date + (b.time||'')).localeCompare(a.date + (a.time||''));
    })[0] : null;

    var lastSurvey = surveys.length ? surveys.slice().sort(function(a, b) {
      return (b.date + (b.time||'')).localeCompare(a.date + (a.time||''));
    })[0] : null;
    var sIdx = (lastSurvey && lastSurvey.indices) || {};

    var pickMax = function(a, b) {
      if (a == null && b == null) return null;
      if (a == null) return b;
      if (b == null) return a;
      return Math.max(a, b);
    };

    var out = {};
    var add = function(key, val) { if (val != null) out[key] = val; };
    add('skin_acne',      pickMax(last && last.acneIndex,  sIdx.acne));
    add('skin_aging',     pickMax(last && last.agingIndex, sIdx.aging));
    add('skin_dryness',   sIdx.dryness);
    add('skin_seborrhea', sIdx.seborrhea);
    add('skin_itch',      sIdx.itch);
    add('skin_qol',       sIdx.qol);
    return Object.keys(out).length ? out : null;
  }

  function computeSkinRecommendations(totals, norms, user) {
    if (!user || !totals || !norms) return [];
    var records = user.dermatoscopy || [];
    var surveys = user.skinSurveys || [];
    if (!records.length && !surveys.length) return [];

    var last = records.length ? records.slice().sort(function(a, b) {
      return (b.date + (b.time||'')).localeCompare(a.date + (a.time||''));
    })[0] : null;

    var lastSurvey = surveys.length ? surveys.slice().sort(function(a, b) {
      return (b.date + (b.time||'')).localeCompare(a.date + (a.time||''));
    })[0] : null;
    var sIdx = (lastSurvey && lastSurvey.indices) || {};

    var pickMax = function(a, b) {
      if (a == null && b == null) return null;
      if (a == null) return b;
      if (b == null) return a;
      return Math.max(a, b);
    };

    var out = [];
    var cover = function(k) {
      var v = +totals[k] || 0, n = +norms[k] || 0;
      return n ? v / n : 1;
    };

    var acne      = pickMax(last && last.acneIndex,  sIdx.acne);
    var aging     = pickMax(last && last.agingIndex, sIdx.aging);
    var dryness   = sIdx.dryness   != null ? sIdx.dryness   : null;
    var seborrhea = sIdx.seborrhea != null ? sIdx.seborrhea : null;
    var itch      = sIdx.itch      != null ? sIdx.itch      : null;
    var qol       = sIdx.qol       != null ? sIdx.qol       : null;

    if (acne != null && acne >= 5) {
      var low = [];
      if (cover('zinc') < 0.8)   low.push('цинк');
      if (cover('omega3') < 0.8) low.push('омега-3');
      if (cover('vit_a') < 0.8)  low.push('витамин А');
      if (low.length) {
        out.push('Индекс акне ' + acne + '/10: повысьте ' + low.join(', ') +
          '. Источники: морепродукты, семена тыквы, льняное масло, печень, яйца. ' +
          'Ограничьте молочные продукты и рафинированные углеводы (высокая гликемическая нагрузка провоцирует воспалительные акне).');
      } else {
        out.push('Индекс акне ' + acne + '/10 при нормальном покрытии цинка и Ω-3: ограничьте гликемическую нагрузку и молочные продукты.');
      }
    }

    if (aging != null && aging >= 5) {
      var lowA = [];
      if (cover('vit_c') < 0.8)   lowA.push('витамин C');
      if (cover('silicon') < 0.8) lowA.push('кремний');
      if (cover('vit_e') < 0.8)   lowA.push('витамин E');
      if (cover('selenium') < 0.8) lowA.push('селен');
      if (lowA.length) {
        out.push('Индекс старения ' + aging + '/10: повысьте ' + lowA.join(', ') +
          '. Источники: болгарский перец, капуста брокколи, цитрусовые, орехи, цельные злаки, семена подсолнечника. ' +
          'Антиоксиданты нужны для синтеза коллагена и защиты от свободных радикалов.');
      } else {
        out.push('Индекс старения ' + aging + '/10 при нормальном покрытии антиоксидантов: рассмотрите увеличение полифенолов (ягоды, зелёный чай) и жирных омега-3-содержащих рыб.');
      }
    }

    if (dryness != null && dryness >= 5) {
      var lowD = [];
      if (cover('omega3') < 0.8) lowD.push('омега-3');
      if (cover('omega6') < 0.8) lowD.push('омега-6');
      if (cover('vit_e') < 0.8)  lowD.push('витамин E');
      if (cover('vit_a') < 0.8)  lowD.push('витамин A');
      if (lowD.length) {
        out.push('Сухость кожи ' + dryness + '/10: повысьте ' + lowD.join(', ') +
          '. Источники: жирная рыба, льняное и оливковое масло, орехи, авокадо, яичный желток. ' +
          'ПНЖК и жирорастворимые витамины поддерживают липидный барьер кожи.');
      } else {
        out.push('Сухость кожи ' + dryness + '/10 при нормальном покрытии ПНЖК: проверьте питьевой режим (30 мл/кг) и ограничьте кофеин/алкоголь.');
      }
    }

    if (seborrhea != null && seborrhea >= 5) {
      var lowS = [];
      if (cover('vit_b2') < 0.8) lowS.push('витамин B2');
      if (cover('vit_b6') < 0.8) lowS.push('витамин B6');
      if (cover('zinc') < 0.8)   lowS.push('цинк');
      if (lowS.length) {
        out.push('Жирность кожи ' + seborrhea + '/10: повысьте ' + lowS.join(', ') +
          '. Источники: субпродукты, цельные злаки, бобовые, мясо, семена тыквы. ' +
          'Недостаток B2/B6/Zn связан с гиперсекрецией сальных желёз.');
      }
    }

    if (itch != null && itch >= 5) {
      var lowI = [];
      if (cover('omega3') < 0.8) lowI.push('омега-3');
      if (cover('vit_e') < 0.8)  lowI.push('витамин E');
      if (lowI.length) {
        out.push('Зуд кожи ' + itch + '/10: повысьте ' + lowI.join(', ') +
          '. Противовоспалительные ПНЖК снижают кожный зуд. Ограничьте быстрые углеводы и гистамин-богатые продукты.');
      }
    }

    if (qol != null && qol >= 6) {
      out.push('Индекс качества жизни из-за кожи ' + qol + '/10: рекомендовано обратиться к дерматологу/косметологу и обсудить план с преподавателем — диета одна не даст результата при таком уровне дистресса.');
    }

    // Нет высоких индексов, но есть данные — краткий мониторинг
    if (!out.length) {
      var parts = [];
      if (acne != null)    parts.push('акне ' + acne + '/10');
      if (aging != null)   parts.push('старение ' + aging + '/10');
      if (dryness != null) parts.push('сухость ' + dryness + '/10');
      if (seborrhea != null) parts.push('жирность ' + seborrhea + '/10');
      if (itch != null)    parts.push('зуд ' + itch + '/10');
      if (parts.length) {
        var prefix = last
          ? 'Последний осмотр (' + UI.formatDate(last.date) + ', ' + dermZoneLabel(last.zone) + ')'
          : (lastSurvey ? 'Последний опрос (' + UI.formatDate(lastSurvey.date) + ')' : 'Данные по коже');
        out.push(prefix + ': ' + parts.join(', ') + '. Показатели в пределах нормы — продолжайте текущий рацион.');
      }
    }

    return out;
  }

  /* ---- Profile Page ---- */
  function renderProfilePage() {
    var user = NutriAuth.currentUser();
    var norms = user.norms || NutriAnalysis.calculateNorms(user);

    updateHeader('Профиль', user.name,
      '<button class="btn btn--logout" title="Выйти" aria-label="Выйти" onclick="NutriApp.logout()">' + LOGOUT_ICON + '</button>');

    var html = '<div class="card mb-5">' +
      '<div class="card__header"><div class="card__title">Параметры</div></div>' +

      '<div class="input-group">' +
        '<label class="input-label">Имя</label>' +
        '<input class="input" id="prof-name" value="' + escAttr(user.name) + '">' +
      '</div>' +
      '<div class="input-group">' +
        '<label class="input-label">Рост (см)</label>' +
        '<input class="input" type="number" id="prof-height" value="' + user.height + '">' +
      '</div>' +
      '<div class="input-group">' +
        '<label class="input-label">Вес (кг)</label>' +
        '<input class="input" type="number" id="prof-cw" value="' + user.currentWeight + '">' +
      '</div>' +
      '<div class="input-group">' +
        '<label class="input-label">Возраст</label>' +
        '<input class="input" type="number" id="prof-age" value="' + (user.age || 20) + '">' +
      '</div>' +
      '<div class="input-group">' +
        '<label class="input-label">Пол</label>' +
        '<select class="select" id="prof-sex">' +
          '<option value="male"' + (user.sex === 'male' ? ' selected' : '') + '>Мужской</option>' +
          '<option value="female"' + (user.sex === 'female' ? ' selected' : '') + '>Женский</option>' +
        '</select>' +
      '</div>' +
      '<div class="input-group">' +
        '<label class="input-label">Уровень физической активности</label>' +
        '<select class="select" id="prof-activity">' +
          '<option value="sedentary"' + (user.activity === 'sedentary' ? ' selected' : '') + '>Сидячий образ жизни</option>' +
          '<option value="light"' + (user.activity === 'light' ? ' selected' : '') + '>Лёгкая активность</option>' +
          '<option value="moderate"' + ((!user.activity || user.activity === 'moderate') ? ' selected' : '') + '>Умеренная активность</option>' +
          '<option value="active"' + (user.activity === 'active' ? ' selected' : '') + '>Высокая активность</option>' +
          '<option value="very_active"' + (user.activity === 'very_active' ? ' selected' : '') + '>Очень высокая активность</option>' +
        '</select>' +
      '</div>' +

      '<button class="btn btn--primary btn--lg" id="btn-save-profile">Сохранить</button>' +
    '</div>';

    html += '<div class="card mb-5">' +
      '<div class="card__header"><div class="card__title">Ваши нормы</div>' +
        '<div class="card__badge">' + NutriAnalysis.getActivityLabel(user.activity) + '</div>' +
      '</div>' +
      '<div id="norms-display">' + renderNormsBlock(norms) + '</div>' +
      '<div id="micro-norms-display" class="mt-4">' + renderMicroNormsGroups(norms) + '</div>' +
    '</div>';

    $('#page-profile').innerHTML = html;

    // Live recalc
    var inputs = ['prof-height', 'prof-cw', 'prof-age', 'prof-sex', 'prof-activity'];
    inputs.forEach(function(id) {
      $('#' + id).addEventListener('input', liveRecalc);
      $('#' + id).addEventListener('change', liveRecalc);
    });

    function liveRecalc() {
      var n = NutriAnalysis.calculateNorms({
        height: parseFloat($('#prof-height').value) || 175,
        currentWeight: parseFloat($('#prof-cw').value) || 70,
        age: parseInt($('#prof-age').value) || 20,
        sex: $('#prof-sex').value,
        activity: $('#prof-activity').value
      });
      $('#norms-display').innerHTML = renderNormsBlock(n);
      var mnd = $('#micro-norms-display');
      if (mnd) mnd.innerHTML = renderMicroNormsGroups(n);
    }

    $('#btn-save-profile').addEventListener('click', function() {
      var data = {
        name: $('#prof-name').value.trim(),
        height: parseFloat($('#prof-height').value) || 175,
        currentWeight: parseFloat($('#prof-cw').value) || 70,
        age: parseInt($('#prof-age').value) || 20,
        sex: $('#prof-sex').value,
        activity: $('#prof-activity').value
      };
      data.norms = NutriAnalysis.calculateNorms(data);
      NutriDB.updateUser(user.id, data).then(function() {
        NutriDB.setSession(NutriDB.findUserById(user.id));
        UI.toast('Профиль обновлён', 'success');
      });
    });
  }

  function renderNormsBlock(norms) {
    return '<div class="norms-grid">' +
      normCard(norms.calories, 'ккал/день') +
      normCard(norms.protein + 'г', 'Белок') +
      normCard(norms.fat + 'г', 'Жиры') +
      normCard(norms.carbs + 'г', 'Углеводы') +
      normCard(norms.omega3 + 'г', 'Омега-3') +
      normCard(norms.omega6 + 'г', 'Омега-6') +
    '</div>';
  }

  function normCard(value, label) {
    return '<div class="norm-card">' +
      '<div class="norm-card__value">' + value + '</div>' +
      '<div class="norm-card__label">' + label + '</div>' +
    '</div>';
  }

  /* Рендер микронутриентов (витамины/минералы/витаминоподобные) в виде
     раскрывающихся таблиц. Если norms не переданы — используются значения
     по умолчанию из реестра. */
  function renderMicroNormsGroups(norms) {
    if (typeof NutriList === 'undefined') return '';
    var groups = [
      { key: 'vitamin', title: 'Витамины' },
      { key: 'mineral', title: 'Минералы' },
      { key: 'other',   title: 'Витаминоподобные и условно-незаменимые' }
    ];
    var out = '';
    groups.forEach(function(g) {
      var items = NutriList.byGroup(g.key);
      if (!items.length) return;
      out += '<details class="micro-group"><summary class="card__title">' + g.title + '</summary>';
      out += '<table class="micro-table"><thead><tr><th>Нутриент</th><th>Норма</th></tr></thead><tbody>';
      items.forEach(function(n) {
        var val = (norms && norms[n.key] != null) ? norms[n.key] : n.norm;
        if (val == null) return;
        out += '<tr>' +
          '<td>' + escHtml(n.label) + '</td>' +
          '<td class="num">' + NutriList.format(n.key, val) + ' ' + escHtml(n.unit) + '</td>' +
        '</tr>';
      });
      out += '</tbody></table></details>';
    });
    return out;
  }

  /* ============================================
     TEACHER PAGES
     ============================================ */

  /* ---- Students List ---- */
  function renderStudentsPage() {
    var students = NutriDB.getAllStudents();
    var reports = NutriDB.getReports();

    updateHeader('Студенты', students.length + ' чел.',
      '<button class="btn btn--logout" title="Выйти" aria-label="Выйти" onclick="NutriApp.logout()">' + LOGOUT_ICON + '</button>');

    var html = '';

    html += '<div class="search-wrap">' +
      '<span class="search-wrap__icon">\ud83d\udd0d</span>' +
      '<input class="search-input" id="search-students" placeholder="Поиск студентов...">' +
    '</div>';

    if (!students.length) {
      html += UI.emptyState('\ud83d\udc65', 'Нет студентов', 'Студенты появятся после регистрации');
    } else {
      html += '<div id="students-list">';
      students.forEach(function(s) {
        var reps = reports[s.id] || [];
        var initials = s.name.split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2);
        html += '<div class="student-card" data-id="' + s.id + '" data-name="' + escAttr(s.name) + '">' +
          '<div class="student-card__avatar">' + initials.toUpperCase() + '</div>' +
          '<div class="student-card__info">' +
            '<div class="student-card__name">' + escHtml(s.name) + '</div>' +
            '<div class="student-card__meta">' + reps.length + ' отчётов &middot; ' + escHtml(s.login) + '</div>' +
          '</div>' +
          '<div class="student-card__actions">' +
            '<button class="btn btn--sm btn--secondary" data-action="open" data-id="' + s.id + '">Открыть</button>' +
            '<button class="btn btn--sm btn--ghost" data-action="delete" data-id="' + s.id + '">\ud83d\uddd1</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    $('#page-students').innerHTML = html;

    // Search
    var searchInput = $('#search-students');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var q = this.value.toLowerCase();
        $$('.student-card', $('#page-students')).forEach(function(card) {
          card.style.display = card.dataset.name.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
        });
      });
    }

    // Actions
    $('#page-students').addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;

      if (action === 'open') {
        navigate('/student/' + id);
      } else if (action === 'delete') {
        UI.confirm('Удалить студента?', 'Все данные будут удалены безвозвратно.', function() {
          NutriDB.deleteUser(id).then(function() {
            UI.toast('Студент удалён', 'success');
            renderStudentsPage();
          });
        });
      }
    });
  }

  /* ---- Student Detail ---- */
  function renderStudentDetailPage() {
    var student = NutriDB.findUserById(selectedStudentId);
    if (!student) {
      navigate('/');
      return;
    }

    var reports = NutriDB.getStudentReports(student.id);

    updateHeader(student.name, student.login,
      '<button class="btn btn--sm btn--secondary" onclick="NutriApp.navigate(\'/\')">Назад</button>');

    var html = '';

    // Student info — editable
    var norms = student.norms || {};
    html += '<div class="card mb-5">' +
      '<div class="card__header"><div class="card__title">Параметры студента</div>' +
        '<button class="btn btn--sm btn--secondary" id="btn-toggle-edit-params">\u270f Изменить</button>' +
      '</div>' +

      // Read-only view
      '<div id="params-view">' +
        '<div class="norm-row"><span class="norm-row__label">Рост</span><span class="norm-row__value">' + student.height + ' см</span></div>' +
        '<div class="norm-row"><span class="norm-row__label">Вес</span><span class="norm-row__value">' + student.currentWeight + ' кг</span></div>' +
        '<div class="norm-row"><span class="norm-row__label">Возраст</span><span class="norm-row__value">' + (student.age || 20) + ' лет</span></div>' +
        '<div class="norm-row"><span class="norm-row__label">Пол</span><span class="norm-row__value">' + (student.sex === 'female' ? 'Женский' : 'Мужской') + '</span></div>' +
        '<div class="norm-row"><span class="norm-row__label">Активность</span><span class="norm-row__value">' + NutriAnalysis.getActivityLabel(student.activity) + '</span></div>' +
      '</div>' +

      // Edit form (hidden by default)
      '<div id="params-edit" class="hidden">' +
        '<div class="input-group"><label class="input-label">Рост (см)</label><input class="input" type="number" id="te-height" value="' + student.height + '"></div>' +
        '<div class="input-group"><label class="input-label">Вес (кг)</label><input class="input" type="number" id="te-weight" value="' + student.currentWeight + '"></div>' +
        '<div class="input-group"><label class="input-label">Возраст</label><input class="input" type="number" id="te-age" value="' + (student.age || 20) + '"></div>' +
        '<div class="input-group"><label class="input-label">Пол</label>' +
          '<select class="select" id="te-sex">' +
            '<option value="male"' + (student.sex === 'male' ? ' selected' : '') + '>Мужской</option>' +
            '<option value="female"' + (student.sex === 'female' ? ' selected' : '') + '>Женский</option>' +
          '</select></div>' +
        '<div class="input-group"><label class="input-label">Активность</label>' +
          '<select class="select" id="te-activity">' +
            '<option value="sedentary"' + (student.activity === 'sedentary' ? ' selected' : '') + '>Сидячий образ жизни</option>' +
            '<option value="light"' + (student.activity === 'light' ? ' selected' : '') + '>Лёгкая активность</option>' +
            '<option value="moderate"' + ((!student.activity || student.activity === 'moderate') ? ' selected' : '') + '>Умеренная активность</option>' +
            '<option value="active"' + (student.activity === 'active' ? ' selected' : '') + '>Высокая активность</option>' +
            '<option value="very_active"' + (student.activity === 'very_active' ? ' selected' : '') + '>Очень высокая активность</option>' +
          '</select></div>' +
        '<button class="btn btn--primary btn--lg mt-2" id="btn-save-params">Сохранить параметры</button>' +
      '</div>' +
    '</div>';

    // Norms — editable
    html += '<div class="card mb-5">' +
      '<div class="card__header"><div class="card__title">Нормы</div>' +
        '<button class="btn btn--sm btn--secondary" id="btn-toggle-edit-norms">\u270f Изменить</button>' +
      '</div>' +

      // Read-only view
      '<div id="norms-view">' +
        '<div class="norms-grid">' +
          '<div class="norm-card"><div class="norm-card__value">' + (norms.calories || '—') + '</div><div class="norm-card__label">ккал/день</div></div>' +
          '<div class="norm-card"><div class="norm-card__value">' + (norms.protein || '—') + 'г</div><div class="norm-card__label">Белок</div></div>' +
          '<div class="norm-card"><div class="norm-card__value">' + (norms.fat || '—') + 'г</div><div class="norm-card__label">Жиры</div></div>' +
          '<div class="norm-card"><div class="norm-card__value">' + (norms.carbs || '—') + 'г</div><div class="norm-card__label">Углеводы</div></div>' +
          '<div class="norm-card"><div class="norm-card__value">' + (norms.omega3 || 1.5) + 'г</div><div class="norm-card__label">Омега-3</div></div>' +
          '<div class="norm-card"><div class="norm-card__value">' + (norms.omega6 || 10) + 'г</div><div class="norm-card__label">Омега-6</div></div>' +
        '</div>' +
        '<div class="mt-4">' + renderMicroNormsGroups(norms) + '</div>' +
      '</div>' +

      // Edit form (hidden)
      '<div id="norms-edit" class="hidden">' +
        '<div class="input-group"><label class="input-label">Калории (ккал/день)</label><input class="input" type="number" id="ne-cal" value="' + (norms.calories || 0) + '"></div>' +
        '<div class="input-group"><label class="input-label">Белок (г)</label><input class="input" type="number" id="ne-prot" value="' + (norms.protein || 0) + '"></div>' +
        '<div class="input-group"><label class="input-label">Жиры (г)</label><input class="input" type="number" id="ne-fat" value="' + (norms.fat || 0) + '"></div>' +
        '<div class="input-group"><label class="input-label">Углеводы (г)</label><input class="input" type="number" id="ne-carbs" value="' + (norms.carbs || 0) + '"></div>' +
        '<div class="input-group"><label class="input-label">Омега-3 (г)</label><input class="input" type="number" step="0.1" id="ne-om3" value="' + (norms.omega3 || 1.5) + '"></div>' +
        '<div class="input-group"><label class="input-label">Омега-6 (г)</label><input class="input" type="number" step="0.1" id="ne-om6" value="' + (norms.omega6 || 10) + '"></div>' +
        '<div class="flex gap-2 mt-2">' +
          '<button class="btn btn--secondary" id="btn-recalc-norms">Пересчитать</button>' +
          '<button class="btn btn--primary" id="btn-save-norms">Сохранить нормы</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    // Dermatology profile (teacher-editable)
    var dermList = (student.dermatoscopy || []).slice().sort(function(a,b) {
      return (b.date + (b.time||'')).localeCompare(a.date + (a.time||''));
    });
    html += '<div class="section-title">Дерматологический профиль</div>';
    html += '<button class="btn btn--primary mb-3" onclick="NutriApp.dermNewRecord(\'' + student.id + '\')">+ Новая запись</button>';
    if (!dermList.length) {
      html += '<div class="card"><div class="text-sm text-secondary">Пока нет записей.</div></div>';
    } else {
      dermList.forEach(function(r) { html += renderDermRecordCard(r, true, student.id); });
    }

    // Skin surveys (student-filled, teacher view-only with delete)
    var surveyList = (student.skinSurveys || []).slice().sort(function(a,b) {
      return (b.date + (b.time||'')).localeCompare(a.date + (a.time||''));
    });
    html += '<div class="section-title mt-5">Опросы состояния кожи (' + surveyList.length + ')</div>';
    if (!surveyList.length) {
      html += '<div class="card"><div class="text-sm text-secondary">Студент ещё не заполнял опрос.</div></div>';
    } else {
      surveyList.forEach(function(s) { html += renderSurveyCard(s, true, student.id); });
    }

    // Reports
    html += '<div class="section-title mt-5">Отчёты (' + reports.length + ')</div>';

    if (!reports.length) {
      html += UI.emptyState('\ud83d\udcca', 'Нет отчётов', 'Студент ещё не вносил данные');
    } else {
      reports.forEach(function(r) {
        var status = NutriAnalysis.getDayStatus(r.totals, r.norms);
        html += '<div class="report-card" data-date="' + r.date + '">' +
          '<div class="flex justify-between items-center">' +
            '<div class="report-card__date">' + UI.formatDate(r.date) + '</div>' +
            '<div class="flex gap-2">' +
              '<span class="status ' + UI.statusClass(status) + '">' + UI.statusLabel(status) + '</span>' +
              '<button class="btn btn--sm btn--secondary" data-action="doc" data-date="' + r.date + '">\ud83d\udce4</button>' +
              '<button class="btn btn--sm btn--ghost" data-action="del-report" data-date="' + r.date + '">\ud83d\uddd1</button>' +
            '</div>' +
          '</div>' +
          '<div class="report-card__summary mt-2">' +
            '<span>' + ((r.totals && r.totals.calories) || 0) + ' ккал</span>' +
            '<span>Б: ' + ((r.totals && r.totals.protein) || 0) + '</span>' +
            '<span>Ж: ' + ((r.totals && r.totals.fat) || 0) + '</span>' +
            '<span>У: ' + ((r.totals && r.totals.carbs) || 0) + '</span>' +
          '</div>';

        // Sources
        if (r.sources && r.sources.length) {
          html += '<div class="mt-3">' +
            '<div class="detail-section__title">Источники данных</div>';
          r.sources.forEach(function(s) {
            html += '<div class="source-item">' +
              '<div class="source-item__product">' + escHtml(s.product) + '</div>' +
              '<div class="source-item__value">' + escHtml(s.value) + '</div>' +
              '<div class="source-item__ref">' +
                '<span class="source-item__book">' + escHtml(s.source) + '</span>' +
                (s.detail ? '<span class="source-item__detail">' + escHtml(s.detail) + '</span>' : '') +
              '</div>' +
            '</div>';
          });
          html += '</div>';
        }

        // Editable recommendations
        html += '<div class="mt-3 teacher-recs-section" data-report-date="' + r.date + '">' +
          '<div class="detail-section__title">Рекомендации</div>';

        if (r.recommendations && r.recommendations.length) {
          r.recommendations.forEach(function(rec, ri) {
            html += '<div class="teacher-rec-row">' +
              '<textarea class="input teacher-rec-input" data-date="' + r.date + '" data-rec-index="' + ri + '">' + escHtml(rec) + '</textarea>' +
              '<button class="btn btn--sm btn--ghost teacher-rec-del" data-action="del-rec" data-date="' + r.date + '" data-rec-index="' + ri + '">\u2718</button>' +
            '</div>';
          });
        } else {
          html += '<div class="text-sm text-secondary mb-3">Нет рекомендаций</div>';
        }

        html += '<div class="flex gap-2 mt-2">' +
          '<button class="btn btn--sm btn--primary" data-action="add-rec" data-date="' + r.date + '">+ Добавить</button>' +
          '<button class="btn btn--sm btn--secondary" data-action="save-recs" data-date="' + r.date + '">Сохранить</button>' +
        '</div>';

        // Teacher comment
        html += '<div class="teacher-comment-section mt-3">' +
          '<div class="detail-section__title">Комментарий преподавателя</div>' +
          '<textarea class="input input--textarea teacher-comment-input" data-date="' + r.date + '" placeholder="Оставьте комментарий...">' + escHtml(r.teacherComment || '') + '</textarea>' +
          '<button class="btn btn--sm btn--primary mt-2" data-action="save-comment" data-date="' + r.date + '">Сохранить комментарий</button>' +
        '</div>';

        html += '</div>';

        html += '</div>';
      });
    }

    html += '<button class="btn btn--primary btn--lg mt-5" onclick="NutriApp.exportStudentDoc(\'' + student.id + '\')">Экспорт недели</button>';

    $('#page-student-detail').innerHTML = html;

    // Toggle params edit
    $('#btn-toggle-edit-params').addEventListener('click', function() {
      var view = $('#params-view');
      var edit = $('#params-edit');
      var isHidden = edit.classList.contains('hidden');
      view.classList.toggle('hidden', isHidden);
      edit.classList.toggle('hidden', !isHidden);
      this.textContent = isHidden ? 'Отмена' : '\u270f Изменить';
    });

    // Save params
    $('#btn-save-params').addEventListener('click', function() {
      var data = {
        height: parseFloat($('#te-height').value) || 175,
        currentWeight: parseFloat($('#te-weight').value) || 70,
        age: parseInt($('#te-age').value) || 20,
        sex: $('#te-sex').value,
        activity: $('#te-activity').value
      };
      data.norms = NutriAnalysis.calculateNorms(data);
      NutriDB.updateUser(student.id, data).then(function() {
        UI.toast('Параметры обновлены', 'success');
        renderStudentDetailPage();
      });
    });

    // Toggle norms edit
    $('#btn-toggle-edit-norms').addEventListener('click', function() {
      var view = $('#norms-view');
      var edit = $('#norms-edit');
      var isHidden = edit.classList.contains('hidden');
      view.classList.toggle('hidden', isHidden);
      edit.classList.toggle('hidden', !isHidden);
      this.textContent = isHidden ? 'Отмена' : '\u270f Изменить';
    });

    // Recalc norms from current params
    $('#btn-recalc-norms').addEventListener('click', function() {
      var s = NutriDB.findUserById(student.id);
      var n = NutriAnalysis.calculateNorms({
        height: s.height,
        currentWeight: s.currentWeight,
        age: s.age || 20,
        sex: s.sex,
        activity: s.activity || 'moderate'
      });
      $('#ne-cal').value = n.calories;
      $('#ne-prot').value = n.protein;
      $('#ne-fat').value = n.fat;
      $('#ne-carbs').value = n.carbs;
      $('#ne-om3').value = n.omega3;
      $('#ne-om6').value = n.omega6;
      UI.toast('Нормы пересчитаны', 'success');
    });

    // Save custom norms
    $('#btn-save-norms').addEventListener('click', function() {
      var customNorms = {
        calories: parseInt($('#ne-cal').value) || 0,
        protein: parseInt($('#ne-prot').value) || 0,
        fat: parseInt($('#ne-fat').value) || 0,
        carbs: parseInt($('#ne-carbs').value) || 0,
        omega3: parseFloat($('#ne-om3').value) || 1.5,
        omega6: parseFloat($('#ne-om6').value) || 10,
        bmr: (student.norms && student.norms.bmr) || 0,
        tdee: (student.norms && student.norms.tdee) || 0,
        goal: 'maintain'
      };
      NutriDB.updateUser(student.id, { norms: customNorms }).then(function() {
        UI.toast('Нормы сохранены', 'success');
        renderStudentDetailPage();
      });
    });

    // Report actions
    $('#page-student-detail').addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var date = btn.dataset.date;

      if (btn.dataset.action === 'doc') {
        var report = reports.find(function(r) { return r.date === date; });
        if (report) {
          var xml = NutriDocx.generateReport(student, report);
          NutriDocx.download(xml, 'report_' + student.login + '_' + date + '.doc');
          UI.toast('Отчёт скачан', 'success');
        }
      } else if (btn.dataset.action === 'del-report') {
        UI.confirm('Удалить отчёт?', 'Отчёт за ' + date + ' будет удалён.', function() {
          NutriDB.deleteReport(student.id, date).then(function() {
            UI.toast('Отчёт удалён', 'success');
            renderStudentDetailPage();
          });
        });
      } else if (btn.dataset.action === 'add-rec') {
        var section = btn.closest('.teacher-recs-section');
        var newRow = document.createElement('div');
        newRow.className = 'teacher-rec-row';
        newRow.innerHTML = '<textarea class="input teacher-rec-input" data-date="' + date + '" data-rec-index="new" placeholder="Новая рекомендация..."></textarea>' +
          '<button class="btn btn--sm btn--ghost teacher-rec-del" data-action="remove-rec-row">\u2718</button>';
        section.querySelector('.flex.gap-2').before(newRow);
        newRow.querySelector('textarea').focus();
      } else if (btn.dataset.action === 'remove-rec-row') {
        btn.closest('.teacher-rec-row').remove();
      } else if (btn.dataset.action === 'del-rec') {
        btn.closest('.teacher-rec-row').remove();
      } else if (btn.dataset.action === 'save-recs') {
        var allInputs = $$('.teacher-rec-input[data-date="' + date + '"]', $('#page-student-detail'));
        var newRecs = allInputs.map(function(ta) { return ta.value.trim(); }).filter(Boolean);
        var report = reports.find(function(r) { return r.date === date; });
        if (report) {
          report.recommendations = newRecs;
          NutriDB.saveReport(student.id, report).then(function() {
            UI.toast('Рекомендации сохранены', 'success');
            reports = NutriDB.getStudentReports(student.id);
          });
        }
      } else if (btn.dataset.action === 'save-comment') {
        var commentInput = $('.teacher-comment-input[data-date="' + date + '"]', $('#page-student-detail'));
        var comment = commentInput ? commentInput.value.trim() : '';
        var report = reports.find(function(r) { return r.date === date; });
        if (report) {
          report.teacherComment = comment;
          NutriDB.saveReport(student.id, report).then(function() {
            UI.toast('Комментарий сохранён', 'success');
            reports = NutriDB.getStudentReports(student.id);
          });
        }
      }
    });
  }

  /* ---- Products Page ---- */
  function renderProductsPage() {
    var products = NutriDB.getProducts();

    updateHeader('Продукты', products.length + ' шт.',
      '<button class="btn btn--sm btn--primary" onclick="NutriApp.addProductModal()">+ Добавить</button>');

    var html = '';

    html += '<div class="search-wrap">' +
      '<span class="search-wrap__icon">\ud83d\udd0d</span>' +
      '<input class="search-input" id="search-products" placeholder="Поиск продуктов...">' +
    '</div>';

    if (!products.length) {
      html += UI.emptyState('\ud83e\udd66', 'Нет продуктов', 'Добавьте продукты для точного анализа рациона');
    } else {
      products.forEach(function(p, i) {
        var srcLine = '';
        if (p.source || p.detail) {
          srcLine = '<div class="product-list-item__source">\u{1F4D6} ' + escHtml(p.source || '') +
            (p.detail ? ' &middot; ' + escHtml(p.detail) : '') + '</div>';
        }
        html += '<div class="product-list-item" data-index="' + i + '" data-name="' + escAttr(p.name) + '">' +
          '<div class="product-list-item__name">' + escHtml(p.name) + '</div>' +
          '<div class="product-list-item__macro">' + p.calories + ' ккал &middot; Б' + p.protein + ' Ж' + p.fat + ' У' + p.carbs + '</div>' +
          srcLine +
          '<button class="btn btn--sm btn--ghost" data-action="edit-product" data-index="' + i + '">\u270f</button>' +
          '<button class="btn btn--sm btn--ghost" data-action="del-product" data-index="' + i + '">\ud83d\uddd1</button>' +
        '</div>';
      });
    }

    $('#page-products').innerHTML = html;

    // Search
    var si = $('#search-products');
    if (si) {
      si.addEventListener('input', function() {
        var q = this.value.toLowerCase();
        $$('.product-list-item', $('#page-products')).forEach(function(item) {
          item.style.display = item.dataset.name.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
        });
      });
    }

    // Actions
    $('#page-products').addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var idx = parseInt(btn.dataset.index);

      if (btn.dataset.action === 'edit-product') {
        editProductModal(idx);
      } else if (btn.dataset.action === 'del-product') {
        UI.confirm('Удалить продукт?', 'Продукт будет удалён из базы.', function() {
          NutriDB.deleteProduct(idx).then(function() {
            UI.toast('Продукт удалён', 'success');
            renderProductsPage();
          });
        });
      }
    });
  }

  function addProductModal() {
    var m = UI.showModal(
      '<div class="modal__title">Новый продукт</div>' +
      '<div class="input-group"><label class="input-label">Название</label><input class="input" id="pm-name"></div>' +
      '<div class="input-group"><label class="input-label">Калории</label><input class="input" type="number" id="pm-cal"></div>' +
      '<div class="input-group"><label class="input-label">Белок (г)</label><input class="input" type="number" id="pm-prot"></div>' +
      '<div class="input-group"><label class="input-label">Жиры (г)</label><input class="input" type="number" id="pm-fat"></div>' +
      '<div class="input-group"><label class="input-label">Углеводы (г)</label><input class="input" type="number" id="pm-carbs"></div>' +
      '<div class="input-group"><label class="input-label">Источник</label><input class="input" id="pm-source" placeholder="Название книги, справочника"></div>' +
      '<div class="input-group"><label class="input-label">Таблица / страница</label><input class="input" id="pm-detail" placeholder="Таблица 2.3, стр. 45"></div>' +
      '<button class="btn btn--primary btn--lg" id="pm-save">Сохранить</button>'
    );

    $('#pm-save').addEventListener('click', function() {
      var name = $('#pm-name').value.trim();
      if (!name) { UI.toast('Введите название', 'warning'); return; }
      NutriDB.addProduct({
        name: name,
        calories: parseFloat($('#pm-cal').value) || 0,
        protein: parseFloat($('#pm-prot').value) || 0,
        fat: parseFloat($('#pm-fat').value) || 0,
        carbs: parseFloat($('#pm-carbs').value) || 0,
        source: $('#pm-source').value.trim(),
        detail: $('#pm-detail').value.trim()
      }).then(function() {
        m.close();
        UI.toast('Продукт добавлен', 'success');
        renderProductsPage();
      });
    });
  }

  function editProductModal(idx) {
    var products = NutriDB.getProducts();
    var p = products[idx];
    if (!p) return;

    var m = UI.showModal(
      '<div class="modal__title">Редактирование</div>' +
      '<div class="input-group"><label class="input-label">Название</label><input class="input" id="pm-name" value="' + escAttr(p.name) + '"></div>' +
      '<div class="input-group"><label class="input-label">Калории</label><input class="input" type="number" id="pm-cal" value="' + p.calories + '"></div>' +
      '<div class="input-group"><label class="input-label">Белок (г)</label><input class="input" type="number" id="pm-prot" value="' + p.protein + '"></div>' +
      '<div class="input-group"><label class="input-label">Жиры (г)</label><input class="input" type="number" id="pm-fat" value="' + p.fat + '"></div>' +
      '<div class="input-group"><label class="input-label">Углеводы (г)</label><input class="input" type="number" id="pm-carbs" value="' + p.carbs + '"></div>' +
      '<div class="input-group"><label class="input-label">Источник</label><input class="input" id="pm-source" placeholder="Название книги, справочника" value="' + escAttr(p.source || '') + '"></div>' +
      '<div class="input-group"><label class="input-label">Таблица / страница</label><input class="input" id="pm-detail" placeholder="Таблица 2.3, стр. 45" value="' + escAttr(p.detail || '') + '"></div>' +
      '<button class="btn btn--primary btn--lg" id="pm-save">Сохранить</button>'
    );

    $('#pm-save').addEventListener('click', function() {
      NutriDB.updateProduct(idx, {
        name: $('#pm-name').value.trim() || p.name,
        calories: parseFloat($('#pm-cal').value) || 0,
        protein: parseFloat($('#pm-prot').value) || 0,
        fat: parseFloat($('#pm-fat').value) || 0,
        carbs: parseFloat($('#pm-carbs').value) || 0,
        source: $('#pm-source').value.trim(),
        detail: $('#pm-detail').value.trim()
      }).then(function() {
        m.close();
        UI.toast('Продукт обновлён', 'success');
        renderProductsPage();
      });
    });
  }

  /* ---- Export Page ---- */
  function renderExportPage() {
    updateHeader('Экспорт', 'Генерация отчётов');

    var students = NutriDB.getAllStudents();

    var html = '<div class="card mb-5">' +
      '<div class="card__title mb-4">Экспорт отчётов</div>' +

      '<div class="input-group">' +
        '<label class="input-label">Студент</label>' +
        '<select class="select" id="exp-student">' +
          '<option value="all">Все студенты</option>';

    students.forEach(function(s) {
      html += '<option value="' + s.id + '">' + escHtml(s.name) + '</option>';
    });

    html += '</select></div>' +

      '<div class="input-group">' +
        '<label class="input-label">Период</label>' +
        '<select class="select" id="exp-period">' +
          '<option value="day">Сегодня</option>' +
          '<option value="week" selected>Неделя</option>' +
          '<option value="all">Все данные</option>' +
        '</select>' +
      '</div>' +

      '<button class="btn btn--primary btn--lg" id="btn-export">\ud83d\udce4 Скачать .doc</button>' +
    '</div>';

    $('#page-export').innerHTML = html;

    $('#btn-export').addEventListener('click', function() {
      var studentId = $('#exp-student').value;
      var period = $('#exp-period').value;

      if (studentId === 'all') {
        var allReports = NutriDB.getReports();
        var xml = NutriDocx.generateAllStudentsReport(students, allReports);
        NutriDocx.download(xml, 'report_all_students.doc');
      } else {
        var student = NutriDB.findUserById(studentId);
        if (!student) { UI.toast('Студент не найден', 'error'); return; }
        var reports = NutriDB.getStudentReports(studentId);

        if (period === 'day') {
          var today = UI.todayStr();
          var r = reports.find(function(rep) { return rep.date === today; });
          if (!r) { UI.toast('Нет отчёта за сегодня', 'warning'); return; }
          var xml2 = NutriDocx.generateReport(student, r);
          NutriDocx.download(xml2, 'report_' + student.login + '_' + today + '.doc');
        } else if (period === 'week') {
          var weekDates = UI.getWeekDates(UI.todayStr());
          var weekReps = reports.filter(function(r) { return weekDates.indexOf(r.date) !== -1; });
          var xml3 = NutriDocx.generateWeekReport(student, weekReps);
          NutriDocx.download(xml3, 'report_' + student.login + '_week.doc');
        } else {
          var xml4 = NutriDocx.generateWeekReport(student, reports);
          NutriDocx.download(xml4, 'report_' + student.login + '_all.doc');
        }
      }

      UI.toast('Отчёт сформирован', 'success');
    });
  }

  /* ============================================
     AUTH SCREEN
     ============================================ */
  function renderAuth() {
    $('#app-shell').classList.add('hidden');

    var screen = $('#auth-screen');
    screen.classList.remove('hidden');

    if (screen.dataset.rendered) return;
    screen.dataset.rendered = '1';

    screen.innerHTML =
      '<div class="auth-logo">N</div>' +
      '<div class="auth-title">NutriForce</div>' +
      '<div class="auth-subtitle">Анализ питания студентов</div>' +
      '<div class="auth-form" id="auth-form">' +
        '<div id="auth-fields"></div>' +
        '<button class="btn btn--primary btn--lg" id="auth-submit">Войти</button>' +
        '<div class="auth-toggle" id="auth-toggle">Нет аккаунта? <a id="auth-switch">Регистрация</a></div>' +
      '</div>';

    var isLogin = true;

    function renderFields() {
      var f = $('#auth-fields');
      if (isLogin) {
        f.innerHTML =
          '<div class="input-group"><label class="input-label">Логин</label><input class="input" id="auth-login" autocomplete="username"></div>' +
          '<div class="input-group"><label class="input-label">Пароль</label><input class="input" type="password" id="auth-pass" autocomplete="current-password"></div>';
        $('#auth-submit').textContent = 'Войти';
        $('#auth-toggle').innerHTML = 'Нет аккаунта? <a id="auth-switch">Регистрация</a>';
      } else {
        f.innerHTML =
          '<div class="input-group"><label class="input-label">Имя</label><input class="input" id="auth-name"></div>' +
          '<div class="input-group"><label class="input-label">Логин</label><input class="input" id="auth-login" autocomplete="username"></div>' +
          '<div class="input-group"><label class="input-label">Пароль</label><input class="input" type="password" id="auth-pass" autocomplete="new-password"></div>' +
          '<div class="input-group"><label class="input-label">Рост (см)</label><input class="input" type="number" id="auth-height" value="175"></div>' +
          '<div class="input-group"><label class="input-label">Вес (кг)</label><input class="input" type="number" id="auth-cw" value="70"></div>' +
          '<div class="input-group"><label class="input-label">Возраст</label><input class="input" type="number" id="auth-age" value="20"></div>' +
          '<div class="input-group"><label class="input-label">Пол</label>' +
            '<select class="select" id="auth-sex"><option value="male">Мужской</option><option value="female">Женский</option></select></div>' +
          '<div class="input-group"><label class="input-label">Уровень физической активности</label>' +
            '<select class="select" id="auth-activity">' +
              '<option value="sedentary">Сидячий образ жизни</option>' +
              '<option value="light">Лёгкая активность</option>' +
              '<option value="moderate" selected>Умеренная активность</option>' +
              '<option value="active">Высокая активность</option>' +
              '<option value="very_active">Очень высокая активность</option>' +
            '</select></div>';
        $('#auth-submit').textContent = 'Зарегистрироваться';
        $('#auth-toggle').innerHTML = 'Есть аккаунт? <a id="auth-switch">Войти</a>';
      }
      $('#auth-switch').addEventListener('click', function() { isLogin = !isLogin; renderFields(); });
    }

    renderFields();

    $('#auth-submit').addEventListener('click', function() {
      if (isLogin) {
        var result = NutriAuth.login($('#auth-login').value.trim(), $('#auth-pass').value);
        if (result.success) {
          screen.dataset.rendered = '';
          navigate('/');
          route();
        } else {
          UI.toast(result.error, 'error');
        }
      } else {
        var result2 = NutriAuth.register({
          name: $('#auth-name').value.trim(),
          login: $('#auth-login').value.trim(),
          password: $('#auth-pass').value,
          height: $('#auth-height').value,
          currentWeight: $('#auth-cw').value,
          age: $('#auth-age').value,
          sex: $('#auth-sex').value,
          activity: $('#auth-activity').value
        });
        if (result2.success) {
          screen.dataset.rendered = '';
          navigate('/');
          route();
        } else {
          UI.toast(result2.error, 'error');
        }
      }
    });
  }

  /* ---- Export Helpers ---- */
  function exportStudentWeek() {
    var user = NutriAuth.currentUser();
    var reports = NutriDB.getStudentReports(user.id);
    var weekDates = UI.getWeekDates(UI.todayStr());
    var weekReps = reports.filter(function(r) { return weekDates.indexOf(r.date) !== -1; });

    if (!weekReps.length) {
      UI.toast('Нет отчётов за эту неделю', 'warning');
      return;
    }

    var xml = NutriDocx.generateWeekReport(user, weekReps);
    NutriDocx.download(xml, 'report_' + user.login + '_week.doc');
    UI.toast('Отчёт скачан', 'success');
  }

  function exportStudentDoc(studentId) {
    var student = NutriDB.findUserById(studentId);
    if (!student) return;
    var reports = NutriDB.getStudentReports(studentId);
    var weekDates = UI.getWeekDates(UI.todayStr());
    var weekReps = reports.filter(function(r) { return weekDates.indexOf(r.date) !== -1; });
    var xml = NutriDocx.generateWeekReport(student, weekReps.length ? weekReps : reports);
    NutriDocx.download(xml, 'report_' + student.login + '_week.doc');
    UI.toast('Отчёт скачан', 'success');
  }

  /* ---- Helpers ---- */
  function escHtml(s) {
    var div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
  }

  function escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pluralDays(n) {
    var m = n % 10;
    var m2 = n % 100;
    if (m === 1 && m2 !== 11) return 'день';
    if (m >= 2 && m <= 4 && (m2 < 10 || m2 >= 20)) return 'дня';
    return 'дней';
  }

  function logout() {
    NutriAuth.logout();
    var screen = $('#auth-screen');
    screen.dataset.rendered = '';
    navigate('/');
    route();
  }

  /* ---- Init ---- */
  function init() {
    // Загружаем все данные с воркера в in-memory кэш и только потом рисуем UI
    NutriDB.init().catch(function(err) {
      console.error('Не удалось загрузить данные:', err);
      NutriUI.toast('Не удалось подключиться к серверу. Проверьте конфигурацию воркера.', 'error');
    }).then(function() {
      route();
    });

    window.addEventListener('hashchange', route);

    // Nav delegation
    document.addEventListener('click', function(e) {
      var nav = e.target.closest('.nav-item[data-nav]');
      if (nav) {
        navigate(nav.dataset.nav);
      }
    });
  }

  return {
    init: init,
    navigate: navigate,
    route: route,
    logout: logout,
    addProductModal: addProductModal,
    exportStudentWeek: exportStudentWeek,
    exportStudentDoc: exportStudentDoc,
    dermCloseModal: dermCloseModal,
    dermNewRecord: dermNewRecord,
    dermEditRecord: dermEditRecord,
    dermDeleteRecord: dermDeleteRecord,
    skinSurveyStart: skinSurveyStart,
    skinSurveyDelete: skinSurveyDelete
  };
})();

document.addEventListener('DOMContentLoaded', NutriApp.init);
