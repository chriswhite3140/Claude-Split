# CLASS TRACKER – MASTER PROJECT SUMMARY

**Version:** 2.0  
**Status:** Active — replaces v1.0  
**Last updated:** May 2026  
**Changes from v1.0:** IC governance model fully rewritten to reflect ownership tiers, cross-descriptor sharing, AI quality assessment, and mastery validity threshold. Mastery trajectory rule added. IC count constraints updated by descriptor type. AI role expanded to cover IC generation and quality assessment. Hard constraints updated. References to IC Framework Spec v0.1 and Data Schema v2.0 added.

-----

## 1. Product Definition

**Purpose**

A teacher-facing web app that helps teachers:

- plan learning using Instructional Components (ICs)
- record what has been taught
- capture lightweight mastery evidence
- identify what to teach next

The system connects curriculum → teaching → mastery → next decisions.

**Core Positioning**

- Primary interaction: planning (daily use)
- Strategic outcome: understanding student progress toward achievement standards
- Mastery is captured through teaching workflow, not separate assessment systems

**What the Product Is**

- Planning tool
- Instructional decision support tool
- Lightweight mastery tracking system

**What the Product Is NOT (Version 1 Scope Boundary)**

- Behaviour tracking
- Parent communication
- Attendance system (no separate module)
- Full report-writing system
- Large resource management platform
- Community IC bank (deferred — data model supports it, UI does not)

-----

## 2. Core System Model

**Backbone Flow**

Curriculum → ICs → Lessons → Mastery → Progress → Next Teaching Decision

**Key Unit**

Instructional Components (ICs)

All systems must connect through ICs:

- Planning uses ICs
- Lessons link to ICs
- Mastery is recorded against ICs
- Progress is calculated from ICs

No feature should bypass ICs.

-----

## 3. Core Workflow (Non-Negotiable)

1. Select ICs
1. Create lesson
1. Attach 1–3 ICs
1. Mark lesson as taught
1. Update mastery quickly
1. View weak or untaught ICs
1. Plan next lesson based on that

If this loop is not fast and smooth, the product fails.

-----

## 4. Data Reality

- Data will be partial, uneven, and approximate
- Teachers may skip updates
- System must still function and remain useful

No logic should assume perfect data.

-----

## 5. Mastery Model

**Status Levels**

- Not Yet
- Developing
- Secure
- Absent (optional during mastery entry only)

**Rules**

- No percentages displayed to teachers
- No scores
- No complex rubrics
- Mastery is teacher judgement
- AI does not auto-assign mastery

**Mastery Trajectory**

Progress views must show mastery trajectory over time, not just current state. A student may show partial mastery in Term 1 and consolidation in Term 2 — both are meaningful and must be preserved. The system must not collapse mastery history to a single current status.

-----

## 6. Mastery Validity Threshold

A descriptor mastery score is only displayed when ≥ 80% of system default ICs for that descriptor have been taught.

Below this threshold, the system displays a coverage warning instead of a mastery score.

**What counts toward the 80% threshold:**

- System default ICs taught
- Teacher copies of default ICs taught
- Teacher original ICs confirmed as equivalent to a default IC (via AI suggestion + teacher confirmation) and taught

**What does NOT count:**

- Teacher original ICs with no confirmed default equivalency (these still contribute to the mastery numerator but not the validity threshold)

-----

## 7. Aggregation Model

- Descriptor progress is derived from IC mastery patterns
- Use loose pattern-based aggregation, not strict thresholds

**Example Logic**

- Emerging → mostly Not Yet or no evidence
- Developing → mixed evidence
- Competent → mostly Secure
- Highly Competent → consistent Secure

Avoid fake precision.

-----

## 8. IC Governance

### IC count by descriptor type

|Descriptor type             |Valid IC count|
|----------------------------|--------------|
|Knowledge/content descriptor|6–10 ICs      |
|Process/skill descriptor    |3–6 ICs       |

The app enforces the appropriate range based on `descriptorType` on `ContentDescriptor`. HASS skills descriptors (code pattern `AC9HS[Y]S[n]`) are `"skill"` type. All others default to `"knowledge"`.

### IC ownership tiers

|Tier              |Created by                   |Teacher can edit|Affected by system updates|
|------------------|-----------------------------|----------------|--------------------------|
|System default    |Developer (approved)         |No              |N/A                       |
|Teacher copy      |Teacher (copied from default)|Yes             |No — independent          |
|Teacher original  |Teacher (from scratch)       |Yes             |No                        |
|Community (future)|Any teacher                  |Own only        |No                        |

**Key rules:**

- System defaults are never editable by teachers
- Teachers can copy any system default and edit freely
- Teachers can suppress a system default from their view — it is never deleted
- When system defaults are updated, teacher copies and originals are never affected
- Future: teachers can suggest improvements to defaults — developer approves before any default is modified

### Cross-descriptor IC sharing

- ICs are not automatically shared across descriptors
- System surfaces potentially relevant ICs from other descriptors as suggestions only
- Teacher must explicitly assign a suggested IC to activate it — this is the pedagogical safeguard
- Once assigned, mastery credit applies to all linked descriptors
- Data model: IC ↔ descriptor is many-to-many (`homeDescriptorId` + `linkedDescriptorIds`)

### AI quality assessment of teacher-created ICs

When a teacher creates a teacher-original IC, the system runs AI assessment (advisory only):

- Relevance to descriptor
- Discreteness (single skill, not bundled)
- Difficulty placement suggestion
- Overlap with existing default ICs
- Default equivalency suggestion (teacher confirms with one tap — counts toward threshold)

Teacher can override all flags and save regardless.

-----

## 9. Definition of “Taught”

An IC is considered taught when:

- The teacher marks the lesson as taught

Not when:

- It is scheduled
- Mastery is recorded

-----

## 10. Planning System Design

**Structure Direction**

Hybrid planner:

- Visual grid with time/period anchors
- Lesson cards placed flexibly
- Lessons are NOT forced into rigid slots
- Breaks and specialist times act as visual guides
- Lessons can move, overlap slightly, and shift easily

**Planning Rules**

- Max 1–3 ICs per lesson
- A single lesson may link to ICs from multiple content descriptors (expected and normal in Science and HASS)
- Lessons must be movable across days and weeks
- Unfinished lessons must be easy to reschedule
- Planning must be faster than Word or paper

-----

## 11. Home Screen

Default landing screen: **Weekly Planner**

Reason: aligns with daily teacher behaviour; supports planning-first model.

-----

## 12. Subject Scope (Version 1)

Build for two subjects (e.g. English and Maths).

Reason: validates cross-subject flexibility without overgeneralising too early.

-----

## 13. AI Role (Version 1)

**AI is allowed to:**

- Generate IC drafts for system defaults (developer-approved before activation)
- Assess teacher-created ICs for quality (advisory only)
- Suggest default IC equivalencies for teacher originals
- Suggest assessment tasks
- Suggest next ICs to teach
- Flag likely mastery thresholds for teacher review

**AI is NOT allowed to:**

- Auto-judge student mastery
- Override teacher decisions
- Control aggregation logic
- Activate system default ICs without developer approval

Teacher remains the decision-maker. Developer approves all system defaults.

-----

## 14. Hard Constraints

- ICs are the shared unit across all modules
- No lesson without ICs in final workflow
- Mastery entry must be fast
- System must tolerate incomplete data
- Progress must drive next teaching decisions
- Max 1–3 ICs per lesson
- IC count per descriptor enforced by descriptor type (6–10 knowledge, 3–6 skill)
- No required long text fields
- No heavy assessment workflows
- No duplicate data entry across features
- Mastery validity threshold must be checked before displaying any mastery score
- Mastery history must never be collapsed to a single current status

-----

## 15. Usability Targets

- Create basic lesson in ≤ 60 seconds
- Update mastery quickly for a class
- Plan a rough week quickly
- Identify gaps in ≤ 5 minutes

-----

## 16. Core Data Objects

Minimum required:

- `ContentDescriptor` (includes `descriptorType: "knowledge" | "skill"`)
- `AchievementStandard`
- `InstructionalComponent` (includes `homeDescriptorId`, `linkedDescriptorIds`, `ownerTier`, `copiedFromId`, `equivalentToId`, `aiQualityFlags`)
- `Plan`
- `SequenceBlock`
- `Lesson`
- `Student`
- `ClassGroup`
- `MasteryRecord`
- `AssessmentTask`
- `ICImprovementSuggestion` (stub — future)

All relationships connect through ICs. IC ↔ descriptor is many-to-many.

Full schema: see `docs/DATA-SCHEMA-DOCUMENT.md` (v2.0).

-----

## 17. Core Modules

1. Curriculum Module
1. IC Module
1. Planning Module
- Long-term
- Weekly
- Lesson
1. Assessment Module
- Pre
- In-flow
- Summary
1. Progress Module
1. Aggregation Module
1. Recommendation Layer
1. Support Module

-----

## 18. Build Strategy

**Phase 1 — Foundation**

- Curriculum data
- IC structure (system defaults, ownership tiers)
- Student/class setup

**Phase 2 — Core Loop (MOST IMPORTANT)**

- Weekly planner
- Lesson creation
- IC selection
- Mark lesson taught
- Quick mastery entry
- Basic IC progress view with trajectory

**Phase 3 — Coherence**

- Long-term planning
- Gap detection
- Student progress view with trajectory
- Descriptor aggregation with validity threshold

**Phase 4 — Full Learning Loop**

- Pre-assessment
- Summary assessment
- AI IC generation (developer-approved system defaults)
- AI quality assessment of teacher-created ICs
- AI suggestions for next teaching

**Phase 5 — Refinement**

- Usability improvements
- Smarter recommendations
- Performance optimisation
- Community IC bank (if scale justifies)

-----

## 19. Reference Documents

|Document              |Location                        |Version|Purpose                                            |
|----------------------|--------------------------------|-------|---------------------------------------------------|
|Master Project Summary|`docs/MASTER-PROJECT-SUMMARY.md`|v2.0   |This document — paste into every new AI session    |
|Product Rules         |`docs/PRODUCT-RULES-DOCUMENT.md`|v2.0   |Enforcement layer — check before every feature     |
|Data Schema           |`docs/DATA-SCHEMA-DOCUMENT.md`  |v2.0   |Technical source of truth for all data structures  |
|IC Framework Spec     |`docs/IC-FRAMEWORK-SPEC.md`     |v0.1   |IC generation rules, ownership, mastery calculation|
|Weekly Planner Spec   |`docs/WEEKLY-PLANNER-SPEC.md`   |current|Planner UI and interaction spec                    |

-----

## 20. Success Criteria

The product succeeds if:

- A teacher can plan a working week quickly
- A teacher can identify key learning gaps in under 5 minutes
- Planning, teaching, and mastery tracking happen in one workflow
- Mastery data shows meaningful trajectory over time, not just a snapshot
- Teachers do not feel like they are doing extra admin

-----

## 21. Core Design Principle

Planning drives usage.

Mastery is captured through use.

Progress informs next action.

-----

## Final Summary

This product is not a traditional planner or assessment tool.

It is a closed-loop system that:

- Turns curriculum into teachable steps (ICs)
- Embeds those steps into lessons
- Captures evidence during teaching
- Uses that evidence to guide what happens next

If any part of the system breaks that loop, the product fails.
