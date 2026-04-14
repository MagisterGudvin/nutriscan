/* ============================================
   NutriForce — Analysis Module (Norms Calculation)
   ============================================ */
var NutriAnalysis = (function() {
  'use strict';

  var ACTIVITY_LEVELS = {
    sedentary:  { factor: 1.2,  label: 'Сидячий образ жизни' },
    light:      { factor: 1.375, label: 'Лёгкая активность' },
    moderate:   { factor: 1.55,  label: 'Умеренная активность' },
    active:     { factor: 1.725, label: 'Высокая активность' },
    very_active: { factor: 1.9,  label: 'Очень высокая активность' }
  };

  function getActivityFactor(level) {
    var entry = ACTIVITY_LEVELS[level];
    return entry ? entry.factor : 1.55;
  }

  function getActivityLabel(level) {
    var entry = ACTIVITY_LEVELS[level];
    return entry ? entry.label : 'Умеренная активность';
  }

  function calculateBMR(weight, height, age, sex) {
    if (sex === 'female') {
      return 10 * weight + 6.25 * height - 5 * age - 161;
    }
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }

  function calculateNorms(params) {
    var w = params.currentWeight || params.weight || 70;
    var h = params.height || 175;
    var sex = params.sex || 'male';
    var age = parseInt(params.age) || 20;
    var activity = params.activity || 'moderate';

    var bmr = calculateBMR(w, h, age, sex);
    var factor = getActivityFactor(activity);
    var tdee = Math.round(bmr * factor);

    var calories = tdee;
    var goal = 'maintain';

    var protein = Math.round(1.8 * w);
    var fat = Math.round(0.9 * w);

    var proteinCal = protein * 4;
    var fatCal = fat * 9;
    var carbsCal = Math.max(0, calories - proteinCal - fatCal);
    var carbs = Math.round(carbsCal / 4);

    var norms = {
      calories: calories,
      protein: protein,
      fat: fat,
      carbs: carbs,
      omega3: 1.5,
      omega6: 10,
      bmr: Math.round(bmr),
      tdee: tdee,
      goal: goal
    };

    // Микронутриенты — берём адекватное суточное потребление из реестра.
    // Если реестр ещё не загружен (на всякий случай) — пропускаем.
    if (typeof NutriList !== 'undefined' && NutriList.defaultMicroNorms) {
      var micro = NutriList.defaultMicroNorms();
      for (var k in micro) {
        if (norms[k] == null) norms[k] = micro[k];
      }
    }

    return norms;
  }

  function recalcUserNorms(userId) {
    var user = NutriDB.findUserById(userId);
    if (!user || user.role !== 'student') return null;

    var norms = calculateNorms({
      height: user.height,
      currentWeight: user.currentWeight,
      sex: user.sex,
      age: user.age,
      activity: user.activity
    });

    NutriDB.updateUser(userId, { norms: norms });
    return norms;
  }

  function getDayStatus(totals, norms) {
    if (!totals || !norms) return 'empty';

    var calRatio = totals.calories / norms.calories;
    var proteinRatio = totals.protein / norms.protein;
    var fatRatio = totals.fat / norms.fat;
    var carbsRatio = totals.carbs / norms.carbs;

    var avgRatio = (calRatio + proteinRatio + fatRatio + carbsRatio) / 4;

    if (avgRatio >= 0.85 && avgRatio <= 1.15) return 'good';
    if (avgRatio >= 0.65 && avgRatio <= 1.35) return 'warning';
    return 'bad';
  }

  function getDeficits(totals, norms) {
    if (!totals || !norms) return [];
    var deficits = [];
    if (totals.calories < norms.calories * 0.8) {
      deficits.push('Калории: ' + totals.calories + ' / ' + norms.calories + ' (' + Math.round(totals.calories / norms.calories * 100) + '%)');
    }
    if (totals.protein < norms.protein * 0.8) {
      deficits.push('Белок: ' + totals.protein + 'г / ' + norms.protein + 'г');
    }
    if (totals.fat < norms.fat * 0.8) {
      deficits.push('Жиры: ' + totals.fat + 'г / ' + norms.fat + 'г');
    }
    if (totals.carbs < norms.carbs * 0.8) {
      deficits.push('Углеводы: ' + totals.carbs + 'г / ' + norms.carbs + 'г');
    }
    return deficits;
  }

  function getImbalances(totals, norms) {
    if (!totals || !norms) return [];
    var imbalances = [];
    if (totals.calories > norms.calories * 1.2) {
      imbalances.push('Превышение калорий: ' + totals.calories + ' / ' + norms.calories);
    }
    if (totals.fat > norms.fat * 1.3) {
      imbalances.push('Избыток жиров: ' + totals.fat + 'г / ' + norms.fat + 'г');
    }
    if (totals.carbs > norms.carbs * 1.3) {
      imbalances.push('Избыток углеводов: ' + totals.carbs + 'г / ' + norms.carbs + 'г');
    }
    return imbalances;
  }

  function calculateStreak(reports) {
    if (!reports || !reports.length) return 0;
    var sorted = reports.slice().sort(function(a,b) { return b.date.localeCompare(a.date); });
    var streak = 0;
    var today = new Date();

    for (var i = 0; i < sorted.length; i++) {
      var expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      var expectedStr = expected.toISOString().slice(0, 10);
      if (sorted[i].date === expectedStr) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  function getGoalLabel(goal) {
    return 'Поддержание';
  }

  return {
    calculateNorms: calculateNorms,
    recalcUserNorms: recalcUserNorms,
    getDayStatus: getDayStatus,
    getDeficits: getDeficits,
    getImbalances: getImbalances,
    calculateStreak: calculateStreak,
    getGoalLabel: getGoalLabel,
    getActivityLabel: getActivityLabel,
    ACTIVITY_LEVELS: ACTIVITY_LEVELS
  };
})();
