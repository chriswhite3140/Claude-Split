# CLASS TRACKER – DATA SCHEMA DOCUMENT

**Version:** 2.0  
**Status:** Active — replaces v1.0  
**Last updated:** May 2026  
**Changes from v1.0:** IC ownership model rewritten; descriptorId → homeDescriptorId + linkedDescriptorIds (many-to-many); descriptorType added to ContentDescriptor; IC count constraints updated by descriptor type; mastery validity threshold added; sourceType replaced by ownerTier; AI quality flags added.

-----

## 1. Schema Principles

- **IC-centric model**: all core relationships flow through InstructionalComponent
- **Loose data tolerance**: fields may be null where appropriate
- **Minimal required fields**: only enforce what is necessary for core loop
- **No duplicate truth sources**: aggregation derives from base data only
- **Many-to-many IC ↔ descriptor**: ICs have a home descriptor and may be linked to additional descriptors by teacher action — never automatically

-----

## 2. Core Entities

-----

### 2.1 ContentDescriptor

```json
ContentDescriptor {
  id: string,
  code: string,
  subject: string,
  yearLevel: string,
  strand: string,
  subStrand: string | null,
  descriptorType: "knowledge" | "skill",
  description: string,
  elaborations: string[],
  linkedAchievementStandardIds: string[]
}
```

#### Notes

- `descriptorType` drives IC count constraints and AI generation prompt selection
- For HASS: derivable from code pattern — `AC9HS[Y]S[n]` = `"skill"`, `AC9HS[Y]K[n]` = `"knowledge"`
- For all other subjects: all descriptors are `"knowledge"` unless explicitly classified otherwise
- Source of curriculum intent — not used directly for planning decisions

#### Population rule for descriptorType

```
IF code matches pattern AC9HS{year}S{n}  →  descriptorType = "skill"
ELSE                                      →  descriptorType = "knowledge"
```

This can be auto-populated from existing CSV data via a script — no manual tagging required for the initial build.

-----

### 2.2 AchievementStandard

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

#### Notes

- Used for reporting layer only
- Linked via descriptors
- No changes from v1.0

-----

### 2.3 InstructionalComponent (IC)

```json
InstructionalComponent {
  id: string,
  homeDescriptorId: string,
  linkedDescriptorIds: string[],
  name: string,
  description: string,
  sequenceOrder: number,
  difficultyStage: "early" | "middle" | "late",
  exampleOfSuccess: string | null,
  commonError: string | null,
  checkpointTask: string | null,
  isOptional: boolean,
  isArchived: boolean,
  ownerTier: "system_default" | "teacher_copy" | "teacher_original",
  copiedFromId: string | null,
  equivalentToId: string | null,
  suppressedByTeacher: boolean,
  icReadinessStatus: "active" | "pending_review" | "incomplete",
  aiQualityFlags: {
    isRelevant: boolean,
    isDiscrete: boolean,
    suggestedDifficulty: "early" | "middle" | "late",
    overlapWarning: string | null
  } | null
}
```

#### Field notes

|Field                |Purpose                                                                                                                                                    |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
|`homeDescriptorId`   |The descriptor this IC was originally created for. Always populated. Used as the primary link for mastery validity threshold calculation.                  |
|`linkedDescriptorIds`|Additional descriptors this IC has been explicitly assigned to by a teacher. Empty array by default. Never auto-populated.                                 |
|`ownerTier`          |Replaces `sourceType` from v1.0. See ownership model in Section 5.                                                                                         |
|`copiedFromId`       |Populated when `ownerTier` is `"teacher_copy"`. Points to the system default IC it was copied from. Null otherwise.                                        |
|`equivalentToId`     |Populated when a teacher original IC has been confirmed (by teacher) as equivalent to a system default. Enables threshold counting. Null otherwise.        |
|`suppressedByTeacher`|True when a teacher has hidden a system default IC from their view. The default is never deleted — only hidden.                                            |
|`icReadinessStatus`  |`"active"` = developer-approved and available; `"pending_review"` = AI-generated but not yet approved; `"incomplete"` = AI flagged insufficient confidence.|
|`aiQualityFlags`     |Populated at creation time for `teacher_original` ICs only. Null for system defaults and teacher copies. Advisory only — does not block save.              |

#### Constraints

|Descriptor type|Max ICs per descriptor|Min ICs before mastery score displays|
|---------------|----------------------|-------------------------------------|
|`"knowledge"`  |6–10                  |≥ 80% of system defaults taught      |
|`"skill"`      |3–6                   |≥ 80% of system defaults taught      |

- `sequenceOrder` must be unique per home descriptor
- Cross-descriptor assignments do not affect sequenceOrder of the home descriptor

#### Core unit note

Everything in the system links through IC. If a feature bypasses ICs, it is invalid.

-----

### 2.4 Plan

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

No changes from v1.0.

-----

### 2.5 SequenceBlock

```json
SequenceBlock {
  id: string,
  planId: string,
  label: string,
  order: number,
  icIds: string[]
}
```

#### Notes

- Represents loose sequencing
- Not tied to dates
- No changes from v1.0

-----

### 2.6 Lesson

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

#### Constraints

- `linkedICIds` length: 1–3 (enforced at UI level)

#### Notes

- `position` enables flexible planner layout
- `date` is optional to allow unscheduled lessons
- No changes from v1.0

-----

### 2.7 Student

```json
Student {
  id: string,
  firstName: string,
  lastName: string,
  classGroupId: string,
  status: "active" | "inactive"
}
```

No changes from v1.0.

-----

### 2.8 ClassGroup

```json
ClassGroup {
  id: string,
  name: string,
  yearLevel: string,
  subjectScope: string[]
}
```

No changes from v1.0.

-----

### 2.9 MasteryRecord

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

#### Rules

- Either `lessonId` OR `assessmentTaskId` must exist
- `status = "absent"` is optional and not required
- Multiple records per IC per student are allowed — latest does not automatically override

#### Notes

- Central evidence object
- No changes from v1.0

-----

### 2.10 AssessmentTask

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

#### Constraints

- `linkedICIds` length: 1–8
- No changes from v1.0

-----

### 2.11 Resource

```json
Resource {
  id: string,
  title: string,
  url: string,
  linkedLessonId: string | null
}
```

No changes from v1.0.

-----

### 2.12 ICImprovementSuggestion (future — stub only)

```json
ICImprovementSuggestion {
  id: string,
  targetICId: string,
  submittedByClassGroupId: string,
  suggestionText: string,
  status: "pending" | "accepted" | "rejected",
  submittedDate: string,
  reviewedDate: string | null,
  reviewNotes: string | null
}
```

#### Notes

- Not built in first release — data model stubbed for future implementation
- Teachers can flag system default ICs for improvement
- Developer reviews and approves before any default is modified
- Community IC bank (teacher-submitted ICs) will extend this model when built

-----

## 3. Relationships

```
ContentDescriptor
  ↔ InstructionalComponent (M:N via homeDescriptorId + linkedDescriptorIds)

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

### Critical change from v1.0

The relationship `ContentDescriptor ↳ InstructionalComponent (1:N)` has been replaced with `ContentDescriptor ↔ InstructionalComponent (M:N)`.

An IC has one `homeDescriptorId` (its origin) and an array of `linkedDescriptorIds` (cross-descriptor assignments made by teacher action). The home descriptor is always the primary relationship. Cross-descriptor links are always explicit teacher decisions — never automatic.

-----

## 4. IC Ownership Model

### Ownership tiers

|Tier              |`ownerTier` value      |Created by                    |Teacher can edit    |Affected by system updates|
|------------------|-----------------------|------------------------------|--------------------|--------------------------|
|System default    |`"system_default"`     |Developer (approved)          |No                  |N/A                       |
|Teacher copy      |`"teacher_copy"`       |Teacher (copied from default) |Yes                 |No — independent          |
|Teacher original  |`"teacher_original"`   |Teacher (created from scratch)|Yes                 |No                        |
|Community (future)|*(not yet implemented)*|Any teacher                   |Own submissions only|No                        |

### Key ownership rules

- System defaults are **never editable** by teachers
- A teacher can copy any system default IC — `copiedFromId` is set to the source IC’s id
- A teacher can suppress a system default from their view — `suppressedByTeacher: true` — but the default is never deleted
- When system defaults are updated, teacher copies and teacher originals are **never affected**
- Teacher originals receive AI quality assessment at creation time (see Section 6)
- Teacher originals can be confirmed as equivalent to a system default — `equivalentToId` is set — enabling threshold counting

### Suppression vs deletion

Suppression hides a default IC from the teacher’s active view. The system default remains intact. If a teacher un-suppresses, the original default reappears. This is not deletion.

-----

## 5. Cross-Descriptor IC Sharing

### Rules

- ICs are **not** automatically applied across descriptors
- The system surfaces relevant ICs from other descriptors as **suggestions only**
- A teacher must explicitly assign a suggested IC to a new descriptor — this populates `linkedDescriptorIds`
- Once assigned, mastery credit applies to **all descriptors** in `homeDescriptorId` + `linkedDescriptorIds`

### Why this is a feature

Real curriculum content does not exist in silos. A student who understands zero as a placeholder (AC9M2N02) applies that understanding in addition and subtraction (AC9M2N04). Explicit cross-descriptor assignment makes these connections visible and trackable.

### The safeguard

Requiring deliberate teacher assignment prevents accidental mastery inflation. A teacher consciously decides that an IC from one descriptor is relevant to another — this is a pedagogical act, not a system assumption.

-----

## 6. AI Quality Assessment — Teacher Original ICs

When a teacher creates a `teacher_original` IC, the system runs an automatic AI assessment. This populates `aiQualityFlags`.

### What is checked

|Check                                            |Field                   |Effect if flagged                                                                     |
|-------------------------------------------------|------------------------|--------------------------------------------------------------------------------------|
|IC addresses part of the target descriptor       |`isRelevant: false`     |Warning shown to teacher                                                              |
|IC contains a single discrete skill (not bundled)|`isDiscrete: false`     |Warning shown to teacher                                                              |
|Difficulty placement relative to other ICs       |`suggestedDifficulty`   |Suggestion shown to teacher                                                           |
|Overlap with an existing system default IC       |`overlapWarning: string`|Prompts teacher to consider using/modifying default instead; suggests `equivalentToId`|

### Behaviour

- All flags are **advisory only**
- Teacher can override all flags and save the IC regardless
- If overlap is detected and teacher confirms equivalency, `equivalentToId` is populated — this IC then counts toward the 80% mastery validity threshold

-----

## 7. IC Generation Readiness — System Defaults

Not all descriptors produce IC sets with equal AI confidence. Three readiness tiers apply to system default IC sets.

|Tier|Descriptor characteristics              |`icReadinessStatus` on generation                       |Available to teachers|
|----|----------------------------------------|--------------------------------------------------------|---------------------|
|1   |Knowledge descriptor, rich elaborations |`"pending_review"` → `"active"` after developer approval|Yes, after approval  |
|2   |Knowledge descriptor, thin elaborations |`"pending_review"` → `"active"` after developer approval|Yes, after approval  |
|3   |Skills descriptor, any elaboration depth|`"incomplete"` until developer reviews                  |Visible but flagged  |

Tier 2 and Tier 3 IC sets are visible to teachers but marked as pending. Teachers can still plan lessons against any descriptor regardless of IC set maturity.

-----

## 8. Derived Data (NOT Stored Directly)

These must be computed, not saved.

### 8.1 IC Status

Derived from mastery records and lesson history.

Possible states:

- `not taught`
- `introduced`
- `weak`
- `secure`

### 8.2 Descriptor Coverage Validity

Derived from: count of taught ICs (home + equivalent teacher originals) ÷ count of system default ICs for that descriptor.

- **≥ 80%** → mastery score is displayed
- **< 80%** → coverage warning is displayed instead of mastery score

Never stored directly. Computed on render.

### 8.3 Descriptor Progress

Derived from IC mastery patterns. Never stored directly as authoritative data.

### 8.4 Student Progress

Derived from mastery records grouped by IC.

-----

## 9. Key Logic Rules

### 9.1 Taught Logic

```
IF lesson.status == "taught"
THEN all linked ICs count as introduced
```

### 9.2 Mastery Interpretation

- `"absent"` = no learning opportunity
- `null` / missing = no recorded evidence
- `"not_yet"` = attempted but not achieved

### 9.3 Multiple Records Handling

- Latest record does not automatically override all previous
- System should consider patterns, not single entries

### 9.4 Missing Data Handling

- Missing mastery ≠ failure
- Blank = no evidence
- Dashboards must not assume missing = not_yet

### 9.5 Mastery Validity Threshold

```
active_defaults = system_default ICs where suppressedByTeacher == false
                  for this descriptor

taught_defaults = active_defaults where at least one lesson.status == "taught"
                  links to this IC

equivalent_taught = teacher_original ICs where equivalentToId is set
                    AND at least one lesson.status == "taught" links to this IC

threshold_count = taught_defaults + equivalent_taught
validity_ratio  = threshold_count / count(active_defaults)

IF validity_ratio >= 0.80  →  display mastery score
ELSE                       →  display coverage warning
```

### 9.6 Cross-Descriptor Mastery Credit

```
IF a teacher assigns IC (homeDescriptorId: A) to descriptor B
THEN: when that IC is taught, mastery credit applies to BOTH descriptor A AND descriptor B
```

-----

## 10. Validation Rules

### IC Rules

- Must have `homeDescriptorId`
- Must have `sequenceOrder` (unique per home descriptor)
- `ownerTier` must be set
- `copiedFromId` required if `ownerTier == "teacher_copy"`
- IC count per descriptor enforced at app level per descriptor type constraints (Section 2.3)

### Lesson Rules

- Must have at least 1 IC
- Max 3 ICs
- Must belong to a classGroup

### Mastery Rules

- Must have `studentId`
- Must have `instructionalComponentId`
- Must have valid `status`

### Assessment Rules

- Must link to ICs
- Summary tasks: ≥ 4 ICs recommended (not enforced strictly)

-----

## 11. Performance Considerations

- Index by: `studentId`, `instructionalComponentId`, `lessonId`
- Cache IC-to-descriptor mapping (both `homeDescriptorId` and `linkedDescriptorIds`)
- Avoid heavy joins in UI
- Mastery validity threshold (Section 9.5) is computed — do not store result directly
- `descriptorType` lookup should be cached at load time — does not change at runtime

-----

## 12. Extensibility Notes

Future additions may include:

- Community IC bank (teacher-submitted ICs pending approval)
- Co-curator role for community IC review
- Improvement suggestion pathway for system default ICs (stub entity exists in Section 2.12)
- Attendance module (separate, not core)
- Reporting exports
- Intervention grouping
- AI-generated insights

**These must NOT change core IC relationships.**

-----

## 13. Known Schema Issues and Future Decisions

|#|Issue                                                                                                                                                                                  |Status                                                                                             |
|-|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
|1|Teacher originals without `equivalentToId` do not count toward the 80% threshold. A rich teacher-authored IC set may show as “insufficient coverage” even when genuinely comprehensive.|Accepted. Mitigation: AI equivalency suggestion at creation reduces friction of confirming matches.|
|2|When system defaults are updated, teachers with copies are not notified.                                                                                                               |Accepted for first build. Future: notify teacher when a default they have copied has been updated. |
|3|Community IC bank and `ICImprovementSuggestion` entity are stubbed only — UI does not expose them in first build.                                                                      |Deliberate. Data model supports them; build is deferred.                                           |
|4|`suppressedByTeacher` is per-teacher. No current mechanism to suppress a default across a school if multiple teachers use the same system.                                             |Acceptable for single-teacher first build. Revisit if multi-tenancy is added.                      |
|5|`icReadinessStatus` on ContentDescriptor IC sets is managed manually by developer during initial IC generation phase. No automated pipeline exists yet.                                |Accepted for first build.                                                                          |

-----

## 14. Final Schema Summary

The system is built around:

```
InstructionalComponent
  ↳ Lesson
  ↳ MasteryRecord
  ↳ Progress
```

Everything else supports this structure.

An IC has one home descriptor and may be explicitly linked to additional descriptors by teacher action. Mastery credit flows through all linked descriptors. The validity of a mastery score depends on sufficient coverage of system default ICs for that descriptor.

If any future schema change weakens the central IC relationship, or introduces a path to mastery that bypasses ICs, it should be rejected.
