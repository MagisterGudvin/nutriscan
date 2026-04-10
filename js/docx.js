/* ============================================
   NutriCheck — DOCX Export (WordprocessingML XML)
   ============================================ */
var NutriDocx = (function() {
  'use strict';

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function color(hex) {
    return hex.replace('#','');
  }

  function para(text, opts) {
    opts = opts || {};
    var sz = (opts.size || 22);
    var rpr = '<w:rPr>';
    rpr += '<w:rFonts w:ascii="Inter" w:hAnsi="Inter" w:cs="Inter"/>';
    rpr += '<w:sz w:val="' + sz + '"/>';
    if (opts.bold) rpr += '<w:b/>';
    if (opts.color) rpr += '<w:color w:val="' + color(opts.color) + '"/>';
    if (opts.italic) rpr += '<w:i/>';
    rpr += '</w:rPr>';

    var ppr = '<w:pPr>';
    if (opts.align) ppr += '<w:jc w:val="' + opts.align + '"/>';
    if (opts.spacing) ppr += '<w:spacing w:after="' + opts.spacing + '"/>';
    if (opts.shd) ppr += '<w:shd w:val="clear" w:fill="' + color(opts.shd) + '"/>';
    ppr += '</w:pPr>';

    return '<w:p>' + ppr + '<w:r>' + rpr + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
  }

  function tableRow(cells, opts) {
    opts = opts || {};
    var row = '<w:tr>';
    if (opts.header) {
      row += '<w:trPr><w:tblHeader/></w:trPr>';
    }
    cells.forEach(function(cell) {
      var tcPr = '<w:tcPr>';
      tcPr += '<w:tcW w:w="0" w:type="auto"/>';
      if (cell.shd) tcPr += '<w:shd w:val="clear" w:fill="' + color(cell.shd) + '"/>';
      tcPr += '<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>';
      tcPr += '</w:tcPr>';
      row += '<w:tc>' + tcPr + para(cell.text, cell) + '</w:tc>';
    });
    row += '</w:tr>';
    return row;
  }

  function table(rows) {
    var tbl = '<w:tbl>';
    tbl += '<w:tblPr>';
    tbl += '<w:tblW w:w="5000" w:type="pct"/>';
    tbl += '<w:tblBorders>';
    ['top','left','bottom','right','insideH','insideV'].forEach(function(b) {
      tbl += '<w:' + b + ' w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>';
    });
    tbl += '</w:tblBorders>';
    tbl += '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/></w:tblCellMar>';
    tbl += '</w:tblPr>';
    tbl += rows.join('');
    tbl += '</w:tbl>';
    return tbl;
  }

  function sexLabel(s) { return s === 'female' ? 'Женский' : 'Мужской'; }

  function formatMeals(meals) {
    if (!meals) return [];
    var mealNames = { breakfast: 'Завтрак', lunch: 'Обед', snack: 'Полдник', dinner: 'Ужин' };
    var out = [];
    Object.keys(mealNames).forEach(function(key) {
      if (meals[key]) out.push({ name: mealNames[key], text: meals[key] });
    });
    return out;
  }

  function renderStudentCard(student) {
    var out = '';
    out += para('Данные студента', { size: 26, bold: true, spacing: 100, color: '#0f172a' });

    var rows = [];
    var pairs = [
      ['ФИО', student.name || '—'],
      ['Логин', student.login || '—'],
      ['Пол', sexLabel(student.sex)],
      ['Возраст', (student.age || '—') + ' лет'],
      ['Рост', (student.height || '—') + ' см'],
      ['Вес', (student.currentWeight || '—') + ' кг'],
      ['Уровень активности', NutriAnalysis.getActivityLabel(student.activity)]
    ];
    if (student.registeredAt) pairs.push(['Зарегистрирован', student.registeredAt]);

    pairs.forEach(function(p) {
      rows.push(tableRow([
        { text: p[0], bold: true, shd: '#F8FAFC' },
        { text: String(p[1]) }
      ]));
    });
    out += table(rows);
    out += para('', { spacing: 80 });
    return out;
  }

  function renderNormsBlock(student) {
    var n = student.norms || {};
    var out = '';
    out += para('Индивидуальные нормы', { size: 26, bold: true, spacing: 100, color: '#0f172a' });

    if (n.bmr && n.tdee) {
      out += para('Базовый метаболизм (BMR, Миффлин–Сан-Жеор): ' + n.bmr + ' ккал', { size: 22, color: '#475569', spacing: 40 });
      out += para('Суточный расход (TDEE = BMR × ' + (student.activity ? NutriAnalysis.ACTIVITY_LEVELS[student.activity].factor : '1.55') + '): ' + n.tdee + ' ккал', { size: 22, color: '#475569', spacing: 80 });
    }

    var rows = [];
    rows.push(tableRow([
      { text: 'Показатель', bold: true, shd: '#F1F5F9' },
      { text: 'Норма', bold: true, shd: '#F1F5F9' },
      { text: 'Комментарий', bold: true, shd: '#F1F5F9' }
    ], { header: true }));

    rows.push(tableRow([
      { text: 'Калории, ккал' },
      { text: String(n.calories || '—'), bold: true, color: '#16a34a' },
      { text: 'Суточная потребность', size: 20, color: '#64748b' }
    ]));
    rows.push(tableRow([
      { text: 'Белок, г' },
      { text: String(n.protein || '—'), bold: true, color: '#16a34a' },
      { text: '1.8 г на кг массы тела', size: 20, color: '#64748b' }
    ]));
    rows.push(tableRow([
      { text: 'Жиры, г' },
      { text: String(n.fat || '—'), bold: true, color: '#16a34a' },
      { text: '0.9 г на кг массы тела', size: 20, color: '#64748b' }
    ]));
    rows.push(tableRow([
      { text: 'Углеводы, г' },
      { text: String(n.carbs || '—'), bold: true, color: '#16a34a' },
      { text: 'Остаток калорий', size: 20, color: '#64748b' }
    ]));
    if (n.omega3 != null) {
      rows.push(tableRow([
        { text: 'Омега-3, г' },
        { text: String(n.omega3), bold: true, color: '#16a34a' },
        { text: 'Минимум в сутки', size: 20, color: '#64748b' }
      ]));
    }
    if (n.omega6 != null) {
      rows.push(tableRow([
        { text: 'Омега-6, г' },
        { text: String(n.omega6), bold: true, color: '#16a34a' },
        { text: 'Максимум в сутки', size: 20, color: '#64748b' }
      ]));
    }

    out += table(rows);
    out += para('', { spacing: 100 });
    return out;
  }

  function renderNutrientsTable(totals, norms) {
    if (!totals || !norms) return '';
    var out = '';
    out += para('Факт vs норма', { size: 26, bold: true, spacing: 100, color: '#0f172a' });

    var rows = [];
    rows.push(tableRow([
      { text: 'Показатель', bold: true, shd: '#F1F5F9' },
      { text: 'Факт', bold: true, shd: '#F1F5F9' },
      { text: 'Норма', bold: true, shd: '#F1F5F9' },
      { text: 'Δ', bold: true, shd: '#F1F5F9' },
      { text: '% нормы', bold: true, shd: '#F1F5F9' },
      { text: 'Статус', bold: true, shd: '#F1F5F9' }
    ], { header: true }));

    var metrics = [
      { label: 'Калории, ккал', key: 'calories' },
      { label: 'Белок, г', key: 'protein' },
      { label: 'Жиры, г', key: 'fat' },
      { label: 'Углеводы, г', key: 'carbs' }
    ];
    if (norms.omega3 != null) metrics.push({ label: 'Омега-3, г', key: 'omega3' });
    if (norms.omega6 != null) metrics.push({ label: 'Омега-6, г', key: 'omega6' });

    metrics.forEach(function(m) {
      var val = Number(totals[m.key]) || 0;
      var norm = Number(norms[m.key]) || 0;
      var delta = Math.round((val - norm) * 10) / 10;
      var pct = norm > 0 ? Math.round(val / norm * 100) : 0;
      var status, statusColor;
      if (pct >= 90 && pct <= 110) { status = 'В норме'; statusColor = '#16a34a'; }
      else if (pct >= 75 && pct <= 125) { status = 'Отклонение'; statusColor = '#f59e0b'; }
      else if (pct < 75) { status = 'Дефицит'; statusColor = '#ef4444'; }
      else { status = 'Избыток'; statusColor = '#ef4444'; }

      rows.push(tableRow([
        { text: m.label },
        { text: String(val), bold: true },
        { text: String(norm), color: '#16a34a' },
        { text: (delta >= 0 ? '+' : '') + delta, color: delta === 0 ? '#64748b' : (delta > 0 ? '#f59e0b' : '#ef4444') },
        { text: pct + '%', bold: true, color: statusColor },
        { text: status, bold: true, color: statusColor }
      ]));
    });

    out += table(rows);
    out += para('', { spacing: 100 });
    return out;
  }

  function renderMealsBlock(meals) {
    var out = '';
    var list = formatMeals(meals);
    if (!list.length) return out;
    out += para('Приёмы пищи', { size: 26, bold: true, spacing: 100, color: '#0f172a' });
    var rows = [];
    rows.push(tableRow([
      { text: 'Приём', bold: true, shd: '#F1F5F9' },
      { text: 'Описание', bold: true, shd: '#F1F5F9' }
    ], { header: true }));
    list.forEach(function(m) {
      rows.push(tableRow([
        { text: m.name, bold: true },
        { text: m.text }
      ]));
    });
    out += table(rows);
    out += para('', { spacing: 100 });
    return out;
  }

  function renderSourcesTable(sources, title) {
    if (!sources || !sources.length) return '';
    var out = '';
    out += para(title || 'Источники данных', { size: 26, bold: true, spacing: 100, color: '#8b5cf6' });
    out += para('Данные КБЖУ продуктов получены из следующих источников:', { size: 20, color: '#64748b', spacing: 80, italic: true });

    var srcRows = [];
    srcRows.push(tableRow([
      { text: '№', bold: true, shd: '#F1F5F9' },
      { text: 'Продукт', bold: true, shd: '#F1F5F9' },
      { text: 'КБЖУ', bold: true, shd: '#F1F5F9' },
      { text: 'Источник', bold: true, shd: '#F1F5F9' },
      { text: 'Раздел / страница', bold: true, shd: '#F1F5F9' }
    ], { header: true }));

    sources.forEach(function(s, i) {
      srcRows.push(tableRow([
        { text: String(i + 1), size: 20, color: '#64748b' },
        { text: s.product || '', bold: true },
        { text: s.value || '', size: 20 },
        { text: s.source || '', color: '#8b5cf6', bold: true, size: 20 },
        { text: s.detail || '', size: 20, color: '#64748b' }
      ]));
    });

    out += table(srcRows);
    out += para('', { spacing: 100 });
    return out;
  }

  function generateReport(student, report) {
    var body = '';

    body += para('NutriCheck — Отчёт за день', { size: 36, bold: true, color: '#16a34a', spacing: 100 });
    body += para(student.name + ' — ' + report.date, { size: 28, bold: true, spacing: 80 });
    body += para('Дата формирования отчёта: ' + new Date().toISOString().slice(0, 10), { size: 20, color: '#64748b', spacing: 200, italic: true });

    // 1. Профиль студента
    body += renderStudentCard(student);

    // 2. Индивидуальные нормы с формулами
    body += renderNormsBlock(student);

    // 3. Приёмы пищи в таблице
    body += renderMealsBlock(report.meals);

    // 4. Нутриенты факт vs норма с отклонениями и статусом
    body += renderNutrientsTable(report.totals, report.norms);

    // 5. Итоговый статус дня
    if (report.totals && report.norms) {
      var status = NutriAnalysis.getDayStatus(report.totals, report.norms);
      var statusText = status === 'good' ? 'ДЕНЬ В НОРМЕ' : status === 'warning' ? 'ЕСТЬ ОТКЛОНЕНИЯ' : 'ЗНАЧИТЕЛЬНЫЕ ОТКЛОНЕНИЯ';
      var statusColor = status === 'good' ? '#16a34a' : status === 'warning' ? '#f59e0b' : '#ef4444';
      var statusBg = status === 'good' ? '#F0FDF4' : status === 'warning' ? '#FFFBEB' : '#FEF2F2';
      body += para(statusText, { size: 28, bold: true, spacing: 100, color: statusColor, shd: statusBg, align: 'center' });
      body += para('', { spacing: 100 });
    }

    // 6. Дефициты
    if (report.deficits && report.deficits.length) {
      body += para('Дефициты', { size: 26, bold: true, spacing: 100, color: '#ef4444' });
      report.deficits.forEach(function(d) {
        body += para('\u26a0 ' + d, { size: 22, color: '#ef4444', spacing: 40 });
      });
      body += para('', { spacing: 100 });
    }

    // 7. Дисбалансы
    if (report.imbalances && report.imbalances.length) {
      body += para('Дисбалансы', { size: 26, bold: true, spacing: 100, color: '#f59e0b' });
      report.imbalances.forEach(function(d) {
        body += para('\u26a0 ' + d, { size: 22, color: '#f59e0b', spacing: 40 });
      });
      body += para('', { spacing: 100 });
    }

    // 8. Источники данных — ОБЯЗАТЕЛЬНО подробно
    body += renderSourcesTable(report.sources, 'Источники данных по продуктам');

    // 9. Рекомендации
    if (report.recommendations && report.recommendations.length) {
      body += para('Рекомендации', { size: 26, bold: true, spacing: 100, color: '#16a34a' });
      report.recommendations.forEach(function(r) {
        body += para('\u2714 ' + r, { size: 22, color: '#16a34a', spacing: 40, shd: '#F0FDF4' });
      });
      body += para('', { spacing: 100 });
    }

    // 10. Комментарий преподавателя
    if (report.teacherComment) {
      body += para('Комментарий преподавателя', { size: 26, bold: true, spacing: 100, color: '#3b82f6' });
      body += para(report.teacherComment, { size: 22, spacing: 40, shd: '#DBEAFE', color: '#1e40af' });
      body += para('', { spacing: 100 });
    }

    // Подпись
    body += para('', { spacing: 200 });
    body += para('___________________________________', { size: 20, color: '#94a3b8', spacing: 40 });
    body += para('Отчёт сформирован системой NutriCheck. Оценка производится на основе формулы Миффлина–Сан-Жеора с учётом пола, возраста, роста, массы тела и уровня физической активности студента.', { size: 18, color: '#94a3b8', italic: true });

    return wrapDocument(body);
  }

  function generateWeekReport(student, reports) {
    var body = '';

    body += para('NutriCheck — Недельный отчёт', { size: 36, bold: true, color: '#16a34a', spacing: 100 });
    body += para(student.name, { size: 28, bold: true, spacing: 80 });
    body += para('Дата формирования отчёта: ' + new Date().toISOString().slice(0, 10), { size: 20, color: '#64748b', spacing: 200, italic: true });

    if (reports.length === 0) {
      body += renderStudentCard(student);
      body += para('Нет данных за выбранный период', { size: 22, spacing: 200, color: '#ef4444' });
      return wrapDocument(body);
    }

    // Сортируем по дате по возрастанию для красивой хронологии
    var sorted = reports.slice().sort(function(a, b) {
      return (a.date || '').localeCompare(b.date || '');
    });

    var dateRange = sorted[0].date + ' — ' + sorted[sorted.length - 1].date;
    body += para('Период: ' + dateRange + ' (' + sorted.length + ' дн.)', { size: 22, spacing: 200, color: '#64748b', bold: true });

    // 1. Профиль студента
    body += renderStudentCard(student);

    // 2. Индивидуальные нормы
    body += renderNormsBlock(student);

    // 3. Сводная таблица по дням
    body += para('Сводка по дням', { size: 26, bold: true, spacing: 100, color: '#0f172a' });
    var rows = [];
    rows.push(tableRow([
      { text: 'Дата', bold: true, shd: '#F1F5F9' },
      { text: 'Ккал', bold: true, shd: '#F1F5F9' },
      { text: 'Б, г', bold: true, shd: '#F1F5F9' },
      { text: 'Ж, г', bold: true, shd: '#F1F5F9' },
      { text: 'У, г', bold: true, shd: '#F1F5F9' },
      { text: '% нормы', bold: true, shd: '#F1F5F9' },
      { text: 'Статус', bold: true, shd: '#F1F5F9' }
    ], { header: true }));

    var sumCal = 0, sumP = 0, sumF = 0, sumC = 0, goodCnt = 0, warnCnt = 0, badCnt = 0;

    sorted.forEach(function(r) {
      var t = r.totals || {};
      var n = r.norms || student.norms || {};
      var cal = Number(t.calories) || 0;
      var p = Number(t.protein) || 0;
      var f = Number(t.fat) || 0;
      var c = Number(t.carbs) || 0;
      sumCal += cal; sumP += p; sumF += f; sumC += c;
      var pct = (n.calories > 0) ? Math.round(cal / n.calories * 100) : 0;
      var status = NutriAnalysis.getDayStatus(t, n);
      var statusText = status === 'good' ? 'Норма' : status === 'warning' ? 'Внимание' : 'Отклонение';
      var statusColor = status === 'good' ? '#16a34a' : status === 'warning' ? '#f59e0b' : '#ef4444';
      if (status === 'good') goodCnt++;
      else if (status === 'warning') warnCnt++;
      else badCnt++;
      rows.push(tableRow([
        { text: r.date, bold: true },
        { text: String(cal) },
        { text: String(p) },
        { text: String(f) },
        { text: String(c) },
        { text: pct + '%', color: statusColor, bold: true },
        { text: statusText, color: statusColor, bold: true }
      ]));
    });

    // Итоговая строка — средние значения
    var days = sorted.length;
    rows.push(tableRow([
      { text: 'Среднее', bold: true, shd: '#F8FAFC' },
      { text: String(Math.round(sumCal / days)), bold: true, shd: '#F8FAFC' },
      { text: String(Math.round(sumP / days)), bold: true, shd: '#F8FAFC' },
      { text: String(Math.round(sumF / days)), bold: true, shd: '#F8FAFC' },
      { text: String(Math.round(sumC / days)), bold: true, shd: '#F8FAFC' },
      { text: '—', shd: '#F8FAFC' },
      { text: '—', shd: '#F8FAFC' }
    ]));

    body += table(rows);
    body += para('', { spacing: 100 });

    // 4. Итоговая статистика по статусам
    body += para('Распределение дней', { size: 24, bold: true, spacing: 80, color: '#0f172a' });
    body += para('\u2714 В норме: ' + goodCnt + ' дн.', { size: 22, color: '#16a34a', spacing: 40 });
    body += para('\u26a0 С отклонениями: ' + warnCnt + ' дн.', { size: 22, color: '#f59e0b', spacing: 40 });
    body += para('\u2716 Значительные отклонения: ' + badCnt + ' дн.', { size: 22, color: '#ef4444', spacing: 100 });

    // 5. Средние vs норма
    if (student.norms) {
      var avgTotals = {
        calories: Math.round(sumCal / days),
        protein: Math.round(sumP / days),
        fat: Math.round(sumF / days),
        carbs: Math.round(sumC / days)
      };
      body += para('Средние значения за неделю относительно нормы', { size: 24, bold: true, spacing: 80, color: '#0f172a' });
      body += renderNutrientsTable(avgTotals, student.norms);
    }

    // 6. Агрегированные дефициты / дисбалансы
    var allDeficits = [];
    var allImbalances = [];
    var allRecs = [];
    var allSources = [];
    var seenSources = {};

    sorted.forEach(function(r) {
      if (r.deficits) r.deficits.forEach(function(d) {
        if (allDeficits.indexOf(d) === -1) allDeficits.push(d);
      });
      if (r.imbalances) r.imbalances.forEach(function(i) {
        if (allImbalances.indexOf(i) === -1) allImbalances.push(i);
      });
      if (r.recommendations) r.recommendations.forEach(function(rec) {
        if (allRecs.indexOf(rec) === -1) allRecs.push(rec);
      });
      if (r.sources) r.sources.forEach(function(s) {
        if (!s || !s.product) return;
        var key = String(s.product).toLowerCase() + '|' + String(s.source || '').toLowerCase();
        if (!seenSources[key]) {
          seenSources[key] = true;
          allSources.push(s);
        }
      });
    });

    if (allDeficits.length) {
      body += para('Сводные дефициты за неделю', { size: 26, bold: true, spacing: 100, color: '#ef4444' });
      allDeficits.forEach(function(d) {
        body += para('\u26a0 ' + d, { size: 22, color: '#ef4444', spacing: 40 });
      });
      body += para('', { spacing: 100 });
    }

    if (allImbalances.length) {
      body += para('Сводные дисбалансы за неделю', { size: 26, bold: true, spacing: 100, color: '#f59e0b' });
      allImbalances.forEach(function(i) {
        body += para('\u26a0 ' + i, { size: 22, color: '#f59e0b', spacing: 40 });
      });
      body += para('', { spacing: 100 });
    }

    // 7. Источники данных — агрегированные по всей неделе
    body += renderSourcesTable(allSources, 'Источники данных по продуктам за неделю');

    // 8. Рекомендации
    if (allRecs.length) {
      body += para('Сводные рекомендации', { size: 26, bold: true, spacing: 100, color: '#16a34a' });
      allRecs.forEach(function(r) {
        body += para('\u2714 ' + r, { size: 22, color: '#16a34a', spacing: 40, shd: '#F0FDF4' });
      });
      body += para('', { spacing: 100 });
    }

    // Подпись
    body += para('', { spacing: 200 });
    body += para('___________________________________', { size: 20, color: '#94a3b8', spacing: 40 });
    body += para('Отчёт сформирован системой NutriCheck. Оценка производится на основе формулы Миффлина–Сан-Жеора с учётом пола, возраста, роста, массы тела и уровня физической активности студента.', { size: 18, color: '#94a3b8', italic: true });

    return wrapDocument(body);
  }

  function generateAllStudentsReport(students, allReports) {
    var body = '';

    body += para('NutriCheck — Сводный отчёт по группе', { size: 36, bold: true, color: '#16a34a', spacing: 100 });
    body += para('Дата формирования: ' + new Date().toISOString().slice(0, 10), { size: 22, spacing: 100, color: '#64748b', italic: true });
    body += para('Всего студентов: ' + students.length, { size: 22, spacing: 200, bold: true });

    // 1. Сводная таблица
    body += para('Сводная таблица по студентам', { size: 26, bold: true, spacing: 100, color: '#0f172a' });
    var rows = [];
    rows.push(tableRow([
      { text: '№', bold: true, shd: '#F1F5F9' },
      { text: 'ФИО', bold: true, shd: '#F1F5F9' },
      { text: 'Пол', bold: true, shd: '#F1F5F9' },
      { text: 'Возраст', bold: true, shd: '#F1F5F9' },
      { text: 'Отчётов', bold: true, shd: '#F1F5F9' },
      { text: 'Ср. ккал', bold: true, shd: '#F1F5F9' },
      { text: 'Норма ккал', bold: true, shd: '#F1F5F9' },
      { text: '% нормы', bold: true, shd: '#F1F5F9' },
      { text: 'Цель', bold: true, shd: '#F1F5F9' }
    ], { header: true }));

    students.forEach(function(s, idx) {
      var reps = allReports[s.id] || [];
      var avgCal = 0;
      if (reps.length) {
        var sum = reps.reduce(function(a, r) { return a + ((r.totals && r.totals.calories) || 0); }, 0);
        avgCal = Math.round(sum / reps.length);
      }
      var normCal = (s.norms && s.norms.calories) || 0;
      var pct = normCal > 0 ? Math.round(avgCal / normCal * 100) : 0;
      var pctColor = (pct >= 90 && pct <= 110) ? '#16a34a' : (pct >= 75 && pct <= 125) ? '#f59e0b' : '#ef4444';
      var goal = s.norms ? NutriAnalysis.getGoalLabel(s.norms.goal) : '—';
      rows.push(tableRow([
        { text: String(idx + 1), size: 20, color: '#64748b' },
        { text: s.name, bold: true },
        { text: sexLabel(s.sex), size: 20 },
        { text: String(s.age || '—'), size: 20 },
        { text: String(reps.length), bold: true },
        { text: String(avgCal) },
        { text: String(normCal), color: '#16a34a' },
        { text: reps.length ? (pct + '%') : '—', bold: true, color: pctColor },
        { text: goal, size: 20 }
      ]));
    });
    body += table(rows);
    body += para('', { spacing: 200 });

    // 2. Подробный блок по каждому студенту
    students.forEach(function(s, idx) {
      var reps = (allReports[s.id] || []).slice().sort(function(a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });

      body += para('Студент ' + (idx + 1) + '. ' + s.name, { size: 28, bold: true, color: '#16a34a', spacing: 100 });
      body += renderStudentCard(s);
      body += renderNormsBlock(s);

      if (!reps.length) {
        body += para('Нет отчётов по данному студенту.', { size: 22, color: '#64748b', italic: true, spacing: 200 });
        return;
      }

      // Агрегируем
      var sumCal = 0, sumP = 0, sumF = 0, sumC = 0;
      var allDeficits = [];
      var allImbalances = [];
      var allRecs = [];
      var allSources = [];
      var seen = {};

      reps.forEach(function(r) {
        var t = r.totals || {};
        sumCal += Number(t.calories) || 0;
        sumP += Number(t.protein) || 0;
        sumF += Number(t.fat) || 0;
        sumC += Number(t.carbs) || 0;
        if (r.deficits) r.deficits.forEach(function(d) {
          if (allDeficits.indexOf(d) === -1) allDeficits.push(d);
        });
        if (r.imbalances) r.imbalances.forEach(function(i) {
          if (allImbalances.indexOf(i) === -1) allImbalances.push(i);
        });
        if (r.recommendations) r.recommendations.forEach(function(rec) {
          if (allRecs.indexOf(rec) === -1) allRecs.push(rec);
        });
        if (r.sources) r.sources.forEach(function(src) {
          if (!src || !src.product) return;
          var key = String(src.product).toLowerCase() + '|' + String(src.source || '').toLowerCase();
          if (!seen[key]) { seen[key] = true; allSources.push(src); }
        });
      });

      var days = reps.length;
      var avgTotals = {
        calories: Math.round(sumCal / days),
        protein: Math.round(sumP / days),
        fat: Math.round(sumF / days),
        carbs: Math.round(sumC / days)
      };

      body += para('Средние значения за ' + days + ' отчёт(ов)', { size: 24, bold: true, spacing: 80, color: '#0f172a' });
      if (s.norms) body += renderNutrientsTable(avgTotals, s.norms);

      if (allDeficits.length) {
        body += para('Дефициты', { size: 22, bold: true, spacing: 60, color: '#ef4444' });
        allDeficits.forEach(function(d) {
          body += para('\u26a0 ' + d, { size: 20, color: '#ef4444', spacing: 40 });
        });
      }

      if (allImbalances.length) {
        body += para('Дисбалансы', { size: 22, bold: true, spacing: 60, color: '#f59e0b' });
        allImbalances.forEach(function(i) {
          body += para('\u26a0 ' + i, { size: 20, color: '#f59e0b', spacing: 40 });
        });
      }

      body += renderSourcesTable(allSources, 'Источники данных по продуктам');

      if (allRecs.length) {
        body += para('Рекомендации', { size: 22, bold: true, spacing: 60, color: '#16a34a' });
        allRecs.forEach(function(r) {
          body += para('\u2714 ' + r, { size: 20, color: '#16a34a', spacing: 40, shd: '#F0FDF4' });
        });
      }

      body += para('', { spacing: 200 });
      body += para('———————————————————————————', { size: 18, color: '#cbd5e1', align: 'center', spacing: 200 });
    });

    // Подпись
    body += para('', { spacing: 200 });
    body += para('___________________________________', { size: 20, color: '#94a3b8', spacing: 40 });
    body += para('Отчёт сформирован системой NutriCheck. Оценка производится на основе формулы Миффлина–Сан-Жеора с учётом пола, возраста, роста, массы тела и уровня физической активности студента.', { size: 18, color: '#94a3b8', italic: true });

    return wrapDocument(body);
  }

  function wrapDocument(bodyContent) {
    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    xml += '<?mso-application progid="Word.Document"?>';
    xml += '<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">';
    xml += '<w:body>';
    xml += '<w:sectPr>';
    xml += '<w:pgSz w:w="11906" w:h="16838"/>';
    xml += '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709"/>';
    xml += '</w:sectPr>';
    xml += bodyContent;
    xml += '</w:body>';
    xml += '</w:wordDocument>';
    return xml;
  }

  function download(xml, filename) {
    var blob = new Blob([xml], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'report.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    generateReport: generateReport,
    generateWeekReport: generateWeekReport,
    generateAllStudentsReport: generateAllStudentsReport,
    download: download
  };
})();
