/* ============================================
   NutriCheck — UI Module
   ============================================ */
var NutriUI = (function() {
  'use strict';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function toast(msg, type) {
    var container = $('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    var icons = { success: '\u2714', error: '\u2718', warning: '\u26a0' };
    el.innerHTML = (icons[type] || '\u2139') + '&nbsp;&nbsp;' + msg;
    container.appendChild(el);
    setTimeout(function() { el.remove(); }, 3000);
  }

  function showLoading(text) {
    var existing = $('.loading-overlay');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'loading-overlay';
    el.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">' + (text || 'Загрузка') + '<span class="loading-dots"></span></div>';
    document.body.appendChild(el);
  }

  function hideLoading() {
    var el = $('.loading-overlay');
    if (el) el.remove();
  }

  function showModal(content, onClose) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal__handle"></div>' + content;
    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.remove();
        if (onClose) onClose();
      }
    });
    document.body.appendChild(overlay);
    return { overlay: overlay, modal: modal, close: function() { overlay.remove(); if (onClose) onClose(); } };
  }

  function confirm(title, text, onOk) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--center';
    overlay.innerHTML =
      '<div class="confirm-dialog">' +
        '<div class="confirm-dialog__title">' + title + '</div>' +
        '<div class="confirm-dialog__text">' + text + '</div>' +
        '<div class="confirm-dialog__actions">' +
          '<button class="btn btn--secondary" data-action="cancel">Отмена</button>' +
          '<button class="btn btn--danger" data-action="ok">Удалить</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(e) {
      var action = e.target.dataset.action;
      if (action === 'cancel' || e.target === overlay) overlay.remove();
      if (action === 'ok') { overlay.remove(); onOk(); }
    });
    document.body.appendChild(overlay);
  }

  function progressRing(value, max, size, strokeWidth, colorClass) {
    size = size || 120;
    strokeWidth = strokeWidth || 8;
    var r = (size - strokeWidth) / 2;
    var c = 2 * Math.PI * r;
    var pct = Math.min(value / (max || 1), 1);
    var offset = c * (1 - pct);
    var col = colorClass || 'var(--c-primary)';

    return '<svg class="progress-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle class="progress-ring__bg" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r + '" fill="none" stroke-width="' + strokeWidth + '"/>' +
      '<circle class="progress-ring__fill" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + offset + '"/>' +
    '</svg>';
  }

  function progressBar(value, max, cls) {
    var pct = Math.min(Math.round(value / (max || 1) * 100), 100);
    return '<div class="progress-bar"><div class="progress-bar__fill ' + (cls || '') + '" style="width:' + pct + '%"></div></div>';
  }

  function skeleton(type, count) {
    var html = '';
    for (var i = 0; i < (count || 1); i++) {
      html += '<div class="skeleton skeleton--' + type + '"></div>';
    }
    return html;
  }

  function emptyState(icon, title, text) {
    return '<div class="empty-state">' +
      '<div class="empty-state__icon">' + icon + '</div>' +
      '<div class="empty-state__title">' + title + '</div>' +
      '<div class="empty-state__text">' + text + '</div>' +
    '</div>';
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    var months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()];
  }

  function _fmtLocal(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function todayStr() {
    return _fmtLocal(new Date());
  }

  function getWeekDates(centerDate) {
    var parts = centerDate.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var dow = d.getDay();
    var monday = new Date(d);
    monday.setDate(d.getDate() - ((dow + 6) % 7));
    var dates = [];
    for (var i = 0; i < 7; i++) {
      var dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      dates.push(_fmtLocal(dd));
    }
    return dates;
  }

  function dayNames() {
    return ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  }

  function statusEmoji(status) {
    switch(status) {
      case 'good': return '\u2705';
      case 'warning': return '\u26a0\ufe0f';
      case 'bad': return '\u274c';
      default: return '\u2b55';
    }
  }

  function statusLabel(status) {
    switch(status) {
      case 'good': return 'В норме';
      case 'warning': return 'Есть отклонения';
      case 'bad': return 'Требует внимания';
      default: return 'Нет данных';
    }
  }

  function statusClass(status) {
    switch(status) {
      case 'good': return 'status--good';
      case 'warning': return 'status--warning';
      case 'bad': return 'status--bad';
      default: return 'status--neutral';
    }
  }

  return {
    $: $,
    $$: $$,
    toast: toast,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showModal: showModal,
    confirm: confirm,
    progressRing: progressRing,
    progressBar: progressBar,
    skeleton: skeleton,
    emptyState: emptyState,
    formatDate: formatDate,
    todayStr: todayStr,
    getWeekDates: getWeekDates,
    dayNames: dayNames,
    statusEmoji: statusEmoji,
    statusLabel: statusLabel,
    statusClass: statusClass
  };
})();
