#!/usr/bin/env node
/**
 * verify-sample.js - internal consistency checks for sample-export.csv.
 *
 * Recomputes every Summary aggregate from the rows of its own section
 * and asserts the file agrees with itself and with the seeder algorithm:
 * averages, week-over-week weight change, Training Days and Runs counts,
 * km totals, Pace and Hours formulas, workout load ranges, and the
 * absence of orphan week rows. Exits non-zero on any failure.
 *
 * Usage: node tools/verify-sample.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'sample-export.csv');
const text = fs.readFileSync(filePath, 'utf8');

// ==================== CSV parsing ====================

function parseCsvLine(line) {
  const cells = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/** Returns { sectionName: { header: string[], rows: string[][] } }. */
function parseSections(content) {
  const sections = {};
  let current = null;
  content.split('\n').forEach(function (line) {
    const m = line.match(/^=== (.+) ===$/);
    if (m) {
      current = { header: null, rows: [] };
      sections[m[1]] = current;
      return;
    }
    if (!current || line.trim() === '' || line.startsWith('#')) return;
    const cells = parseCsvLine(line);
    if (!current.header) current.header = cells;
    else current.rows.push(cells);
  });
  return sections;
}

// ==================== Formula mirrors ====================

/** Mirror of the Sheets ROUND function (half away from zero). */
function round(x, n) {
  const p = Math.pow(10, n);
  const r = Math.round(Math.abs(x) * p) / p;
  return x < 0 ? -r : r;
}

function mean(values) {
  return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
}

function timeToFraction(hhmm) {
  const p = hhmm.split(':').map(Number);
  return (p[0] * 60 + p[1]) / 1440;
}

// ==================== Assertion harness ====================

let failures = 0;
let checks = 0;

function assert(condition, message) {
  checks++;
  if (!condition) {
    failures++;
    console.error('FAIL: ' + message);
  }
}

function assertEq(actual, expected, message) {
  assert(actual === expected, message + ' (expected ' + expected + ', got ' + actual + ')');
}

function col(section, label) {
  const idx = section.header.indexOf(label);
  if (idx === -1) throw new Error('Header "' + label + '" not found');
  return idx;
}

function num(s) {
  return s === '' ? '' : Number(s);
}

// ==================== Checks ====================

const sections = parseSections(text);
['SUMMARY', 'WEIGHT', 'MEASUREMENTS', 'WORKOUTS', 'RUNS', 'SLEEP', 'NUTRITION', 'NOTES']
  .forEach(function (name) {
    assert(sections[name] && sections[name].rows.length > 0, 'section ' + name + ' present and non-empty');
  });

const summary = sections.SUMMARY;
const summaryWeeks = summary.rows.map(function (r) { return r[col(summary, 'Week')]; });

// --- No orphan week rows anywhere ---
Object.keys(sections).forEach(function (name) {
  if (name === 'SUMMARY') return;
  sections[name].rows.forEach(function (r, i) {
    assert(summaryWeeks.indexOf(r[0]) !== -1,
      name + ' row ' + (i + 1) + ' references week ' + r[0] + ' which is not in Summary');
  });
});

function weekRows(name, week) {
  return sections[name].rows.filter(function (r) { return r[0] === week; });
}

// --- Summary aggregates recomputed from their own sections ---
let prevAvgWeight = '';
summary.rows.forEach(function (row) {
  const week = row[col(summary, 'Week')];

  const weights = weekRows('WEIGHT', week)
    .map(function (r) { return num(r[col(sections.WEIGHT, 'Weight (kg)')]); })
    .filter(function (v) { return v !== ''; });
  const avgWeight = weights.length ? round(mean(weights), 2) : '';
  assertEq(num(row[col(summary, 'Avg Weight (kg)')]), avgWeight, 'W' + week + ' Avg Weight');

  const expectedChange = (week === '1' || avgWeight === '' || prevAvgWeight === '')
    ? '' : round(avgWeight - prevAvgWeight, 2);
  assertEq(num(row[col(summary, 'Weight Change (kg)')]), expectedChange, 'W' + week + ' Weight Change');
  prevAvgWeight = avgWeight;

  const sleep = weekRows('SLEEP', week);
  assertEq(num(row[col(summary, 'Avg Sleep (h)')]),
    round(mean(sleep.map(function (r) { return num(r[col(sections.SLEEP, 'Hours')]); })), 1),
    'W' + week + ' Avg Sleep');
  assertEq(num(row[col(summary, 'Sleep Quality (1-5)')]),
    round(mean(sleep.map(function (r) { return num(r[col(sections.SLEEP, 'Quality (1-5)')]); })), 1),
    'W' + week + ' Sleep Quality');
  assertEq(num(row[col(summary, 'Anxiety (0-5)')]),
    round(mean(sleep.map(function (r) { return num(r[col(sections.SLEEP, 'Anxiety (0-5)')]); })), 1),
    'W' + week + ' Anxiety');

  const trainedDates = {};
  weekRows('WORKOUTS', week).forEach(function (r) {
    if (r[col(sections.WORKOUTS, 'Reps Done')] !== '') {
      trainedDates[r[col(sections.WORKOUTS, 'Date')]] = true;
    }
  });
  assertEq(num(row[col(summary, 'Training Days')]), Object.keys(trainedDates).length,
    'W' + week + ' Training Days');

  const runs = weekRows('RUNS', week);
  const dists = runs.map(function (r) { return num(r[col(sections.RUNS, 'Distance (km)')]); });
  assertEq(num(row[col(summary, 'Runs')]),
    dists.filter(function (v) { return v !== '' && v > 0; }).length,
    'W' + week + ' Runs');
  const km = dists.reduce(function (a, v) { return a + (v === '' ? 0 : v); }, 0);
  assertEq(num(row[col(summary, 'Km Run')]), Math.round(km * 1e9) / 1e9, 'W' + week + ' Km Run');

  assertEq(num(row[col(summary, 'Sweet Cravings (avg)')]),
    round(mean(weekRows('NUTRITION', week).map(function (r) {
      return num(r[col(sections.NUTRITION, 'Sweet Cravings (0-5)')]);
    })), 1),
    'W' + week + ' Sweet Cravings');
});

// --- Pace = ROUND(time / dist, 2) on every executed run ---
sections.RUNS.rows.forEach(function (r, i) {
  const dist = num(r[col(sections.RUNS, 'Distance (km)')]);
  const time = num(r[col(sections.RUNS, 'Time (min)')]);
  const pace = num(r[col(sections.RUNS, 'Pace (min/km)')]);
  if (dist === '' || dist === 0 || time === '') {
    assertEq(pace, '', 'RUNS row ' + (i + 1) + ' pace empty when not executed');
  } else {
    assertEq(pace, round(time / dist, 2), 'RUNS row ' + (i + 1) + ' pace');
  }
});

// --- Hours = ROUND(MOD(wake - bed, 1) * 24, 1) on every sleep row ---
sections.SLEEP.rows.forEach(function (r, i) {
  const bed = r[col(sections.SLEEP, 'Bedtime')];
  const wake = r[col(sections.SLEEP, 'Wake-up')];
  const hours = num(r[col(sections.SLEEP, 'Hours')]);
  if (bed === '' || wake === '') {
    assertEq(hours, '', 'SLEEP row ' + (i + 1) + ' hours empty');
  } else {
    const diff = timeToFraction(wake) - timeToFraction(bed);
    assertEq(hours, round((((diff % 1) + 1) % 1) * 24, 1), 'SLEEP row ' + (i + 1) + ' hours');
  }
});

// --- Every load within the seeder algorithm's range ---
// Load = 10 + ((b * 7 + i * 3) % 40) + w, with w in 0..4, so [10, 53].
sections.WORKOUTS.rows.forEach(function (r, i) {
  const load = r[col(sections.WORKOUTS, 'Load (kg)')];
  if (load === '') return;
  const v = Number(load);
  assert(Number.isInteger(v) && v >= 10 && v <= 53,
    'WORKOUTS row ' + (i + 1) + ' load ' + load + ' outside the seeder range [10, 53]');
});

// ==================== Result ====================

if (failures > 0) {
  console.error(failures + ' of ' + checks + ' checks failed.');
  process.exit(1);
}
console.log('All ' + checks + ' checks passed.');
