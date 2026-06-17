# CLASS TRACKER – ARCHITECTURE ASSESSMENT

**Date:** 2026-06-17
**Status:** Active — architectural decision record (analysis only, no code changes)
**Basis:** Review of `app.js` at v1.12.68 (9,111 lines), all `docs/` specs, `data/` CSVs, and the Google Apps Script backend contract as called from the frontend.
**Question assessed:** Does the codebase support the core journey `Unit Plan → Weekly Schedule → Daily Teaching → Student Outcomes → Coverage Tracking`, and should we restructure the existing build or start fresh?

---

## 0. The real picture, up front

The foundations are stronger than the planning layer suggests, and the journey described above is **not a pivot — it is the system's own documented design**. The gap between where the build is and where it needs to be is not vision, and it is not the hard parts (ICs, mastery, coverage). It is two specific, fixable things:

1. **A fragmented planning layer that does not touch ICs.** There are three competing planning surfaces, and the "lessons" they create are title-and-subject cards with no IC links — a direct violation of the core rule "no lesson without ICs."
2. **No connective tissue between planning and teaching.** The Daily Wizard does not read what was planned, and outcomes do not flow back to lessons.

**Verdict: restructure the app; rebuild the planning module to spec. Do not start fresh.** Starting over would discard the two assets that are hardest to build and are already correct — the IC governance model and the recording/mastery/coverage engine.

---

## 1. The model is already the spec

The "new mental model" — `Unit Plan → Weekly Schedule → Daily Teaching → Student Outcomes → Coverage` — is already written down as the intended architecture:

- `MASTER-PROJECT-SUMMARY.md` §2 backbone: *Curriculum → ICs → Lessons → Mastery → Progress → Next Teaching Decision.*
- `DATA-SCHEMA-DOCUMENT.md` defines the exact chain: `Plan{type:"term"|"unit"|"sequence"}` → `SequenceBlock` → `Lesson{weekKey, linkedICIds, status}` → `MasteryRecord{lessonId}` → derived coverage.

This is not a new architecture to design. It is execution that has drifted from the spec and now needs to be pulled back to it. (Drift signal: the spec names the Weekly Planner as the home screen; the app boots to `dashboard` — `app.js:260`.)

---

## 2. Current implementation reality

### 2.1 Storage split (most important backend fact)

| Layer | Where it lives | Implication |
|---|---|---|
| Students, Progress, TaughtLog, TaughtICs, StandardsJudgments, ProgressionPlacements | **Google Sheets** (via Apps Script) | Synced, backed up server-side |
| `lessonPlans`, `weeklyPlanner`, `planLog`, `components`, `componentProgress` | **localStorage only** (`app.js:66, 7536, 8158`) | Per-device, no backup, lost on cache clear, cannot join to Sheets data |

The entire planning layer is local-only; the entire teaching/mastery layer is in Sheets. The feedback loop the new model needs ("outcomes feed back to the unit plan") currently crosses a boundary that does not connect.

### 2.2 Three planning surfaces

- `renderPlanner` — lesson-card board, Unscheduled + Mon–Fri (`app.js:936`)
- `renderWeeklyPlanner` — calendar blocks with rollover (`app.js:8771`)
- `renderPlanLog` — code-level planning list (`app.js:7852`)

There is already a legacy redirect collapsing two of them: `if (currentView === 'plan-log' || currentView === 'weekly-planner') currentView = 'planner'` (`app.js:80`). This layer has been churned and never settled.

### 2.3 Lessons do not carry ICs

`plannerAddLesson()` creates `{id, title, shortDescription, subject, dayKey, status}` (`app.js:1120`), and `normalizeLessonPlan()` drops everything else (`app.js:1183`). There is **no `linkedICIds`**. The schema's `Lesson` (§2.6) requires it and the product rule demands it — so the current planner bypasses ICs entirely.

### 2.4 The Daily Wizard is isolated from planning

`openDailyLogWizard()` / `dlState` (`app.js:5751`, `5771`) build state from scratch each time (attendance → manual code/IC selection). The wizard never reads `lessonPlans`, `weeklyPlanner`, or `planLog`. "Pick up today's planned lessons" does not exist.

### 2.5 No lessonId on outcomes

The schema's `MasteryRecord.lessonId` (§2.9) is the join that lets outcomes point back at a lesson. In code, Progress/TaughtICs are keyed by student × code/IC + date, with **no `lessonId`**. Without it, outcomes cannot address a lesson at all.

---

## 3. What survives largely intact

These are the crown jewels — built, schema-compliant, and expensive to reproduce. Keep them.

| Asset | Where | Why it survives |
|---|---|---|
| IC taxonomy + data model | `app.js:3944+`, Y2 Maths/English CSVs in `data/` | Ownership tiers, stubs, suppression, `homeDescriptorId`/`linkedDescriptorIds` all match schema §2.3. The backbone, done right. |
| Daily Wizard recording engine | `app.js:5771–7400` | 4-step flow (attendance → codes/ICs → per-student scan with `got_it`/`needs_review` → quick mastery). This is the "Daily Teaching → Student Outcomes" leg, already working. |
| Mastery + coverage logic | 80% gate `app.js:7237`; strand-history dots; `renderCoverage`; class IC tree | The "Student Outcomes → Coverage" tail already works and respects the validity threshold. |
| Curriculum data layer | CSV auto-fetch, `buildDescriptorIndex`, descriptorType typing | Solid, no changes needed. |
| Sheets backend (teaching half) | Students, Progress, TaughtLog, TaughtICs + batch-save patterns | Reliable; reusable as-is. |
| Adjacent assessment tools | Bulk Assess, Standards Judgments, Progression Placement | Independent; unaffected. |

---

## 4. What needs restructuring

**The planning layer is where the work is.**

- **Collapse three surfaces into one** Weekly Planner that matches `WEEKLY-PLANNER-SPEC.md`. Retire `plan-log` and the board/calendar duplication.
- **Extend the lesson object** from `{title, subject, dayKey, status}` to the real `Lesson` schema: add `linkedICIds`, `linkedDescriptorIds`, `weekKey`, `classGroupId`, `position`. Migrate existing localStorage lessons.

**Connective tissue (restructuring existing flows, not new infrastructure):**

- **Wizard input:** seed `dlState` from today's planned lessons (their codes/ICs) instead of from a blank slate. The wizard already accepts a `selectedICs`/`selectedCodes` set, so this is a seeding change.
- **Wizard write-back:** when a lesson's ICs are taught, flip `lesson.status → taught` and surface a reteach signal.

---

## 5. What needs building from scratch

Only the top of the journey is genuinely unbuilt:

- **Unit Plan layer** (`Plan{type:"unit"}` + `SequenceBlock`, schema §2.4–2.5). No `state.plans`, no render, no storage. Fully specced, never implemented.
- **"Drag a lesson from the unit plan into the week"** interaction.
- **"Pending reteach"** as a surfaced state — and note the spec deliberately limits lesson status to `planned`/`taught` (`WEEKLY-PLANNER-SPEC.md` §25), so reteach should be a **derived signal** from weak outcomes, not a third stored status.

---

## 6. Backend: can Google Sheets support this model?

**Yes, comfortably, at this scale (one teacher / one class).** Sheets is not the bottleneck and does not need replacing. Two specific changes are required:

1. **Add `lessonId` to outcome writes** (TaughtICs / Progress). This is the join key that makes "outcomes feed back to lessons" possible. It does not exist today.
2. **Move planning out of localStorage** into Sheets — add `Plans`, `SequenceBlocks`, and `Lessons` tabs so planning and outcomes share a store. The existing batch-save pattern extends naturally.

The real backend gap is not capacity; it is that the schema's relationships (lessonId on mastery, plan/sequence/lesson ids) were never persisted.

---

## 7. Restructure vs. start fresh — verdict and caveat

**Restructure.** A rewrite re-pays the cost of the two hardest, already-correct pieces (IC governance, recording/mastery/coverage) for no architectural gain. What is actually wrong is localised: one churned, IC-less planning module and two missing join keys.

**Honest caveat:** the *planning module specifically* is worth rebuilding cleanly to `WEEKLY-PLANNER-SPEC.md` rather than salvaging the three half-surfaces. "Rebuild the planner module" ≠ "rebuild the app." Hold that distinction so it does not become an excuse to start over.

---

## 8. Forced sequencing (the critical path)

The dependency order is fixed by what unblocks what. Doing the Unit Plan first is the trap — it would sit on top of an unresolved week.

1. **Pick the one canonical planner**, retire the other two, and add `linkedICIds` to the lesson object → lessons become IC-compliant.
2. **Add `lessonId` to outcome writes + persist lessons to Sheets** → the feedback loop becomes possible at all.
3. **Wire wizard ↔ lessons** (input + write-back) → the daily loop closes.
4. **Then build the Unit Plan layer** on top of a now-working week.

The risk here is scope discipline, not technical difficulty. `FIRST-BUILD-SLICE.md` mandates proving the loop with *one* planner; there are currently three. Consolidate before adding a fourth concept.

---

## Appendix — key evidence (file:line)

| Finding | Reference |
|---|---|
| App boots to `dashboard`, not Weekly Planner | `app.js:260` |
| Three planning views registered | `app.js:71`, `936`, `7852`, `8771` |
| Legacy redirect collapsing plan-log/weekly-planner | `app.js:80` |
| Lesson object has no ICs (create / normalize) | `app.js:1120`, `1183` |
| Planning persists to localStorage only | `app.js:66`, `7536`, `8158` |
| Daily Wizard state built from scratch | `app.js:5751`, `5771` |
| 80% mastery validity gate | `app.js:7237` |
| IC model (ownership tiers, stubs, linked descriptors) | `app.js:3944+` |
