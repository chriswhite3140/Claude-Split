# CLASS TRACKER – PRODUCT RULES DOCUMENT

**Version:** 2.0  
**Status:** Active — replaces v1.0  
**Last updated:** May 2026  
**Changes from v1.0:** IC count constraints updated by descriptor type; mastery validity threshold added; mastery trajectory rule added; IC ownership and cross-descriptor sharing rules added; AI quality assessment rules added; estimation IC generation rule added; minor wording updates throughout for consistency with IC Framework Spec v0.1 and Data Schema v2.0.

-----

# 1. Core System Rule

All functionality must operate through Instructional Components (ICs).

- Planning uses ICs
- Lessons link to ICs
- Mastery is recorded against ICs
- Progress is calculated from ICs

If a feature bypasses ICs, it is invalid.

-----

# 2. Primary Behaviour Rule

The system must be planning-first.

- Teachers interact daily through planning
- Mastery is captured during planning and teaching
- Assessment is not a separate heavy workflow

If the system feels like an assessment tool, it has failed.

-----

# 3. Core Workflow Rule

The following loop must always be fast and intact:

1. Select ICs
1. Create lesson
1. Attach 1–3 ICs
1. Mark lesson as taught
1. Update mastery quickly
1. View weak ICs
1. Plan next lesson

If any step becomes slow, complex, or optional to the point of being skipped, the system breaks.

-----

# 4. IC Usage Rules

**Lesson constraints**

- Every lesson must link to 1–3 ICs only

**IC count per descriptor — by descriptor type**

|Descriptor type             |Valid IC count|
|----------------------------|--------------|
|Knowledge/content descriptor|6–10 ICs      |
|Process/skill descriptor    |3–6 ICs       |

The app enforces the appropriate range based on `descriptorType` on the `ContentDescriptor` entity. A single universal range no longer applies.

**IC quality requirements**
ICs must be:

- Discrete — one student action or understanding only
- Observable — assessable within a short interaction or piece of work
- Teachable — primary focus achievable in 1–2 lessons
- Written from the student perspective (“Student can…”)

No vague, bundled, or untestable ICs allowed.

**Estimation rule**
When generating ICs for a descriptor, check whether estimation is implied by any elaboration. If so, include at least one IC for estimation as a distinct sub-skill. Estimation is frequently implied but not foregrounded in AC v9 descriptor text.

-----

# 5. IC Ownership Rules

**Ownership tiers**

|Tier              |Created by                   |Teacher can edit|Affected by system updates|
|------------------|-----------------------------|----------------|--------------------------|
|System default    |Developer (approved)         |No              |N/A                       |
|Teacher copy      |Teacher (copied from default)|Yes             |No — independent          |
|Teacher original  |Teacher (from scratch)       |Yes             |No                        |
|Community (future)|Any teacher                  |Own only        |No                        |

**Key rules**

- System defaults are never editable by teachers
- Teachers can copy any system default IC and edit their copy freely
- Teachers can suppress a system default IC from their view — it is never deleted
- When system defaults are updated, teacher copies and teacher originals are never affected
- Future: teachers can submit improvement suggestions for system default ICs — developer reviews before any default is modified

**Community IC bank**

- Deferred to future build
- Data model must support this tier from day one even if UI does not expose it

-----

# 6. IC Cross-Descriptor Sharing Rules

- ICs are not automatically shared or applied across descriptors
- The system surfaces potentially relevant ICs from other descriptors as suggestions only
- A teacher must explicitly assign a suggested IC to activate it for a new descriptor — this is a deliberate pedagogical act
- Once assigned, mastery credit applies to all descriptors the IC is linked to
- This safeguard prevents accidental mastery inflation across descriptors

Cross-descriptor IC linking is a feature, not a problem. Real curriculum content does not exist in silos. The safeguard is the explicit teacher assignment gate.

-----

# 7. AI Assessment Rules — Teacher-Created ICs

When a teacher creates a teacher-original IC, the system runs an automatic AI assessment. This assessment is advisory only — the teacher can override and save regardless.

**AI checks on teacher-created ICs:**

- Relevance — does this IC address part of the target descriptor?
- Discreteness — does it contain multiple bundled skills?
- Difficulty placement — suggested early / middle / late
- Default overlap — does it substantially duplicate an existing system default IC?
- Equivalency suggestion — which default IC does it most closely match? Teacher confirms with one tap.

**Confirmed equivalencies count toward the mastery validity threshold (Rule 8).**

AI feedback is shown inline at creation time. It is framed as suggestions, not errors.

-----

# 8. Mastery Validity Threshold Rule

A descriptor mastery score is only displayed when **≥ 80% of system default ICs** for that descriptor have been taught.

Below this threshold, the system displays a **coverage warning** instead of a mastery score:

> *“Only [n] of [total] default ICs taught for this descriptor. Mastery data may not be representative.”*

**What counts toward the 80% threshold:**

- System default ICs that have been taught ✓
- Teacher copies of default ICs that have been taught ✓
- Teacher original ICs confirmed as equivalent to a default IC (via AI suggestion + teacher confirmation) that have been taught ✓

**What does NOT count:**

- Teacher original ICs with no confirmed default equivalency

These still contribute to the mastery numerator but not to the validity threshold.

-----

# 9. Mastery Rules

**Allowed status values**

- Not Yet
- Developing
- Secure
- Absent (optional only during entry)

**Mastery constraints**

- No percentages displayed to teachers
- No scores
- No complex rubrics
- No required comments

**Entry rules**

- Mastery must be quick to enter
- Teachers can skip students
- Blank data is allowed

**Absent rule**

- Absent is optional
- Only used during mastery entry
- Not a separate attendance system
- Not required for saving

-----

# 10. Mastery Trajectory Rule

Progress views must show mastery **trajectory across time**, not just current state.

- A student’s mastery history for an IC must be visible as a sequence of records, not collapsed to a single current status
- The view must communicate whether mastery is improving, plateauing, or declining
- A student may show partial mastery in Term 1 and consolidation in Term 2 — both are meaningful and must be preserved and displayed

**This is intentional curriculum design, not a bug.** Ochre’s scope and sequence explicitly revisits descriptors across terms for spaced practice. The system must reflect this reality.

Progress views must NOT:

- Collapse all records to a single “current” status and discard history
- Show only the most recent mastery entry as the sole truth
- Assume a descriptor is “complete” once a student reaches Secure

-----

# 11. Data Reality Rule

The system must function with incomplete data.

- Missing data is normal
- Blank ≠ failure
- Blank = no evidence

No feature should assume full data coverage.

-----

# 12. Taught Rule

An IC is considered “taught” only when:

- the lesson is marked as taught

Not when:

- scheduled
- planned
- partially delivered

-----

# 13. Planning Rules

**Structure rules**

- Planner must support flexible lesson placement
- Lessons must be movable across days and weeks
- Unfinished lessons must be easily rescheduled

**Constraint rules**

- Max 1–3 ICs per lesson
- No required detailed lesson writing
- Planning must be fast

**Multiple descriptor support**

- A single lesson may link to ICs from multiple content descriptors
- This is expected and normal, particularly in Science and HASS where multiple CDs are often addressed in the same lesson
- The system must not artificially restrict a lesson to one descriptor

**Behaviour rule**
Planning must be:

- Faster than Word or paper
- Usable under interruption
- Tolerant of incomplete plans

-----

# 14. Planner UI Rules

- Visual structure may include time/period anchors
- Lesson cards must not be locked into rigid slots
- Cards must be draggable and flexible
- Planner must allow overlap and loose placement

The planner must feel fluid, not constrained.

-----

# 15. Aggregation Rules

**Descriptor progress**

- Must be derived from IC mastery patterns
- Must remain approximate

**Constraints**

- No strict percentage thresholds in Version 1
- No artificial precision
- No claims beyond available evidence

**Interpretation rule**

- Emerging = mostly Not Yet or no evidence
- Developing = mixed evidence
- Competent = mostly Secure
- Highly Competent = consistent Secure

-----

# 16. Progress and Gap Rules

Progress views must:

- Show mastery trajectory over time (see Rule 10)
- Highlight weak ICs
- Highlight untaught ICs
- Identify student gaps
- Support next teaching decisions

Progress views must NOT:

- Be purely descriptive
- Overwhelm with data
- Rely on perfect inputs
- Collapse mastery history to a single current status

-----

# 17. AI Rules

**AI is allowed to:**

- Generate IC drafts (system defaults — developer approved before activation)
- Assess teacher-created ICs for quality (advisory only)
- Suggest default IC equivalencies for teacher originals
- Suggest assessment tasks
- Suggest next ICs to teach
- Flag possible mastery thresholds for teacher review

**AI is NOT allowed to:**

- Auto-assign mastery
- Override teacher judgement
- Control aggregation logic
- Activate system default ICs without developer approval

Teacher always confirms. Developer always approves system defaults.

-----

# 18. IC Generation Readiness Rules

Not all descriptor IC sets are generated with equal confidence. Three tiers apply:

|Tier|Descriptor characteristics              |Status on generation    |Available to teachers|
|----|----------------------------------------|------------------------|---------------------|
|1   |Knowledge descriptor, rich elaborations |Pending developer review|After approval       |
|2   |Knowledge descriptor, thin elaborations |Pending developer review|After approval       |
|3   |Skills descriptor, any elaboration depth|Flagged incomplete      |Visible but marked   |

Tier 2 and Tier 3 IC sets are visible but marked as pending. Teachers can plan and teach to any descriptor regardless of IC set maturity.

-----

# 19. Scope Rules (Version 1)

The system must NOT include:

- Behaviour tracking
- Parent communication
- Full report writing
- Large resource management
- Standalone attendance system
- Community IC bank (deferred — data model supports it, UI does not)

Any attempt to add these breaks scope.

-----

# 20. Duplication Rule

No duplicate workflows allowed.

- Planning, teaching, and mastery must be one system
- No separate assessment interface that repeats work
- No entering the same information twice

-----

# 21. Speed Rules

**Required performance targets**

- Lesson creation ≤ 60 seconds
- Mastery update very fast
- Weekly planning must be quick
- Gap identification ≤ 5 minutes

If a feature slows these down, it must be simplified or removed.

-----

# 22. Failure Tolerance Rule

The system must continue to work if:

- Teacher skips mastery updates
- Teacher skips planning days
- Data is incomplete

The system must recover without penalty or confusion.

-----

# 23. Integrity Rules

- No lesson without ICs (final workflow)
- No mastery record without student + IC
- Descriptor summaries must come from ICs only
- No hidden or conflicting data sources
- Mastery validity threshold must be checked before displaying any mastery score

-----

# 24. Feature Evaluation Rule

Before building any feature, check:

1. Does it strengthen the IC → lesson → mastery loop?
1. Does it reduce teacher effort?
1. Does it avoid duplicate work?
1. Does it keep planning as the main interaction?
1. Does it work with incomplete data?
1. Does it respect the mastery validity threshold?
1. Does it show mastery as trajectory, not just current state?

If any answer is no, the feature should not be built.

-----

# 25. Design Philosophy Rule

Speed over completeness

Clarity over precision

Usefulness over compliance

-----

# Final Rule

If the system becomes:

- Heavy
- Slow
- Overly precise
- Admin-focused

It has failed, regardless of how “correct” it looks.

The product must always prioritise real classroom use over theoretical design.