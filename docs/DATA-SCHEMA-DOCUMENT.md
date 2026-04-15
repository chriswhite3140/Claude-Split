Below is your **Schema Document**. This is the technical source of truth for all data structures, relationships, and constraints. Use this for development and AI prompting.

---

# CLASS TRACKER – DATA SCHEMA DOCUMENT

## 1. Schema Principles

- **IC-centric model**: all core relationships flow through InstructionalComponent
- **Loose data tolerance**: fields may be null where appropriate
- **Minimal required fields**: only enforce what is necessary for core loop
- **No duplicate truth sources**: aggregation derives from base data only
- **Single time field per lesson**: `date` is canonical; week and day are derived
- **Subject is derived from ICs**, not stored on lessons
- **Single mastery vocabulary**: Emerging / Developing / Consolidating / Mastery at every level

---

# 2. Core Entities

---

## 2.1 ContentDescriptor

```json
ContentDescriptor {
  id: string,
  code: string,
  subject: string,
  yearLevel: string,
  strand: string,
  subStrand: string | null,
  description: string,
  elaborations: string[],
  linkedAchievementStandardIds: string[]
}
```

### Notes

- Source of curriculum intent
- Loaded from the curriculum CSVs in the repo root
- Not used directly for planning decisions

---

## 2.2 AchievementStandard

```json
AchievementStandard {
  id: string,
  subject: string,
  yearLevel: string,
  aspect: string,
  statement: string,
  linkedDescriptorIds: string[]
}
```

### Notes

- Used for reporting layer (Phase 6)
- Linked via descriptors

---

## 2.3 InstructionalComponent (IC)

```json
InstructionalComponent {
  id: string,
  descriptorId: string,
  name: string,
  description: string,
  sequenceOrder: number,
  difficultyStage: "early" | "middle" | "late",
  exampleOfSuccess: string | null,
  commonError: string | null,
  checkpointTask: string | null,
  isOptional: boolean,
  isArchived: boolean,
  sourceType: "system" | "ai" | "teacher",
  localOverrideOf: string | null
}
```

### Constraints

- Max 6–12 per descriptor (enforced at app level)
- `sequenceOrder` must be unique per descriptor

### Local override model

- `localOverrideOf` references the id of a system IC that this IC replaces for the current teacher's data
- When a teacher's view lists ICs for a descriptor, for each default IC check whether a local override exists; if it does, display the override and hide the default
- Default ICs are never deleted; they can be archived by the teacher via `isArchived`
- The 6–12 limit counts the visible IC (override if present, else default), not both
- If a default IC is updated upstream, overrides remain frozen at their current content until the teacher chooses to re-accept the default

### Notes

- Core unit of system
- Everything links through IC

---

## 2.4 Plan

```json
Plan {
  id: string,
  title: string,
  type: "term" | "unit" | "sequence",
  subject: string,
  yearLevels: string[],
  descriptorIds: string[],
  plannedICIds: string[],
  sequenceBlockIds: string[]
}
```

### Notes

- `yearLevels` is an array to support composite classes

---

## 2.5 SequenceBlock

```json
SequenceBlock {
  id: string,
  planId: string,
  label: string,
  order: number,
  icIds: string[]
}
```

### Notes

- Represents loose sequencing
- Not tied to dates

---

## 2.6 Lesson

```json
Lesson {
  id: string,
  weekKey: string,
  date: string | null,
  title: string,
  linkedICIds: string[],
  notes: string | null,
  learningIntention: string | null,
  successCriteria: string | null,
  resourceIds: string[],
  status: "planned" | "taught",
  classGroupId: string,

  position: {
    bandStart: number,
    bandSpan: number
  } | null
}
```

### Constraints

- `linkedICIds` length: 1–3 (enforced at UI and storage level)
- `weekKey` is always required; format `YYYY-Www` (ISO 8601 week)
- `date` may be null for unscheduled lessons
- When `date` is non-null, the week it falls within must equal `weekKey`
- `classGroupId` required
- `day` is **derived** from `date`; not stored
- `subject` is **derived** from `linkedICIds → descriptor.subject`; not stored. Lessons spanning ICs from different subjects are treated as cross-curricular and display all relevant subjects.

### Position model

- `bandStart` and `bandSpan` are normalised values on a 0–100 scale within a day column
- This keeps layout responsive across screen sizes (no absolute pixels)
- `bandStart` is the top edge; `bandSpan` is the card height; both are floats
- Unscheduled lessons have `position = null`

### Notes

- `position` enables flexible planner layout without a rigid timetable
- The combination of `weekKey` present + `date` null is how unscheduled lessons are represented inside a specific week

---

## 2.7 Student

```json
Student {
  id: string,
  firstName: string,
  lastName: string,
  classGroupId: string,
  yearLevel: string,
  status: "active" | "inactive"
}
```

### Notes

- `yearLevel` is stored per-student to support composite classes correctly
- `status` refers to enrolment state, not attendance

---

## 2.8 ClassGroup

```json
ClassGroup {
  id: string,
  name: string,
  yearLevels: string[],
  subjectScope: string[]
}
```

### Notes

- `yearLevels` is an array; single-year classes have length 1, composite classes have length 2+
- Students within the class may have any of these year levels
- IC filtering in the lesson drawer respects the year levels present in the class

---

## 2.9 MasteryRecord

```json
MasteryRecord {
  id: string,
  studentId: string,
  instructionalComponentId: string,
  assessmentType: "pre" | "inflow" | "summary",
  status: "emerging" | "developing" | "consolidating" | "mastery",
  lessonId: string | null,
  assessmentTaskId: string | null,
  date: string,
  note: string | null
}
```

### Rules

- Either `lessonId` OR `assessmentTaskId` must exist
- Status uses the single four-term vocabulary
- A blank cell in the mastery entry UI means "no record created"; no row is written
- There is no `"absent"` status; if a student was not present, the teacher leaves the cell blank

### Revert handling

- If a lesson is reverted from taught to planned, attached MasteryRecords are **retained**
- Records keep their `lessonId` link
- Teachers are trusted to have seen real evidence when they entered mastery

### Notes

- Central evidence object
- Multiple records per IC per student allowed
- "Most recent" per student per IC is what drives both individual intervention signals and whole-class reteach signals

---

## 2.10 AssessmentTask

```json
AssessmentTask {
  id: string,
  title: string,
  type: "pre" | "summary" | "custom",
  linkedICIds: string[],
  description: string | null,
  resourceLink: string | null,
  date: string
}
```

### Constraints

- `linkedICIds` length: 1–8

---

## 2.11 Resource

```json
Resource {
  id: string,
  title: string,
  url: string,
  linkedLessonIds: string[],
  linkedICIds: string[]
}
```

### Notes

- A resource may link to multiple lessons and multiple ICs
- Either or both link arrays may be empty

---

# 3. Relationships

```
ContentDescriptor
  ↳ InstructionalComponent (1:N)

ContentDescriptor
  ↔ AchievementStandard (M:N)

InstructionalComponent
  ↳ Lesson (M:N)

InstructionalComponent
  ↳ MasteryRecord (1:N)

Lesson
  ↳ MasteryRecord (1:N)

AssessmentTask
  ↳ MasteryRecord (1:N)

Student
  ↳ MasteryRecord (1:N)

ClassGroup
  ↳ Student (1:N)
  ↳ Lesson (1:N)

Plan
  ↳ SequenceBlock (1:N)
  ↳ InstructionalComponent (M:N)
```

---

# 4. Derived Data (NOT Stored Directly)

These must be computed, not saved.

---

## 4.1 IC Status (class-level)

Derived from:

- mastery records (most recent per student)
- lesson history (for "taught" vs "not taught")

Possible states (using the single four-term vocabulary where applicable):

- `not_taught` — no lesson linked to this IC has status = taught
- `emerging` — mostly Emerging across the class's most recent records
- `developing` — mixed or mostly Developing
- `consolidating` — mostly Consolidating, some Mastery
- `mastery` — consistent Mastery across recent records
- `needs_reteach` — a flag computed on top of the above when the reteach threshold is met (see §5.5)

---

## 4.2 Descriptor Progress

Derived from:

- IC mastery patterns across the ICs that belong to the descriptor

Uses the same four-term vocabulary.

Never stored directly as authoritative data.

---

## 4.3 Student Progress

Derived from:

- mastery records grouped by IC, then rolled up to descriptor
- uses the four-term vocabulary throughout

---

## 4.4 Lesson subject

Derived from:

- `linkedICIds → IC → descriptor.subject`
- may yield a single subject or multiple (cross-curricular)

---

## 4.5 Lesson day

Derived from:

- `Lesson.date` when non-null
- unscheduled lessons (null date) have no day

---

# 5. Key Logic Rules

---

## 5.1 Taught Logic

```
IF lesson.status == "taught"
THEN all linked ICs count as introduced
```

---

## 5.2 Mastery Interpretation

- null / missing record = no recorded evidence; does not count as Emerging
- `emerging` = attempted; minimal grasp
- `developing` = inconsistent or partial grasp
- `consolidating` = mostly there; not yet independently fluent
- `mastery` = independent, confident application

---

## 5.3 Multiple Records Handling

- "Most recent per student per IC" drives IC status and reteach flagging
- Older records are retained for history and future reporting
- No automatic override of older records

---

## 5.4 Missing Data Handling

- Missing mastery ≠ failure
- Dashboards must not assume missing = Emerging
- Students with no record for an IC are excluded from the denominator of reteach calculations

---

## 5.5 Reteach Threshold Calculation

For a given IC and class:

1. For each active student in the class, find their most recent MasteryRecord for this IC.
2. Students with no record are excluded.
3. Count how many of the remaining students have `status` of `emerging` or `developing`.
4. If that count divided by the total counted students is ≥ the configured threshold (default 40%), the IC is flagged `needs_reteach`.

The threshold is stored as a per-teacher setting; default 0.40.

---

## 5.6 Per-Student Intervention Signal

A student has unfinished business on an IC when their most recent MasteryRecord for that IC has `status` of `emerging` or `developing`, regardless of class-level threshold.

---

# 6. Validation Rules

---

## IC Rules

- must have `descriptorId`
- must have `sequenceOrder`
- max count per descriptor enforced at app level
- if `localOverrideOf` is non-null, the referenced IC must exist

---

## Lesson Rules

- must have at least 1 linked IC
- max 3 linked ICs
- must belong to a `classGroup`
- must have `weekKey`
- if `date` is set, derived week must equal `weekKey`

---

## Mastery Rules

- must have `studentId`
- must have `instructionalComponentId`
- must have valid `status` from the four-term vocabulary
- must reference either a `lessonId` or an `assessmentTaskId`

---

## Assessment Rules

- must link to ICs
- summary tasks recommended ≥4 ICs (not enforced strictly)

---

# 7. Performance Considerations

- Index by:
    - `studentId`
    - `instructionalComponentId`
    - `lessonId`
    - `classGroupId`
    - `weekKey`
- Avoid heavy joins in UI
- Cache IC-to-descriptor mapping

---

# 8. Storage and Ownership (V1.5)

From V1.5 onward, every entity carries an implicit `ownerUserId` field at the storage layer, enforced by Supabase Row Level Security. Per-teacher data isolation is guaranteed at the database layer.

See `V1.5-SAAS-SHELL.md`.

---

# 9. Extensibility Notes

Future additions may include:

- attendance module (separate, not core; explicit future decision if added)
- reporting exports (Phase 6) — must be buildable on top of existing mastery records without schema rework
- intervention grouping
- AI-generated insights
- literacy and numeracy progressions integration (the CSVs in the repo root)

These must NOT change core IC relationships.

---

# Final Schema Summary

The system is built around:

```
InstructionalComponent
  ↳ Lesson
  ↳ MasteryRecord
  ↳ Progress
```

Everything else supports this structure.

If any future schema change weakens this central relationship, it should be rejected.
