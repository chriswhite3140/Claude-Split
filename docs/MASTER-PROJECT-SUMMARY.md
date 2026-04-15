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

**What the Product Is NOT (Version 1 Scope Boundary)**

- behaviour tracking
- parent communication
- attendance system (no separate module)
- full report-writing system
- large resource management platform

# **2. Core System Model**

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

# **3. Core Workflow (Non-Negotiable)**

1. Select ICs
2. Create lesson
3. Attach 1–3 ICs
4. Mark lesson as taught
5. Update mastery quickly
6. View weak or untaught ICs
7. Plan next lesson based on that

If this loop is not fast and smooth, the product fails.

# **4. Data Reality**

- Data will be partial, uneven, and approximate
- Teachers may skip updates
- System must still function and remain useful

No logic should assume perfect data.

# **5. Mastery Model**

**Status Levels**

- Not Yet
- Developing
- Secure
- Absent (optional during mastery entry only)

**Rules**

- No percentages
- No scores
- No complex rubrics
- Mastery is teacher judgement
- AI does not auto-assign mastery

# **6. Aggregation Model**

- Descriptor progress is derived from IC patterns
- Use loose pattern-based aggregation, not strict thresholds

**Example Logic**

- Emerging → mostly Not Yet
- Developing → mixed
- Competent → mostly Secure
- Highly Competent → consistent Secure

Avoid fake precision.

# **7. IC Governance**

- Each descriptor has a default IC set
- Teachers can edit ICs locally
- Defaults remain intact
- IC count per descriptor: 6–12 maximum

# **8. Definition of “Taught”**

An IC is considered taught when:

- the teacher marks the lesson as taught

Not when:

- it is scheduled
- mastery is recorded

# **9. Planning System Design**

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

# **10. Home Screen**

Default landing screen:

Weekly Planner

Reason:

- aligns with daily teacher behaviour
- supports planning-first model

# **11. Subject Scope (Version 1)**

Build for:

Two subjects (e.g. English and Maths)

Reason:

- validates cross-subject flexibility
- avoids overgeneralising too early

# **12. AI Role (Version 1)**

**AI is allowed to:**

- generate IC drafts
- suggest assessment tasks
- suggest next ICs to teach
- flag likely mastery thresholds for teacher review

**AI is NOT allowed to:**

- auto-judge student mastery
- override teacher decisions
- control aggregation logic

Teacher remains the decision-maker.

# **13. Product Rules (Critical Constraints)**

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
- Identify gaps in ≤5 minutes

# **14. Core Data Objects**

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

All relationships must connect through ICs.

# **15. Core Modules**

1. Curriculum Module
2. IC Module
3. Planning Module
    - Long-term
    - Weekly
    - Lesson
4. 
5. Assessment Module
    - Pre
    - In-flow
    - Summary
6. 
7. Progress Module
8. Aggregation Module
9. Recommendation Layer
10. Support Module

# **16. Build Strategy**

**Phase 1 – Foundation**

- curriculum data
- IC structure
- student/class setup

**Phase 2 – Core Loop (MOST IMPORTANT)**

- weekly planner
- lesson creation
- IC selection
- mark lesson taught
- quick mastery entry
- basic IC progress view

**Phase 3 – Coherence**

- long-term planning
- gap detection
- student progress view
- descriptor aggregation

**Phase 4 – Full Learning Loop**

- pre-assessment
- summary assessment
- AI IC generation
- AI suggestions

**Phase 5 – Refinement**

- usability improvements
- smarter recommendations
- performance optimisation

# **17. Success Criteria**

The product succeeds if:

- a teacher can plan a working week quickly
- a teacher can identify key learning gaps in under 5 minutes
- planning, teaching, and mastery tracking happen in one workflow
- teachers do not feel like they are doing extra admin

# **18. Core Design Principle**

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
