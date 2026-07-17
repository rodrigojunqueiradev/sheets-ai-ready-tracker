/**
 * Export.gs - the AI-ready CSV export.
 *
 * Consolidates every tab into ONE file: a metadata header (spreadsheet
 * name, generation timestamp, week range) followed by each tab as a
 * section delimited by "=== SHEET NAME ===". The format is designed so an
 * LLM can analyze it without any extra context: the week key links all
 * sections, and display values keep the locale formatting visible.
 */

function exportReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const tz = ss.getSpreadsheetTimeZone();

  const summary = ss.getSheetByName(SHEET_NAMES.SUMMARY);
  if (!summary || summary.getLastRow() < 2) {
    ui.alert('No weeks logged yet. Use "New week" first.');
    return;
  }

  let maxWeek = 0;
  summary.getRange(2, 1, summary.getLastRow() - 1, 1).getValues()
    .forEach(function (r) { const v = Number(r[0]); if (v > maxWeek) maxWeek = v; });

  const resp = ui.prompt(
    'Export report',
    'How many recent weeks to include?\nEmpty = all (1 to ' + maxWeek + ').',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const txt = resp.getResponseText().trim();
  let minWeek = 1;
  if (txt) {
    const n = Number(txt);
    if (!Number.isInteger(n) || n <= 0) {
      ui.alert(
        'Invalid input',
        '"' + txt + '" is not a positive whole number. Enter how many recent weeks to include, or leave empty to export all.',
        ui.ButtonSet.OK
      );
      return;
    }
    minWeek = Math.max(1, maxWeek - n + 1);
  }

  const order = [
    SHEET_NAMES.SUMMARY, SHEET_NAMES.WEIGHT, SHEET_NAMES.MEASUREMENTS,
    SHEET_NAMES.WORKOUTS, SHEET_NAMES.RUNS, SHEET_NAMES.SLEEP,
    SHEET_NAMES.NUTRITION, SHEET_NAMES.NOTES,
  ];
  const parts = [];
  parts.push('# WEEKLY TRACKING REPORT');
  parts.push('# Spreadsheet: ' + ss.getName());
  parts.push('# Generated: ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'));
  parts.push('# Weeks included: ' + minWeek + ' to ' + maxWeek);
  parts.push('');

  order.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 1) return;
    const data = sh.getDataRange().getDisplayValues();
    const header = data[0];
    const rows = data.slice(1).filter(function (r) {
      return r.join('').trim() !== '' && (minWeek <= 1 || Number(r[0]) >= minWeek);
    });
    parts.push('=== ' + name.toUpperCase() + ' ===');
    parts.push(header.map(csv_).join(','));
    rows.forEach(function (r) { parts.push(r.map(csv_).join(',')); });
    parts.push('');
  });

  const fileName = 'report_W' + minWeek + '-W' + maxWeek + '_' +
    Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmm') + '.csv';
  const folder = getExportFolder_();
  const file = folder.createFile(fileName, parts.join('\n'), MimeType.CSV);

  ui.alert(
    'Report generated',
    'File: ' + fileName + '\n\nLink:\n' + file.getUrl() +
    '\n\nDownload it and share it with your AI assistant of choice for analysis.',
    ui.ButtonSet.OK
  );
}
