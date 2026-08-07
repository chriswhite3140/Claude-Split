# CLAUDE.md – ClassTracker Project Context

> **This file goes stale.** It was last verified against the actual `app.js` source (not copied forward from an older version of this file or from `docs/`) on 2026-07-28, at v1.13.86. Before relying on any specific claim below for planning purposes — a feature being built or not built, a version number, a listed gap — grep or read the relevant part of `app.js` directly and confirm it's still true. Treat this file as a fast orientation, not ground truth.

## What this project is

ClassTracker is a browser-based classroom planning and mastery tracking tool for Australian Curriculum v9 (P–6) teachers. It is built with vanilla JavaScript, HTML, and CSS. There is no build step. It runs directly in the browser via GitHub Pages.

This is the **new ClassTracker build** (`claude-split`). The old v1 app lives in `class-tracker-split` and is not under active development.

---

## Repo structure

- `index.html` — main entry point and UI shell
- `app.js` — all application logic (vanilla JS)
- `styles.css` — all styling
- `docs/` — design documents (see caveat below — several are stale and describe planned/historical state, not necessarily what's built)
- `data/` — curriculum source files (CSV, XLSX)
- `apps-script/` — Google Apps Script backend source, kept here for review/version control alongside what's deployed at `API_URL`. This repo has no direct access to that separate script project, so deployment status can't be confirmed from source alone — see `DriveBackup.gs`'s header for how to check
- `tests/` — automated regression test suite (`node tests/planner-scheduling.test.js`; see Testing below)
- `.github/workflows/` — Claude Code GitHub Actions workflows

---

## Design documents — read before every task

The documents in `docs/` describe product intent and data schema design. Claude Code should consult the relevant documents before implementing any feature that touches their area.

| File | Purpose |
|---|---|
| `docs/MASTER-PROJECT-SUMMARY.md` | Product overview, core workflow, build strategy |
| `docs/PRODUCT-RULES-DOCUMENT.md` | Enforcement rules — check before every feature |
| `docs/DATA-SCHEMA-DOCUMENT.md` | All data structures and relationships |
| `docs/IC-FRAMEWORK-SPEC.md` | IC generation rules, ownership, mastery calculation |
| `docs/IC-GENERATION-PROMPT-TEMPLATE.md` | AI prompt template for generating system default ICs |
| `docs/WEEKLY-PLANNER-SPEC.md` | Weekly Planner UI and interaction spec (home screen) |
| `docs/FIRST-BUILD-SLICE.md` | Smallest vertical slice that proves the core loop |
| `docs/ARCHITECTURE-ASSESSMENT.md` | A point-in-time assessment from mid-June 2026 — **its gap list and "forced build order" are superseded by "Current build status" below** (most of what it lists as missing has since shipped); useful for historical context on *why* things are structured the way they are, not for what's currently missing |

If a proposed change conflicts with the data model or enforcement rules in these documents, do not proceed — flag the conflict instead. But for "is X already built", trust `app.js` over any document, including this one.

---

## Core system model

Everything in ClassTracker flows through **Instructional Components (ICs)**.

```
Curriculum descriptor → ICs → Lessons → Mastery → Progress → Next teaching decision
```

No feature should bypass ICs. If a feature does not connect to ICs, it is out of scope.

---

## Backend

Google Apps Script connects to Google Sheets for data storage. The frontend communicates with it via fetch calls to a deployed Apps Script URL configured in `app.js` (`API_URL`).

Planner/Unit Plan data (units + lessons) is not part of this Sheets backend — see "Known gaps" below. It does get a JSON safety-net backup to the teacher's own Google Drive (`driveBackupSave`/`driveBackupLoad` actions, called from `app.js`'s "DRIVE BACKUP SYNC" section; Apps Script side in `apps-script/DriveBackup.gs`) — **this is not a substitute for Sheets persistence**, it's not queryable, and outcome data still can't be joined to it (see "Known gaps").

---

## Test Mode — safe exploration without touching real data

The app has a built-in safe mode for interactive exploration, audits, or any extensive click-through testing, with zero risk of writing to real data.

Activation is via URL param only, never a UI toggle:

- `?testMode=1` — real, current data, but nothing persists. localStorage is shadowed for the session (the real store is never written to again), and all backend write actions are mocked. Use this when you specifically need to test against the real dataset's actual shape.
- `?testMode=1&sampleData=1` — a fixed, fictional dataset instead of real data (18 students, 4 units at different stages, lessons covering all 5 teaching statuses, a mastery spread at the 80% coverage-gate boundary, a genuine coverage gap, and a deliberately-reproduced known bug in one unit). Use this by default for anything exploratory, audit-style, or involving realistic-but-fake data — it has the same non-persistence guarantee as `testMode=1` alone, but never touches or even reads real student data. `sampleData=1` does nothing without `testMode=1` also present (fail-closed by design).

Default to sampleData mode for any UI audit, usability walkthrough, or exploratory session. Confirm the test-mode banner is visible before proceeding — if the URL param doesn't produce the banner, stop and report that rather than continuing on what might be the live app.

---

## Key conventions

- Vanilla JavaScript only — no frameworks, no npm, no build tools
- All application logic lives in `app.js`; all styling lives in `styles.css`
- Keep changes small and focused — one problem at a time
- Always preserve existing functionality when making changes
- Version bump `APP_VERSION` (top of `app.js`) on every user-facing change, with a changelog line describing what changed and why
- The app is used by teachers — UI must be clear, low friction, and practical
- Use semantic theme tokens only (`var(--...)`) — no hardcoded colours
- Never introduce duplicate data entry across features

---

## Current build status

`app.js` is at **v1.13.91** (~11,800 lines). This is a mature, actively-developed build — most of the structural gaps a June 2026 assessment identified have since been closed. One genuine gap remains (see below); a second is partially closed (phase 1 of 2).

### Built and working
- CSV auto-fetch + `buildDescriptorIndex()` (descriptorType typing, elaborations)
- IC data model — ownership tiers (`system_default` / `teacher_original` / `teacher_stub`), draft/stub ICs with a promotion flow, suppression, `homeDescriptorId`/`linkedDescriptorIds` tethering (schema §2.3)
- **Weekly Planner** — single consolidated planning surface (the old separate "Plan & Log" and legacy Weekly Planner were retired in v1.13.0). Week-based board is Mon–Fri only (no Unscheduled column — a unit lesson waiting to be scheduled lives in the Unit-lessons rail instead; a standalone lesson still carrying the legacy `dayKey: 'unscheduled'` from before that change surfaces in its own small fallback area rather than disappearing) with drag-to-schedule; collapsible Unit-lessons rail and Lesson Drawer side panels, each with independent scroll; the Unit-lessons rail has its own search (matches lesson title) + subject filter (v1.13.91); a lesson's `intention` field drives an IC-suggestion engine (confidence-tiered Strong/Partial/Weak, class year-level filtered, boosted toward a unit's own linked CDs, stopword-filtered token scoring); 1–3 linked ICs per lesson; resource links (label + URL, http/https-only); per-occurrence taught-status tracking for a lesson scheduled on more than one day
- **Unit Plans** — a layer above the Weekly Planner (v1.13.24+): units group lessons into a sequence (add/reorder/delete), linked curriculum descriptors with year-level defaulting, assessment notes, whole-unit/single-lesson duplicate, its own 3-column view (lesson sequence / edit-view lesson drawer / unit details) reusing the Weekly Planner's lesson-editing UI; the list view has its own search (matches unit title) + subject filter (v1.13.91)
- **Drive backup sync** — `app.js` backs up unit plans + lessons as JSON to the teacher's Google Drive (dirty-tracking, retry, a sync-status indicator); the Apps Script side (`apps-script/DriveBackup.gs`) is deployed and this has been confirmed working live (sync indicator, restore banner, manual backup button) — see the note in `apps-script/DriveBackup.gs` for how to re-check if this ever needs verifying again. Still just a JSON safety net, not full Sheets persistence (see "Known gaps")
- **Daily Wizard** — attendance → codes/ICs (manual pick, or AI-assisted suggestion with a keyword-scorer fallback when no API key is configured) → per-student IC scan (`got_it`/`needs_review`) → conditional quick-mastery step for students at ≥80% IC coverage. Its manual "Log Today" entry point (`openDailyLogWizard()`) still starts from a blank slate, unaffected — but checking a lesson's Week Board "mark as taught" checkbox (see Weekly Planner above) now also auto-launches or merges into a session, pre-filled with that lesson's linked ICs and dated to the actual occurrence, not always today (`dlLaunchOrMergeForLesson`, phase 1 — see "Known gaps")
- Mastery + coverage — 80% validity gate, IC skill rollup (OR-scoring across tethered/linked ICs) feeding Bulk Assess and Coverage Gaps consistently, strand-history signals, coverage heatmap and class-overview views
- Sheets backend for teaching/mastery data (Students, Progress, TaughtLog, TaughtICs, StandardsJudgments, ProgressionPlacements)
- Bulk Assess, Standards Judgments, Progression Placement
- Data & Settings admin view — assessment scale configuration, theme (light/dark/auto) and text-size preferences, CSV management, Class/Teacher Group settings (incl. year levels)
- Student mastery-summary print/export ("Student Report", single or bulk) — structured badges and achieved/developing/emerging counts per subject/strand; not free-text report authoring (see "What NOT to build")
- Automated regression test suite (`tests/planner-scheduling.test.js`, run via `node tests/planner-scheduling.test.js`) covering Weekly Planner/Unit Plans scheduling, IC-linking, and panel-scroll/layout logic — run it after any change touching those areas, and add regression tests for new bug fixes/features in that area

### Known gaps
- **The Daily Wizard ↔ planned lessons gap is now phase 1 of a deliberate 2-phase close-out.** Done (v1.13.89): checking a lesson's Week Board "mark as taught" checkbox now auto-launches/merges a Daily Wizard session pre-filled with that lesson's ICs and dated to the actual occurrence (`dlLaunchOrMergeForLesson`); `TaughtLog`/`TaughtICs` records now carry a `lessonId` (`Progress` — mastery judgments — does not, out of phase-1 scope). Still not done (deliberately deferred to phase 2, not yet built): the manual "Log Today" entry point (`openDailyLogWizard()`) still always starts from a blank slate rather than reading `state.lessonPlans`; there is still no UI to see what was actually logged against a specific planned lesson (the data now supports it, nothing surfaces it yet); per-lesson-group attendance (different absent students per lesson in a merged multi-lesson session) and visual grouping by lesson in the IC Outcomes step are both explicitly out of scope until phase 2.
- **Planning data (units + lessons) is still localStorage-first, not Sheets-backed.** The Drive JSON backup (deployed and confirmed working — see Backend above) is a safety net against data loss, not a substitute — it's not queryable, and outcome data still can't be fully joined to it (`lessonId` now exists on `TaughtLog`/`TaughtICs` per above, but the Apps Script backend needs a matching column added to actually persist it — see the `saveDailyLog`/`saveTaughtLog`/`saveTaughtICs` `NOTE` comments in `app.js` — and the planning data itself still isn't in Sheets at all).

There is no prescribed order for closing these — scope and sequence any work on them per the specific task at hand, verifying against `app.js`/`apps-script/` first rather than assuming any gap's status.

**A note on verifying Drive backup deployment status specifically:** this repo has no direct access to the separate Apps Script project behind `API_URL`, so a static claim here (or a comment in `apps-script/DriveBackup.gs`) can go stale the moment someone redeploys it outside the repo — as happened once already (an earlier version of this file wrongly claimed it wasn't deployed, based on a since-stale comment in that file). Don't trust an *already-displayed* "Last synced to Drive: `<time>`" on its own either — `driveSyncIndicatorHtml()` renders that from `state.driveSync.lastSyncedAt`, which `driveSyncInitDirtyState()` seeds from a **persisted `localStorage` timestamp on every page load**, so it can keep showing an old success time even if the backend has since broken or been redeployed without the Drive actions, with no fresh sync having happened yet this session. The real check is to trigger a **fresh** sync and watch it complete: click "Backup to Drive now" (Data & Settings) and confirm the indicator briefly reads "Syncing to Drive…" then updates to "Last synced to Drive: just now" — not "Drive sync failed — retry". That is the one signal that reflects the backend's *current* state rather than a cached one.

---

## What NOT to build (Version 1 scope boundary)

- Behaviour tracking
- Parent communication
- A dedicated attendance-tracking system (the Daily Wizard's present/absent step only scopes who gets logged that session — it is not a standalone attendance feature with its own history/reporting)
- Free-text/narrative report writing (the existing "Student Report" print/export is a structured mastery summary — badges and counts — not authored commentary)
- Community IC bank (data model supports it — UI does not)
- Any feature that bypasses ICs

---

## Data constraints

- Max 1–3 ICs per lesson (enforced at UI level)
- IC count per descriptor: 6–10 for knowledge descriptors, 3–6 for skill descriptors
- Mastery score only displayed when ≥ 80% of system default ICs have been taught
- Mastery history must never be collapsed to a single current status — trajectory must be preserved

---

## Testing

- Automated: `node tests/planner-scheduling.test.js` runs a headless Node `vm`-based suite against the real `app.js` functions (Weekly Planner/Unit Plans scheduling, IC-linking, panel scroll/layout). Run it before considering any change in that area done, and add regression tests for new bugs/features there — including at least one test confirmed to fail against the pre-fix code where practical.
- Manual: open the GitHub Pages URL in a browser. Hard refresh (Ctrl+Shift+R) after changes to avoid cache issues. For layout/CSS changes, verify in an actual browser (not just the test suite, which stubs the DOM and can't render real layout) — a headless browser's default scrollbar rendering can also hide width-related regressions; a real or headed browser session may be needed.

---

## Task discipline

- Read the relevant `docs/` files before implementing — but verify against `app.js` before treating anything as already built or still missing
- One change at a time — do not refactor unrelated code
- Flag schema conflicts rather than resolving them silently
- Do not change CSV or data file structure without explicit instruction
