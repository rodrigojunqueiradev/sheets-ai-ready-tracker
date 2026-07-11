# Analysis Prompt Example

The export was designed so that a single CSV plus a short prompt is all an LLM needs. Attach the exported file (e.g. `report_W1-W5_20260608_0930.csv`) to your AI assistant of choice and use something like:

```
You are my training and recovery analyst. The attached CSV is my weekly
tracking export. It contains a metadata header and sections delimited by
"=== SECTION ===" (Summary, Weight, Measurements, Workouts, Runs, Sleep,
Nutrition, Notes). Every row is keyed by the Week column, so you can join
sections by week.

Analyze the included weeks and answer:
1. Trends: weight, average sleep, and running volume week over week.
   Call out anything that moved more than expected.
2. Consistency: which planned sessions (gym and runs) were missed, and
   whether misses cluster on specific days.
3. Relationships worth checking: does sleep quality track with anxiety,
   caffeine timing, or the wind-down ritual? Do sweet cravings spike after
   short nights?
4. Next cycle: 3 specific, small adjustments for next week based only on
   this data. Reference the numbers that justify each suggestion.

Be direct and quantitative. If the data is insufficient for a claim, say so.
```

Why this works with no extra context:

- The metadata header tells the model what the file is and which weeks it covers.
- Section markers make the multi-table structure explicit inside a single file.
- The week key links every section, enabling week-over-week joins.
- Column headers carry units and scales (kg, min/km, 1-5), so no data dictionary is needed.
