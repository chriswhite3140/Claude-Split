# CLAUDE.md – ClassTracker Project Context

## What this project is

ClassTracker is a browser-based classroom planning and mastery tracking tool for Australian Curriculum v9 (P–6) teachers. It is built with vanilla JavaScript, HTML, and CSS. There is no build step. It runs directly in the browser via GitHub Pages.

This is the **new ClassTracker build** (`claude-split`). The old v1 app lives in `class-tracker-split` and is not under active development.

---

## Repo structure

- `index.html` — main entry point and UI shell
- `app.js` — all application logic (vanilla JS)
- `styles.css` — all styling
- `docs/` — authoritative design documents (read these before making any changes)
- `data/` — curriculum source files (CSV, XLSX)
- `.github/workflows/` — Claude Code GitHub Actions workflows

---

## Design documents — read before every task

The documents in `docs/` are authoritative. Claude Code must consult the relevant documents before implementing any feature.

| File | Purpose |
|---|---|
| `docs/MASTER-PROJECT-SUMMARY.md` | Product overview, core workflow, build strategy |
| `docs/PRODUCT-RULES-DOCUMENT.md` | Enforcement rules — check before every feature |
| `docs/DATA-SCHEMA-DOCUMENT.md` | All data structures and relationships |
| `docs/IC-FRAMEWORK-SPEC.md` | IC generation rules, ownership, mastery calculation |
| `docs/IC-GENERATION-PROMPT-TEMPLATE.md` | AI prompt template for generating system default ICs |
| `docs/WEEKLY-PLANNER-SPEC.md` | Weekly Planner UI and interaction spec (home screen) |
| `docs/FIRST-BUILD-SLICE.md` | Smallest vertical slice that proves the core loop |
| `docs/ARCHITECTURE-ASSESSMENT.md` | Current-state assessment, gaps, and forced build order |

If a proposed change conflicts with any of these documents, do not proceed. Flag the conflict in a comment on the issue instead.

---

## Core system model

Everything in ClassTracker flows through **Instructional Components (ICs)**.

```
Curriculum descriptor → ICs → Lessons → Mastery → Progress → Next teaching decision
```

No feature should bypass ICs. If a feature does not connect to ICs, it is out of scope.

---

## Backend

Google Apps Script connects to Google Sheets for data storage. The frontend communicates with it via fetch calls to a deployed Apps Script URL configured in `app.js`.

---

## Key conventions

- Vanilla JavaScript only — no frameworks, no npm, no build tools
- All logic lives in `app.js`
- All styling lives in `styles.css`
- Keep changes small and focused — one problem at a time
- Always preserve existing functionality when making changes
- Version bump `APP_VERSION` on every user-facing change
- The app is used by teachers — UI must be clear, low friction, and practical
- Use semantic theme tokens only — no hardcoded colours
- Never introduce duplicate data entry across features

---

## Current build status

`app.js` is at **v1.12.68** (~9,100 lines). This is a mature build, not a foundation-stage one. Read `docs/ARCHITECTURE-ASSESSMENT.md` for the full picture before planning new work.

### Built and working
- CSV auto-fetch + `buildDescriptorIndex()` (descriptorType typing, elaborations)
- IC data model — ownership tiers, stub/draft ICs, suppression, `homeDescriptorId`/`linkedDescriptorIds` (schema §2.3)
- Daily Wizard — attendance → codes/ICs → per-student IC scan (`got_it`/`needs_review`) → quick mastery
- Mastery + coverage — 80% validity gate, strand-history signals, coverage and class-overview views
- Sheets backend for teaching/mastery data (Students, Progress, TaughtLog, TaughtICs, StandardsJudgments, ProgressionPlacements)
- Bulk Assess, Standards Judgments, Progression Placement

### Known structural gaps (see `docs/ARCHITECTURE-ASSESSMENT.md`)
- **Three competing planning surfaces** (`planner`, `weekly-planner`, `plan-log`) — not consolidated
- **Lessons carry no ICs** — `lessonPlans` are title/subject only; violates "no lesson without ICs"
- **Planning is localStorage-only** — not synced to Sheets, cannot join to outcomes
- **Daily Wizard is isolated** — does not read planned lessons; outcomes have no `lessonId`
- **No Unit Plan / SequenceBlock layer** — specced (schema §2.4–2.5) but unbuilt

### Next build priorities (forced order — do not reorder)
1. Consolidate to one canonical Weekly Planner; add `linkedICIds` to the lesson object
2. Add `lessonId` to outcome writes + persist lessons to Sheets
3. Wire Daily Wizard ↔ lessons (seed from planned lessons; write taught status back)
4. Build the Unit Plan layer on top

Do not build the Unit Plan layer (step 4) before the planner is consolidated and IC-linked (steps 1–3). Do not build features outside this sequence without explicit instruction.

---

## What NOT to build (Version 1 scope boundary)

- Behaviour tracking
- Parent communication
- Attendance system
- Full report writing
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

Test by opening the GitHub Pages URL in a browser. Hard refresh (Ctrl+Shift+R) after changes to avoid cache issues.

---

## Task discipline

- Read the relevant `docs/` files before implementing
- One change at a time — do not refactor unrelated code
- Flag schema conflicts rather than resolving them silently
- Do not change CSV or data file structure without explicit instruction
