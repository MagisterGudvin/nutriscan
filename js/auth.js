/* ============================================
   NutriCheck — Auth Module
   ============================================ */
var NutriAuth = (function() {
  'use strict';

  var TEACHER_LOGIN = 'teacher';
  var TEACHER_PASS = 'teacher123';

  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function login(login, password) {
    if (login === TEACHER_LOGIN && password === TEACHER_PASS) {
      var teacher = { id: 'teacher', name: 'Преподаватель', login: TEACHER_LOGIN, role: 'teacher' };
      NutriDB.setSession(teacher);
      return { success: true, user: teacher };
    }

    var user = NutriDB.findUser(login);
    if (!user) return { success: false, error: 'Пользователь не найден' };
    if (user.password !== password) return { success: false, error: 'Неверный пароль' };

    NutriDB.setSession(user);
    return { success: true, user: user };
  }

  function register(data) {
    if (!data.name || !data.login || !data.password) {
      return { success: false, error: 'Заполните все поля' };
    }

    if (data.login === TEACHER_LOGIN) {
      return { success: false, error: 'Этот логин занят' };
    }

    var existing = NutriDB.findUser(data.login);
    if (existing) return { success: false, error: 'Логин уже занят' };

    var norms = NutriAnalysis.calculateNorms({
      height: parseFloat(data.height) || 175,
      currentWeight: parseFloat(data.currentWeight) || 70,
      sex: data.sex || 'male',
      age: parseInt(data.age) || 20,
      activity: data.activity || 'moderate'
    });

    var user = {
      id: generateId(),
      name: data.name,
      login: data.login,
      password: data.password,
      role: 'student',
      height: parseFloat(data.height) || 175,
      currentWeight: parseFloat(data.currentWeight) || 70,
      sex: data.sex || 'male',
      age: parseInt(data.age) || 20,
      activity: data.activity || 'moderate',
      norms: norms,
      registeredAt: new Date().toISOString().slice(0, 10)
    };

    NutriDB.addUser(user);
    NutriDB.setSession(user);
    return { success: true, user: user };
  }

  function logout() {
    NutriDB.clearSession();
  }

  function currentUser() {
    var session = NutriDB.getSession();
    if (!session) return null;
    if (session.role === 'teacher') return session;
    return NutriDB.findUserById(session.id) || null;
  }

  function isLoggedIn() {
    return currentUser() !== null;
  }

  function isTeacher() {
    var u = currentUser();
    return u && u.role === 'teacher';
  }

  return {
    login: login,
    register: register,
    logout: logout,
    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    isTeacher: isTeacher,
    generateId: generateId
  };
})();
