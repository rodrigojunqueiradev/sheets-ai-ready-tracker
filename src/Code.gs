/**
 * Code.gs - custom menu.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tracker')
    .addItem('New week', 'newWeek')
    .addItem('Export report (AI-ready CSV)', 'exportReport')
    .addSeparator()
    .addItem('Seed demo data (synthetic)', 'seedDemoData')
    .addItem('Create structure (first run)', 'createStructure')
    .addToUi();
}
