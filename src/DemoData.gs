/**
 * DemoData.gs - populates the tracker with 5 weeks of synthetic data.
 *
 * Everything is deterministic: a fixed-seed generator and fixed start
 * dates, so two runs produce the same demo. No value here comes from any
 * real log; the numbers are plausible by construction (weight with a mild
 * downward trend and noise, sleep between ~6 and 8 hours, realistic run
 * paces, 1-5 scales, most sessions executed with a couple of misses).
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

/** Fills one generated week block with plausible synthetic values. */
function fillDemoWeek_(ss, block, w, rng) {
  const pick = function (min, max) { return min + rng() * (max - min); };
  const pickInt = function (min, max) { return Math.floor(pick(min, max + 1)); };

  // ---- Weight: mild downward trend + noise, 1-2 days skipped ----
  const shWt = ss.getSheetByName(SHEET_NAMES.WEIGHT);
  const skipA = pickInt(0, 6), skipB = pickInt(0, 6);
  for (let i = 0; i < 7; i++) {
    if (i === skipA || i === skipB) continue;
    const weight = 82.6 - 0.18 * w + pick(-0.35, 0.35);
    shWt.getRange(block.rows.weight + i, 4).setValue(Math.round(weight * 10) / 10);
  }

  // ---- Sleep: bedtime ~23:00-00:30 (midnight-safe), wake ~06:20-07:30 ----
  const shS = ss.getSheetByName(SHEET_NAMES.SLEEP);
  for (let i = 0; i < 7; i++) {
    const bedMinutes = (23 * 60 + pickInt(0, 90)) % 1440; // may cross midnight
    const wakeMinutes = 6 * 60 + 20 + pickInt(0, 70);
    const coffeeMinutes = 15 * 60 + pickInt(0, 120);
    const row = block.rows.sleep + i;
    shS.getRange(row, 4).setValue(bedMinutes / 1440);   // Bedtime (time fraction)
    shS.getRange(row, 5).setValue(wakeMinutes / 1440);  // Wake-up
    shS.getRange(row, 7).setValue(pickInt(3, 5));       // Quality
    shS.getRange(row, 8).setValue(coffeeMinutes / 1440);// Last coffee
    shS.getRange(row, 9).setValue(pickInt(0, 3));       // Anxiety
    shS.getRange(row, 10).setValue(rng() < 0.7 ? 'Y' : 'N');
  }

  // ---- Runs: 3 of 4 always executed; easy run only some weeks ----
  const shR = ss.getSheetByName(SHEET_NAMES.RUNS);
  const runPlans = [
    { fill: rng() < 0.4, dist: pick(4.5, 5.5), pace: pick(6.2, 6.5) },              // easy (optional)
    { fill: true, dist: 6.0, pace: pick(5.4, 5.6) - 0.03 * w },                     // intervals
    { fill: true, dist: 6.5 + 0.3 * w, pace: pick(5.7, 5.9) - 0.03 * w },           // continuous
    { fill: true, dist: 7.0 + 0.5 * w, pace: pick(5.9, 6.2) - 0.03 * w },           // long
  ];
  runPlans.forEach(function (plan, i) {
    if (!plan.fill) return;
    const row = block.rows.runs + i;
    const dist = Math.round(plan.dist * 10) / 10;
    shR.getRange(row, 5).setValue(dist);
    shR.getRange(row, 6).setValue(Math.round(dist * plan.pace * 10) / 10);
    shR.getRange(row, 8).setValue(pickInt(3, 5));
  });

  // ---- Workouts: loads with weekly progression; one session missed in week 2 ----
  const shW = ss.getSheetByName(SHEET_NAMES.WORKOUTS);
  let rowOffset = 0;
  WEEKLY_WORKOUTS.forEach(function (wkBlock, b) {
    const missed = (w === 1 && wkBlock.workout.indexOf('D -') === 0); // week 2: D skipped
    wkBlock.items.forEach(function (item, i) {
      const row = block.rows.workouts + rowOffset;
      rowOffset++;
      if (missed) return;
      const isCircuit = item[2] === '30 min';
      shW.getRange(row, 8).setValue(isCircuit ? '' : 10 + ((b * 7 + i * 3) % 40) + w); // Load
      shW.getRange(row, 9).setValue(isCircuit ? 30 : pickInt(8, 12));                  // Reps
      shW.getRange(row, 10).setValue(isCircuit ? '' : pickInt(1, 2));                  // RIR
    });
  });

  // ---- Nutrition ----
  const shN = ss.getSheetByName(SHEET_NAMES.NUTRITION);
  for (let i = 0; i < 7; i++) {
    const row = block.rows.nutrition + i;
    shN.getRange(row, 4).setValue(pickInt(1980, 2450));
    shN.getRange(row, 5).setValue(pickInt(130, 175));
    shN.getRange(row, 6).setValue(pickInt(0, 4));
    shN.getRange(row, 7).setValue(rng() < 0.25 ? 'Y' : 'N');
  }

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
