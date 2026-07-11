/**
 * Utils.gs - shared helpers.
 */

/** Returns a new Date n days after d. */
function addDays_(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** CSV-escapes one cell value. */
function csv_(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Resolves the Drive folder for exports.
 * Uses CONFIG.EXPORT_FOLDER_ID when set; otherwise finds or creates a
 * folder named CONFIG.EXPORT_FOLDER_NAME in My Drive.
 */
function getExportFolder_() {
  if (CONFIG.EXPORT_FOLDER_ID) {
    return DriveApp.getFolderById(CONFIG.EXPORT_FOLDER_ID);
  }
  const it = DriveApp.getFoldersByName(CONFIG.EXPORT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.EXPORT_FOLDER_NAME);
}
