Below is your Master Project Summary. This is the single source of truth you reuse in every AI prompt and development step.

# **CLASS TRACKER – MASTER PROJECT SUMMARY**

# **1. Product Definition**

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

- planning tool
- instructional decision support tool
- lightweight mastery tracking system
- paid SaaS for Australian primary (P–6) teachers

**What the Product Is NOT (Version 1 Scope Boundary)**

- behaviour tracking
- parent communication
- attendance system (no separate module)
- large resource management platform

**Future capability (not V1, must be enabled by data model):**

- report-writing assistance. V1 is not a report writer, but V1's mastery data must be structured so a later report-writing module can be built without reworking the schema.

# **2. Commercial Model**

- publicly available, paid subscription product
- free tier: 1 class, up to 30 students, valid until end of current Australian semester (extended into the next semester if the teacher signs up with less than 3 weeks remaining in the current semester)
- paid tier: ~AU$8/month or ~AU$80/year, unlimited classes and students
- per-teacher accounts in V1.5; school-level plans deferred
- details in `V1.5-SAAS-SHELL.md`

# **3. Core System Model**

**Backbone Flow**

Curriculum → ICs → Lessons → Mastery → Progress → Next Teaching Decision

**Key Unit**

Instructional Components (ICs)

All systems must connect through ICs:

- planning uses ICs
- lessons link to ICs
- mastery is recorded against ICs
- progress is calculated from ICs

No feature should bypass ICs.

# **4. Core Workflow (Non-Negotiable)**

1. Select ICs
2. Create lesson
3. Attach 1–3 ICs
4. Mark lesson as taught
5. Update mastery quickly
6. View ICs needing reteach or untaught ICs
7. Plan next lesson based on that

If this loop is not fast and smooth, the product fails.

# **5. Data Reality**

- Data will be partial, uneven, and approximate
- Teachers may skip updates
- System must still function and remain useful

No logic should assume perfect data.

# **6. Mastery Model**

**Status Levels (single vocabulary used at every level of the system)**

- Emerging
- Developing
- Consolidating
- Mastery

These four terms are used at per-student per-IC mastery entry, at derived IC-level status, and at derived descriptor-level progress. One vocabulary, four rungs, everywhere.

**Rules**

- No percentages
- No scores
- No complex rubrics
- Mastery is teacher judgement
- AI does not auto-assign mastery
- Blank is allowed and means no evidence yet (not a low score)

# **7. Aggregation Model**

- Descriptor progress is derived from IC patterns
- IC status is derived from per-student mastery records
- Use loose pattern-based aggregation, not strict thresholds
- All derived signals use the same four-term vocabulary above

Avoid fake precision.

# **8. Reteach Threshold**

An IC is flagged as **needs reteach** when, across the class's most recent mastery record per student for that IC:

- **≥40% of students are at Emerging or Developing** (the bottom two rungs)

The 40% is the default. It is teacher-adjustable via a settings slider in V1.5.

This is a whole-class signal used to drive "what do I teach next to the whole class?" It is separate from per-student intervention signals.

# **9. IC Governance**

- Each descriptor has a default IC set
- Teachers can edit or override ICs locally
- Default ICs remain intact and visible unless explicitly archived by the teacher
- Local override model defined in `DATA-SCHEMA-DOCUMENT.md`
- IC count per descriptor: 6–12 maximum

# **10. Definition of "Taught"**

An IC is considered taught when:

- the teacher marks the lesson as taught

Not when:

- it is scheduled
- mastery is recorded

Reverting a lesson from taught to planned does **not** delete attached mastery records. Teachers are trusted to have seen evidence and made valid judgements.

# **11. Planning System Design**

**Structure Direction**

Hybrid planner:

- visual grid with time/period anchors
- lesson cards placed flexibly
- lessons are NOT forced into rigid slots
- breaks and specialist times act as visual guides
- lessons can move, overlap slightly, and shift easily

**Planning Rules**

- Max 1–3 ICs per lesson
- Lessons must be movable across days and weeks
- Unfinished lessons must be easy to reschedule
- Planning must be faster than Word or paper

# **12. Home Screen**

Default landing screen:

Weekly Planner

Reason:

- aligns with daily teacher behaviour
- supports planning-first model

# **13. Subject Scope (Version 1)**

Build for:

Two subjects (e.g. English and Maths)

Reason:

- validates cross-subject flexibility
- avoids overgeneralising too early

Subject list is sourced from the curriculum CSVs in the repo, not hardcoded.

# **14. Classes and Year Levels**

- A class is represented as a single `ClassGroup`
- Composite classes (e.g. Year 3/4) are supported via `yearLevels: string[]` on `ClassGroup`
- Each student carries their own `yearLevel` so individual progress is tracked correctly even in composite classes

# **15. AI Role (Version 1)**

**AI is allowed to:**

- generate IC drafts
- suggest assessment tasks
- suggest next ICs to teach
- flag possible mastery thresholds for teacher review

**AI is NOT allowed to:**

- auto-judge student mastery
- override teacher decisions
- control aggregation logic

Teacher remains the decision-maker.

# **16. Product Rules (Critical Constraints)**

**Non-Negotiables**

- ICs are the shared unit across all modules
- No lesson without ICs in final workflow
- Mastery entry must be fast
- System must tolerate incomplete data
- Progress must drive next teaching decisions

**Hard Constraints**

- Max 1–3 ICs per lesson
- Max 6–12 ICs per descriptor
- No required long text fields
- No heavy assessment workflows
- No duplicate data entry across features

**Usability Targets**

- Create basic lesson in ≤60 seconds
- Update mastery quickly for a class
- Plan a rough week quickly
- Identify ICs needing reteach in ≤5 minutes

# **17. Core Data Objects**

Minimum required:

- ContentDescriptor
- AchievementStandard
- InstructionalComponent
- Plan
- SequenceBlock
- Lesson
- Student
- ClassGroup
- MasteryRecord
- AssessmentTask

All relationships must connect through ICs. See `DATA-SCHEMA-DOCUMENT.md`.

# **18. Core Modules**

1. Curriculum Module
2. IC Module
3. Planning Module (long-term, weekly, lesson)
4. Assessment Module (pre, in-flow, summary)
5. Progress Module
6. Aggregation Module
7. Recommendation Layer
8. Support Module

# **19. Build Strategy**

**Phase 1 – Foundation**

- curriculum data
- IC structure
- student/class setup

**Phase 2 – First Build Slice (proves the core loop works)**

- weekly planner
- lesson creation
- IC selection
- mark lesson taught
- quick mastery entry
- basic IC progress view

See `FIRST-BUILD-SLICE.md` for full detail.

**Phase 3 – V1.5 SaaS Shell**

- authentication (magic-link email + Google)
- Supabase backend, Sydney region
- payment via Stripe
- privacy, terms, account deletion
- onboarding

See `V1.5-SAAS-SHELL.md`.

**Phase 4 – Coherence**

- long-term planning
- gap detection
- student progress view
- descriptor aggregation

**Phase 5 – Full Learning Loop**

- pre-assessment
- summary assessment
- AI IC generation
- AI suggestions

**Phase 6 – Report-Writing Support**

- export mastery summaries in report-ready form
- integration with literacy and numeracy progressions

**Phase 7 – Refinement**

- usability improvements
- smarter recommendations
- performance optimisation

# **20. Success Criteria**

The product succeeds if:

- a teacher can plan a working week quickly
- a teacher can identify key learning gaps in under 5 minutes
- planning, teaching, and mastery tracking happen in one workflow
- teachers do not feel like they are doing extra admin

# **21. Core Design Principle**

Planning drives usage.

Mastery is captured through use.

Progress informs next action.

# **Final Summary**

This product is not a traditional planner or assessment tool.

It is a closed-loop system that:

- turns curriculum into teachable steps
- embeds those steps into lessons
- captures evidence during teaching
- and uses that evidence to guide what happens next

If any part of the system breaks that loop, the product fails.
