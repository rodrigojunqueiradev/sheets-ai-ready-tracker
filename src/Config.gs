/**
 * AI-Ready Weekly Tracking System for Google Sheets.
 *
 * A structured weekly data model (every row is keyed by week number) with
 * a one-click export designed to be consumed by an LLM: a single CSV with
 * a metadata header and clearly delimited sections, so the model needs no
 * extra context to analyze trends across weeks.
 *
 * Files:
 *   Config.gs    - all configuration: sheet names, headers, catalogs (this file)
 *   Code.gs      - custom menu
 *   Structure.gs - createStructure(): tabs, headers, validations, instructions
 *   Week.gs      - newWeek(): generates a full week block in one click
 *   Export.gs    - exportReport(): the AI-ready CSV export
 *   DemoData.gs  - seedDemoData(): 5 weeks of deterministic synthetic data
 *   Utils.gs     - shared helpers
 */

// ==================== CONFIGURATION ====================

const CONFIG = {
  // Drive folder that receives the CSV exports.
  // Option A (default): leave EXPORT_FOLDER_ID empty; a folder named
  //   EXPORT_FOLDER_NAME is found or created in My Drive.
  // Option B: paste a folder ID here to export into a specific folder.
  EXPORT_FOLDER_ID: '',                    // <-- optional: paste a Drive folder ID
  EXPORT_FOLDER_NAME: 'Tracking Reports',  // used when EXPORT_FOLDER_ID is empty

  // Locale-aware display formats. The week generator and the export use
  // these everywhere, so switching locale is a one-line change.
  DATE_FORMAT: 'dd/MM/yyyy',  // e.g. 'MM/dd/yyyy' for US, 'yyyy-MM-dd' for ISO
  TIME_FORMAT: 'HH:mm',
};

const SHEET_NAMES = {
  SUMMARY: 'Summary',
  WORKOUTS: 'Workouts',
  RUNS: 'Runs',
  WEIGHT: 'Weight',
  MEASUREMENTS: 'Measurements',
  SLEEP: 'Sleep',
  NUTRITION: 'Nutrition',
  NOTES: 'Notes',
  INSTRUCTIONS: 'Instructions',
};

const HEADERS = {
  [SHEET_NAMES.SUMMARY]: ['Week', 'Start', 'End', 'Avg Weight (kg)', 'Weight Change (kg)', 'Avg Sleep (h)', 'Sleep Quality (1-5)', 'Anxiety (0-5)', 'Training Days', 'Runs', 'Km Run', 'Sweet Cravings (avg)', 'Week Notes'],
  [SHEET_NAMES.WORKOUTS]: ['Week', 'Date', 'Day', 'Workout', 'Order', 'Exercise', 'Target', 'Load (kg)', 'Reps Done', 'RIR', 'Notes'],
  [SHEET_NAMES.RUNS]: ['Week', 'Date', 'Day', 'Type', 'Distance (km)', 'Time (min)', 'Pace (min/km)', 'Feel (1-5)', 'Notes'],
  [SHEET_NAMES.WEIGHT]: ['Week', 'Date', 'Day', 'Weight (kg)', 'Notes'],
  [SHEET_NAMES.MEASUREMENTS]: ['Week', 'Date', 'Waist', 'Abdomen', 'Hips', 'Chest', 'Neck', 'Arm', 'Thigh', 'Calf', 'Notes'],
  [SHEET_NAMES.SLEEP]: ['Week', 'Date', 'Day', 'Bedtime', 'Wake-up', 'Hours', 'Quality (1-5)', 'Last Coffee', 'Anxiety (0-5)', 'Wind-down Ritual (Y/N)', 'Notes'],
  [SHEET_NAMES.NUTRITION]: ['Week', 'Date', 'Day', 'Calories', 'Protein (g)', 'Sweet Cravings (0-5)', 'Off-plan Snacking (Y/N)', 'Notes'],
  [SHEET_NAMES.NOTES]: ['Week', 'Date', 'Topic', 'Note'],
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Example workout catalog (fully configurable). Each block is scheduled
// by offset = days after the Monday that starts the week.
const WEEKLY_WORKOUTS = [
  { offset: 1, workout: 'A - Upper Body 1', items: [
    ['1',  'Dumbbell bench press', '3x10-12'],
    ['2',  'Barbell bent-over row', '3x10-12'],
    ['3',  'Dumbbell shoulder press', '3x10-12'],
    ['4',  'Lat pulldown (wide grip)', '3x10-12'],
    ['5a', 'Superset: Lateral raise', '3x12-15'],
    ['5b', 'Superset: Reverse fly', '3x12-15'],
    ['6a', 'Superset: Rope pushdown', '3x10-12'],
    ['6b', 'Superset: Barbell curl', '3x10-12'],
  ]},
  { offset: 1, workout: 'Functional', items: [
    ['-', 'Functional circuit (30 min)', '30 min'],
  ]},
  { offset: 2, workout: 'C - Lower Body (light)', items: [
    ['1',  'Leg press 45', '3x12-15'],
    ['2',  'Leg extension', '3x12-15'],
    ['3',  'Lying leg curl', '3x12-15'],
    ['4a', 'Superset: Hip abduction machine', '3x15-20'],
    ['4b', 'Superset: Standing calf raise', '3x15-20'],
  ]},
  { offset: 3, workout: 'B - Upper Body 2', items: [
    ['1',  'Incline dumbbell press (30 deg)', '3x10-12'],
    ['2',  'One-arm dumbbell row (each side)', '3x10-12'],
    ['3',  'Machine shoulder press', '3x10-12'],
    ['4',  'Close-grip lat pulldown', '3x10-12'],
    ['5a', 'Superset: Face pull', '3x12-15'],
    ['5b', 'Superset: Front raise', '3x12-15'],
    ['6a', 'Superset: Lying triceps extension', '3x10-12'],
    ['6b', 'Superset: Hammer curl', '3x10-12'],
  ]},
  { offset: 3, workout: 'Functional', items: [
    ['-', 'Functional circuit (30 min)', '30 min'],
  ]},
  { offset: 4, workout: 'D - Back/Posterior Chain', items: [
    ['1',  'Barbell stiff-leg deadlift', '3x10-12'],
    ['2',  'T-bar row', '3x10-12'],
    ['3',  'Machine chest fly', '3x12-15'],
    ['4',  'V-bar pulldown', '3x10-12'],
    ['5a', 'Superset: Barbell curl', '3x12-15'],
    ['5b', 'Superset: Rope pushdown', '3x12-15'],
    ['6',  'Plank', '3x max'],
    ['7',  'Lower abs crunch', '3x12-15'],
  ]},
  { offset: 5, workout: 'E - Lower Body (heavy)', items: [
    ['1', 'Barbell or smith squat', '4x8-10'],
    ['2', 'Sumo deadlift', '3x8-10'],
    ['3', 'Bulgarian split squat (each side)', '3x10-12'],
    ['4', 'Seated leg curl', '3x10-12'],
    ['5', 'Hip thrust', '3x10-12'],
    ['6', 'Calf press (horizontal leg press)', '4x15-20'],
  ]},
];

// Weekly run schedule (offset = days after Monday).
const WEEKLY_RUNS = [
  { offset: 0, type: 'Easy/recovery (optional)' },
  { offset: 2, type: "Intervals (treadmill) - 8x(2' moderate / 1' hard)" },
  { offset: 4, type: 'Continuous - ~10% progression' },
  { offset: 6, type: 'Long run - 5K build-up' },
];
