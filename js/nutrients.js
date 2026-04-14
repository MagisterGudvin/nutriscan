/* ============================================
   NutriCheck — Nutrient Registry
   Единый реестр нутриентов. Используется везде (нормы, UI, docx).
   Значения norm — адекватное суточное потребление для взрослого
   по МР 2.3.1.2432-08 (РФ) и ТР ТС 022/2011. Для витаминоподобных
   веществ, где официальной нормы нет, — величины, рекомендуемые
   для маркировки БАД/обогащённых продуктов.
   ============================================ */
var NutriList = (function() {
  'use strict';

  // group: macro | vitamin | mineral | other
  var LIST = [
    // --- МАКРО ---
    { key: 'calories',    label: 'Калории',    unit: 'ккал', group: 'macro',   norm: null, decimals: 0 },
    { key: 'protein',     label: 'Белок',      unit: 'г',    group: 'macro',   norm: null, decimals: 1 },
    { key: 'fat',         label: 'Жиры',       unit: 'г',    group: 'macro',   norm: null, decimals: 1 },
    { key: 'carbs',       label: 'Углеводы',   unit: 'г',    group: 'macro',   norm: null, decimals: 1 },
    { key: 'omega3',      label: 'Омега-3',    unit: 'г',    group: 'macro',   norm: 1.5,  decimals: 2 },
    { key: 'omega6',      label: 'Омега-6',    unit: 'г',    group: 'macro',   norm: 10,   decimals: 2 },

    // --- ВИТАМИНЫ ---
    { key: 'vit_c',        label: 'Витамин C',             unit: 'мг',  group: 'vitamin', norm: 90,  decimals: 1 },
    { key: 'vit_b1',       label: 'Витамин B1 (тиамин)',   unit: 'мг',  group: 'vitamin', norm: 1.5, decimals: 2 },
    { key: 'vit_b2',       label: 'Витамин B2 (рибофлавин)', unit: 'мг', group: 'vitamin', norm: 1.8, decimals: 2 },
    { key: 'vit_b6',       label: 'Витамин B6',            unit: 'мг',  group: 'vitamin', norm: 2.0, decimals: 2 },
    { key: 'niacin',       label: 'Ниацин (B3, PP)',       unit: 'мг',  group: 'vitamin', norm: 20,  decimals: 1 },
    { key: 'vit_b12',      label: 'Витамин B12',           unit: 'мкг', group: 'vitamin', norm: 3,   decimals: 2 },
    { key: 'folate',       label: 'Фолаты (B9)',           unit: 'мкг', group: 'vitamin', norm: 400, decimals: 0 },
    { key: 'pantothenic',  label: 'Пантотеновая кислота',  unit: 'мг',  group: 'vitamin', norm: 5,   decimals: 2 },
    { key: 'biotin',       label: 'Биотин (H)',            unit: 'мкг', group: 'vitamin', norm: 50,  decimals: 1 },
    { key: 'vit_a',        label: 'Витамин A (РЭ)',        unit: 'мкг', group: 'vitamin', norm: 900, decimals: 0 },
    { key: 'beta_carotene',label: 'Бета-каротин',          unit: 'мг',  group: 'vitamin', norm: 5,   decimals: 2 },
    { key: 'vit_e',        label: 'Витамин E (α-токоферол)', unit: 'мг', group: 'vitamin', norm: 15,  decimals: 1 },
    { key: 'vit_d',        label: 'Витамин D',             unit: 'мкг', group: 'vitamin', norm: 15,  decimals: 1 },
    { key: 'vit_k',        label: 'Витамин K',             unit: 'мкг', group: 'vitamin', norm: 120, decimals: 0 },

    // --- МИНЕРАЛЫ ---
    { key: 'calcium',     label: 'Кальций',    unit: 'мг',  group: 'mineral', norm: 1000, decimals: 0 },
    { key: 'phosphorus',  label: 'Фосфор',     unit: 'мг',  group: 'mineral', norm: 800,  decimals: 0 },
    { key: 'magnesium',   label: 'Магний',     unit: 'мг',  group: 'mineral', norm: 400,  decimals: 0 },
    { key: 'potassium',   label: 'Калий',      unit: 'мг',  group: 'mineral', norm: 2500, decimals: 0 },
    { key: 'sodium',      label: 'Натрий',     unit: 'мг',  group: 'mineral', norm: 1300, decimals: 0 },
    { key: 'chloride',    label: 'Хлориды',    unit: 'мг',  group: 'mineral', norm: 2300, decimals: 0 },
    { key: 'iron',        label: 'Железо',     unit: 'мг',  group: 'mineral', norm: 15,   decimals: 1 },
    { key: 'zinc',        label: 'Цинк',       unit: 'мг',  group: 'mineral', norm: 12,   decimals: 1 },
    { key: 'iodine',      label: 'Йод',        unit: 'мкг', group: 'mineral', norm: 150,  decimals: 0 },
    { key: 'copper',      label: 'Медь',       unit: 'мг',  group: 'mineral', norm: 1.0,  decimals: 2 },
    { key: 'manganese',   label: 'Марганец',   unit: 'мг',  group: 'mineral', norm: 2,    decimals: 2 },
    { key: 'molybdenum',  label: 'Молибден',   unit: 'мкг', group: 'mineral', norm: 70,   decimals: 1 },
    { key: 'selenium',    label: 'Селен',      unit: 'мкг', group: 'mineral', norm: 55,   decimals: 1 },
    { key: 'chromium',    label: 'Хром',       unit: 'мкг', group: 'mineral', norm: 50,   decimals: 1 },
    { key: 'cobalt',      label: 'Кобальт',    unit: 'мкг', group: 'mineral', norm: 10,   decimals: 2 },
    { key: 'fluoride',    label: 'Фтор',       unit: 'мг',  group: 'mineral', norm: 4,    decimals: 2 },
    { key: 'silicon',     label: 'Кремний',    unit: 'мг',  group: 'mineral', norm: 30,   decimals: 1 },
    { key: 'vanadium',    label: 'Ванадий',    unit: 'мкг', group: 'mineral', norm: 10,   decimals: 1 },

    // --- ВИТАМИНОПОДОБНЫЕ / УСЛОВНО НЕЗАМЕНИМЫЕ ---
    { key: 'inositol',     label: 'Мио-инозит',                  unit: 'мг', group: 'other', norm: 500, decimals: 0 },
    { key: 'l_carnitine',  label: 'L-карнитин',                  unit: 'мг', group: 'other', norm: 300, decimals: 0 },
    { key: 'coq10',        label: 'Коэнзим Q10 (убихинон)',      unit: 'мг', group: 'other', norm: 30,  decimals: 1 },
    { key: 'lipoic_acid',  label: 'Липоевая кислота',            unit: 'мг', group: 'other', norm: 30,  decimals: 1 },
    { key: 'smm',          label: 'Метилметионинсульфоний (U)',  unit: 'мг', group: 'other', norm: 200, decimals: 0 },
    { key: 'orotic_acid',  label: 'Оротовая кислота',            unit: 'мг', group: 'other', norm: 300, decimals: 0 },
    { key: 'paba',         label: 'Парааминобензойная кислота',  unit: 'мг', group: 'other', norm: 100, decimals: 0 },
    { key: 'choline',      label: 'Холин',                       unit: 'мг', group: 'other', norm: 500, decimals: 0 }
  ];

  var BY_KEY = {};
  LIST.forEach(function(n) { BY_KEY[n.key] = n; });

  var MICRO_KEYS = LIST.filter(function(n) { return n.group !== 'macro'; }).map(function(n) { return n.key; });
  var ALL_KEYS = LIST.map(function(n) { return n.key; });

  function defaultMicroNorms() {
    var out = {};
    LIST.forEach(function(n) {
      if (n.group !== 'macro' && n.norm != null) out[n.key] = n.norm;
    });
    return out;
  }

  function get(key) { return BY_KEY[key] || null; }

  function byGroup(group) {
    return LIST.filter(function(n) { return n.group === group; });
  }

  function format(key, val) {
    var meta = BY_KEY[key];
    if (!meta || val == null || isNaN(val)) return String(val == null ? '' : val);
    var d = meta.decimals || 0;
    var f = Math.pow(10, d);
    return (Math.round(val * f) / f).toString();
  }

  return {
    LIST: LIST,
    BY_KEY: BY_KEY,
    MICRO_KEYS: MICRO_KEYS,
    ALL_KEYS: ALL_KEYS,
    defaultMicroNorms: defaultMicroNorms,
    get: get,
    byGroup: byGroup,
    format: format
  };
})();
