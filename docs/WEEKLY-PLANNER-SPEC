Below is your **Weekly Planner Spec**. This is the product and interaction specification for the primary working screen of the app.

---

# CLASS TRACKER – WEEKLY PLANNER SPEC

## 1. Purpose

The Weekly Planner is the **home screen** and primary daily working area of the app.

Its job is to help a teacher:

- see the current teaching week
- create and organise lessons quickly
- attach Instructional Components (ICs) to lessons
- move lessons easily when plans change
- mark lessons as taught
- move directly into mastery entry
- notice weak, untaught, or priority ICs while planning

This screen must support real teacher behaviour:

- incomplete planning
- interrupted days
- shifting lessons
- partial follow-through
- fast adjustments

If this screen is slow or rigid, the whole product fails.

---

## 2. Core Role in the System

The Weekly Planner sits at the centre of the product loop:

**ICs → Lessons → Taught → Mastery → Weak ICs → Next Lessons**

It is not just a calendar.

It is the main place where curriculum intent becomes actual teaching.

---

## 3. Primary User Goals

A teacher should be able to:

- open the week and understand what is planned
- add a lesson in under 60 seconds
- attach 1–3 ICs without friction
- move lessons across the week easily
- leave lessons unscheduled if needed
- mark a lesson as taught quickly
- see what still needs attention
- plan the next lesson using what students need

---

## 4. Screen Position in Navigation

### Navigation Label

**Weekly Planner**

### Status

- default home screen on app open
- most frequently used screen in the app

---

## 5. Screen Layout

## Overall Structure

The Weekly Planner screen has five main areas:

### A. Top Control Bar

### B. Planner Canvas

### C. Unscheduled Lessons Area

### D. Planner Side Drawer

### E. Context Panels and Indicators

---

## 6. Top Control Bar

### Purpose

Provide week navigation and core planning actions.

### Must include

- Previous week button
- Current week label
- Next week button
- Jump to this week button
- Add lesson button
- Optional week menu or settings button

### Week label must show

- start date
- end date

Example:

**Week of 4 May – 8 May**

### Required behaviour

- moving between weeks must preserve week-specific lesson data
- selected week must persist after refresh
- week navigation must not reset to current week unless explicitly chosen
- planner state must remain stable after refresh

---

## 7. Planner Canvas

## Purpose

Provide the main visual planning space.

### Layout direction

Use a **hybrid visual planner**, not a rigid timetable and not a loose kanban-only board.

### The canvas should include

- weekday columns: Monday to Friday
- visual time or period anchors
- visible break markers or structure lines where useful
- flexible vertical stacking area for lesson cards

### Key principle

The planner shows the shape of a school day without forcing every lesson into strict locked slots.

---

## 8. Canvas Structure Rules

### Required layout characteristics

- day columns must be visually clear
- period/time anchors act as guides, not hard constraints
- lesson cards can be placed freely within a day column
- lesson cards may align roughly to time bands
- lesson cards are not required to snap rigidly into one slot
- slight overlap or flexible placement is acceptable if readable

### Breaks and fixed events

The planner may show:

- recess
- lunch
- specialist times
- fixed whole-school events

These should function as:

- visual separators
- planning guides

Not as:

- locked scheduling rules in Version 1

---

## 9. Unscheduled Lessons Area

## Purpose

Allow teachers to hold lesson cards that are not yet assigned to a day.

### This area must:

- be visible on the Weekly Planner screen
- support drag into any day
- support drag back out of a day if needed

### Use cases

- lesson prepared but not yet placed
- rollover lesson from prior week
- optional lesson waiting for a gap
- teacher planning loosely before assigning exact day

### Behaviour

- unscheduled lessons still belong to the selected week
- unscheduled lessons are not counted as taught
- unscheduled lessons remain visible after refresh

---

## 10. Lesson Card – Core Planning Object

The lesson card is the main object inside the Weekly Planner.

## Lesson Card States

- collapsed card
- selected card
- dragging card
- taught card
- overdue or rollover card if relevant later

---

## 11. Lesson Card – Collapsed View

### Must show

- lesson title
- subject
- linked IC tags
- lesson status

### Optional quick indicators

- priority/attention marker
- resource attached icon
- mastery follow-up pending icon

### IC display rule

- show up to 3 IC tags
- if longer names exist, truncate visually but allow full text on hover or expand

### Status display

Allowed statuses:

- planned
- taught

Planned is default.

---

## 12. Lesson Card – Visual Rules

### Cards must be

- draggable
- clickable
- compact
- readable in dense view

### Cards must support

- inline title edit or quick open into drawer
- clear visual differentiation between planned and taught
- visible but not cluttered IC tags

### The card should not require

- full lesson description
- detailed text input before saving
- multiple screens to create basic lesson

---

## 13. Lesson Card Actions

Each lesson card must support:

- open for edit
- drag to reposition
- drag to another day
- drag to unscheduled area
- duplicate
- delete
- mark as taught

### Delete behaviour

Use two-step confirm behaviour, for example:

- first click arms delete
- second click confirms

This avoids accidental loss.

### Duplicate behaviour

Must duplicate:

- title
- subject
- linked ICs
- optional notes/resources if already added

Duplicate should create a new planned lesson.

---

## 14. Lesson Creation

## Trigger options

A teacher must be able to create a lesson by:

- clicking Add Lesson in top bar
- clicking empty planner space
- clicking add within a day column
- optionally adding into unscheduled area

At least one fast entry path is required.

---

## 15. Default New Lesson Behaviour

A newly created lesson should:

- open immediately in the planner drawer or quick-edit mode
- default to status = planned
- default title to something simple such as “New Lesson”
- belong to the currently selected week
- be assignable to a day or left unscheduled

### Minimum fields required to save a lesson

- title
- subject
- 1–3 ICs
- class group

If you need more than that for basic use, the flow is too heavy.

---

## 16. Lesson Edit Drawer

## Purpose

Allow more detailed editing without leaving the planner.

### Drawer opens when

- lesson card clicked
- new lesson created
- edit action chosen

### Drawer may appear

- as a right-side panel
- or modal if necessary

Right-side drawer is preferred for maintaining planner context.

---

## 17. Lesson Edit Drawer – Required Fields

### Required

- title
- subject
- IC selector
- class/group
- lesson status

### Optional

- notes
- learning intention
- success criteria
- resource links
- small teaching reminders

### Non-negotiable rule

Optional fields must never block quick planning.

---

## 18. IC Selector in Drawer

This is one of the most important interactions in the product.

### IC selector must:

- be searchable
- allow quick filtering by subject and descriptor
- allow only 1–3 ICs
- show selected ICs clearly
- support fast add/remove

### IC selector should show context

For each IC displayed, show lightweight indicators such as:

- recent use
- weak or needs attention
- mostly secure
- untaught

### Why this matters

The planner must not just attach ICs mechanically.

It should help the teacher choose the right ICs.

---

## 19. IC Selection Rules

- minimum 1 IC
- maximum 3 ICs
- if teacher attempts 4th IC, block and explain clearly
- selected ICs should appear as tags or chips in both drawer and lesson card

### No automatic confirmation of curriculum intent without teacher review

The teacher chooses the ICs.

---

## 20. Day Assignment and Placement

A lesson can exist in one of two states:

- assigned to a day
- unscheduled

### If assigned to a day

It appears in that day’s planner column.

### If unscheduled

It appears in the unscheduled area.

### Position model

Cards should store flexible placement data, such as:

- day
- approximate vertical position
- optional size/height

This supports the hybrid visual planner.

---

## 21. Drag and Drop Behaviour

### Required drag behaviours

- move within the same day
- move to another day
- move to unscheduled
- move from unscheduled to day
- reorder within a day

### Drag rules

- drag must feel lightweight and immediate
- card placement must persist after drop
- drop should autosave
- drag should not break card data

### Important

Teachers must be able to shift lessons easily when the week changes.

This is central, not optional.

---

## 22. Rollover Behaviour

The planner must support reality:

some lessons are not taught and need to move.

### Required rollover options

- drag a planned lesson to another day in the same week
- drag or move a planned lesson into next week
- duplicate then adjust if teacher wants to keep original structure
- keep lesson as unscheduled if not ready to place

### A lesson marked as taught should not be rolled as the same teaching event

A duplicate can be created if a follow-up lesson is needed.

---

## 23. Mark as Taught

## Purpose

Change a lesson from planned to taught and trigger the next part of the workflow.

### When a lesson is marked as taught:

- lesson status becomes taught
- linked ICs count as introduced
- the lesson becomes available for mastery entry
- the UI should indicate that the lesson has been delivered

### Mark as taught must be:

- quick
- reversible only if absolutely necessary
- clearly visible

---

## 24. Post-Taught Behaviour

After a lesson is marked as taught, the planner should support at least one of these flows:

### Preferred flow

Prompt:

- “Update mastery now”
    
    with option to:
    
- open mastery entry
- dismiss and return later

### Why

This preserves the planning-first, mastery-captured-through-use model.

### Important

Mastery update should be encouraged, not forced.

---

## 25. Lesson Status Rules

### planned

- default state
- lesson is intended but not yet delivered

### taught

- teacher confirms it occurred
- linked ICs are treated as introduced

No extra statuses in Version 1 unless essential.

Do not add:

- drafted
- cancelled
- partial
- approved
    
    unless there is a strong reason later
    

---

## 26. Weekly Context Signals

The Weekly Planner should not be a blank board.

It should provide useful context while planning.

### Useful signals may include

- weak ICs needing attention
- ICs not yet taught this term/unit
- recently taught ICs
- summary assessment follow-up needed
- students or groups needing revisit tied to specific ICs

### Placement of signals

These can appear:

- in side panel
- in IC selector
- on lesson cards where relevant
- in lightweight banners or chips

### Rule

Signals should guide action, not clutter the screen.

---

## 27. Side Panel or Context Panel

The Weekly Planner may include a secondary support panel showing:

- weak ICs
- untaught ICs
- upcoming planned ICs from long-term plan
- suggested next ICs
- recent lesson history

### Purpose

Help teachers plan based on evidence, not just memory.

### Requirement

This panel must be useful but collapsible.

---

## 28. Empty States

The screen must handle empty and early setup states clearly.

### Case 1 – no lessons for the week

Show:

- clear message
- Add Lesson action
- optional suggestion to pull from long-term plan

### Case 2 – no ICs available

Show:

- clear message explaining ICs are needed
- link to Curriculum/IC setup

### Case 3 – no class/group selected

Show:

- prompt to set class/group

### Rule

Never show a dead blank planner with no explanation.

---

## 29. Persistence Rules

The Weekly Planner must persist:

- selected week
- lesson cards
- day assignment
- unscheduled lessons
- card position
- lesson details
- taught status

### Persistence requirements

- state should survive refresh
- state should survive navigation away and back
- future weeks should remain accessible after refresh

This has already been a known pain point. It must be reliable.

---

## 30. Search and Filtering

At minimum, the planner should support:

- filtering lessons by subject
- filtering or searching ICs inside lesson editing

Optional later:

- show only weak IC lessons
- show only untaught planned lessons
- filter by class/group

Version 1 should keep filtering light.

---

## 31. Weekly Planner Data Requirements

The Weekly Planner depends on:

### Required objects

- Lesson
- InstructionalComponent
- ClassGroup

### Helpful context objects

- Plan
- MasteryRecord
- Student

### Core lesson fields needed on this screen

- id
- weekKey
- day
- title
- subject
- linkedICIds
- status
- classGroupId
- position

---

## 32. Derived Planner Logic

The planner should compute lightweight derived information such as:

### Lesson-level

- whether linked ICs are weak
- whether linked ICs are recently taught
- whether mastery follow-up exists

### Week-level

- count of planned lessons
- count of taught lessons
- ICs taught this week
- ICs planned but not taught yet

This should support planning, not become dashboard bloat.

---

## 33. Weekly Planner Success Criteria

The Weekly Planner succeeds if a teacher can:

- create a lesson in under 60 seconds
- attach ICs without confusion
- move lessons quickly when plans change
- understand what is taught vs planned
- mark a lesson taught with one obvious action
- move into mastery update without extra searching
- identify the week’s main learning focus quickly

---

## 34. Failure Conditions

The Weekly Planner fails if:

- teachers must write too much to create a lesson
- cards are hard to move
- week state resets after refresh
- future week planning is lost
- IC selection is slow or confusing
- marking lessons as taught is unclear
- planner feels like a rigid timetable
- planner becomes a static display instead of a working tool

---

## 35. Version 1 Must-Haves

For Version 1, the Weekly Planner must include:

- week navigation
- persistent selected week
- Monday to Friday planning view
- unscheduled lesson area
- lesson creation
- lesson edit drawer
- IC selection with 1–3 limit
- drag and drop movement
- duplicate lesson
- delete lesson
- mark lesson taught
- basic context indicators for weak/priority ICs

---

## 36. Version 1 Nice-to-Haves, Not Required

These are useful, but not essential for first release:

- resizable cards
- detailed timetable snapping
- advanced filtering
- auto-generated lesson titles
- AI lesson suggestions directly in planner
- visual mastery summaries inside every card
- complex colour coding

Do not let these delay the core loop.

---

## 37. Final Design Principle

The Weekly Planner is not a document editor and not a rigid timetable.

It is a **flexible working surface** where teachers:

- place learning intentions into the week
- connect them to ICs
- respond when plans change
- and move directly into teaching and mastery capture

If it supports movement, speed, and clarity, it works.

If it becomes rigid, verbose, or admin-heavy, it is trash.
