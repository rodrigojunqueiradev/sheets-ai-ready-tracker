# AI-Ready Tracking System (Google Sheets + Apps Script)

A weekly tracking spreadsheet built as a data pipeline: structured, week-keyed records and a one-click CSV export designed to be analyzed by an LLM with zero extra context.

![License](https://img.shields.io/badge/License-MIT-green)

## Problem

Personal tracking data usually ends up scattered and unstructured: some numbers in an app, some in a notebook, some in loose spreadsheet cells with no consistent keys. When you finally want real analysis (trends, correlations, what to adjust next), the data cannot answer, and neither can an AI assistant, because there is nothing coherent to feed it.

## Solution

A Google Sheets system where the data model comes first. Every record in every tab (workouts, runs, weight, sleep, nutrition, measurements, notes) is keyed by week number, generated programmatically so the structure never drifts, summarized by formulas, and exported by one menu click into a single CSV that an LLM can consume as-is: metadata header, section markers, week keys linking all sections, units in every column header.

## How it works

1. **Generate the week.** One click creates the entire week block across all tabs: scheduled workouts from a configurable catalog, planned runs, 7 day-rows for weight/sleep/nutrition, a measurements row, and a summary line whose formulas fill themselves.
2. **Log during the week.** Only raw values are typed; everything derivable is computed (pace from time/distance, hours slept from bedtime/wake-up, weekly averages and deltas in the summary).
3. **Export.** "Export report" consolidates every tab into one CSV in Drive, filterable to the N most recent weeks.
4. **AI analysis.** The CSV goes to any LLM with a short prompt (see `analysis-prompt-example.md`) for week-over-week trends, consistency checks, and next-cycle suggestions.

## The AI-ready export

```
# WEEKLY TRACKING REPORT
# Spreadsheet: AI-Ready Tracker (Demo)
# Generated: 2026-06-08 09:30
# Weeks included: 1 to 5

=== SUMMARY ===
Week,Start,End,Avg Weight (kg),...
1,04/05/2026,10/05/2026,82.55,...

=== WEIGHT ===
...
```

The format removes the need for any accompanying explanation: the metadata header says what the file is, `=== SECTION ===` markers expose the multi-table structure inside one file, the week key joins sections, and headers carry units and scales. `sample-export.csv` in this repository is an illustrative example of the export format.

## Technical highlights

- **Programmatic structure generation:** tabs, headers, formats, and validations created by script, so the model never depends on manual setup.
- **Week-key data model:** one integer key links 8 tabs and powers all cross-tab formulas (AVERAGEIFS, COUNTUNIQUEIFS, INDEX/MATCH for week-over-week deltas).
- **Midnight-safe calculated fields:** hours slept use `MOD(wake - bed, 1)`, so a 23:30 bedtime and 06:30 wake-up compute correctly.
- **Content-derived numbering:** the next week number is derived from the data, not from a stored counter, so imports and deletions stay consistent.
- **Input guardrails:** 1-5 and 0-5 scale validations, Y/N lists.
- **Locale-aware by configuration:** date and time formats are single constants (`CONFIG.DATE_FORMAT`), not scattered literals.
- **Central sheet-name config:** every formula is built from `SHEET_NAMES`, so renaming a tab is a one-line change.
- **Deterministic demo seeder:** `seedDemoData()` generates 5 plausible synthetic weeks from a fixed-seed generator and stamps a visible DEMO DATA banner.

## Stack

Google Apps Script, Google Sheets, Drive integration, CSV.

## Screenshots

![Summary tab](assets/summary-tab.png)
![Custom menu](assets/custom-menu.png)
![Exported CSV](assets/export-csv.png)

## About

Built by Rodrigo Junqueira, Data Analyst & AI Automation Specialist. Personal tracking system; demo with synthetic data.

## License

MIT
