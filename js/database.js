/* ============================================
   NutriCheck — Database Module
   --------------------------------------------
   In-memory кэш + удалённое хранилище через
   Cloudflare Worker (GitHub JSON). Никаких
   данных в localStorage не сохраняется.
   Текущая сессия пользователя живёт в
   sessionStorage (per-tab, не localStorage).
   ============================================ */
var NutriDB = (function() {
  'use strict';

  var SESSION_KEY = 'nutri_session';

  // In-memory cache (теряется при перезагрузке, восстанавливается через init())
  var memUsers = [];
  var memReports = {};
  var memProducts = [];
  var initialized = false;

  function init() {
    return Promise.all([
      NutriStorage.getUsers().catch(function() { return []; }),
      NutriStorage.getReports().catch(function() { return {}; }),
      NutriStorage.getProducts().catch(function() { return []; })
    ]).then(function(res) {
      memUsers = Array.isArray(res[0]) ? res[0] : [];
      memReports = (res[1] && typeof res[1] === 'object' && !Array.isArray(res[1])) ? res[1] : {};
      memProducts = Array.isArray(res[2]) ? res[2] : [];
      initialized = true;
    });
  }

  function isInitialized() { return initialized; }

  function getUsers() { return memUsers.slice(); }
  function getReports() { return memReports; }
  function getProducts() { return memProducts.slice(); }

  function saveUsers(users) {
    memUsers = users;
    return NutriStorage.saveUsers(users);
  }

  function saveReports(reports) {
    memReports = reports;
    return NutriStorage.saveReports(reports);
  }

  function saveProducts(products) {
    memProducts = products;
    return NutriStorage.saveProducts(products);
  }

  function findUser(login) {
    return memUsers.find(function(u) { return u.login === login; });
  }

  function findUserById(id) {
    return memUsers.find(function(u) { return u.id === id; });
  }

  function addUser(user) {
    memUsers.push(user);
    return saveUsers(memUsers);
  }

  function updateUser(id, data) {
    var idx = memUsers.findIndex(function(u) { return u.id === id; });
    if (idx === -1) return Promise.reject(new Error('Пользователь не найден'));
    Object.assign(memUsers[idx], data);
    return saveUsers(memUsers).then(function() { return memUsers[idx]; });
  }

  function deleteUser(id) {
    memUsers = memUsers.filter(function(u) { return u.id !== id; });
    delete memReports[id];
    return Promise.all([saveUsers(memUsers), saveReports(memReports)]);
  }

  function getStudentReports(studentId) {
    return memReports[studentId] || [];
  }

  function saveReport(studentId, report) {
    if (!memReports[studentId]) memReports[studentId] = [];
    var idx = memReports[studentId].findIndex(function(r) { return r.date === report.date; });
    if (idx >= 0) {
      memReports[studentId][idx] = report;
    } else {
      memReports[studentId].push(report);
    }
    memReports[studentId].sort(function(a, b) { return b.date.localeCompare(a.date); });
    return saveReports(memReports);
  }

  function deleteReport(studentId, date) {
    if (!memReports[studentId]) return Promise.resolve();
    memReports[studentId] = memReports[studentId].filter(function(r) { return r.date !== date; });
    return saveReports(memReports);
  }

  function getSession() {
    try {
      var d = sessionStorage.getItem(SESSION_KEY);
      return d ? JSON.parse(d) : null;
    } catch(e) { return null; }
  }

  function setSession(user) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch(e) {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
  }

  function getAllStudents() {
    return memUsers.filter(function(u) { return u.role === 'student'; });
  }

  function addProduct(product) {
    memProducts.push(product);
    return saveProducts(memProducts);
  }

  function updateProduct(index, data) {
    if (index < 0 || index >= memProducts.length) return Promise.reject(new Error('Product not found'));
    Object.assign(memProducts[index], data);
    return saveProducts(memProducts);
  }

  function deleteProduct(index) {
    memProducts.splice(index, 1);
    return saveProducts(memProducts);
  }

  return {
    init: init,
    isInitialized: isInitialized,
    getUsers: getUsers,
    getReports: getReports,
    getProducts: getProducts,
    findUser: findUser,
    findUserById: findUserById,
    addUser: addUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    getStudentReports: getStudentReports,
    saveReport: saveReport,
    deleteReport: deleteReport,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    getAllStudents: getAllStudents,
    addProduct: addProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,
    saveUsers: saveUsers,
    saveReports: saveReports,
    saveProducts: saveProducts
  };
})();
