/**
 * Structure.gs - creates all tabs, headers, formatting, and validations.
 * Safe to rerun: existing tabs are kept, headers and validations reapplied.
 */

function createStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const order = [
    SHEET_NAMES.SUMMARY, SHEET_NAMES.WORKOUTS, SHEET_NAMES.RUNS,
    SHEET_NAMES.WEIGHT, SHEET_NAMES.MEASUREMENTS, SHEET_NAMES.SLEEP,
    SHEET_NAMES.NUTRITION, SHEET_NAMES.NOTES, SHEET_NAMES.INSTRUCTIONS,
  ];

  order.forEach(function (name, i) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name, i);
    const headers = HEADERS[name];
    if (headers) {
      sh.getRange(1, 1, 1, headers.length)
        .setValues([headers])
        .setFontWeight('bold')
        .setFontColor('#ffffff')
        .setBackground('#37474f')
        .setWrap(true);
      sh.setFrozenRows(1);
    }
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });

  // Remove the default empty tab, if still present
  ['Sheet1', 'Página1'].forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  // Useful column widths
  ss.getSheetByName(SHEET_NAMES.WORKOUTS).setColumnWidth(6, 280);   // Exercise
  ss.getSheetByName(SHEET_NAMES.RUNS).setColumnWidth(4, 300);       // Type
  ss.getSheetByName(SHEET_NAMES.SUMMARY).setColumnWidth(13, 300);   // Week Notes
  ss.getSheetByName(SHEET_NAMES.NOTES).setColumnWidth(4, 420);      // Note

  applyValidations_(ss);
  writeInstructions_(ss);

  SpreadsheetApp.getUi().alert(
    'Structure created',
    'Tabs are ready. Reload the page to see the "Tracker" menu, then use "New week" to open the first week.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function applyValidations_(ss) {
  const nRows = 5000;
  const num = function (min, max) {
    return SpreadsheetApp.newDataValidation().requireNumberBetween(min, max).setAllowInvalid(true).build();
  };
  const yn = SpreadsheetApp.newDataValidation().requireValueInList(['Y', 'N'], true).setAllowInvalid(true).build();

  ss.getSheetByName(SHEET_NAMES.SLEEP).getRange(2, 7, nRows).setDataValidation(num(1, 5));      // Quality
  ss.getSheetByName(SHEET_NAMES.SLEEP).getRange(2, 9, nRows).setDataValidation(num(0, 5));      // Anxiety
  ss.getSheetByName(SHEET_NAMES.SLEEP).getRange(2, 10, nRows).setDataValidation(yn);            // Ritual
  ss.getSheetByName(SHEET_NAMES.NUTRITION).getRange(2, 6, nRows).setDataValidation(num(0, 5));  // Cravings
  ss.getSheetByName(SHEET_NAMES.NUTRITION).getRange(2, 7, nRows).setDataValidation(yn);         // Snacking
  ss.getSheetByName(SHEET_NAMES.RUNS).getRange(2, 8, nRows).setDataValidation(num(1, 5));       // Feel
}

function writeInstructions_(ss) {
  const sh = ss.getSheetByName(SHEET_NAMES.INSTRUCTIONS);
  sh.clear();
  const lines = [
    ['HOW TO USE THIS SPREADSHEET'],
    [''],
    ['1) Every Monday: menu "Tracker" > "New week". This generates every row for the week (workouts, runs, weight, sleep, nutrition, measurements, and the summary line).'],
    ['2) Fill in as the week goes. Workouts: load, reps, and RIR (reps in reserve, target 1-2). Runs: distance and time (pace computes itself). Sleep: bedtime/wake-up (hours compute themselves, midnight-safe), quality, last coffee, anxiety, wind-down ritual.'],
    ['3) Weight: log on the days you weigh in (fasted, same scale). The Summary uses the weekly AVERAGE.'],
    ['4) Measurements: one row per week is pre-created; fill it when you measure (same conditions, tape at the same spot). Leave empty on weeks you skip.'],
    ['5) End of the week: "Export report (AI-ready CSV)" > choose how many recent weeks to include (empty = all) > the CSV lands in the export folder in your Drive > download it and share it with your AI assistant of choice for analysis.'],
    [''],
    ['SCALES: Sleep quality 1 (terrible) to 5 (great) | Anxiety 0 (none) to 5 (very high) | Sweet cravings 0 to 5 | Run feel 1 (rough) to 5 (easy).'],
    [''],
    ['NOTE: the "Tracker" menu only appears in the BROWSER (desktop, or mobile in desktop mode). The mobile app can edit data but cannot run the menu actions.'],
    ['Check File > Settings and set the spreadsheet timezone to yours: dates and week boundaries follow it.'],
  ];
  sh.getRange(1, 1, lines.length, 1).setValues(lines).setWrap(true);
  sh.setColumnWidth(1, 760);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(12);
}
