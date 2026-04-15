/* ============================================
   NutriForce — Storage Module (GitHub JSON via Worker)
   --------------------------------------------
   В РФ Cloudflare Worker часто дросселируется → fetch
   таймаутится, и UI остаётся без данных. Решение:
   зеркалим данные в localStorage. При загрузке сначала
   быстро отдаём кэш (UI оживает мгновенно), параллельно
   обновляем с сервера. При ошибке сети — кэш достаточен
   для логина и работы в read-only.
   ============================================ */
var NutriStorage = (function() {
  'use strict';

  var memCache = {};
  var LS_PREFIX = 'nutri_cache_';
  // Источник последней загрузки каждого файла: 'network' | 'cache' | 'none'
  var lastSource = {};

  function lsGet(file) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + file);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function lsSet(file, data) {
    try { localStorage.setItem(LS_PREFIX + file, JSON.stringify(data)); }
    catch (e) { /* квота — пропускаем */ }
  }
  function lsHas(file) {
    try { return localStorage.getItem(LS_PREFIX + file) != null; }
    catch (e) { return false; }
  }

  /* loadJSON: возвращает Promise<data>.
     Стратегия: ждём ответ Worker'а с таймаутом. Если успех — обновляем кэш.
     Если упало (таймаут / сеть / 5xx) — отдаём кэш из localStorage, если есть.
     Если кэша нет тоже — пробрасываем ошибку выше. */
  function loadJSON(file) {
    if (memCache[file]) return Promise.resolve(memCache[file]);
    return NutriAPI.getData(file).then(function(data) {
      memCache[file] = data;
      lsSet(file, data);
      lastSource[file] = 'network';
      return data;
    }, function(err) {
      var cached = lsGet(file);
      if (cached != null) {
        memCache[file] = cached;
        lastSource[file] = 'cache';
        console.warn('[NutriStorage] ' + file + ': используем localStorage-кэш (' + (err && err.message) + ')');
        return cached;
      }
      lastSource[file] = 'none';
      throw err;
    });
  }

  function saveJSON(file, data) {
    memCache[file] = data;
    lsSet(file, data); // оптимистичное сохранение в кэш
    return NutriAPI.putData(file, data);
  }

  function getUsers() {
    return loadJSON('users.json').catch(function() { return []; });
  }

  function saveUsers(users) {
    return saveJSON('users.json', users);
  }

  function getReports() {
    return loadJSON('reports.json').catch(function() { return {}; });
  }

  function saveReports(reports) {
    return saveJSON('reports.json', reports);
  }

  function getProducts() {
    return loadJSON('products_override.json').catch(function() { return []; });
  }

  function saveProducts(products) {
    return saveJSON('products_override.json', products);
  }

  function invalidate(file) {
    if (file) {
      delete memCache[file];
    } else {
      memCache = {};
    }
  }

  function hasOfflineCache() {
    return lsHas('users.json');
  }

  function getLastSource(file) {
    return lastSource[file] || 'none';
  }

  return {
    getUsers: getUsers,
    saveUsers: saveUsers,
    getReports: getReports,
    saveReports: saveReports,
    getProducts: getProducts,
    saveProducts: saveProducts,
    invalidate: invalidate,
    hasOfflineCache: hasOfflineCache,
    getLastSource: getLastSource
  };
})();
