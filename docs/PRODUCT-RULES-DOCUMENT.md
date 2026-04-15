Below is your Rules Document. This is the enforcement layer. Every feature, UI change, or AI prompt must be checked against this before implementation.

# **CLASS TRACKER – PRODUCT RULES DOCUMENT**

# **1. Core System Rule**

All functionality must operate through Instructional Components (ICs).

- Planning uses ICs
- Lessons link to ICs
- Mastery is recorded against ICs
- Progress is calculated from ICs

If a feature bypasses ICs, it is invalid.

# **2. Primary Behaviour Rule**

The system must be planning-first.

- Teachers interact daily through planning
- Mastery is captured during planning and teaching
- Assessment is not a separate heavy workflow

If the system feels like an assessment tool, it has failed.

# **3. Core Workflow Rule**

The following loop must always be fast and intact:

1. Select ICs
2. Create lesson
3. Attach 1–3 ICs
4. Mark lesson as taught
5. Update mastery quickly
6. View ICs needing reteach
7. Plan next lesson

If any step becomes slow, complex, or optional to the point of being skipped, the system breaks.

# **4. IC Usage Rules**

- Every lesson must link to 1–3 ICs only
- Each descriptor must have 6–12 ICs maximum
- ICs must be:
    - teachable in 1–2 lessons
    - observable in student work
    - assessable quickly

No vague or untestable ICs allowed.

# **5. Mastery Rules**

**Single Vocabulary (used at every level: per-student, per-IC, per-descriptor)**

- Emerging
- Developing
- Consolidating
- Mastery

These four terms are the only vocabulary used for mastery and progress anywhere in the product. Legacy terms such as "Not Yet", "Secure", "Competent", "Highly Competent", "weak", "strong" are not to appear in the UI or data model.

**Mastery Constraints**

- No percentages
- No scores
- No complex rubrics
- No required comments

**Entry Rules**

- Mastery must be quick to enter
- Teachers can skip students
- Blank data is allowed
- Blank means no evidence yet, not a low score

**No Absent value**

Attendance is not a concept in the mastery model. If a student was not present for a learning opportunity, the teacher simply leaves the cell blank.

# **6. Data Reality Rule**

The system must function with incomplete data.

- Missing data is normal
- Blank ≠ failure
- Blank = no evidence

No feature should assume full data coverage.

# **7. Taught Rule**

An IC is considered "taught" only when:

- the lesson is marked as taught

Not when:

- scheduled
- planned
- partially delivered

**Revert rule:** a teacher may revert a lesson from taught back to planned. Reverting does **not** delete attached mastery records. The teacher is trusted to have seen real evidence when they entered it.

# **8. Planning Rules**

**Structure Rules**

- Planner must support flexible lesson placement
- Lessons must be movable across days and weeks
- Unfinished lessons must be easily rescheduled

**Constraint Rules**

- Max 1–3 ICs per lesson
- No required detailed lesson writing
- Planning must be fast

**Behaviour Rule**

Planning must be:

- faster than Word or paper
- usable under interruption
- tolerant of incomplete plans

# **9. Planner UI Rules**

- Visual structure may include time/period anchors
- Lesson cards must not be locked into rigid slots
- Cards must be draggable and flexible
- Planner must allow overlap and loose placement

The planner must feel fluid, not constrained.

# **10. Aggregation Rules**

**Descriptor Progress**

- Must be derived from IC patterns
- Must remain approximate
- Must use the single four-term vocabulary (Emerging, Developing, Consolidating, Mastery)

**Constraints**

- No strict percentage thresholds for individual progress in Version 1
- No artificial precision
- No claims beyond available evidence

**Interpretation Rule**

- Emerging = mostly Emerging or no evidence
- Developing = mixed evidence with lower rungs common
- Consolidating = mostly Consolidating, some Mastery
- Mastery = consistent Mastery across recent evidence

# **11. Reteach Threshold Rule**

An IC is flagged as **needs reteach** at the whole-class level when, across the class's most recent mastery record per student for that IC:

- **≥40% of students are at Emerging or Developing**

**Rules:**

- 40% is the default and is teacher-adjustable via settings in V1.5
- This is a whole-class signal that drives "what do I teach next to the whole class?"
- It is separate from per-student intervention signals: a student has unfinished business on an IC if their most recent record is Emerging or Developing, regardless of class threshold
- Both signals are computed from the same mastery data; no extra entry burden

# **12. Progress and Gap Rules**

Progress views must:

- highlight ICs needing reteach
- highlight untaught ICs
- identify student gaps
- support next teaching decisions

Progress views must NOT:

- be purely descriptive
- overwhelm with data
- rely on perfect inputs

# **13. AI Rules**

**AI is allowed to:**

- generate IC drafts
- suggest assessment tasks
- suggest next ICs
- flag possible mastery thresholds

**AI is NOT allowed to:**

- auto-assign mastery
- override teacher judgement
- control aggregation logic

Teacher always confirms.

# **14. Scope Rules (Version 1)**

The system must NOT include:

- behaviour tracking
- parent communication
- large resource management
- standalone attendance system

**Report-writing support is a future capability (Phase 6), not V1. V1 must, however, store data in a form that makes report-writing support buildable later without schema rework.**

Any attempt to add out-of-scope modules to V1 breaks scope.

# **15. Duplication Rule**

No duplicate workflows allowed.

- Planning, teaching, and mastery must be one system
- No separate assessment interface that repeats work
- No entering the same information twice

# **16. Speed Rules**

**Required Performance Targets**

- Lesson creation ≤ 60 seconds
- Mastery update very fast
- Weekly planning must be quick
- Identifying ICs needing reteach ≤ 5 minutes

If a feature slows these down, it must be simplified or removed.

# **17. Failure Tolerance Rule**

The system must continue to work if:

- teacher skips mastery updates
- teacher skips planning days
- data is incomplete

The system must recover without penalty or confusion.

# **18. Integrity Rules**

- No lesson without ICs (final workflow)
- No mastery record without student + IC
- Descriptor summaries must come from ICs only
- No hidden or conflicting data sources
- Lesson time is represented by a single canonical field (`date`); other time references are derived

# **19. Class Model Rules**

- A class is one `ClassGroup`
- Composite classes use `yearLevels: string[]`
- Each student carries their own `yearLevel`
- IC filtering respects the year levels present in the class

# **20. Feature Evaluation Rule**

Before building any feature, check:

1. Does it strengthen the IC → lesson → mastery loop?
2. Does it reduce teacher effort?
3. Does it avoid duplicate work?
4. Does it keep planning as the main interaction?
5. Does it work with incomplete data?

If any answer is no, the feature should not be built.

# **21. Design Philosophy Rule**

Speed over completeness

Clarity over precision

Usefulness over compliance

# **Final Rule**

If the system becomes:

- heavy
- slow
- overly precise
- or admin-focused

It has failed, regardless of how "correct" it looks.

The product must always prioritise:

real classroom use over theoretical design.
