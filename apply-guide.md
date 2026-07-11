# Apply Guide: setting up the demo spreadsheet

Use a personal Google account and a NEW spreadsheet. Time estimate: 15 minutes.

## 1. Create the spreadsheet

1. Go to [sheets.new](https://sheets.new), name it **AI-Ready Tracker (Demo)**.

## 2. Install the script

2. **Extensions > Apps Script**. Delete the empty `myFunction` stub.
3. Paste `src/Code.gs` into the editor's default `Code.gs` file.
4. Click **+ > Script** six times and create files named `Config`, `Structure`, `Week`, `Export`, `Utils`, `DemoData`; paste the contents of the matching `src/*.gs` file into each.
5. **Save** (Ctrl+S).

## 3. Configure (optional)

6. In `Config.gs`, the export works out of the box: it creates a Drive folder named **Tracking Reports**. To use a specific folder instead, create one in Drive, open it, copy the ID from the URL (`drive.google.com/drive/folders/<ID>`), and paste it into `CONFIG.EXPORT_FOLDER_ID`.

## 4. First run and authorization

7. In the editor toolbar, select `createStructure` and click **Run**.
8. Authorize when prompted: **Review permissions > your account > Advanced > Go to project (unsafe) > Allow**. The warning is standard for personal, unverified scripts; the code only touches this spreadsheet and your Drive export folder.
9. Open the spreadsheet: 9 tabs created with headers, frozen rows, and validations.
10. Run `seedDemoData` from the editor: 5 synthetic weeks are generated (this takes a minute; the red DEMO DATA banner appears on the Instructions tab).
11. Reload the spreadsheet page. The **Tracker** menu appears. Check the Summary tab: 5 rows with computed averages, weight change, sessions, and km.

## 5. Exercise the flow

12. **Tracker > New week**: accept the suggested Monday; week 6 is created empty across all tabs (this is the weekly one-click in real use).
13. **Tracker > Export report (AI-ready CSV)**: enter `5` to include the 5 demo weeks (or leave empty for all). The alert shows the file link; the CSV lands in the export folder.
14. Open the CSV and confirm the format: `# WEEKLY TRACKING REPORT` metadata header, then `=== SUMMARY ===`, `=== WEIGHT ===`, and the other sections.

## Troubleshooting

- **"Authorization is required":** run the function again from the editor and complete the permission screen.
- **Menu missing:** `onOpen()` runs on page load; reload the browser tab.
- **Seed aborted:** `seedDemoData` requires an empty tracker. Use a fresh spreadsheet (or delete all tabs and rerun `createStructure`).
- **Summary shows 0s/blank:** the formulas read the other tabs by week number; they fill as soon as data exists for that week (the seed does this automatically).

## 6. Screenshots and the real export (save to assets/)

15. `assets/summary-tab.png`: Summary tab showing the 5 demo weeks.
16. `assets/custom-menu.png`: the Tracker menu open.
17. `assets/export-csv.png`: the exported CSV open (text editor or Drive preview) showing the metadata header and section markers.
18. Main Upwork image: ideally 1000x750 (crop of the Summary tab).
19. Replace the illustrative `sample-export.csv` in the repo with the real export from the demo spreadsheet, then commit:

```bash
git add assets/summary-tab.png assets/custom-menu.png assets/export-csv.png sample-export.csv
git commit -m "Add demo screenshots and real demo export"
git push
```
