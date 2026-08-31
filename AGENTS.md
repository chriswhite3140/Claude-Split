# AGENTS.md

## Project overview
This project is a static web app for teachers using:
- `index.html`
- `styles.css`
- `app.js`

It loads curriculum reference data from CSV files and uses a Google Apps Script backend.

The app is used by teachers in real classroom workflows, so usability, clarity, and readability are important.

---

## General rules for changes
- Keep the app simple and maintainable.
- Do not break existing workflows unless explicitly asked.
- Do not change backend or API behavior unless necessary for the requested feature.
- Do not change CSV structure unless explicitly asked.
- Preserve GitHub Pages functionality.
- Keep teacher-facing language clear, practical, and easy to scan.

---

## UI and UX rules
- Any new feature must include a clear and visible UI entry point.
- It must be obvious where the teacher clicks to use the feature.
- Do not add clutter to the sidebar.
- Prefer putting settings and tools inside the relevant main page content area rather than stacking controls in the sidebar.
- Keep layout consistent with the current app style.
- Use expandable sections when a settings page becomes too dense.
- Maintain readability over visual novelty.

---

## Versioning rules
- Every user-facing change must increment `APP_VERSION`.
- The displayed version must always read from `APP_VERSION`.
- Do not hardcode visible version text in multiple places.

---

## Theme and styling rules
- Use semantic theme tokens only.
- Do not introduce hardcoded layout colours when theme tokens should be used.
- Maintain consistency across light and dark themes.
- Light theme and dark theme should use the same semantic colour roles.
- Avoid patchy styling by ensuring all surfaces use the token system consistently.

### Required semantic styling principles
- Use theme variables for:
  - page background
  - card/panel backgrounds
  - secondary surfaces
  - borders
  - text
  - muted text
  - status colours
- For coloured statuses, chips, badges, and labels, use:
  - text colour
  - background tint
  - border colour

---

## Readability rules
- Readability is a priority.
- Avoid text that is too small, especially in dense tables and dark mode.
- Prefer slightly larger, clearer text over overly compact layouts.
- Dense tables must remain usable, but should still be comfortable to scan.
- Sticky columns, headers, labels, and helper text must remain readable.

---

## Table and dense-view rules
When editing dense views such as:
- Class Overview
- Bulk Assess
- Coverage Gaps
- Standards Judgments
- Progression Placement

Always preserve:
- sticky student columns
- scanability
- readable header hierarchy
- practical spacing and row density

Do not make dense tables look oversized, but do not compress them to the point of strain.

---

## Settings page rules
- Keep the sidebar navigation-focused.
- Put controls such as Theme, CSV Uploads, and similar tools inside the main Data & Settings page.
- Major Data & Settings sections should use a consistent accordion pattern where appropriate.
- Default settings sections to collapsed unless there is a strong reason not to.

---

## Workflow rules
- Prefer building teacher workflow from actual classroom use:
  - plan
  - teach
  - assess
  - review
- If AI or code suggestion is used, the teacher must confirm before data is committed.
- Suggestions should assist the teacher, not replace teacher judgment.

---

## Verification requirements
Before completing a task:
- confirm where the feature appears in the UI
- confirm how the teacher uses it
- confirm existing workflows still work
- confirm version number has been updated
- confirm no hardcoded colours were introduced where theme tokens should be used

If a feature is user-facing, explain exactly how to test it.

---

## Preferred change style
- Small, focused, safe updates are preferred over large rewrites.
- Build new systems first, then do refinement in a second pass.
- For UI work, prioritize clarity, consistency, readability, and teacher usability.

---

## Project context and data model

ClassTracker tracks Australian Curriculum v9 (P-6) student progress. Everything
in the app flows through Instructional Components (ICs):

Curriculum descriptor -> ICs -> Lessons -> Mastery -> Progress -> Next teaching decision

No feature should bypass ICs. If a proposed feature does not connect to ICs, it
is out of scope, flag this rather than building it.

---

## Design docs - read before touching related areas

The `docs/` folder describes product intent and data schema. Some of these
documents go stale relative to what's actually built, when in doubt about
whether something already exists, check `app.js` directly rather than trusting
a doc.

| File | Purpose |
|---|---|
| `docs/MASTER-PROJECT-SUMMARY.md` | Product overview, core workflow |
| `docs/PRODUCT-RULES-DOCUMENT.md` | Enforcement rules, check before every feature |
| `docs/DATA-SCHEMA-DOCUMENT.md` | Data structures and relationships |
| `docs/IC-FRAMEWORK-SPEC.md` | IC generation rules, ownership, mastery calculation |
| `docs/WEEKLY-PLANNER-SPEC.md` | Weekly Planner UI and interaction spec |

If a proposed change conflicts with the data model or enforcement rules in
these documents, do not proceed, flag the conflict instead.

---

## Known bug pattern - Apps Script header lookups

`updateProgress` previously returned `{success:true}` while silently changing
nothing, because its column lookups (`headers.indexOf("mastery")`, etc.)
assumed short header names that didn't match the live sheet's actual headers
(`mastery_level`, `date_assessed`, etc.). A mismatched `indexOf` returns `-1`
and the write for that field is skipped with no error surfaced anywhere.

This was confirmed fixed, and `updateStandardsJudgment`/`updateProgressionPlacement`
were checked against verified live sheet headers on 26/08/2026 and found to have
no equivalent mismatch (see `docs/SHEET-SCHEMA.md`, added same date). If working
in or near these functions, check the target sheet's actual header row text
before assuming a lookup is correct.

---

## PR description requirements

Every PR description must state:
- Exactly which files and functions were changed
- What the change does, in plain terms a reviewer working from GitHub alone
  can verify against the original spec
- Any known side effects, incomplete parts, or follow-up work needed, stated
  explicitly rather than only describing the happy path