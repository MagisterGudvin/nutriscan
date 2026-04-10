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

  function generateReport(student, report) {
    var body = '';

    body += para('NutriCheck — Отчёт', { size: 36, bold: true, color: '#16a34a', spacing: 200 });
    body += para(student.name + ' — ' + report.date, { size: 28, bold: true, spacing: 200 });

    body += para('Приёмы пищи', { size: 26, bold: true, spacing: 100, color: '#0f172a' });
    if (report.meals) {
      var mealNames = { breakfast: 'Завтрак', lunch: 'Обед', snack: 'Полдник', dinner: 'Ужин' };
      Object.keys(mealNames).forEach(function(key) {
        if (report.meals[key]) {
          body += para(mealNames[key] + ': ' + report.meals[key], { size: 22, spacing: 60 });
        }
      });
    }

    body += para('', { spacing: 100 });

    if (report.totals && report.norms) {
      body += para('Нутриенты', { size: 26, bold: true, spacing: 100, color: '#0f172a' });

      var rows = [];
      rows.push(tableRow([
        { text: 'Показатель', bold: true, shd: '#F1F5F9' },
        { text: 'Факт', bold: true, shd: '#F1F5F9' },
        { text: 'Норма', bold: true, shd: '#F1F5F9' },
        { text: '%', bold: true, shd: '#F1F5F9' }
      ], { header: true }));

      var metrics = [
        { label: 'Калории (ккал)', key: 'calories' },
        { label: 'Белок (г)', key: 'protein' },
        { label: 'Жиры (г)', key: 'fat' },
        { label: 'Углеводы (г)', key: 'carbs' }
      ];

      metrics.forEach(function(m) {
        var val = report.totals[m.key] || 0;
        var norm = report.norms[m.key] || 0;
        var pct = norm > 0 ? Math.round(val / norm * 100) : 0;
        var pctColor = pct >= 80 && pct <= 120 ? '#16a34a' : '#ef4444';
        rows.push(tableRow([
          { text: m.label },
          { text: String(val), bold: true },
          { text: String(norm), color: '#16a34a' },
          { text: pct + '%', color: pctColor, bold: true }
        ]));
      });

      body += table(rows);
      body += para('', { spacing: 100 });

      var totalRow = tableRow([
        { text: 'ИТОГО', bold: true, shd: '#F8FAFC' },
        { text: report.totals.calories + ' ккал', bold: true, shd: '#F8FAFC' },
        { text: report.norms.calories + ' ккал', shd: '#F8FAFC', color: '#16a34a' },
        { text: Math.round(report.totals.calories / report.norms.calories * 100) + '%', bold: true, shd: '#F8FAFC' }
      ]);
      body += table([totalRow]);
    }

    body += para('', { spacing: 100 });

    if (report.deficits && report.deficits.length) {
      body += para('Дефициты', { size: 26, bold: true, spacing: 100, color: '#ef4444' });
      report.deficits.forEach(function(d) {
        body += para('\u26a0 ' + d, { size: 22, color: '#ef4444', spacing: 40 });
      });
      body += para('', { spacing: 100 });
    }

    if (report.imbalances && report.imbalances.length) {
      body += para('Дисбалансы', { size: 26, bold: true, spacing: 100, color: '#f59e0b' });
      report.imbalances.forEach(function(d) {
        body += para('\u26a0 ' + d, { size: 22, color: '#f59e0b', spacing: 40 });
      });
      body += para('', { spacing: 100 });
    }

    if (report.sources && report.sources.length) {
      body += para('Источники данных', { size: 26, bold: true, spacing: 100, color: '#8b5cf6' });

      var srcRows = [];
      srcRows.push(tableRow([
        { text: 'Продукт', bold: true, shd: '#F1F5F9' },
        { text: 'КБЖУ', bold: true, shd: '#F1F5F9' },
        { text: 'Источник', bold: true, shd: '#F1F5F9' },
        { text: 'Раздел / страница', bold: true, shd: '#F1F5F9' }
      ], { header: true }));

      report.sources.forEach(function(s) {
        srcRows.push(tableRow([
          { text: s.product || '' },
          { text: s.value || '', size: 20 },
          { text: s.source || '', color: '#8b5cf6', bold: true, size: 20 },
          { text: s.detail || '', size: 20, color: '#64748b' }
        ]));
      });

      body += table(srcRows);
      body += para('', { spacing: 100 });
    }

    if (report.recommendations && report.recommendations.length) {
      body += para('Рекомендации', { size: 26, bold: true, spacing: 100, color: '#16a34a' });
      report.recommendations.forEach(function(r) {
        body += para('\u2714 ' + r, { size: 22, color: '#16a34a', spacing: 40, shd: '#F0FDF4' });
      });
    }

    if (report.teacherComment) {
      body += para('', { spacing: 100 });
      body += para('Комментарий преподавателя', { size: 26, bold: true, spacing: 100, color: '#3b82f6' });
      body += para(report.teacherComment, { size: 22, spacing: 40, shd: '#DBEAFE', color: '#1e40af' });
    }

    return wrapDocument(body);
  }

  function generateWeekReport(student, reports) {
    var body = '';

    body += para('NutriCheck — Недельный отчёт', { size: 36, bold: true, color: '#16a34a', spacing: 200 });
    body += para(student.name, { size: 28, bold: true, spacing: 100 });

    if (reports.length === 0) {
      body += para('Нет данных за выбранный период', { size: 22, spacing: 200 });
      return wrapDocument(body);
    }

    var dateRange = reports[reports.length - 1].date + ' — ' + reports[0].date;
    body += para('Период: ' + dateRange, { size: 22, spacing: 200, color: '#64748b' });

    var rows = [];
    rows.push(tableRow([
      { text: 'Дата', bold: true, shd: '#F1F5F9' },
      { text: 'Ккал', bold: true, shd: '#F1F5F9' },
      { text: 'Б', bold: true, shd: '#F1F5F9' },
      { text: 'Ж', bold: true, shd: '#F1F5F9' },
      { text: 'У', bold: true, shd: '#F1F5F9' },
      { text: 'Статус', bold: true, shd: '#F1F5F9' }
    ], { header: true }));

    reports.forEach(function(r) {
      var status = NutriAnalysis.getDayStatus(r.totals, r.norms);
      var statusText = status === 'good' ? 'Норма' : status === 'warning' ? 'Внимание' : 'Отклонение';
      var statusColor = status === 'good' ? '#16a34a' : status === 'warning' ? '#f59e0b' : '#ef4444';
      rows.push(tableRow([
        { text: r.date },
        { text: String((r.totals && r.totals.calories) || 0) },
        { text: String((r.totals && r.totals.protein) || 0) },
        { text: String((r.totals && r.totals.fat) || 0) },
        { text: String((r.totals && r.totals.carbs) || 0) },
        { text: statusText, color: statusColor, bold: true }
      ]));
    });

    body += table(rows);
    body += para('', { spacing: 200 });

    var allRecs = [];
    reports.forEach(function(r) {
      if (r.recommendations) {
        r.recommendations.forEach(function(rec) {
          if (allRecs.indexOf(rec) === -1) allRecs.push(rec);
        });
      }
    });

    if (allRecs.length) {
      body += para('Сводные рекомендации', { size: 26, bold: true, spacing: 100, color: '#16a34a' });
      allRecs.forEach(function(r) {
        body += para('\u2714 ' + r, { size: 22, color: '#16a34a', spacing: 40, shd: '#F0FDF4' });
      });
    }

    return wrapDocument(body);
  }

  function generateAllStudentsReport(students, allReports) {
    var body = '';

    body += para('NutriCheck — Общий отчёт', { size: 36, bold: true, color: '#16a34a', spacing: 200 });
    body += para('Дата формирования: ' + new Date().toISOString().slice(0, 10), { size: 22, spacing: 200, color: '#64748b' });

    var rows = [];
    rows.push(tableRow([
      { text: 'Студент', bold: true, shd: '#F1F5F9' },
      { text: 'Отчётов', bold: true, shd: '#F1F5F9' },
      { text: 'Ср. ккал', bold: true, shd: '#F1F5F9' },
      { text: 'Цель', bold: true, shd: '#F1F5F9' }
    ], { header: true }));

    students.forEach(function(s) {
      var reps = allReports[s.id] || [];
      var avgCal = 0;
      if (reps.length) {
        var sum = reps.reduce(function(a, r) { return a + ((r.totals && r.totals.calories) || 0); }, 0);
        avgCal = Math.round(sum / reps.length);
      }
      var goal = s.norms ? NutriAnalysis.getGoalLabel(s.norms.goal) : '—';
      rows.push(tableRow([
        { text: s.name },
        { text: String(reps.length) },
        { text: String(avgCal) },
        { text: goal }
      ]));
    });

    body += table(rows);

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
