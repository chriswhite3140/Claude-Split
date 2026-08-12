/*
 * ClassTracker — Test Mode sample/synthetic dataset
 * ============================================================
 * A fixed, hand-authored fixture used ONLY when the app boots with
 * ?testMode=1&sampleData=1 in the URL (see the SAMPLE_DATA_ACTIVE block near the
 * top of app.js). It is checked into the repo so its contents are reviewable —
 * nothing here is generated at runtime.
 *
 * Entirely fictional students, entirely fictional class. No real student data.
 *
 * This file is loaded via a plain <script> tag BEFORE app.js (see index.html), so
 * it must not reference anything app.js defines — it only sets one global,
 * window.CT_SAMPLE_TEST_MODE_DATA, for app.js to read once TEST_MODE_ACTIVE /
 * SAMPLE_DATA_ACTIVE are known. It is harmless to load in every other mode too:
 * it just sits unused as a plain object until something reads it.
 *
 * Content descriptor codes referenced below (AC9M3N02, AC9E4LY06, AC9S3U01,
 * AC9S3U02, Y4-AS-01, Year4-AS-8934, NUM-NSA-NPV-L1-I01) are real Australian
 * Curriculum v9 codes, checked against the CSVs in this repo's data/ folder —
 * this fixture reuses real curriculum reference data, only the class/student/
 * planning data is invented.
 */
(function () {
  'use strict';

  // ── Class ──
  // Composite Year 3/4 class — exercises multi-year-level support (Class Settings).
  var classSettings = {
    groups: [
      {
        id: 'main',
        name: 'Year 3/4 Composite',
        color: '#4f8ef7',
        disabledSubjects: {},
        disabledStrands: {},
        disabledAreas: {},
        yearLevels: ['3', '4'],
      },
    ],
    activeGroup: 'main',
  };

  // ── Students (18, entirely fictional) ──
  var students = [
    // Year 3 (10)
    { id: 'sample-stu-01', first_name: 'Priya',  last_name: 'Nair',       year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-02', first_name: 'Marcus', last_name: 'Webb',       year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-03', first_name: 'Amelia', last_name: 'Chen',       year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-04', first_name: 'Liam',   last_name: "O'Connor",  year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-05', first_name: 'Zara',   last_name: 'Ahmed',      year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-06', first_name: 'Noah',   last_name: 'Fitzgerald', year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-07', first_name: 'Isla',   last_name: 'Thompson',   year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-08', first_name: 'Kai',    last_name: 'Rangi',      year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-09', first_name: 'Sophie', last_name: 'Nguyen',     year_level: '3', date_added: '2026-01-28' },
    { id: 'sample-stu-10', first_name: 'Ethan',  last_name: 'Walsh',      year_level: '3', date_added: '2026-01-28' },
    // Year 4 (8)
    { id: 'sample-stu-11', first_name: 'Grace',  last_name: 'Kowalski',   year_level: '4', date_added: '2026-01-28' },
    { id: 'sample-stu-12', first_name: 'Jayden', last_name: 'Silva',      year_level: '4', date_added: '2026-01-28' },
    { id: 'sample-stu-13', first_name: 'Chloe',  last_name: 'Anderson',   year_level: '4', date_added: '2026-01-28' },
    { id: 'sample-stu-14', first_name: 'Tyler',  last_name: 'Brooks',     year_level: '4', date_added: '2026-01-28' },
    { id: 'sample-stu-15', first_name: 'Mia',    last_name: 'Patel',      year_level: '4', date_added: '2026-01-28' },
    { id: 'sample-stu-16', first_name: 'Ryan',   last_name: 'Sullivan',   year_level: '4', date_added: '2026-01-28' },
    { id: 'sample-stu-17', first_name: 'Ava',    last_name: 'Mitchell',   year_level: '4', date_added: '2026-01-28' },
    { id: 'sample-stu-18', first_name: 'Lucas',  last_name: 'Ferreira',   year_level: '4', date_added: '2026-01-28' },
  ];

  // ── Instructional Components ──
  // Hand-authored, stable fixture-owned ids (real bundled ics_*.csv ids are unstable
  // for most subjects — see the fixture design notes in the PR — so this fixture
  // deliberately does not borrow any). "fields" objects, shaped for createIC().
  //
  // AC9M3N02 (Year 3 Maths — unit fractions) — system_default, full 5-IC set.
  var icsFractions = [
    { id: 'sample-ac9m3n02-ic01', homeDescriptorId: 'AC9M3N02', name: 'Identify a half of a shape or set', description: 'Student can identify a half of a shape or a set of objects.', sequenceOrder: 1, difficultyStage: 'early' },
    { id: 'sample-ac9m3n02-ic02', homeDescriptorId: 'AC9M3N02', name: 'Identify a quarter of a shape or set', description: 'Student can identify a quarter of a shape or a set of objects.', sequenceOrder: 2, difficultyStage: 'early' },
    { id: 'sample-ac9m3n02-ic03', homeDescriptorId: 'AC9M3N02', name: 'Represent unit fractions on a number line', description: 'Student can place a given unit fraction at the correct point on a number line.', sequenceOrder: 3, difficultyStage: 'mid' },
    { id: 'sample-ac9m3n02-ic04', homeDescriptorId: 'AC9M3N02', name: 'Compare unit fractions by size', description: 'Student can order two or more unit fractions from smallest to largest and explain why.', sequenceOrder: 4, difficultyStage: 'mid' },
    { id: 'sample-ac9m3n02-ic05', homeDescriptorId: 'AC9M3N02', name: 'Model equivalent representations of a simple fraction', description: 'Student can show the same unit fraction two different ways (e.g. a diagram and a number line).', sequenceOrder: 5, difficultyStage: 'late' },
  ];

  // AC9E4LY06 (Year 4 English — persuasive writing) — system_default, full 5-IC set.
  var icsPersuasive = [
    { id: 'sample-ac9e4ly06-ic01', homeDescriptorId: 'AC9E4LY06', name: 'Identify the persuasive purpose of a text', description: 'Student can identify that a text is trying to persuade and name what it is arguing for.', sequenceOrder: 1, difficultyStage: 'early' },
    { id: 'sample-ac9e4ly06-ic02', homeDescriptorId: 'AC9E4LY06', name: 'Select language features that persuade a reader', description: 'Student can pick out persuasive language features (e.g. rhetorical questions, emotive words) in a model text.', sequenceOrder: 2, difficultyStage: 'early' },
    { id: 'sample-ac9e4ly06-ic03', homeDescriptorId: 'AC9E4LY06', name: 'Plan a persuasive text using a simple structure', description: 'Student can plan a persuasive text with an opinion, supporting points and a conclusion.', sequenceOrder: 3, difficultyStage: 'mid' },
    { id: 'sample-ac9e4ly06-ic04', homeDescriptorId: 'AC9E4LY06', name: 'Draft a persuasive paragraph with a clear opinion', description: 'Student can draft a paragraph that states an opinion and gives at least one supporting reason.', sequenceOrder: 4, difficultyStage: 'mid' },
    { id: 'sample-ac9e4ly06-ic05', homeDescriptorId: 'AC9E4LY06', name: 'Edit a persuasive text for clarity and impact', description: 'Student can revise a draft persuasive text to strengthen word choice and clarity.', sequenceOrder: 5, difficultyStage: 'late' },
  ];

  // AC9S3U02 (Year 3 Science — soils, rocks and minerals) — system_default, 3 ICs,
  // deliberately never taught to anyone in this fixture: the genuine coverage gap.
  var icsSoilsRocks = [
    { id: 'sample-ac9s3u02-ic01', homeDescriptorId: 'AC9S3U02', name: 'Sort soils, rocks and minerals by observable properties', description: 'Student can sort samples of soil, rock and mineral by an observable property such as texture or colour.', sequenceOrder: 1, difficultyStage: 'early' },
    { id: 'sample-ac9s3u02-ic02', homeDescriptorId: 'AC9S3U02', name: 'Describe why rocks and minerals are useful Earth resources', description: 'Student can describe at least one everyday use of a rock or mineral.', sequenceOrder: 2, difficultyStage: 'mid' },
    { id: 'sample-ac9s3u02-ic03', homeDescriptorId: 'AC9S3U02', name: 'Compare samples of local soil using simple tests', description: 'Student can compare two local soil samples using a simple test (e.g. a magnifying glass observation).', sequenceOrder: 3, difficultyStage: 'late' },
  ];

  // Draft/stub IC on AC9S3U01 (Year 3 Science — living and non-living things) —
  // exercises the "N draft IC(s) need review" banner (getUnresolvedStubCount()).
  var icsDraftStub = [
    { id: 'sample-stub-ac9s3u01-01', homeDescriptorId: 'AC9S3U01', name: 'Sort living and non-living things using a simple rule', description: '', note: 'Drafted from a lesson intention — needs review before promoting.', ownerTier: 'teacher_stub', icReadinessStatus: 'draft', sequenceOrder: 999, createdAt: '2026-08-01T09:00:00.000Z' },
  ];

  var instructionalComponents = [].concat(icsFractions, icsPersuasive, icsSoilsRocks, icsDraftStub);

  // ── Units ──
  var units = [
    {
      id: 'sample-unit-fractions',
      title: 'Fractions Foundations',
      subject: 'Mathematics',
      yearLevel: '3',
      term: 'Term 3',
      linkedCDIds: ['AC9M3N02'],
      assessmentNotes: 'Exit ticket after the comparing-fractions lesson; work samples filed for the word-problems lesson.',
      lessonIds: ['sample-lsn-a1', 'sample-lsn-a2', 'sample-lsn-a3'],
      createdAt: '2026-07-14T02:00:00.000Z',
    },
    {
      id: 'sample-unit-persuasive-writing',
      title: 'Persuasive Writing',
      subject: 'English',
      yearLevel: '4',
      term: 'Term 3',
      linkedCDIds: ['AC9E4LY06'],
      assessmentNotes: 'Final persuasive letter marked against the class rubric; shared in Week 3 author’s chair.',
      lessonIds: ['sample-lsn-b1', 'sample-lsn-b2', 'sample-lsn-b3'],
      createdAt: '2026-07-14T02:05:00.000Z',
    },
    {
      id: 'sample-unit-living-things',
      title: 'Living Things and Habitats',
      subject: 'Science',
      yearLevel: '3',
      term: 'Term 3',
      linkedCDIds: ['AC9S3U01'],
      assessmentNotes: '',
      lessonIds: ['sample-lsn-c1', 'sample-lsn-c2'],
      createdAt: '2026-07-14T02:10:00.000Z',
    },
    {
      id: 'sample-unit-visual-storytelling',
      title: 'Visual Storytelling Basics',
      subject: 'The Arts',
      yearLevel: '3',
      term: 'Term 3',
      // Deliberately empty: The Arts is a banded subject — the CSV Subject values for
      // Arts subjects are the specific discipline (Dance/Drama/Media Arts/Music/Visual
      // Arts), never the umbrella "The Arts". unitCDResultsHtml used to filter
      // state.curriculumCodes by a direct c.Subject === unit.subject equality check,
      // which could never match any of those for a unit whose own subject was the
      // broad "The Arts" — fixed via plannerCurriculumSubjectsFor()'s broad-to-granular
      // mapping. Left with zero linked CDs on purpose so this unit keeps exercising the
      // CD-linking path (a teacher can now actually browse/search and link one) as a
      // live regression check, per the task brief.
      linkedCDIds: [],
      assessmentNotes: '',
      lessonIds: ['sample-lsn-d1', 'sample-lsn-d2'],
      createdAt: '2026-07-14T02:15:00.000Z',
    },
  ];

  // ── Lessons ──
  // Week Mondays: Week 1 = 2026-07-20, Week 2 = 2026-07-27, Week 3 (current) =
  // 2026-08-03. "Today" for this fixture is 2026-08-05 (Wednesday of Week 3).
  var lessons = [
    // Unit A — Fractions Foundations
    {
      id: 'sample-lsn-a1', title: 'Introducing halves and quarters', subject: 'Mathematics',
      unitId: 'sample-unit-fractions', position: 0,
      intention: 'Students can identify halves and quarters of shapes and small sets of objects.',
      weekKey: '2026-07-20', dayKey: 'mon',
      scheduledSlots: [{ weekKey: '2026-07-20', dayKey: 'mon', taught: true }],
      status: 'taught', teachingStatus: 'taught',
      linkedICIds: ['sample-ac9m3n02-ic01', 'sample-ac9m3n02-ic02'],
      resourceLinks: [],
    },
    {
      id: 'sample-lsn-a2', title: 'Comparing unit fractions', subject: 'Mathematics',
      unitId: 'sample-unit-fractions', position: 1,
      intention: 'Students can compare unit fractions and place them on a number line.',
      weekKey: '2026-07-27', dayKey: 'mon',
      scheduledSlots: [
        { weekKey: '2026-07-27', dayKey: 'mon', taught: true },
        { weekKey: '2026-07-27', dayKey: 'wed' },
      ],
      status: 'planned', teachingStatus: 'partially-taught',
      linkedICIds: ['sample-ac9m3n02-ic03', 'sample-ac9m3n02-ic04'],
      resourceLinks: [],
    },
    {
      id: 'sample-lsn-a3', title: 'Fraction word problems', subject: 'Mathematics',
      unitId: 'sample-unit-fractions', position: 2,
      intention: 'Students can solve simple word problems involving unit fractions.',
      weekKey: '2026-08-03', dayKey: 'fri',
      scheduledSlots: [{ weekKey: '2026-08-03', dayKey: 'fri' }],
      status: 'planned', teachingStatus: 'planned',
      linkedICIds: ['sample-ac9m3n02-ic05'],
      resourceLinks: [],
    },

    // Unit B — Persuasive Writing
    {
      id: 'sample-lsn-b1', title: 'What makes an argument persuasive?', subject: 'English',
      unitId: 'sample-unit-persuasive-writing', position: 0,
      intention: 'Students can identify persuasive purpose and language features in a model text.',
      weekKey: '2026-07-20', dayKey: 'tue',
      scheduledSlots: [{ weekKey: '2026-07-20', dayKey: 'tue', taught: true }],
      status: 'taught', teachingStatus: 'taught',
      linkedICIds: ['sample-ac9e4ly06-ic01', 'sample-ac9e4ly06-ic02'],
      resourceLinks: [
        { label: 'Persuasive texts explainer video', url: 'https://example.com/persuasive-texts-video' },
        { label: 'Model text — "Save Our Playground"', url: 'https://example.com/save-our-playground.pdf' },
      ],
    },
    {
      id: 'sample-lsn-b2', title: 'Persuasive techniques workshop', subject: 'English',
      unitId: 'sample-unit-persuasive-writing', position: 1,
      intention: 'Students can plan a persuasive text using a simple structure.',
      weekKey: '2026-07-27', dayKey: 'tue',
      scheduledSlots: [{ weekKey: '2026-07-27', dayKey: 'tue', taught: true }],
      status: 'taught', teachingStatus: 'taught',
      linkedICIds: ['sample-ac9e4ly06-ic02', 'sample-ac9e4ly06-ic03'],
      resourceLinks: [],
    },
    {
      id: 'sample-lsn-b3', title: 'Drafting our persuasive letters', subject: 'English',
      unitId: 'sample-unit-persuasive-writing', position: 2,
      intention: 'Students can draft a persuasive paragraph with a clear opinion and edit for impact.',
      weekKey: '2026-08-03', dayKey: 'tue',
      scheduledSlots: [{ weekKey: '2026-08-03', dayKey: 'tue', taught: true }],
      status: 'taught', teachingStatus: 'taught',
      linkedICIds: ['sample-ac9e4ly06-ic04', 'sample-ac9e4ly06-ic05'],
      resourceLinks: [],
    },

    // Unit C — Living Things and Habitats (0 ICs linked — "needs IC" warning state)
    {
      id: 'sample-lsn-c1', title: 'What makes something alive?', subject: 'Science',
      unitId: 'sample-unit-living-things', position: 0,
      intention: 'Students can list features that distinguish living things from non-living things.',
      weekKey: '2026-08-03', dayKey: 'thu',
      scheduledSlots: [{ weekKey: '2026-08-03', dayKey: 'thu' }],
      status: 'planned', teachingStatus: 'planned',
      linkedICIds: [],
      resourceLinks: [],
    },
    {
      id: 'sample-lsn-c2', title: 'Exploring local habitats', subject: 'Science',
      unitId: 'sample-unit-living-things', position: 1,
      intention: 'Students can describe a local habitat and the living things found there.',
      weekKey: '2026-08-03', dayKey: 'unscheduled',
      scheduledSlots: [],
      status: 'planned', teachingStatus: 'planned',
      linkedICIds: [],
      resourceLinks: [],
    },

    // Unit D — Visual Storytelling Basics (The Arts — the known broken CD-linking path)
    {
      id: 'sample-lsn-d1', title: 'Telling a story through images', subject: 'The Arts',
      unitId: 'sample-unit-visual-storytelling', position: 0,
      intention: 'Students can sequence three images to tell a simple story.',
      weekKey: '2026-07-20', dayKey: 'fri',
      scheduledSlots: [{ weekKey: '2026-07-20', dayKey: 'fri', taught: true }],
      status: 'taught', teachingStatus: 'reteach',
      linkedICIds: [],
      resourceLinks: [],
    },
    {
      id: 'sample-lsn-d2', title: 'Peer review of visual stories', subject: 'The Arts',
      unitId: 'sample-unit-visual-storytelling', position: 1,
      intention: 'Students can give one piece of specific feedback on a peer’s visual story.',
      weekKey: '2026-07-27', dayKey: 'fri',
      scheduledSlots: [{ weekKey: '2026-07-27', dayKey: 'fri', taught: true }],
      status: 'taught', teachingStatus: 'needs-review',
      linkedICIds: [],
      resourceLinks: [],
    },
  ];

  // ── Progress (formal mastery judgments) ──
  // mastery in {'Achieved','Developing','Emerging','Not taught'}.
  var progress = [
    // AC9M3N02 spread
    { id: 'sample-prog-01', student_id: 'sample-stu-03', code: 'AC9M3N02', mastery: 'Achieved',   date: '2026-07-28', notes: '', evidence: '' },
    { id: 'sample-prog-02', student_id: 'sample-stu-04', code: 'AC9M3N02', mastery: 'Developing',  date: '2026-07-28', notes: '', evidence: '' },
    { id: 'sample-prog-03', student_id: 'sample-stu-05', code: 'AC9M3N02', mastery: 'Achieved',   date: '2026-07-28', notes: '', evidence: '' },
    { id: 'sample-prog-04', student_id: 'sample-stu-07', code: 'AC9M3N02', mastery: 'Emerging',    date: '2026-07-28', notes: 'Coverage complete but still inconsistent applying it independently.', evidence: '' },
    // AC9E4LY06 spread
    { id: 'sample-prog-05', student_id: 'sample-stu-11', code: 'AC9E4LY06', mastery: 'Achieved',   date: '2026-08-04', notes: '', evidence: '' },
    { id: 'sample-prog-06', student_id: 'sample-stu-12', code: 'AC9E4LY06', mastery: 'Achieved',   date: '2026-08-04', notes: '', evidence: '' },
    { id: 'sample-prog-07', student_id: 'sample-stu-13', code: 'AC9E4LY06', mastery: 'Developing',  date: '2026-08-04', notes: '', evidence: '' },
    { id: 'sample-prog-08', student_id: 'sample-stu-14', code: 'AC9E4LY06', mastery: 'Developing',  date: '2026-08-04', notes: '', evidence: '' },
    { id: 'sample-prog-09', student_id: 'sample-stu-15', code: 'AC9E4LY06', mastery: 'Emerging',    date: '2026-08-04', notes: '', evidence: '' },
    // Ava Mitchell — already has a Progress record despite sitting at 80% coverage,
    // so the mastery-ready gate correctly excludes her (already judged).
    { id: 'sample-prog-10', student_id: 'sample-stu-17', code: 'AC9E4LY06', mastery: 'Achieved',   date: '2026-07-30', notes: '', evidence: '' },
  ];

  // ── TaughtICs (per-student, per-IC status) ──
  // status uses the Daily Wizard vocabulary: 'got_it' / 'needs_review'.
  // Coverage below is deliberately expressed as "first N of 5 by sequence" per
  // student for legibility — see the fixture design summary for exact counts.
  function taughtICRows(prefix, studentId, icIds, date) {
    return icIds.map(function (icId, i) {
      return { id: prefix + '-' + (i + 1), date: date, student_id: studentId, ic_id: icId, status: 'got_it', notes: '' };
    });
  }
  var fractionICIds = icsFractions.map(function (ic) { return ic.id; });
  var persuasiveICIds = icsPersuasive.map(function (ic) { return ic.id; });

  var taughtICs = [].concat(
    // AC9M3N02 — Amelia Chen 5/5, Liam O'Connor 5/5, Zara Ahmed 4/5, Noah Fitzgerald 3/5,
    // Isla Thompson 5/5, Priya Nair 4/5 (exact 80% boundary), Marcus Webb 2/5 (clearly
    // below), Kai Rangi 1/5, Sophie Nguyen 0/5, Ethan Walsh 0/5 (no data yet).
    taughtICRows('sample-ti-stu03', 'sample-stu-03', fractionICIds.slice(0, 5), '2026-07-28'),
    taughtICRows('sample-ti-stu04', 'sample-stu-04', fractionICIds.slice(0, 5), '2026-07-28'),
    taughtICRows('sample-ti-stu05', 'sample-stu-05', fractionICIds.slice(0, 4), '2026-07-27'),
    taughtICRows('sample-ti-stu06', 'sample-stu-06', fractionICIds.slice(0, 3), '2026-07-27'),
    taughtICRows('sample-ti-stu07', 'sample-stu-07', fractionICIds.slice(0, 5), '2026-07-28'),
    taughtICRows('sample-ti-stu01', 'sample-stu-01', fractionICIds.slice(0, 4), '2026-07-27'),
    taughtICRows('sample-ti-stu02', 'sample-stu-02', fractionICIds.slice(0, 2), '2026-07-20'),
    taughtICRows('sample-ti-stu08', 'sample-stu-08', fractionICIds.slice(0, 1), '2026-07-20'),

    // AC9E4LY06 — Grace 5/5, Jayden 5/5, Chloe 5/5, Tyler 5/5, Mia 5/5, Ryan 5/5
    // (100%, no Progress yet), Ava 4/5 (80%, already judged), Lucas 3/5.
    taughtICRows('sample-ti-stu11', 'sample-stu-11', persuasiveICIds.slice(0, 5), '2026-08-04'),
    taughtICRows('sample-ti-stu12', 'sample-stu-12', persuasiveICIds.slice(0, 5), '2026-08-04'),
    taughtICRows('sample-ti-stu13', 'sample-stu-13', persuasiveICIds.slice(0, 5), '2026-08-04'),
    taughtICRows('sample-ti-stu14', 'sample-stu-14', persuasiveICIds.slice(0, 5), '2026-08-04'),
    taughtICRows('sample-ti-stu15', 'sample-stu-15', persuasiveICIds.slice(0, 5), '2026-08-04'),
    taughtICRows('sample-ti-stu16', 'sample-stu-16', persuasiveICIds.slice(0, 5), '2026-08-04'),
    taughtICRows('sample-ti-stu17', 'sample-stu-17', persuasiveICIds.slice(0, 4), '2026-07-29'),
    taughtICRows('sample-ti-stu18', 'sample-stu-18', persuasiveICIds.slice(0, 3), '2026-07-22')
  );

  // ── TaughtLog (code-level log entries) ──
  // One entry per student who has any IC coverage recorded against that code —
  // this is what Coverage Gaps' "codes never taught" check reads (wasCodeTaughtToStudent).
  var taughtLog = [].concat(
    ['sample-stu-01', 'sample-stu-02', 'sample-stu-03', 'sample-stu-04', 'sample-stu-05', 'sample-stu-06', 'sample-stu-07', 'sample-stu-08'].map(function (sid, i) {
      return { id: 'sample-tl-m-' + (i + 1), date: '2026-07-27', student_id: sid, code: 'AC9M3N02', notes: '' };
    }),
    ['sample-stu-11', 'sample-stu-12', 'sample-stu-13', 'sample-stu-14', 'sample-stu-15', 'sample-stu-16', 'sample-stu-17', 'sample-stu-18'].map(function (sid, i) {
      return { id: 'sample-tl-e-' + (i + 1), date: '2026-08-04', student_id: sid, code: 'AC9E4LY06', notes: '' };
    })
    // Deliberately nothing logged for AC9S3U02 — it must stay a genuine gap.
  );

  // ── Standards Judgments ──
  // Y4-AS-01 (Maths, auto-loaded from data/MASTER_Achievement_Standards_Maths_AC9_v1.csv)
  // and Year4-AS-8934 (English, linked to AC9E4LY06 — appended to state.standards
  // separately since only the Maths standards CSV is auto-fetched; see extraStandards
  // below). judgment uses the scale ids from DEFAULT_ASSESSMENT_SCALE.
  var standardsJudgments = [
    { id: 'sample-sj-01', student_id: 'sample-stu-11', standard_id: 'Y4-AS-01', judgment: 'competent', locked: true, date: '2026-07-25', notes: '', period: 'Semester 2 2026' },
    { id: 'sample-sj-02', student_id: 'sample-stu-12', standard_id: 'Y4-AS-01', judgment: 'highly-competent', locked: false, date: '2026-07-25', notes: '', period: 'Semester 2 2026' },
    { id: 'sample-sj-03', student_id: 'sample-stu-15', standard_id: 'Y4-AS-01', judgment: 'developing', locked: false, date: '2026-07-25', notes: '', period: 'Semester 2 2026' },
    { id: 'sample-sj-04', student_id: 'sample-stu-13', standard_id: 'Year4-AS-8934', judgment: 'competent', locked: true, date: '2026-08-04', notes: '', period: 'Semester 2 2026' },
    { id: 'sample-sj-05', student_id: 'sample-stu-16', standard_id: 'Year4-AS-8934', judgment: 'not-evident', locked: false, date: '2026-08-04', notes: 'Not yet assessed against the full standard — coverage only.', period: 'Semester 2 2026' },
    { id: 'sample-sj-06', student_id: 'sample-stu-17', standard_id: 'Year4-AS-8934', judgment: 'outstanding', locked: true, date: '2026-08-01', notes: '', period: 'Semester 2 2026' },
  ];

  // Appended to state.standards (which auto-loads Maths-only standards on every
  // boot — see fetchAllCSVs) so the English standard referenced above has a row to
  // join against. Row shape/text copied verbatim from
  // data/MASTER_Achievement_Standards_ALLCODES.csv so it matches real content.
  // This append is fixture-specific plumbing to work around that Maths-only auto-load,
  // not a general fix — it says nothing about whether English standards loading works
  // end-to-end in the real (non-sample) app, which still only ever auto-loads Maths.
  var extraStandards = [
    {
      'Achievement Standard ID': 'Year4-AS-8934',
      'Year Level': 'Year 4',
      'Subject': 'English',
      'Standard Text': 'They create written and/or multimodal texts including stories for purposes and audiences, where they develop ideas using details from learnt topics, topics of interest or texts.',
      'Codes': 'AC9E4LA03, AC9E4LA04, AC9E4LA06, AC9E4LA07, AC9E4LA08, AC9E4LA10, AC9E4LE05, AC9E4LY06',
      'Category': '',
      'Linked Content Descriptor Codes': 'AC9E4LA03, AC9E4LA04, AC9E4LA06, AC9E4LA07, AC9E4LA08, AC9E4LA10, AC9E4LE05, AC9E4LY06',
    },
  ];

  // ── Progression Placements ──
  // Numeracy Progression — Number sense and algebra / Number and place value —
  // real element/sub-element/level values from
  // data/Numeracy_Progressions_v9_MASTER_Level_Aligned.csv. Plus 2 Literacy
  // Progression placements — real element/sub-element/level values from
  // data/literacy progressions.csv — so the Progression Placement screen's
  // Literacy/Numeracy split is exercised on both sides, not just Numeracy.
  var progressionPlacements = [
    { id: 'sample-pp-01', student_id: 'sample-stu-01', element: 'Number sense and algebra', sub_element: 'Number and place value', level: '2', date: '2026-07-24', notes: '', ext_label: '', ext_value: '' },
    { id: 'sample-pp-02', student_id: 'sample-stu-02', element: 'Number sense and algebra', sub_element: 'Number and place value', level: '1', date: '2026-07-24', notes: '', ext_label: '', ext_value: '' },
    { id: 'sample-pp-03', student_id: 'sample-stu-05', element: 'Number sense and algebra', sub_element: 'Number and place value', level: '1', date: '2026-07-24', notes: '', ext_label: '', ext_value: '' },
    { id: 'sample-pp-04', student_id: 'sample-stu-06', element: 'Number sense and algebra', sub_element: 'Number and place value', level: '2', date: '2026-07-24', notes: '', ext_label: '', ext_value: '' },
    { id: 'sample-pp-05', student_id: 'sample-stu-08', element: 'Writing', sub_element: 'Creating texts', level: 'Level 6', date: '2026-07-24', notes: '', ext_label: '', ext_value: '' },
    { id: 'sample-pp-06', student_id: 'sample-stu-11', element: 'Reading and viewing', sub_element: 'Understanding texts', level: 'Level 7', date: '2026-07-24', notes: '', ext_label: '', ext_value: '' },
  ];

  window.CT_SAMPLE_TEST_MODE_DATA = {
    classSettings: classSettings,
    students: students,
    units: units,
    lessons: lessons,
    instructionalComponents: instructionalComponents,
    progress: progress,
    taughtICs: taughtICs,
    taughtLog: taughtLog,
    standardsJudgments: standardsJudgments,
    extraStandards: extraStandards,
    progressionPlacements: progressionPlacements,
  };
})();
