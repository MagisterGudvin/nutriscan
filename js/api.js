/* ============================================
   NutriCheck — API Module
   ============================================ */
var NutriAPI = (function() {
  'use strict';

  function getWorkerUrl() {
    return (window.NUTRI_CONFIG && window.NUTRI_CONFIG.WORKER_URL) || '';
  }

  function request(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(getWorkerUrl() +path, opts).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function analyze(meals, norms, products) {
    return request('POST', '/api/analyze', {
      meals: meals,
      norms: norms,
      products: products
    });
  }

  function getData(file) {
    return request('GET', '/data/' + file);
  }

  function putData(file, data) {
    return request('PUT', '/data/' + file, data);
  }

  return {
    analyze: analyze,
    getData: getData,
    putData: putData,
    getWorkerUrl: getWorkerUrl
  };
})();
