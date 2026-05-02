# ClassTracker — Instructional Component (IC) Framework Specification

**Version:** 0.1  
**Status:** Draft — approved for development use  
**Last updated:** April 2026

-----

## 1. Purpose

This document defines the rules, constraints, data model requirements, and AI prompt engineering guidelines for the Instructional Component (IC) system in ClassTracker. It is the authoritative reference for IC generation, ownership, mastery calculation, and quality assurance.

An Instructional Component (IC) is the core unit of ClassTracker. It represents a single, discrete, observable student action or understanding that contributes to mastery of an Australian Curriculum v9 content descriptor.

-----

## 2. What an IC Is

An IC must satisfy all of the following criteria:

- **Discrete** — describes one student action or understanding, not a cluster of related skills
- **Observable** — a teacher can determine within a short interaction or piece of student work whether a student can or cannot demonstrate this specific thing
- **Teachable** — can be the primary focus of 1–2 lessons
- **Student-perspective** — written as “Student can…” not “Teach students to…”
- **Non-bundled** — cannot contain multiple distinct skills in a single statement

### The 5-minute test

If you cannot watch a student for approximately 5 minutes and make a confident yes/no judgement about this IC, it is too broad and must be split.

### Examples

**Too broad (fail):** Student understands place value in two- and three-digit numbers  
**Acceptable (pass):** Student can rename a three-digit number in at least two non-standard ways (e.g. 352 = 35 tens and 2 ones)

-----

## 3. IC Source Inputs by Subject

### English and Mathematics

ICs are derived from:

1. Content descriptor (primary)
1. Content elaborations — for ideation only, not as a specification (see Section 8)
1. Learning progressions (AC Literacy and Numeracy progressions)
1. Linked achievement standard(s)

### All Other Subjects (HASS, Science, Arts, Technologies, HPE)

ICs are derived from:

1. Content descriptor (primary)
1. Content elaborations — for ideation only (see Section 8)
1. Linked achievement standard(s)

> **Note:** Learning progressions are not available for subjects other than English and Mathematics. This is an accepted constraint, not a gap to be filled with AI inference.

-----

## 4. IC Count Range by Descriptor Type

Not all descriptors can sustain the same number of ICs. The valid range depends on descriptor type.

|Descriptor type             |Valid IC count|Notes                                                        |
|----------------------------|--------------|-------------------------------------------------------------|
|Knowledge/content descriptor|6–10          |Rich elaborations typically support this range               |
|Process/skill descriptor    |3–6           |Skills apply across content topics; fewer discrete sub-skills|

### Identifying descriptor type

In HASS, descriptor type is derivable from the sub-strand code:

- `AC9HS[Y]K[n]` = Knowledge descriptor
- `AC9HS[Y]S[n]` = Skills descriptor

For other subjects, type should be stored as an explicit field: `descriptorType: "knowledge" | "skill"` on the `ContentDescriptor` entity.

> **Data model requirement:** Add `descriptorType` field to `ContentDescriptor` schema.

-----

## 5. IC Ownership Tiers

|Tier|Name              |Who creates                   |Editable by teacher  |Affected by default updates |
|----|------------------|------------------------------|---------------------|----------------------------|
|1   |System default    |Developer (sole approver)     |No                   |N/A — is the default        |
|2   |Teacher copy      |Teacher (copied from default) |Yes                  |No — independent once copied|
|3   |Teacher original  |Teacher (created from scratch)|Yes                  |No                          |
|4   |Community (future)|Any teacher (pending approval)|Yes (own submissions)|No                          |

### Key rules

- System defaults are **never editable** by teachers
- Teachers can copy any default IC, edit freely, and optionally suppress the default from their view
- Suppressing a default does not delete it — it remains in the system
- When system defaults are updated or improved, teacher copies and teacher originals are **never affected**
- Teacher originals undergo AI quality assessment on creation (see Section 7)

-----

## 6. Cross-Descriptor IC Sharing

ICs are not automatically shared or applied across descriptors. Cross-descriptor sharing is always a deliberate teacher action.

### How it works

1. The system surfaces “potentially relevant ICs from other descriptors” as suggestions when a teacher is working on a descriptor
1. The teacher explicitly assigns a suggested IC to activate it for the new descriptor
1. This deliberate assignment act is the pedagogical safeguard against accidental mastery inflation
1. Once assigned, mastery credit applies to **all descriptors** the IC is linked to

### Why this is a feature, not a problem

Real curriculum content does not exist in silos. A student who understands zero as a placeholder (AC9M2N02) applies that understanding in addition and subtraction (AC9M2N04). Cross-descriptor IC sharing makes these connections explicit and trackable.

### Data model requirement

The IC ↔ descriptor relationship must be **many-to-many**, not one-to-many.

```
InstructionalComponent ←→ ContentDescriptor (many-to-many join table)
```

The current schema field `descriptorId: string` on IC must be replaced with a join table or array of descriptor IDs.

-----

## 7. AI Assessment of Teacher-Created ICs

When a teacher creates a Teacher Original IC, the system runs an automatic AI quality assessment before saving. This assessment is **advisory only** — the teacher can override and save regardless.

### What the AI checks

1. **Relevance** — Does this IC address part of the target descriptor? Flags if unrelated.
1. **Discreteness** — Does the IC contain multiple bundled skills? Flags if so.
1. **Difficulty placement** — Suggests early / middle / late based on conceptual complexity relative to other ICs in the set.
1. **Default overlap** — Does this IC substantially duplicate an existing default IC? If so, prompts teacher to consider using or modifying the default instead.
1. **Default equivalency** — Which default IC does this most closely match? Teacher confirms with one tap. Confirmed equivalencies count toward the mastery validity threshold (Rule 6).

### UX principle

AI feedback is shown inline at IC creation time. It is framed as suggestions, not errors. The teacher retains full control.

-----

## 8. AI Generation of System Default ICs

System default ICs are generated by AI from curriculum source inputs and approved by the developer before activation.

### Generation prompt constraints (all descriptors)

- Generate ICs that satisfy all criteria in Section 2
- Sequence ICs from early → middle → late difficulty
- Do not exceed the IC count range for this descriptor type (Section 4)
- Write each IC from the student perspective (“Student can…”)
- Each IC must be assessable as a standalone observable action

### Additional constraint — elaborations

> *“Elaborations are suggestions of ways to teach the content description. They are optional and not a complete specification. Use elaborations for ideation only — to identify possible sub-skills and contexts. Do not treat elaboration examples as ICs themselves.”*

### Additional constraint — HASS skills descriptors

> *“These elaborations show the skill applied through content contexts. Extract the discrete skill actions from each elaboration, not the content topics. Generate ICs that are context-independent — applicable across any HASS topic at this year level.”*

### Additional constraint — thin descriptors

> *“If you cannot generate the minimum IC count with high confidence, output only the ICs you are confident about and flag the set as incomplete. Do not pad the set to reach the minimum count. Output: ‘Only [n] high-confidence ICs generated. Developer review recommended before activation.’”*

### Generation tiers

Not all descriptors produce IC sets with equal confidence. The system uses a tiered readiness model:

|Tier|Descriptor characteristics              |IC set status on first generation                  |
|----|----------------------------------------|---------------------------------------------------|
|1   |Knowledge descriptor, rich elaborations |Full set generated, ready for developer review     |
|2   |Knowledge descriptor, thin elaborations |Partial set generated, flagged for review          |
|3   |Skills descriptor, any elaboration depth|Minimal set generated (3–6 ICs), flagged for review|

Tier 2 and Tier 3 descriptor IC sets are visible to teachers but marked “pending review” until developer-approved. Teachers can still teach to any descriptor regardless of IC set maturity.

-----

## 9. Mastery Calculation

### What counts

- Only ICs that have been **explicitly taught** contribute to the mastery numerator
- Untaught ICs (default or teacher) are visible as “available” but excluded from calculation
- `Mastery % = taught ICs with student evidence ÷ total active ICs for that descriptor`

### Mastery validity threshold

A descriptor mastery score is only displayed when **≥ 80% of system default ICs** for that descriptor have been taught (or confirmed-equivalent teacher ICs).

Below threshold, the app displays a **coverage warning** instead of a mastery percentage:

> *“Only [n] of [total] default ICs taught for this descriptor. Mastery data may not be representative.”*

### What counts toward the 80% threshold

- Any system default IC that has been taught ✓
- Any teacher copy of a default IC that has been taught ✓
- Any teacher original IC that has been confirmed as equivalent to a default IC (via AI suggestion + teacher confirmation) and taught ✓

### What does NOT count toward the threshold

- Teacher original ICs with no confirmed default equivalency — these contribute to the mastery numerator but not the validity threshold

-----

## 10. Governance and Approval

|Role               |Responsibility                                             |
|-------------------|-----------------------------------------------------------|
|Developer (Chris)  |Sole approver of system default ICs — first build          |
|Developer (Chris)  |Reviews and approves AI-generated IC sets before activation|
|Teacher            |Creates teacher copies and teacher originals               |
|Teacher            |Submits improvement suggestions for default ICs (future)   |
|Co-curator (future)|Assists with community IC review at scale                  |

### Default update pathway

- Developer can update system default ICs at any time
- Updates do not affect teacher copies or teacher originals
- Future: teachers can flag a default IC for improvement via a “suggest improvement” pathway. Suggestions are reviewed and approved by the developer before any default is modified.

### Community IC bank (future — not in first build)

- Teachers can submit ICs to a community bank
- Community ICs are visible but clearly marked “unreviewed”
- Developer approval elevates a community IC to system default
- Usage data (how many teachers actively use an IC) informs curation priority
- **Data model must support this tier from day one even if UI does not expose it**

-----

## 11. Known Issues and Future Decisions

|#|Issue                                                                                                                                                                             |Status                                                                                             |
|-|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
|1|When system defaults are updated, teachers with copies are not notified. They may be using an outdated IC set without knowing it.                                                 |Accepted for first build. Future: notify teachers when a default they have copied has been updated.|
|2|Teacher originals without a confirmed default equivalency do not count toward the 80% validity threshold. A teacher could have a rich IC set that the system treats as incomplete.|Accepted. Mitigation: AI equivalency suggestion reduces friction of confirming matches.            |
|3|Co-curator role exists in governance model but is not exposed in UI until scale requires it.                                                                                      |Stubbed for future.                                                                                |
|4|Community IC bank is a future feature only. Data model must support it; UI does not expose it in first build.                                                                     |Stubbed for future.                                                                                |
|5|Many-to-many IC ↔ descriptor relationship requires schema change from current `descriptorId: string` field.                                                                       |Required before build begins.                                                                      |
|6|`descriptorType` field required on `ContentDescriptor` entity. May be derivable from existing strand/sub-strand data for HASS; needs explicit setting for other subjects.         |Required before build begins.                                                                      |

-----

## 12. Worked Examples

### Example 1 — Rich content descriptor (Maths)

**Descriptor:** AC9M2N02 — *Partition, rearrange, regroup and rename two- and three-digit numbers using standard and non-standard groupings; recognise the role of a zero digit in place value notation*  
**Type:** Knowledge  
**Achievement standard:** Y2-AS-01

|#|IC                                                                                                                          |Difficulty|
|-|----------------------------------------------------------------------------------------------------------------------------|----------|
|1|Student can partition a 2-digit number into tens and ones using materials or drawings                                       |Early     |
|2|Student can partition a 3-digit number into hundreds, tens and ones                                                         |Early     |
|3|Student can rename a 3-digit number in at least two non-standard ways (e.g. 352 = 35 tens and 2 ones)                       |Middle    |
|4|Student can trade 1 ten for 10 ones (and vice versa) and demonstrate equivalence                                            |Middle    |
|5|Student can trade 1 hundred for 10 tens (and vice versa)                                                                    |Middle    |
|6|Student can explain why the zero digit in a number like 304 means “no tens” — not just read the number correctly            |Middle    |
|7|Student can use regrouping to set up a calculation (e.g. renaming 52 as 4 tens and 12 ones to subtract 8)                   |Late      |
|8|Student can apply standard and non-standard partitioning to solve a contextual problem, choosing their own grouping strategy|Late      |


> **Note on IC 7:** This IC bridges into AC9M2N04 (addition and subtraction). It is a valid candidate for cross-descriptor assignment via the teacher suggestion panel.

-----

### Example 2 — Thin skills descriptor (HASS)

**Descriptor:** AC9HS2S05 — *to draw conclusions and make proposals*  
**Type:** Skill  
**Achievement standard:** Y2-HS-AS-04

|#|IC                                                                                                      |Difficulty|
|-|--------------------------------------------------------------------------------------------------------|----------|
|1|Student can identify which statement is a conclusion (vs a fact or observation) when shown an example   |Early     |
|2|Student can look at a provided source and state what it tells them about people, places or change       |Early     |
|3|Student can point to the specific source or information that supports their conclusion                  |Middle    |
|4|Student can use a comparison (Venn diagram or before/after) to state what has changed or stayed the same|Middle    |
|5|Student can suggest one action or response based on what they have found out, with a reason             |Middle    |
|6|Student can explain why their proposal makes sense by linking it back to their conclusion               |Late      |


> **Note:** These ICs are context-independent by design. They apply whether the content topic is local history, geography, technology change, or First Nations connections to place. This is intentional for skills descriptors.

-----

*End of document*
