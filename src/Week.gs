/**
 * Week.gs - generates the full block of a new week in one click.
 *
 * newWeek() is the menu entry (asks for the start date); the actual work
 * lives in generateWeek_() so seedDemoData() can reuse it and know exactly
 * which rows were created.
 */

/**
 * Menu action: prompts for the week's start date (Monday) and generates
 * the block. Defaults to the Monday of the current week, computed in the
 * spreadsheet's timezone. A typed date that is not a Monday is adjusted
 * to the Monday of that week.
 */
function newWeek() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  if (!ss.getSheetByName(SHEET_NAMES.SUMMARY)) createStructure();

  const tz = ss.getSpreadsheetTimeZone();
  // "Today" as a calendar date in the spreadsheet's timezone, not the
  // script runtime's (the two can disagree around midnight).
  const t = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd').split('-').map(Number);
  const today = new Date(t[0], t[1] - 1, t[2], 12, 0, 0);
  const monday = addDays_(today, -((today.getDay() + 6) % 7));
  const suggestion = Utilities.formatDate(monday, tz, CONFIG.DATE_FORMAT);

  const nextWeek = nextWeekNumber_(ss);
  const resp = ui.prompt(
    'New week - #' + nextWeek,
    'Start date (Monday), format ' + CONFIG.DATE_FORMAT + '.\nLeave empty to use ' + suggestion + '.',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  let start;
  const txt = resp.getResponseText().trim();
  if (!txt) {
    start = monday;
  } else {
    start = parseDateInput_(txt);
    if (!start) {
      ui.alert('Invalid date. Use the ' + CONFIG.DATE_FORMAT + ' format with a day that exists in that month.');
      return;
    }
  }

  let adjusted = false;
  if (start.getDay() !== 1) {
    start = addDays_(start, -((start.getDay() + 6) % 7));
    adjusted = true;
  }

  const block = generateWeek_(ss, start);
  ss.setActiveSheet(ss.getSheetByName(SHEET_NAMES.WORKOUTS));
  ss.toast(
    'Week ' + block.week + ' created: ' +
    Utilities.formatDate(block.start, tz, 'dd/MM') + ' to ' +
    Utilities.formatDate(block.end, tz, 'dd/MM') +
    (adjusted
      ? '. Start adjusted to Monday ' + Utilities.formatDate(block.start, tz, CONFIG.DATE_FORMAT) + '.'
      : ''),
    'Tracker', 8
  );
}

/**
 * Parses a date typed in CONFIG.DATE_FORMAT. The day/month/year order and
 * the separator are derived from the format constant itself, so changing
 * CONFIG.DATE_FORMAT changes the accepted input too.
 *
 * Returns a Date anchored at noon, or null when the text does not match
 * the format or names a day that does not exist in that month (a rollover
 * like 31/02 would otherwise silently become March 3).
 *
 * @param {string} txt
 * @return {Date|null}
 */
function parseDateInput_(txt) {
  const format = CONFIG.DATE_FORMAT;
  const sepMatch = format.match(/[^dMy]/);
  if (!sepMatch) return null;
  const sep = sepMatch[0];
  const order = ['dd', 'MM', 'yyyy']
    .map(function (token) { return { token: token, pos: format.indexOf(token) }; })
    .sort(function (a, b) { return a.pos - b.pos; });

  const parts = txt.split(sep);
  if (parts.length !== 3) return null;

  const c = {};
  order.forEach(function (o, i) { c[o.token] = Number(parts[i]); });
  if (!c.dd || !c.MM || !c.yyyy) return null;

  const d = new Date(c.yyyy, c.MM - 1, c.dd, 12, 0, 0);
  if (d.getFullYear() !== c.yyyy || d.getMonth() !== c.MM - 1 || d.getDate() !== c.dd) {
    return null; // rollover: the typed day does not exist in that month
  }
  return d;
}

/**
 * Returns the next auto-incremental week number by scanning the Week
 * column of every data tab (all of SHEET_NAMES except Instructions), so
 * the number is derived from the data itself and stays consistent after
 * deletions or partial imports in any tab.
 */
function nextWeekNumber_(ss) {
  let last = 0;
  Object.keys(SHEET_NAMES).forEach(function (key) {
    if (key === 'INSTRUCTIONS') return;
    const sh = ss.getSheetByName(SHEET_NAMES[key]);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { const v = Number(r[0]); if (v > last) last = v; });
  });
  return last + 1;
}

/**
 * Creates every row of one week across all tabs and returns where they
 * landed, so callers (the demo seeder) can fill values in.
 *
 * @param {Spreadsheet} ss
 * @param {Date} start Monday that opens the week
 * @return {{week: number, start: Date, end: Date,
 *           rows: Object<string, number>, counts: Object<string, number>}}
 */
function generateWeek_(ss, start) {
  const week = nextWeekNumber_(ss);
  start = new Date(start);
  // Anchor at noon: a noon instant renders as the same calendar date in
  // any spreadsheet timezone offset, regardless of the script timezone.
  start.setHours(12, 0, 0, 0);
  const end = addDays_(start, 6);

  // ---- Workouts ----
  const workoutRows = [];
  WEEKLY_WORKOUTS.forEach(function (block) {
    const d = addDays_(start, block.offset);
    block.items.forEach(function (item) {
      workoutRows.push([week, d, DAY_NAMES[d.getDay()], block.workout, item[0], item[1], item[2], '', '', '', '']);
    });
  });
  const shW = ss.getSheetByName(SHEET_NAMES.WORKOUTS);
  const r0W = shW.getLastRow() + 1;
  shW.getRange(r0W, 1, workoutRows.length, 11).setValues(workoutRows);
  shW.getRange(r0W, 2, workoutRows.length, 1).setNumberFormat(CONFIG.DATE_FORMAT);

  // ---- Runs ----
  const runRows = WEEKLY_RUNS.map(function (run) {
    const d = addDays_(start, run.offset);
    return [week, d, DAY_NAMES[d.getDay()], run.type, '', '', '', '', ''];
  });
  const shR = ss.getSheetByName(SHEET_NAMES.RUNS);
  const r0R = shR.getLastRow() + 1;
  shR.getRange(r0R, 1, runRows.length, 9).setValues(runRows);
  shR.getRange(r0R, 2, runRows.length, 1).setNumberFormat(CONFIG.DATE_FORMAT);
  shR.getRange(r0R, 7, runRows.length, 1)
    .setFormulaR1C1('=IF(OR(RC[-2]="",RC[-2]=0,RC[-1]=""),"",ROUND(RC[-1]/RC[-2],2))'); // Pace = time / distance

  // ---- Weight, Sleep, Nutrition (7 days each) ----
  const weightRows = [], sleepRows = [], nutritionRows = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays_(start, i);
    const day = DAY_NAMES[d.getDay()];
    weightRows.push([week, d, day, '', '']);
    sleepRows.push([week, d, day, '', '', '', '', '', '', '', '']);
    nutritionRows.push([week, d, day, '', '', '', '', '']);
  }

  const shWt = ss.getSheetByName(SHEET_NAMES.WEIGHT);
  const r0Wt = shWt.getLastRow() + 1;
  shWt.getRange(r0Wt, 1, 7, 5).setValues(weightRows);
  shWt.getRange(r0Wt, 2, 7, 1).setNumberFormat(CONFIG.DATE_FORMAT);
  shWt.getRange(r0Wt, 4, 7, 1).setNumberFormat('0.0');

  const shS = ss.getSheetByName(SHEET_NAMES.SLEEP);
  const r0S = shS.getLastRow() + 1;
  shS.getRange(r0S, 1, 7, 11).setValues(sleepRows);
  shS.getRange(r0S, 2, 7, 1).setNumberFormat(CONFIG.DATE_FORMAT);
  shS.getRange(r0S, 4, 7, 2).setNumberFormat(CONFIG.TIME_FORMAT);  // Bedtime / Wake-up
  shS.getRange(r0S, 8, 7, 1).setNumberFormat(CONFIG.TIME_FORMAT);  // Last coffee
  // Hours slept: MOD handles crossing midnight (bedtime 23:30, wake 06:30).
  shS.getRange(r0S, 6, 7, 1)
    .setFormulaR1C1('=IF(OR(RC[-2]="",RC[-1]=""),"",ROUND(MOD(RC[-1]-RC[-2],1)*24,1))');

  const shN = ss.getSheetByName(SHEET_NAMES.NUTRITION);
  const r0N = shN.getLastRow() + 1;
  shN.getRange(r0N, 1, 7, 8).setValues(nutritionRows);
  shN.getRange(r0N, 2, 7, 1).setNumberFormat(CONFIG.DATE_FORMAT);

  // ---- Measurements (1 row per week) ----
  const shM = ss.getSheetByName(SHEET_NAMES.MEASUREMENTS);
  const r0M = shM.getLastRow() + 1;
  shM.getRange(r0M, 1, 1, 11).setValues([[week, start, '', '', '', '', '', '', '', '', '']]);
  shM.getRange(r0M, 2).setNumberFormat(CONFIG.DATE_FORMAT);
  shM.getRange(r0M, 3, 1, 8).setNumberFormat('0.0');

  // ---- Summary (formulas, built from SHEET_NAMES so renames stay safe) ----
  const summary = ss.getSheetByName(SHEET_NAMES.SUMMARY);
  const rS = summary.getLastRow() + 1;
  summary.getRange(rS, 1, 1, 3).setValues([[week, start, end]]);
  summary.getRange(rS, 2, 1, 2).setNumberFormat(CONFIG.DATE_FORMAT);
  const W = SHEET_NAMES.WEIGHT, SL = SHEET_NAMES.SLEEP, WK = SHEET_NAMES.WORKOUTS,
        RN = SHEET_NAMES.RUNS, NU = SHEET_NAMES.NUTRITION;
  const formulas = [
    `=IFERROR(ROUND(AVERAGEIFS(${W}!D:D,${W}!A:A,$A${rS}),2),"")`,
    `=IF($A${rS}=1,"",IFERROR(ROUND(D${rS}-INDEX(D:D,MATCH($A${rS}-1,$A:$A,0)),2),""))`,
    `=IFERROR(ROUND(AVERAGEIFS(${SL}!F:F,${SL}!A:A,$A${rS}),1),"")`,
    `=IFERROR(ROUND(AVERAGEIFS(${SL}!G:G,${SL}!A:A,$A${rS}),1),"")`,
    `=IFERROR(ROUND(AVERAGEIFS(${SL}!I:I,${SL}!A:A,$A${rS}),1),"")`,
    `=IFERROR(COUNTUNIQUEIFS(${WK}!B:B,${WK}!A:A,$A${rS},${WK}!I:I,"<>"),0)`,
    `=IFERROR(COUNTIFS(${RN}!A:A,$A${rS},${RN}!E:E,">0"),0)`,
    `=IFERROR(SUMIFS(${RN}!E:E,${RN}!A:A,$A${rS}),0)`,
    `=IFERROR(ROUND(AVERAGEIFS(${NU}!F:F,${NU}!A:A,$A${rS}),1),"")`,
  ];
  summary.getRange(rS, 4, 1, 9).setFormulas([formulas]);

  return {
    week: week,
    start: start,
    end: end,
    rows: { workouts: r0W, runs: r0R, weight: r0Wt, sleep: r0S, nutrition: r0N, measurements: r0M, summary: rS },
    counts: { workouts: workoutRows.length, runs: runRows.length },
  };
}
