# ClassTracker - Claude Code Instructions

## Project Overview

ClassTracker is a K-12 Australian Curriculum tracking web app for primary school teachers.
Split-file architecture: index.html + app.js + styles.css
Hosted at: chriswhite3140.github.io/class-tracker-split
Repo: github.com/chriswhite3140/class-tracker-split

## PR Review Focus Areas

When reviewing or generating code, ALWAYS flag if a change touches any of the following:

### High Risk - Block and Flag
- Google Sheets schema (named sheets: Students, Progress, TaughtLog, StandardsJudgments, ProgressionPlacements)
- IC outcome recording logic or the append-only history model
- The 80% mastery gate threshold
- Assessment scale values (Emerging, Developing, Consolidating, Mastery) - order and spelling matter
- Apps Script deployment, doGet or doPost handlers
- CSV data loading from GitHub raw URLs

### Medium Risk - Flag and Review
- Any change to how student data is read or written
- Bulk Assess logic
- Daily Log Wizard or Claude Haiku integration
- Coverage Gaps heatmap calculations
- StandardsJudgments or ProgressionPlacements logic

## What to Ignore
- Style and formatting preferences
- Code style consistency unless it causes a bug
- Linter warnings unrelated to logic

## What to Focus On
- Business logic correctness
- Unhandled edge cases (empty data, missing sheets, failed fetches)
- Data integrity risks (writes that could corrupt Sheets data)
- Any change that could silently fail without user feedback

## Coding Rules
- Always run `node --check` after edits
- Never use single quotes inside single-quoted JS strings
- Use data-* attributes with delegated listeners for onclick handlers
- Always read APP_VERSION from the uploaded file before making changes - never assume the version
- Apply new features on top of files provided - never rebuild from memory

## Output Preference
- Complete ready-to-use code files, not diffs
