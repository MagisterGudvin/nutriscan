/* ============================================
   NutriForce — API Module
   ============================================ */
var NutriAPI = (function() {
  'use strict';

  function getWorkerUrl() {
    return (window.NUTRI_CONFIG && window.NUTRI_CONFIG.WORKER_URL) || '';
  }

  // Таймаут по умолчанию для всех запросов к Worker. В РФ Cloudflare часто
  // тормозит из-за throttling — без таймаута fetch может висеть минутами,
  // и пользователь думает что сайт сломан.
  var DEFAULT_TIMEOUT_MS = 15000;

  function fetchWithTimeout(url, opts, timeoutMs) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    if (ctrl) opts.signal = ctrl.signal;
    var timer = setTimeout(function() {
      if (ctrl) ctrl.abort();
    }, timeoutMs || DEFAULT_TIMEOUT_MS);
    return fetch(url, opts).then(function(r) {
      clearTimeout(timer);
      return r;
    }, function(err) {
      clearTimeout(timer);
      // AbortError → даём понятную ошибку
      if (err && err.name === 'AbortError') {
        throw new Error('Превышено время ожидания (' + Math.round((timeoutMs || DEFAULT_TIMEOUT_MS)/1000) + ' c)');
      }
      throw err;
    });
  }

  function request(method, path, body, timeoutMs) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    return fetchWithTimeout(getWorkerUrl() + path, opts, timeoutMs).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function analyze(meals, norms, products) {
    // Анализ может занимать время на стороне AI-агента, увеличиваем таймаут.
    return request('POST', '/api/analyze', {
      meals: meals,
      norms: norms,
      products: products
    }, 60000);
  }

  function getData(file) {
    return request('GET', '/data/' + file, null, 12000);
  }

  function putData(file, data) {
    return request('PUT', '/data/' + file, data, 20000);
  }

  return {
    analyze: analyze,
    getData: getData,
    putData: putData,
    getWorkerUrl: getWorkerUrl
  };
})();
