# Sheet Schema Reference

Verified live Google Sheet headers, confirmed 26/08/2026 via an exported xlsx
of the actual live spreadsheet (not inferred from code).

These headers match exactly what `Code.gs`'s `update*` functions look up via
`indexOf`. No mismatch found for `updateProgress`, `updateStandardsJudgment`,
or `updateProgressionPlacement`.

**Separate, unrelated issue**: `Code.gs`'s own `getSheet()` auto-create fallback
(`headersMap`) still defines outdated short header names for the Progress sheet
(`code`, `mastery`, `date`, `notes`, `evidence`) that do NOT match this real
schema. Harmless today since all sheets already exist, but would silently
recreate the wrong headers if the Progress sheet were ever deleted and
auto-recreated. Logged separately in Notion as a low-priority fix, not
addressed here.

## Students
`student_id, first_name, last_name, year_level, date_added`

## StubICs
`icid, ownerTier, icReadinessStatus, homeDescriptorId, name, note, createdAt`

## TaughtICs
`id, date, student_id, ic_id, status, notes, lesson_id`

## StandardsJudgments
`id, student_id, standard_id, judgment, locked, date, notes, period`

## ProgressionPlacements
`id, student_id, element, sub_element, level, date, notes, ext_label, ext_value`

## Progress
`id, student_id, content_descriptor_code, mastery_level, date_assessed, teacher_notes, evidence_link`