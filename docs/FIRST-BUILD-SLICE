Below is your **First Build Slice**. This is the smallest real version of the product that proves the core loop works.

Do not expand this. Do not “just add one more thing.” This slice exists to test whether the product is genuinely useful, not whether the idea sounds good.

---

# CLASS TRACKER – FIRST BUILD SLICE

## 1. Purpose

Build the smallest usable vertical slice that proves this loop works:

**ICs → lesson planning → mark taught → mastery entry → weak IC visibility**

If this slice is not smooth, nothing else matters.

---

## 2. Goal of This Slice

A teacher must be able to:

- view a small bank of ICs
- create a lesson in the weekly planner
- attach 1–3 ICs
- mark the lesson as taught
- enter quick mastery for students
- see which ICs are weak and need reteaching

That is the whole point.

---

## 3. Scope Boundary

## In scope

- one working weekly planner
- one subject only
- one class/group only
- small IC bank
- lesson creation and editing
- IC linking
- taught status
- mastery entry
- basic weak IC view

## Out of scope

- long-term planning
- multiple subjects
- multiple classes
- pre-assessment
- summary assessment
- descriptor roll-up
- AI generation
- AI suggestions
- advanced reporting
- detailed resource library
- fixed timetable logic
- attendance module
- complex settings

If you add any of those now, you are diluting the test.

---

## 4. What This Slice Must Prove

It must prove five things:

1. Teachers can plan with ICs without friction
2. Lessons can move easily in a weekly space
3. Marking a lesson as taught feels natural
4. Mastery entry is fast enough to use
5. Weak ICs are useful enough to affect next planning decisions

If any of those fail, stop and fix before building further.

---

## 5. Fixed Assumptions for This Slice

To keep the build tight:

- one subject only
- one year level only
- one class group only
- one fixed set of 6–10 ICs
- one mastery scale:
    - Not Yet
    - Developing
    - Secure
    - Absent optional
- one week planner view
- local persistence only is acceptable for this slice

This is not the final system. It is the first proof.

---

## 6. Required Screens

You only need **four working screens or views**.

### A. Weekly Planner

The main screen and home screen.

### B. Lesson Drawer

Opened from the planner to create or edit a lesson.

### C. Mastery Entry View

Opened after marking a lesson as taught.

### D. Basic IC Progress View

A simple view showing weak and recent IC status.

That is enough.

---

## 7. Screen 1 – Weekly Planner

## Must include

- current week display
- previous and next week navigation
- Monday to Friday columns
- unscheduled lesson area
- add lesson action
- lesson cards visible in day columns or unscheduled area
- drag and drop between days and unscheduled
- lesson status shown as planned or taught

## Each lesson card must show

- title
- subject
- linked IC tags
- status

## Required actions

- create lesson
- open lesson drawer
- move lesson
- duplicate lesson
- delete lesson
- mark as taught

## This screen must prove

- the planner is usable as the main working surface

---

## 8. Screen 2 – Lesson Drawer

## Must include

### Required fields

- title
- subject
- class/group
- IC selector
- status

### Optional fields

- notes only if easy to include

Do not add more unless needed.

## IC selector rules

- searchable
- max 3 ICs
- minimum 1 IC
- selected ICs shown clearly

## This screen must prove

- attaching ICs to lessons is quick and clear

---

## 9. Screen 3 – Mastery Entry View

## Trigger

Opened when the teacher marks a lesson as taught, or from a lesson action.

## Must include

- lesson title
- linked ICs
- student list for the one class
- one row per student
- one column per linked IC

## Each cell must allow

- Not Yet
- Developing
- Secure
- Absent optional
- blank allowed

## Required behaviour

- fast click entry
- save quickly
- no required comments
- teachers can skip students

## This screen must prove

- mastery can be recorded fast enough to actually use

---

## 10. Screen 4 – Basic IC Progress View

This does not need to be fancy.

## Must show

For each IC:

- whether it has been linked to a taught lesson
- rough recent mastery pattern
- whether it appears weak

## Simple categories are enough

- not taught
- introduced
- weak
- mostly secure

## Optional

A simple list of students with repeated Not Yet for an IC

## This screen must prove

- the system can turn mastery into a next-step signal

---

## 11. Data Needed for This Slice

You only need a minimal dataset.

### ContentDescriptor

Only enough to support the chosen subject and linked ICs.

### InstructionalComponent

6–10 ICs for one descriptor set or small curriculum area.

### ClassGroup

One class only.

### Student

A small class list.

### Lesson

Planner lessons with linked ICs and status.

### MasteryRecord

Per student, per IC, per lesson when entered.

Do not build full schema complexity into the first proof if it is not required to make the slice work.

---

## 12. Minimal Data Model for This Slice

### InstructionalComponent

- id
- name
- description
- sequenceOrder
- descriptorId

### Lesson

- id
- weekKey
- day
- title
- subject
- linkedICIds
- status
- classGroupId
- position

### Student

- id
- firstName
- lastName
- classGroupId

### MasteryRecord

- id
- studentId
- instructionalComponentId
- lessonId
- status
- date

That is enough to test the core loop.

---

## 13. User Flow for This Slice

## Flow 1 – Plan a lesson

1. Open Weekly Planner
2. Click Add Lesson
3. Enter title
4. Select 1–3 ICs
5. Save lesson

## Flow 2 – Move a lesson

1. Drag lesson to another day or unscheduled
2. Drop
3. Position saves automatically

## Flow 3 – Mark taught and enter mastery

1. Open lesson
2. Click Mark as Taught
3. Open mastery entry
4. Update students quickly
5. Save

## Flow 4 – Check weak ICs

1. Open IC Progress View
2. See which ICs are weak
3. Go back to planner
4. Create next lesson using those ICs

That is the first real cycle.

---

## 14. Rules for This Slice

- one subject only
- no more than 3 ICs per lesson
- no long text fields required
- blank mastery entries allowed
- absent optional only
- marking a lesson as taught counts linked ICs as introduced
- week view must persist after refresh
- lessons must persist after refresh
- mastery must persist after refresh

If any of this breaks, the slice is not valid.

---

## 15. Technical Priorities

Build these in this order:

### Step 1

Create seed data:

- one subject
- one class
- 6–10 ICs
- sample students

### Step 2

Build weekly planner shell:

- week navigation
- day columns
- unscheduled area

### Step 3

Build lesson creation and editing:

- lesson drawer
- IC selection
- save lesson

### Step 4

Build drag and drop:

- move across days
- move to unscheduled
- persist placement

### Step 5

Build mark as taught:

- planned → taught state change

### Step 6

Build mastery entry:

- student × IC grid
- save mastery records

### Step 7

Build simple IC progress view:

- weak / introduced / not taught / mostly secure

That is the correct order. Anything else first is poor sequencing.

---

## 16. Acceptance Criteria

The slice is complete only if all of these are true:

### Planner

- I can create a lesson in under 60 seconds
- I can attach 1–3 ICs easily
- I can move lessons between days
- The selected week and lesson placement survive refresh

### Taught flow

- I can mark a lesson as taught with one clear action
- Taught state persists

### Mastery

- I can enter mastery for a full class quickly
- Blank cells are allowed
- Absent is optional
- Mastery saves correctly

### Progress

- I can see which ICs are weak
- I can use that information to plan another lesson

If even one of those is clunky, the build slice needs revision before expansion.

---

## 17. What to Ignore for Now

Do not get distracted by:

- pretty dashboards
- multiple subjects
- term planning
- AI helpers
- perfect visual design
- descriptor reporting
- complex aggregation
- deep settings
- full timetable mechanics

Those are all secondary.

The first build slice is about whether the core behaviour works.

---

## 18. Test Questions for This Slice

Once built, test it like this:

1. Can I add three lessons quickly for the week?
2. Can I drag one to another day when plans change?
3. Can I mark one lesson as taught?
4. Can I update mastery for the class without frustration?
5. Can I tell which IC now needs reteaching?
6. Can I create a new lesson based on that?

If the answer to any of these is no, the product is not ready for more features.

---

## 19. Success Definition

This first build slice succeeds if:

**a teacher can plan, teach, record, and respond to one small cycle of learning without feeling they are doing extra admin.**

That is the bar.

---

## 20. Final Instruction

Do not build the whole product next.

Build this slice, test it hard, and then decide what deserves to survive into phase two. Most ideas sound good until they hit a real workflow. This slice is where the weak parts get exposed.
