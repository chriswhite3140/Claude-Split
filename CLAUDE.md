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
- `apps-script/` — Google Apps Script backend source. `DriveBackup.gs` is checked into the repo for review but is **not yet deployed** — see its own header comment for the manual copy/wire/redeploy steps still required before Drive backup sync actually works
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

Planner/Unit Plan data (units + lessons) is not part of this Sheets backend — see "Known gaps" below. The frontend has code to back it up as JSON to the teacher's own Google Drive (`driveBackupSave`/`driveBackupLoad` actions, called from `app.js`'s "DRIVE BACKUP SYNC" section), but the Apps Script side of that (`apps-script/DriveBackup.gs`) is not yet deployed — see "Known gaps" below before assuming this protection is actually in effect.

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

`app.js` is at **v1.13.86** (~11,600 lines). This is a mature, actively-developed build — most of the structural gaps a June 2026 assessment identified have since been closed. Three genuine gaps remain (see below).

### Built and working
- CSV auto-fetch + `buildDescriptorIndex()` (descriptorType typing, elaborations)
- IC data model — ownership tiers (`system_default` / `teacher_original` / `teacher_stub`), draft/stub ICs with a promotion flow, suppression, `homeDescriptorId`/`linkedDescriptorIds` tethering (schema §2.3)
- **Weekly Planner** — single consolidated planning surface (the old separate "Plan & Log" and legacy Weekly Planner were retired in v1.13.0). Week-based board (Unscheduled + Mon–Fri) with drag-to-schedule; collapsible Unit-lessons rail and Lesson Drawer side panels, each with independent scroll; a lesson's `intention` field drives an IC-suggestion engine (confidence-tiered Strong/Partial/Weak, class year-level filtered, boosted toward a unit's own linked CDs, stopword-filtered token scoring); 1–3 linked ICs per lesson; resource links (label + URL, http/https-only); per-occurrence taught-status tracking for a lesson scheduled on more than one day
- **Unit Plans** — a layer above the Weekly Planner (v1.13.24+): units group lessons into a sequence (add/reorder/delete), linked curriculum descriptors with year-level defaulting, assessment notes, whole-unit/single-lesson duplicate, its own 3-column view (lesson sequence / edit-view lesson drawer / unit details) reusing the Weekly Planner's lesson-editing UI
- **Drive backup sync (frontend only — not yet live)** — `app.js` is fully wired to back up unit plans + lessons as JSON to the teacher's Google Drive (dirty-tracking, retry, a sync-status indicator), but the Apps Script backend it calls isn't deployed yet, so no actual backup happens until that manual step is done (see "Known gaps")
- **Daily Wizard** — attendance → codes/ICs (manual pick, or AI-assisted suggestion with a keyword-scorer fallback when no API key is configured) → per-student IC scan (`got_it`/`needs_review`) → conditional quick-mastery step for students at ≥80% IC coverage
- Mastery + coverage — 80% validity gate, IC skill rollup (OR-scoring across tethered/linked ICs) feeding Bulk Assess and Coverage Gaps consistently, strand-history signals, coverage heatmap and class-overview views
- Sheets backend for teaching/mastery data (Students, Progress, TaughtLog, TaughtICs, StandardsJudgments, ProgressionPlacements)
- Bulk Assess, Standards Judgments, Progression Placement
- Data & Settings admin view — assessment scale configuration, theme (light/dark/auto) and text-size preferences, CSV management, Class/Teacher Group settings (incl. year levels)
- Student mastery-summary print/export ("Student Report", single or bulk) — structured badges and achieved/developing/emerging counts per subject/strand; not free-text report authoring (see "What NOT to build")
- Automated regression test suite (`tests/planner-scheduling.test.js`, run via `node tests/planner-scheduling.test.js`) covering Weekly Planner/Unit Plans scheduling, IC-linking, and panel-scroll/layout logic — run it after any change touching those areas, and add regression tests for new bug fixes/features in that area

### Known gaps
- **The Daily Wizard is still isolated from planned lessons.** Opening it (`openDailyLogWizard()`) always starts from a blank slate — it never reads `state.lessonPlans`. Outcome records (`TaughtLog`, `TaughtICs`, `Progress`) still carry no `lessonId`. There is no way to see what was actually logged against a specific planned lesson, or to seed a day's log from what was planned for it.
- **Planning data (units + lessons) is still localStorage-first, not Sheets-backed.** The Drive JSON backup (above) is meant as a safety net against data loss, not a substitute — it's not queryable, and outcome data still can't be joined to it (a consequence of the `lessonId` gap above).
- **The Drive backup's Apps Script side isn't deployed, so the safety net above isn't actually in effect yet.** `apps-script/DriveBackup.gs` is checked into the repo but, per its own header, still has to be manually copied into the live Apps Script project, wired into `doPost`, and redeployed. Until then, every `driveBackupSave`/`driveBackupLoad` call fails — handled gracefully in the UI (a "Drive sync failed — retry" indicator, see `driveSyncIndicatorHtml()`), but a teacher clearing their browser cache or losing their device today loses their planning data with no real backup to fall back on, despite the UI suggesting sync is happening.

There is no prescribed order for closing these — scope and sequence any work on them per the specific task at hand, verifying against `app.js`/`apps-script/` first rather than assuming any gap's status.

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
