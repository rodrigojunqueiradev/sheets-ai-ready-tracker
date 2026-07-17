# Apply Guide: reproducing the tracker in your own account

This guide sets up a working copy of the tracker in a new Google Sheets file, seeds it with synthetic demo data, and exercises the full flow (weekly generation, logging, AI-ready export). Time estimate: 10 to 15 minutes.

## Prerequisites

- A Google account.
- A new, empty spreadsheet: go to [sheets.new](https://sheets.new) and name it (for example **AI-Ready Tracker (Demo)**).
- For path A only: [Node.js](https://nodejs.org) and the [clasp](https://github.com/google/clasp) CLI (`npm install -g @google/clasp`).

## Path A: install with clasp (recommended)

1. Enable the Apps Script API at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
2. Authenticate: `clasp login`.
3. Bind the local `src/` folder to a container-bound script project. Either:
   - Create a new spreadsheet and script in one step, from the repository root:

     ```bash
     clasp create --type sheets --title "AI-Ready Tracker (Demo)" --rootDir src
     ```

   - Or, if the spreadsheet already exists, open **Extensions > Apps Script** once, copy the script ID from **Project Settings**, and clone it:

     ```bash
     clasp clone <scriptId> --rootDir src
     ```

4. Push the code: `clasp push` (answer yes to overwriting the manifest). All 7 script files plus `appsscript.json` are uploaded.

The generated `.clasp.json` stores your personal script binding; it is intentionally listed in `.gitignore`.

## Path B: install manually

1. In the spreadsheet, open **Extensions > Apps Script** and delete the empty `myFunction` stub.
2. Paste `src/Code.gs` into the editor's default `Code.gs` file.
3. Click **+ > Script** six times and create files named `Config`, `Structure`, `Week`, `Export`, `Utils`, `DemoData`; paste the contents of the matching `src/*.gs` file into each.
4. Enable **View > Show manifest file** and replace the contents of `appsscript.json` with `src/appsscript.json`.
5. **Save** (Ctrl+S).

## Configure (optional)

The export works out of the box: it creates a Drive folder named **Tracking Reports**. To use a specific folder instead, create one in Drive, open it, copy the ID from the URL (`drive.google.com/drive/folders/<ID>`), and paste it into `CONFIG.EXPORT_FOLDER_ID` in `Config.gs`.

## First run and authorization

1. In the editor toolbar, select `createStructure` and click **Run**.
2. Authorize when prompted: **Review permissions > your account > Advanced > Go to project (unsafe) > Allow**. The warning is standard for personal, unverified scripts.
3. The manifest requests exactly three OAuth scopes, and this is what each one covers:
   - `spreadsheets.currentonly`: read and write only the spreadsheet this script is bound to. No other spreadsheet is accessible.
   - `script.container.ui`: show the custom **Tracker** menu, prompts, alerts, and toasts inside that spreadsheet.
   - `drive`: find or create the export folder and create the CSV report file in your Drive.
4. Open the spreadsheet: 9 tabs are created with headers, frozen rows, and validations.

## Seed the demo data

1. Run `seedDemoData` from the editor: 5 synthetic weeks are generated in a few seconds (values are written in batches). A red DEMO DATA banner appears on the Instructions tab.
2. Reload the spreadsheet page so the **Tracker** menu appears. Check the Summary tab: 5 rows with computed averages, weight change, training days, runs, and km.

## Use the menu

- **Tracker > New week**: accept the suggested Monday (or type a date in the configured format; a date that is not a Monday is adjusted to the Monday of that week automatically). Week 6 is created empty across all tabs. This is the weekly one-click in real use.
- Fill values during the week; derived cells (pace, hours slept, all Summary columns) compute themselves.

## Export

1. **Tracker > Export report (AI-ready CSV)**: enter `5` to include the 5 demo weeks (or leave empty for all). The alert shows the file link; the CSV lands in the export folder in Drive.
2. Open the CSV and confirm the format: `# WEEKLY TRACKING REPORT` metadata header, then `=== SUMMARY ===`, `=== WEIGHT ===`, and the other sections. See `analysis-prompt-example.md` for a ready-to-use analysis prompt.

## Troubleshooting

- **"Authorization is required":** run the function again from the editor and complete the permission screen.
- **Menu missing:** `onOpen()` runs on page load; reload the browser tab.
- **Seed aborted:** `seedDemoData` requires an empty tracker. Use a fresh spreadsheet (or delete all tabs and rerun `createStructure`).
- **Summary shows 0s/blank:** the formulas read the other tabs by week number; they fill as soon as data exists for that week (the seed does this automatically).
