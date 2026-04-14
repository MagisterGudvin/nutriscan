/* ============================================
   NutriForce — Storage Module (GitHub JSON via Worker)
   ============================================ */
var NutriStorage = (function() {
  'use strict';

  var cache = {};

  function loadJSON(file) {
    if (cache[file]) return Promise.resolve(cache[file]);
    return NutriAPI.getData(file).then(function(data) {
      cache[file] = data;
      return data;
    });
  }

  function saveJSON(file, data) {
    cache[file] = data;
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
      delete cache[file];
    } else {
      cache = {};
    }
  }

  return {
    getUsers: getUsers,
    saveUsers: saveUsers,
    getReports: getReports,
    saveReports: saveReports,
    getProducts: getProducts,
    saveProducts: saveProducts,
    invalidate: invalidate
  };
})();
