#!/usr/bin/env node
/**
 * generate-sample-export.js - regenerates sample-export.csv.
 *
 * A dependency-free Node mirror of the Apps Script pipeline: it replays
 * generateWeek_ (structure and formulas), fillDemoWeek_ (same LCG seed,
 * same sequence of RNG calls, same constants and dates), the Summary
 * aggregations (AVERAGEIFS, INDEX/MATCH delta, COUNTUNIQUEIFS, COUNTIFS,
 * SUMIFS), and exportReport (section order, display values, CSV
 * escaping). Running the real export from the seeded spreadsheet
 * produces the same numbers; only the "# Generated" timestamp differs
 * (here it is a fixed constant so the output is reproducible).
 *
 * Usage: node tools/generate-sample-export.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ==================== Constants mirrored from src/Config.gs ====================

const SPREADSHEET_NAME = 'AI-Ready Tracker (Demo)';
const GENERATED_STAMP = '2026-06-08 09:30'; // fixed for reproducibility

const SHEET_NAMES = {
  SUMMARY: 'Summary',
  WORKOUTS: 'Workouts',
  RUNS: 'Runs',
  WEIGHT: 'Weight',
  MEASUREMENTS: 'Measurements',
  SLEEP: 'Sleep',
  NUTRITION: 'Nutrition',
  NOTES: 'Notes',
};

const HEADERS = {
  [SHEET_NAMES.SUMMARY]: ['Week', 'Start', 'End', 'Avg Weight (kg)', 'Weight Change (kg)', 'Avg Sleep (h)', 'Sleep Quality (1-5)', 'Anxiety (0-5)', 'Training Days', 'Runs', 'Km Run', 'Sweet Cravings (avg)', 'Week Notes'],
  [SHEET_NAMES.WORKOUTS]: ['Week', 'Date', 'Day', 'Workout', 'Order', 'Exercise', 'Target', 'Load (kg)', 'Reps Done', 'RIR', 'Notes'],
  [SHEET_NAMES.RUNS]: ['Week', 'Date', 'Day', 'Type', 'Distance (km)', 'Time (min)', 'Pace (min/km)', 'Feel (1-5)', 'Notes'],
  [SHEET_NAMES.WEIGHT]: ['Week', 'Date', 'Day', 'Weight (kg)', 'Notes'],
  [SHEET_NAMES.MEASUREMENTS]: ['Week', 'Date', 'Waist', 'Abdomen', 'Hips', 'Chest', 'Neck', 'Arm', 'Thigh', 'Calf', 'Notes'],
  [SHEET_NAMES.SLEEP]: ['Week', 'Date', 'Day', 'Bedtime', 'Wake-up', 'Hours', 'Quality (1-5)', 'Last Coffee', 'Anxiety (0-5)', 'Wind-down Ritual (Y/N)', 'Notes'],
  [SHEET_NAMES.NUTRITION]: ['Week', 'Date', 'Day', 'Calories', 'Protein (g)', 'Sweet Cravings (0-5)', 'Off-plan Snacking (Y/N)', 'Notes'],
  [SHEET_NAMES.NOTES]: ['Week', 'Date', 'Topic', 'Note'],
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEEKLY_WORKOUTS = [
  { offset: 1, workout: 'A - Upper Body 1', items: [
    ['1',  'Dumbbell bench press', '3x10-12'],
    ['2',  'Barbell bent-over row', '3x10-12'],
    ['3',  'Dumbbell shoulder press', '3x10-12'],
    ['4',  'Lat pulldown (wide grip)', '3x10-12'],
    ['5a', 'Superset: Lateral raise', '3x12-15'],
    ['5b', 'Superset: Reverse fly', '3x12-15'],
    ['6a', 'Superset: Rope pushdown', '3x10-12'],
    ['6b', 'Superset: Barbell curl', '3x10-12'],
  ]},
  { offset: 1, workout: 'Functional', items: [
    ['-', 'Functional circuit (30 min)', '30 min'],
  ]},
  { offset: 2, workout: 'C - Lower Body (light)', items: [
    ['1',  'Leg press 45', '3x12-15'],
    ['2',  'Leg extension', '3x12-15'],
    ['3',  'Lying leg curl', '3x12-15'],
    ['4a', 'Superset: Hip abduction machine', '3x15-20'],
    ['4b', 'Superset: Standing calf raise', '3x15-20'],
  ]},
  { offset: 3, workout: 'B - Upper Body 2', items: [
    ['1',  'Incline dumbbell press (30 deg)', '3x10-12'],
    ['2',  'One-arm dumbbell row (each side)', '3x10-12'],
    ['3',  'Machine shoulder press', '3x10-12'],
    ['4',  'Close-grip lat pulldown', '3x10-12'],
    ['5a', 'Superset: Face pull', '3x12-15'],
    ['5b', 'Superset: Front raise', '3x12-15'],
    ['6a', 'Superset: Lying triceps extension', '3x10-12'],
    ['6b', 'Superset: Hammer curl', '3x10-12'],
  ]},
  { offset: 3, workout: 'Functional', items: [
    ['-', 'Functional circuit (30 min)', '30 min'],
  ]},
  { offset: 4, workout: 'D - Back/Posterior Chain', items: [
    ['1',  'Barbell stiff-leg deadlift', '3x10-12'],
    ['2',  'T-bar row', '3x10-12'],
    ['3',  'Machine chest fly', '3x12-15'],
    ['4',  'V-bar pulldown', '3x10-12'],
    ['5a', 'Superset: Barbell curl', '3x12-15'],
    ['5b', 'Superset: Rope pushdown', '3x12-15'],
    ['6',  'Plank', '3x max'],
    ['7',  'Lower abs crunch', '3x12-15'],
  ]},
  { offset: 5, workout: 'E - Lower Body (heavy)', items: [
    ['1', 'Barbell or smith squat', '4x8-10'],
    ['2', 'Sumo deadlift', '3x8-10'],
    ['3', 'Bulgarian split squat (each side)', '3x10-12'],
    ['4', 'Seated leg curl', '3x10-12'],
    ['5', 'Hip thrust', '3x10-12'],
    ['6', 'Calf press (horizontal leg press)', '4x15-20'],
  ]},
];

const WEEKLY_RUNS = [
  { offset: 0, type: 'Easy/recovery (optional)' },
  { offset: 2, type: "Intervals (treadmill) - 8x(2' moderate / 1' hard)" },
  { offset: 4, type: 'Continuous - ~10% progression' },
  { offset: 6, type: 'Long run - 5K build-up' },
];

// ==================== Constants mirrored from src/DemoData.gs ====================

const DEMO_START = { y: 2026, m: 5, d: 4 }; // Monday, May 4, 2026
const DEMO_WEEKS = 5;
const DEMO_SEED = 42;

const NOTE_POOL = [
  ['Training', 'Felt strong on the heavy lower session, squat moving well.'],
  ['Sleep', 'Poor sleep midweek, heavy workload; caffeine cut helped by Friday.'],
  ['Running', 'Interval session felt easier than last week at the same pace.'],
  ['Nutrition', 'Weekend cravings higher than usual, kept snacking mostly on plan.'],
  ['Recovery', 'Added a mobility block after the functional circuit.'],
  ['Training', 'Shoulder slightly tight on pressing, reduced load one notch.'],
  ['Running', 'Long run progressed without knee discomfort.'],
  ['Sleep', 'Wind-down ritual on most nights, noticeably faster to fall asleep.'],
  ['Nutrition', 'Protein target hit on all days this week.'],
  ['Recovery', 'Rest day fully off screens, felt recovered on Monday.'],
];

// ==================== Helpers ====================

/** Deterministic pseudo-random generator (LCG), mirror of makeRng_. */
function makeRng(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Calendar dates as UTC-noon Date objects (timezone independent). */
function makeDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}

function dayName(date) {
  return DAY_NAMES[date.getUTCDay()];
}

/** Mirror of the Sheets ROUND function (half away from zero). */
function round(x, n) {
  const p = Math.pow(10, n);
  const r = Math.round(Math.abs(x) * p) / p;
  return x < 0 ? -r : r;
}

function mean(values) {
  return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

// ==================== Display-value formatting (getDisplayValues mirror) ====================

/** dd/MM/yyyy, the CONFIG.DATE_FORMAT applied to every date column. */
function displayDate(date) {
  return pad2(date.getUTCDate()) + '/' + pad2(date.getUTCMonth() + 1) + '/' + date.getUTCFullYear();
}

/** HH:mm, the CONFIG.TIME_FORMAT applied to time-fraction columns. */
function displayTime(frac) {
  if (frac === '') return '';
  const minutes = Math.round(frac * 1440) % 1440;
  return pad2(Math.floor(minutes / 60)) + ':' + pad2(minutes % 60);
}

/** The 0.0 number format (weight and measurement columns). */
function displayFixed1(v) {
  if (v === '') return '';
  return (Math.round(v * 10) / 10).toFixed(1);
}

/** Automatic number format: trailing zeros trimmed, float noise removed. */
function displayAuto(v) {
  if (v === '') return '';
  if (typeof v !== 'number') return String(v);
  return String(Math.round(v * 1e9) / 1e9);
}

// Per-sheet display formatters, by 0-based column index. Anything not
// listed goes through displayAuto.
const COLUMN_FORMATS = {
  [SHEET_NAMES.SUMMARY]: { 1: displayDate, 2: displayDate },
  [SHEET_NAMES.WORKOUTS]: { 1: displayDate },
  [SHEET_NAMES.RUNS]: { 1: displayDate },
  [SHEET_NAMES.WEIGHT]: { 1: displayDate, 3: displayFixed1 },
  [SHEET_NAMES.MEASUREMENTS]: {
    1: displayDate,
    2: displayFixed1, 3: displayFixed1, 4: displayFixed1, 5: displayFixed1,
    6: displayFixed1, 7: displayFixed1, 8: displayFixed1, 9: displayFixed1,
  },
  [SHEET_NAMES.SLEEP]: { 1: displayDate, 3: displayTime, 4: displayTime, 7: displayTime },
  [SHEET_NAMES.NUTRITION]: { 1: displayDate },
  [SHEET_NAMES.NOTES]: { 1: displayDate },
};

/** Mirror of csv_ in src/Utils.gs, including the injection guard. */
function csvEscape(v) {
  let s = String(v == null ? '' : v);
  if (!isFinite(Number(s)) && /^[=+@-]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ==================== Seeder replay ====================

/**
 * Replays generateWeek_ + fillDemoWeek_ for all demo weeks and computes
 * every formula result (Pace, Hours, Summary aggregations) the way the
 * spreadsheet formulas would. Returns { sheetName: rows[][] } with raw
 * values (dates as Date, numbers as numbers, '' for empty cells).
 */
function buildDemoData() {
  const sheets = {};
  Object.keys(SHEET_NAMES).forEach(function (k) { sheets[SHEET_NAMES[k]] = []; });

  const rng = makeRng(DEMO_SEED);
  const pick = function (min, max) { return min + rng() * (max - min); };
  const pickInt = function (min, max) { return Math.floor(pick(min, max + 1)); };

  let prevAvgWeight = '';

  for (let w = 0; w < DEMO_WEEKS; w++) {
    const week = w + 1;
    const start = addDays(makeDate(DEMO_START.y, DEMO_START.m, DEMO_START.d), w * 7);
    const end = addDays(start, 6);

    // ---- Weight: skips first, then one noise pick per logged day ----
    const skipA = pickInt(0, 6), skipB = pickInt(0, 6);
    const weights = [];
    for (let i = 0; i < 7; i++) {
      if (i === skipA || i === skipB) {
        weights.push('');
      } else {
        weights.push(Math.round((82.6 - 0.18 * w + pick(-0.35, 0.35)) * 10) / 10);
      }
    }
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      sheets[SHEET_NAMES.WEIGHT].push([week, d, dayName(d), weights[i], '']);
    }

    // ---- Sleep: same per-day RNG order as fillDemoWeek_ ----
    for (let i = 0; i < 7; i++) {
      const bedMinutes = (23 * 60 + pickInt(0, 90)) % 1440;
      const wakeMinutes = 6 * 60 + 20 + pickInt(0, 70);
      const coffeeMinutes = 15 * 60 + pickInt(0, 120);
      const quality = pickInt(3, 5);
      const anxiety = pickInt(0, 3);
      const ritual = rng() < 0.7 ? 'Y' : 'N';
      const bed = bedMinutes / 1440, wake = wakeMinutes / 1440;
      // Hours formula: ROUND(MOD(wake - bed, 1) * 24, 1)
      const hours = round((((wake - bed) % 1) + 1) % 1 * 24, 1);
      const d = addDays(start, i);
      sheets[SHEET_NAMES.SLEEP].push([week, d, dayName(d), bed, wake, hours, quality, coffeeMinutes / 1440, anxiety, ritual, '']);
    }

    // ---- Runs ----
    const runPlans = [
      { fill: rng() < 0.4, dist: pick(4.5, 5.5), pace: pick(6.2, 6.5) },
      { fill: true, dist: 6.0, pace: pick(5.4, 5.6) - 0.03 * w },
      { fill: true, dist: 6.5 + 0.3 * w, pace: pick(5.7, 5.9) - 0.03 * w },
      { fill: true, dist: 7.0 + 0.5 * w, pace: pick(5.9, 6.2) - 0.03 * w },
    ];
    runPlans.forEach(function (plan, i) {
      const d = addDays(start, WEEKLY_RUNS[i].offset);
      let dist = '', time = '', pace = '', feel = '';
      if (plan.fill) {
        dist = Math.round(plan.dist * 10) / 10;
        time = Math.round(dist * plan.pace * 10) / 10;
        feel = pickInt(3, 5);
        // Pace formula: IF(OR(dist="",dist=0,time=""),"",ROUND(time/dist,2))
        pace = (dist === 0) ? '' : round(time / dist, 2);
      }
      sheets[SHEET_NAMES.RUNS].push([week, d, dayName(d), WEEKLY_RUNS[i].type, dist, time, pace, feel, '']);
    });

    // ---- Workouts ----
    WEEKLY_WORKOUTS.forEach(function (wkBlock, b) {
      const missed = (w === 1 && wkBlock.workout.indexOf('D -') === 0);
      const d = addDays(start, wkBlock.offset);
      wkBlock.items.forEach(function (item, i) {
        let load = '', reps = '', rir = '';
        if (!missed) {
          const isCircuit = item[2] === '30 min';
          load = isCircuit ? '' : 10 + ((b * 7 + i * 3) % 40) + w;
          reps = isCircuit ? 30 : pickInt(8, 12);
          rir = isCircuit ? '' : pickInt(1, 2);
        }
        sheets[SHEET_NAMES.WORKOUTS].push([week, d, dayName(d), wkBlock.workout, item[0], item[1], item[2], load, reps, rir, '']);
      });
    });

    // ---- Nutrition ----
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      sheets[SHEET_NAMES.NUTRITION].push([week, d, dayName(d), pickInt(1980, 2450), pickInt(130, 175), pickInt(0, 4), rng() < 0.25 ? 'Y' : 'N', '']);
    }

    // ---- Measurements: only weeks 1, 3, 5 ----
    let mValues = ['', '', '', '', '', '', '', ''];
    if (w % 2 === 0) {
      const jitter = function () { return pick(-0.2, 0.2); };
      mValues = [
        88.5 - 0.30 * w + jitter(),
        90.2 - 0.35 * w + jitter(),
        99.5 - 0.10 * w + jitter(),
        101.0 + 0.10 * w + jitter(),
        38.5 + jitter(),
        34.0 + 0.10 * w + jitter(),
        57.0 + 0.05 * w + jitter(),
        37.5 + jitter(),
      ].map(function (v) { return Math.round(v * 10) / 10; });
    }
    sheets[SHEET_NAMES.MEASUREMENTS].push([week, start].concat(mValues).concat(['']));

    // ---- Notes ----
    const noteA = NOTE_POOL[(w * 2) % NOTE_POOL.length];
    const noteB = NOTE_POOL[(w * 2 + 1) % NOTE_POOL.length];
    sheets[SHEET_NAMES.NOTES].push([week, addDays(start, 3), noteA[0], noteA[1]]);
    sheets[SHEET_NAMES.NOTES].push([week, addDays(start, 6), noteB[0], noteB[1]]);

    // ---- Summary aggregations (the formulas generateWeek_ installs) ----
    const logged = weights.filter(function (v) { return v !== ''; });
    const avgWeight = logged.length ? round(mean(logged), 2) : '';
    const change = (week === 1 || avgWeight === '' || prevAvgWeight === '')
      ? '' : round(avgWeight - prevAvgWeight, 2);
    prevAvgWeight = avgWeight;

    const weekSleep = sheets[SHEET_NAMES.SLEEP].filter(function (r) { return r[0] === week; });
    const avgSleep = round(mean(weekSleep.map(function (r) { return r[5]; })), 1);
    const avgQuality = round(mean(weekSleep.map(function (r) { return r[6]; })), 1);
    const avgAnxiety = round(mean(weekSleep.map(function (r) { return r[8]; })), 1);

    // COUNTUNIQUEIFS(Workouts!B:B, week, Reps Done <> "")
    const trainedDates = {};
    sheets[SHEET_NAMES.WORKOUTS].forEach(function (r) {
      if (r[0] === week && r[8] !== '') trainedDates[displayDate(r[1])] = true;
    });
    const trainingDays = Object.keys(trainedDates).length;

    const weekRuns = sheets[SHEET_NAMES.RUNS].filter(function (r) { return r[0] === week; });
    const runsDone = weekRuns.filter(function (r) { return r[4] !== '' && r[4] > 0; }).length;
    const kmRun = weekRuns.reduce(function (a, r) { return a + (r[4] === '' ? 0 : r[4]); }, 0);

    const weekNutrition = sheets[SHEET_NAMES.NUTRITION].filter(function (r) { return r[0] === week; });
    const avgCravings = round(mean(weekNutrition.map(function (r) { return r[5]; })), 1);

    sheets[SHEET_NAMES.SUMMARY].push([
      week, start, end, avgWeight, change, avgSleep, avgQuality, avgAnxiety,
      trainingDays, runsDone, kmRun, avgCravings, '',
    ]);
  }

  return sheets;
}

// ==================== Export assembly (exportReport mirror) ====================

function buildCsv(sheets) {
  const order = [
    SHEET_NAMES.SUMMARY, SHEET_NAMES.WEIGHT, SHEET_NAMES.MEASUREMENTS,
    SHEET_NAMES.WORKOUTS, SHEET_NAMES.RUNS, SHEET_NAMES.SLEEP,
    SHEET_NAMES.NUTRITION, SHEET_NAMES.NOTES,
  ];

  const parts = [];
  parts.push('# WEEKLY TRACKING REPORT');
  parts.push('# Spreadsheet: ' + SPREADSHEET_NAME);
  parts.push('# Generated: ' + GENERATED_STAMP);
  parts.push('# Weeks included: 1 to ' + DEMO_WEEKS);
  parts.push('');

  order.forEach(function (name) {
    const formats = COLUMN_FORMATS[name] || {};
    parts.push('=== ' + name.toUpperCase() + ' ===');
    parts.push(HEADERS[name].map(csvEscape).join(','));
    sheets[name].forEach(function (row) {
      const display = row.map(function (v, c) {
        return formats[c] ? formats[c](v) : displayAuto(v);
      });
      if (display.join('').trim() === '') return;
      parts.push(display.map(csvEscape).join(','));
    });
    parts.push('');
  });

  return parts.join('\n');
}

// ==================== Main ====================

const outPath = path.join(__dirname, '..', 'sample-export.csv');
fs.writeFileSync(outPath, buildCsv(buildDemoData()));
console.log('Wrote ' + outPath);
