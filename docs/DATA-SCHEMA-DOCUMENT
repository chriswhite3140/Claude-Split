Below is your **Schema Document**. This is the technical source of truth for all data structures, relationships, and constraints. Use this for development and AI prompting.

---

# CLASS TRACKER – DATA SCHEMA DOCUMENT

## 1. Schema Principles

- **IC-centric model**: all core relationships flow through InstructionalComponent
- **Loose data tolerance**: fields may be null where appropriate
- **Minimal required fields**: only enforce what is necessary for core loop
- **No duplicate truth sources**: aggregation derives from base data only

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

- Used for reporting layer only
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
- sequenceOrder must be unique per descriptor

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
  yearLevel: string,
  descriptorIds: string[],
  plannedICIds: string[],
  sequenceBlockIds: string[]
}
```

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
  day: "mon" | "tue" | "wed" | "thu" | "fri" | null,
  title: string,
  subject: string,
  linkedICIds: string[],
  linkedDescriptorIds: string[],
  notes: string | null,
  learningIntention: string | null,
  successCriteria: string | null,
  resourceIds: string[],
  status: "planned" | "taught",
  classGroupId: string,

  position: {
    x: number,
    y: number,
    width: number,
    height: number
  } | null
}
```

### Constraints

- linkedICIds length: 1–3 (enforced at UI level)

### Notes

- position enables flexible planner layout
- date is optional to allow unscheduled lessons

---

## 2.7 Student

```json
Student {
  id: string,
  firstName: string,
  lastName: string,
  classGroupId: string,
  status: "active" | "inactive"
}
```

---

## 2.8 ClassGroup

```json
ClassGroup {
  id: string,
  name: string,
  yearLevel: string,
  subjectScope: string[]
}
```

---

## 2.9 MasteryRecord

```json
MasteryRecord {
  id: string,
  studentId: string,
  instructionalComponentId: string,
  assessmentType: "pre" | "inflow" | "summary",
  status: "not_yet" | "developing" | "secure" | "absent",
  lessonId: string | null,
  assessmentTaskId: string | null,
  date: string,
  note: string | null
}
```

### Rules

- Either lessonId OR assessmentTaskId must exist
- status = "absent" is optional and not required

### Notes

- Central evidence object
- Multiple records per IC per student allowed

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

- linkedICIds length: 1–8

---

## 2.11 Resource

```json
Resource {
  id: string,
  title: string,
  url: string,
  linkedLessonId: string | null
}
```

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

## 4.1 IC Status

Derived from:

- mastery records
- lesson history

Possible states:

- not taught
- introduced
- weak
- secure

---

## 4.2 Descriptor Progress

Derived from:

- IC mastery patterns

Never stored directly as authoritative data.

---

## 4.3 Student Progress

Derived from:

- mastery records grouped by IC

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

- "absent" = no learning opportunity
- null / missing = no recorded evidence
- "not_yet" = attempted but not achieved

---

## 5.3 Multiple Records Handling

- latest record does not automatically override all previous
- system should consider patterns, not single entries

---

## 5.4 Missing Data Handling

- missing mastery ≠ failure
- dashboards must not assume missing = not_yet

---

# 6. Validation Rules

---

## IC Rules

- must have descriptorId
- must have sequenceOrder
- max count per descriptor enforced externally

---

## Lesson Rules

- must have at least 1 IC
- max 3 ICs
- must belong to a classGroup

---

## Mastery Rules

- must have studentId
- must have IC id
- must have valid status

---

## Assessment Rules

- must link to ICs
- summary tasks must have ≥4 ICs recommended (not enforced strictly)

---

# 7. Performance Considerations

- Index by:
    - studentId
    - instructionalComponentId
    - lessonId
- Avoid heavy joins in UI
- Cache IC-to-descriptor mapping

---

# 8. Extensibility Notes

Future additions may include:

- attendance module (separate, not core)
- reporting exports
- intervention grouping
- AI-generated insights

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
