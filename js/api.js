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

  function analyze(meals, norms, products, books) {
    return request('POST', '/api/analyze', {
      meals: meals,
      norms: norms,
      products: products,
      books: books
    });
  }

  function getData(file) {
    return request('GET', '/data/' + file);
  }

  function putData(file, data) {
    return request('PUT', '/data/' + file, data);
  }

  function getBook(file) {
    return fetch(getWorkerUrl() +'/books/' + encodeURIComponent(file)).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }

  function putBook(file, content) {
    return fetch(getWorkerUrl() +'/books/' + encodeURIComponent(file), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: content
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function deleteBook(file) {
    return fetch(getWorkerUrl() +'/books/' + encodeURIComponent(file), {
      method: 'DELETE'
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function listBooks() {
    return request('GET', '/books/index');
  }

  return {
    analyze: analyze,
    getData: getData,
    putData: putData,
    getBook: getBook,
    putBook: putBook,
    deleteBook: deleteBook,
    listBooks: listBooks,
    getWorkerUrl: getWorkerUrl
  };
})();
