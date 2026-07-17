/**
 * DemoData.gs - populates the tracker with 5 weeks of synthetic data.
 *
 * Everything is deterministic: a fixed-seed generator and fixed start
 * dates, so two runs produce the same demo. No value here comes from any
 * real log; the numbers are plausible by construction (weight with a mild
 * downward trend and noise, sleep between ~6 and 8 hours, realistic run
 * paces, 1-5 scales, most sessions executed with a couple of misses).
 *
 * Values are assembled in memory and written in batches (about 8 range
 * writes per week) over sub-ranges that never touch the formula columns
 * created by generateWeek_ (Runs Pace, Sleep Hours), so seeding takes
 * seconds instead of issuing hundreds of single-cell writes.
 */

// Monday of demo week 1. Weeks 2-5 follow consecutively.
const DEMO_START_MONDAY = new Date(2026, 4, 4); // May 4, 2026
const DEMO_WEEKS = 5;
const DEMO_SEED = 42;

function seedDemoData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  if (!ss.getSheetByName(SHEET_NAMES.SUMMARY)) createStructure();

  const summary = ss.getSheetByName(SHEET_NAMES.SUMMARY);
  if (summary.getLastRow() > 1) {
    ui.alert('Seed aborted', 'Seed demo data expects an empty tracker (no weeks in ' +
      SHEET_NAMES.SUMMARY + ' yet). Use a fresh spreadsheet for the demo.', ui.ButtonSet.OK);
    return;
  }

  const rng = makeRng_(DEMO_SEED);
  for (let w = 0; w < DEMO_WEEKS; w++) {
    const start = addDays_(DEMO_START_MONDAY, w * 7);
    const block = generateWeek_(ss, start);
    fillDemoWeek_(ss, block, w, rng);
  }
  writeDemoBanner_(ss);
  ss.toast(DEMO_WEEKS + ' demo weeks seeded (synthetic data).', 'Tracker', 8);
}

/** Deterministic pseudo-random generator (LCG), returns floats in [0,1). */
function makeRng_(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Fills one generated week block with plausible synthetic values.
 *
 * All values are collected in memory and written through a handful of
 * contiguous sub-ranges that skip the formula columns (Runs col 7 Pace,
 * Sleep col 6 Hours). Rows that are intentionally skipped (weigh-in days
 * off, the optional run, the missed session) are written as empty
 * strings so the batch stays rectangular.
 */
function fillDemoWeek_(ss, block, w, rng) {
  const pick = function (min, max) { return min + rng() * (max - min); };
  const pickInt = function (min, max) { return Math.floor(pick(min, max + 1)); };

  // ---- Weight: mild downward trend + noise, 1-2 days skipped ----
  const skipA = pickInt(0, 6), skipB = pickInt(0, 6);
  const weightCol = [];
  for (let i = 0; i < 7; i++) {
    if (i === skipA || i === skipB) {
      weightCol.push(['']);
    } else {
      const weight = 82.6 - 0.18 * w + pick(-0.35, 0.35);
      weightCol.push([Math.round(weight * 10) / 10]);
    }
  }
  ss.getSheetByName(SHEET_NAMES.WEIGHT)
    .getRange(block.rows.weight, 4, 7, 1).setValues(weightCol);

  // ---- Sleep: bedtime ~23:00-00:30 (midnight-safe), wake ~06:20-07:30 ----
  const sleepTimes = [];  // cols 4-5: Bedtime, Wake-up (time fractions)
  const sleepRest = [];   // cols 7-10: Quality, Last coffee, Anxiety, Ritual
  for (let i = 0; i < 7; i++) {
    const bedMinutes = (23 * 60 + pickInt(0, 90)) % 1440; // may cross midnight
    const wakeMinutes = 6 * 60 + 20 + pickInt(0, 70);
    const coffeeMinutes = 15 * 60 + pickInt(0, 120);
    sleepTimes.push([bedMinutes / 1440, wakeMinutes / 1440]);
    sleepRest.push([pickInt(3, 5), coffeeMinutes / 1440, pickInt(0, 3), rng() < 0.7 ? 'Y' : 'N']);
  }
  const shS = ss.getSheetByName(SHEET_NAMES.SLEEP);
  shS.getRange(block.rows.sleep, 4, 7, 2).setValues(sleepTimes);
  shS.getRange(block.rows.sleep, 7, 7, 4).setValues(sleepRest);

  // ---- Runs: 3 of 4 always executed; easy run only some weeks ----
  const runPlans = [
    { fill: rng() < 0.4, dist: pick(4.5, 5.5), pace: pick(6.2, 6.5) },              // easy (optional)
    { fill: true, dist: 6.0, pace: pick(5.4, 5.6) - 0.03 * w },                     // intervals
    { fill: true, dist: 6.5 + 0.3 * w, pace: pick(5.7, 5.9) - 0.03 * w },           // continuous
    { fill: true, dist: 7.0 + 0.5 * w, pace: pick(5.9, 6.2) - 0.03 * w },           // long
  ];
  const runDistTime = [];  // cols 5-6: Distance, Time
  const runFeel = [];      // col 8: Feel
  runPlans.forEach(function (plan) {
    if (!plan.fill) {
      runDistTime.push(['', '']);
      runFeel.push(['']);
      return;
    }
    const dist = Math.round(plan.dist * 10) / 10;
    runDistTime.push([dist, Math.round(dist * plan.pace * 10) / 10]);
    runFeel.push([pickInt(3, 5)]);
  });
  const shR = ss.getSheetByName(SHEET_NAMES.RUNS);
  shR.getRange(block.rows.runs, 5, runPlans.length, 2).setValues(runDistTime);
  shR.getRange(block.rows.runs, 8, runPlans.length, 1).setValues(runFeel);

  // ---- Workouts: loads with weekly progression; one session missed in week 2 ----
  const workoutFill = [];  // cols 8-10: Load, Reps Done, RIR
  WEEKLY_WORKOUTS.forEach(function (wkBlock, b) {
    const missed = (w === 1 && wkBlock.workout.indexOf('D -') === 0); // week 2: D skipped
    wkBlock.items.forEach(function (item, i) {
      if (missed) {
        workoutFill.push(['', '', '']);
        return;
      }
      const isCircuit = item[2] === '30 min';
      workoutFill.push([
        isCircuit ? '' : 10 + ((b * 7 + i * 3) % 40) + w,
        isCircuit ? 30 : pickInt(8, 12),
        isCircuit ? '' : pickInt(1, 2),
      ]);
    });
  });
  ss.getSheetByName(SHEET_NAMES.WORKOUTS)
    .getRange(block.rows.workouts, 8, workoutFill.length, 3).setValues(workoutFill);

  // ---- Nutrition ----
  const nutritionFill = [];  // cols 4-7: Calories, Protein, Cravings, Snacking
  for (let i = 0; i < 7; i++) {
    nutritionFill.push([pickInt(1980, 2450), pickInt(130, 175), pickInt(0, 4), rng() < 0.25 ? 'Y' : 'N']);
  }
  ss.getSheetByName(SHEET_NAMES.NUTRITION)
    .getRange(block.rows.nutrition, 4, 7, 4).setValues(nutritionFill);

  // ---- Measurements: only weeks 1, 3, 5 (realistic cadence) ----
  if (w % 2 === 0) {
    const shM = ss.getSheetByName(SHEET_NAMES.MEASUREMENTS);
    const jitter = function () { return pick(-0.2, 0.2); };
    const values = [
      88.5 - 0.30 * w + jitter(),  // Waist
      90.2 - 0.35 * w + jitter(),  // Abdomen
      99.5 - 0.10 * w + jitter(),  // Hips
      101.0 + 0.10 * w + jitter(), // Chest
      38.5 + jitter(),             // Neck
      34.0 + 0.10 * w + jitter(),  // Arm
      57.0 + 0.05 * w + jitter(),  // Thigh
      37.5 + jitter(),             // Calf
    ].map(function (v) { return Math.round(v * 10) / 10; });
    shM.getRange(block.rows.measurements, 3, 1, 8).setValues([values]);
  }

  // ---- Notes: two per week from a fixed pool ----
  const notePool = [
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
  const shNo = ss.getSheetByName(SHEET_NAMES.NOTES);
  const r0 = shNo.getLastRow() + 1;
  const noteA = notePool[(w * 2) % notePool.length];
  const noteB = notePool[(w * 2 + 1) % notePool.length];
  shNo.getRange(r0, 1, 2, 4).setValues([
    [block.week, addDays_(block.start, 3), noteA[0], noteA[1]],
    [block.week, addDays_(block.start, 6), noteB[0], noteB[1]],
  ]);
  shNo.getRange(r0, 2, 2, 1).setNumberFormat(CONFIG.DATE_FORMAT);
}

/** Adds a visible synthetic-data banner to Instructions and Summary. */
function writeDemoBanner_(ss) {
  const banner = 'DEMO DATA: every value in this spreadsheet is synthetic, generated by "Seed demo data". No real personal data.';

  const shI = ss.getSheetByName(SHEET_NAMES.INSTRUCTIONS);
  shI.insertRowBefore(1);
  shI.getRange(1, 1).setValue(banner)
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#D64545').setWrap(true);

  const summary = ss.getSheetByName(SHEET_NAMES.SUMMARY);
  summary.getRange(1, 1).setNote(banner);
}
