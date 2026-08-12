// Headless test suite for the Weekly Planner unit-lesson scheduling feature (PR2).
//
// There is no build step and the app is a single browser script (app.js). This
// harness evaluates app.js inside a Node `vm` context with a minimal stubbed DOM,
// then drives the real handler functions and asserts on the live `state`.
//
// Run with:  node tests/planner-scheduling.test.js
//
// Covers: scheduling a unit lesson via drag, scheduling via the drawer fallback,
// multi-slot scheduling (incl. across weeks) of the same lesson, single-slot
// removal, the board rendering the same lesson once per slot, teachingStatus
// staying independent, and standalone lesson behaviour being unchanged.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

process.on('unhandledRejection', () => {}); // init()'s network fetches reject in Node — ignore

// ── Minimal DOM / browser stubs ───────────────────────────────────────────────
function makeStubEl() {
  const el = {
    style: {}, className: '', id: '', innerHTML: '', textContent: '', value: '',
    dataset: {}, scrollTop: 0, firstChild: null,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, remove() {}, insertBefore() {},
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, getBoundingClientRect() { return {}; },
  };
  return el;
}

const elCache = {};
const documentStub = {
  addEventListener() {}, removeEventListener() {},
  getElementById(id) { return elCache[id] || (elCache[id] = makeStubEl()); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return makeStubEl(); },
  body: makeStubEl(),
  documentElement: makeStubEl(),
};

const store = {};
const localStorageStub = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
  clear() { for (const k of Object.keys(store)) delete store[k]; },
};

let windowOpenCalls = [];
const windowStub = {
  addEventListener() {}, removeEventListener() {},
  matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
  localStorage: localStorageStub,
  document: documentStub,
  open(url, target, features) { windowOpenCalls.push({ url, target, features }); },
};

const sandbox = {
  console,
  document: documentStub,
  window: windowStub,
  localStorage: localStorageStub,
  navigator: { userAgent: 'node-test' },
  location: { href: '', search: '', hash: '' },
  setTimeout, clearTimeout, setInterval, clearInterval,
  // Never resolves: app.js calls init() on load and fetches CSVs/Sheets. A pending
  // promise leaves that boot work hanging harmlessly instead of logging network errors.
  fetch: () => new Promise(() => {}),
  alert() {}, confirm() { return true; }, prompt() { return null; },
  CSS: { escape: (s) => String(s) },
  Date, Math, JSON,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Evaluate app.js, then expose the lexically-scoped `state` for the harness. Also expose a
// helper that runs a literal inline-handler code string (e.g. the exact text of an
// onkeydown="..." attribute pulled out of rendered markup) as a real function *inside this
// same vm context* — so a test can execute the actual JS the browser would run, against a
// synthetic event, rather than re-deriving the same behaviour by calling a function directly.
// Inline handlers in a real browser run with `this` bound to the element the attribute is
// on, so thisArg is passed through via .call() to match that (none of our current inline
// handlers reference `this`, but the helper should still be faithful to browser semantics).
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
vm.runInContext(
  appSrc +
  '\n;globalThis.__getState = function(){ return state; };\n' +
  ';globalThis.__getDlState = function(){ return dlState; };\n' +
  ';globalThis.__runInlineHandler = function(code, evt, thisArg){ return (new Function("event", code)).call(thisArg, evt); };\n' +
  // const/let top-level bindings (unlike function declarations) don't attach to the
  // vm context object, so PLANNER_GLOSSARY etc. aren't reachable as GLOSSARY.PLANNER_GLOSSARY
  // — expose them explicitly, same convention as __getState/__getDlState above.
  ';globalThis.__getGlossary = function(){ return { PLANNER_GLOSSARY, PLANNER_CONFIDENCE_GLOSSARY, PLANNER_STATUS_GLOSSARY, UNIT_TEACHING_STATUSES }; };\n' +
  ';globalThis.__getPlannerSubjectConstants = function(){ return { PLANNER_SUBJECTS, BANDED_SUBJECTS }; };\n',
  sandbox,
  { filename: 'app.js' }
);

// Quiet the heavy render path and capture toasts (override the global object props).
let toasts = [];
const realRenderView = sandbox.renderView;
sandbox.renderView = function () {};
sandbox.toast = function (msg, type) { toasts.push({ msg, type }); };

const getState = sandbox.__getState;
const getDlState = sandbox.__getDlState;
const GLOSSARY = sandbox.__getGlossary();
const PLANNER_SUBJECT_CONSTANTS = sandbox.__getPlannerSubjectConstants();

// Objects created inside the vm context have a different prototype than this realm,
// so assert.deepStrictEqual reports them as "not reference-equal". Compare by value.
function eqJson(actual, expected, msg) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);
}

// ── Test scaffolding ──────────────────────────────────────────────────────────
let passed = 0;
const failures = [];
function test(name, fn) {
  toasts = [];
  windowOpenCalls = [];
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failures.push({ name, e }); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}

// Rare — only when a test genuinely needs to await a real async app function to
// completion (its full promise chain settled, not just the synchronous portion
// before its first internal await) to observe the resulting state. Queued and run
// after every synchronous test() above, right before the final summary, so the
// normal synchronous suite (the vast majority of tests) is completely unaffected.
const asyncTests = [];
function testAsync(name, fn) {
  asyncTests.push({ name, fn });
}

const WEEK_A = '2026-06-29'; // a Monday
const WEEK_B = '2026-07-06'; // the following Monday

// Reset state to a known fixture: one unit with two lessons, plus one standalone lesson.
function resetState() {
  const st = getState();
  st.instructionalComponents = [];
  st.curriculumCodes = [];
  st.taughtICs = [];
  st.students = [];
  st.currentView = 'planner';
  st.unitPlans = [
    { id: 'unit_1', title: 'Fractions', subject: 'Mathematics', yearLevel: '3', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: ['ul_1', 'ul_2'], createdAt: '2026-01-01T00:00:00.000Z' },
  ];
  st.lessonPlans = [
    sandbox.normalizeLessonPlan({ id: 'ul_1', title: 'Intro to fractions', subject: 'Mathematics', unitId: 'unit_1', teachingStatus: 'planned', linkedICIds: [] }),
    sandbox.normalizeLessonPlan({ id: 'ul_2', title: 'Equivalent fractions', subject: 'Mathematics', unitId: 'unit_1', teachingStatus: 'reteach', linkedICIds: [] }),
    sandbox.normalizeLessonPlan({ id: 'sa_1', title: 'Spelling test', subject: 'English', weekKey: WEEK_A, dayKey: 'unscheduled', linkedICIds: [] }),
  ];
  sandbox.plannerEnsureUiState();
  st.plannerUi.weekKey = WEEK_A;
  st.plannerUi.selectedLessonId = null;
  st.plannerUi.drawerOpen = false;
  st.plannerUi.drawerMode = 'view';
  st.plannerUi.draggingLessonId = null;
  st.plannerUi.draggingSlot = null;
  st.plannerUi.insertionTarget = null;
  st.plannerUi.dayOrder = {};
  st.plannerUi.openResourcePopoverCardKey = null;
  st.plannerUi.railCollapsed = false;
  st.plannerUi.drawerCollapsed = false;
  st.plannerUi.railSearch = '';
  st.plannerUi.railSubjectFilter = '';
  st.plannerUi.railGroupsCollapsed = {};

  sandbox.unitPlansEnsureUiState();
  st.unitPlansUi.listSearch = '';
  st.unitPlansUi.listSubjectFilter = '';
}

function lessonById(id) { return getState().lessonPlans.find(l => l.id === id); }

// A fake HTML5 drag-drop event carrying a lessonId in dataTransfer.
function dropEvent(lessonId) {
  return {
    preventDefault() {},
    stopPropagation() {},
    currentTarget: { classList: { add() {}, remove() {} } },
    dataTransfer: { getData() { return lessonId; }, setData() {}, effectAllowed: '' },
  };
}

// Pulls the opening tag of the outermost element whose class attribute starts with
// classPrefix (e.g. 'planner-lesson-card ') out of rendered card markup, so a test can
// inspect exactly the attributes the browser would parse off that one element.
function extractOpenTag(html, classPrefix) {
  const marker = 'class="' + classPrefix;
  const idx = html.indexOf(marker);
  assert.ok(idx !== -1, 'expected to find an element with class prefix: ' + classPrefix);
  const closeIdx = html.indexOf('>', idx);
  return html.slice(0, closeIdx).slice(html.lastIndexOf('<', idx));
}

function extractAttr(tagSrc, attrName) {
  const m = tagSrc.match(new RegExp(attrName + '="([^"]*)"'));
  return m ? m[1] : null;
}

// Fires the literal source of an inline onkeydown="..." attribute (extracted from real
// rendered markup) against a synthetic KeyboardEvent-like object, inside the same vm
// context app.js was evaluated in — so `event.key`, `preventDefault()` and any bare
// identifiers the code references (e.g. plannerOpenLessonDrawerFromCard) all resolve
// exactly as they would for a real browser-dispatched keydown. `this` is bound to a stub
// element, matching real inline-handler semantics (this === the element), in case a
// future inline handler ever comes to depend on it.
function fireInlineKeydown(code, key) {
  const evt = { key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  const stubCardElement = { classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
  sandbox.__runInlineHandler(code, evt, stubCardElement);
  return evt;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
console.log('Weekly Planner unit-lesson scheduling (PR2)');

test('drag schedules a unit lesson onto a day (appends one slot)', () => {
  resetState();
  sandbox.plannerStartLessonDrag(dropEvent('ul_1'), 'ul_1');
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'mon');
  const slots = lessonById('ul_1').scheduledSlots;
  eqJson(slots, [{ weekKey: WEEK_A, dayKey: 'mon' }]);
});

test('drag persists the slot to localStorage', () => {
  resetState();
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'tue');
  const saved = JSON.parse(localStorageStub.getItem('ct_planner_lessons_v2'));
  const savedLesson = saved.find(l => l.id === 'ul_1');
  eqJson(savedLesson.scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'tue' }]);
});

test('drawer fallback schedules a unit lesson without dragging', () => {
  resetState();
  documentStub.getElementById('unit-schedule-week').value = WEEK_B;
  documentStub.getElementById('unit-schedule-day').value = 'thu';
  sandbox.unitScheduleLessonFromDrawer('ul_1');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_B, dayKey: 'thu' }]);
  assert.ok(toasts.some(t => t.type === 'success'), 'expected a success toast from the drawer add');
});

test('multi-slot: same lesson scheduled to several days across two weeks', () => {
  resetState();
  assert.strictEqual(sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon'), true);
  assert.strictEqual(sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed'), true);
  assert.strictEqual(sandbox.plannerScheduleUnitLesson('ul_1', WEEK_B, 'mon'), true);
  eqJson(lessonById('ul_1').scheduledSlots, [
    { weekKey: WEEK_A, dayKey: 'mon' },
    { weekKey: WEEK_A, dayKey: 'wed' },
    { weekKey: WEEK_B, dayKey: 'mon' },
  ]);
});

test('scheduling the same week+day twice is a de-duped no-op', () => {
  resetState();
  assert.strictEqual(sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon'), true);
  assert.strictEqual(sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon'), false);
  assert.strictEqual(lessonById('ul_1').scheduledSlots.length, 1);
  assert.ok(toasts.some(t => /already scheduled/i.test(t.msg)), 'expected an "already scheduled" toast');
});

test('dropping a unit lesson on the Unscheduled column adds no slot', () => {
  resetState();
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'unscheduled');
  assert.strictEqual(lessonById('ul_1').scheduledSlots.length, 0);
});

test('single-slot removal deletes only that occurrence', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_B, 'mon');
  sandbox.plannerUnscheduleSlot('ul_1', WEEK_A, 'mon');
  eqJson(lessonById('ul_1').scheduledSlots, [
    { weekKey: WEEK_A, dayKey: 'wed' },
    { weekKey: WEEK_B, dayKey: 'mon' },
  ]);
});

test('scheduling and unscheduling never change teachingStatus', () => {
  resetState();
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach');
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_A, 'mon');
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'schedule must not touch teachingStatus');
  sandbox.plannerUnscheduleSlot('ul_2', WEEK_A, 'mon');
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'unschedule must not touch teachingStatus');
});

test('board renders the same lesson once per matching slot, scoped to the week', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_B, 'mon');

  const countOccurrences = (html) => (html.match(/planner-occ-wrap/g) || []).length;

  getState().plannerUi.weekKey = WEEK_A;
  realRenderView();
  const weekAHtml = documentStub.getElementById('main-content').innerHTML;
  assert.strictEqual(countOccurrences(weekAHtml), 2, 'week A should render 2 occurrences (mon + wed)');

  getState().plannerUi.weekKey = WEEK_B;
  realRenderView();
  const weekBHtml = documentStub.getElementById('main-content').innerHTML;
  assert.strictEqual(countOccurrences(weekBHtml), 1, 'week B should render 1 occurrence (mon)');
});

test('unit rail lists all unit lessons (scheduled or not), grouped by unit', () => {
  resetState();
  let html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions'), 'lesson should appear in the rail');
  assert.ok(html.includes('Equivalent fractions'), 'lesson should appear in the rail');
  assert.ok(html.includes('Fractions'), 'rail should group by unit title');

  // Scheduling a lesson must NOT remove it from the rail (so more slots can be dragged on).
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions'), 'a scheduled lesson should stay in the rail');
  assert.ok(html.includes('Equivalent fractions'), 'the other lesson should stay in the rail');
});

test('rail card shows slot count and stays draggable after scheduling', () => {
  resetState();
  // ul_2 has no slots yet.
  let html = sandbox.plannerUnitSidebarLessonHtml(lessonById('ul_2'));
  assert.ok(/draggable="true"/.test(html), 'rail card must be draggable');
  assert.ok(html.includes('plannerStartLessonDrag'), 'rail card must wire the drag-start handler');
  assert.ok(/0 slots/.test(html), 'an unscheduled lesson shows "0 slots"');

  // Schedule ul_1 twice, then confirm it still renders, is still draggable, and shows the count.
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  html = sandbox.plannerUnitSidebarLessonHtml(lessonById('ul_1'));
  assert.ok(/draggable="true"/.test(html), 'a scheduled rail card must remain draggable');
  assert.ok(html.includes('plannerStartLessonDrag'), 'a scheduled rail card must keep the drag handler');
  assert.ok(/2 slots/.test(html), 'rail card should show the current slot count (plural)');

  // Singular label with exactly one slot.
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_B, 'thu');
  const html1 = sandbox.plannerUnitSidebarLessonHtml(lessonById('ul_2'));
  assert.ok(/1 slot(?!s)/.test(html1), 'a lesson with one slot shows "1 slot" (singular)');
});

test('rail empty state shows only when no unit has any lessons', () => {
  resetState();
  const st = getState();
  // Units exist but with no lessons -> empty state, not the units.
  st.unitPlans = [{ id: 'u_empty', title: 'Empty Unit', subject: '', yearLevel: '', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: [], createdAt: '2026-01-01T00:00:00.000Z' }];
  st.lessonPlans = [];
  let html = sandbox.plannerUnitSidebarHtml();
  assert.ok(/no unit lessons yet/i.test(html), 'empty state should show when no unit has lessons');
  assert.ok(!/all unit lessons are scheduled/i.test(html), 'the old "all scheduled" empty state must be gone');

  // No units at all -> the "no units" empty state.
  st.unitPlans = [];
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(/no units yet/i.test(html), 'empty state should show when there are no units');
});

// ── Unit lessons rail: search + subject filter ───────────────────────────────────
console.log('Unit lessons rail search/subject filter');

test('unit rail search matches lesson title, hiding only the non-matching lesson(s) within an otherwise-matching unit group', () => {
  resetState();
  const st = getState();
  let html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions') && html.includes('Equivalent fractions'), 'sanity: both lessons show with no filter');

  st.plannerUi.railSearch = 'intro';
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions'), 'the matching lesson still shows');
  assert.ok(!html.includes('Equivalent fractions'), 'the non-matching lesson in the SAME unit group is hidden, not the whole group');
  assert.ok(html.includes('Fractions'), 'the unit group header still shows since at least one of its lessons matched');
});

test('unit rail search is case-insensitive on lesson title', () => {
  resetState();
  const st = getState();
  st.plannerUi.railSearch = 'INTRO'; // uppercase, should still match "Intro to fractions" (lowercase "intro")
  const html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions'), 'search must be case-insensitive');
  assert.ok(!html.includes('Equivalent fractions'), 'sanity: the other lesson still does not match');
});

test('unit rail search matches lesson title only, not unit title — a term found only in the unit title matches no lessons', () => {
  resetState();
  const st = getState();
  // Rename the unit to a term that appears in neither lesson's title (both lesson
  // titles already happen to contain "fractions", so the unit's default fixture
  // title can't isolate this case on its own).
  st.unitPlans.find(u => u.id === 'unit_1').title = 'Numeracy Block One';
  st.plannerUi.railSearch = 'numeracy';
  const html = sandbox.plannerUnitSidebarHtml();
  assert.ok(!html.includes('Intro to fractions') && !html.includes('Equivalent fractions'), 'a term matching only the unit title (not any lesson title) must show nothing — search is lesson-title-only per the task');
  assert.ok(/no unit lessons match/i.test(html), 'the no-match empty state should show instead');
});

test('unit rail subject filter hides an entire unit group even if one of its lessons would otherwise match the search', () => {
  resetState();
  const st = getState();
  st.unitPlans.push({ id: 'unit_2', title: 'Persuasive Writing', subject: 'English', yearLevel: '3', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: ['ul_3'], createdAt: '2026-01-02T00:00:00.000Z' });
  st.lessonPlans.push(sandbox.normalizeLessonPlan({ id: 'ul_3', title: 'Persuasive intro', subject: 'English', unitId: 'unit_2', teachingStatus: 'planned', linkedICIds: [] }));

  st.plannerUi.railSubjectFilter = 'Mathematics';
  let html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions'), 'Mathematics unit lessons still show');
  assert.ok(!html.includes('Persuasive intro'), 'the English unit group is excluded entirely by the subject filter');

  st.plannerUi.railSubjectFilter = 'English';
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(!html.includes('Intro to fractions') && !html.includes('Equivalent fractions'), 'the Mathematics unit group is now excluded entirely');
  assert.ok(html.includes('Persuasive intro'), 'the English unit lesson shows');
});

test('unit rail search and subject filter combine with AND', () => {
  resetState();
  const st = getState();
  st.plannerUi.railSubjectFilter = 'Mathematics';
  st.plannerUi.railSearch = 'equivalent';
  const html = sandbox.plannerUnitSidebarHtml();
  assert.ok(!html.includes('Intro to fractions'), 'a lesson matching the subject but not the search stays hidden');
  assert.ok(html.includes('Equivalent fractions'), 'a lesson matching both search and subject shows');
});

test('unit rail subject filter matches each lesson\'s OWN subject, not its parent unit\'s — a lesson subject can genuinely diverge since it\'s independently editable and unitUpdateField never propagates to existing lessons', () => {
  resetState();
  const st = getState();
  // ul_2 ("Equivalent fractions") is edited independently to a different subject than
  // its parent unit_1 (Mathematics) — a supported, real state, not a data-integrity bug.
  st.lessonPlans.find(l => l.id === 'ul_2').subject = 'English';

  st.plannerUi.railSubjectFilter = 'English';
  let html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Equivalent fractions'), 'the lesson\'s own (English) subject must be honoured, even though its unit is Mathematics');
  assert.ok(!html.includes('Intro to fractions'), 'the sibling lesson, still genuinely Mathematics, must not show under the English filter');

  st.plannerUi.railSubjectFilter = 'Mathematics';
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions'), 'the still-Mathematics sibling lesson shows');
  assert.ok(!html.includes('Equivalent fractions'), 'the now-English lesson must not show under the Mathematics filter just because its unit is Mathematics');
});

test('unit rail filtering is UI-only — never mutates state.lessonPlans or state.unitPlans', () => {
  resetState();
  const st = getState();
  const beforeLessons = JSON.stringify(st.lessonPlans);
  const beforeUnits = JSON.stringify(st.unitPlans);
  st.plannerUi.railSearch = 'intro';
  st.plannerUi.railSubjectFilter = 'Mathematics';
  sandbox.plannerUnitSidebarHtml();
  assert.strictEqual(JSON.stringify(st.lessonPlans), beforeLessons, 'lessonPlans must be untouched by filtering');
  assert.strictEqual(JSON.stringify(st.unitPlans), beforeUnits, 'unitPlans must be untouched by filtering');
});

test('plannerRailHandleSearchInput/plannerRailHandleSubjectFilter update state and refresh only the #planner-unit-rail-body container (not a full re-render), and plannerRailClearFilters resets both fields', () => {
  resetState();
  const st = getState();
  sandbox.plannerRailHandleSearchInput('intro');
  assert.strictEqual(st.plannerUi.railSearch, 'intro');
  const bodyEl = documentStub.getElementById('planner-unit-rail-body');
  assert.ok(bodyEl.innerHTML.includes('Intro to fractions') && !bodyEl.innerHTML.includes('Equivalent fractions'), 'the targeted refresh writes the filtered rail body html into its own container');

  sandbox.plannerRailHandleSubjectFilter('English');
  assert.strictEqual(st.plannerUi.railSubjectFilter, 'English');

  sandbox.plannerRailClearFilters();
  assert.strictEqual(st.plannerUi.railSearch, '', 'clear resets the search field');
  assert.strictEqual(st.plannerUi.railSubjectFilter, '', 'clear resets the subject filter');
});

// ── Unit lessons rail: per-unit collapsible groups ────────────────────────────────
console.log('Unit lessons rail collapsible groups');

test('unit rail groups default to expanded on first load (unchanged behaviour), and plannerToggleUnitGroupCollapsed collapses only the toggled unit — its heading and lesson count still show, its lessons hide, other groups are untouched', () => {
  resetState();
  const st = getState();
  st.unitPlans.push({ id: 'unit_2', title: 'Persuasive Writing', subject: 'English', yearLevel: '3', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: ['ul_3'], createdAt: '2026-01-02T00:00:00.000Z' });
  st.lessonPlans.push(sandbox.normalizeLessonPlan({ id: 'ul_3', title: 'Persuasive intro', subject: 'English', unitId: 'unit_2', teachingStatus: 'planned', linkedICIds: [] }));

  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), false, 'default collapse state is expanded, matching pre-collapse behaviour');
  let html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions') && html.includes('Equivalent fractions') && html.includes('Persuasive intro'), 'sanity: every group starts expanded');

  sandbox.plannerToggleUnitGroupCollapsed('unit_1');
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true);
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(!html.includes('Intro to fractions') && !html.includes('Equivalent fractions'), 'unit_1 lessons are hidden once its group is collapsed');
  assert.ok(html.includes('Fractions'), 'the heading itself must stay visible when collapsed');
  assert.ok(/2 lessons/.test(html), 'the lesson count still shows on a collapsed heading');
  assert.ok(html.includes('Persuasive intro'), 'unit_2, never toggled, remains expanded and untouched');

  sandbox.plannerToggleUnitGroupCollapsed('unit_1');
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), false);
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions') && html.includes('Equivalent fractions'), 'toggling again re-expands unit_1');
});

test('plannerToggleUnitGroupCollapsed does a targeted refresh of #planner-unit-rail-body, not a full re-render — same convention as the search/subject filter inputs', () => {
  resetState();
  sandbox.plannerToggleUnitGroupCollapsed('unit_1');
  const bodyEl = documentStub.getElementById('planner-unit-rail-body');
  assert.ok(!bodyEl.innerHTML.includes('Intro to fractions'), 'the targeted refresh writes the now-collapsed rail body html into its own container');
  assert.ok(bodyEl.innerHTML.includes('Fractions'), 'the collapsed heading still renders into that same container');
});

test('a manually-collapsed unit group stays collapsed under a SUBJECT filter, even when the filter matches a lesson inside it — force-open/disable-toggle was removed as friction (review-cycle history: force-open was added, then made partial-match-aware, then removed outright per this fix); manual collapse is now always respected, filter active or not', () => {
  resetState();
  const st = getState();
  sandbox.plannerToggleUnitGroupCollapsed('unit_1'); // manually collapse Fractions
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true, 'sanity: collapsed with no filter active');

  st.plannerUi.railSubjectFilter = 'Mathematics'; // unit_1's own subject — matches both its lessons
  let html = sandbox.plannerUnitSidebarHtml();
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true, 'a subject filter must leave manual collapse state respected, not force it open');
  assert.ok(!html.includes('Intro to fractions') && !html.includes('Equivalent fractions'), 'unit_1 stays collapsed — its lessons must not render, even though they match the filter');
  assert.ok(html.includes('Fractions') && /2 lessons/.test(html), 'the heading and count still show, so there\'s a visible signal that matching content exists inside');
  assert.ok(!html.includes('disabled'), 'the collapse toggle must never be disabled');

  st.plannerUi.railSubjectFilter = '';
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(!html.includes('Intro to fractions'), 'collapse state persists correctly once the filter clears too — nothing to "restore", since it was never overridden');
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true);
});

test('a manually-collapsed unit group stays collapsed under a SEARCH term, even when it matches a lesson inside it — same "manual control always wins" behaviour as the subject-filter case', () => {
  resetState();
  const st = getState();
  sandbox.plannerToggleUnitGroupCollapsed('unit_1'); // manually collapse Fractions
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true, 'sanity: collapsed with no filter active');

  st.plannerUi.railSearch = 'intro'; // matches "Intro to fractions", one of unit_1's lessons
  let html = sandbox.plannerUnitSidebarHtml();
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true, 'a search term must leave manual collapse state respected, not force it open');
  assert.ok(!html.includes('Intro to fractions'), 'the matching lesson stays hidden behind the collapsed heading — the group heading/count is the visible signal instead');
  assert.ok(html.includes('Fractions') && /1 lesson\b/.test(html), 'the heading and the FILTERED count (1, not 2) still show — plannerRailFilteredGroups itself is untouched by this fix');
  assert.ok(!html.includes('disabled'), 'the collapse toggle must never be disabled, search or not');

  // Manually expanding it under an active search must work normally too — the toggle
  // is a real, working onclick, never disabled.
  sandbox.plannerToggleUnitGroupCollapsed('unit_1');
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions'), 'toggling open under an active search must work exactly like toggling open with no filter');
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), false);

  st.plannerUi.railSearch = '';
  html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('Intro to fractions') && html.includes('Equivalent fractions'), 'collapse state (now expanded) persists correctly once the search clears');
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), false);
});

test('plannerUnitGroupIsCollapsed depends purely on state.plannerUi.railGroupsCollapsed — no filter state can change its result for a given unit id', () => {
  resetState();
  const st = getState();
  sandbox.plannerToggleUnitGroupCollapsed('unit_1');
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true);

  st.plannerUi.railSearch = 'intro';
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true, 'search active');
  st.plannerUi.railSubjectFilter = 'Mathematics';
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true, 'search + subject both active');
  st.plannerUi.railSearch = '';
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true, 'subject only');
  st.plannerUi.railSubjectFilter = '';
  assert.strictEqual(sandbox.plannerUnitGroupIsCollapsed('unit_1'), true, 'no filter');
});

test('unit rail group collapse toggling is UI-only — never mutates state.lessonPlans or state.unitPlans', () => {
  resetState();
  const st = getState();
  const beforeLessons = JSON.stringify(st.lessonPlans);
  const beforeUnits = JSON.stringify(st.unitPlans);
  sandbox.plannerToggleUnitGroupCollapsed('unit_1');
  sandbox.plannerUnitSidebarHtml();
  assert.strictEqual(JSON.stringify(st.lessonPlans), beforeLessons, 'lessonPlans must be untouched by collapsing a group');
  assert.strictEqual(JSON.stringify(st.unitPlans), beforeUnits, 'unitPlans must be untouched by collapsing a group');
});

test('plannerToggleUnitGroupCollapsed re-focuses the toggled group\'s heading after the rail body rebuild, so a keyboard user activating it with Enter/Space is not dropped back to the document (review finding)', () => {
  resetState();
  // The stub rail body's querySelector always returns null (no real DOM tree) — stand
  // in for the heading button a real browser would re-focus, same convention already
  // used to test plannerToggleICSuggestionGroup's identical focus-restore.
  const container = documentStub.getElementById('planner-unit-rail-body');
  const fakeHeading = { focused: false, focus() { this.focused = true; } };
  const realQuerySelector = container.querySelector;
  container.querySelector = (selector) => selector === '[data-unit-id="unit_1"]' ? fakeHeading : realQuerySelector(selector);

  sandbox.plannerToggleUnitGroupCollapsed('unit_1');

  assert.ok(fakeHeading.focused, 'the toggled unit group\'s heading should be re-focused after the rail body rebuild, same as plannerToggleICSuggestionGroup already does');
  container.querySelector = realQuerySelector;
});

test('each unit group heading carries a data-unit-id attribute matching its unit, so plannerToggleUnitGroupCollapsed\'s focus-restore query can find it in a real DOM', () => {
  resetState();
  const html = sandbox.plannerUnitSidebarHtml();
  assert.ok(html.includes('data-unit-id="unit_1"'), 'the heading button must expose the unit id for the focus-restore selector to target');
});

test('.planner-unit-group-count uses the scalable --label-size token, not a fixed px value, so it stays readable under the large-text preference (review finding)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const rule = css.match(/\.planner-unit-group-count\s*\{[^}]*\}/)[0];
  assert.ok(/font-size:\s*var\(--label-size\)/.test(rule), 'the lesson count must scale with --label-size like the sibling heading text (.planner-unit-group-head), not a hardcoded px value');
});

// ── Unit Plans list view: search + subject filter ────────────────────────────────
console.log('Unit Plans list-view search/subject filter');

test('unitListFilteredUnits matches unit title case-insensitively and drops non-matching units entirely', () => {
  resetState();
  const st = getState();
  st.unitPlans.push({ id: 'unit_2', title: 'Persuasive Writing', subject: 'English', yearLevel: '3', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: [], createdAt: '2026-01-02T00:00:00.000Z' });

  st.unitPlansUi.listSearch = 'fract';
  let filtered = sandbox.unitListFilteredUnits(st.unitPlans);
  eqJson(filtered.map(u => u.id), ['unit_1']);

  st.unitPlansUi.listSearch = 'FRACTIONS'; // case-insensitive
  filtered = sandbox.unitListFilteredUnits(st.unitPlans);
  eqJson(filtered.map(u => u.id), ['unit_1']);
});

test('unitListFilteredUnits subject filter is an exact match and combines with search via AND', () => {
  resetState();
  const st = getState();
  // Same search term ("fractions") matches BOTH units by title; the subject filter narrows to one.
  st.unitPlans.push({ id: 'unit_2', title: 'Fractions of speech', subject: 'English', yearLevel: '3', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: [], createdAt: '2026-01-02T00:00:00.000Z' });

  st.unitPlansUi.listSearch = 'fractions';
  st.unitPlansUi.listSubjectFilter = 'English';
  const filtered = sandbox.unitListFilteredUnits(st.unitPlans);
  eqJson(filtered.map(u => u.id), ['unit_2']);
});

test('unitListBodyHtml shows a distinct "no units match" empty state when a filter matches nothing, and never mutates state.unitPlans', () => {
  resetState();
  const st = getState();
  st.unitPlansUi.listSearch = 'this unit does not exist anywhere';
  const before = JSON.stringify(st.unitPlans);
  const html = sandbox.unitListBodyHtml(st.unitPlans);
  assert.ok(/no units match/i.test(html), 'a distinct no-match message should show, not a blank/broken-looking list');
  assert.ok(!html.includes('unit-card-grid'), 'the card grid itself must not render when nothing matches');
  assert.strictEqual(JSON.stringify(st.unitPlans), before, 'filtering must never mutate state.unitPlans');
});

test('unitListBodyHtml still shows the original "No units yet" empty state when there truly are no units (distinct from the filtered-to-empty message)', () => {
  resetState();
  const st = getState();
  st.unitPlans = [];
  const html = sandbox.unitListBodyHtml(st.unitPlans);
  assert.ok(/no units yet/i.test(html));
  assert.ok(!/no units match/i.test(html));
});

test('unitListHandleSearchInput/unitListHandleSubjectFilter update state and refresh only #unit-list-body, and unitListClearFilters resets both fields', () => {
  resetState();
  const st = getState();
  st.unitPlans.push({ id: 'unit_2', title: 'Persuasive Writing', subject: 'English', yearLevel: '3', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: [], createdAt: '2026-01-02T00:00:00.000Z' });

  sandbox.unitListHandleSearchInput('fract');
  assert.strictEqual(st.unitPlansUi.listSearch, 'fract');
  const bodyEl = documentStub.getElementById('unit-list-body');
  assert.ok(bodyEl.innerHTML.includes('unit-card-grid'), 'the refreshed body should render the filtered grid');
  assert.ok(!bodyEl.innerHTML.includes('Persuasive Writing'), 'the non-matching unit is filtered out of the refreshed body');

  sandbox.unitListHandleSubjectFilter('English');
  assert.strictEqual(st.unitPlansUi.listSubjectFilter, 'English');

  sandbox.unitListClearFilters();
  assert.strictEqual(st.unitPlansUi.listSearch, '', 'clear resets the search field');
  assert.strictEqual(st.unitPlansUi.listSubjectFilter, '', 'clear resets the subject filter');
});

test('malformed scheduledSlots entries do not crash render or normalize', () => {
  resetState();
  const st = getState();
  // Simulate stale / hand-edited localStorage: null + partial slot entries mixed with a good one.
  // Mixed bad entries with one good one: null, partial, string-but-invalid
  // ({weekKey:'oops'…}), and a non-week-start weekKey ('2026-07-02' is the Thursday of
  // WEEK_A, not its Monday — would pass ISO validation but never match the board).
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], scheduledSlots: [null, { weekKey: WEEK_A }, { weekKey: 'oops', dayKey: 'zzz' }, { weekKey: '2026-07-02', dayKey: 'thu' }, { weekKey: WEEK_A, dayKey: 'mon' }] };

  // The drawer render must not throw and must show only the well-formed slot.
  st.plannerUi.selectedLessonId = 'ul_1';
  let drawerHtml;
  assert.doesNotThrow(() => { drawerHtml = sandbox.unitLessonScheduleHtml(lessonById('ul_1')); });
  assert.strictEqual((drawerHtml.match(/planner-slot-chip/g) || []).length, 1, 'only the valid slot should render a chip');

  // The board render must not throw either.
  st.plannerUi.selectedLessonId = null;
  st.plannerUi.weekKey = WEEK_A;
  assert.doesNotThrow(() => realRenderView());

  // normalizeLessonPlan should strip the malformed entries.
  const normalized = sandbox.normalizeLessonPlan(lessonById('ul_1'));
  eqJson(normalized.scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon' }]);
});

test('clicking a board occurrence opens that unit lesson in the planner drawer, without navigating away', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  const st = getState();
  st.currentView = 'planner';
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'ul_1', 'should select the clicked lesson');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'should open the lesson drawer');
  assert.strictEqual(st.currentView, 'planner', 'must stay on the Weekly Planner — no navigation to Unit Plans');
});

// ── Click-to-edit + drag scheduled cards between days (UX polish) ───────────────
test('standalone card is a drag handle whose whole body opens the drawer, with no expand icon', () => {
  resetState();
  const html = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  assert.ok(html.includes('draggable="true"'), 'card body should be draggable');
  assert.ok(html.includes('plannerStartLessonDrag'), 'card body should wire the drag-start handler');
  assert.ok(!html.includes('planner-card-expand'), 'the expand icon must be gone — the whole card is the only affordance now');
  assert.ok(!html.includes('planner-card-edit'), 'the old pencil class must be gone');
  assert.ok(!html.includes('✎') && !html.includes('⤢'), 'neither the pencil nor the expand glyph should render');
  // The open expression appears exactly twice now: the card body's own onclick and its
  // onkeydown (Enter/Space) — there is no separate icon click handler any more.
  const matches = html.match(/plannerOpenLessonDrawerFromCard\('sa_1'\)/g) || [];
  assert.strictEqual(matches.length, 2, 'card onclick + card onkeydown should be the only two wirings of the open handler');
  assert.ok(/class="planner-lesson-card[^"]*"[\s\S]{0,300}?role="button" tabindex="0"[\s\S]{0,120}?onclick="plannerOpenLessonDrawerFromCard\('sa_1'\)"/.test(html), 'the card body itself must carry the click handler');
  assert.ok(html.includes("onkeydown=\"if(event.key==='Enter'||event.key===' '){event.preventDefault();plannerOpenLessonDrawerFromCard('sa_1')}\""), 'the card body should be keyboard-activatable (Enter/Space) too');
});

test('unit occurrence card: whole body opens the drawer (not navigation), no expand icon, ✕ remove unaffected', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  const html = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  assert.ok(html.includes('draggable="true"'), 'occurrence card should be draggable');
  assert.ok(html.includes('plannerStartOccurrenceDrag'), 'occurrence card should wire the occurrence drag-start');
  assert.ok(!html.includes('planner-card-expand'), 'the expand icon must be gone from unit occurrence cards too');
  assert.ok(!html.includes('planner-card-edit'), 'the old pencil class must be gone');
  // Card onclick + card onkeydown only, same as the standalone card — no icon click left.
  const matches = html.match(/plannerOpenLessonDrawerFromCard\('ul_1'\)/g) || [];
  assert.strictEqual(matches.length, 2, 'card onclick + card onkeydown should be the only two wirings of the open handler');
  assert.ok(/class="planner-lesson-card is-unit[^"]*"[\s\S]{0,300}?role="button" tabindex="0"[\s\S]{0,120}?onclick="plannerOpenLessonDrawerFromCard\('ul_1'\)"/.test(html), 'the card body itself must carry the click handler');
  assert.ok(html.includes('planner-occ-remove'), 'occurrence card should keep the ✕ remove control');
  assert.ok(html.includes('plannerUnscheduleSlot'), 'the ✕ should unschedule this slot');
  // The ✕ must stop propagation so clicking it can never also trigger the card's own
  // click-to-open handler underneath it.
  assert.ok(/planner-occ-remove[\s\S]*?onclick="event\.stopPropagation\(\);plannerUnscheduleSlot/.test(html), 'the ✕ must stop propagation before unscheduling');
});

test('the ✕ remove control stops keydown propagation too, so Enter/Space on it cannot also fire the parent card\'s open-drawer handler', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  const occHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  // keydown bubbles independently of click, so stopping propagation only in onclick is not
  // enough — without this, pressing Enter/Space on the focused ✕ button would unschedule the
  // slot AND trigger the parent card's onkeydown (open drawer) in the same keystroke.
  assert.ok(/planner-occ-remove[\s\S]*?onkeydown="event\.stopPropagation\(\)"/.test(occHtml), 'the ✕ remove button must stop keydown propagation');
});

test('clicking the card body opens the drawer, for both card types', () => {
  resetState();
  const st = getState();
  // The card body's own onclick is the only trigger now (no separate icon) — invoking it
  // directly is the faithful simulation of a browser click landing anywhere on the card,
  // since that's literally what its onclick attribute runs.
  assert.strictEqual(st.plannerUi.drawerOpen, false, 'sanity check: drawer starts closed');
  sandbox.plannerOpenLessonDrawerFromCard('sa_1'); // == clicking the standalone card body
  assert.strictEqual(st.plannerUi.selectedLessonId, 'sa_1', 'clicking the card body should select the lesson');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'clicking the card body should open the drawer');
  assert.strictEqual(st.currentView, 'planner', 'must not navigate away');

  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerOpenLessonDrawerFromCard('ul_1'); // == clicking a unit occurrence card body
  assert.strictEqual(st.plannerUi.selectedLessonId, 'ul_1', 'clicking a unit occurrence card body should select the lesson');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'clicking a unit occurrence card body should open the drawer');
  assert.strictEqual(st.currentView, 'planner', 'must stay on the Weekly Planner, not navigate to Unit Plans');

  // ul_1 has real content (title/subject from the fixture), so the drawer defaults to
  // the read-only view — clicking a card no longer always drops straight into the full
  // editable form. It still shows the lesson's own data and an explicit way into
  // editing, both without navigating away.
  assert.strictEqual(getState().plannerUi.drawerMode, 'view', 'a lesson with content should open in view mode by default');
  const viewHtml = sandbox.plannerDrawerHtml(lessonById('ul_1'), []);
  assert.ok(viewHtml.includes('Intro to fractions'), 'view mode should show the lesson\'s own title');
  assert.ok(viewHtml.includes('Teaching status'), 'the field label should still be present in view mode');
  assert.ok(!viewHtml.includes('<select'), 'view mode must not render the editable dropdowns');

  sandbox.plannerSwitchDrawerToEdit();
  const editHtml = sandbox.plannerDrawerHtml(lessonById('ul_1'), []);
  assert.ok(editHtml.includes('Teaching status') && editHtml.includes('<select'), 'the unit lesson drawer should still render its full editable field set once switched to Edit');
});

test('pressing Enter or Space on a focused standalone card runs the literal onkeydown code and opens the drawer; other keys do not', () => {
  resetState();
  const st = getState();

  const enterHtml = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  const enterCode = extractAttr(extractOpenTag(enterHtml, 'planner-lesson-card '), 'onkeydown');
  assert.ok(enterCode, 'the card must render an onkeydown attribute');
  const enterEvt = fireInlineKeydown(enterCode, 'Enter');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'sa_1', 'Enter should select the lesson');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'Enter should open the drawer');
  assert.strictEqual(enterEvt.defaultPrevented, true, 'Enter should preventDefault so it does not also submit/scroll');

  resetState();
  const spaceHtml = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  const spaceCode = extractAttr(extractOpenTag(spaceHtml, 'planner-lesson-card '), 'onkeydown');
  const spaceEvt = fireInlineKeydown(spaceCode, ' ');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'sa_1', 'Space should also select the lesson');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'Space should also open the drawer');
  assert.strictEqual(spaceEvt.defaultPrevented, true, 'Space should preventDefault so the page does not scroll');

  resetState();
  const tabHtml = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  const tabCode = extractAttr(extractOpenTag(tabHtml, 'planner-lesson-card '), 'onkeydown');
  const tabEvt = fireInlineKeydown(tabCode, 'Tab');
  assert.strictEqual(st.plannerUi.drawerOpen, false, 'a non-activation key (Tab) must not open the drawer');
  assert.strictEqual(tabEvt.defaultPrevented, false, 'Tab must not be prevented, so normal keyboard tabbing still works');
});

test('pressing Enter or Space on a focused unit occurrence card runs the literal onkeydown code and opens the drawer', () => {
  resetState();
  const st = getState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');

  const enterHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  const enterCode = extractAttr(extractOpenTag(enterHtml, 'planner-lesson-card is-unit'), 'onkeydown');
  assert.ok(enterCode, 'the occurrence card must render an onkeydown attribute');
  fireInlineKeydown(enterCode, 'Enter');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'ul_1', 'Enter should select the unit lesson');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'Enter should open the drawer');

  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  const spaceHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  const spaceCode = extractAttr(extractOpenTag(spaceHtml, 'planner-lesson-card is-unit'), 'onkeydown');
  fireInlineKeydown(spaceCode, ' ');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'ul_1', 'Space should also select the unit lesson');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'Space should also open the drawer');
});

test('the Unit Lessons rail is unaffected — no card-body click wiring', () => {
  resetState();
  const html = sandbox.plannerUnitSidebarLessonHtml(lessonById('ul_1'));
  assert.ok(!html.includes('plannerOpenLessonDrawerFromCard'), 'rail pills must not gain click-to-open — they remain drag-only, unchanged');
});

test('opening a unit lesson from a board card click resets the stale unit CD search/year filter', () => {
  resetState();
  const st = getState();
  sandbox.unitPlansEnsureUiState();
  // Simulate a search left over from a previous Unit Plans session.
  st.unitPlansUi.cdSearch = 'some old search';
  st.unitPlansUi.cdShowAllYears = true;
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  assert.strictEqual(st.unitPlansUi.cdSearch, '', 'the CD search must be cleared so the unit-context CD panel is not filtered by stale state');
  assert.strictEqual(st.unitPlansUi.cdShowAllYears, false, 'the CD year filter must reset too');
});

test('opening a lesson from Unit Plans\' own lesson row must NOT reset that view\'s live CD search', () => {
  resetState();
  const st = getState();
  sandbox.unitPlansEnsureUiState();
  st.unitPlansUi.cdSearch = 'a search the teacher is actively using in Unit Plans';
  st.unitPlansUi.cdShowAllYears = true;
  // unitLessonRowHtml's onclick calls plannerOpenLessonDrawer directly, not the
  // board-card-click wrapper — that must stay untouched so Unit Plans' own sidebar search
  // isn't wiped out just because a lesson's edit drawer was opened alongside it.
  sandbox.plannerOpenLessonDrawer('ul_1');
  assert.strictEqual(st.unitPlansUi.cdSearch, 'a search the teacher is actively using in Unit Plans', 'Unit Plans\' own CD search must be untouched by this path');
  assert.strictEqual(st.unitPlansUi.cdShowAllYears, true, 'Unit Plans\' own CD year filter must be untouched by this path');
});

test('opening a standalone lesson from a board card click leaves the unit CD search alone (nothing to reset)', () => {
  resetState();
  const st = getState();
  sandbox.unitPlansEnsureUiState();
  st.unitPlansUi.cdSearch = 'unrelated search';
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');
  assert.strictEqual(st.unitPlansUi.cdSearch, 'unrelated search', 'a standalone lesson has no unit context, so nothing should be reset');
});

// ── Clicking a card opens full edit in the drawer / Unscheduled column removed ──
console.log('Card click opens the drawer edit / Unscheduled column removal');

test('clicking a unit occurrence populates the drawer with the full unit lesson edit fields, staying on the planner', () => {
  resetState();
  const st = getState();
  const uidx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[uidx] = { ...st.unitPlans[uidx], linkedCDIds: ['AC9M3N01'], assessmentNotes: 'Exit ticket each fortnight.' };
  const lidx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[lidx] = { ...st.lessonPlans[lidx], title: 'Halves and quarters', subject: 'Mathematics', teachingStatus: 'reteach', intention: 'Partition shapes into equal parts.' };
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');

  sandbox.plannerOpenLessonDrawerFromCard('ul_1'); // the actual card-click path
  assert.strictEqual(st.currentView, 'planner', 'opening the drawer must not navigate to another view');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'ul_1');
  assert.strictEqual(st.plannerUi.drawerOpen, true);

  // This lesson has real content, so it opens in view mode by default (see the
  // dedicated view-mode tests below) — switch to Edit to exercise this test's actual
  // subject: the full editable field set.
  sandbox.plannerSwitchDrawerToEdit();
  const html = sandbox.plannerDrawerHtml(lessonById('ul_1'), []);
  assert.ok(html.includes('value="Halves and quarters"'), 'title should populate');
  assert.ok(html.includes('Mathematics') && html.includes('selected'), 'subject should populate');
  assert.ok(/<option value="reteach"[^>]*selected/.test(html), 'teaching status should populate as selected');
  assert.ok(html.includes('Partition shapes into equal parts.'), 'learning intention should populate');
  assert.ok(html.includes('planner-ic-results'), 'IC picker should be present');
  assert.ok(html.includes('Schedule to week / day'), 'schedule section should be present');
  assert.ok(html.includes('Unit: Fractions'), 'unit context header should be present');
  assert.ok(html.includes('unit-cd-panel'), 'linked CD panel should be present');
  assert.ok(html.includes('AC9M3N01'), 'the unit\'s linked CD should populate in the panel');
  assert.ok(html.includes('Exit ticket each fortnight.'), 'assessment notes should populate');
});

test('clicking a standalone card populates the drawer with the standalone edit fields', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], title: 'Spelling test', subject: 'English', dayKey: 'wed', intention: 'Weekly spelling check.' };
  sandbox.plannerSwitchDrawerToEdit(); // this test's subject is the editable field set specifically
  const html = sandbox.plannerDrawerHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }, { key: 'wed', label: 'Wednesday' }]);
  assert.ok(html.includes('value="Spelling test"'), 'title should populate');
  assert.ok(html.includes('Weekly spelling check.'), 'learning intention should populate');
  assert.ok(/<option value="wed"[^>]*selected/.test(html), 'day should populate as selected');
  assert.ok(html.includes('Mark as taught'), 'status control should be present for a standalone lesson');
  assert.ok(!html.includes('Unit:'), 'a standalone lesson must not show unit context');
});

test('the rendered board has no Unscheduled column', () => {
  resetState();
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(!/>Unscheduled</.test(html), 'no column header should read "Unscheduled"');
  assert.strictEqual((html.match(/class="planner-lesson-column"/g) || []).length, 5, 'exactly 5 day columns (Mon–Fri) should render');
});

test('a legacy lesson with no day assigned is shown in a fallback area, not silently dropped', () => {
  resetState();
  assert.strictEqual(lessonById('sa_1').dayKey, 'unscheduled', 'sanity check: the fixture starts in the legacy state');
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes('planner-unassigned-cards'), 'the fallback area should render');
  assert.ok(html.includes('Spelling test'), 'the legacy lesson should still be visible somewhere on the board');
});

test('plannerAddLesson() with no day defaults to Monday, never Unscheduled', () => {
  resetState();
  sandbox.plannerAddLesson();
  const st = getState();
  const created = st.lessonPlans.find(l => l.id === st.plannerUi.selectedLessonId);
  assert.strictEqual(created.dayKey, 'mon', 'a freshly created lesson must always land on a real day');
});

test('the drawer cannot reassign a lesson back into the legacy Unscheduled state', () => {
  resetState();
  sandbox.plannerOpenLessonDrawer('sa_1'); // sa_1 starts on 'unscheduled' in the fixture
  const before = lessonById('sa_1').dayKey;
  sandbox.plannerUpdateSelectedLessonField('dayKey', 'unscheduled');
  assert.strictEqual(lessonById('sa_1').dayKey, before, 'an out-of-range dayKey write must be rejected as a no-op');
});

test('the standalone drawer day-select only offers "Unscheduled (legacy)" for a lesson that already has it', () => {
  resetState();
  const days = [{ key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' }];
  // A normally-scheduled lesson must never be offered the legacy option.
  const scheduled = sandbox.normalizeLessonPlan({ id: 'sa_x', title: 'X', weekKey: WEEK_A, dayKey: 'mon' });
  const scheduledHtml = sandbox.plannerStandaloneLessonEditHtml(scheduled, days);
  assert.ok(!scheduledHtml.includes('legacy'), 'a normal lesson must not see the legacy option');

  // A lesson that is already legacy-unassigned must still show its true current state.
  const legacyHtml = sandbox.plannerStandaloneLessonEditHtml(lessonById('sa_1'), days);
  assert.ok(/<option value="unscheduled" selected>/.test(legacyHtml), 'a legacy lesson keeps its current value visible and selected');
});

test('dragging a scheduled occurrence to another day moves that slot (not append)', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerStartOccurrenceDrag(dropEvent('ul_1'), 'ul_1', WEEK_A, 'mon');
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'wed');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'wed' }]);
});

test('moving one occurrence leaves other slots and teachingStatus untouched', () => {
  resetState();
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach');
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_A, 'thu');
  sandbox.plannerStartOccurrenceDrag(dropEvent('ul_2'), 'ul_2', WEEK_A, 'mon');
  sandbox.plannerDropLessonToDay(dropEvent('ul_2'), 'fri');
  eqJson(lessonById('ul_2').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'thu' }, { weekKey: WEEK_A, dayKey: 'fri' }]);
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'moving a slot must not change teachingStatus');
});

test('dragging an occurrence onto a day the lesson already occupies is a no-op (no slot lost)', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'tue');
  // Drag the Tuesday occurrence onto Monday (already occupied) — both slots must survive.
  sandbox.plannerStartOccurrenceDrag(dropEvent('ul_1'), 'ul_1', WEEK_A, 'tue');
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'mon');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'tue' }]);
});

test('dropping an occurrence back on its own day is a no-op', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerStartOccurrenceDrag(dropEvent('ul_1'), 'ul_1', WEEK_A, 'mon');
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'mon');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon' }]);
});

test('dragging an occurrence onto the Unscheduled column keeps the slot', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerStartOccurrenceDrag(dropEvent('ul_1'), 'ul_1', WEEK_A, 'mon');
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'unscheduled');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon' }]);
});

test('normalize de-dupes duplicate scheduledSlots entries', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  // Simulate stale storage with a duplicated (weekKey,dayKey) pair.
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], scheduledSlots: [
    { weekKey: WEEK_A, dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'wed' },
  ] };
  const normalized = sandbox.normalizeLessonPlan(lessonById('ul_1'));
  eqJson(normalized.scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'wed' }]);
});

// ── Within-day drag-to-reorder (insertion line) ──────────────────────────────────
console.log('Within-day drag-to-reorder');

// Adds an extra standalone lesson directly to the fixture (beyond the base 3 lessons
// resetState creates), scoped to WEEK_A, for tests that need several cards on one day.
function addStandaloneLesson(id, title, dayKey) {
  const st = getState();
  const lesson = sandbox.normalizeLessonPlan({ id, title, subject: 'English', weekKey: WEEK_A, dayKey, linkedICIds: [] });
  st.lessonPlans.push(lesson);
  return lesson;
}

// A fake dragover event for plannerCardDragOver: a stubbed card rect (top/height) and
// a cursor Y, so the top-half/bottom-half math can be tested without a real DOM.
function cardDragOverEvent(rectTop, rectHeight, clientY) {
  return {
    preventDefault() {}, stopPropagation() {},
    clientY,
    currentTarget: {
      getBoundingClientRect: () => ({ top: rectTop, height: rectHeight }),
      parentElement: { classList: { add() {}, remove() {} } },
    },
  };
}

// A fake dragover event for the column body itself (hovering empty space, no card).
function columnDragOverEvent() {
  return {
    preventDefault() {},
    currentTarget: { classList: { add() {}, remove() {} }, querySelector() { return null; }, insertBefore() {} },
  };
}

function dayOrderIds(weekKey, dayKey) {
  const st = getState();
  const weekLessons = st.lessonPlans.filter(l => l.weekKey === weekKey && !l.unitId);
  const unitOccurrences = [];
  st.lessonPlans.forEach(lesson => {
    if (!lesson.unitId) return;
    (Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots : []).forEach(slot => {
      if (sandbox.isValidScheduledSlot(slot) && slot.weekKey === weekKey) unitOccurrences.push({ lesson, dayKey: slot.dayKey });
    });
  });
  return sandbox.plannerDayItemsInOrder(weekKey, dayKey, weekLessons, unitOccurrences).map(item => item.lessonId);
}

test('hovering the top half of a card sets insertionTarget to "insert before"', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  addStandaloneLesson('sa_3', 'C lesson', 'mon');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_3';
  sandbox.plannerCardDragOver(cardDragOverEvent(100, 40, 105), 'mon', 'sa_2'); // cursor at 105, card spans 100-140 -> top half
  assert.strictEqual(st.plannerUi.insertionTarget.lessonId, 'sa_2');
  assert.strictEqual(st.plannerUi.insertionTarget.before, true);
});

test('hovering the bottom half of a card sets insertionTarget to "insert after"', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  addStandaloneLesson('sa_3', 'C lesson', 'mon');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_3';
  sandbox.plannerCardDragOver(cardDragOverEvent(100, 40, 135), 'mon', 'sa_2'); // cursor at 135 -> bottom half
  assert.strictEqual(st.plannerUi.insertionTarget.lessonId, 'sa_2');
  assert.strictEqual(st.plannerUi.insertionTarget.before, false);
});

test('a cross-day card hover also sets the insertion line, keeping the glow alongside it', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'tue');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_1'; // sa_1 lives on 'unscheduled', not 'tue'
  const ev = cardDragOverEvent(100, 40, 105);
  let glowAdded = false, glowRemoved = false;
  ev.currentTarget.parentElement.classList = { add() { glowAdded = true; }, remove() { glowRemoved = true; } };
  sandbox.plannerCardDragOver(ev, 'tue', 'sa_2');
  assert.deepStrictEqual(
    { lessonId: st.plannerUi.insertionTarget.lessonId, before: st.plannerUi.insertionTarget.before },
    { lessonId: 'sa_2', before: true },
    'a cross-day hover must set a precise insertion target, same as a same-day hover'
  );
  assert.strictEqual(glowAdded, true, 'cross-day hover keeps the existing glow');
  assert.strictEqual(glowRemoved, false, 'cross-day hover must not suppress the glow (that is same-day-only)');
});

test('a same-day card hover suppresses the glow (insertion line is the only indicator)', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_1';
  st.lessonPlans[st.lessonPlans.findIndex(l => l.id === 'sa_1')].dayKey = 'mon'; // sa_1 now lives on 'mon' too
  const ev = cardDragOverEvent(100, 40, 105);
  let glowAdded = false, glowRemoved = false;
  ev.currentTarget.parentElement.classList = { add() { glowAdded = true; }, remove() { glowRemoved = true; } };
  sandbox.plannerCardDragOver(ev, 'mon', 'sa_2');
  assert.strictEqual(glowRemoved, true, 'same-day hover suppresses the glow');
  assert.strictEqual(glowAdded, false, 'same-day hover must not add the glow (insertion line is the only indicator)');
});

test('dragging a card and dropping it before another reorders the day accordingly', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  addStandaloneLesson('sa_3', 'C lesson', 'mon');
  addStandaloneLesson('sa_4', 'D lesson', 'mon');
  eqJson(dayOrderIds(WEEK_A, 'mon'), ['sa_2', 'sa_3', 'sa_4'], 'sanity check: default order is creation order');

  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_4';
  sandbox.plannerCardDragOver(cardDragOverEvent(0, 40, 5), 'mon', 'sa_2'); // top half of sa_2 -> insert before it
  sandbox.plannerDropLessonToDay(dropEvent('sa_4'), 'mon');
  eqJson(dayOrderIds(WEEK_A, 'mon'), ['sa_4', 'sa_2', 'sa_3']);
});

test('dragging a card and dropping it after another reorders the day accordingly', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  addStandaloneLesson('sa_3', 'C lesson', 'mon');
  addStandaloneLesson('sa_4', 'D lesson', 'mon');

  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_2';
  sandbox.plannerCardDragOver(cardDragOverEvent(100, 40, 135), 'mon', 'sa_3'); // bottom half of sa_3 -> insert after it
  sandbox.plannerDropLessonToDay(dropEvent('sa_2'), 'mon');
  eqJson(dayOrderIds(WEEK_A, 'mon'), ['sa_3', 'sa_2', 'sa_4']);
});

test('dropping on empty day space (no hovered card) appends to the end of that day', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  addStandaloneLesson('sa_3', 'C lesson', 'mon');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_2';
  sandbox.plannerAllowLessonDrop(columnDragOverEvent(), 'mon'); // hovering column background, not a card
  sandbox.plannerDropLessonToDay(dropEvent('sa_2'), 'mon');
  eqJson(dayOrderIds(WEEK_A, 'mon'), ['sa_3', 'sa_2']);
});

test('within-day reorder applies to unit occurrence cards too (mixed with standalone)', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  eqJson(dayOrderIds(WEEK_A, 'mon'), ['sa_2', 'ul_1'], 'default order: standalone first, then unit occurrences');

  const st = getState();
  st.plannerUi.draggingLessonId = 'ul_1';
  st.plannerUi.draggingSlot = { lessonId: 'ul_1', weekKey: WEEK_A, dayKey: 'mon' }; // as set by plannerStartOccurrenceDrag
  sandbox.plannerCardDragOver(cardDragOverEvent(0, 40, 5), 'mon', 'sa_2'); // top half of sa_2 -> insert before it
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'mon');
  eqJson(dayOrderIds(WEEK_A, 'mon'), ['ul_1', 'sa_2']);
});

test('within-day reorder never touches scheduledSlots, dayKey/position, or teachingStatus', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  const st = getState();
  const unitBefore = JSON.stringify(lessonById('ul_1'));
  const standaloneBefore = JSON.stringify(lessonById('sa_2'));

  st.plannerUi.draggingLessonId = 'sa_2';
  sandbox.plannerCardDragOver(cardDragOverEvent(0, 40, 5), 'mon', 'ul_1'); // reorder sa_2 before the unit occurrence
  sandbox.plannerDropLessonToDay(dropEvent('sa_2'), 'mon');

  assert.strictEqual(JSON.stringify(lessonById('ul_1')), unitBefore, 'the unit lesson object must be byte-for-byte unchanged');
  assert.strictEqual(JSON.stringify(lessonById('sa_2')), standaloneBefore, 'the standalone lesson object must be byte-for-byte unchanged (only display order moved)');
});

test('reordered day order persists after a full re-render', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  addStandaloneLesson('sa_3', 'C lesson', 'mon');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_3';
  sandbox.plannerCardDragOver(cardDragOverEvent(0, 40, 5), 'mon', 'sa_2'); // insert sa_3 before sa_2
  sandbox.plannerDropLessonToDay(dropEvent('sa_3'), 'mon');

  st.plannerUi.weekKey = WEEK_A;
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  const idxC = html.indexOf('C lesson');
  const idxB = html.indexOf('B lesson');
  assert.ok(idxC >= 0 && idxB >= 0, 'both cards should render');
  assert.ok(idxC < idxB, 'C lesson (moved before B) should render before B lesson after re-render');
});

test('cross-day drop with no hovered card still appends to the end (unchanged default)', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'wed');
  addStandaloneLesson('sa_3', 'C lesson', 'wed');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_1'; // sa_1 lives on 'unscheduled'
  sandbox.plannerAllowLessonDrop(columnDragOverEvent(), 'wed'); // hovering column background, not a card
  sandbox.plannerDropLessonToDay(dropEvent('sa_1'), 'wed');
  assert.strictEqual(lessonById('sa_1').dayKey, 'wed', 'the underlying dayKey write is unchanged (still a plain append)');
  eqJson(dayOrderIds(WEEK_A, 'wed'), ['sa_2', 'sa_3', 'sa_1'], 'no hovered card -> appended to the end, same as before');
});

test('cross-day drop to a specific hovered position inserts there, not at the bottom', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'wed');
  addStandaloneLesson('sa_3', 'C lesson', 'wed');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_1'; // sa_1 lives on 'unscheduled', dragged onto 'wed'
  sandbox.plannerCardDragOver(cardDragOverEvent(0, 40, 5), 'wed', 'sa_2'); // top half of sa_2 -> insert before it
  sandbox.plannerDropLessonToDay(dropEvent('sa_1'), 'wed');
  assert.strictEqual(lessonById('sa_1').dayKey, 'wed', 'the underlying dayKey write is unchanged (still a plain append)');
  eqJson(dayOrderIds(WEEK_A, 'wed'), ['sa_1', 'sa_2', 'sa_3'], 'dropped at the hovered position, not appended to the end');
});

test('cross-day occurrence move also lands at the hovered position', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  addStandaloneLesson('sa_2', 'B lesson', 'wed');
  addStandaloneLesson('sa_3', 'C lesson', 'wed');
  const st = getState();
  st.plannerUi.draggingLessonId = 'ul_1';
  st.plannerUi.draggingSlot = { lessonId: 'ul_1', weekKey: WEEK_A, dayKey: 'mon' };
  sandbox.plannerCardDragOver(cardDragOverEvent(100, 40, 135), 'wed', 'sa_2'); // bottom half of sa_2 -> insert after it
  sandbox.plannerDropLessonToDay(dropEvent('ul_1'), 'wed');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'wed' }], 'the underlying slot move is unchanged');
  eqJson(dayOrderIds(WEEK_A, 'wed'), ['sa_2', 'ul_1', 'sa_3'], 'dropped at the hovered position, not appended to the end');
});

test('cross-day placement never touches scheduledSlots/position beyond the existing append, and leaves teachingStatus alone', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'wed');
  const st = getState();
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach');
  st.plannerUi.draggingLessonId = 'ul_2';
  sandbox.plannerCardDragOver(cardDragOverEvent(0, 40, 5), 'wed', 'sa_2'); // top half -> insert before sa_2
  sandbox.plannerDropLessonToDay(dropEvent('ul_2'), 'wed');
  eqJson(lessonById('ul_2').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'wed' }]);
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'cross-day placement must not change teachingStatus');
});

test('cross-day placement persists after a full re-render', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'wed');
  addStandaloneLesson('sa_3', 'C lesson', 'wed');
  const st = getState();
  st.plannerUi.draggingLessonId = 'sa_1'; // sa_1 lives on 'unscheduled'
  sandbox.plannerCardDragOver(cardDragOverEvent(0, 40, 5), 'wed', 'sa_2'); // top half of sa_2 -> insert before it
  sandbox.plannerDropLessonToDay(dropEvent('sa_1'), 'wed');

  st.plannerUi.weekKey = WEEK_A;
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  const idxSpelling = html.indexOf('Spelling test'); // sa_1's title
  const idxB = html.indexOf('B lesson');
  assert.ok(idxSpelling >= 0 && idxB >= 0, 'both cards should render');
  assert.ok(idxSpelling < idxB, 'the cross-day-placed card should render before B lesson after re-render');
});

// ── Standalone (non-unit) lesson behaviour must be unchanged ────────────────────
console.log('Standalone lesson behaviour unchanged');

test('dragging a standalone lesson still writes legacy dayKey/position', () => {
  resetState();
  sandbox.plannerDropLessonToDay(dropEvent('sa_1'), 'wed');
  const l = lessonById('sa_1');
  assert.strictEqual(l.dayKey, 'wed');
  assert.ok((l.position || 0) > 0, 'expected a position to be assigned');
});

test('dragging a standalone lesson never touches scheduledSlots', () => {
  resetState();
  sandbox.plannerDropLessonToDay(dropEvent('sa_1'), 'fri');
  eqJson(lessonById('sa_1').scheduledSlots, [], 'standalone lessons must not gain slots');
});

test('plannerScheduleUnitLesson refuses standalone lessons', () => {
  resetState();
  assert.strictEqual(sandbox.plannerScheduleUnitLesson('sa_1', WEEK_A, 'mon'), false);
  eqJson(lessonById('sa_1').scheduledSlots, []);
});

test('unit lessons never appear as standalone board cards', () => {
  resetState();
  // Give a unit lesson a legacy weekKey/dayKey for the current week — it must still
  // be excluded from the standalone card list (it is board-placed via slots only).
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], weekKey: WEEK_A, dayKey: 'mon' };
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  // The unit lesson has no slots, so it should produce zero board occurrences and
  // should not be rendered as a standalone card either. (It legitimately appears in
  // the unit rail, so check for the standalone-card handler rather than the title.)
  assert.strictEqual((html.match(/planner-occ-wrap/g) || []).length, 0);
  assert.ok(!html.includes("plannerOpenLessonDrawer('ul_1')"), 'unit lesson must not render as a standalone board card');
});

// ── Calendar picker: per-day lesson count ────────────────────────────────────────
console.log('Calendar picker lesson-count-per-day');

test('weekend dates always return 0, even in a week with lessons', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  const saturdayIso = sandbox.addDaysToDate(WEEK_A, 5);
  const sundayIso = sandbox.addDaysToDate(WEEK_A, 6);
  assert.strictEqual(sandbox.plannerLessonCountForDate(saturdayIso), 0);
  assert.strictEqual(sandbox.plannerLessonCountForDate(sundayIso), 0);
});

test('counts a standalone lesson only on its own day, not neighbouring days', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  assert.strictEqual(sandbox.plannerLessonCountForDate(WEEK_A), 1, 'Monday (WEEK_A) should count sa_2');
  assert.strictEqual(sandbox.plannerLessonCountForDate(sandbox.addDaysToDate(WEEK_A, 1)), 0, 'Tuesday should be unaffected');
});

test('counts a unit lesson only through its valid scheduledSlots entries', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  assert.strictEqual(sandbox.plannerLessonCountForDate(WEEK_A), 1);

  // A malformed slot (bad weekKey/dayKey) on another lesson must not be counted.
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_2');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], scheduledSlots: [{ weekKey: 'oops', dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'zzz' }] };
  assert.strictEqual(sandbox.plannerLessonCountForDate(WEEK_A), 1, 'malformed slots must not inflate the count');
});

test('a date is scoped to its own week — same weekday in a different week is unaffected', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  const nextWeekMonday = sandbox.addDaysToDate(WEEK_A, 7);
  assert.strictEqual(nextWeekMonday, WEEK_B);
  assert.strictEqual(sandbox.plannerLessonCountForDate(WEEK_B), 0, 'WEEK_B Monday must not pick up a WEEK_A lesson');
});

test('multiple lessons on the same day are all counted, uncapped', () => {
  resetState();
  addStandaloneLesson('sa_2', 'B lesson', 'mon');
  addStandaloneLesson('sa_3', 'C lesson', 'mon');
  addStandaloneLesson('sa_4', 'D lesson', 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  assert.strictEqual(sandbox.plannerLessonCountForDate(WEEK_A), 4, 'count is a raw total, not clamped — clamping happens at the display layer');
});

// ── Unit Plans: "Duplicate" lesson action ────────────────────────────────────────
console.log('Unit Plans duplicate lesson action');

test('duplicate copies title (with a " (copy)" suffix), subject, intention, and linked ICs', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], title: 'Halves and quarters', subject: 'Mathematics', intention: 'Partition shapes into equal parts.', linkedICIds: ['ic_1', 'ic_2'] };
  sandbox.unitDuplicateLesson('unit_1', 'ul_1');
  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  const copy = lessonById(unit.lessonIds[1]); // immediately after ul_1
  assert.strictEqual(copy.title, 'Halves and quarters (copy)');
  assert.strictEqual(copy.subject, 'Mathematics');
  assert.strictEqual(copy.intention, 'Partition shapes into equal parts.');
  eqJson(copy.linkedICIds, ['ic_1', 'ic_2']);
  assert.strictEqual(copy.unitId, 'unit_1');
});

test('duplicate is inserted immediately after the source lesson in the unit sequence', () => {
  resetState();
  sandbox.unitDuplicateLesson('unit_1', 'ul_1');
  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  assert.strictEqual(unit.lessonIds.length, 3, 'the unit should now have 3 lessons');
  assert.strictEqual(unit.lessonIds[0], 'ul_1', 'the source lesson stays first');
  assert.strictEqual(unit.lessonIds[2], 'ul_2', 'the original second lesson still follows, now after the duplicate');
  const copyId = unit.lessonIds[1];
  assert.notStrictEqual(copyId, 'ul_1');
  assert.notStrictEqual(copyId, 'ul_2');
});

test('duplicate resets teaching status to "planned" regardless of the source status', () => {
  resetState();
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'sanity check on fixture');
  sandbox.unitDuplicateLesson('unit_1', 'ul_2');
  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  const copy = lessonById(unit.lessonIds[unit.lessonIds.indexOf('ul_2') + 1]);
  assert.strictEqual(copy.teachingStatus, 'planned');
  assert.strictEqual(copy.status, 'planned');
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'the source lesson must be untouched');
});

test('duplicate does not inherit scheduledSlots — it starts unscheduled, and the source keeps its own slots', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.unitDuplicateLesson('unit_1', 'ul_1');
  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  const copy = lessonById(unit.lessonIds[1]);
  eqJson(copy.scheduledSlots, [], 'the duplicate must start unscheduled');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'wed' }], 'the source lesson keeps its own slots');
});

test('duplicate persists both the new lesson and the updated unit sequence to localStorage', () => {
  resetState();
  sandbox.unitDuplicateLesson('unit_1', 'ul_1');
  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  const copyId = unit.lessonIds[1];
  const savedLessons = JSON.parse(localStorageStub.getItem('ct_planner_lessons_v2'));
  assert.ok(savedLessons.some(l => l.id === copyId), 'the duplicated lesson should be persisted to the lessons store');
  const savedUnits = JSON.parse(localStorageStub.getItem('ct_unit_plans_v1'));
  eqJson(savedUnits.find(u => u.id === 'unit_1').lessonIds, ['ul_1', copyId, 'ul_2'], 'the reordered sequence should be persisted to the units store');
});

test('duplicating with a lessonId not in the target unit\'s own sequence still copies it in, appended', () => {
  resetState();
  const st = getState();
  st.unitPlans.push({ id: 'unit_2', title: 'Other unit', subject: '', yearLevel: '', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: [], createdAt: '2026-01-01T00:00:00.000Z' });
  const before = st.lessonPlans.length;
  sandbox.unitDuplicateLesson('unit_2', 'ul_1'); // ul_1 actually belongs to unit_1, not unit_2
  assert.strictEqual(getState().lessonPlans.length, before + 1, 'a lesson is still created (it copies by lessonId, not by membership)');
  const unit2 = getState().unitPlans.find(u => u.id === 'unit_2');
  assert.strictEqual(unit2.lessonIds.length, 1, 'the copy is appended to unit_2 (which had no lessons, so no "after source" position exists there)');
});

test('the unit lesson row renders a Duplicate button wired to unitDuplicateLesson, separate from Delete', () => {
  resetState();
  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  const html = sandbox.unitLessonRowHtml(unit, lessonById('ul_1'));
  assert.ok(html.includes(">Duplicate<"), 'a "Duplicate" button should render');
  assert.ok(html.includes("unitDuplicateLesson('unit_1','ul_1')"), 'the Duplicate button should call unitDuplicateLesson with the unit and lesson ids');
  assert.ok(/Duplicate<\/button>[\s\S]*?unitDeleteLesson/.test(html), 'Duplicate and Delete should both be present as separate controls');
  assert.ok(/onclick="event\.stopPropagation\(\);unitDuplicateLesson/.test(html), 'the Duplicate button must stop propagation so it does not also open the row\'s edit drawer');
});

test('a failed save does not roll back the in-memory duplicate, and surfaces a retryable failure banner instead of failing silently', () => {
  resetState();
  const realSaveLessonPlansState = sandbox.saveLessonPlansState;
  sandbox.saveLessonPlansState = () => false; // simulate a localStorage write failure (quota/security error)

  let shownMessage = null, shownRetry = null;
  const realShowBanner = sandbox.showLessonSaveFailureBanner;
  sandbox.showLessonSaveFailureBanner = (message, onRetry) => { shownMessage = message; shownRetry = onRetry; };

  sandbox.unitDuplicateLesson('unit_1', 'ul_1');

  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  assert.strictEqual(unit.lessonIds.length, 3, 'the in-memory duplicate must not be rolled back on a save failure');
  const copy = lessonById(unit.lessonIds[1]);
  assert.ok(copy, 'the duplicated lesson should still exist in memory even though persistence failed');

  assert.ok(shownMessage && /could not be saved/i.test(shownMessage), 'a failure banner explaining the save failed should be shown, not swallowed silently');
  assert.strictEqual(typeof shownRetry, 'function', 'the banner should be given a retry callback, not just a dismissing message');

  sandbox.saveLessonPlansState = realSaveLessonPlansState;
  sandbox.showLessonSaveFailureBanner = realShowBanner;
});

test('retrying a failed duplicate save re-attempts the write (not the duplication itself) and clears the banner on success', () => {
  resetState();
  const realSaveLessonPlansState = sandbox.saveLessonPlansState;
  let saveShouldFail = true;
  sandbox.saveLessonPlansState = (...args) => saveShouldFail ? false : realSaveLessonPlansState(...args);

  let hideCalled = false;
  const realHideBanner = sandbox.hideLessonSaveFailureBanner;
  sandbox.hideLessonSaveFailureBanner = (...args) => { hideCalled = true; return realHideBanner(...args); };

  sandbox.unitDuplicateLesson('unit_1', 'ul_1');
  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  const copyId = unit.lessonIds[1];
  assert.strictEqual(unit.lessonIds.length, 3, 'the duplicate should exist in memory despite the failed save');

  // showLessonSaveFailureBanner() itself clears any stale banner before showing a new
  // one, so it also invokes hide once during the failing call above — reset the flag
  // here so the assertion below is only about the retry's own success path.
  hideCalled = false;
  saveShouldFail = false;
  sandbox.retryLessonSave(); // simulates clicking "Retry" on the banner

  assert.strictEqual(hideCalled, true, 'the failure banner should be hidden once the retry succeeds');
  const savedLessons = JSON.parse(localStorageStub.getItem('ct_planner_lessons_v2'));
  assert.ok(savedLessons.some(l => l.id === copyId), 'the retried save should persist the same duplicate — retry must not re-run the duplication');

  sandbox.saveLessonPlansState = realSaveLessonPlansState;
  sandbox.hideLessonSaveFailureBanner = realHideBanner;
});

// ── Weekly Planner: Drive sync status indicator ─────────────────────────────────
console.log('Weekly Planner Drive sync indicator');

test('the Weekly Planner topbar renders a .drive-sync-indicator using the same driveSyncIndicatorHtml() as Unit Plans', () => {
  resetState();
  const st = getState();
  st.currentView = 'planner';
  sandbox.driveSyncEnsureState().lastSyncedAt = '2026-06-29T10:00:00.000Z';
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes('class="drive-sync-indicator"'), 'the Weekly Planner topbar should render a .drive-sync-indicator element');
  assert.ok(html.includes(sandbox.driveSyncIndicatorHtml()), 'it should render the exact same markup driveSyncIndicatorHtml() produces, not a re-implementation');
  assert.ok(/Last synced to Drive:/.test(html), 'it should reflect the current sync state, same as Unit Plans');
});

test('a Drive sync failure shows the same "failed — retry" indicator on the Weekly Planner as on Unit Plans', () => {
  resetState();
  const st = getState();
  st.currentView = 'planner';
  const ds = sandbox.driveSyncEnsureState();
  ds.consecutiveFailures = 2;
  realRenderView();
  const plannerHtml = documentStub.getElementById('main-content').innerHTML;
  assert.ok(/Drive sync failed/.test(plannerHtml), 'the Weekly Planner should show the failed-sync state');
  assert.ok(plannerHtml.includes('driveBackupSave()'), 'the retry button should call the existing driveBackupSave(), not a new retry path');

  st.currentView = 'unit-plans';
  sandbox.unitPlansEnsureUiState();
  realRenderView();
  const unitPlansHtml = documentStub.getElementById('main-content').innerHTML;
  assert.ok(/Drive sync failed/.test(unitPlansHtml), 'sanity check: Unit Plans shows the identical failed-sync state from the same shared state.driveSync');
});

test('updateDriveSyncIndicator() refreshes the Weekly Planner indicator too, via the existing shared mechanism', () => {
  resetState();
  const st = getState();
  st.currentView = 'planner';
  realRenderView();

  // Sanity check: the planner topbar carries the exact class updateDriveSyncIndicator()
  // queries for — same class as Unit Plans/Admin.
  const initialHtml = documentStub.getElementById('main-content').innerHTML;
  assert.ok(initialHtml.includes('<div class="drive-sync-indicator">'));

  // The stub document has no real DOM tree to query by class (querySelectorAll()
  // always returns []), so stand in for the one element updateDriveSyncIndicator()
  // would find in a real browser. This exercises the actual shared updater function
  // — untouched, pre-existing code — rather than only re-inspecting static markup.
  const fakeIndicatorEl = { innerHTML: '' };
  const realQuerySelectorAll = documentStub.querySelectorAll;
  documentStub.querySelectorAll = (selector) => selector === '.drive-sync-indicator' ? [fakeIndicatorEl] : realQuerySelectorAll(selector);

  sandbox.driveSyncEnsureState().lastSyncedAt = '2026-06-29T10:00:00.000Z';
  sandbox.updateDriveSyncIndicator();

  assert.strictEqual(fakeIndicatorEl.innerHTML, sandbox.driveSyncIndicatorHtml(), 'the shared updater must actually refresh an element carrying the planner\'s indicator class to the current sync state');

  documentStub.querySelectorAll = realQuerySelectorAll;
});

// ── Unit Plans: "Duplicate" whole-unit action ────────────────────────────────────
console.log('Unit Plans duplicate unit action');

test('duplicate copies the unit\'s own fields (title with a " (copy)" suffix, subject, yearLevel, term, linkedCDIds, assessmentNotes) into a new unit', () => {
  resetState();
  const st = getState();
  const idx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[idx] = { ...st.unitPlans[idx], linkedCDIds: ['AC9M3N01'], assessmentNotes: 'Exit ticket each fortnight.' };

  const beforeCount = st.unitPlans.length;
  sandbox.unitDuplicate('unit_1');
  const units = getState().unitPlans;
  assert.strictEqual(units.length, beforeCount + 1, 'a new unit should be added');
  const copy = units.find(u => u.id !== 'unit_1');
  assert.ok(copy, 'a duplicated unit should exist');
  assert.strictEqual(copy.title, 'Fractions (copy)');
  assert.strictEqual(copy.subject, 'Mathematics');
  assert.strictEqual(copy.yearLevel, '3');
  eqJson(copy.linkedCDIds, ['AC9M3N01']);
  assert.strictEqual(copy.assessmentNotes, 'Exit ticket each fortnight.');
});

test('duplicate copies every lesson in the unit (titles unchanged, teachingStatus reset, no scheduledSlots), each with a fresh id', () => {
  resetState();
  const st = getState();
  const lidx = st.lessonPlans.findIndex(l => l.id === 'ul_2');
  st.lessonPlans[lidx] = { ...st.lessonPlans[lidx], intention: 'Compare fractions with the same denominator.', linkedICIds: ['ic_1'] };
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_A, 'mon'); // give it a slot to prove it's not inherited

  sandbox.unitDuplicate('unit_1');
  const copy = getState().unitPlans.find(u => u.id !== 'unit_1');
  const copyLessons = sandbox.unitGetLessons(copy);

  assert.strictEqual(copyLessons.length, 2, 'both lessons in the source unit should be duplicated');
  // Unlike the single-lesson duplicate, a whole-unit duplicate must NOT suffix
  // lesson titles — only the unit's own title gets " (copy)". Lesson titles inside
  // stay exactly as they were in the source.
  assert.deepStrictEqual(copyLessons.map(l => l.title), ['Intro to fractions', 'Equivalent fractions'], 'lesson titles must be copied unchanged, with no " (copy)" suffix');
  assert.ok(copyLessons.every(l => l.teachingStatus === 'planned'), 'every duplicated lesson resets teachingStatus to planned, including the one that was "reteach"');
  assert.ok(copyLessons.every(l => (l.scheduledSlots || []).length === 0), 'no duplicated lesson should inherit scheduledSlots');
  assert.ok(copyLessons.every(l => l.unitId === copy.id), 'every duplicated lesson should belong to the new unit, not the original');

  const copiedSecond = copyLessons[1];
  assert.strictEqual(copiedSecond.intention, 'Compare fractions with the same denominator.');
  eqJson(copiedSecond.linkedICIds, ['ic_1']);
  assert.notStrictEqual(copiedSecond.id, 'ul_2', 'the duplicated lesson must get its own fresh id, not reuse the source\'s');
});

test('duplicate does not share ids or references with the source — editing the copy leaves the original untouched', () => {
  resetState();
  sandbox.unitDuplicate('unit_1');
  const copy = getState().unitPlans.find(u => u.id !== 'unit_1');
  assert.notStrictEqual(copy.id, 'unit_1', 'the duplicated unit must get its own fresh unitId');

  const copyLessonIds = copy.lessonIds;
  assert.ok(!copyLessonIds.includes('ul_1') && !copyLessonIds.includes('ul_2'), 'the copy must reference its own lessons, not the originals');

  // Mutate the copy's first lesson and confirm the original is unaffected.
  const copyFirstLessonId = copyLessonIds[0];
  sandbox.unitUpdateField(copy.id, 'title', 'Renamed copy');
  const lidx = getState().lessonPlans.findIndex(l => l.id === copyFirstLessonId);
  getState().lessonPlans[lidx] = { ...getState().lessonPlans[lidx], title: 'Edited only on the copy' };

  assert.strictEqual(getState().unitPlans.find(u => u.id === 'unit_1').title, 'Fractions', 'the original unit title must be unaffected by editing the copy');
  assert.strictEqual(getState().lessonPlans.find(l => l.id === 'ul_1').title, 'Intro to fractions', 'the original lesson must be unaffected by editing the copy\'s lesson');
});

test('duplicating a unit with no lessons yet produces a unit with an empty lessonIds array (no crash)', () => {
  resetState();
  const st = getState();
  st.unitPlans.push({ id: 'unit_empty', title: 'Empty unit', subject: '', yearLevel: '', term: '', linkedCDIds: [], assessmentNotes: '', lessonIds: [], createdAt: '2026-01-01T00:00:00.000Z' });
  assert.doesNotThrow(() => sandbox.unitDuplicate('unit_empty'));
  const copy = getState().unitPlans.find(u => u.title === 'Empty unit (copy)');
  assert.ok(copy);
  eqJson(copy.lessonIds, []);
});

test('duplicate persists both the new unit and its new lessons to localStorage', () => {
  resetState();
  sandbox.unitDuplicate('unit_1');
  const copy = getState().unitPlans.find(u => u.id !== 'unit_1');

  const savedUnits = JSON.parse(localStorageStub.getItem('ct_unit_plans_v1'));
  assert.ok(savedUnits.some(u => u.id === copy.id), 'the duplicated unit should be persisted to the units store');

  const savedLessons = JSON.parse(localStorageStub.getItem('ct_planner_lessons_v2'));
  copy.lessonIds.forEach(id => {
    assert.ok(savedLessons.some(l => l.id === id), `duplicated lesson ${id} should be persisted to the lessons store`);
  });
});

test('a failed save does not roll back the in-memory unit duplicate, and surfaces the same retryable banner as a lesson duplicate', () => {
  resetState();
  const realSaveUnitPlansState = sandbox.saveUnitPlansState;
  sandbox.saveUnitPlansState = () => false; // simulate a localStorage write failure

  let shownMessage = null, shownRetry = null;
  const realShowBanner = sandbox.showLessonSaveFailureBanner;
  sandbox.showLessonSaveFailureBanner = (message, onRetry) => { shownMessage = message; shownRetry = onRetry; };

  sandbox.unitDuplicate('unit_1');

  const units = getState().unitPlans;
  assert.strictEqual(units.length, 2, 'the in-memory duplicated unit must not be rolled back on a save failure');
  assert.ok(shownMessage && /could not be saved/i.test(shownMessage), 'a failure banner explaining the save failed should be shown, not swallowed silently');
  assert.strictEqual(typeof shownRetry, 'function', 'the banner should be given a retry callback');

  sandbox.saveUnitPlansState = realSaveUnitPlansState;
  sandbox.showLessonSaveFailureBanner = realShowBanner;
});

test('retrying a failed unit duplicate save re-attempts the write (not the duplication itself)', () => {
  resetState();
  const realSaveUnitPlansState = sandbox.saveUnitPlansState;
  let saveShouldFail = true;
  sandbox.saveUnitPlansState = (...args) => saveShouldFail ? false : realSaveUnitPlansState(...args);

  let hideCalled = false;
  const realHideBanner = sandbox.hideLessonSaveFailureBanner;
  sandbox.hideLessonSaveFailureBanner = (...args) => { hideCalled = true; return realHideBanner(...args); };

  sandbox.unitDuplicate('unit_1');
  const unitsAfterFailure = getState().unitPlans.length;
  assert.strictEqual(unitsAfterFailure, 2, 'the duplicate should exist in memory despite the failed save');

  hideCalled = false; // showLessonSaveFailureBanner() itself calls hide once before showing — reset for a clean read of the retry's own outcome
  saveShouldFail = false;
  sandbox.retryLessonSave(); // simulates clicking "Retry" on the banner

  assert.strictEqual(hideCalled, true, 'the failure banner should be hidden once the retry succeeds');
  assert.strictEqual(getState().unitPlans.length, unitsAfterFailure, 'retrying must not duplicate the unit again — only the write is retried');
  const savedUnits = JSON.parse(localStorageStub.getItem('ct_unit_plans_v1'));
  assert.strictEqual(savedUnits.length, unitsAfterFailure, 'the retried save should persist the same duplicate, not a second one');

  sandbox.saveUnitPlansState = realSaveUnitPlansState;
  sandbox.hideLessonSaveFailureBanner = realHideBanner;
});

test('the unit list renders a Duplicate button wired to unitDuplicate, separate from Delete', () => {
  resetState();
  const st = getState();
  st.currentView = 'unit-plans';
  sandbox.unitPlansEnsureUiState();
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes('>Duplicate<'), 'a "Duplicate" button should render on the unit card');
  assert.ok(html.includes("unitDuplicate('unit_1')"), 'the Duplicate button should call unitDuplicate with the unit id');
  assert.ok(/Duplicate<\/button>[\s\S]*?unitDelete/.test(html), 'Duplicate and Delete should both be present as separate controls');
  assert.ok(/onclick="event\.stopPropagation\(\);unitDuplicate/.test(html), 'the Duplicate button must stop propagation so it does not also open the unit detail view');
  // keydown bubbles independently of click (same gap already fixed for
  // .planner-occ-remove) — without this, pressing Enter/Space on the focused
  // Duplicate button would also fire the parent .unit-card's onkeydown (open detail)
  // in the same keystroke, since the card's own handler treats Enter/Space as "open".
  assert.ok(/unit-card-duplicate[\s\S]*?onkeydown="event\.stopPropagation\(\)"/.test(html), 'the Duplicate button must stop keydown propagation too, not just click');
});

// ── Class Settings: year level field + Weekly Planner IC suggestion filter ──────
console.log('Class year level: settings field + IC suggestion filter');

// classSettings isn't touched by resetState() (it's independent of the lesson/unit
// fixtures), so each test in this section resets it explicitly to a single known
// group with no year level set, to avoid bleeding state between tests.
function resetClassSettings() {
  const st = getState();
  st.classSettings = {
    groups: [{ id: 'main', name: 'My Class', color: '#4f8ef7', disabledSubjects: {}, disabledStrands: {}, disabledAreas: {}, yearLevels: [] }],
    activeGroup: 'main',
  };
}

test('loadClassSettings() normalises yearLevels from stored data, defaulting to []', () => {
  localStorageStub.setItem('ct_class_settings', JSON.stringify({
    groups: [{ id: 'main', name: 'My Class', yearLevels: ['3', '4'] }],
    activeGroup: 'main',
  }));
  const loaded = sandbox.loadClassSettings();
  eqJson(loaded.groups[0].yearLevels, ['3', '4']);

  localStorageStub.setItem('ct_class_settings', JSON.stringify({
    groups: [{ id: 'main', name: 'My Class' }], // no yearLevels field at all — legacy/pre-existing data
    activeGroup: 'main',
  }));
  const loadedLegacy = sandbox.loadClassSettings();
  eqJson(loadedLegacy.groups[0].yearLevels, [], 'legacy stored groups without yearLevels should default to []');

  localStorageStub.removeItem('ct_class_settings');
});

test('toggleYearLevel adds/removes a year level on the active group and persists it', () => {
  resetClassSettings();
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '3', checked: true });
  eqJson(sandbox.getActiveGroupYearLevels(), ['3']);
  const saved = JSON.parse(localStorageStub.getItem('ct_class_settings'));
  eqJson(saved.groups[0].yearLevels, ['3'], 'the toggle should persist to localStorage');

  sandbox.applyClassSettingAction('toggleYearLevel', { key: '4', checked: true });
  eqJson(sandbox.getActiveGroupYearLevels(), ['3', '4']);

  sandbox.applyClassSettingAction('toggleYearLevel', { key: '3', checked: false });
  eqJson(sandbox.getActiveGroupYearLevels(), ['4'], 'unticking should remove just that year level');
});

test('the class settings panel renders a checkbox per year level, checked to match the active group, wired to toggleYearLevel', () => {
  resetClassSettings();
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '2', checked: true });
  const html = sandbox.buildClassSettingsSection();
  assert.ok(html.includes('YEAR LEVEL(S)'), 'a year level section should render');
  assert.ok(/data-cs-action="toggleYearLevel" data-cs-key="2"[^>]*checked/.test(html), 'Year 2 should render checked');
  assert.ok(!/data-cs-action="toggleYearLevel" data-cs-key="5"[^>]*checked/.test(html), 'Year 5 should render unchecked');
  assert.ok(html.includes('Foundation') && html.includes('Year 6'), 'all year levels F-6 should be offered');
  // Object.keys(YLM) is NOT school order here: JS enumerates integer-like string keys
  // ('1'..'6') before non-numeric ones ('F'), which would silently put Foundation last.
  assert.ok(html.indexOf('Foundation') < html.indexOf('Year 1'), 'Foundation must render before Year 1, matching real school order');
});

// Minimal fixture for plannerSuggestICsFromIntention: two Mathematics ICs with
// near-identical name/description (so token scoring treats them equally) but homed on
// descriptors with different Year Level values, isolating the year-level filter as the
// only differentiator. Intention tokens surviving stopword-cleaning: partition, place,
// value, understanding ("numbers"/"using" are stopwords) — weights 2+1+1+2 = 6 max.
function setSuggestICsFixture() {
  const st = getState();
  st.curriculumCodes = [
    { Code: 'AC9M2N01', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 2', Descriptor: 'partition numbers using place value' },
    { Code: 'AC9M5N01', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 5', Descriptor: 'partition numbers using place value' },
  ];
  st.instructionalComponents = [
    { id: 'ic_y2', homeDescriptorId: 'AC9M2N01', linkedDescriptorIds: [], name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_y5', homeDescriptorId: 'AC9M5N01', linkedDescriptorIds: [], name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Partition numbers using place value understanding.' };
  st.plannerUi.selectedLessonId = 'sa_1';
}

test('plannerSuggestICsFromIntention excludes ICs whose home descriptor is outside the class\'s set year level(s)', () => {
  resetState();
  resetClassSettings();
  setSuggestICsFixture();
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '2', checked: true });

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_y2'), 'the IC homed on the Year 2 descriptor should be ranked');
  assert.ok(!Object.prototype.hasOwnProperty.call(scores, 'ic_y5'), 'the IC homed on the Year 5 descriptor must be excluded even though it scores identically on tokens');
});

test('plannerSuggestICsFromIntention falls back to no year restriction when the class has no year level set', () => {
  resetState();
  resetClassSettings(); // yearLevels: [] — nothing set
  setSuggestICsFixture();

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_y2'), 'the Year 2 IC should still be ranked');
  assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_y5'), 'the Year 5 IC should also be ranked — no year level set means no restriction, not "show nothing"');
});

test('plannerSuggestICsFromIntention supports multiple set year levels (composite class)', () => {
  resetState();
  resetClassSettings();
  setSuggestICsFixture();
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '2', checked: true });
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '5', checked: true });

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_y2'));
  assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_y5'), 'both set year levels should be included, not just the first');
});

test('the year-level filter is banded-subject aware — a BANDED_SUBJECTS subject compares via bandYearLevel(), not the raw class year', () => {
  resetState();
  resetClassSettings();
  const st = getState();
  // 'Design and Technologies' is in BANDED_SUBJECTS; bandYearLevel() maps 'Year 1'
  // -> 'Foundation' and 'Year 2' -> 'Year 2' (see bandYearLevel()), so these two
  // descriptors are only reachable through the banded comparison, not a direct match.
  // Intention tokens surviving cleaning: build, wooden, birdhouse, recycled, timber
  // (none are stopwords) — weights 1+1+2+2+1 = 7 max.
  st.curriculumCodes = [
    { Code: 'DT_FOUND', Subject: 'Design and Technologies', Strand: 'Processes', 'Year Level': 'Foundation', Descriptor: 'design a simple wooden object' },
    { Code: 'DT_YEAR2', Subject: 'Design and Technologies', Strand: 'Processes', 'Year Level': 'Year 2', Descriptor: 'design a simple wooden object' },
  ];
  st.instructionalComponents = [
    { id: 'ic_found', homeDescriptorId: 'DT_FOUND', linkedDescriptorIds: [], name: 'Build a wooden birdhouse', description: 'Student can build a wooden birdhouse using recycled timber.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_y2dt', homeDescriptorId: 'DT_YEAR2', linkedDescriptorIds: [], name: 'Build a wooden birdhouse', description: 'Student can build a wooden birdhouse using recycled timber.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Design and Technologies', intention: 'Build a wooden birdhouse using recycled timber.' };
  st.plannerUi.selectedLessonId = 'sa_1';

  // A Year 1 class bands to Foundation for this subject.
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '1', checked: true });
  sandbox.plannerSuggestICsFromIntention();
  let scores = getState().plannerUi.suggestionScores;
  assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_found'), 'Year 1 bands to Foundation and should match the IC homed on the Foundation descriptor');
  assert.ok(!Object.prototype.hasOwnProperty.call(scores, 'ic_y2dt'), 'Year 1 (banded to Foundation) must not match the IC homed on a Year 2 descriptor');

  // Switch the class to Year 2 (bands to itself) — now the Year 2 descriptor matches instead.
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '1', checked: false });
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '2', checked: true });
  sandbox.plannerSuggestICsFromIntention();
  scores = getState().plannerUi.suggestionScores;
  assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_y2dt'), 'Year 2 bands to itself and should match the IC homed on the Year 2 descriptor');
  assert.ok(!Object.prototype.hasOwnProperty.call(scores, 'ic_found'), 'Year 2 must not match the IC homed on the Foundation descriptor');
});

test('an IC\'s own home descriptor determines its year eligibility — a linkedDescriptorIds tether to an in-year descriptor cannot pull in an otherwise out-of-year IC', () => {
  // Candidate gathering now resolves each IC's OWN homeDescriptorId directly (not via
  // getICsForDescriptor's home-OR-linked lookup), so tethering can no longer smuggle an
  // out-of-year IC in — this replaces the old "cross-year leak via linkedDescriptorIds"
  // protection with a structurally simpler guarantee: candidacy is decided by the IC's
  // own home descriptor, full stop.
  resetState();
  resetClassSettings();
  setSuggestICsFixture();
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '2', checked: true }); // Year 2 only
  const st = getState();
  // Same content as ic_y2 (so it would score identically if it were ever considered),
  // but homed on the out-of-year (Year 5) descriptor and tethered to the in-year one.
  st.instructionalComponents.push({
    id: 'ic_leaked', homeDescriptorId: 'AC9M5N01', linkedDescriptorIds: ['AC9M2N01'],
    name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding.',
    isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false,
  });

  sandbox.plannerSuggestICsFromIntention();
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(suggested.includes('ic_y2'), 'an IC actually homed on the in-year descriptor should still be suggested');
  assert.ok(!suggested.includes('ic_leaked'), 'an IC homed on an out-of-year descriptor must not leak through just because it is tethered to an in-year one');
});

test('an IC whose home descriptor cannot be resolved is dropped from suggestions, not failed open — the renderer could never show it anyway', () => {
  // plannerICResultsHtml's own subjectPool requires a resolved, subject-matching
  // descriptor to render an IC (see its `cd && curriculumSubjects.includes(cd.Subject)`
  // check) — so a "fail open" IC here would never actually reach the screen. It would only occupy
  // one of the 20 ranked slots and make the toast's count claim more matches than the
  // results panel ends up showing. Dropping it here keeps the two paths consistent.
  resetState();
  resetClassSettings();
  setSuggestICsFixture();
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '2', checked: true });

  const st = getState();
  st.instructionalComponents = [
    {
      id: 'ic_orphaned_home', homeDescriptorId: 'AC9DOES_NOT_EXIST', linkedDescriptorIds: ['AC9M2N01'],
      name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding.',
      isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false,
    },
  ];

  sandbox.plannerSuggestICsFromIntention();
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(!suggested.includes('ic_orphaned_home'), 'an IC with an unresolvable home descriptor must not be suggested — it can never render, so counting it would make the toast lie about how many results actually show');
});

test('orphan-home ICs do not consume ranking capacity that a resolvable, lower-scoring match should get', () => {
  // Before this fix, 20+ unresolvable-home ICs could fail open into `scored`, fill the
  // entire 20-slot cap on their own (their score is irrelevant once there are enough of
  // them), and push out a real, resolvable candidate — even though none of those orphans
  // could ever actually render (see the test above). Excluding them at the filter stage
  // means the cap is only ever spent on ICs that can genuinely appear in the results.
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [
    { Code: 'CD_REAL', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'a real descriptor' },
  ];
  const orphanICs = Array.from({ length: 25 }, (_, i) => ({
    id: `ic_orphan_${i}`, homeDescriptorId: 'AC9DOES_NOT_EXIST', linkedDescriptorIds: [],
    name: 'Partition numbers using place value understanding for addition', description: 'Student can partition numbers using place value understanding for addition strategies.',
    isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false,
  }));
  const realIC = {
    id: 'ic_real', homeDescriptorId: 'CD_REAL', linkedDescriptorIds: [],
    name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding.',
    isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false,
  };
  st.instructionalComponents = [...orphanICs, realIC];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Partition numbers using place value understanding.' };
  st.plannerUi.selectedLessonId = 'ul_1';

  sandbox.plannerSuggestICsFromIntention();
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(suggested.includes('ic_real'), 'the one resolvable, genuinely matching IC must be suggested even though 25 unresolvable ICs would otherwise have filled the cap');
});

// Fixture for the unit-CD priority boost: ic_high scores much higher on tokens and
// ic_unitcd scores lower but non-zero — the unit links to ic_unitcd's descriptor, so a
// passing test must show the boost actually overriding score order, not just happening
// to agree with it. Intention tokens surviving cleaning: partition, place, value,
// understanding, addition ("numbers"/"using"/"strategies" are stopwords) — weights
// 2+1+1+2+2 = 8 max. ic_high matches all 5 (score 8, ratio 1.0, strong); ic_unitcd
// matches only "addition" (score 2, ratio 0.25, weak/other) — a large, unambiguous gap.
function setUnitCDBoostFixture() {
  const st = getState();
  st.curriculumCodes = [
    { Code: 'AC9M_HIGH', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'partition numbers using place value understanding' },
    { Code: 'AC9M_UNITCD', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'addition strategies for whole numbers' },
  ];
  st.instructionalComponents = [
    { id: 'ic_high', homeDescriptorId: 'AC9M_HIGH', linkedDescriptorIds: [], name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding for addition.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_unitcd', homeDescriptorId: 'AC9M_UNITCD', linkedDescriptorIds: [], name: 'Solve an addition problem', description: 'Student can solve an addition problem efficiently.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = {
    ...st.lessonPlans[idx],
    subject: 'Mathematics',
    intention: 'Partition numbers using place value understanding for addition strategies.',
  };
  st.plannerUi.selectedLessonId = 'ul_1';
}

test('plannerSuggestICsFromIntention boosts a unit lesson\'s unit-linked CDs to the top, regardless of token score', () => {
  resetState();
  resetClassSettings();
  setUnitCDBoostFixture();
  const st = getState();
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['AC9M_UNITCD'] };

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  const suggested = getState().plannerUi.suggestedICIds;

  assert.ok(scores.ic_high > scores.ic_unitcd, 'sanity check: ic_high must genuinely outscore ic_unitcd on tokens alone — scoring itself is untouched');
  assert.ok(suggested.includes('ic_high') && suggested.includes('ic_unitcd'), 'the non-unit IC must still be included, not hidden — this is a priority boost, not a restriction');
  assert.ok(suggested.indexOf('ic_unitcd') < suggested.indexOf('ic_high'), 'the unit-linked IC must be boosted ahead of the higher-scoring non-unit IC');
});

test('the boost survives into the rendered IC results HTML, not just the internal suggestedICIds order', () => {
  // plannerICResultsHtml() rebuilds its own render order from resultIcs/scores rather
  // than reusing suggestedICIds's order — so the internal-order assertion above isn't
  // proof the teacher actually sees the boost. Use a fixture where both ICs land in the
  // same confidence tier ("strong"), so a same-tier score-only sort would still put the
  // higher-scoring non-unit IC first — a regression here would look identical to the
  // pre-fix behaviour Codex flagged (the render path silently discarding the boost).
  // Same 5-token budget as setUnitCDBoostFixture (max 8): ic_high matches all 5 (score
  // 8); ic_unitcd matches 4 of 5 (drops "place", 1pt) for score 7 — ratio 7/8 = 0.875,
  // both comfortably "strong".
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [
    { Code: 'AC9M_HIGH', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'partition numbers using place value understanding for addition strategies' },
    { Code: 'AC9M_UNITCD', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'partition numbers using place value for addition strategies' },
  ];
  st.instructionalComponents = [
    { id: 'ic_high', homeDescriptorId: 'AC9M_HIGH', linkedDescriptorIds: [], name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding for addition.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_unitcd', homeDescriptorId: 'AC9M_UNITCD', linkedDescriptorIds: [], name: 'Partition numbers using value', description: 'Student can partition numbers using value understanding for addition.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = {
    ...st.lessonPlans[idx],
    subject: 'Mathematics',
    intention: 'Partition numbers using place value understanding for addition strategies.',
  };
  st.plannerUi.selectedLessonId = 'ul_1';
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['AC9M_UNITCD'] };

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  // Sanity: both ICs must land in the same ("strong") confidence tier, or this test
  // would pass/fail for the wrong reason (tier bucketing, not the boost, deciding order).
  const maxScore = Math.max(scores.ic_high, scores.ic_unitcd);
  assert.ok(scores.ic_unitcd / maxScore >= 0.8, 'fixture sanity: both ICs must be in the "strong" tier for this test to isolate the boost');
  assert.ok(scores.ic_high > scores.ic_unitcd, 'fixture sanity: ic_high must still genuinely outscore ic_unitcd');

  // The boost now surfaces as its own group ("Strong matches - this unit's CDs"),
  // open by default and ordered ahead of the non-unit "Strong matches - other CDs"
  // group (which starts collapsed) — see the group-based rendering tests below for
  // full coverage of that structure. Here we just confirm the boosted IC's group
  // heading precedes the other group's heading, and the boosted IC actually renders
  // (open by default) while the higher-scoring non-unit IC does not until expanded.
  const html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  // escapeHtml() turns the heading's apostrophe into &#39; — match on "this unit" alone
  // to avoid a false failure from the entity encoding rather than the actual ordering.
  const linkedHeadingPos = html.indexOf('this unit');
  const otherHeadingPos = html.indexOf('other CDs');
  assert.ok(linkedHeadingPos !== -1 && otherHeadingPos !== -1, 'both group headings should render');
  assert.ok(linkedHeadingPos < otherHeadingPos, 'the unit-linked group must be ordered ahead of the other-CDs group');
  assert.ok(html.includes('data-ic-id="ic_unitcd"'), 'the unit-linked IC\'s group is open by default, so it should render');
  assert.ok(!html.includes('data-ic-id="ic_high"'), 'the higher-scoring non-unit IC\'s group starts collapsed, so its row should not render yet');
});

test('plannerSuggestICsFromIntention leaves standalone lessons (no unitId) ordered by score alone', () => {
  resetState();
  resetClassSettings();
  setUnitCDBoostFixture();
  const st = getState();
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['AC9M_UNITCD'] };
  // Same intention/subject, but on the standalone lesson instead of the unit one.
  const saIdx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[saIdx] = { ...st.lessonPlans[saIdx], subject: 'Mathematics', intention: st.lessonPlans.find(l => l.id === 'ul_1').intention };
  st.plannerUi.selectedLessonId = 'sa_1';

  sandbox.plannerSuggestICsFromIntention();
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(suggested.indexOf('ic_high') < suggested.indexOf('ic_unitcd'), 'a standalone lesson has no owning unit to boost from, so the higher-scoring IC must still lead');
});

test('plannerSuggestICsFromIntention leaves a unit lesson ordered by score alone when its unit has no linkedCDIds set', () => {
  resetState();
  resetClassSettings();
  setUnitCDBoostFixture();
  // unit_1.linkedCDIds is [] by default in resetState()'s fixture — no boost should apply.

  sandbox.plannerSuggestICsFromIntention();
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(suggested.indexOf('ic_high') < suggested.indexOf('ic_unitcd'), 'with no linkedCDIds set on the unit, ordering must be unchanged from today (score order)');
});

test('the unit-CD priority boost does not bypass the class year-level filter — a unit-linked CD outside the class year is still excluded', () => {
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [
    { Code: 'AC9M_YEAR5', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 5', Descriptor: 'partition numbers using place value understanding' },
    { Code: 'AC9M_YEAR2', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 2', Descriptor: 'partition numbers using place value understanding' },
  ];
  st.instructionalComponents = [
    { id: 'ic_year5', homeDescriptorId: 'AC9M_YEAR5', linkedDescriptorIds: [], name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_year2', homeDescriptorId: 'AC9M_YEAR2', linkedDescriptorIds: [], name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Partition numbers using place value understanding.' };
  st.plannerUi.selectedLessonId = 'ul_1';
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  // The unit is built around the Year 5 descriptor, but this class is set to Year 2.
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['AC9M_YEAR5'] };
  sandbox.applyClassSettingAction('toggleYearLevel', { key: '2', checked: true });

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  assert.ok(!Object.prototype.hasOwnProperty.call(scores, 'ic_year5'), 'a unit-linked CD outside the class\'s year level must still be excluded — the boost only reorders ICs that already passed the year filter');
  assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_year2'), 'the in-year IC should still be ranked normally');
});

// ── PLANNER_SUBJECTS broad category -> curriculum data's granular Subject mapping ──
console.log('Broad-subject-to-granular-curriculum-subject mapping (Arts/Technologies/Health & PE)');

// PLANNER_SUBJECTS offers 8 broad categories, but curriculum data's actual .Subject
// values are the granular Australian Curriculum subjects (see BANDED_SUBJECTS). Before
// plannerCurriculumSubjectsFor(), a unit/lesson set to 'The Arts', 'Technologies', or
// 'Health & PE' could never match any curriculum code — a direct c.Subject ===
// unit.subject/lesson.subject equality check compared a broad bucket name against a
// granular value that never equals it. Covers all three affected call sites:
// unitCDResultsHtml (unit CD linking), plannerICResultsHtml (lesson IC picker), and
// plannerSuggestICsFromIntention (the "Suggest from intention" scorer) — the third one
// found during this fix's own audit, beyond the two named in the original report.
function setBroadSubjectFixture(broadSubject, granularSubject) {
  resetClassSettings(); // fresh, nothing disabled — isCurriculumCodeEnabled() must not itself hide the fixture
  const st = getState();
  st.curriculumCodes = [
    { Code: 'CD_1', Subject: granularSubject, Strand: 'Strand A', 'Year Level': 'Year 3', Descriptor: 'first descriptor' },
    { Code: 'CD_2', Subject: granularSubject, Strand: 'Strand A', 'Year Level': 'Year 3', Descriptor: 'second descriptor' },
  ];
  st.instructionalComponents = [
    { id: 'ic_1', homeDescriptorId: 'CD_1', linkedDescriptorIds: [], name: 'Skill one', description: 'Skill one description.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], subject: broadSubject, yearLevel: '3' };
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: broadSubject, unitId: 'unit_1' };
  // Bypass year filtering (unitCDMatchesYear/icYearFiltered band Year 3 -> Year 4 for
  // BANDED_SUBJECTS, per bandYearLevel — a real, separately-tested behaviour, not what
  // this fixture is isolating) so only the subject taxonomy mapping is under test here.
  st.unitPlansUi.cdShowAllYears = true;
  st.plannerUi.icShowAllYears = true;
  // plannerEnsureUiState() only fills these in if absent (an "ensure", not a reset), so
  // a leftover suggestion run from an earlier test in this file could otherwise make
  // plannerICResultsHtml take its "suggestionsAreForThisLesson" branch instead of the
  // plain browse path this fixture means to exercise. Clear explicitly.
  st.plannerUi.suggestedICIds = [];
  st.plannerUi.suggestionScores = {};
  st.plannerUi.suggestionLessonId = null;
  st.plannerUi.icSearch = '';
  return st;
}

['The Arts', 'Technologies', 'Health & PE'].forEach(broadSubject => {
  const granular = sandbox.plannerCurriculumSubjectsFor(broadSubject);

  test(`unitCDResultsHtml surfaces curriculum descriptors for a unit set to '${broadSubject}' — previously always zero results, for any search term`, () => {
    resetState();
    setBroadSubjectFixture(broadSubject, granular[0]);
    const st = getState();
    const unit = st.unitPlans.find(u => u.id === 'unit_1');
    const html = sandbox.unitCDResultsHtml(unit);
    assert.ok(html.includes('CD_1') && html.includes('CD_2'), `descriptors with Subject '${granular[0]}' must surface for a unit whose broad subject is '${broadSubject}'`);
    assert.ok(!html.includes('unit-cd-empty'), 'must not fall through to the "No descriptors for this subject" empty state');
  });

  test(`plannerICResultsHtml surfaces ICs for a lesson set to '${broadSubject}' — previously always zero results`, () => {
    resetState();
    setBroadSubjectFixture(broadSubject, granular[0]);
    const st = getState();
    const lesson = st.lessonPlans.find(l => l.id === 'ul_1');
    const html = sandbox.plannerICResultsHtml(lesson);
    assert.ok(html.includes('data-ic-id="ic_1"') || html.includes('ic_1'), `an IC homed on a '${granular[0]}' descriptor must surface for a lesson whose broad subject is '${broadSubject}'`);
  });

  test(`plannerSuggestICsFromIntention scores ICs for a lesson set to '${broadSubject}' — previously the candidate pool was always empty`, () => {
    resetState();
    resetClassSettings();
    setBroadSubjectFixture(broadSubject, granular[0]);
    const st = getState();
    const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
    st.lessonPlans[idx] = { ...st.lessonPlans[idx], intention: 'Skill one description.' };
    st.plannerUi.selectedLessonId = 'ul_1';

    sandbox.plannerSuggestICsFromIntention();
    const scores = getState().plannerUi.suggestionScores;
    assert.ok(Object.prototype.hasOwnProperty.call(scores, 'ic_1'), `an IC homed on a '${granular[0]}' descriptor must be scored for a lesson whose broad subject is '${broadSubject}'`);
  });
});

// Pooling CDs across multiple granular subjects (The Arts, Technologies) under one
// broad-category unit means search/label need to disambiguate WHICH granular subject a
// result belongs to — otherwise a teacher can never reliably search for, or even see,
// e.g. Digital Technologies specifically within a Technologies unit (review finding on
// this PR). Health & PE maps to a single granular subject, so it's the negative control
// here — no disambiguation is needed or shown for it, same as any ordinary subject.
test('unitCDResultsHtml lets a search term match the granular curriculum Subject itself, not just Code/Strand/descriptor text, for a broad category mapped to multiple granular subjects', () => {
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [
    { Code: 'DT_1', Subject: 'Design and Technologies', Strand: 'Processes', 'Year Level': 'Year 3', Descriptor: 'build a simple structure' },
    { Code: 'DT_2', Subject: 'Digital Technologies', Strand: 'Processes', 'Year Level': 'Year 3', Descriptor: 'follow a sequence of steps' },
  ];
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], subject: 'Technologies', yearLevel: '3' };
  st.unitPlansUi.cdShowAllYears = true;
  const unit = st.unitPlans.find(u => u.id === 'unit_1');

  st.unitPlansUi.cdSearch = 'digital technologies';
  let html = sandbox.unitCDResultsHtml(unit);
  assert.ok(html.includes('DT_2'), 'searching the granular subject name must match a descriptor whose Subject is that exact granular value');
  assert.ok(!html.includes('DT_1'), 'the other granular subject\'s descriptor must not match a search for a different one');

  st.unitPlansUi.cdSearch = 'design and technologies';
  html = sandbox.unitCDResultsHtml(unit);
  assert.ok(html.includes('DT_1') && !html.includes('DT_2'), 'the reverse search must isolate the other granular subject');
});

test('unitCDResultsHtml shows each result\'s granular curriculum Subject when the unit\'s broad subject maps to more than one (The Arts, Technologies), so results from different curriculum areas stay distinguishable — but omits it for a broad subject that maps to only one, where it would be redundant', () => {
  resetState();
  resetClassSettings();
  const st = getState();
  st.unitPlansUi.cdSearch = ''; // resetState() doesn't clear this — must not inherit a leftover search from an earlier test
  st.curriculumCodes = [
    { Code: 'DT_1', Subject: 'Design and Technologies', Strand: 'Processes', 'Year Level': 'Year 3', Descriptor: 'build a simple structure' },
    { Code: 'DT_2', Subject: 'Digital Technologies', Strand: 'Processes', 'Year Level': 'Year 3', Descriptor: 'follow a sequence of steps' },
  ];
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], subject: 'Technologies', yearLevel: '3' };
  st.unitPlansUi.cdShowAllYears = true;
  let unit = st.unitPlans.find(u => u.id === 'unit_1');
  let html = sandbox.unitCDResultsHtml(unit);
  assert.ok(html.includes('Design and Technologies') && html.includes('Digital Technologies'), 'a Technologies unit (2 granular subjects) must show each result\'s own granular subject');

  // Negative control: Health & PE maps to a single granular subject (HPE) — no
  // disambiguation is needed, so it must not be shown (matching ordinary, unmapped
  // subjects like Mathematics, which never show a redundant subject label either).
  st.curriculumCodes = [
    { Code: 'HPE_1', Subject: 'HPE', Strand: 'Movement', 'Year Level': 'Year 3', Descriptor: 'practise fundamental movement skills' },
  ];
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], subject: 'Health & PE' };
  unit = st.unitPlans.find(u => u.id === 'unit_1');
  html = sandbox.unitCDResultsHtml(unit);
  assert.ok(html.includes('HPE_1'), 'sanity: the HPE descriptor must still surface');
  assert.ok(html.includes(' · Movement'), 'sanity: the Strand must still render as normal');
  assert.ok(!html.includes(' · HPE · Movement'), 'a single-granular-subject broad category must not show a redundant subject label per result');
});

test('plannerCurriculumSubjectsFor maps each of the 3 broad-but-granular categories to their exact curriculum Subject values, reusing BANDED_SUBJECTS\' own spellings, and falls back to [subject] itself for the other 5 PLANNER_SUBJECTS categories', () => {
  eqJson(sandbox.plannerCurriculumSubjectsFor('The Arts').slice().sort(), ['Dance', 'Drama', 'Media Arts', 'Music', 'Visual Arts']);
  eqJson(sandbox.plannerCurriculumSubjectsFor('Technologies').slice().sort(), ['Design and Technologies', 'Digital Technologies']);
  eqJson(sandbox.plannerCurriculumSubjectsFor('Health & PE'), ['HPE']);
  // Every mapped granular value must actually be one BANDED_SUBJECTS already tracks —
  // no independently-redefined spelling that could silently drift from it.
  ['The Arts', 'Technologies', 'Health & PE'].forEach(broad => {
    sandbox.plannerCurriculumSubjectsFor(broad).forEach(granular => {
      assert.ok(PLANNER_SUBJECT_CONSTANTS.BANDED_SUBJECTS.has(granular), `'${granular}' (mapped from '${broad}') must be one of BANDED_SUBJECTS' own tracked values`);
    });
  });
  ['English', 'Mathematics', 'Science', 'HASS', 'Languages'].forEach(subject => {
    eqJson(sandbox.plannerCurriculumSubjectsFor(subject), [subject], `'${subject}' has no granular split — curriculum data's Subject value already equals it exactly`);
  });
});

test('PLANNER_SUBJECTS itself is untouched — still exactly the 8 broad categories, not restructured into granular ones', () => {
  eqJson(PLANNER_SUBJECT_CONSTANTS.PLANNER_SUBJECTS, ['English','Mathematics','Science','HASS','The Arts','Technologies','Health & PE','Languages']);
});

// ── Stopwords / absolute confidence floor / IC-level scoring (v1.13.70 fix) ──────
console.log('Suggest from intention: stopwords, confidence floor, IC-level scoring');

test('curriculum-vocabulary stopwords are stripped before scoring — an overlap on generic instructional words alone does not count', () => {
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [{ Code: 'CD_A', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'some descriptor text' }];
  st.instructionalComponents = [
    // Shares ONLY stopwords with the intention below ("using", "strategies", "solve",
    // "problems") — no genuine content overlap.
    { id: 'ic_stopwords_only', homeDescriptorId: 'CD_A', linkedDescriptorIds: [], name: 'Use a strategy to solve problems', description: 'Student can use an appropriate strategy when solving problems.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    // Shares the one genuine content word ("efficient").
    { id: 'ic_real_overlap', homeDescriptorId: 'CD_A', linkedDescriptorIds: [], name: 'Work efficiently', description: 'Student can complete the task efficiently.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Using efficient strategies to solve problems.' };
  st.plannerUi.selectedLessonId = 'ul_1';

  sandbox.plannerSuggestICsFromIntention();
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(!suggested.includes('ic_stopwords_only'), 'an IC that only overlaps on generic instructional words (using/strategies/solve/problems) must not be suggested');
  assert.ok(suggested.includes('ic_real_overlap'), 'an IC sharing the one genuine content word (efficient) should still be suggested');
});

test('a match scoring below the "any match" floor is not suggested at all', () => {
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [{ Code: 'CD_A', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'some descriptor text' }];
  st.instructionalComponents = [
    // Matches only "read" (a single 1-point token) — below PLANNER_MIN_SUGGESTION_SCORE.
    { id: 'ic_below_floor', homeDescriptorId: 'CD_A', linkedDescriptorIds: [], name: 'Read a numeral', description: 'Student can read a two-digit numeral.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Read a story.' };
  st.plannerUi.selectedLessonId = 'ul_1';

  sandbox.plannerSuggestICsFromIntention();
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(!suggested.includes('ic_below_floor'), 'a lone 1-point token overlap ("read") must not clear the minimum-suggestion-score floor');
});

test('the absolute "Strong" floor prevents a weak pool\'s best (or only) match from being mislabeled Strong', () => {
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [{ Code: 'CD_A', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'some descriptor text' }];
  st.instructionalComponents = [
    // Matches only "partitioning" (a single 2-point token) — the only/best match in the
    // pool (ratio 1.0), but 2 is below PLANNER_MIN_STRONG_SCORE (3).
    { id: 'ic_weak_pool', homeDescriptorId: 'CD_A', linkedDescriptorIds: [], name: 'Partition a whole', description: 'Student can practice partitioning a whole into equal parts.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Partitioning practice.' };
  st.plannerUi.selectedLessonId = 'ul_1';

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  assert.strictEqual(scores.ic_weak_pool, 2, 'sanity: this IC should score exactly 2 (a single 2-point token), the only match in the pool');
  const html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  assert.ok(!html.includes('Strong matches'), 'even at ratio 1.0 (the only/best match), a raw score of 2 is below the absolute Strong floor (3) and must not render as a Strong match');
  assert.ok(html.includes('Other matches (1)'), 'it should still be suggested, just as an "Other" match, not "Strong"');

  // The "Other matches" group starts collapsed by default (see the collapsible-groups
  // tests below) — open it to confirm the IC itself really is there, not just implied
  // by the heading count.
  sandbox.plannerToggleICSuggestionGroup('otherOther', false);
  const openHtml = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  assert.ok(openHtml.includes('data-ic-id="ic_weak_pool"'), 'the IC itself should render once its "Other matches" group is opened');
});

test('an IC is scored against its own text, not inherited from its parent descriptor — two ICs on the same broad descriptor can score completely differently', () => {
  // This is the core bug this fix targets: a broad descriptor spanning multiple
  // operations ("addition and subtraction, and multiplication and division", modelled
  // on the real AC9M4N06) previously let every IC under it inherit one identical
  // descriptor-level score, so an addition-strategy IC and an unrelated halving-for-
  // multiplication IC could both show as equally "Strong" for an addition/subtraction
  // intention. Each IC must now stand on its own name/description text.
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [
    { Code: 'CD_BROAD', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 4', Descriptor: 'develop efficient strategies for addition and subtraction, and multiplication and division' },
  ];
  st.instructionalComponents = [
    { id: 'ic_addition', homeDescriptorId: 'CD_BROAD', linkedDescriptorIds: [], name: 'Use an efficient addition strategy', description: 'Student can choose and use an efficient strategy to add larger numbers using place value partitioning.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_halving', homeDescriptorId: 'CD_BROAD', linkedDescriptorIds: [], name: 'Use doubling and halving for multiplication', description: 'Student can use doubling and halving to multiply efficiently.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Mental addition and subtraction with place value partitioning' };
  st.plannerUi.selectedLessonId = 'ul_1';

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(suggested.includes('ic_addition'), 'the genuinely relevant addition-strategy IC should be suggested');
  assert.strictEqual(scores.ic_addition, 6, 'sanity: matches addition/place/value/partitioning (2+1+1+2)');
  assert.ok(!suggested.includes('ic_halving'), 'the halving-for-multiplication IC shares zero real content with an addition/subtraction intention and must not be suggested, despite sharing a broad parent descriptor with the relevant IC');
  assert.ok(!Object.prototype.hasOwnProperty.call(scores, 'ic_halving'), 'it should not even be scored above 0 — nothing in its own text overlaps the cleaned intention tokens');
});

test('subject-content nouns that recur within their own subject (e.g. "algorithms", "patterns", "numbers") are not stripped as stopwords — only genuine instructional/procedural filler is', () => {
  // Regression guard: an earlier version of the stopword list conflated "frequent
  // within one subject" with "generic filler" and stripped real content nouns like
  // "patterns", "algorithms", "numbers", "data" and "texts" — an intention using only
  // those words (plus genuinely generic ones) was cleaned down to zero tokens, so
  // nothing could ever be suggested even when a directly matching real IC existed.
  resetState();
  resetClassSettings();
  const st = getState();
  st.curriculumCodes = [{ Code: 'CD_A', Subject: 'Mathematics', Strand: 'Algebra', 'Year Level': 'Year 4', Descriptor: 'some descriptor text' }];
  st.instructionalComponents = [
    // Modelled on the real "Create an algorithm for a sequence" IC (ics_year4_maths_number.csv).
    { id: 'ic_algorithm', homeDescriptorId: 'CD_A', linkedDescriptorIds: [], name: 'Create an algorithm for a sequence', description: 'Student can create algorithms and describe an emerging pattern.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Create algorithms and identify patterns.' };
  st.plannerUi.selectedLessonId = 'ul_1';

  const tokens = sandbox.plannerCleanTokens(st.lessonPlans[idx].intention);
  assert.ok(tokens.length > 0, '"algorithms" and "patterns" must survive cleaning — they are subject content, not filler ("create" and "identify" are the only generic words here)');

  sandbox.plannerSuggestICsFromIntention();
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(suggested.includes('ic_algorithm'), 'the genuinely matching real-world IC must be suggested — this must not silently produce zero suggestions');
});

test('the unit-CD boost caps each side separately — a large unit-linked group does not crowd out every non-unit match', () => {
  // Regression guard: capping the combined (unit-linked-first) list in one slice(0,20)
  // meant that once a unit's own CDs alone produced 20+ qualifying ICs, every non-unit
  // IC was cut off entirely, no matter how high its score — turning the boost into a
  // hard restriction instead of a priority ordering.
  resetState();
  resetClassSettings();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], subject: 'Mathematics', intention: 'Partition numbers using place value understanding for addition strategies.' };
  st.plannerUi.selectedLessonId = 'ul_1';
  st.curriculumCodes = [
    { Code: 'CD_UNIT', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'unit descriptor' },
    { Code: 'CD_OTHER', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'other descriptor' },
  ];
  // 25 unit-linked ICs, each scoring only 2 ("place"+"value") — more than the old
  // combined cap of 20 on its own.
  const unitLinkedICs = Array.from({ length: 25 }, (_, i) => ({
    id: `ic_unit_${i}`, homeDescriptorId: 'CD_UNIT', linkedDescriptorIds: [],
    name: `Unit IC ${i}`, description: 'Student can use place value.',
    isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false,
  }));
  // One non-unit IC that scores far higher (matches all 6 surviving intention tokens).
  const nonUnitIC = {
    id: 'ic_other_strong', homeDescriptorId: 'CD_OTHER', linkedDescriptorIds: [],
    name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding for addition.',
    isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false,
  };
  st.instructionalComponents = [...unitLinkedICs, nonUnitIC];
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['CD_UNIT'] };

  sandbox.plannerSuggestICsFromIntention();
  const scores = getState().plannerUi.suggestionScores;
  const suggested = getState().plannerUi.suggestedICIds;
  assert.ok(scores.ic_other_strong > scores.ic_unit_0, 'sanity: the non-unit IC genuinely outscores the unit-linked ones');
  assert.ok(suggested.includes('ic_other_strong'), 'a higher-scoring non-unit IC must still be suggested even though the unit-linked group alone has more candidates than the old shared cap — priority boost, not restriction');
  assert.ok(suggested.length <= 40, 'sanity: each side is still capped (20 + 20), not unbounded');
});

// ── IC suggestion collapsible groups ─────────────────────────────────────────────
console.log('Suggest from intention: collapsible result groups');

// Four ICs, one per bucket (strong/other x linked/not-linked-to-the-unit's-CDs), each
// scored against its OWN name/description text. Intention token budget (5 surviving
// tokens after stopword-cleaning — "numbers"/"using"/"strategies" are stopwords —
// partition=2, place=1, value=1, understanding=2, addition=2; max 8):
//   ic_sl (strong, linked):     all 5 tokens -> 8  (ratio 1.00 -> strong)
//   ic_so (strong, other):     4 tokens, no "place" -> 7  (ratio 0.875 -> strong)
//   ic_ol (other/weak, linked): "place"+"value" only -> 2  (ratio 0.25 -> weak/other)
//   ic_oo (other/weak, other): "addition" only -> 2  (ratio 0.25 -> weak/other)
function setFourBucketFixture() {
  const st = getState();
  st.curriculumCodes = [
    { Code: 'CD_SL', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'partition numbers using place value understanding for addition strategies' },
    { Code: 'CD_SO', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'partition numbers using place value for addition strategies' },
    { Code: 'CD_OL', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'addition strategies with regrouping' },
    { Code: 'CD_OO', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'using place value concepts' },
  ];
  st.instructionalComponents = [
    { id: 'ic_sl', homeDescriptorId: 'CD_SL', linkedDescriptorIds: [], name: 'Partition numbers using place value', description: 'Student can partition numbers using place value understanding for addition.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_so', homeDescriptorId: 'CD_SO', linkedDescriptorIds: [], name: 'Partition numbers using value', description: 'Student can partition numbers using value understanding for addition.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_ol', homeDescriptorId: 'CD_OL', linkedDescriptorIds: [], name: 'Use place value', description: 'Student can use place value to solve problems.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
    { id: 'ic_oo', homeDescriptorId: 'CD_OO', linkedDescriptorIds: [], name: 'Solve addition problems', description: 'Student can solve addition problems efficiently.', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false },
  ];
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = {
    ...st.lessonPlans[idx],
    subject: 'Mathematics',
    intention: 'Partition numbers using place value understanding for addition strategies.',
  };
  st.plannerUi.selectedLessonId = 'ul_1';
}

test('renders four collapsible groups in order (strong+linked, strong+other, other+linked, other+other), each headed with its count', () => {
  resetState();
  resetClassSettings();
  setFourBucketFixture();
  const st = getState();
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['CD_SL', 'CD_OL'] };

  sandbox.plannerSuggestICsFromIntention();
  const html = sandbox.plannerICResultsHtml(lessonById('ul_1'));

  const posStrongLinked = html.indexOf('Strong matches - this unit');
  const posStrongOther = html.indexOf('Strong matches - other CDs');
  const posOtherLinked = html.indexOf('Other matches - this unit');
  const posOtherOther = html.indexOf('Other matches - other CDs');
  assert.ok([posStrongLinked, posStrongOther, posOtherLinked, posOtherOther].every(p => p !== -1), 'all four group headings should render');
  assert.ok(posStrongLinked < posStrongOther && posStrongOther < posOtherLinked && posOtherLinked < posOtherOther, 'groups must render in order: strong+linked, strong+other, other+linked, other+other');
  assert.ok(html.includes('this unit') && /\(1\)/.test(html.slice(posStrongLinked, posStrongLinked + 40)), 'each group heading should show its own count');
});

test('only the lead group (strong matches linked to this unit) is open by default — the other three start collapsed', () => {
  resetState();
  resetClassSettings();
  setFourBucketFixture();
  const st = getState();
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['CD_SL', 'CD_OL'] };

  sandbox.plannerSuggestICsFromIntention();
  const html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  assert.ok(html.includes('data-ic-id="ic_sl"'), 'the strong+linked IC should render — its group is open by default');
  assert.ok(!html.includes('data-ic-id="ic_so"'), 'the strong+other IC should not render yet — collapsed by default');
  assert.ok(!html.includes('data-ic-id="ic_ol"'), 'the other+linked IC should not render yet — collapsed by default');
  assert.ok(!html.includes('data-ic-id="ic_oo"'), 'the other+other IC should not render yet — collapsed by default');
});

test('clicking a collapsed group heading (plannerToggleICSuggestionGroup) opens it and reveals its rows; clicking again re-collapses it', () => {
  resetState();
  resetClassSettings();
  setFourBucketFixture();
  const st = getState();
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['CD_SL', 'CD_OL'] };
  sandbox.plannerSuggestICsFromIntention();

  // The heading itself carries the exact onclick call to invoke — matching the toggle
  // convention already used elsewhere in this file (fireInlineKeydown / extractAttr).
  sandbox.plannerToggleICSuggestionGroup('strongOther', false);
  let html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  assert.ok(html.includes('data-ic-id="ic_so"'), 'toggling the strong+other group open should reveal its row');

  sandbox.plannerToggleICSuggestionGroup('strongOther', false);
  html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  assert.ok(!html.includes('data-ic-id="ic_so"'), 'toggling it again should re-collapse it');
});

test('a group with zero matching results is omitted entirely, not shown with a "(0)" count', () => {
  resetState();
  resetClassSettings();
  setFourBucketFixture();
  const st = getState();
  // Drop the other+linked IC entirely, so that bucket is empty.
  st.instructionalComponents = st.instructionalComponents.filter(ic => ic.id !== 'ic_ol');
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['CD_SL', 'CD_OL'] };

  sandbox.plannerSuggestICsFromIntention();
  const html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  assert.ok(!html.includes('Other matches - this unit'), 'an empty group must not render at all, not even collapsed');
  assert.ok(html.includes('Strong matches - this unit') && html.includes('Strong matches - other CDs') && html.includes('Other matches - other CDs'), 'the three non-empty groups should still render');
});

test('standalone lessons (and unit lessons with no linkedCDIds) collapse to two groups — Strong open, Other collapsed', () => {
  resetState();
  resetClassSettings();
  setUnitCDBoostFixture(); // 'AC9M_HIGH' (strong) + 'AC9M_UNITCD' (weaker, still >0)
  // unit_1.linkedCDIds stays [] (resetState()'s default) — no linked distinction to make.

  sandbox.plannerSuggestICsFromIntention();
  const html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  assert.ok(!html.includes("this unit") && !html.includes('other CDs'), 'with no linkedCDIds set, headings must not mention a unit-CD distinction at all');
  assert.ok(html.includes('Strong matches (1)'), 'the strong group should render as a plain "Strong matches" heading');
  assert.ok(html.includes('data-ic-id="ic_high"'), 'the Strong group is open by default');
  assert.ok(!html.includes('data-ic-id="ic_unitcd"'), 'the Other group starts collapsed');
});

test('"+ Create new IC" stays pinned below all suggestion groups, open or collapsed', () => {
  resetState();
  resetClassSettings();
  setFourBucketFixture();
  const st = getState();
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['CD_SL', 'CD_OL'] };
  sandbox.plannerSuggestICsFromIntention();
  sandbox.plannerToggleICSuggestionGroup('otherOther', false); // open the very last group too

  const html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  const createPos = html.indexOf('planner-ic-create');
  const lastGroupPos = html.lastIndexOf('planner-ic-suggestion-group-heading');
  assert.ok(createPos > lastGroupPos, 'the Create new IC action must render after every group, regardless of which groups are open');
});

test('group open/collapsed state resets to defaults on a fresh plannerSuggestICsFromIntention() run', () => {
  resetState();
  resetClassSettings();
  setFourBucketFixture();
  const st = getState();
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['CD_SL', 'CD_OL'] };
  sandbox.plannerSuggestICsFromIntention();

  sandbox.plannerToggleICSuggestionGroup('strongOther', false); // manually open a normally-collapsed group
  assert.ok(sandbox.plannerICResultsHtml(lessonById('ul_1')).includes('data-ic-id="ic_so"'), 'sanity: the manual toggle should have opened it');

  sandbox.plannerSuggestICsFromIntention(); // a fresh suggestion run
  const html = sandbox.plannerICResultsHtml(lessonById('ul_1'));
  assert.ok(!html.includes('data-ic-id="ic_so"'), 'a fresh suggestion run must reset group state back to defaults, not carry over a previous manual toggle');
});

test('toggling a suggestion group restores focus to its heading, so a keyboard user isn\'t dropped out of the results list on every expand/collapse', () => {
  resetState();
  resetClassSettings();
  setFourBucketFixture();
  const st = getState();
  const unitIdx = st.unitPlans.findIndex(u => u.id === 'unit_1');
  st.unitPlans[unitIdx] = { ...st.unitPlans[unitIdx], linkedCDIds: ['CD_SL', 'CD_OL'] };
  sandbox.plannerSuggestICsFromIntention();

  // The stub results container's querySelector always returns null (no real DOM tree)
  // — stand in for the heading button plannerToggleICSuggestionGroup would re-focus in
  // a real browser, same convention used for the Drive sync indicator stub elsewhere.
  const container = documentStub.getElementById('planner-ic-results');
  const fakeHeading = { focused: false, focus() { this.focused = true; } };
  const realQuerySelector = container.querySelector;
  container.querySelector = (selector) => selector === '[data-group-key="strongOther"]' ? fakeHeading : realQuerySelector(selector);

  sandbox.plannerToggleICSuggestionGroup('strongOther', false);

  assert.ok(fakeHeading.focused, 'the toggled group\'s heading should be re-focused after the results container rebuild, same as plannerToggleICExpand already does for IC rows');
  container.querySelector = realQuerySelector;
});

// ── Lesson Resource Links ────────────────────────────────────────────────────────
console.log('Lesson resource links');

test('normalizeLessonPlan defaults resourceLinks to [] and drops entries with no url', () => {
  const normalized = sandbox.normalizeLessonPlan({
    id: 'rl_1',
    resourceLinks: [
      { label: 'Video', url: 'https://example.com/video' },
      { label: 'Bad — no url' },
      { label: 'Blank url', url: '   ' },
      null,
      'not an object',
    ],
  });
  eqJson(normalized.resourceLinks, [{ label: 'Video', url: 'https://example.com/video' }]);

  const withNone = sandbox.normalizeLessonPlan({ id: 'rl_2' });
  eqJson(withNone.resourceLinks, [], 'a lesson with no resourceLinks field at all should default to []');
});

test('normalizeLessonPlan trims the url and defaults a missing label to \'\', rebuilding a fresh object', () => {
  const source = { label: undefined, url: '  https://example.com/worksheet.pdf  ' };
  const normalized = sandbox.normalizeLessonPlan({ id: 'rl_3', resourceLinks: [source] });
  assert.strictEqual(normalized.resourceLinks[0].label, '');
  assert.strictEqual(normalized.resourceLinks[0].url, 'https://example.com/worksheet.pdf');
  assert.notStrictEqual(normalized.resourceLinks[0], source, 'normalize must rebuild a fresh object, not reuse the source reference');
});

test('normalizeLessonPlan rejects javascript:/data: (and other non-http(s)) schemes, so a hand-edited or synced-in link can never render as an executable href', () => {
  const normalized = sandbox.normalizeLessonPlan({
    id: 'rl_4',
    resourceLinks: [
      { label: 'Safe', url: 'https://example.com/ok' },
      { label: 'XSS', url: 'javascript:alert(document.cookie)' },
      { label: 'Data URI', url: 'data:text/html,<script>alert(1)</script>' },
      { label: 'Weird scheme', url: 'vbscript:msgbox(1)' },
    ],
  });
  eqJson(normalized.resourceLinks, [{ label: 'Safe', url: 'https://example.com/ok' }], 'only the safe http(s) link should survive normalization');
});

test('normalizeLessonPlan treats a scheme-less url as https:// for convenience', () => {
  const normalized = sandbox.normalizeLessonPlan({ id: 'rl_5', resourceLinks: [{ label: 'Bare domain', url: 'example.com/worksheet' }] });
  assert.strictEqual(normalized.resourceLinks[0].url, 'https://example.com/worksheet');
});

test('normalizeLessonPlan rejects a schemed url with no host (nothing to actually point at)', () => {
  const normalized = sandbox.normalizeLessonPlan({
    id: 'rl_6',
    resourceLinks: [
      { label: 'Bare scheme', url: 'https://' },
      { label: 'No host before query', url: 'http://?x' },
    ],
  });
  eqJson(normalized.resourceLinks, [], 'a url with a scheme but no host must not be persisted as a usable link');
});

test('normalizeLessonPlan treats a scheme-less host:port url as https://, not as an unrecognised scheme', () => {
  const normalized = sandbox.normalizeLessonPlan({ id: 'rl_7', resourceLinks: [{ label: 'Port', url: 'example.com:8080/worksheet' }] });
  assert.strictEqual(normalized.resourceLinks[0].url, 'https://example.com:8080/worksheet', 'the "example.com" before the colon must not be mistaken for a URI scheme');
});

test('plannerAddResourceLink() rejects a javascript: url with an error toast instead of saving an executable link', () => {
  resetState();
  const st = getState();
  st.plannerUi.selectedLessonId = 'sa_1';
  documentStub.getElementById('planner-resource-label').value = 'Malicious';
  documentStub.getElementById('planner-resource-url').value = 'javascript:alert(document.cookie)';

  sandbox.plannerAddResourceLink();

  eqJson(lessonById('sa_1').resourceLinks, [], 'a javascript: url must never be saved');
  assert.ok(toasts.some(t => t.type === 'error'), 'an error toast should explain why nothing was added');
});

test('plannerAddResourceLink() auto-prefixes a scheme-less url the teacher typed with https://', () => {
  resetState();
  const st = getState();
  st.plannerUi.selectedLessonId = 'sa_1';
  documentStub.getElementById('planner-resource-label').value = 'Bare domain';
  documentStub.getElementById('planner-resource-url').value = 'example.com/worksheet';

  sandbox.plannerAddResourceLink();

  eqJson(lessonById('sa_1').resourceLinks, [{ label: 'Bare domain', url: 'https://example.com/worksheet' }]);
});

test('plannerAddResourceLink() appends a link read from the drawer inputs and persists it', () => {
  resetState();
  const st = getState();
  st.plannerUi.selectedLessonId = 'sa_1';
  documentStub.getElementById('planner-resource-label').value = 'Slides';
  documentStub.getElementById('planner-resource-url').value = 'https://example.com/slides';

  sandbox.plannerAddResourceLink();

  const lesson = lessonById('sa_1');
  eqJson(lesson.resourceLinks, [{ label: 'Slides', url: 'https://example.com/slides' }]);
  const saved = JSON.parse(localStorageStub.getItem('ct_planner_lessons_v2'));
  eqJson(saved.find(l => l.id === 'sa_1').resourceLinks, [{ label: 'Slides', url: 'https://example.com/slides' }], 'the link should be persisted');
});

test('plannerAddResourceLink() rejects a blank url rather than silently saving it', () => {
  resetState();
  const st = getState();
  st.plannerUi.selectedLessonId = 'sa_1';
  documentStub.getElementById('planner-resource-label').value = 'No URL';
  documentStub.getElementById('planner-resource-url').value = '   ';

  sandbox.plannerAddResourceLink();

  eqJson(lessonById('sa_1').resourceLinks, [], 'a blank url must not be saved');
  assert.ok(toasts.some(t => t.type === 'error'), 'an error toast should explain why nothing was added');
});

test('plannerAddResourceLink() supports adding multiple links (no cap)', () => {
  resetState();
  const st = getState();
  st.plannerUi.selectedLessonId = 'sa_1';
  ['a', 'b', 'c', 'd'].forEach(letter => {
    documentStub.getElementById('planner-resource-label').value = `Link ${letter}`;
    documentStub.getElementById('planner-resource-url').value = `https://example.com/${letter}`;
    sandbox.plannerAddResourceLink();
  });
  assert.strictEqual(lessonById('sa_1').resourceLinks.length, 4, 'there should be no hard cap on the number of links');
});

test('plannerRemoveResourceLink() removes only the targeted link by index', () => {
  resetState();
  const idx = getState().lessonPlans.findIndex(l => l.id === 'sa_1');
  getState().lessonPlans[idx] = {
    ...getState().lessonPlans[idx],
    resourceLinks: [
      { label: 'First', url: 'https://example.com/1' },
      { label: 'Second', url: 'https://example.com/2' },
      { label: 'Third', url: 'https://example.com/3' },
    ],
  };
  getState().plannerUi.selectedLessonId = 'sa_1';

  sandbox.plannerRemoveResourceLink(1);

  eqJson(lessonById('sa_1').resourceLinks, [
    { label: 'First', url: 'https://example.com/1' },
    { label: 'Third', url: 'https://example.com/3' },
  ]);
});

test('plannerResourceLinksHtml renders links as anchors with a remove control, and an empty-state message when none', () => {
  resetState();
  const withLinks = sandbox.normalizeLessonPlan({ id: 'x', resourceLinks: [{ label: 'Worksheet', url: 'https://example.com/w' }] });
  const html = sandbox.plannerResourceLinksHtml(withLinks);
  assert.ok(html.includes('Resource Links'));
  assert.ok(/<a href="https:\/\/example\.com\/w"[^>]*>Worksheet<\/a>/.test(html));
  assert.ok(html.includes('plannerRemoveResourceLink(0)'));

  const empty = sandbox.normalizeLessonPlan({ id: 'y' });
  const emptyHtml = sandbox.plannerResourceLinksHtml(empty);
  assert.ok(emptyHtml.includes('No resource links yet.'));
});

test('the Lesson Drawer renders the Resource Links section for both standalone and unit lessons, positioned near the top (before Learning intention/ICs, not buried at the bottom)', () => {
  resetState();
  const standaloneHtml = sandbox.plannerStandaloneLessonEditHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }]);
  assert.ok(standaloneHtml.includes('Resource Links'), 'standalone lesson drawer should include the section');
  assert.ok(
    standaloneHtml.indexOf('>Day<') < standaloneHtml.indexOf('Resource Links')
    && standaloneHtml.indexOf('Resource Links') < standaloneHtml.indexOf('Learning intention'),
    'Resource Links should render right after Title/Subject/Day, before Learning intention and ICs — not at the bottom of the drawer'
  );

  const unitFieldsHtml = sandbox.plannerUnitLessonFieldsHtml(lessonById('ul_1'));
  assert.ok(unitFieldsHtml.includes('Resource Links'), 'unit lesson fields (shared by both unit drawers) should include the section');
  assert.ok(
    unitFieldsHtml.indexOf('Teaching status') < unitFieldsHtml.indexOf('Resource Links')
    && unitFieldsHtml.indexOf('Resource Links') < unitFieldsHtml.indexOf('Learning intention'),
    'Resource Links should render right after Title/Subject/Teaching status, before Learning intention and ICs — not at the bottom of the drawer'
  );
});

test('unitDuplicateLesson copies resourceLinks with a fresh, decoupled array', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  const source = [{ label: 'Video', url: 'https://example.com/video' }];
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], resourceLinks: source };

  sandbox.unitDuplicateLesson('unit_1', 'ul_1');
  const unit = getState().unitPlans.find(u => u.id === 'unit_1');
  const copy = lessonById(unit.lessonIds[1]);

  eqJson(copy.resourceLinks, [{ label: 'Video', url: 'https://example.com/video' }]);
  assert.notStrictEqual(copy.resourceLinks, source, 'the copy must not share the source array reference');
  assert.notStrictEqual(copy.resourceLinks[0], source[0], 'the copy must not share the source link object reference');
});

test('unitDuplicate (whole-unit) copies each lesson\'s resourceLinks too, inherited via buildDuplicateLessonForUnit', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_2');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], resourceLinks: [{ label: 'Slides', url: 'https://example.com/slides' }] };

  sandbox.unitDuplicate('unit_1');
  const copyUnit = getState().unitPlans.find(u => u.id !== 'unit_1');
  const copyLessons = sandbox.unitGetLessons(copyUnit);
  const copiedSecond = copyLessons[1];

  eqJson(copiedSecond.resourceLinks, [{ label: 'Slides', url: 'https://example.com/slides' }]);
});

test('plannerDuplicateLesson (standalone) copies resourceLinks with a fresh, decoupled array', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  const source = [{ label: 'Reading', url: 'https://example.com/reading' }];
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], resourceLinks: source };

  sandbox.plannerDuplicateLesson('sa_1');
  const copy = getState().lessonPlans.find(l => l.id !== 'sa_1' && l.title === st.lessonPlans[idx].title);

  eqJson(copy.resourceLinks, [{ label: 'Reading', url: 'https://example.com/reading' }]);
  assert.notStrictEqual(copy.resourceLinks, source, 'the copy must not share the source array reference');
  assert.notStrictEqual(copy.resourceLinks[0], source[0], 'the copy must not share the source link object reference');
});

console.log('Lesson card quick-access resource link indicator');

test('the resource indicator renders nothing when a lesson has no resourceLinks, on all three card types', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  assert.ok(!sandbox.plannerLessonCardHtml(lessonById('sa_1')).includes('planner-resource-indicator'), 'standalone card should render no indicator');
  assert.ok(!sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon').includes('planner-resource-indicator'), 'unit occurrence card should render no indicator');
  assert.ok(!sandbox.plannerUnitSidebarLessonHtml(lessonById('ul_1')).includes('planner-resource-indicator'), 'unit sidebar pill should render no indicator');
});

test('a single resource link renders the indicator, and clicking it opens the link directly via window.open instead of showing a popover', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], resourceLinks: [{ label: 'Slides', url: 'https://example.com/slides' }] };

  const html = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  assert.ok(html.includes('planner-resource-indicator'), 'the indicator should render');
  assert.ok(!html.includes('planner-resource-popover'), 'the popover should not be open yet');

  sandbox.plannerHandleResourceIndicatorClick('sa_1');
  eqJson(windowOpenCalls, [{ url: 'https://example.com/slides', target: '_blank', features: 'noopener,noreferrer' }]);
  assert.strictEqual(st.plannerUi.openResourcePopoverCardKey, null, 'a single link must not toggle the popover open');
});

test('multiple resource links show a count badge, and clicking the indicator opens a popover listing every link instead of guessing which to open', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = {
    ...st.lessonPlans[idx],
    resourceLinks: [
      { label: 'Slides', url: 'https://example.com/slides' },
      { label: 'Worksheet', url: 'https://example.com/worksheet' },
    ],
  };

  const closedHtml = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  assert.ok(/planner-resource-indicator-count[^>]*>2</.test(closedHtml), 'the indicator should show a count of 2');
  assert.ok(!closedHtml.includes('planner-resource-popover'), 'the popover should not render until opened');

  sandbox.plannerHandleResourceIndicatorClick('sa_1', 'sa_1::card');
  assert.strictEqual(windowOpenCalls.length, 0, 'multiple links must never guess and call window.open directly');
  assert.strictEqual(st.plannerUi.openResourcePopoverCardKey, 'sa_1::card', 'clicking with multiple links should open this card\'s popover');

  const openHtml = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  assert.ok(/<a class="planner-resource-popover-link" href="https:\/\/example\.com\/slides"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>Slides<\/a>/.test(openHtml), 'the popover should list the first link with its label');
  assert.ok(/<a class="planner-resource-popover-link" href="https:\/\/example\.com\/worksheet"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>Worksheet<\/a>/.test(openHtml), 'the popover should list the second link with its label');

  sandbox.plannerHandleResourceIndicatorClick('sa_1', 'sa_1::card');
  assert.strictEqual(st.plannerUi.openResourcePopoverCardKey, null, 'clicking the indicator again should toggle the popover closed');
});

test('only one lesson\'s resource popover can be open at a time', () => {
  resetState();
  const st = getState();
  const links = [{ label: 'A', url: 'https://example.com/a' }, { label: 'B', url: 'https://example.com/b' }];
  const saIdx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  const ulIdx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[saIdx] = { ...st.lessonPlans[saIdx], resourceLinks: links };
  st.lessonPlans[ulIdx] = { ...st.lessonPlans[ulIdx], resourceLinks: links };

  sandbox.plannerToggleResourcePopover('sa_1');
  assert.strictEqual(st.plannerUi.openResourcePopoverCardKey, 'sa_1');
  sandbox.plannerToggleResourcePopover('ul_1');
  assert.strictEqual(st.plannerUi.openResourcePopoverCardKey, 'ul_1', 'opening a second lesson\'s popover must close the first');
});

test('the resource indicator stops click and keydown propagation, on all three card types, so it never also opens the Lesson Drawer', () => {
  resetState();
  const st = getState();
  const link = [{ label: 'Slides', url: 'https://example.com/slides' }];
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  const saIdx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  const ulIdx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[saIdx] = { ...st.lessonPlans[saIdx], resourceLinks: link };
  st.lessonPlans[ulIdx] = { ...st.lessonPlans[ulIdx], resourceLinks: link };

  const stopPatternClick = /planner-resource-indicator[\s\S]*?onclick="event\.stopPropagation\(\);plannerHandleResourceIndicatorClick/;
  const stopPatternKeydown = /planner-resource-indicator[\s\S]*?onkeydown="event\.stopPropagation\(\)"/;

  const standaloneHtml = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  assert.ok(stopPatternClick.test(standaloneHtml), 'standalone card indicator must stop click propagation before opening the link');
  assert.ok(stopPatternKeydown.test(standaloneHtml), 'standalone card indicator must stop keydown propagation too');

  const occHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  assert.ok(stopPatternClick.test(occHtml), 'unit occurrence card indicator must stop click propagation');
  assert.ok(stopPatternKeydown.test(occHtml), 'unit occurrence card indicator must stop keydown propagation');

  const pillHtml = sandbox.plannerUnitSidebarLessonHtml(lessonById('ul_1'));
  assert.ok(stopPatternClick.test(pillHtml), 'unit sidebar pill indicator must stop click propagation');
  assert.ok(stopPatternKeydown.test(pillHtml), 'unit sidebar pill indicator must stop keydown propagation');
});

test('the open popover itself stops click and keydown propagation, so interacting with a listed link does not also close it, bubble into the card, or get hijacked by the card\'s Enter/Space handler', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = {
    ...st.lessonPlans[idx],
    resourceLinks: [{ label: 'A', url: 'https://example.com/a' }, { label: 'B', url: 'https://example.com/b' }],
  };
  st.plannerUi.openResourcePopoverCardKey = 'sa_1::card';
  const html = sandbox.plannerLessonCardHtml(lessonById('sa_1'));
  assert.ok(html.includes('<div class="planner-resource-popover" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()">'), 'the popover wrapper must stop both click and keydown propagation — without the latter, pressing Enter on a focused link bubbles into the card\'s own onkeydown and opens the Lesson Drawer instead of following the link');
});

test('plannerCloseResourcePopover() clears whichever lesson\'s popover is open, and is a no-op when none is open', () => {
  resetState();
  const st = getState();
  st.plannerUi.openResourcePopoverCardKey = 'sa_1';
  sandbox.plannerCloseResourcePopover();
  assert.strictEqual(st.plannerUi.openResourcePopoverCardKey, null);
  assert.doesNotThrow(() => sandbox.plannerCloseResourcePopover(), 'closing again with nothing open must not throw');
});

test('the full render pipeline does not throw with a resource popover open on a scheduled unit lesson', () => {
  resetState();
  const st = getState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = {
    ...st.lessonPlans[idx],
    resourceLinks: [{ label: 'A', url: 'https://example.com/a' }, { label: 'B', url: 'https://example.com/b' }],
  };
  st.plannerUi.openResourcePopoverCardKey = 'ul_1::' + WEEK_A + '::mon';
  assert.doesNotThrow(() => realRenderView());
});

test('opening the popover on one occurrence of a multi-slot unit lesson does not also open it on that lesson\'s other occurrence or its sidebar pill', () => {
  // Regression test: a unit lesson scheduled on two different days renders two separate
  // occurrence cards for the same lesson.id (plus one sidebar pill) at once. The open-popover
  // state must be keyed by the specific card clicked, not just the lesson id, or clicking one
  // copy's indicator would pop the popover open on every other rendered copy of the same lesson.
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = {
    ...st.lessonPlans[idx],
    resourceLinks: [{ label: 'A', url: 'https://example.com/a' }, { label: 'B', url: 'https://example.com/b' }],
  };
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');

  // Click the Monday occurrence's indicator (the literal card-key it renders with).
  sandbox.plannerHandleResourceIndicatorClick('ul_1', 'ul_1::' + WEEK_A + '::mon');

  const monHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  const wedHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'wed');
  const pillHtml = sandbox.plannerUnitSidebarLessonHtml(lessonById('ul_1'));

  assert.ok(monHtml.includes('planner-resource-popover'), 'the clicked Monday occurrence should show its popover');
  assert.ok(!wedHtml.includes('planner-resource-popover'), 'the Wednesday occurrence of the same lesson must not also show a popover');
  assert.ok(!pillHtml.includes('planner-resource-popover'), 'the sidebar pill for the same lesson must not also show a popover');
});

test('duplicating a lesson or unit does not carry over an open resource popover reference (sanity: popover state is keyed by id, and stale ids just render nothing)', () => {
  resetState();
  const st = getState();
  st.plannerUi.openResourcePopoverCardKey = 'not-a-real-lesson-id';
  assert.doesNotThrow(() => sandbox.plannerLessonCardHtml(lessonById('sa_1')));
  assert.ok(!sandbox.plannerLessonCardHtml(lessonById('sa_1')).includes('planner-resource-popover'), 'a stale/foreign open id must not force this lesson\'s popover open');
});

// ── Lesson Drawer view-only mode ─────────────────────────────────────────────────
console.log('Lesson Drawer view-only mode');

test('plannerLessonHasContent: a freshly created lesson has nothing to view yet; any single real field flips it to true', () => {
  resetState();
  const blank = sandbox.normalizeLessonPlan({ id: 'x', title: 'New Lesson', subject: '', intention: '', linkedICIds: [], resourceLinks: [] });
  assert.strictEqual(sandbox.plannerLessonHasContent(blank), false, 'a lesson with only the default title and nothing else has nothing to view');

  assert.strictEqual(sandbox.plannerLessonHasContent(sandbox.normalizeLessonPlan({ id: 'x', title: 'New Lesson', subject: 'Mathematics' })), true, 'a subject alone counts as content');
  assert.strictEqual(sandbox.plannerLessonHasContent(sandbox.normalizeLessonPlan({ id: 'x', title: 'New Lesson', intention: 'Add two-digit numbers.' })), true, 'an intention alone counts as content');
  assert.strictEqual(sandbox.plannerLessonHasContent(sandbox.normalizeLessonPlan({ id: 'x', title: 'New Lesson', linkedICIds: ['ic_1'] })), true, 'a linked IC alone counts as content');
  assert.strictEqual(sandbox.plannerLessonHasContent(sandbox.normalizeLessonPlan({ id: 'x', title: 'New Lesson', resourceLinks: [{ label: '', url: 'https://example.com' }] })), true, 'a resource link alone counts as content');
  assert.strictEqual(sandbox.plannerLessonHasContent(sandbox.normalizeLessonPlan({ id: 'x', title: 'Real title' })), true, 'a real (non-default) title alone counts as content');
});

test('opening an existing lesson with content defaults the drawer to view mode', () => {
  resetState();
  // ul_1 and sa_1 both carry real content from the fixture (title + subject).
  sandbox.plannerOpenLessonDrawer('ul_1');
  assert.strictEqual(getState().plannerUi.drawerMode, 'view', 'a unit lesson with content should default to view mode');

  sandbox.plannerOpenLessonDrawerFromCard('sa_1');
  assert.strictEqual(getState().plannerUi.drawerMode, 'view', 'a standalone lesson with content should default to view mode, via the card-click path too');
});

test('plannerAddLesson() opens its brand-new lesson directly in edit mode, since there is nothing to view yet', () => {
  resetState();
  sandbox.plannerAddLesson();
  assert.strictEqual(getState().plannerUi.drawerMode, 'edit', 'a freshly created standalone lesson has no content, so it should skip view mode entirely');
});

test('unitAddLesson() opens its brand-new lesson directly in edit mode, even though it inherits the unit\'s subject', () => {
  // unitAddLesson stamps the new lesson with unit.subject (Mathematics in the fixture),
  // so a generic "has any field set" check would wrongly call this lesson "has content"
  // and default it to view mode — it must not, since title/intention/ICs are all still
  // blank. This is forced explicitly rather than routed through plannerLessonHasContent.
  resetState();
  const st = getState();
  assert.ok(st.unitPlans[0].subject, 'sanity: the fixture unit has a subject set');
  sandbox.unitAddLesson('unit_1');
  assert.strictEqual(getState().plannerUi.drawerMode, 'edit', 'a freshly created unit lesson should open in edit mode regardless of the subject it inherited');
});

test('view mode renders a standalone lesson\'s fields as plain text/badges, with no inputs, search box, or Suggest control', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = {
    ...st.lessonPlans[idx], title: 'Spelling test', subject: 'English', dayKey: 'wed',
    intention: 'Weekly spelling check.', resourceLinks: [{ label: 'Word list', url: 'https://example.com/words' }],
  };
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');
  assert.strictEqual(getState().plannerUi.drawerMode, 'view', 'sanity: this content-bearing lesson should default to view mode');

  const html = sandbox.plannerDrawerHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }, { key: 'wed', label: 'Wednesday' }]);
  assert.ok(html.includes('Spelling test'), 'title should show as text');
  assert.ok(html.includes('English'), 'subject should show as text');
  assert.ok(html.includes('Wednesday'), 'day should show as text, resolved to its label');
  assert.ok(html.includes('Weekly spelling check.'), 'learning intention should show as text');
  assert.ok(/<a[^>]*href="https:\/\/example\.com\/words"[^>]*>Word list<\/a>/.test(html), 'resource link should render as a plain clickable anchor');
  assert.ok(!html.includes('plannerRemoveResourceLink'), 'view mode must not offer a remove control on resource links');
  assert.ok(!html.includes('plannerAddResourceLink'), 'view mode must not offer an add-link control');
  assert.ok(!html.includes('<input'), 'view mode must render no text inputs at all');
  assert.ok(!html.includes('<select'), 'view mode must render no dropdowns at all');
  assert.ok(!html.includes('<textarea'), 'view mode must render no textareas at all');
  assert.ok(!html.includes('planner-ic-search'), 'the IC search box must not render in view mode');
  assert.ok(!html.includes('Suggest from intention'), 'the Suggest control must not render in view mode');
  assert.ok(!html.includes('Mark as taught') && !html.includes('Mark as planned'), 'the status-toggle button must not render in view mode — status is a badge only');
  assert.ok(html.includes('>Edit<'), 'an Edit button should be present to switch into the full editable form');
});

test('view mode shows a linked IC compactly — name + code only, no description/example/common error', () => {
  resetState();
  const st = getState();
  st.instructionalComponents = [{
    id: 'ic_1', homeDescriptorId: 'AC9M2N01', linkedDescriptorIds: [],
    name: 'Reads a numeral beyond 10 000', description: 'A description that must not appear in view mode.',
    exampleOfSuccess: 'An example that must not appear in view mode.', commonError: 'An error note that must not appear in view mode.',
    isArchived: false, ownerTier: 'system_default', suppressedByTeacher: false,
  }];
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], linkedICIds: ['ic_1'] };
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');

  const html = sandbox.plannerDrawerHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }]);
  assert.ok(html.includes('Reads a numeral beyond 10 000'), 'the IC name should show');
  assert.ok(html.includes('AC9M2N01'), 'the IC\'s home descriptor code should show');
  assert.ok(!html.includes('A description that must not appear in view mode.'), 'description must not render in the compact view row');
  assert.ok(!html.includes('An example that must not appear in view mode.'), 'example of success must not render in the compact view row');
  assert.ok(!html.includes('An error note that must not appear in view mode.'), 'common error must not render in the compact view row');
  assert.ok(!html.includes('planner-ic-remove'), 'view mode must not offer a remove control on linked ICs');
});

test('a linked IC\'s confidence tier shows in the view-mode row only when live suggestion data exists for it, and is silently omitted otherwise', () => {
  resetState();
  const st = getState();
  st.instructionalComponents = [{
    id: 'ic_1', homeDescriptorId: 'AC9M2N01', linkedDescriptorIds: [],
    name: 'Reads a numeral beyond 10 000', description: '', isArchived: false, ownerTier: 'system_default', suppressedByTeacher: false,
  }];
  const idx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], linkedICIds: ['ic_1'] };
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');

  // No live suggestionScores data for this IC (a fresh drawer open resets suggestedICIds,
  // and this lesson was never scored) — no confidence tier should render at all.
  let html = sandbox.plannerDrawerHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }]);
  assert.ok(!html.includes('planner-ic-confidence'), 'no confidence badge should render when there is no live suggestion score for this IC');

  // Now simulate a live score for this exact IC, computed for this exact lesson (as if
  // it had just been suggested) — both suggestionScores AND suggestionLessonId must
  // agree with the rendered lesson for the badge to show at all.
  getState().plannerUi.suggestionScores = { ic_1: 5 };
  getState().plannerUi.suggestionLessonId = 'sa_1';
  html = sandbox.plannerDrawerHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }]);
  assert.ok(html.includes('planner-ic-confidence'), 'a confidence badge should render once live suggestion data exists for this lesson');
});

test('opening a different lesson that happens to link the same IC does not inherit the previous lesson\'s stale confidence tier', () => {
  // Suggestion scores are keyed only by IC id, with no per-lesson scoping — if two
  // lessons both link the same IC, a score computed for lesson A's intention must not
  // leak into lesson B's view-mode summary as if it meant something for lesson B too.
  resetState();
  const st = getState();
  st.instructionalComponents = [{
    id: 'ic_shared', homeDescriptorId: 'AC9M2N01', linkedDescriptorIds: [],
    name: 'Reads a numeral beyond 10 000', description: '', isArchived: false, ownerTier: 'system_default', suppressedByTeacher: false,
  }];
  const saIdx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[saIdx] = { ...st.lessonPlans[saIdx], linkedICIds: ['ic_shared'] };
  const ulIdx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[ulIdx] = { ...st.lessonPlans[ulIdx], linkedICIds: ['ic_shared'] };

  // Open lesson A (sa_1) and simulate a live "Suggest" score for the shared IC.
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');
  getState().plannerUi.suggestionScores = { ic_shared: 5 };
  getState().plannerUi.suggestionLessonId = 'sa_1';
  const saHtml = sandbox.plannerDrawerHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }]);
  assert.ok(saHtml.includes('planner-ic-confidence'), 'sanity: the shared IC shows a confidence tier while its score is live for this lesson');

  // Now open lesson B (ul_1), which links the same IC but was never scored itself.
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  const ulHtml = sandbox.plannerDrawerHtml(lessonById('ul_1'), []);
  assert.ok(!ulHtml.includes('planner-ic-confidence'), 'a different lesson opened afterward must not inherit the previous lesson\'s stale confidence tier for the same IC');
});

test('suggestedICIds/suggestionScores left stale by a hypothetical future call site that forgets to clear them still cannot leak into a different lesson\'s panel, because suggestionLessonId gates them', () => {
  // This is the actual architectural guarantee requested: correctness must not depend
  // on every present and future "switch to a different lesson" call site remembering
  // to explicitly clear suggestedICIds/suggestionScores. Simulate exactly that lapse —
  // change the selected lesson WITHOUT going through plannerOpenLessonDrawer/
  // plannerSwitchDrawerToEdit at all (bypassing every existing clear) — and confirm the
  // suggestionLessonId mismatch alone is still enough to suppress the stale data.
  resetState();
  const st = getState();
  st.instructionalComponents = [
    { id: 'ic_1', homeDescriptorId: 'AC9M2N01', linkedDescriptorIds: [], name: 'Reads a numeral beyond 10 000', description: 'Student can read a numeral beyond 10 000.', isArchived: false, ownerTier: 'system_default', suppressedByTeacher: false },
    { id: 'ic_2', homeDescriptorId: 'AC9M2N01', linkedDescriptorIds: [], name: 'Writes a numeral beyond 10 000', description: 'Student can write a numeral beyond 10 000.', isArchived: false, ownerTier: 'system_default', suppressedByTeacher: false },
  ];
  // No subject set, so the candidate pool isn't filtered by curriculum descriptor at
  // all (plannerICResultsHtml's subjectPool passes everything through when there's no
  // subject to match against) — keeps this test focused purely on the suggestion-state
  // guard, not curriculum-code fixture setup.
  const saIdx = st.lessonPlans.findIndex(l => l.id === 'sa_1');
  st.lessonPlans[saIdx] = { ...st.lessonPlans[saIdx], subject: '' };

  // Simulate stale suggestion state exactly as plannerSuggestICsFromIntention() would
  // leave it after running for a DIFFERENT, no-longer-selected lesson — but bypass every
  // reset function entirely, standing in for a future call site that forgot to clear.
  st.plannerUi.suggestedICIds = ['ic_1'];
  st.plannerUi.suggestionScores = { ic_1: 6 };
  st.plannerUi.suggestionLessonId = 'a_different_lesson_id_never_opened_here';
  st.plannerUi.selectedLessonId = 'sa_1';
  st.plannerUi.drawerOpen = true;
  st.plannerUi.drawerMode = 'edit';

  const html = sandbox.plannerDrawerHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }]);
  assert.ok(!html.includes('Strong matches') && !html.includes('Other matches'), 'the picker must show the plain browse list, not stale grouped suggestion results, despite suggestedICIds/suggestionScores never having been cleared for this lesson');
  assert.ok(html.includes('ic_2') || html.includes('Writes a numeral beyond 10 000'), 'the full candidate pool should render (ic_2 included), not just the stale suggested id (ic_1)');
});

test('a brand-new lesson from plannerAddLesson()/unitAddLesson() never shows a confidence badge left over from an earlier, unrelated lesson\'s Suggest run', () => {
  // plannerAddLesson/unitAddLesson reset suggestedICIds when creating a new lesson, but
  // (unlike plannerOpenLessonDrawer) do not also reset suggestionScores — that gap alone
  // used to be enough to leak a stale confidence badge into the new lesson's view-mode
  // IC summary once an IC got linked to it and the drawer was switched to view. The
  // suggestionLessonId guard closes this regardless, without needing that reset added.
  resetState();
  const st = getState();
  st.curriculumCodes = [{ Code: 'AC9M3N01', Subject: 'Mathematics', Strand: 'Number', 'Year Level': 'Year 3', Descriptor: 'some descriptor' }];
  st.instructionalComponents = [{
    id: 'ic_x', homeDescriptorId: 'AC9M3N01', linkedDescriptorIds: [],
    name: 'Some intention IC', description: '', isArchived: false, ownerTier: 'teacher_stub', suppressedByTeacher: false,
  }];

  // Run Suggest for an existing lesson first, leaving suggestionScores/suggestionLessonId
  // pointing at ic_x for that lesson (unrelated to the new lesson we're about to create).
  const ulIdx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[ulIdx] = { ...st.lessonPlans[ulIdx], subject: 'Mathematics', intention: 'Some intention text here.' };
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  sandbox.plannerSwitchDrawerToEdit();
  sandbox.plannerSuggestICsFromIntention();
  assert.ok(getState().plannerUi.suggestionScores.ic_x !== undefined, 'sanity: Suggest produced a score for ic_x against the existing lesson');

  // Now create a brand-new unit lesson and manually link the SAME IC to it (as if the
  // teacher added it via search, not Suggest), then view it.
  sandbox.unitAddLesson('unit_1');
  const newLessonId = getState().plannerUi.selectedLessonId;
  sandbox.plannerToggleLessonIC('ic_x');
  sandbox.plannerSwitchDrawerToView();

  const html = sandbox.plannerDrawerHtml(lessonById(newLessonId), []);
  assert.ok(!html.includes('planner-ic-confidence'), 'the brand-new lesson must not show a confidence badge computed for a different, unrelated lesson');
});

test('view mode renders a unit lesson\'s schedule as plain text, with no week/day picker, and no unit-context trailer', () => {
  resetState();
  const st = getState();
  st.unitPlans[0] = { ...st.unitPlans[0], linkedCDIds: ['AC9M3N01'], assessmentNotes: 'Exit ticket each fortnight.' };
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  assert.strictEqual(getState().plannerUi.drawerMode, 'view', 'sanity: this content-bearing unit lesson should default to view mode');

  const html = sandbox.plannerDrawerHtml(lessonById('ul_1'), []);
  assert.ok(html.includes('Intro to fractions'), 'title should show as text');
  assert.ok(html.includes(sandbox.plannerWeekRangeLabel(WEEK_A)), 'the scheduled week should show as text');
  assert.ok(!html.includes('unit-schedule-week') && !html.includes('unit-schedule-day'), 'the week/day picker selects must not render in view mode');
  assert.ok(!html.includes('Add to week'), 'the Add-to-week button must not render in view mode');
  assert.ok(!html.includes('<select'), 'view mode must render no dropdowns at all');
  // The unit-context trailer (linked CDs + assessment notes) is unit-editing content,
  // not part of viewing this lesson — Unit Plans' own separate side panel covers it.
  assert.ok(!html.includes('Unit:'), 'the unit-context trailer must not render in view mode');
  assert.ok(!html.includes('unit-cd-panel'), 'the linked-CD panel must not render in view mode');
  assert.ok(!html.includes('Exit ticket each fortnight.'), 'assessment notes must not render in view mode');
});

test('Unit Plans\' own lesson drawer (unitLessonDrawerHtml) respects the same view/edit mode as the Weekly Planner\'s', () => {
  resetState();
  const st = getState();
  const lidx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[lidx] = { ...st.lessonPlans[lidx], intention: 'Halve a shape into two equal parts.' };
  sandbox.plannerOpenLessonDrawer('ul_1'); // the actual Unit Plans lesson-row click path
  assert.strictEqual(getState().plannerUi.drawerMode, 'view');

  const viewHtml = sandbox.unitLessonDrawerHtml(lessonById('ul_1'));
  assert.ok(viewHtml.includes('Halve a shape into two equal parts.'), 'view mode should show the lesson\'s own intention as text');
  assert.ok(!viewHtml.includes('<textarea'), 'view mode must render no textareas');
  assert.ok(!viewHtml.includes('Add to week'), 'view mode must not offer the schedule picker');

  sandbox.plannerSwitchDrawerToEdit();
  const editHtml = sandbox.unitLessonDrawerHtml(lessonById('ul_1'));
  assert.ok(editHtml.includes('<textarea'), 'edit mode should still render the full editable field set, unchanged');
  assert.ok(editHtml.includes('Add to week'), 'edit mode should still offer the schedule picker, unchanged');
});

test('plannerSwitchDrawerToEdit()/plannerSwitchDrawerToView() toggle the drawer between modes without touching selectedLessonId or drawerOpen', () => {
  resetState();
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');
  const st = getState();
  assert.strictEqual(st.plannerUi.drawerMode, 'view');

  sandbox.plannerSwitchDrawerToEdit();
  assert.strictEqual(st.plannerUi.drawerMode, 'edit', 'Edit button should switch into edit mode');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'sa_1', 'the same lesson should stay selected');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'the drawer should stay open, not close and reopen');

  sandbox.plannerSwitchDrawerToView();
  assert.strictEqual(st.plannerUi.drawerMode, 'view', 'Done should switch back to view mode');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'sa_1', 'the same lesson should still stay selected');
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'the drawer should still stay open');
});

test('entering edit mode resets the IC search box and any leftover suggestion results from a previous edit session', () => {
  resetState();
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');
  sandbox.plannerSwitchDrawerToEdit();
  const st = getState();
  st.plannerUi.icSearch = 'a stale search';
  st.plannerUi.suggestedICIds = ['some_id'];
  st.plannerUi.expandedICId = 'some_id';

  sandbox.plannerSwitchDrawerToView();
  sandbox.plannerSwitchDrawerToEdit();
  assert.strictEqual(st.plannerUi.icSearch, '', 're-entering edit mode should clear a stale search box');
  eqJson(st.plannerUi.suggestedICIds, [], 're-entering edit mode should clear stale suggestion results');
  assert.strictEqual(st.plannerUi.expandedICId, null, 're-entering edit mode should collapse any expanded IC detail');
});

test('the full render pipeline does not throw with the drawer open in either view or edit mode', () => {
  resetState();
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');
  assert.doesNotThrow(() => realRenderView(), 'view mode should render without throwing');
  sandbox.plannerSwitchDrawerToEdit();
  assert.doesNotThrow(() => realRenderView(), 'edit mode should render without throwing');

  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  assert.doesNotThrow(() => realRenderView(), 'a unit lesson in view mode should render without throwing');
  sandbox.plannerSwitchDrawerToEdit();
  assert.doesNotThrow(() => realRenderView(), 'a unit lesson in edit mode should render without throwing');
});

// ── Per-occurrence taught tracking for multi-slot unit lessons ──────────────────
console.log('Per-occurrence taught tracking for multi-slot unit lessons');

test('normalizeLessonPlan preserves a well-formed taught:true slot and normalises anything else to absent', () => {
  const lesson = sandbox.normalizeLessonPlan({
    id: 'x', unitId: 'unit_1', scheduledSlots: [
      { weekKey: WEEK_A, dayKey: 'mon', taught: true },
      { weekKey: WEEK_A, dayKey: 'tue' }, // absent — the ordinary case
      { weekKey: WEEK_A, dayKey: 'wed', taught: 'true' }, // string, not boolean — malformed
      { weekKey: WEEK_A, dayKey: 'thu', taught: 1 }, // truthy but not boolean — malformed
    ],
  });
  eqJson(lesson.scheduledSlots, [
    { weekKey: WEEK_A, dayKey: 'mon', taught: true },
    { weekKey: WEEK_A, dayKey: 'tue' },
    { weekKey: WEEK_A, dayKey: 'wed' },
    { weekKey: WEEK_A, dayKey: 'thu' },
  ], 'only a literal boolean true survives as taught:true; anything else normalises to absent, not to false');
});

test('isValidScheduledSlot tolerates a slot with or without a taught field — it is optional, never required', () => {
  assert.strictEqual(sandbox.isValidScheduledSlot({ weekKey: WEEK_A, dayKey: 'mon' }), true, 'a slot with no taught field is still valid');
  assert.strictEqual(sandbox.isValidScheduledSlot({ weekKey: WEEK_A, dayKey: 'mon', taught: true }), true, 'a slot with taught:true is still valid');
});

test('plannerMoveScheduledSlot (drag to another day) preserves a taught occurrence\'s taught flag', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon', taught: true }] };
  sandbox.plannerMoveScheduledSlot('ul_1', WEEK_A, 'mon', WEEK_A, 'wed');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'wed', taught: true }], 'the moved slot must keep taught:true, not reset it just because it changed days');
});

test('plannerMoveScheduledSlot does not spuriously add a taught flag to a not-yet-taught occurrence', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerMoveScheduledSlot('ul_1', WEEK_A, 'mon', WEEK_A, 'wed');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'wed' }], 'a slot that was never taught must not gain a taught field just from moving');
});

test('unitToggleOccurrenceTaught on a 2-slot lesson sets only the toggled slot, leaving the other slot and lesson identity untouched', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon', taught: true }, { weekKey: WEEK_A, dayKey: 'wed' }], 'only the Monday slot should be marked taught; Wednesday must be untouched');
});

test('unitToggleOccurrenceTaught derives partially-taught, then taught, as occurrences are marked one by one', () => {
  resetState();
  const st = getState();
  st.lessonPlans[st.lessonPlans.findIndex(l => l.id === 'ul_1')].teachingStatus = 'planned';
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');

  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'partially-taught', '1 of 2 occurrences taught should auto-compute to partially-taught');

  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'wed');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'taught', '2 of 2 occurrences taught should auto-compute to taught');
});

test('unitToggleOccurrenceTaught is a toggle — un-marking a taught occurrence recomputes back down from taught to partially-taught', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'wed');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'taught', 'sanity: both marked, fully taught');

  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'wed'); // un-mark one of the two
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'partially-taught', 'un-marking one of two taught occurrences should recompute down to partially-taught');
  eqJson(lessonById('ul_1').scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon', taught: true }, { weekKey: WEEK_A, dayKey: 'wed' }]);
});

test('0 of N occurrences taught never overwrites the lesson\'s current teachingStatus — including the documented edge case of un-marking the last taught occurrence', () => {
  resetState();
  const st = getState();
  // ul_2 starts as 'reteach' in the fixture — a deliberate manual choice that must
  // survive scheduling slots with nothing marked taught yet.
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_A, 'wed');
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'scheduling slots with none taught yet must not disturb a manual "Reteach" choice');

  // Mark one, then un-mark it again — the ONLY occurrence ever marked taught is now
  // unmarked, so taughtCount is back to 0. Per spec this leaves teachingStatus exactly
  // as it currently reads (documented, accepted behaviour — not rolled back further).
  sandbox.unitToggleOccurrenceTaught('ul_2', WEEK_A, 'mon');
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'partially-taught', 'sanity: marking one of two occurrences auto-computes to partially-taught, overriding the manual Reteach choice');
  sandbox.unitToggleOccurrenceTaught('ul_2', WEEK_A, 'mon'); // un-mark the only taught occurrence
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'partially-taught', 'back to 0 of 2 taught leaves teachingStatus exactly as it currently is (partially-taught, stale) rather than resetting it — correctable via the manual dropdown like any other status change');
});

test('the board occurrence card\'s taught checkbox is always present, single- or multi-slot alike — only the drawer\'s own per-slot schedule-chip toggle stays gated to multi-slot lessons', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  const singleSlotHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  assert.ok(singleSlotHtml.includes('planner-occ-taught-checkbox'), 'a single-occurrence lesson\'s board card must still show the quick taught checkbox — that is the whole point of this feature');
  assert.ok(singleSlotHtml.includes('planner-occ-remove'), 'the ✕ remove control should still be there, unaffected');

  // The drawer's own per-slot schedule-chip toggle (a separate control, in a separate
  // function — unitLessonScheduleHtml) is explicitly out of scope for this feature and
  // must keep its existing multi-slot-only gate, untouched.
  const singleSlotScheduleHtml = sandbox.unitLessonScheduleHtml(lessonById('ul_1'));
  assert.ok(!singleSlotScheduleHtml.includes('planner-slot-taught-toggle'), 'the drawer\'s schedule chip for a single-occurrence lesson must not show its own toggle — unrelated to and unaffected by the board checkbox');

  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed'); // now a 2-slot lesson
  const multiSlotHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  assert.ok(multiSlotHtml.includes('planner-occ-taught-checkbox'), 'the board checkbox is present for a multi-slot lesson\'s occurrence card too');

  const multiSlotScheduleHtml = sandbox.unitLessonScheduleHtml(lessonById('ul_1'));
  assert.ok(multiSlotScheduleHtml.includes('planner-slot-taught-toggle'), 'the drawer\'s schedule chips should still show their own toggle once there is more than one, exactly as before');
});

// ── Week Board quick "mark as taught" checkbox ───────────────────────────────────
console.log('Week Board quick "mark as taught" checkbox');

test('checking a standalone lesson card\'s taught checkbox calls plannerSetLessonStatus with that card\'s own lesson id, without needing it selected in the drawer first', () => {
  resetState();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'sa_1').linkedICIds = ['ic1'];
  assert.strictEqual(st.plannerUi.selectedLessonId, null, 'sanity: nothing is selected/open in the drawer');

  sandbox.plannerSetLessonStatus('taught', 'sa_1');
  assert.strictEqual(lessonById('sa_1').status, 'taught', 'the lesson must be marked taught by explicit id, with no drawer selection involved');
  assert.strictEqual(st.plannerUi.selectedLessonId, null, 'marking taught via the checkbox must not also select/open the lesson in the drawer');

  sandbox.plannerSetLessonStatus('planned', 'sa_1');
  assert.strictEqual(lessonById('sa_1').status, 'planned', 'unchecking reverses it back to planned');
});

test('plannerSetLessonStatus with an explicit lessonId still enforces the existing "needs at least one IC" gate, and re-renders so a checkbox\'s already-flipped checked state resets', () => {
  resetState();
  const st = getState();
  assert.deepStrictEqual(lessonById('sa_1').linkedICIds, [], 'sanity: sa_1 starts with no linked ICs');

  sandbox.plannerSetLessonStatus('taught', 'sa_1');
  assert.strictEqual(lessonById('sa_1').status, 'planned', 'must be rejected — same gate as the drawer\'s own Mark as taught button, just reached via a different call site');
  assert.strictEqual(toasts[toasts.length - 1].msg, 'Add at least one IC before marking this lesson as taught', 'must show the exact same rejection toast the drawer button already shows');
});

test('the existing drawer call site (plannerSetLessonStatus with no lessonId) still targets the selected lesson, unaffected by the new optional parameter', () => {
  resetState();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'sa_1').linkedICIds = ['ic1'];
  st.plannerUi.selectedLessonId = 'sa_1';
  sandbox.plannerSetLessonStatus('taught');
  assert.strictEqual(lessonById('sa_1').status, 'taught', 'omitting lessonId must still fall back to the drawer\'s selectedLessonId, exactly as before this feature');
});

test('checking a single-occurrence unit lesson\'s board checkbox calls unitSetSingleOccurrenceTaught with that lesson\'s id — which itself uses unitSetLessonTeachingStatus (the same function the drawer dropdown uses for this case), not the per-occurrence toggle', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon'); // exactly one occurrence
  assert.strictEqual(lessonById('ul_1').scheduledSlots.length, 1, 'sanity: single-occurrence');

  sandbox.unitSetSingleOccurrenceTaught('ul_1', WEEK_A, 'mon', true);
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'taught', 'the lesson\'s overall teachingStatus must flip to taught by explicit id');
  assert.strictEqual(lessonById('ul_1').scheduledSlots[0].taught, true, 'the slot\'s own flag is reconciled to match teachingStatus too, so a later transition to multi-slot (or a stale-status edge case) never finds it out of sync');

  sandbox.unitSetSingleOccurrenceTaught('ul_1', WEEK_A, 'mon', false);
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'planned', 'unchecking reverses it back to planned');
  assert.strictEqual(lessonById('ul_1').scheduledSlots[0].taught, undefined, 'and the slot\'s own flag is reconciled back too');
});

test('the existing drawer call site (unitSetLessonTeachingStatus with no lessonId) still targets the selected lesson, unaffected by the new optional parameter', () => {
  resetState();
  const st = getState();
  st.plannerUi.selectedLessonId = 'ul_1';
  sandbox.unitSetLessonTeachingStatus('taught');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'taught', 'omitting lessonId must still fall back to the drawer\'s selectedLessonId, exactly as before this feature');
});

test('a single-occurrence unit lesson\'s board card reflects lesson.teachingStatus for its checkbox\'s checked state and is-taught styling when the slot itself was never individually flagged', () => {
  resetState();
  const st = getState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], teachingStatus: 'taught' };

  const html = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  assert.ok(/planner-occ-taught-checkbox"\s+checked/.test(html), 'the checkbox must render checked once teachingStatus is taught, even though the underlying slot itself was never individually flagged');
  assert.ok(/planner-lesson-card is-unit is-taught/.test(html), 'the card must also pick up the is-taught styling in this case — previously it only read the (here, never-set) per-slot flag and stayed unstyled despite the badge next to it saying Taught');
});

// ── Review fix: a lesson reduced to one slot must keep honoring that slot's own ────
// ── taught flag, even if plannerUnscheduleSlot left teachingStatus stale ───────────
test('a lesson reduced from multi- to single-slot keeps reading its surviving occurrence\'s own taught flag, even though plannerUnscheduleSlot deliberately leaves teachingStatus stale', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon'); // mark Monday taught; Wednesday stays untaught
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'partially-taught', 'sanity: 1 of 2 taught');

  sandbox.plannerUnscheduleSlot('ul_1', WEEK_A, 'wed'); // remove the untaught occurrence
  const lesson = lessonById('ul_1');
  assert.strictEqual(lesson.scheduledSlots.length, 1, 'sanity: down to one slot');
  assert.strictEqual(lesson.scheduledSlots[0].taught, true, 'sanity: the surviving Monday slot is still individually flagged taught');
  assert.strictEqual(lesson.teachingStatus, 'partially-taught', 'sanity: plannerUnscheduleSlot leaves teachingStatus untouched — now stale, per its own documented behaviour');

  const html = sandbox.plannerUnitOccurrenceCardHtml(lesson, WEEK_A, 'mon');
  assert.ok(/planner-occ-taught-checkbox"\s+checked/.test(html), 'the checkbox must still show checked, honoring the surviving slot\'s own taught flag rather than only the now-stale lesson-wide teachingStatus');
  assert.ok(/planner-lesson-card is-unit is-taught/.test(html), 'the card must still pick up is-taught styling for the same reason');

  // Now uncheck it — must clear BOTH signals, or the stale slot flag would keep making
  // it read as taught again on the very next render.
  sandbox.unitSetSingleOccurrenceTaught('ul_1', WEEK_A, 'mon', false);
  const afterUncheck = lessonById('ul_1');
  assert.strictEqual(afterUncheck.teachingStatus, 'planned', 'teachingStatus must be cleared');
  assert.strictEqual(afterUncheck.scheduledSlots[0].taught, undefined, 'the surviving slot\'s own stale taught flag must also be reconciled/cleared — otherwise it would keep reading as taught via the flag alone');
  const htmlAfterUncheck = sandbox.plannerUnitOccurrenceCardHtml(afterUncheck, WEEK_A, 'mon');
  assert.ok(!/planner-occ-taught-checkbox"\s+checked/.test(htmlAfterUncheck), 'the checkbox must render unchecked and stay that way on the next render, not snap back to checked from the leftover slot flag');
});

test('a multi-slot lesson\'s board checkbox still calls unitToggleOccurrenceTaught, targeting only that one occurrence — reusing the existing per-occurrence mechanism exactly, unmodified', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');

  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon');
  const lesson = lessonById('ul_1');
  const monSlot = lesson.scheduledSlots.find(s => s.dayKey === 'mon');
  const wedSlot = lesson.scheduledSlots.find(s => s.dayKey === 'wed');
  assert.strictEqual(monSlot.taught, true, 'only the targeted (Monday) occurrence is marked taught');
  assert.strictEqual(wedSlot.taught, undefined, 'the other (Wednesday) occurrence must be completely untouched');
  assert.strictEqual(lesson.teachingStatus, 'partially-taught', 'the lesson-wide status re-derives from the per-occurrence flags, exactly as this mechanism already did before this feature');

  const monHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'mon');
  const wedHtml = sandbox.plannerUnitOccurrenceCardHtml(lessonById('ul_1'), WEEK_A, 'wed');
  assert.ok(/planner-lesson-card is-unit is-taught/.test(monHtml), 'the taught occurrence\'s own card must show is-taught styling');
  assert.ok(!/planner-lesson-card is-unit is-taught/.test(wedHtml), 'the untaught occurrence\'s own card must not — the two occurrence cards of the same lesson can disagree');
});

test('the full render pipeline does not throw for any card/lesson combination touched by the new taught checkbox', () => {
  resetState();
  assert.doesNotThrow(() => realRenderView(), 'plain week board, nothing scheduled yet beyond the fixture');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  assert.doesNotThrow(() => realRenderView(), 'single-occurrence unit lesson card');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  assert.doesNotThrow(() => realRenderView(), 'multi-occurrence unit lesson card');
  sandbox.plannerSetLessonStatus('taught', 'sa_1');
  assert.doesNotThrow(() => realRenderView(), 'standalone lesson card, gate-rejected (sa_1 has no linked ICs) but must still render cleanly');
});

test('unitLessonDerivedTeachingStatus leaves a single- or zero-slot lesson\'s teachingStatus completely unchanged, regardless of that one slot\'s own taught flag', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], teachingStatus: 'needs-review', scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon', taught: true }] };
  assert.strictEqual(sandbox.unitLessonDerivedTeachingStatus(lessonById('ul_1')), 'needs-review', 'a single scheduled occurrence, even one marked taught, must not auto-derive a new status');

  st.lessonPlans[idx] = { ...st.lessonPlans[idx], scheduledSlots: [] };
  assert.strictEqual(sandbox.unitLessonDerivedTeachingStatus(lessonById('ul_1')), 'needs-review', 'a lesson with no scheduled slots at all must not auto-derive a new status either');
});

test('the manual "Teaching status" dropdown (unitSetLessonTeachingStatus) still directly overrides any auto-derived status, untouched by this feature', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'wed');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'taught', 'sanity: fully auto-derived taught');

  const st = getState();
  st.plannerUi.selectedLessonId = 'ul_1';
  sandbox.unitSetLessonTeachingStatus('needs-review');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'needs-review', 'the manual dropdown must still be able to directly override an auto-derived status');
});

test('unitLessonStatusBadgeHtml shows no fraction for a 0- or 1-slot lesson, and a taught/total fraction once there is more than one occurrence', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');

  // Check for an actual digit/digit fraction, not a bare "/" — every badge already
  // contains one as part of its own closing </span> tag.
  const hasFraction = html => /\d+\/\d+/.test(html);

  st.lessonPlans[idx] = { ...st.lessonPlans[idx], teachingStatus: 'planned', scheduledSlots: [] };
  assert.ok(!hasFraction(sandbox.unitLessonStatusBadgeHtml(lessonById('ul_1'))), 'a lesson with no scheduled slots should show no fraction');

  st.lessonPlans[idx] = { ...st.lessonPlans[idx], scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon' }] };
  assert.ok(!hasFraction(sandbox.unitLessonStatusBadgeHtml(lessonById('ul_1'))), 'a lesson with exactly one scheduled slot should show no fraction');

  st.lessonPlans[idx] = { ...st.lessonPlans[idx], teachingStatus: 'partially-taught', scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon', taught: true }, { weekKey: WEEK_A, dayKey: 'wed' }, { weekKey: WEEK_A, dayKey: 'fri' }] };
  const html = sandbox.unitLessonStatusBadgeHtml(lessonById('ul_1'));
  assert.ok(html.includes('1/3'), 'a lesson with 1 of 3 occurrences taught should show a 1/3 fraction');
  assert.ok(html.includes('Partially taught'), 'the status label itself should still render alongside the fraction');
});

test('unitLessonIsEffectivelyTaught / unitLessonStats count a lesson as taught once ANY occurrence is taught, without requiring every occurrence to be', () => {
  resetState();
  const st = getState();
  const idx1 = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx1] = { ...st.lessonPlans[idx1], teachingStatus: 'partially-taught', scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon', taught: true }, { weekKey: WEEK_A, dayKey: 'wed' }] };
  assert.strictEqual(sandbox.unitLessonIsEffectivelyTaught(lessonById('ul_1')), true, 'a lesson with 1 of 2 occurrences taught should count as effectively taught');

  const idx2 = st.lessonPlans.findIndex(l => l.id === 'ul_2');
  st.lessonPlans[idx2] = { ...st.lessonPlans[idx2], teachingStatus: 'reteach', scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'tue' }, { weekKey: WEEK_A, dayKey: 'thu' }] };
  assert.strictEqual(sandbox.unitLessonIsEffectivelyTaught(lessonById('ul_2')), false, 'a lesson with 0 occurrences taught (and not manually set to taught) must not count');

  const unit = st.unitPlans.find(u => u.id === 'unit_1');
  const stats = sandbox.unitLessonStats(unit);
  assert.strictEqual(stats.total, 2, 'sanity: the unit has 2 lessons');
  assert.strictEqual(stats.taught, 1, 'only ul_1 (partially taught, at least one occurrence complete) should count towards the unit\'s taught total');
});

test('the full render pipeline does not throw with a multi-slot lesson mid-way through being taught', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon');
  assert.doesNotThrow(() => realRenderView(), 'the board should render without throwing with one of two occurrences marked taught');

  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  assert.doesNotThrow(() => realRenderView(), 'the lesson drawer (view mode) should render without throwing');
  sandbox.plannerSwitchDrawerToEdit();
  assert.doesNotThrow(() => realRenderView(), 'the lesson drawer (edit mode, showing the schedule chips) should render without throwing');
});

// ── Reconciling legacy/stale "Taught" status against per-occurrence flags ───────
test('normalizeLessonPlan migrates a legacy multi-slot lesson stuck on "taught" with zero per-occurrence flags by backfilling every occurrence', () => {
  const lesson = sandbox.normalizeLessonPlan({
    id: 'legacy1', unitId: 'unit_1', teachingStatus: 'taught',
    scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'wed' }, { weekKey: WEEK_A, dayKey: 'fri' }],
  });
  eqJson(lesson.scheduledSlots, [
    { weekKey: WEEK_A, dayKey: 'mon', taught: true },
    { weekKey: WEEK_A, dayKey: 'wed', taught: true },
    { weekKey: WEEK_A, dayKey: 'fri', taught: true },
  ], 'a pre-existing "taught" lesson with no per-occurrence data at all should have every occurrence backfilled, so its badge reads "Taught 3/3" instead of the contradictory "Taught 0/3"');
  assert.strictEqual(lesson.teachingStatus, 'taught', 'the migration only fills in occurrence flags — it must not change the status itself');
});

test('normalizeLessonPlan does not touch occurrence flags for statuses other than "taught", even with zero occurrences marked', () => {
  const lesson = sandbox.normalizeLessonPlan({
    id: 'legacy2', unitId: 'unit_1', teachingStatus: 'partially-taught',
    scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'wed' }],
  });
  eqJson(lesson.scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon' }, { weekKey: WEEK_A, dayKey: 'wed' }], 'the legacy-data migration is scoped to teachingStatus === "taught" only — a stale "partially-taught" with 0 marked is the normal, documented un-marking edge case, not something to backfill');
});

test('normalizeLessonPlan does not re-backfill a lesson that already has a real mix of taught/untaught occurrences', () => {
  const lesson = sandbox.normalizeLessonPlan({
    id: 'legacy3', unitId: 'unit_1', teachingStatus: 'taught',
    scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon', taught: true }, { weekKey: WEEK_A, dayKey: 'wed' }],
  });
  eqJson(lesson.scheduledSlots, [{ weekKey: WEEK_A, dayKey: 'mon', taught: true }, { weekKey: WEEK_A, dayKey: 'wed' }], 'once at least one occurrence has real per-occurrence data, the blanket legacy migration must not fire and overwrite the genuinely-untaught occurrence');
});

test('scheduling a new occurrence onto an already fully-taught multi-slot lesson re-derives status down to partially-taught, rather than leaving a stale "Taught" label next to the new unmarked occurrence', () => {
  resetState();
  const st = getState();
  st.lessonPlans[st.lessonPlans.findIndex(l => l.id === 'ul_1')].teachingStatus = 'planned';
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'wed');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'taught', 'sanity: both of two occurrences taught');

  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'fri');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'partially-taught', 'adding a third, not-yet-happened occurrence to a fully-taught lesson must pull the status back down to partially-taught');
  eqJson(lessonById('ul_1').scheduledSlots, [
    { weekKey: WEEK_A, dayKey: 'mon', taught: true },
    { weekKey: WEEK_A, dayKey: 'wed', taught: true },
    { weekKey: WEEK_A, dayKey: 'fri' },
  ], 'the two already-taught occurrences must keep their flags; the brand-new occurrence must NOT be silently marked taught just because the lesson used to read as fully taught');
});

test('scheduling a second occurrence onto a legacy single-slot lesson manually marked taught backfills the original occurrence and derives partially-taught for the new one', () => {
  resetState();
  const st = getState();
  const idx = st.lessonPlans.findIndex(l => l.id === 'ul_1');
  st.lessonPlans[idx] = { ...st.lessonPlans[idx], teachingStatus: 'taught', scheduledSlots: [{ weekKey: WEEK_A, dayKey: 'mon' }] };

  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'partially-taught', 'a lesson that was "taught" back when it only had one occurrence must not keep reading as fully taught once a second, not-yet-happened occurrence is added');
  eqJson(lessonById('ul_1').scheduledSlots, [
    { weekKey: WEEK_A, dayKey: 'mon', taught: true },
    { weekKey: WEEK_A, dayKey: 'wed' },
  ], 'the pre-existing occurrence inherits the old whole-lesson "taught" status; the newly-scheduled occurrence must stay untaught');
});

test('scheduling a new occurrence onto a lesson that is not currently "taught" still leaves 0-taught statuses like Reteach untouched (no regression from the re-derive call)', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_A, 'mon');
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'ul_2 starts as Reteach in the fixture and must stay Reteach after its first slot is scheduled');
  sandbox.plannerScheduleUnitLesson('ul_2', WEEK_A, 'wed');
  assert.strictEqual(lessonById('ul_2').teachingStatus, 'reteach', 'and stay Reteach after a second occurrence is added too, since nothing has been marked taught yet');
});

// ── Collapsible Unit lessons rail / Lesson Drawer side panels ───────────────────
console.log('Collapsible Unit lessons rail / Lesson Drawer side panels');

test('both side panels default to expanded and are not persisted across a fresh plannerEnsureUiState', () => {
  resetState();
  const st = getState();
  assert.strictEqual(st.plannerUi.railCollapsed, false, 'the Unit lessons rail starts expanded');
  assert.strictEqual(st.plannerUi.drawerCollapsed, false, 'the Lesson Drawer starts expanded');
});

test('plannerToggleRailCollapsed / plannerToggleDrawerCollapsed toggle independently, each leaving the other panel untouched', () => {
  resetState();
  const st = getState();
  sandbox.plannerToggleRailCollapsed();
  assert.strictEqual(st.plannerUi.railCollapsed, true, 'rail should now be collapsed');
  assert.strictEqual(st.plannerUi.drawerCollapsed, false, 'toggling the rail must not touch the drawer');

  sandbox.plannerToggleDrawerCollapsed();
  assert.strictEqual(st.plannerUi.railCollapsed, true, 'rail should remain collapsed');
  assert.strictEqual(st.plannerUi.drawerCollapsed, true, 'drawer should now also be collapsed');

  sandbox.plannerToggleRailCollapsed();
  assert.strictEqual(st.plannerUi.railCollapsed, false, 'toggling again re-expands the rail');
  assert.strictEqual(st.plannerUi.drawerCollapsed, true, 'and must not touch the already-collapsed drawer');
});

test('expanded panels render their full content, the collapse control, and no is-collapsed class', () => {
  resetState();
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes('planner-unit-rail-body'), 'the rail body must render when expanded');
  assert.ok(html.includes('Lesson Drawer'), 'the drawer header must render when expanded');
  assert.ok(!/planner-unit-rail[^"]*is-collapsed/.test(html), 'the rail must not carry is-collapsed while expanded');
  assert.ok(!/planner-shell-drawer[^"]*is-collapsed/.test(html), 'the drawer must not carry is-collapsed while expanded');
  const toggleCount = (html.match(/planner-panel-collapse-toggle/g) || []).length;
  assert.strictEqual(toggleCount, 2, 'exactly one collapse toggle per panel (rail + drawer) should render when both are expanded');
});

test('collapsing the rail hides its content, adds is-collapsed, shows only a re-expand control, and shrinks its grid track', () => {
  resetState();
  sandbox.plannerToggleRailCollapsed();
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(/class="card planner-unit-rail is-collapsed"/.test(html), 'the rail must carry is-collapsed once toggled');
  assert.ok(!html.includes('planner-unit-rail-body'), 'the rail body (unit list) must not render while collapsed — a minimal strip only');
  assert.ok(!html.includes('Drag onto a day to add a slot'), 'the rail header subtitle must not render while collapsed either');
  assert.ok(html.includes('Lesson Drawer') && html.includes('Select a lesson card'), 'the drawer must render normally, unaffected by the rail collapsing');
  assert.ok(/grid-template-columns:\s*40px minmax\(0, 1fr\) minmax\(260px, 320px\)/.test(html), 'the rail track should shrink to 40px while the drawer keeps its normal track and the board (1fr) reclaims the difference');
});

test('collapsing the drawer preserves its selected lesson/content in state, and re-expanding shows it again — collapsing must not clear the selection', () => {
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  const st = getState();
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'sanity: drawer is open with ul_1 selected');

  // ul_1's own title ("Intro to fractions") also appears on its Week Board occurrence
  // card, so isolate the drawer's own markup (the last top-level panel rendered) rather
  // than searching the whole page, or the card's copy of the title would false-positive.
  const drawerSection = (html) => html.slice(html.indexOf('planner-shell-drawer'));

  sandbox.plannerToggleDrawerCollapsed();
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'collapsing the drawer must not close it or clear the selection');
  assert.strictEqual(st.plannerUi.selectedLessonId, 'ul_1', 'collapsing the drawer must not deselect the lesson');
  realRenderView();
  let html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(/class="card planner-shell-drawer is-collapsed"/.test(html), 'the drawer must carry is-collapsed once toggled');
  assert.ok(!drawerSection(html).includes('Intro to fractions'), 'the drawer\'s own lesson content must not render while collapsed');

  sandbox.plannerToggleDrawerCollapsed();
  assert.strictEqual(st.plannerUi.drawerOpen, true, 'still open after re-expanding');
  realRenderView();
  html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(drawerSection(html).includes('Intro to fractions'), 'the previously-selected lesson\'s content must reappear once the drawer is re-expanded, unchanged');
});

test('collapsing both side panels shrinks both tracks to 40px and lets the Week Board (1fr) reclaim the rest', () => {
  resetState();
  sandbox.plannerToggleRailCollapsed();
  sandbox.plannerToggleDrawerCollapsed();
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(/grid-template-columns:\s*40px minmax\(0, 1fr\) 40px/.test(html), 'both side tracks should be 40px, leaving the middle 1fr track (Week Board) to absorb all the reclaimed width');
  assert.ok(/class="card planner-unit-rail is-collapsed"/.test(html) && /class="card planner-shell-drawer is-collapsed"/.test(html), 'both panels should carry is-collapsed');
});

test('the full render pipeline does not throw in any combination of rail/drawer collapse state', () => {
  resetState();
  assert.doesNotThrow(() => realRenderView(), 'both expanded');
  sandbox.plannerToggleRailCollapsed();
  assert.doesNotThrow(() => realRenderView(), 'rail collapsed only');
  sandbox.plannerToggleDrawerCollapsed();
  assert.doesNotThrow(() => realRenderView(), 'both collapsed');
  sandbox.plannerToggleRailCollapsed();
  assert.doesNotThrow(() => realRenderView(), 'drawer collapsed only');
});

// ── Review fixes: opening the drawer always re-expands it; phone-width stacking ─
test('plannerOpenLessonDrawer re-expands a collapsed drawer — opening a lesson must make it visible', () => {
  resetState();
  const st = getState();
  sandbox.plannerToggleDrawerCollapsed();
  assert.strictEqual(st.plannerUi.drawerCollapsed, true, 'sanity: drawer starts collapsed');
  sandbox.plannerOpenLessonDrawer('ul_1');
  assert.strictEqual(st.plannerUi.drawerCollapsed, false, 'opening a lesson card must re-expand a collapsed drawer, not silently select it behind the collapsed tab');
  assert.strictEqual(st.plannerUi.drawerOpen, true);
});

test('plannerAddLesson re-expands a collapsed drawer — creating a new lesson must make its editor visible', () => {
  resetState();
  const st = getState();
  sandbox.plannerToggleDrawerCollapsed();
  sandbox.plannerAddLesson('mon');
  assert.strictEqual(st.plannerUi.drawerCollapsed, false, '+ Add Lesson must re-expand a collapsed drawer — otherwise a new lesson is silently created with no visible confirmation');
  assert.strictEqual(st.plannerUi.drawerOpen, true);
});

test('unitAddLesson re-expands a collapsed drawer, same as the standalone plannerAddLesson', () => {
  resetState();
  const st = getState();
  sandbox.plannerToggleDrawerCollapsed();
  sandbox.unitAddLesson('unit_1');
  assert.strictEqual(st.plannerUi.drawerCollapsed, false, 'adding a lesson to a unit must also re-expand a collapsed drawer');
  assert.strictEqual(st.plannerUi.drawerOpen, true);
});

test('collapsing the drawer after it is already open does not get silently re-opened by an unrelated re-render', () => {
  // Guards against a too-broad fix: re-expansion should only happen from the
  // explicit "open a lesson" actions above, not from every render.
  resetState();
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  sandbox.plannerToggleDrawerCollapsed();
  realRenderView();
  realRenderView();
  assert.strictEqual(getState().plannerUi.drawerCollapsed, true, 'an ordinary re-render must not silently re-expand a deliberately collapsed drawer');
});

test('the phone-width (max-width: 767px) stylesheet rule that stacks the planner panels still exists, since the inline grid-template-columns can only be overridden by an !important media query, not by anything JS-side', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const mobileBlockMatch = css.match(/@media \(max-width: 767px\) \{[\s\S]*?\n\}/);
  assert.ok(mobileBlockMatch, 'the existing mobile (<768px) responsive block must still be present');
  assert.ok(/\.planner-shell-layout\s*\{\s*grid-template-columns:\s*1fr\s*!important;\s*\}/.test(mobileBlockMatch[0]), 'the mobile block must force the planner grid back to a single stacked column, overriding the per-render inline style that only ever targets laptop/tablet widths — without this, the default-expanded three-column grid overflows a phone-width viewport and pushes the drawer off-screen');
});

// ── Discoverability of the collapsed side-panel toggle ───────────────────────────
test('the collapsed-strip toggle stretches to fill the whole tab rather than staying pinned to its own icon size', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const collapsedContainerRule = css.match(/\.planner-unit-rail\.is-collapsed,\s*\n\.planner-shell-drawer\.is-collapsed\s*\{[^}]*\}/);
  assert.ok(collapsedContainerRule, 'the collapsed rail/drawer container rule must still exist');
  assert.ok(/align-items:\s*stretch/.test(collapsedContainerRule[0]), 'the collapsed container must stretch its child (the toggle button) across the full strip — a height: 100% on the button alone does not work here, since the aside\'s own height comes from min-height rather than an explicit height, so a percentage height has no definite parent to resolve against');
  const collapsedButtonRule = css.match(/\.planner-unit-rail\.is-collapsed \.planner-panel-collapse-toggle,\s*\n\.planner-shell-drawer\.is-collapsed \.planner-panel-collapse-toggle\s*\{[^}]*\}/);
  assert.ok(collapsedButtonRule, 'the collapsed toggle button rule must still exist');
  assert.ok(!/\n\s*height:\s*22px/.test(collapsedButtonRule[0]), 'the collapsed button must not carry a fixed 22px height — that was the root cause of the button only being as tall as its icon glyph');
});

test('the collapsed rail and drawer strips each carry a distinct, legible vertical text label naming what is hidden', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.ok(/\.planner-unit-rail\.is-collapsed \.planner-panel-collapse-toggle::before\s*\{\s*\n?\s*content:\s*"Unit lessons";/.test(css), 'the collapsed Unit lessons rail must render a "Unit lessons" label');
  assert.ok(/\.planner-shell-drawer\.is-collapsed \.planner-panel-collapse-toggle::before\s*\{\s*\n?\s*content:\s*"Lesson Drawer";/.test(css), 'the collapsed Lesson Drawer must render a "Lesson Drawer" label, distinct from the rail\'s');
  const labelStyleRule = css.match(/\.planner-unit-rail\.is-collapsed \.planner-panel-collapse-toggle::before,\s*\n\.planner-shell-drawer\.is-collapsed \.planner-panel-collapse-toggle::before\s*\{[^}]*\}/);
  assert.ok(labelStyleRule, 'the shared ::before label styling rule must exist');
  assert.ok(/writing-mode:\s*vertical-rl/.test(labelStyleRule[0]), 'the label must be set vertically (rotated), matching a standard collapsed side-panel tab');
});

test('the collapsed toggle is visible at rest, not only on hover — it no longer blends into transparent/plain-card colors', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const collapsedButtonRule = css.match(/\.planner-unit-rail\.is-collapsed \.planner-panel-collapse-toggle,\s*\n\.planner-shell-drawer\.is-collapsed \.planner-panel-collapse-toggle\s*\{[^}]*\}/)[0];
  assert.ok(!/background:\s*transparent/.test(collapsedButtonRule), 'the collapsed button\'s resting background must no longer be transparent — that made it look like empty space rather than a control');
  assert.ok(/background:\s*var\(--surface-alt\)/.test(collapsedButtonRule), 'the collapsed button should use a background one step stronger than the plain card surface at rest');
});

test('the expanded-state header toggle (small square icon button) also got the contrast bump, not just the collapsed strip', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const baseRule = css.match(/\.planner-panel-collapse-toggle\s*\{[^}]*\}/)[0];
  assert.ok(!/color:\s*var\(--text3\)/.test(baseRule), 'the expanded toggle must no longer use the low-contrast --text3 default color');
  assert.ok(/color:\s*var\(--text2\)/.test(baseRule), 'the expanded toggle should use the stronger --text2 color at rest');
  assert.ok(/background:\s*var\(--surface-alt\)/.test(baseRule), 'the expanded toggle should use --surface-alt rather than blending into the card\'s own --surface background');
});

test('at phone widths (<768px), a collapsed panel is a short horizontal button rather than the desktop\'s full-height stretched strip with a rotated label', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const mobileBlockMatch = css.match(/@media \(max-width: 767px\) \{[\s\S]*?\n\}/);
  assert.ok(mobileBlockMatch, 'the mobile (<768px) responsive block must still be present');
  const mobileCss = mobileBlockMatch[0];
  assert.ok(/\.planner-unit-rail\.is-collapsed,\s*\n\s*\.planner-shell-drawer\.is-collapsed\s*\{\s*\n\s*min-height:\s*0;/.test(mobileCss), 'a collapsed panel must drop the desktop 300px min-height at phone widths — otherwise it stacks full-width AND stays 300px tall, i.e. most of the screen becomes an oversized tap target');
  assert.ok(/\.planner-unit-rail\.is-collapsed \.planner-panel-collapse-toggle,\s*\n\s*\.planner-shell-drawer\.is-collapsed \.planner-panel-collapse-toggle\s*\{\s*\n\s*flex-direction:\s*row;\s*\n\s*height:\s*44px;/.test(mobileCss), 'the collapsed button must switch to a short, fixed-height horizontal layout at phone widths, not the desktop\'s full-height vertical stack');
  assert.ok(/::before,\s*\n\s*\.planner-shell-drawer\.is-collapsed \.planner-panel-collapse-toggle::before\s*\{\s*\n\s*writing-mode:\s*horizontal-tb;/.test(mobileCss), 'the rotated vertical label must switch back to normal horizontal text at phone widths, since a rotated label only makes sense against the desktop\'s narrow, tall strip');
});

// ── Independent scroll per panel (Weekly Planner + Unit Plans) ──────────────────
console.log('Independent scroll per panel (Weekly Planner + Unit Plans)');

test('.card-head is pinned (flex-shrink: 0) so it never gets squeezed by a capped-height flex-column panel', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const rule = css.match(/\.card-head\s*\{[^}]*\}/)[0];
  assert.ok(/flex-shrink:\s*0/.test(rule), '.card-head must not shrink within a flex-column panel');
});

test('the Unit lessons rail and Lesson Drawer cap their height to the viewport when expanded, but explicitly exclude the collapsed edge tab', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const rule = css.match(/\.planner-unit-rail:not\(\.is-collapsed\),\s*\n\.planner-shell-drawer:not\(\.is-collapsed\)\s*\{[^}]*\}/);
  assert.ok(rule, 'a :not(.is-collapsed)-scoped max-height rule must exist for both panels');
  assert.ok(/display:\s*flex/.test(rule[0]) && /flex-direction:\s*column/.test(rule[0]), 'the panel must be a flex column so its header can stay pinned while its body scrolls');
  assert.ok(/max-height:\s*calc\(100vh - \d+px\)/.test(rule[0]), 'height must be tied to the viewport, not left uncapped');
  // Sanity: the rule must NOT also apply unscoped (i.e. it must not exist without the
  // :not(.is-collapsed) exclusion) — a collapsed panel has to keep rendering at its
  // existing min-height: 300px, untouched by this new max-height.
  assert.ok(!/\n\.planner-unit-rail,\n\.planner-shell-drawer\s*\{[^}]*max-height/.test(css), 'the max-height rule must not apply to the collapsed strip too');
});

test('the Week Board is deliberately NOT height-capped — only its own day columns scroll horizontally, unaffected by this change', () => {
  const rawCss = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  // Strip comments first — prose explaining that .planner-shell-board is deliberately
  // excluded (which necessarily mentions both "planner-shell-board" and "max-height"
  // in the same paragraph) would otherwise false-positive this check.
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const boardMaxHeightRules = css.match(/[^}]*\.planner-shell-board[^}]*\{[^}]*max-height[^}]*\}/g) || [];
  assert.strictEqual(boardMaxHeightRules.length, 0, '.planner-shell-board must never be given a max-height — it should keep growing to fit its content, relying only on its existing horizontal scroll');
});

test('.planner-unit-rail-body and the shared .lesson-drawer-body both fill their remaining panel height and scroll independently', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const railBodyRule = css.match(/\.planner-unit-rail-body\s*\{[^}]*\}/)[0];
  assert.ok(/flex:\s*1/.test(railBodyRule) && /min-height:\s*0/.test(railBodyRule) && /overflow-y:\s*auto/.test(railBodyRule), 'the rail body must be flex: 1; min-height: 0; overflow-y: auto to scroll independently within the now-capped rail');
  const drawerBodyRule = css.match(/\.lesson-drawer-body\s*\{[^}]*\}/)[0];
  assert.ok(/flex:\s*1/.test(drawerBodyRule) && /min-height:\s*0/.test(drawerBodyRule) && /overflow-y:\s*auto/.test(drawerBodyRule), 'the shared lesson-drawer-body class must be flex: 1; min-height: 0; overflow-y: auto');
});

test('every lesson-drawer-rendering function (standalone/unit, view/edit, on both the Weekly Planner and Unit Plans) wraps its content in the shared scrollable lesson-drawer-body class', () => {
  resetState();
  const st = getState();
  st.currentView = 'planner';

  // Standalone, view mode (default for a lesson with content).
  sandbox.plannerOpenLessonDrawerFromCard('sa_1');
  realRenderView();
  assert.ok(documentStub.getElementById('main-content').innerHTML.includes('class="lesson-drawer-body"'), 'standalone view mode must use lesson-drawer-body');

  // Standalone, edit mode.
  sandbox.plannerSwitchDrawerToEdit();
  realRenderView();
  assert.ok(documentStub.getElementById('main-content').innerHTML.includes('class="lesson-drawer-body"'), 'standalone edit mode must use lesson-drawer-body');

  // Unit lesson, view mode, via the Weekly Planner drawer. A unit lesson only stays
  // selected if it has a scheduled occurrence on the currently displayed week (see
  // renderPlanner's reachability check) — schedule it first, same as every other
  // test in this file that opens a unit lesson's drawer.
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  realRenderView();
  assert.ok(documentStub.getElementById('main-content').innerHTML.includes('class="lesson-drawer-body"'), 'unit lesson view mode (Weekly Planner) must use lesson-drawer-body');

  // Unit lesson, edit mode, via the Weekly Planner drawer.
  sandbox.plannerSwitchDrawerToEdit();
  realRenderView();
  assert.ok(documentStub.getElementById('main-content').innerHTML.includes('class="lesson-drawer-body"'), 'unit lesson edit mode (Weekly Planner) must use lesson-drawer-body');

  // Unit Plans' own drawer, both modes. Unlike the Weekly Planner, Unit Plans only
  // requires the lesson to belong to the open unit (see renderUnitDetail) — no
  // scheduled-on-this-week requirement.
  st.currentView = 'unit-plans';
  sandbox.unitPlansEnsureUiState();
  st.unitPlansUi.openUnitId = 'unit_1';
  st.plannerUi.selectedLessonId = 'ul_1';
  st.plannerUi.drawerOpen = true;
  st.plannerUi.drawerMode = 'view';
  realRenderView();
  assert.ok(documentStub.getElementById('main-content').innerHTML.includes('class="lesson-drawer-body"'), 'Unit Plans view mode must use lesson-drawer-body');

  st.plannerUi.drawerMode = 'edit';
  realRenderView();
  assert.ok(documentStub.getElementById('main-content').innerHTML.includes('class="lesson-drawer-body"'), 'Unit Plans edit mode must use lesson-drawer-body');
});

test('Unit Plans\' three columns (Lesson sequence, Edit/View lesson, Unit details) each cap their height to the viewport and scroll their own body independently — no collapse state to exclude, unlike the Weekly Planner', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const colRule = css.match(/\.unit-seq-col,\s*\n\.unit-drawer-col,\s*\n\.unit-side-col\s*\{[^}]*\}/);
  assert.ok(colRule, 'the shared three-column max-height rule must exist');
  assert.ok(/display:\s*flex/.test(colRule[0]) && /flex-direction:\s*column/.test(colRule[0]) && /max-height:\s*calc\(100vh - \d+px\)/.test(colRule[0]), 'all three columns must be capped flex columns');

  const seqBodyRule = css.match(/\.unit-seq-body\s*\{[^}]*\}/)[0];
  assert.ok(/flex:\s*1/.test(seqBodyRule) && /min-height:\s*0/.test(seqBodyRule) && /overflow-y:\s*auto/.test(seqBodyRule), 'the lesson sequence body must scroll independently');

  const sideBodyRule = css.match(/\.unit-side-body\s*\{[^}]*\}/)[0];
  assert.ok(/flex:\s*1/.test(sideBodyRule) && /min-height:\s*0/.test(sideBodyRule) && /overflow-y:\s*auto/.test(sideBodyRule), 'the unit details body must scroll independently');
});

test('the full render pipeline does not throw for either layout with the new scroll-container structure in place', () => {
  resetState();
  const st = getState();
  st.currentView = 'planner';
  assert.doesNotThrow(() => realRenderView(), 'Weekly Planner, drawer closed');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerOpenLessonDrawerFromCard('ul_1');
  assert.doesNotThrow(() => realRenderView(), 'Weekly Planner, unit lesson drawer open');
  sandbox.plannerToggleDrawerCollapsed();
  assert.doesNotThrow(() => realRenderView(), 'Weekly Planner, drawer collapsed with a lesson still selected underneath');

  st.currentView = 'unit-plans';
  sandbox.unitPlansEnsureUiState();
  st.unitPlansUi.openUnitId = 'unit_1';
  assert.doesNotThrow(() => realRenderView(), 'Unit Plans, 2-column (no lesson drawer)');
  st.plannerUi.selectedLessonId = 'ul_1';
  st.plannerUi.drawerOpen = true;
  assert.doesNotThrow(() => realRenderView(), 'Unit Plans, 3-column (lesson drawer open)');
});

// ── Review fixes: short-viewport min/max-height conflict, nested scroll at the ──
// ── stacking breakpoints, and scroll position lost on every re-render ───────────
test('min-height never exceeds max-height on either layout — a short viewport (e.g. a phone in landscape) must not force a panel taller than its own cap', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const plannerRule = css.match(/\.planner-unit-rail:not\(\.is-collapsed\),\s*\n\.planner-shell-drawer:not\(\.is-collapsed\)\s*\{[^}]*\}/)[0];
  assert.ok(/min-height:\s*min\(300px,\s*calc\(100vh - 170px\)\)/.test(plannerRule), 'the Weekly Planner panels\' min-height must be clamped with min() against the same max-height budget, not a bare 300px that could exceed it');

  // .unit-drawer-col, .unit-side-col appears twice (the max-height rule shared with
  // .unit-seq-col, and this dedicated min-height rule) — match every occurrence and
  // find the one that actually sets min-height, rather than grabbing whichever the
  // regex engine happens to match first.
  const unitRules = css.match(/\.unit-drawer-col,\s*\n\.unit-side-col\s*\{[^}]*\}/g) || [];
  const unitMinHeightRule = unitRules.find(r => /min-height/.test(r));
  assert.ok(unitMinHeightRule, 'a .unit-drawer-col, .unit-side-col rule setting min-height must exist');
  assert.ok(/min-height:\s*min\(200px,\s*calc\(100vh - 120px\)\)/.test(unitMinHeightRule), 'Unit Plans\' drawer/side columns\' min-height must likewise be clamped against their own max-height budget');
});

test('independent per-panel scroll is disabled once each layout stacks into a single column, restoring natural-height page scroll instead of trapping gestures inside one panel', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

  const tabletBlock = css.match(/@media \(max-width: 1024px\) \{[\s\S]*?\n\}/)[0];
  assert.ok(/\.unit-seq-col,\s*\n\s*\.unit-drawer-col,\s*\n\s*\.unit-side-col\s*\{\s*\n\s*max-height:\s*none;/.test(tabletBlock), 'Unit Plans stacks at <1024px — its three columns must drop max-height there so each grows to its natural height and the page scrolls through them, instead of each column keeping its own internal scrollbar');

  const mobileBlock = css.match(/@media \(max-width: 767px\) \{[\s\S]*?\n\}/)[0];
  assert.ok(/\.planner-unit-rail:not\(\.is-collapsed\),\s*\n\s*\.planner-shell-drawer:not\(\.is-collapsed\)\s*\{\s*\n\s*max-height:\s*none;/.test(mobileBlock), 'the Weekly Planner stacks at <768px — its expanded panels must likewise drop max-height there');
});

test('capturePanelScrollPositions reads the PREVIOUS render\'s identity (main\'s own data-prev-* attributes), not the live state — which by the time renderView() runs has always already been updated to the new value by whatever action triggered it', () => {
  resetState();
  const st = getState();
  const mainStub = documentStub.getElementById('main-content');

  // Simulate what a prior renderView() call would have stamped after rendering
  // the Weekly Planner with ul_1 selected.
  mainStub.dataset.prevView = 'planner';
  mainStub.dataset.prevSelectedLessonId = 'ul_1';
  mainStub.dataset.prevOpenUnitId = '';

  // Now simulate showView('unit-plans') having already flipped state.currentView
  // BEFORE renderView() (and therefore capturePanelScrollPositions) ever runs —
  // exactly the ordering that made the pre-fix version always compare a value
  // against itself and never detect navigation.
  st.currentView = 'unit-plans';
  st.plannerUi.selectedLessonId = 'ul_1'; // unchanged — same lesson id happens to be selected

  const positions = sandbox.capturePanelScrollPositions(mainStub);
  assert.strictEqual(positions.view, 'planner', 'must capture the PREVIOUS view from main\'s stamped attribute, not state.currentView, which is already \'unit-plans\' by this point');
  assert.strictEqual(positions.selectedLessonId, 'ul_1', 'must likewise capture the previous selected-lesson snapshot, not live state');
});

test('restorePanelScrollPositions correctly detects a view switch (even with the same lesson id happening to be selected in both) and skips restoring, instead of the pre-fix bug where the guard always matched and could apply a stale scroll position onto unrelated new content', () => {
  resetState();
  const st = getState();
  const mainStub = documentStub.getElementById('main-content');
  mainStub.dataset.prevView = 'planner';
  mainStub.dataset.prevSelectedLessonId = 'ul_1';
  mainStub.dataset.prevOpenUnitId = '';

  const positions = { 'lesson-drawer-body': 300, view: 'planner', selectedLessonId: 'ul_1', openUnitId: '' };
  st.currentView = 'unit-plans'; // navigated away, same lesson id still selected
  st.plannerUi.selectedLessonId = 'ul_1';

  sandbox.restorePanelScrollPositions(mainStub, positions);
  // The real scrollTop-skip itself needs a live DOM to observe directly (verified
  // live via Playwright); what's testable here is that the identity snapshot for
  // the NEXT render is correctly refreshed to the new view/lesson regardless —
  // proving the guard is reading real, current values rather than stale ones that
  // would otherwise cause every future comparison to keep drifting.
  assert.strictEqual(mainStub.dataset.prevView, 'unit-plans', 'must re-stamp the new current view for the next render to compare against');
  assert.strictEqual(mainStub.dataset.prevSelectedLessonId, 'ul_1', 'must re-stamp the new current lesson id too');
});

test('capturePanelScrollPositions / restorePanelScrollPositions never throw across every identity-change combination', () => {
  resetState();
  const st = getState();
  const mainStub = documentStub.getElementById('main-content');
  const positions = sandbox.capturePanelScrollPositions(mainStub);
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, positions), 'first-ever render, nothing stamped yet');

  st.plannerUi.selectedLessonId = 'ul_2';
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, sandbox.capturePanelScrollPositions(mainStub)), 'different lesson now selected');

  st.currentView = 'unit-plans';
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, sandbox.capturePanelScrollPositions(mainStub)), 'different view entirely');

  st.unitPlansUi = st.unitPlansUi || {};
  st.unitPlansUi.openUnitId = 'unit_2';
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, sandbox.capturePanelScrollPositions(mainStub)), 'different open unit');
});

// ── Bulk Assess: scroll position lost on every rating click (extends the same ──
// ── capturePanelScrollPositions/restorePanelScrollPositions mechanism above) ────
console.log('Bulk Assess roster scroll preservation');

function seedBulkAssessFixture(st) {
  st.curriculumCodes = [
    { Code: 'AC9E3LY01', Subject: 'English', 'Year Level': 'Year 3', Strand: 'Literacy' },
    { Code: 'AC9E3LY02', Subject: 'English', 'Year Level': 'Year 3', Strand: 'Literacy' },
  ];
  st.students = [
    { id: 'stu_1', first_name: 'Amelia', last_name: 'Chen', year_level: '3' },
    { id: 'stu_2', first_name: 'Liam', last_name: "O'Connor", year_level: '3' },
  ];
  st.currentView = 'bulk-assess';
  st.bulkAssess = { mode: 'by-code', yearFilter: 'all', subjectFilter: 'English', strandFilter: 'all', selectedCode: 'AC9E3LY01', selectedStudent: null, date: '2026-08-08', pendingChanges: {} };
}

test('renderBulkAssess gives the by-code roster body the bulk-assess-roster-body class the shared scroll-preservation mechanism looks for, and omits it when no code is selected yet (matching the mechanism\'s own graceful "element not found" handling)', () => {
  resetState();
  const st = getState();
  seedBulkAssessFixture(st);
  realRenderView();
  assert.ok(documentStub.getElementById('main-content').innerHTML.includes('class="bulk-assess-roster-body"'), 'the roster body must carry the tracked class once a code is selected');

  st.bulkAssess.selectedCode = null;
  realRenderView();
  assert.ok(!documentStub.getElementById('main-content').innerHTML.includes('bulk-assess-roster-body'), 'with no code selected, the empty-state placeholder renders instead — no roster body to (mis)track');
});

test('capturePanelScrollPositions reads the PREVIOUS render\'s Bulk Assess identity (selected code + subject filter + year filter) from main\'s own data-prev-* attributes, not live state — same ordering hazard as the Weekly Planner/Unit Plans case above, since setBulkCode() updates state.bulkAssess.selectedCode before renderBulkAssess() ever runs', () => {
  resetState();
  const st = getState();
  seedBulkAssessFixture(st);

  // Simulate what a prior render would have stamped while AC9E3LY01 was selected.
  const mainStub = documentStub.getElementById('main-content');
  mainStub.dataset.prevView = 'bulk-assess';
  mainStub.dataset.prevBulkAssessCode = 'AC9E3LY01';
  mainStub.dataset.prevBulkAssessSubject = 'English';
  mainStub.dataset.prevBulkAssessYear = 'all';

  // Now simulate setBulkCode('AC9E3LY02') having already flipped state before
  // capturePanelScrollPositions runs.
  st.bulkAssess.selectedCode = 'AC9E3LY02';

  const positions = sandbox.capturePanelScrollPositions(mainStub);
  assert.strictEqual(positions.bulkAssessCode, 'AC9E3LY01', 'must capture the PREVIOUS selected code from main\'s stamped attribute, not the already-updated live state');
  assert.strictEqual(positions.bulkAssessSubject, 'English', 'must likewise capture the previous subject filter, not live state');
  assert.strictEqual(positions.bulkAssessYear, 'all', 'must likewise capture the previous year filter, not live state');
});

test('restorePanelScrollPositions correctly detects a code switch in Bulk Assess and re-stamps the new identity for the next render, the same way it already does for the Weekly Planner\'s selected lesson and Unit Plans\' open unit', () => {
  resetState();
  const st = getState();
  seedBulkAssessFixture(st);
  const mainStub = documentStub.getElementById('main-content');
  mainStub.dataset.prevView = 'bulk-assess';
  mainStub.dataset.prevBulkAssessCode = 'AC9E3LY01';
  mainStub.dataset.prevBulkAssessSubject = 'English';
  mainStub.dataset.prevBulkAssessYear = 'all';

  const positions = { 'bulk-assess-roster-body': 300, view: 'bulk-assess', bulkAssessCode: 'AC9E3LY01', bulkAssessSubject: 'English', bulkAssessYear: 'all' };
  st.bulkAssess.selectedCode = 'AC9E3LY02'; // teacher picked a different code

  sandbox.restorePanelScrollPositions(mainStub, positions);
  // As with the Weekly Planner/Unit Plans tests above, the real scrollTop-skip
  // needs a live DOM to observe directly (verified live via Playwright per the
  // task's required validation); what's testable here is that the identity
  // snapshot for the NEXT render is correctly refreshed.
  assert.strictEqual(mainStub.dataset.prevBulkAssessCode, 'AC9E3LY02', 'must re-stamp the new selected code for the next render to compare against');
  assert.strictEqual(mainStub.dataset.prevBulkAssessSubject, 'English', 'subject filter unchanged, but must still be re-stamped');
  assert.strictEqual(mainStub.dataset.prevBulkAssessYear, 'all', 'year filter unchanged, but must still be re-stamped');
});

test('a bare subject-filter change with the SAME selected code still counts as different identity for Bulk Assess\'s roster — the task explicitly calls out "same selected code/subject filter" as the guard, not code alone', () => {
  resetState();
  const st = getState();
  seedBulkAssessFixture(st);
  const mainStub = documentStub.getElementById('main-content');
  mainStub.dataset.prevView = 'bulk-assess';
  mainStub.dataset.prevBulkAssessCode = 'AC9E3LY01';
  mainStub.dataset.prevBulkAssessSubject = 'English';
  mainStub.dataset.prevBulkAssessYear = 'all';

  const positions = { 'bulk-assess-roster-body': 300, view: 'bulk-assess', bulkAssessCode: 'AC9E3LY01', bulkAssessSubject: 'English', bulkAssessYear: 'all' };
  // Same code id, but the subject filter itself changed underneath it (the one
  // dimension code alone can't distinguish, per buildByCode()'s own comment).
  st.bulkAssess.subjectFilter = 'Mathematics';

  sandbox.restorePanelScrollPositions(mainStub, positions);
  assert.strictEqual(mainStub.dataset.prevBulkAssessSubject, 'Mathematics', 'must re-stamp the new subject filter for the next render to compare against');
});

test('a bare year-filter change with the SAME selected code/subject still counts as different identity for Bulk Assess\'s roster — filteredStudents (and so the roster\'s actual student set) depends on yearFilter via sortStudents(), so a stale scrollTop must not survive a year switch (review finding on PR #99)', () => {
  resetState();
  const st = getState();
  seedBulkAssessFixture(st);
  const mainStub = documentStub.getElementById('main-content');
  mainStub.dataset.prevView = 'bulk-assess';
  mainStub.dataset.prevBulkAssessCode = 'AC9E3LY01';
  mainStub.dataset.prevBulkAssessSubject = 'English';
  mainStub.dataset.prevBulkAssessYear = 'all';

  const positions = { 'bulk-assess-roster-body': 300, view: 'bulk-assess', bulkAssessCode: 'AC9E3LY01', bulkAssessSubject: 'English', bulkAssessYear: 'all' };
  // Same code and subject, but the year filter changed underneath it — a
  // different roster of students, per filteredStudents/sortStudents(). As with
  // the sibling tests above, this stub's querySelector() is a fixed no-op (it
  // doesn't parse innerHTML), so the actual scrollTop-skip can only be observed
  // in a live DOM (verified live via Playwright, extending the same check
  // already run for the code/subject cases); what's testable here is that a
  // year-only change is correctly treated as a DIFFERENT identity rather than
  // silently falling through the code+subject guard.
  st.bulkAssess.yearFilter = '3';

  sandbox.restorePanelScrollPositions(mainStub, positions);
  assert.strictEqual(mainStub.dataset.prevBulkAssessYear, '3', 'must re-stamp the new year filter for the next render to compare against');
});

test('capturePanelScrollPositions / restorePanelScrollPositions never throw across every Bulk Assess identity-change combination, including from/to a null selectedCode', () => {
  resetState();
  const st = getState();
  seedBulkAssessFixture(st);
  const mainStub = documentStub.getElementById('main-content');
  const positions = sandbox.capturePanelScrollPositions(mainStub);
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, positions), 'first-ever render, nothing stamped yet');

  st.bulkAssess.selectedCode = 'AC9E3LY02';
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, sandbox.capturePanelScrollPositions(mainStub)), 'different code now selected');

  st.bulkAssess.subjectFilter = 'Mathematics';
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, sandbox.capturePanelScrollPositions(mainStub)), 'different subject filter');

  st.bulkAssess.yearFilter = '3';
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, sandbox.capturePanelScrollPositions(mainStub)), 'different year filter');

  st.bulkAssess.selectedCode = null;
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, sandbox.capturePanelScrollPositions(mainStub)), 'code cleared back to the empty state');

  st.currentView = 'planner';
  assert.doesNotThrow(() => sandbox.restorePanelScrollPositions(mainStub, sandbox.capturePanelScrollPositions(mainStub)), 'navigated away from Bulk Assess entirely');
});

// ── Fix: Progress "current" lookups must pick latest-by-date, not first .find() match ──
// Progress is append-only history (old rows are never deleted/replaced — new rows
// supersede old ones by date), so a student+code pair can legitimately end up with more
// than one row. Every "what's the current rating" lookup must resolve to the latest by
// date; picking the first array match instead silently pins "current" to whichever row
// happens to sit first in the raw, unsorted sheet-row order loadAll()/loadProgress()
// return — typically the oldest — which is how a rating clear could appear to not stick,
// and to keep reverting after a reload.
console.log('Progress "current" lookups pick latest-by-date, not first array match');

function seedDuplicateProgressFixture(st) {
  st.students = [{ id: 'stu_1', first_name: 'Amelia', last_name: 'Chen', year_level: '3' }];
  st.curriculumCodes = [{ Code: 'AC9E3LY01', Subject: 'English', 'Year Level': 'Year 3', Strand: 'Literacy' }];
  st.instructionalComponents = [];
  // Deliberately out of date order, matching the shape loadAll()/loadProgress() actually
  // produce (zero sorting — raw sheet-row order): the oldest row sits first, a mid-aged
  // row second, and the true latest (a manually-cleared rating) sits last, since
  // updateProgress mutates a row in place — its position never moves — while saveProgress
  // appends new rows at the end.
  st.progress = [
    { id: 'p_old', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-05-01', notes: '' },
    { id: 'p_mid', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Developing', date: '2026-06-15', notes: '' },
    { id: 'p_latest', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Not taught', date: '2026-07-20', notes: '' },
  ];
}

test('getLatestProgressRecord returns the row with the latest date, not the first array match, when a student+code pair has duplicate rows', () => {
  resetState();
  const st = getState();
  seedDuplicateProgressFixture(st);
  const rec = sandbox.getLatestProgressRecord('stu_1', 'AC9E3LY01');
  assert.strictEqual(rec.id, 'p_latest', 'must resolve to the chronologically latest row, not state.progress[0]');
});

test('getLatestProgressRecord returns null with no matching rows, and the single match when there is exactly one — the common, non-duplicate case is unaffected', () => {
  resetState();
  const st = getState();
  seedDuplicateProgressFixture(st);
  assert.strictEqual(sandbox.getLatestProgressRecord('stu_1', 'AC9M3N02'), null, 'no rows at all for this code');
  st.progress = [{ id: 'only_one', student_id: 'stu_2', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-05-01', notes: '' }];
  assert.strictEqual(sandbox.getLatestProgressRecord('stu_2', 'AC9E3LY01').id, 'only_one');
});

test('getLatestProgressRecord breaks a same-date tie in favor of the later-appended (array-later) row, not the earlier one a stable sort\'s tie-break would silently keep — date is day-only, so setting a rating and clearing it again in the same session is a same-date duplicate, exactly this bug\'s own real-world case (review finding)', () => {
  resetState();
  const st = getState();
  // Two rows, identical date, appended in order: the earlier-appended row set the
  // rating, the later-appended row is the same-day clear that must win.
  st.progress = [
    { id: 'p_set', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-07-20', notes: '' },
    { id: 'p_cleared', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Not taught', date: '2026-07-20', notes: '' },
  ];
  const rec = sandbox.getLatestProgressRecord('stu_1', 'AC9E3LY01');
  assert.strictEqual(rec.id, 'p_cleared', 'the later-appended same-date row must win the tie, not the earlier-appended one');
});

test('getMasteryForCode reflects a manually-cleared rating (a later "Not taught" row) even though an earlier "Achieved" row sits first in state.progress — this is the exact "clearing doesn\'t persist" symptom: a plain .find() would keep returning the stale Achieved row forever regardless of what was saved afterward', () => {
  resetState();
  const st = getState();
  seedDuplicateProgressFixture(st);
  assert.strictEqual(sandbox.getMasteryForCode('stu_1', 'AC9E3LY01'), 'Not taught', 'the latest row (a cleared rating) must win over the earlier Achieved row that happens to load first');
});

test('saveBulkAssess resolves its update-vs-insert "existing" decision to the latest-by-date row, so a rating clear updates the true current record instead of silently re-updating a stale earlier row', () => {
  resetState();
  const st = getState();
  seedDuplicateProgressFixture(st);
  st.currentView = 'bulk-assess';
  st.bulkAssess = { mode: 'by-code', yearFilter: 'all', subjectFilter: 'English', strandFilter: 'all', selectedCode: 'AC9E3LY01', selectedStudent: null, date: '2026-08-08', pendingChanges: { 'stu_1|AC9E3LY01': null } };

  const apiCalls = [];
  const realApiCall = sandbox.apiCall;
  sandbox.apiCall = function (action, data) {
    apiCalls.push({ action, data });
    return Promise.resolve({ success: true });
  };
  try {
    sandbox.saveBulkAssess(); // async — runs synchronously up to its first await, which is as far as this test needs: that's where "existing" gets decided and used
  } finally {
    sandbox.apiCall = realApiCall;
  }

  assert.strictEqual(apiCalls.length, 1, 'exactly one save call must have been issued synchronously before the first await suspended the loop');
  assert.strictEqual(apiCalls[0].action, 'updateProgress', 'a record already exists for this student+code, so this must update it, not insert a new one');
  assert.strictEqual(apiCalls[0].data.progress_id, 'p_latest', 'must update the latest row (p_latest), not the stale p_old row a plain .find() would have returned first');
});

// ── Review fix: a BACKDATED save must never overwrite the current latest row ──────
// (Codex finding on this PR) — making getLatestProgressRecord deterministic fixed the
// display bug, but it also meant every save now deterministically targets the TRUE
// latest row for update-in-place. If the teacher deliberately saves an earlier date
// (Bulk Assess's date picker exists specifically for logging a missed lesson), that
// would silently overwrite and destroy the latest row's real data — and if a THIRD,
// in-between-date duplicate survives, it then wrongly outranks the corrupted latest
// row, making the backdated save appear to have vanished. progressRecordToUpdate()
// now refuses to treat the latest row as "existing" when the new date is earlier than
// it, so a backdated save always inserts new history instead of destroying old.
console.log('Backdated saves never overwrite the current latest Progress row (review finding)');

testAsync('saveBulkAssess: a backdated save (earlier than the current latest row), with a THIRD in-between-date duplicate also present, inserts a new row and leaves all three existing rows byte-for-byte untouched — the exact data-loss scenario Codex flagged', async () => {
  resetState();
  const st = getState();
  st.students = [{ id: 'stu_1', first_name: 'Amelia', last_name: 'Chen', year_level: '3' }];
  st.curriculumCodes = [{ Code: 'AC9E3LY01', Subject: 'English', 'Year Level': 'Year 3', Strand: 'Literacy' }];
  st.instructionalComponents = [];
  // Three existing rows. p_mid is the "surviving duplicate with a later date" that
  // would wrongly become "current" if p_latest got corrupted down to the backdated date.
  st.progress = [
    { id: 'p_old', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Emerging', date: '2026-05-01', notes: '' },
    { id: 'p_mid', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Developing', date: '2026-06-15', notes: '' },
    { id: 'p_latest', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-07-20', notes: '' },
  ];
  st.currentView = 'bulk-assess';
  // The teacher backdates to 2026-06-01 — catching up on a missed lesson — earlier
  // than BOTH p_mid (2026-06-15) and p_latest (2026-07-20).
  st.bulkAssess = { mode: 'by-code', yearFilter: 'all', subjectFilter: 'English', strandFilter: 'all', selectedCode: 'AC9E3LY01', selectedStudent: null, date: '2026-06-01', pendingChanges: { 'stu_1|AC9E3LY01': 'Emerging' } };

  const apiCalls = [];
  const realApiCall = sandbox.apiCall;
  sandbox.apiCall = function (action, data) {
    apiCalls.push({ action, data });
    return Promise.resolve(action === 'saveProgress' ? { success: true, progress_id: 'p_backdated' } : { success: true });
  };
  try {
    await sandbox.saveBulkAssess();
  } finally {
    sandbox.apiCall = realApiCall;
  }

  assert.strictEqual(apiCalls.length, 1, 'exactly one save call');
  assert.strictEqual(apiCalls[0].action, 'saveProgress', 'a backdated save (earlier than the current latest) must INSERT a new row, never updateProgress an existing one');

  eqJson(st.progress.find(p => p.id === 'p_old'), { id: 'p_old', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Emerging', date: '2026-05-01', notes: '' }, 'the oldest row must be untouched');
  eqJson(st.progress.find(p => p.id === 'p_mid'), { id: 'p_mid', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Developing', date: '2026-06-15', notes: '' }, 'the in-between duplicate must be untouched — exactly the row that would wrongly "win" getLatestProgressRecord if p_latest had been corrupted down to the backdated date');
  eqJson(st.progress.find(p => p.id === 'p_latest'), { id: 'p_latest', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-07-20', notes: '' }, 'the true latest row must survive completely unmodified — this is the record Codex found being silently destroyed');

  const backdatedRow = st.progress.find(p => p.id === 'p_backdated');
  assert.ok(backdatedRow, 'a new row for the backdated save must have been inserted');
  assert.strictEqual(backdatedRow.date, '2026-06-01');
  assert.strictEqual(backdatedRow.mastery, 'Emerging');

  assert.strictEqual(sandbox.getLatestProgressRecord('stu_1', 'AC9E3LY01').id, 'p_latest', 'the backdated insert must not disturb what counts as "current" — still the true latest row, not the in-between duplicate and not the newly-inserted backdated row');
  assert.strictEqual(sandbox.getMasteryForCode('stu_1', 'AC9E3LY01'), 'Achieved');
});

testAsync('saveProgress (the single-entry save path, not Bulk Assess) applies the same backdate protection: a date earlier than the current latest record inserts a new row rather than overwriting it', async () => {
  resetState();
  const st = getState();
  st.progress = [{ id: 'p_latest', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-07-20', notes: '' }];

  const apiCalls = [];
  const realApiCall = sandbox.apiCall;
  sandbox.apiCall = function (action, data) {
    apiCalls.push({ action, data });
    return Promise.resolve(action === 'saveProgress' ? { success: true, progress_id: 'p_new' } : { success: true });
  };
  try {
    await sandbox.saveProgress({ student_id: 'stu_1', content_descriptor_code: 'AC9E3LY01', mastery_level: 'Developing', date_assessed: '2026-06-01', teacher_notes: '' });
  } finally {
    sandbox.apiCall = realApiCall;
  }

  assert.strictEqual(apiCalls[0].action, 'saveProgress', 'a backdated date must insert, not update');
  eqJson(st.progress.find(p => p.id === 'p_latest'), { id: 'p_latest', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-07-20', notes: '' }, 'the true latest row must be untouched');
});

testAsync('saveProgressBatch applies the same backdate protection per-entry: a batch entry dated earlier than the current latest record inserts a new row rather than overwriting it', async () => {
  resetState();
  const st = getState();
  st.progress = [{ id: 'p_latest', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-07-20', notes: '' }];

  const apiCalls = [];
  const realApiCall = sandbox.apiCall;
  sandbox.apiCall = function (action, data) {
    apiCalls.push({ action, data });
    return Promise.resolve(action === 'saveProgress' ? { success: true, progress_id: 'p_new' } : { success: true });
  };
  try {
    await sandbox.saveProgressBatch([{ student_id: 'stu_1', content_descriptor_code: 'AC9E3LY01', mastery_level: 'Developing', date_assessed: '2026-06-01', teacher_notes: '' }]);
  } finally {
    sandbox.apiCall = realApiCall;
  }

  assert.strictEqual(apiCalls[0].action, 'saveProgress', 'a backdated batch entry must insert, not update');
  eqJson(st.progress.find(p => p.id === 'p_latest'), { id: 'p_latest', student_id: 'stu_1', code: 'AC9E3LY01', mastery: 'Achieved', date: '2026-07-20', notes: '' }, 'the true latest row must be untouched');
});

// ── Review fix: rail text truncation regression from the independent-scroll PR ──
console.log('Unit lessons rail scrollbar-width compensation (truncation regression fix)');

test('the expanded Unit lessons rail track is widened by 12px at both ends to compensate for its own internal scrollbar, while the Week Board and Lesson Drawer tracks are untouched', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const rule = css.match(/\.planner-shell-layout\s*\{[^}]*\}/)[0];
  assert.ok(/grid-template-columns:\s*minmax\(212px, 252px\) minmax\(0, 1fr\) minmax\(260px, 320px\)/.test(rule), 'the rail track must grow from minmax(200px, 240px) to minmax(212px, 252px); the middle (Week Board) and third (Lesson Drawer) tracks must be exactly as before');
  // Strip comments first — the rule's own explanatory comment intentionally
  // mentions the old value for context, which would otherwise false-positive this.
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/minmax\(200px,\s*240px\)/.test(cssWithoutComments), 'the old, too-narrow rail track value must not remain in any live (non-comment) CSS rule');
});

test('the per-render inline grid-template-columns style in renderPlanner reflects the same widened rail track when expanded, the same untouched 40px when collapsed, and leaves the Lesson Drawer track untouched in both cases', () => {
  resetState();

  realRenderView();
  let html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(/grid-template-columns:\s*minmax\(212px, 252px\) minmax\(0, 1fr\) minmax\(260px, 320px\)/.test(html), 'expanded rail must render at minmax(212px, 252px); the drawer track must remain minmax(260px, 320px)');

  sandbox.plannerToggleRailCollapsed();
  realRenderView();
  html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(/grid-template-columns:\s*40px minmax\(0, 1fr\) minmax\(260px, 320px\)/.test(html), 'collapsing the rail must still shrink it to exactly 40px, unaffected by the width fix; the drawer track must remain minmax(260px, 320px)');
});

test('.planner-unit-rail-body uses a slim, explicitly-sized scrollbar so its own internal scroll costs a small, known amount of the narrow rail column rather than an uncontrolled OS-default width', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const railBodyRules = css.match(/\.planner-unit-rail-body[^{]*\{[^}]*\}/g) || [];
  const joined = railBodyRules.join('\n');
  assert.ok(/scrollbar-width:\s*thin/.test(joined), 'Firefox must get the thin scrollbar-width, not the default full-width one');
  const webkitWidthRule = css.match(/\.planner-unit-rail-body::-webkit-scrollbar\s*\{[^}]*\}/);
  assert.ok(webkitWidthRule && /width:\s*8px/.test(webkitWidthRule[0]), 'Chromium/WebKit must get an explicit, narrow 8px scrollbar width');
  assert.ok(/\.planner-unit-rail-body::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*var\(--border2\)/.test(css), 'the scrollbar thumb must use the existing --border2 theme token, not a hardcoded colour, per project convention');
  assert.ok(/\.planner-unit-rail-body::-webkit-scrollbar-thumb:hover\s*\{[^}]*background:\s*var\(--text3\)/.test(css), 'the scrollbar thumb must darken on hover using the existing --text3 theme token');
});

// ── Unit lessons rail: wrap titles onto 2 lines instead of ellipsis-truncating ──
console.log('Unit lessons rail title wrap (readability regression fix)');

test('.planner-unit-pill-title clamps to 2 lines instead of the old single-line nowrap+ellipsis truncation', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const rule = css.match(/\.planner-unit-pill-title\s*\{[^}]*\}/)[0];
  assert.ok(!/white-space:\s*nowrap/.test(rule), 'the old single-line nowrap must be gone — that was what forced an ellipsis after just a few words');
  assert.ok(/display:\s*-webkit-box/.test(rule) && /-webkit-line-clamp:\s*2/.test(rule) && /-webkit-box-orient:\s*vertical/.test(rule), 'must use the standard 2-line clamp technique, so a title wraps onto a 2nd line before any ellipsis kicks in');
  assert.ok(/overflow:\s*hidden/.test(rule), 'overflow: hidden must remain — still needed for the clamp to cut off a 3rd line with an ellipsis on the rare title too long for even 2 lines');
});

test('the rail lesson title carries a title="..." attribute with the full, unescaped-back-to-plain-text title, as a native-tooltip fallback for a title too long for the 2-line clamp — not a custom hover UI', () => {
  resetState();
  const st = getState();
  st.lessonPlans[0].title = 'Mental addition and subtraction strategies using place value partitioning, part 2';
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes('class="planner-unit-pill-title" title="Mental addition and subtraction strategies using place value partitioning, part 2"'), 'the title attribute must carry the exact full lesson title, giving a native browser tooltip on hover regardless of how much of the 2-line clamp got used');
  // The project already has a custom-hover-tooltip helper (truncateWithTooltip / .tt-ellipsis,
  // which renders a styled ::after popup) — the task explicitly asked for a plain native
  // tooltip instead, so guard against the rail card having picked that helper up instead.
  assert.ok(!/planner-unit-pill-title[^"]*tt-ellipsis/.test(html), 'must not use the custom tt-ellipsis hover-popup helper — a plain title attribute only, per the task');
});

test('a short rail lesson title (fits on one line) still renders correctly and unclamped, with no visual regression for the common case', () => {
  resetState();
  const st = getState();
  st.lessonPlans[0].title = 'Short title';
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes('class="planner-unit-pill-title" title="Short title">Short title</div>'), 'a short title must still render plainly inside the same element/attribute structure');
});

test('the title-wrap fix only touches .planner-unit-pill-title — the sibling meta line (subject/IC count), slot-count badge, drag handle, and drag-to-schedule wiring are all untouched', () => {
  resetState();
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes('planner-unit-pill-meta'), 'the meta line (subject + IC count) must still render');
  assert.ok(html.includes('planner-unit-slot-count'), 'the slot-count badge must still render');
  assert.ok(html.includes('planner-unit-drag'), 'the drag handle must still render');
  assert.ok(/draggable="true"/.test(html), 'drag-to-schedule must remain wired up on the rail cards');

  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const metaRule = css.match(/\.planner-unit-pill-meta\s*\{[^}]*\}/)[0];
  assert.ok(!/-webkit-line-clamp|line-clamp/.test(metaRule), 'the meta line must not have picked up the 2-line clamp — only the title wraps, per the task scope');
});

test('.planner-unit-pill-title is not reused anywhere else in the app — the wrap fix is correctly scoped to the Weekly Planner Unit lessons rail only, not shared with Week Board day cards or Unit Plans\' own lesson list', () => {
  // Strip the header/changelog block comment first — it documents this exact class by
  // name (see the v1.13.86 entry), which would otherwise inflate the count without the
  // class actually being reused in any real markup.
  const appJsSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//, '');
  const occurrences = (appJsSrc.match(/planner-unit-pill-title/g) || []).length;
  assert.strictEqual(occurrences, 1, 'planner-unit-pill-title must appear exactly once in app.js (outside comments) — inside plannerUnitSidebarLessonHtml only — confirming this class (and therefore the fix) is not shared with any other card renderer');
});

// ── Phase 1: "mark as taught" auto-launch/merge into the Daily Log Wizard ────────
console.log('Daily Log Wizard auto-launch/merge from the Week Board taught checkbox');

// resetState() leaves instructionalComponents empty and every fixture lesson's
// linkedICIds empty — seed a couple of ICs and wire them onto the fixture lessons so
// these tests actually have something to launch/merge/attribute. dlState is a
// module-level variable resetState() never touches (it belongs to a completely
// separate feature, the Daily Log Wizard), so also close/reset any session left open
// by a previous test — openDailyLogWizard() itself is the one function that fully
// resets every dlState field, closeDlModal() only flips isOpen off.
function seedDlFixture() {
  const st = getState();
  st.instructionalComponents = [
    { id: 'ic_a', homeDescriptorId: 'CODE_A', name: 'IC A', linkedDescriptorIds: [] },
    { id: 'ic_b', homeDescriptorId: 'CODE_B', name: 'IC B', linkedDescriptorIds: [] },
    { id: 'ic_shared', homeDescriptorId: 'CODE_SHARED', name: 'IC Shared', linkedDescriptorIds: [] },
  ];
  st.students = [{ id: 'stu_1', first_name: 'Ada', last_name: 'L', year_level: '3' }];
  sandbox.openDailyLogWizard();
  sandbox.closeDlModal();
}

test('plannerDateForSlot computes the correct calendar date for a weekday offset within the week, and falls back to today for a malformed input', () => {
  // WEEK_A = '2026-06-29', a Monday (see the fixture's own comment above).
  assert.strictEqual(sandbox.plannerDateForSlot(WEEK_A, 'mon'), '2026-06-29');
  assert.strictEqual(sandbox.plannerDateForSlot(WEEK_A, 'wed'), '2026-07-01');
  assert.strictEqual(sandbox.plannerDateForSlot(WEEK_A, 'fri'), '2026-07-03');
  const today = sandbox.toIsoDate(new Date());
  assert.strictEqual(sandbox.plannerDateForSlot(WEEK_A, 'unscheduled'), today, 'a non-weekday dayKey (e.g. the legacy unscheduled value) must fall back to today rather than throwing or returning a wrong date');
  assert.strictEqual(sandbox.plannerDateForSlot('not-a-date', 'mon'), today, 'a malformed weekKey must also fall back to today');
});

test('dlLaunchOrMergeForLesson does nothing at all for a lesson with no linked ICs — the checkbox still just marks it taught, there is nothing to log', () => {
  resetState();
  seedDlFixture();
  assert.strictEqual(getDlState().isOpen, false, 'sanity: no session open yet');
  sandbox.dlLaunchOrMergeForLesson({ id: 'ul_1', linkedICIds: [] }, WEEK_A, 'mon');
  assert.strictEqual(getDlState().isOpen, false, 'a lesson with zero linked ICs must never launch the wizard');
});

test('dlLaunchOrMergeForLesson launches a fresh session when none is open, pre-filled with the lesson\'s ICs and dated to the occurrence\'s own weekKey/dayKey — not today', () => {
  resetState();
  seedDlFixture();
  sandbox.dlLaunchOrMergeForLesson({ id: 'ul_1', linkedICIds: ['ic_a', 'ic_b'] }, WEEK_A, 'wed');
  // openDailyLogWizard() reassigns dlState to a brand-new object rather than mutating
  // the existing one, so it's re-fetched fresh after every action rather than reusing
  // a reference captured before the action.
  const dl = getDlState();
  assert.strictEqual(dl.isOpen, true, 'a session must now be open');
  assert.strictEqual(dl.date, '2026-07-01', 'must be dated to the occurrence\'s own date (WEEK_A + Wednesday), not today\'s real date');
  eqJson(dl.selectedICs.slice().sort(), ['ic_a', 'ic_b'], 'both of the lesson\'s ICs must be pre-selected');
  assert.strictEqual(dl.icLessonMap.ic_a, 'ul_1', 'each IC must be attributed back to the lesson that contributed it');
  assert.strictEqual(dl.icLessonMap.ic_b, 'ul_1');
  eqJson(dl.selectedCodes.slice().sort(), ['CODE_A', 'CODE_B'], 'selectedCodes must be recomputed to include both ICs\' home descriptor codes');
});

test('dlLaunchOrMergeForLesson merges into an already-open session instead of discarding it or opening a second modal, deduping any IC already present', () => {
  resetState();
  seedDlFixture();
  sandbox.dlLaunchOrMergeForLesson({ id: 'ul_1', linkedICIds: ['ic_a'] }, WEEK_A, 'mon');
  assert.strictEqual(getDlState().date, '2026-06-29', 'sanity: dated to the first lesson\'s occurrence');

  // A second, different lesson checked while the first session is still open — this
  // must MERGE (mutate the existing dlState in place), not call openDailyLogWizard()
  // again, so re-fetching getDlState() here is only a defensive habit, not a
  // requirement for this specific call.
  sandbox.dlLaunchOrMergeForLesson({ id: 'ul_2', linkedICIds: ['ic_a', 'ic_b'] }, WEEK_A, 'fri');
  const dl = getDlState();
  assert.strictEqual(dl.isOpen, true, 'still just the one session');
  assert.strictEqual(dl.date, '2026-06-29', 'the original session\'s date must NOT be overwritten by the second lesson\'s own occurrence date — merging must not silently re-date an in-progress session');
  eqJson(dl.selectedICs.slice().sort(), ['ic_a', 'ic_b'], 'ic_a (shared by both lessons) must be deduped, not added twice');
  assert.strictEqual(dl.icLessonMap.ic_a, 'ul_1', 'ic_a must keep its FIRST attribution (ul_1) — the second lesson merging in the same IC must not steal credit for it');
  assert.strictEqual(dl.icLessonMap.ic_b, 'ul_2', 'ic_b is new in this merge and must be attributed to the lesson that actually contributed it (ul_2)');
});

test('checking a standalone lesson\'s taught checkbox (plannerSetLessonStatus) triggers the wizard; unchecking it does not', () => {
  resetState();
  seedDlFixture();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'sa_1').linkedICIds = ['ic_a'];

  sandbox.plannerSetLessonStatus('taught', 'sa_1');
  let dl = getDlState();
  assert.strictEqual(dl.isOpen, true, 'checking (marking taught) must trigger the wizard');
  assert.strictEqual(dl.icLessonMap.ic_a, 'sa_1');

  sandbox.closeDlModal();
  sandbox.plannerSetLessonStatus('planned', 'sa_1');
  assert.strictEqual(getDlState().isOpen, false, 'unchecking must never re-launch the wizard — only the taught transition does');
});

test('the IC-gate rejection path (plannerSetLessonStatus on a lesson with no ICs) never launches the wizard either', () => {
  resetState();
  seedDlFixture();
  sandbox.plannerSetLessonStatus('taught', 'sa_1'); // sa_1 has no linkedICIds in the base fixture
  assert.strictEqual(lessonById('sa_1').status, 'planned', 'sanity: the existing IC gate must still reject this exactly as before');
  assert.strictEqual(getDlState().isOpen, false, 'a rejected status change must not launch the wizard — nothing was actually marked taught');
});

test('checking a multi-slot unit lesson occurrence\'s checkbox (unitToggleOccurrenceTaught) triggers the wizard dated to THAT occurrence; unchecking does not', () => {
  resetState();
  seedDlFixture();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'ul_1').linkedICIds = ['ic_a'];
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'fri');

  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'fri');
  const dl = getDlState();
  assert.strictEqual(dl.isOpen, true);
  assert.strictEqual(dl.date, '2026-07-03', 'must be dated to the specific occurrence that was checked (Friday), not the lesson\'s other occurrence or today');
  assert.strictEqual(dl.icLessonMap.ic_a, 'ul_1');

  sandbox.closeDlModal();
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'fri'); // un-mark the same occurrence
  assert.strictEqual(getDlState().isOpen, false, 'unchecking must not re-launch the wizard');
});

test('checking a single-occurrence unit lesson\'s checkbox (unitSetSingleOccurrenceTaught) triggers the wizard; unchecking does not', () => {
  resetState();
  seedDlFixture();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'ul_1').linkedICIds = ['ic_a'];
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');

  sandbox.unitSetSingleOccurrenceTaught('ul_1', WEEK_A, 'wed', true);
  const dl = getDlState();
  assert.strictEqual(dl.isOpen, true);
  assert.strictEqual(dl.date, '2026-07-01');
  assert.strictEqual(dl.icLessonMap.ic_a, 'ul_1');

  sandbox.closeDlModal();
  sandbox.unitSetSingleOccurrenceTaught('ul_1', WEEK_A, 'wed', false);
  assert.strictEqual(getDlState().isOpen, false, 'unchecking must not re-launch the wizard');
});

test('a single-occurrence lesson reduced from multi-slot (the stale-teachingStatus edge case) still only merges its IC once, even though unitSetSingleOccurrenceTaught internally calls unitToggleOccurrenceTaught to reconcile the slot flag', () => {
  resetState();
  seedDlFixture();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'ul_1').linkedICIds = ['ic_a'];
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon');
  sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'wed');
  sandbox.unitToggleOccurrenceTaught('ul_1', WEEK_A, 'mon'); // mark Monday taught
  sandbox.closeDlModal(); // that toggle already launched the wizard — close it so the reaffirm below launches fresh
  sandbox.plannerUnscheduleSlot('ul_1', WEEK_A, 'wed'); // remove the untaught Wednesday slot — now single-slot, teachingStatus stale
  assert.strictEqual(lessonById('ul_1').scheduledSlots.length, 1, 'sanity: down to one slot');
  assert.strictEqual(lessonById('ul_1').scheduledSlots[0].taught, true, 'sanity: the surviving slot is already individually flagged taught (the Codex-review edge case)');

  // Re-affirming taught via the single-occurrence checkbox path — the internal
  // reconciliation branch inside unitSetSingleOccurrenceTaught will find the slot
  // flag already matches (true === true) and skip calling unitToggleOccurrenceTaught
  // at all, so there is only ever one trigger here regardless.
  sandbox.unitSetSingleOccurrenceTaught('ul_1', WEEK_A, 'mon', true);
  const dl = getDlState();
  assert.strictEqual(dl.isOpen, true);
  eqJson(dl.selectedICs, ['ic_a'], 'the IC must be present exactly once, not duplicated by a double trigger');
});

test('setting teachingStatus via the drawer\'s manual dropdown (unitSetLessonTeachingStatus, no weekKey/dayKey context) does NOT trigger the wizard — only the checkbox paths that carry a specific occurrence do', () => {
  resetState();
  seedDlFixture();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'ul_1').linkedICIds = ['ic_a'];
  st.plannerUi.selectedLessonId = 'ul_1';
  sandbox.unitSetLessonTeachingStatus('taught');
  assert.strictEqual(lessonById('ul_1').teachingStatus, 'taught', 'sanity: the dropdown itself is completely unaffected');
  assert.strictEqual(getDlState().isOpen, false, 'the manual drawer dropdown is a deliberately different, more deliberate editing action than the checkbox and is out of scope for phase 1\'s auto-launch');
});

test('dlDeriveCodeLessonIds attributes each code to the first IC (in sessionICs order) that traces to a lesson, and leaves an unattributed/manually-added code untagged', () => {
  resetState();
  seedDlFixture();
  // ic_a -> CODE_A (from ul_1), ic_b -> CODE_B (from ul_2), ic_shared -> CODE_SHARED
  // (from ul_1) plus a manually-picked code with no IC at all.
  const map = sandbox.dlDeriveCodeLessonIds(['ic_a', 'ic_b', 'ic_shared'], { ic_a: 'ul_1', ic_b: 'ul_2', ic_shared: 'ul_1' });
  eqJson(map, { CODE_A: 'ul_1', CODE_B: 'ul_2', CODE_SHARED: 'ul_1' });
});

test('dlDeriveCodeLessonIds resolves a code shared by ICs from two different lessons to whichever IC appears first in sessionICs, and ignores an IC with no lesson attribution at all', () => {
  resetState();
  seedDlFixture();
  const st = getState();
  // A second IC that homes to the SAME code as ic_shared, but (hypothetically) came
  // from a different lesson.
  st.instructionalComponents.push({ id: 'ic_shared_b', homeDescriptorId: 'CODE_SHARED', name: 'IC Shared B', linkedDescriptorIds: [] });

  const map = sandbox.dlDeriveCodeLessonIds(['ic_shared', 'ic_shared_b'], { ic_shared: 'ul_1', ic_shared_b: 'ul_2' });
  assert.strictEqual(map.CODE_SHARED, 'ul_1', 'first IC in the given order wins the attribution for a code shared across lessons');

  const mapNoAttribution = sandbox.dlDeriveCodeLessonIds(['ic_a'], {}); // ic_a picked by hand, never merged via a lesson
  eqJson(mapNoAttribution, {}, 'an IC with no icLessonMap entry contributes no attribution at all — its code stays untagged');
});

test('the full render pipeline does not throw when the Daily Log Wizard is launched or merged into from a Week Board checkbox click', () => {
  resetState();
  seedDlFixture();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'sa_1').linkedICIds = ['ic_a'];
  st.lessonPlans.find(l => l.id === 'ul_1').linkedICIds = ['ic_b'];
  assert.doesNotThrow(() => sandbox.plannerSetLessonStatus('taught', 'sa_1'), 'launching from a standalone card');
  assert.doesNotThrow(() => sandbox.plannerScheduleUnitLesson('ul_1', WEEK_A, 'mon'), 'scheduling a second lesson');
  assert.doesNotThrow(() => sandbox.unitSetSingleOccurrenceTaught('ul_1', WEEK_A, 'mon', true), 'merging a second lesson into the still-open session');
  assert.doesNotThrow(() => realRenderView(), 'the main week board itself must still render cleanly with the wizard open behind it');
});

// ── Review fixes: the drawer's own "Mark as taught" button must stay unaffected, ──
// ── stale IC-lesson attribution after a deselect/re-add, and a save-in-flight ─────
// ── must not be corrupted by a different session opening mid-save ────────────────
test('the Lesson Drawer\'s own "Mark as taught" button (plannerSetLessonStatus with no lessonId) does NOT trigger the wizard — only an explicit lessonId, the Week Board checkbox\'s own call pattern, does', () => {
  resetState();
  seedDlFixture();
  const st = getState();
  st.lessonPlans.find(l => l.id === 'sa_1').linkedICIds = ['ic_a'];
  st.plannerUi.selectedLessonId = 'sa_1';
  sandbox.plannerSetLessonStatus('taught'); // the drawer button's exact call pattern — no lessonId
  assert.strictEqual(lessonById('sa_1').status, 'taught', 'sanity: the drawer button itself is completely unaffected');
  assert.strictEqual(getDlState().isOpen, false, 'the drawer\'s own Mark as taught button must not launch the wizard — it is a separate, more deliberate editing action than the Week Board checkbox, out of phase 1 scope');
});

test('deselecting an IC in the wizard (dlAddAISuggestedIC) clears its lesson attribution, so a later Week Board merge correctly re-attributes it to whichever lesson actually re-added it, not the stale original', () => {
  resetState();
  seedDlFixture();
  sandbox.dlLaunchOrMergeForLesson({ id: 'ul_1', linkedICIds: ['ic_a'] }, WEEK_A, 'mon');
  assert.strictEqual(getDlState().icLessonMap.ic_a, 'ul_1', 'sanity: attributed to the first lesson');

  sandbox.dlAddAISuggestedIC('ic_a'); // teacher manually deselects it in the wizard's own step 2 UI
  assert.ok(!getDlState().selectedICs.includes('ic_a'), 'sanity: deselected');
  assert.strictEqual(getDlState().icLessonMap.ic_a, undefined, 'the stale attribution must be cleared along with the deselection');

  sandbox.dlLaunchOrMergeForLesson({ id: 'ul_2', linkedICIds: ['ic_a'] }, WEEK_A, 'wed'); // a different lesson re-adds the same IC
  const dl = getDlState();
  assert.ok(dl.selectedICs.includes('ic_a'), 'sanity: re-selected');
  assert.strictEqual(dl.icLessonMap.ic_a, 'ul_2', 'must now be attributed to the lesson that actually caused this re-selection, not the original (now-unrelated) ul_1');
});

test('saveDailyLog snapshots dlState.date/dlState.masteryMap into local variables before any await, rather than reading them live afterward — fixes a review finding where an in-flight save could be silently corrupted by a different session opening mid-save (e.g. checking another lesson\'s Week Board checkbox, which now reassigns dlState via openDailyLogWizard)', () => {
  const appJsSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(/const sessionDate = dlState\.date;/.test(appJsSrc), 'dlState.date must be captured into a local snapshot up front');
  assert.ok(/const masteryMapSnapshot = Object\.assign\(\{\}, dlState\.masteryMap\);/.test(appJsSrc), 'dlState.masteryMap must be captured into a local snapshot up front');
  // These are the exact live-read patterns the bug consisted of — confirming none of
  // them remain (only the frozen-snapshot equivalents do) guards against the fix
  // silently regressing back to a live read.
  assert.ok(!/date:\s*dlState\.date\b/.test(appJsSrc), 'no entry-building code should read dlState.date live anymore');
  assert.ok(!/date_assessed:\s*dlState\.date\b/.test(appJsSrc), 'the saveProgress call must not read dlState.date live anymore');
  assert.ok(!/Object\.entries\(dlState\.masteryMap\)/.test(appJsSrc), 'the mastery-entries loop must not read dlState.masteryMap live anymore');
});

// ── Jargon glossary tooltips (IC/CD/confidence/slot/teaching status) ──────────────
console.log('Jargon glossary tooltips');

test('glossaryTitle looks up PLANNER_GLOSSARY/PLANNER_CONFIDENCE_GLOSSARY/PLANNER_STATUS_GLOSSARY by key, HTML-escapes the result, and returns \'\' (not a throw) for an unknown key', () => {
  assert.strictEqual(sandbox.glossaryTitle(GLOSSARY.PLANNER_GLOSSARY, 'ic'), GLOSSARY.PLANNER_GLOSSARY.ic, 'a known key returns its exact glossary text (no HTML-significant chars in this one to escape)');
  assert.strictEqual(sandbox.glossaryTitle(GLOSSARY.PLANNER_GLOSSARY, 'nonexistent-term'), '', 'an unknown key must return empty string, not undefined or throw, so a typo can never break a render');
  assert.strictEqual(sandbox.glossaryTitle(GLOSSARY.PLANNER_STATUS_GLOSSARY, 'reteach'), GLOSSARY.PLANNER_STATUS_GLOSSARY.reteach);
});

test('the rail lesson pill carries IC and slot glossary tooltips', () => {
  resetState();
  const html = sandbox.plannerUnitSidebarLessonHtml(lessonById('ul_1'));
  assert.ok(html.includes(sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.ic)), 'the IC count must carry the IC glossary tooltip');
  assert.ok(html.includes(sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.slot)), 'the slot count badge must carry the slot glossary tooltip');
});

test('the standalone lesson drawer (edit mode) carries the IC glossary tooltip on its "Instructional Components" label, and on the "No ICs linked yet" empty state', () => {
  resetState();
  const lesson = lessonById('sa_1');
  const html = sandbox.plannerStandaloneLessonEditHtml(lesson, [{ key: 'mon', label: 'Monday' }]);
  assert.ok(html.includes(`title="${sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.ic)}">Instructional Components`), 'the IC section label must carry the IC glossary tooltip');
  assert.ok(html.includes(sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.ic)) && html.includes('No ICs linked yet'), 'the "no ICs linked" empty state must also carry the IC tooltip (sa_1 has none by default)');
});

test('the unit lesson drawer (edit mode) carries IC and CD glossary tooltips, and its Teaching status dropdown options each carry their own status tooltip', () => {
  resetState();
  const html = sandbox.plannerUnitLessonEditHtml(lessonById('ul_1'));
  assert.ok(html.includes(`title="${sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.ic)}">Instructional Components`), 'the IC section label must carry the IC glossary tooltip');
  for (const s of GLOSSARY.UNIT_TEACHING_STATUSES) {
    const expected = `<option value="${s.key}" title="${sandbox.escapeHtml(GLOSSARY.PLANNER_STATUS_GLOSSARY[s.key])}"`;
    assert.ok(html.includes(expected), `the "${s.label}" dropdown option must carry its own status glossary tooltip`);
  }
});

test('the unit lesson drawer\'s unit-context CD label carries the CD glossary tooltip (standalone lesson\'s trailing unit-context block)', () => {
  resetState();
  const st = getState();
  // Give ul_1 a unit-context trailer to render by viewing it through the standalone
  // helper path that renders unit context (plannerSelectedICsViewHtml's sibling) —
  // simplest is to check unitLessonRowHtml/edit drawer directly, both of which render
  // the "Linked curriculum descriptors" label via the shared unit-context markup.
  const html = sandbox.plannerUnitLessonEditHtml(lessonById('ul_1'));
  assert.ok(html.includes(`title="${sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.cd)}">Linked curriculum descriptors`), 'the CD label must carry the CD glossary tooltip');
});

test('the Unit Plans lesson-list row carries IC and slot glossary tooltips on its chips, and a status-glossary tooltip on its status badge', () => {
  resetState();
  const st = getState();
  const unit = st.unitPlans.find(u => u.id === 'unit_1');
  const html = sandbox.unitLessonRowHtml(unit, lessonById('ul_1'));
  assert.ok(html.includes(`title="${sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.ic)}">`), 'the IC chip must carry the IC glossary tooltip');
  assert.ok(html.includes(sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.slot)), 'the slot chip must carry the slot glossary tooltip');
  assert.ok(html.includes(sandbox.escapeHtml(GLOSSARY.PLANNER_STATUS_GLOSSARY.planned)), 'ul_1 defaults to "planned", so its status badge must carry the Planned status tooltip');
});

test('unitTeachingStatusBadgeHtml/unitLessonStatusBadgeHtml attach the correct PLANNER_STATUS_GLOSSARY entry for every one of the 5 teaching statuses, not just the default', () => {
  for (const s of GLOSSARY.UNIT_TEACHING_STATUSES) {
    const html = sandbox.unitTeachingStatusBadgeHtml(s.key);
    assert.ok(html.includes(`is-${s.key}" title="${sandbox.escapeHtml(GLOSSARY.PLANNER_STATUS_GLOSSARY[s.key])}"`), `the "${s.label}" badge must carry its own status glossary tooltip, not another status's or none at all`);
  }
});

test('the standalone Week Board card\'s simplified Planned/Taught pill, and its "Needs IC" incomplete pill, carry glossary tooltips', () => {
  resetState();
  const st = getState();
  const lesson = lessonById('sa_1'); // standalone, weekKey=WEEK_A, no linked ICs -> incomplete
  st.plannerUi.weekKey = WEEK_A;
  realRenderView();
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes(`title="${sandbox.escapeHtml(GLOSSARY.PLANNER_STATUS_GLOSSARY.planned)}">Planned`), 'an unTaught standalone card must show the Planned status tooltip');
  assert.ok(html.includes(`title="${sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.ic)}">Needs IC`), 'a card with no linked ICs must show the "Needs IC" pill with the IC glossary tooltip (sa_1 has none)');
});

test('the confidence tier badge (Strong/Partial/Weak) carries the matching PLANNER_CONFIDENCE_GLOSSARY entry, not a mismatched or missing one', () => {
  resetState();
  const st = getState();
  st.instructionalComponents = [
    { id: 'ic_1', name: 'Strong-match IC', homeDescriptorId: 'CD_1', active: true },
    { id: 'ic_2', name: 'Weak-match IC', homeDescriptorId: 'CD_1', active: true },
  ];
  const lesson = lessonById('ul_1');
  lesson.linkedICIds = ['ic_1', 'ic_2'];
  st.plannerUi.suggestionScores = { ic_1: 10, ic_2: 1 };
  const html = sandbox.plannerSelectedICsViewHtml(lesson);
  assert.ok(html.includes(`is-strong" title="${sandbox.escapeHtml(GLOSSARY.PLANNER_CONFIDENCE_GLOSSARY.strong)}"`), 'the higher-scored IC must show the Strong confidence tooltip');
  assert.ok(html.includes(`is-weak" title="${sandbox.escapeHtml(GLOSSARY.PLANNER_CONFIDENCE_GLOSSARY.weak)}"`) || html.includes(`is-partial" title="${sandbox.escapeHtml(GLOSSARY.PLANNER_CONFIDENCE_GLOSSARY.partial)}"`), 'the much-lower-scored IC must show a Partial or Weak confidence tooltip, matching its own actual tier — never the Strong one');
});

test('the Planned status glossary text does not claim a lesson has been scheduled onto a day — teachingStatus and scheduledSlots are independent, so a Planned lesson with 0 slots would otherwise be told "Scheduled to teach" right next to a "0 slots"/"Not scheduled" indicator (review finding)', () => {
  const planned = GLOSSARY.PLANNER_STATUS_GLOSSARY.planned;
  assert.ok(!/\bScheduled\b/.test(planned), 'must not assert scheduling has happened just because the status is "Planned"');
  assert.ok(/independent of scheduling/i.test(planned), 'should make the independence from scheduledSlots explicit, since that\'s exactly the confusing juxtaposition the review flagged');
});

test('both view-mode drawers\' "Instructional Components" heading carries the IC glossary tooltip even for a POPULATED lesson (not just the empty-state branch) — the read-only view is the default first screen for any existing lesson with content, so it must have an IC hover target regardless of whether ICs are already linked (review finding)', () => {
  resetState();
  const st = getState();
  st.instructionalComponents = [{ id: 'ic_1', name: 'A linked IC', homeDescriptorId: 'CD_1', active: true }];

  const standaloneLesson = lessonById('sa_1');
  standaloneLesson.linkedICIds = ['ic_1']; // populated — the empty-state branch must NOT be what's covering this
  const standaloneHtml = sandbox.plannerStandaloneLessonViewHtml(standaloneLesson, [{ key: 'mon', label: 'Monday' }]);
  assert.ok(standaloneHtml.includes(`title="${sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.ic)}">Instructional Components<`), 'the standalone lesson\'s view-mode IC heading must carry the tooltip');

  const unitLesson = lessonById('ul_1');
  unitLesson.linkedICIds = ['ic_1'];
  const unitHtml = sandbox.unitLessonViewHtml(unitLesson);
  assert.ok(unitHtml.includes(`title="${sandbox.escapeHtml(GLOSSARY.PLANNER_GLOSSARY.ic)}">Instructional Components<`), 'the unit lesson\'s view-mode IC heading must carry the tooltip');
});

test('the per-student IC outcome badge (got_it/taught/needs_review — a DIFFERENT concept from the lesson-level teaching status) is deliberately left untouched by the teaching-status glossary, so it never shows a misleading "students need more practice" tooltip for what is actually a student mastery signal', () => {
  // This documents a scope boundary, not a bug: renderICStudentChips' "Needs review"
  // bucket is a per-student-per-IC outcome (from the Daily Wizard's IC scan step),
  // unrelated to unitLessonStatusBadgeHtml's lesson-level "Needs review" teaching
  // status, even though they share the same words. Wiring the lesson-level glossary
  // text onto the student-outcome badge would be actively wrong, not just unhelpful.
  const appJsSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const bucketsBlock = appJsSrc.match(/const buckets = \[[\s\S]*?\];/);
  assert.ok(bucketsBlock, 'sanity: the per-student status bucket definitions must still exist');
  assert.ok(!bucketsBlock[0].includes('PLANNER_STATUS_GLOSSARY'), 'the per-student outcome buckets must not reference the lesson-level status glossary');
});

// ── Unit lessons rail: caret + drag discoverability ────────────────────────────────
console.log('Rail caret/drag affordance');

test('.planner-unit-group-toggle (the collapse caret) reads as a small icon-button at rest, not just on hover — same "background/border one step stronger than blend-in" language as .planner-panel-collapse-toggle', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const rule = css.match(/\.planner-unit-group-toggle\s*\{[^}]*\}/)[0];
  assert.ok(/border:\s*1px solid var\(--border2\)/.test(rule), 'must have a visible border at rest, not just on hover');
  assert.ok(/background:\s*var\(--surface-alt\)/.test(rule), 'must have a background tint at rest, not just on hover');
  assert.ok(/border-radius/.test(rule), 'must be a rounded box, matching the icon-button convention elsewhere in the rail');
});

test('the caret box strengthens further on hover of its heading (not just the row text darkening), and dims when the heading is disabled (filter-forced-open state)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.ok(/\.planner-unit-group-head:hover:not\(:disabled\)\s+\.planner-unit-group-toggle\s*\{[^}]*background:\s*var\(--status-info-bg\)/.test(css), 'hovering the heading must also strengthen the caret box itself, not just the text colour');
  assert.ok(/\.planner-unit-group-head:disabled\s+\.planner-unit-group-toggle\s*\{[^}]*opacity/.test(css), 'the caret box must visibly dim when its heading is disabled, so it does not look interactive while a filter is forcing the group open');
});

test('.planner-unit-pill gets the same grab->grabbing active-state cursor swap on drag start that .planner-lesson-card already has — this rail card was missing it', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.ok(/\.planner-unit-pill:active\s*\{[^}]*cursor:\s*grabbing/.test(css), 'the rail pill must switch to a grabbing cursor once a drag actually starts, matching the Week Board card convention');
});

test('the drag-handle icon (.planner-unit-drag) darkens along with the rest of the card on hover, reinforcing which part of the card is the actual grab point', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.ok(/\.planner-unit-pill:hover\s+\.planner-unit-drag\s*\{[^}]*color:\s*var\(--status-info-text\)/.test(css), 'the drag handle must darken on card hover, not stay a flat muted colour throughout');
});

test('both affordance fixes are scoped to the rail — the Week Board day cards\' own drag/collapse behaviour and CSS classes are untouched', () => {
  resetState();
  const beforeLessons = JSON.stringify(getState().lessonPlans);
  const beforeUnits = JSON.stringify(getState().unitPlans);
  realRenderView(); // must not throw with the new caret/pill markup+CSS in place
  assert.strictEqual(JSON.stringify(getState().lessonPlans), beforeLessons, 'a pure CSS/markup affordance change must never touch lesson data');
  assert.strictEqual(JSON.stringify(getState().unitPlans), beforeUnits, 'a pure CSS/markup affordance change must never touch unit data');
  const html = documentStub.getElementById('main-content').innerHTML;
  assert.ok(html.includes('planner-lesson-card'), 'the Week Board day cards must still render, confirming the rail-scoped CSS changes did not break the shared render pipeline');
});

// ── TEST MODE (safe sandboxed exploration against real data) ───────────────────────
console.log('Test Mode: safe sandboxed exploration');

// The sample/synthetic data fixture — loaded before app.js in every test-mode
// sandbox below, exactly mirroring index.html's own <script> order (the fixture
// script, then app.js). Harmless to load even when a given sandbox isn't in sample
// mode — it just sets one inert global (window.CT_SAMPLE_TEST_MODE_DATA) that
// SAMPLE_DATA_ACTIVE-gated code in app.js never reads unless sampleData=1.
const sampleDataFixtureSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'sample-test-mode-data.js'), 'utf8');

// TEST_MODE_ACTIVE is (by design, for safety — see app.js's own comment on it) a
// `const` baked in from location.search at the moment app.js is evaluated, not a
// live-toggleable flag — exercising it faithfully requires a SEPARATE vm evaluation of
// app.js with a different location.search already set before evaluation, mirroring
// exactly how a real browser only ever reads the URL once at page load. This is more
// faithful to reality than trying to flip a boolean mid-test would be.
//
// Also, unlike the shared harness above (which models `window` as a plain object
// distinct from the vm's own global object — fine there, since none of the other 271
// tests ever reassign a `window.X` property and expect the bare `X` identifier
// elsewhere in app.js to reflect it), this sandbox aliases `window` to itself
// (`sandbox.window = sandbox`), matching a real browser where `window === globalThis`.
// That equivalence is exactly what makes app.js's own
// `Object.defineProperty(window, 'localStorage', {...})` correctly protect every OTHER
// bare `localStorage.getItem(...)` call elsewhere in the file — they all resolve
// through the same single global binding, not two separate ones.
function makeTestModeSandbox(opts = {}) {
  const locationSearch = opts.locationSearch !== undefined ? opts.locationSearch : '?testMode=1';
  const fetchCalls = [];

  function tmMakeStubEl() {
    const attrs = {};
    return {
      style: {}, className: '', id: '', innerHTML: '', textContent: '', value: '',
      dataset: {}, scrollTop: 0, firstChild: null, offsetHeight: 32,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      appendChild() {}, removeChild() {}, remove() {}, insertBefore() {},
      // Actually tracked (unlike the shared harness's version above, which none of the
      // other 271 tests need attribute round-tripping for) — the banner test below
      // needs to read back role="alert" set via setAttribute.
      setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; }, removeAttribute(k) { delete attrs[k]; },
      addEventListener() {}, removeEventListener() {}, focus() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      closest() { return null; }, getBoundingClientRect() { return {}; },
    };
  }
  const tmElCache = {};
  const bodyChildren = [];
  const tmBody = tmMakeStubEl();
  tmBody.appendChild = (node) => { bodyChildren.push(node); };
  const tmDocumentStub = {
    addEventListener() {}, removeEventListener() {},
    getElementById(id) { return tmElCache[id] || (tmElCache[id] = tmMakeStubEl()); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return tmMakeStubEl(); },
    body: tmBody,
    documentElement: tmMakeStubEl(),
  };

  // A real Storage-shaped stub (getItem/setItem/removeItem/clear AND length/key(i)) —
  // app.js's shim-install loop uses all of these, matching the real Web Storage API
  // that a browser's actual `Storage` object implements (confirmed live against a real
  // browser via Playwright + a CDP-level read of the real store during development —
  // see the PR description). The shared harness's simpler localStorageStub above
  // doesn't need length/key(i) since none of the other 271 tests touch them.
  const backing = Object.assign({}, opts.initialStore || {});
  const realLocalStorageStub = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(backing, k) ? backing[k] : null; },
    setItem(k, v) { backing[k] = String(v); },
    removeItem(k) { delete backing[k]; },
    clear() { Object.keys(backing).forEach(k => delete backing[k]); },
    key(i) { return Object.keys(backing)[i] || null; },
    get length() { return Object.keys(backing).length; },
  };

  const tmSandbox = {
    console,
    document: tmDocumentStub,
    localStorage: realLocalStorageStub,
    navigator: { userAgent: 'node-test' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    // opts.fetchImpl lets a test supply a real (resolving) fetch mock — the default
    // never-resolving stub is fine for every other test here, which only cares whether
    // fetch was CALLED, never about what a response would do next.
    fetch: (url, options) => {
      fetchCalls.push({ url, options });
      return opts.fetchImpl ? opts.fetchImpl(url, options) : new Promise(() => {});
    },
    alert() {}, confirm() { return true; }, prompt() { return null; },
    CSS: { escape: (s) => String(s) },
    Date, Math, JSON, URLSearchParams,
  };
  // opts.noLocation simulates some bizarre environment where window.location itself is
  // absent (not just an unexpected value on it) — window.location.search then throws a
  // TypeError reading .search off undefined, a different failure shape than a wrong
  // string value, and the entry check's try/catch needs to survive that too.
  if (!opts.noLocation) {
    tmSandbox.location = { href: 'http://localhost/index.html' + locationSearch, search: locationSearch, hash: '' };
  }
  // Self-alias, matching window === globalThis in a real browser — see comment above.
  tmSandbox.window = tmSandbox;
  tmSandbox.globalThis = tmSandbox;

  if (opts.forceShimFailure) {
    // A non-configurable localStorage property makes app.js's own
    // Object.defineProperty(window, 'localStorage', {...}) throw — simulating a
    // browser that refuses to let the shim install, to verify the fail-closed
    // "refuse to run rather than silently degrade to unprotected real writes" path.
    Object.defineProperty(tmSandbox, 'localStorage', {
      value: realLocalStorageStub, writable: false, configurable: false,
    });
  }

  vm.createContext(tmSandbox);
  // Loaded before app.js in every sandbox this factory creates, exactly mirroring
  // index.html's own <script> order — see sampleDataFixtureSrc's own comment. This
  // itself can't throw (a plain IIFE assigning one global), so it's run unconditionally,
  // outside the forceShimFailure try/catch below.
  vm.runInContext(sampleDataFixtureSrc, tmSandbox, { filename: 'data/sample-test-mode-data.js (test-mode sandbox)' });
  // When the shim install fails (forceShimFailure), app.js's own top-level code throws
  // deliberately (see its own comment on why) — an uncaught throw during top-level
  // script evaluation propagates straight out of vm.runInContext itself, so this must
  // be caught HERE rather than left to the caller: every other test relies on this
  // factory returning normally, and the one test that deliberately forces this failure
  // needs to inspect what happened (the error, and whatever DID get set on the DOM
  // stub) rather than a bare exception with no sandbox state attached.
  let evalError = null;
  try {
    vm.runInContext(
      appSrc +
      '\n;globalThis.__tmGetTestModeActive = function(){ return typeof TEST_MODE_ACTIVE !== "undefined" ? TEST_MODE_ACTIVE : undefined; };\n' +
      ';globalThis.__tmGetSampleDataActive = function(){ return typeof SAMPLE_DATA_ACTIVE !== "undefined" ? SAMPLE_DATA_ACTIVE : undefined; };\n' +
      ';globalThis.__tmApiCall = function(action, data, opts){ return apiCall(action, data, opts); };\n' +
      // apiCall() is `async function`, so every call returns a Promise even down the
      // synchronous test-mode mock branch — this exposer reaches the pure, synchronous
      // helper apiCall() itself delegates to, so tests can inspect the mock's exact shape
      // without fighting Promise-resolution timing in a test harness that doesn't await.
      ';globalThis.__tmMockResult = function(action, data){ return testModeMockApiResult(action, data); };\n' +
      ';globalThis.__tmSampleMockResult = function(action, data){ return sampleDataMockApiResult(action, data); };\n' +
      ';globalThis.__tmSaveStubIC = function(){ return typeof saveStubIC === "function" ? saveStubIC : undefined; };\n' +
      ';globalThis.__tmPromoteStubIC = function(){ return typeof promoteStubIC === "function" ? promoteStubIC : undefined; };\n' +
      ';globalThis.__tmDeleteStubIC = function(){ return typeof deleteStubIC === "function" ? deleteStubIC : undefined; };\n' +
      ';globalThis.__tmLoadStubICsFromSheets = function(){ return typeof loadStubICsFromSheets === "function" ? loadStubICsFromSheets : undefined; };\n' +
      ';globalThis.__tmFetchICsCSVFromGitHub = function(){ return typeof fetchICsCSVFromGitHub === "function" ? fetchICsCSVFromGitHub : undefined; };\n' +
      ';globalThis.__tmSeedSampleDataExtras = function(){ return typeof seedSampleDataExtras === "function" ? seedSampleDataExtras : undefined; };\n' +
      ';globalThis.__tmGetState = function(){ return typeof state !== "undefined" ? state : undefined; };\n',
      tmSandbox,
      { filename: 'app.js (test-mode sandbox)' }
    );
  } catch (e) {
    evalError = e;
  }

  return { sandbox: tmSandbox, fetchCalls, backing, bodyChildren, evalError, documentElement: tmDocumentStub.documentElement };
}

test('the test-mode banner is appended to document.body with the right alert text, and uses the app\'s existing --status-danger-* semantic tokens rather than hardcoded colours (review finding — matches .planner-banner\'s own existing convention in styles.css)', () => {
  const { bodyChildren } = makeTestModeSandbox();
  const banner = bodyChildren.find(el => el && el.id === 'ct-test-mode-banner');
  assert.ok(banner, 'a banner element must be appended to document.body');
  assert.strictEqual(banner.getAttribute('role'), 'alert', 'must be exposed to assistive tech as an alert');
  assert.ok(/TEST MODE/.test(banner.textContent) && /will be saved/i.test(banner.textContent), 'must say plainly that nothing will be saved');
  assert.ok(/var\(--status-danger-bg\)/.test(banner.style.cssText), 'background must use the semantic danger token');
  assert.ok(/var\(--status-danger-text\)/.test(banner.style.cssText), 'text colour must use the semantic danger token');
  assert.ok(!/#[0-9a-fA-F]{3,6}/.test(banner.style.cssText), 'must not contain any hardcoded hex colour');
  assert.ok(!/rgba?\(/.test(banner.style.cssText), 'must not contain any hardcoded rgb/rgba colour');
});

test('TEST_MODE_ACTIVE is true only for the exact string "?testMode=1" — the entry condition is airtight against near-miss values, so a normal session can never accidentally end up in test mode', () => {
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?testMode=1' }).sandbox.__tmGetTestModeActive(), true, 'the documented activation value must work');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '' }).sandbox.__tmGetTestModeActive(), false, 'no query string at all must stay off');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?testMode=true' }).sandbox.__tmGetTestModeActive(), false, '"true" is not "1" — must stay off, no fuzzy truthiness');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?testMode=0' }).sandbox.__tmGetTestModeActive(), false, '"0" must stay off');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?testmode=1' }).sandbox.__tmGetTestModeActive(), false, 'wrong case on the param name must stay off (case-sensitive param name)');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?other=1&testMode=1' }).sandbox.__tmGetTestModeActive(), true, 'must still work combined with an unrelated param');
});

test('the entry check never throws even when window.location itself is entirely absent (reading .search off undefined) — it settles on false (normal mode), never true or an uncaught error, a second fail-closed layer beyond just "wrong value"', () => {
  const { sandbox: tm, evalError } = makeTestModeSandbox({ noLocation: true });
  assert.strictEqual(evalError, null, 'evaluating app.js must not throw just because window.location is missing — the whole app (not just test mode) would fail to boot otherwise');
  assert.strictEqual(tm.__tmGetTestModeActive(), false, 'with no window.location to read from, the entry check must settle on false, never true');
});

test('in test mode, apiCall() never calls fetch for a write action — every write action found in this codebase (audited exhaustively, see PR description) is mocked instead, with the response shape each caller actually reads', () => {
  const { sandbox: tm, fetchCalls } = makeTestModeSandbox();
  assert.strictEqual(tm.__tmGetTestModeActive(), true, 'sanity: this sandbox is actually in test mode');

  const cases = [
    ['addStudent', {}, 'student_id'],
    ['saveProgress', {}, 'progress_id'],
    ['updateProgress', {}, undefined],
    ['saveTaughtIC', {}, 'id'],
    ['updateTaughtIC', {}, undefined],
    ['saveTaughtICs', { entries: [{}, {}] }, 'ids'],
    ['saveTaughtLog', { entries: [{}] }, 'ids'],
    ['saveStandardsJudgment', {}, 'judgment_id'],
    ['updateStandardsJudgment', {}, undefined],
    ['saveProgressionPlacement', {}, 'placement_id'],
    ['updateProgressionPlacement', {}, undefined],
    ['driveBackupSave', {}, undefined],
    ['someFutureWriteActionNobodyHasAddedYet', {}, undefined],
  ];
  for (const [action, data, idField] of cases) {
    const before = fetchCalls.length;
    tm.__tmApiCall(action, data, {}); // fire-and-forget: apiCall() is async, but the
    // test-mode branch returns synchronously before ever reaching `await fetch(...)`,
    // so fetch-avoidance is safe to assert on immediately without awaiting the Promise.
    assert.strictEqual(fetchCalls.length, before, `apiCall('${action}') must not call fetch in test mode`);
    // The exact response shape comes from testModeMockApiResult(), the same pure,
    // synchronous helper apiCall()'s test-mode branch returns — inspected directly
    // here rather than by awaiting apiCall()'s own Promise, since this harness's
    // test() runner doesn't await test functions (see __tmMockResult's own comment).
    const mock = tm.__tmMockResult(action, data);
    assert.strictEqual(mock.success, true, `apiCall('${action}')'s mock must report success so the caller's UI flow proceeds normally`);
    if (idField) assert.ok(mock[idField] !== undefined, `apiCall('${action}')'s mock must include a '${idField}' field, since its real caller reads that back into local state`);
  }
  // driveBackupSave's caller specifically checks for the ABSENCE of .error/.skipped to
  // treat a save as successfully synced — confirm the mock doesn't accidentally set them.
  const driveMock = tm.__tmMockResult('driveBackupSave', {});
  assert.strictEqual(driveMock.error, undefined, 'the driveBackupSave mock must not carry an .error field');
  assert.strictEqual(driveMock.skipped, undefined, 'the driveBackupSave mock must not carry a .skipped field');
});

test('in test mode, apiCall() still calls fetch for every known-safe read action — reads are explicitly allowed through to the real backend, per the task spec', () => {
  const { sandbox: tm, fetchCalls } = makeTestModeSandbox();
  const reads = ['getAll', 'getStudents', 'getProgress', 'getTaughtLog', 'getStandardsJudgments', 'getProgressionPlacements', 'getTaughtICs', 'driveBackupLoad', 'claudeSuggest'];
  for (const action of reads) {
    const before = fetchCalls.length;
    tm.__tmApiCall(action, {}, { quiet: true });
    assert.strictEqual(fetchCalls.length, before + 1, `apiCall('${action}') must still hit the real backend in test mode — reads don't risk corruption`);
  }
});

test('in test mode, the three raw-fetch stub-IC functions (saveStubIC/promoteStubIC/deleteStubIC) that bypass apiCall() entirely are independently guarded — a real fetch would otherwise leak through even with apiCall() fully protected', () => {
  const { sandbox: tm, fetchCalls } = makeTestModeSandbox();
  const state = tm.__tmGetState();
  state.instructionalComponents = [{ id: 'ic_stub_1', name: 'Stub', homeDescriptorId: 'CD_1', ownerTier: 'teacher_stub', icReadinessStatus: 'draft' }];

  const before1 = fetchCalls.length;
  tm.__tmPromoteStubIC()('ic_stub_1');
  assert.strictEqual(fetchCalls.length, before1, 'promoteStubIC must not call fetch in test mode');

  const before2 = fetchCalls.length;
  tm.__tmDeleteStubIC()('ic_stub_1');
  assert.strictEqual(fetchCalls.length, before2, 'deleteStubIC must not call fetch in test mode');
});

test('outside test mode (locationSearch without ?testMode=1, using this same dedicated sandbox construction), the three raw-fetch stub-IC functions behave exactly as before — proving the guards are additive, not a behaviour change to the normal path', () => {
  const { sandbox: tm, fetchCalls } = makeTestModeSandbox({ locationSearch: '' });
  assert.strictEqual(tm.__tmGetTestModeActive(), false, 'sanity: this sandbox is NOT in test mode');
  const state = tm.__tmGetState();
  state.instructionalComponents = [{ id: 'ic_stub_1', name: 'Stub', homeDescriptorId: 'CD_1', ownerTier: 'teacher_stub', icReadinessStatus: 'draft' }];
  const before = fetchCalls.length;
  tm.__tmDeleteStubIC()('ic_stub_1');
  assert.ok(fetchCalls.length > before, 'outside test mode, deleteStubIC must still attempt its real fetch exactly as it always has');
});

test('the real localStorage is never mutated during a test-mode session — writes through the plain global `localStorage` identifier (how every other function in app.js references it) land only in an in-memory shadow, verified by peeking at the underlying backing store directly, bypassing whatever `localStorage` binding app.js itself is using', () => {
  const { sandbox: tm, backing } = makeTestModeSandbox({ initialStore: { real_key: 'real_value' } });
  assert.strictEqual(backing.real_key, 'real_value', 'sanity: the pre-existing "real" entry is there before any test-mode writes');

  // Simulate app.js writing during the session via the exact mechanism real callers
  // use — the bare global `localStorage` identifier, not window.localStorage.
  vm.runInContext("localStorage.setItem('written_during_test_mode', 'must_never_reach_real_storage')", tm);
  vm.runInContext("localStorage.removeItem('real_key')", tm); // even a delete of pre-existing data must not reach the real store

  assert.strictEqual(backing.written_during_test_mode, undefined, 'a value written during the test-mode session must never appear in the real backing store');
  assert.strictEqual(backing.real_key, 'real_value', 'a pre-existing real value must survive even an in-session delete untouched');

  // And confirm the shim itself DOES see the write (the session behaves normally from
  // the app's own point of view — this isn't a silent no-op, it's a real in-memory copy).
  const readBack = vm.runInContext("localStorage.getItem('written_during_test_mode')", tm);
  assert.strictEqual(readBack, 'must_never_reach_real_storage', 'the shim itself must still behave like a normal, working localStorage within the session');
});

test('outside test mode, localStorage is completely untouched by any of this — the shim is never installed, so normal sessions read/write the real store exactly as before', () => {
  const { sandbox: tm, backing } = makeTestModeSandbox({ locationSearch: '', initialStore: { real_key: 'real_value' } });
  assert.strictEqual(tm.__tmGetTestModeActive(), false, 'sanity: not in test mode');
  vm.runInContext("localStorage.setItem('normal_write', 'x')", tm);
  assert.strictEqual(backing.normal_write, 'x', 'outside test mode, a write must land directly in the real store — no shim in the way');
});

test('the localStorage shim correctly round-trips a "__proto__" key — a plain {} shadow store would silently swallow this write instead of creating an own property, since obj["__proto__"] = v hits Object.prototype\'s accessor rather than storing data (review finding)', () => {
  const { sandbox: tm } = makeTestModeSandbox();
  vm.runInContext("localStorage.setItem('__proto__', 'a real value')", tm);
  const readBack = vm.runInContext("localStorage.getItem('__proto__')", tm);
  assert.strictEqual(readBack, 'a real value', 'a key literally named "__proto__" must persist and read back exactly like any other key');
  const length = vm.runInContext('localStorage.length', tm);
  assert.strictEqual(length, 1, '__proto__ must actually count as a stored key, not silently vanish');
});

test('the localStorage shim\'s key(i) returns "" (not null) for a stored key that is itself the empty string, matching the real Storage.key(i) contract — null must mean "index out of bounds", nothing else (review finding)', () => {
  const { sandbox: tm } = makeTestModeSandbox();
  vm.runInContext("localStorage.setItem('', 'value for the empty-string key')", tm);
  const key0 = vm.runInContext('localStorage.key(0)', tm);
  assert.strictEqual(key0, '', 'key(i) for an empty-string key must return "", not null — null is reserved for "no key at this index"');
  const outOfBounds = vm.runInContext('localStorage.key(1)', tm);
  assert.strictEqual(outOfBounds, null, 'key(i) for a genuinely out-of-bounds index must still return null');
});

test('if the browser refuses to let the localStorage shim install, test mode refuses to run at all rather than silently falling back to unprotected real writes — the fail-closed path, exercised end to end', () => {
  const { sandbox: tm, fetchCalls, evalError, documentElement } = makeTestModeSandbox({ forceShimFailure: true });

  assert.ok(evalError, 'installing the shim must throw when the browser refuses to let localStorage be redefined, and that throw must propagate out of the whole script evaluation (an uncaught top-level exception), not be swallowed anywhere');

  // The failure happens synchronously at the very top of the script, before
  // TEST_MODE_ACTIVE's own IIFE result would normally be usable for anything further —
  // the exposer helpers below it in the injected tail never get defined at all, since
  // the uncaught throw halts every remaining top-level statement in the script,
  // confirming the app (including init() at the very bottom of the real file) never
  // boots into a state that looks protected but isn't.
  assert.strictEqual(tm.__tmGetTestModeActive, undefined, 'the harness-exposer helpers appended after app.js must never have been defined — the throw must halt the rest of the script, not just log and continue');
  assert.strictEqual(fetchCalls.length, 0, 'nothing should have had the chance to make a real network call either, since nothing after the throw ever runs');

  // Before re-throwing, app.js replaces the page with a blocking error message rather
  // than leaving a blank/broken page with only a console error nobody watching the
  // audit session would necessarily see.
  assert.ok(/Test Mode could not be safely started/.test(documentElement.innerHTML), 'a visible, blocking error message must be shown before the throw — the failure must never be silent or console-only');
  assert.ok(/Refusing to load the app/i.test(documentElement.innerHTML), 'the error message must make clear the app is refusing to load, not just glitching');
});

// ── TEST MODE: sample/synthetic data (?testMode=1&sampleData=1) ────────────────────
console.log('Test Mode: sample/synthetic data');

test('SAMPLE_DATA_ACTIVE is true only for the exact combination testMode=1&sampleData=1 — sampleData alone (without testMode=1) does nothing, since every protection it relies on lives inside the TEST_MODE_ACTIVE block', () => {
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' }).sandbox.__tmGetSampleDataActive(), true, 'the documented activation combination must work');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?sampleData=1&testMode=1' }).sandbox.__tmGetSampleDataActive(), true, 'param order must not matter');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?testMode=1' }).sandbox.__tmGetSampleDataActive(), false, 'testMode alone (regular Test Mode) must not activate sample data');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?sampleData=1' }).sandbox.__tmGetSampleDataActive(), false, 'sampleData alone, without testMode=1, must do nothing at all');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=true' }).sandbox.__tmGetSampleDataActive(), false, '"true" is not "1" — must stay off, no fuzzy truthiness');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=0' }).sandbox.__tmGetSampleDataActive(), false, '"0" must stay off');
  assert.strictEqual(makeTestModeSandbox({ locationSearch: '' }).sandbox.__tmGetSampleDataActive(), false, 'no query string at all must stay off');

  const { sandbox: tm } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  assert.strictEqual(tm.__tmGetTestModeActive(), true, 'sample data mode is still, underneath, ordinary Test Mode — TEST_MODE_ACTIVE must also be true, so it inherits every existing Test Mode protection unchanged');
});

test('the sample-data banner clearly says "sample data" and that nothing will be saved, and deliberately does NOT use regular Test Mode\'s "sandboxed copy of real data" wording — so a sample session can never be mistaken for a real-data one', () => {
  const { bodyChildren } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const banner = bodyChildren.find(el => el && el.id === 'ct-test-mode-banner');
  assert.ok(banner, 'a banner must still be appended in sample data mode');
  assert.ok(/TEST MODE/.test(banner.textContent), 'must still say TEST MODE');
  assert.ok(/sample data/i.test(banner.textContent), 'must explicitly say "sample data"');
  assert.ok(/will be saved/i.test(banner.textContent), 'must still say plainly that nothing will be saved');
  assert.ok(!/sandboxed copy of real data/i.test(banner.textContent), 'must NOT use the regular Test Mode wording that implies real data is involved');
});

test('regular Test Mode\'s banner wording is completely unchanged by adding sample data mode — proving the two entry paths are additive, not a shared/altered banner', () => {
  const { bodyChildren } = makeTestModeSandbox({ locationSearch: '?testMode=1' });
  const banner = bodyChildren.find(el => el && el.id === 'ct-test-mode-banner');
  assert.ok(/sandboxed copy of real data/i.test(banner.textContent), 'the original real-data banner text must be exactly as before');
  assert.ok(!/sample data/i.test(banner.textContent), 'regular Test Mode must never say "sample data"');
});

test('in sample data mode, apiCall() mocks every currently-whitelisted safe read except claudeSuggest from the fixture, never hitting the real backend — this is what makes sample mode safe even for reads, unlike regular Test Mode which still lets reads through', () => {
  const { sandbox: tm, fetchCalls } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const fixtureReads = ['getAll', 'getStudents', 'getProgress', 'getTaughtLog', 'getStandardsJudgments', 'getProgressionPlacements', 'getTaughtICs', 'driveBackupLoad'];
  for (const action of fixtureReads) {
    const before = fetchCalls.length;
    tm.__tmApiCall(action, {}, { quiet: true });
    assert.strictEqual(fetchCalls.length, before, `apiCall('${action}') must not call fetch in sample data mode`);
  }
  const beforeWrite = fetchCalls.length;
  tm.__tmApiCall('addStudent', {}, {});
  assert.strictEqual(fetchCalls.length, beforeWrite, 'a write action must still be mocked (via the existing testModeMockApiResult path), not call fetch either');

  const beforeAI = fetchCalls.length;
  tm.__tmApiCall('claudeSuggest', {}, { quiet: true });
  assert.strictEqual(fetchCalls.length, beforeAI + 1, 'claudeSuggest must stay live even in sample data mode — it only queries the AI, no app data');
});

test('regular Test Mode (no sampleData) is completely unaffected by adding the sample-data interception — the same safe reads still hit the real backend exactly as before', () => {
  const { sandbox: tm, fetchCalls } = makeTestModeSandbox({ locationSearch: '?testMode=1' });
  const before = fetchCalls.length;
  tm.__tmApiCall('getAll', {}, { quiet: true });
  assert.strictEqual(fetchCalls.length, before + 1, 'getAll must still hit the real backend in regular Test Mode — only sample data mode mocks it');
});

test('sampleDataMockApiResult(\'getAll\') returns the raw row-array shape loadAll() expects (header row + one row per fixture record) for every table, matching the fixture\'s exact counts and field order', () => {
  const { sandbox: tm } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const fixture = tm.CT_SAMPLE_TEST_MODE_DATA;
  const result = tm.__tmSampleMockResult('getAll', null);
  assert.strictEqual(result.students.length, fixture.students.length + 1, 'students must be header + one row per fixture student');
  assert.strictEqual(result.progress.length, fixture.progress.length + 1);
  assert.strictEqual(result.taughtLog.length, fixture.taughtLog.length + 1);
  assert.strictEqual(result.taughtICs.length, fixture.taughtICs.length + 1);
  assert.strictEqual(result.standardsJudgments.length, fixture.standardsJudgments.length + 1);
  assert.strictEqual(result.progressionPlacements.length, fixture.progressionPlacements.length + 1);
  // Spot-check row shape against what loadAll() actually reads (r[0]=id, r[1]=first_name, ...).
  const firstStudentRow = result.students[1];
  assert.strictEqual(firstStudentRow[0], fixture.students[0].id);
  assert.strictEqual(firstStudentRow[1], fixture.students[0].first_name);
  assert.strictEqual(firstStudentRow[3], fixture.students[0].year_level);
});

test('sampleDataMockApiResult returns the same row arrays directly (not wrapped) for the individual getStudents/getProgress/etc actions — the init() fallback path used if getAll were ever unavailable — and driveBackupLoad reports no backup data so no restore banner ever appears', () => {
  const { sandbox: tm } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const studentsRows = tm.__tmSampleMockResult('getStudents', null);
  assert.ok(Array.isArray(studentsRows) && studentsRows.length > 1, 'getStudents must return a row array directly, not wrapped in an object');
  const driveResult = tm.__tmSampleMockResult('driveBackupLoad', null);
  assert.strictEqual(driveResult.data, null, 'driveBackupLoad must report no backup data in sample mode, so driveBackupCheckOnLoad never shows a restore banner');
});

test('loadStubICsFromSheets is skipped entirely in sample data mode (its own draft stub IC comes from the fixture instead) but still hits the real backend in regular Test Mode, unchanged', () => {
  const sample = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const beforeSample = sample.fetchCalls.length;
  sample.sandbox.__tmLoadStubICsFromSheets()();
  assert.strictEqual(sample.fetchCalls.length, beforeSample, 'loadStubICsFromSheets must not call fetch in sample data mode');

  const regular = makeTestModeSandbox({ locationSearch: '?testMode=1' });
  const beforeRegular = regular.fetchCalls.length;
  regular.sandbox.__tmLoadStubICsFromSheets()();
  assert.strictEqual(regular.fetchCalls.length, beforeRegular + 1, 'loadStubICsFromSheets must still call fetch in regular Test Mode — this guard is additive, not a behaviour change to the existing safe-read path');
});

test('fetchICsCSVFromGitHub no-ops in sample data mode (skips the real ics_*.csv fetches, whose ids are unstable for most subjects) but still fetches normally in regular Test Mode and outside Test Mode entirely', () => {
  const sample = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const beforeSample = sample.fetchCalls.length;
  sample.sandbox.__tmFetchICsCSVFromGitHub()('ics_year2_maths_number');
  assert.strictEqual(sample.fetchCalls.length, beforeSample, 'must not call fetch in sample data mode');

  const regular = makeTestModeSandbox({ locationSearch: '?testMode=1' });
  const beforeRegular = regular.fetchCalls.length;
  regular.sandbox.__tmFetchICsCSVFromGitHub()('ics_year2_maths_number');
  assert.strictEqual(regular.fetchCalls.length, beforeRegular + 1, 'must still call fetch in regular Test Mode');

  const normal = makeTestModeSandbox({ locationSearch: '' });
  const beforeNormal = normal.fetchCalls.length;
  normal.sandbox.__tmFetchICsCSVFromGitHub()('ics_year2_maths_number');
  assert.strictEqual(normal.fetchCalls.length, beforeNormal + 1, 'must still call fetch outside Test Mode entirely — this is a sample-mode-only guard, not a general behaviour change');
});

test('seedSampleDataExtras() populates state.instructionalComponents from the fixture (including its one draft/stub IC) and appends the fixture\'s extra achievement standard onto whatever was already loaded, only in sample data mode', () => {
  const { sandbox: tm } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const state = tm.__tmGetState();
  state.standards = [{ 'Achievement Standard ID': 'Y4-AS-01', 'Subject': 'Maths' }]; // simulate the real auto-loaded Maths-only standards CSV
  assert.strictEqual(state.instructionalComponents.length, 0, 'sanity: nothing seeded yet');
  tm.__tmSeedSampleDataExtras()();
  const fixture = tm.CT_SAMPLE_TEST_MODE_DATA;
  assert.strictEqual(state.instructionalComponents.length, fixture.instructionalComponents.length, 'must add exactly the fixture\'s ICs, no more no less');
  assert.strictEqual(tm.getUnresolvedStubCount(), 1, 'the fixture\'s one draft/stub IC must be counted by the existing, unmodified stub-review banner logic');
  assert.strictEqual(state.standards.length, 2, 'must append the fixture\'s one extra standard onto whatever was already auto-loaded, not replace it');
  assert.ok(state.standards.some(s => s['Achievement Standard ID'] === 'Year4-AS-8934'), 'the appended English standard must be present');
  assert.ok(state.standards.some(s => s['Achievement Standard ID'] === 'Y4-AS-01'), 'the pre-existing (real, auto-loaded) Maths standard must still be there — appended to, not replaced');
});

test('seedSampleDataExtras() is a no-op outside sample data mode, in both regular Test Mode and normal mode', () => {
  const regular = makeTestModeSandbox({ locationSearch: '?testMode=1' });
  const rState = regular.sandbox.__tmGetState();
  regular.sandbox.__tmSeedSampleDataExtras()();
  assert.strictEqual(rState.instructionalComponents.length, 0, 'must not seed anything in regular Test Mode');

  const normal = makeTestModeSandbox({ locationSearch: '' });
  const nState = normal.sandbox.__tmGetState();
  normal.sandbox.__tmSeedSampleDataExtras()();
  assert.strictEqual(nState.instructionalComponents.length, 0, 'must not seed anything outside Test Mode entirely');
});

test('the sample dataset fixture itself satisfies every structural requirement from the task brief: multiple year levels, an Arts unit with zero linked CDs (the known-broken CD-linking path, kept live as a regression check), a unit lesson with zero linked ICs, all five teaching statuses, a genuinely mixed multi-occurrence lesson, a lesson with resource links, and exactly one draft/stub IC', () => {
  const { sandbox: tm } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const fixture = tm.CT_SAMPLE_TEST_MODE_DATA;

  const yearLevels = new Set(fixture.students.map(s => s.year_level));
  assert.ok(yearLevels.size >= 2, 'students must span multiple year levels');

  const artsUnit = fixture.units.find(u => u.subject === 'The Arts');
  assert.ok(artsUnit, 'must include a unit in a subject currently known to be broken for CD linking (The Arts/Technologies/Health & PE)');
  assert.strictEqual(artsUnit.linkedCDIds.length, 0, 'the Arts unit must have zero linked CDs, so the broken CD-linking path stays live as a regression check once it\'s fixed');

  const noICLesson = fixture.lessons.find(l => l.linkedICIds.length === 0 && l.unitId);
  assert.ok(noICLesson, 'at least one unit lesson must have zero linked ICs, to show the "needs IC" warning state');

  const statuses = new Set(fixture.lessons.map(l => l.teachingStatus));
  for (const s of ['planned', 'taught', 'partially-taught', 'needs-review', 'reteach']) {
    assert.ok(statuses.has(s), `the fixture must include a lesson with teaching status "${s}"`);
  }

  const multiOccurrence = fixture.lessons.find(l => l.scheduledSlots.length > 1);
  assert.ok(multiOccurrence, 'must include at least one multi-occurrence lesson');
  assert.ok(
    multiOccurrence.scheduledSlots.some(s => s.taught === true) && multiOccurrence.scheduledSlots.some(s => s.taught !== true),
    'the multi-occurrence lesson must have a genuine mix of taught/not-yet-taught occurrences, to exercise the "Taught 1/2" per-occurrence fraction rather than an all-or-nothing case'
  );

  const withResourceLinks = fixture.lessons.find(l => l.resourceLinks.length > 0);
  assert.ok(withResourceLinks, 'must include at least one lesson with resource links populated');

  const draftStubs = fixture.instructionalComponents.filter(ic => ic.ownerTier === 'teacher_stub' && ic.icReadinessStatus === 'draft');
  assert.strictEqual(draftStubs.length, 1, 'must include exactly one draft/stub IC, to exercise the "1 draft IC needs review" banner without ambiguity');
});

test('the fixture\'s mastery-ready gate boundary cases behave exactly as designed when run through the real, unmodified getReadyForMasteryBanner() — Priya Nair (4/5=80%) and Ryan Sullivan (5/5=100%) are surfaced as ready with no Progress record yet, Marcus Webb (2/5=40%) is not, and Ava Mitchell (4/5=80% but already judged) is correctly excluded', () => {
  const { sandbox: tm } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const state = tm.__tmGetState();
  const fixture = tm.CT_SAMPLE_TEST_MODE_DATA;
  state.students = fixture.students;
  state.progress = fixture.progress;
  state.taughtICs = fixture.taughtICs;
  tm.__tmSeedSampleDataExtras()(); // the real seeding step — populates state.instructionalComponents from the fixture

  const results = tm.getReadyForMasteryBanner();
  const isReady = (firstName, code) => results.some(r => r.student.first_name === firstName && r.descriptorId === code);

  assert.ok(isReady('Priya', 'AC9M3N02'), 'Priya Nair sits at exactly 80% coverage with no Progress record — must be surfaced as ready (the exact-boundary case)');
  assert.ok(isReady('Ryan', 'AC9E4LY06'), 'Ryan Sullivan sits at 100% coverage with no Progress record — must be surfaced as ready (a second, cleaner gate example)');
  assert.ok(!isReady('Marcus', 'AC9M3N02'), 'Marcus Webb sits at 40% coverage — clearly below the gate — must not be surfaced');
  assert.ok(!isReady('Ava', 'AC9E4LY06'), 'Ava Mitchell sits at 80% coverage but already has a Progress record — the gate must correctly exclude already-judged students');
});

test('the fixture has a genuine coverage gap (AC9S3U02 — soils, rocks and minerals) with real system-default ICs that nobody has been taught, distinct from AC9M3N02/AC9E4LY06 which do have taughtLog coverage', () => {
  const { sandbox: tm } = makeTestModeSandbox({ locationSearch: '?testMode=1&sampleData=1' });
  const state = tm.__tmGetState();
  const fixture = tm.CT_SAMPLE_TEST_MODE_DATA;
  state.taughtLog = fixture.taughtLog;
  tm.__tmSeedSampleDataExtras()();

  const gapIC = state.instructionalComponents.find(ic => ic.homeDescriptorId === 'AC9S3U02');
  assert.ok(gapIC && gapIC.ownerTier === 'system_default', 'AC9S3U02 must have real system-default ICs (a gap with no ICs at all is a different, less interesting case)');
  assert.ok(!fixture.taughtLog.some(t => t.code === 'AC9S3U02'), 'AC9S3U02 must have no taughtLog entries for anyone — this is what Coverage Gaps\' "codes never taught" check reads (wasCodeTaughtToStudent)');
  assert.ok(fixture.taughtLog.some(t => t.code === 'AC9M3N02'), 'sanity: AC9M3N02 does have taughtLog coverage, so it is NOT the fixture\'s coverage gap');
});

// ── Sidebar "you are here" highlight (syncNavHighlight) ─────────────────────────
console.log('Sidebar nav highlight');

// The shared sandbox above deliberately stubs document.querySelectorAll('.nav-btn')
// to always return [] and getElementById() to hand back a fresh element with a
// no-op classList (fine for the other 297 tests, none of which check real
// class-list state) — neither is faithful enough to verify actual highlight
// behaviour, so this gets its own dedicated vm context, mirroring
// makeTestModeSandbox's approach: a real classList per button (an actual tracked
// Set, not a no-op), and a real, exact copy of index.html's 15 sidebar nav-btn ids
// (14 real views + nav-log-today, the Log Today wizard launcher, which isn't a
// view at all — see its own comment in index.html). renderView() and
// openCodeDetail() are stubbed to no-ops after evaluation (same convention as
// `sandbox.renderView = function(){}` above) — this suite only cares whether the
// right button gets .active, not what the rest of the screen renders, and
// openStubReview() schedules a real setTimeout() into openCodeDetail() that would
// otherwise still be pending (and could throw against this minimal state) when
// Node's event loop drains after the synchronous test body returns.
const NAV_VIEW_TO_ID = {
  'dashboard': 'nav-dashboard',
  'students': 'nav-students',
  'overview': 'nav-overview',
  'bulk-assess': 'nav-bulk-assess',
  'daily-log': 'nav-daily-log',
  'unit-plans': 'nav-unit-plans',
  'planner': 'nav-planner',
  'coverage': 'nav-coverage',
  'standards-judgments': 'nav-standards-judgments',
  'progression-placement': 'nav-progression-placement',
  'curriculum': 'nav-curriculum',
  'standards': 'nav-standards',
  'progressions': 'nav-progressions',
  'admin': 'nav-admin',
};
const NAV_BTN_IDS = Object.values(NAV_VIEW_TO_ID).concat(['nav-log-today']);

function makeNavHighlightSandbox() {
  function makeTrackedNavBtn(id) {
    const classes = new Set(['nav-btn']);
    return {
      id, tagName: 'BUTTON',
      get className() { return Array.from(classes).join(' '); },
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        toggle(c, force) {
          const on = force !== undefined ? force : !classes.has(c);
          if (on) classes.add(c); else classes.delete(c);
          return on;
        },
        contains(c) { return classes.has(c); },
      },
      style: {}, dataset: {}, innerHTML: '', textContent: '',
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
      appendChild() {}, removeChild() {}, remove() {}, insertBefore() {},
      addEventListener() {}, removeEventListener() {}, focus() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      closest() { return null; }, getBoundingClientRect() { return {}; },
    };
  }
  function makeGenericStubEl() {
    return {
      style: {}, className: '', id: '', innerHTML: '', textContent: '', value: '',
      dataset: {}, scrollTop: 0, firstChild: null,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      appendChild() {}, removeChild() {}, remove() {}, insertBefore() {},
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
      addEventListener() {}, removeEventListener() {}, focus() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      closest() { return null; }, getBoundingClientRect() { return {}; },
    };
  }

  const navBtns = {};
  NAV_BTN_IDS.forEach(id => { navBtns[id] = makeTrackedNavBtn(id); });
  const genericElCache = {};

  const navDocumentStub = {
    addEventListener() {}, removeEventListener() {},
    getElementById(id) {
      if (navBtns[id]) return navBtns[id];
      return genericElCache[id] || (genericElCache[id] = makeGenericStubEl());
    },
    querySelector() { return null; },
    // app.js's only querySelectorAll('.nav-btn') call site is syncNavHighlight()
    // itself (confirmed by grep) — safe to special-case exactly that selector and
    // fall back to [] for everything else, matching the shared stub above.
    querySelectorAll(sel) { return sel === '.nav-btn' ? Object.values(navBtns) : []; },
    createElement() { return makeGenericStubEl(); },
    body: makeGenericStubEl(),
    documentElement: makeGenericStubEl(),
  };

  const navLocalStorageStub = {
    getItem() { return null; }, setItem() {}, removeItem() {}, clear() {},
  };
  const navWindowStub = {
    addEventListener() {}, removeEventListener() {},
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
    localStorage: navLocalStorageStub,
    document: navDocumentStub,
    open() {},
  };
  const navSandbox = {
    console,
    document: navDocumentStub,
    window: navWindowStub,
    localStorage: navLocalStorageStub,
    navigator: { userAgent: 'node-test' },
    location: { href: '', search: '', hash: '' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: () => new Promise(() => {}),
    alert() {}, confirm() { return true; }, prompt() { return null; },
    CSS: { escape: (s) => String(s) },
    Date, Math, JSON,
  };
  navSandbox.globalThis = navSandbox;
  vm.createContext(navSandbox);
  vm.runInContext(
    appSrc + '\n;globalThis.__navGetState = function(){ return state; };\n',
    navSandbox,
    { filename: 'app.js (nav highlight sandbox)' }
  );
  navSandbox.renderView = function () {};
  navSandbox.openCodeDetail = function () {};

  return { sandbox: navSandbox, navBtns, getState: navSandbox.__navGetState };
}

// Every button other than `activeId` (or every button, if activeId is null) must be
// inactive — guards against a fix that adds .active to the right button without
// actually clearing a stale one first (syncNavHighlight's whole job is BOTH halves).
function assertOnlyActive(navBtns, activeId, msg) {
  for (const id of Object.keys(navBtns)) {
    const shouldBeActive = id === activeId;
    assert.strictEqual(navBtns[id].classList.contains('active'), shouldBeActive,
      `${msg}: ${id} must be ${shouldBeActive ? 'active' : 'inactive'}`);
  }
}

test('index.html has no duplicate sidebar nav-btn ids — the exact defect class behind Bug 2 (Session History and Log Today both resolving to nav-daily-log), guarded generally so a future button can\'t silently collide the same way', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const ids = Array.from(html.matchAll(/class="nav-btn[^"]*"\s+onclick="[^"]*"\s+id="([^"]+)"/g)).map(m => m[1]);
  assert.ok(ids.length >= 14, 'sanity: must have found the sidebar nav buttons at all');
  const seen = new Set();
  const dupes = [];
  for (const id of ids) { if (seen.has(id)) dupes.push(id); seen.add(id); }
  assert.deepStrictEqual(dupes, [], 'no two nav-btn elements may share the same id');
  assert.ok(ids.includes('nav-daily-log'), 'Session History\'s button must be nav-daily-log, matching the "daily-log" view name showView() looks it up by');
  assert.ok(ids.includes('nav-log-today'), 'Log Today (a wizard launcher, not a view) must have its own id, distinct from Session History\'s');
});

// The dedicated sandbox's navBtns dictionary above is hardcoded to the IDEAL
// nav-<viewname> scheme — a real regression in index.html itself (a button's actual
// id drifting away from its own showView('<viewname>') call, exactly how Bug 2 AND a
// previously-undocumented 5th instance — Bulk Assess: id="nav-bulk" vs. its view name
// "bulk-assess", found during this fix's audit for more instances — both arose) would
// still pass every sandbox-based test below, since the sandbox's ids never drift; only
// reading the real file, independent of the sandbox, can catch that. This is the one
// test in this file that would have caught Bulk Assess's mismatch on its own, with no
// prior knowledge of which id it was supposed to be — it re-derives the expectation
// from each button's own onclick="showView('...')" call rather than a hand-written list.
test('every sidebar nav-btn that calls showView(\'<view>\') has an id of exactly nav-<view> — the general form of Bug 2/5, so a future button reintroducing this drift is caught even if nobody thinks to hardcode its specific id into a test', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const matches = Array.from(html.matchAll(/class="nav-btn[^"]*"\s+onclick="showView\('([^']+)'\)"\s+id="([^"]+)"/g));
  assert.strictEqual(matches.length, 14, 'sanity: must have found exactly the 14 showView(...)-driving nav buttons (Log Today is deliberately excluded — it calls openDailyLogWizard(), not showView)');
  for (const [, view, id] of matches) {
    assert.strictEqual(id, 'nav-' + view, `the button for showView('${view}') must have id="nav-${view}" — found id="${id}"`);
  }
});

test('showView() correctly highlights its own nav-btn, and only its own, for every one of the 14 real views — including reaching Session History correctly now that its id no longer collides with Log Today\'s (Bug 2)', () => {
  for (const [view, expectedId] of Object.entries(NAV_VIEW_TO_ID)) {
    const { sandbox: nav, navBtns } = makeNavHighlightSandbox();
    nav.showView(view);
    assertOnlyActive(navBtns, expectedId, `showView('${view}')`);
  }
});

test('showView(\'daily-log\') (Session History) does not light up Log Today\'s button — the two are different, non-interchangeable sidebar entries (Bug 2\'s exact symptom)', () => {
  const { sandbox: nav, navBtns } = makeNavHighlightSandbox();
  nav.showView('daily-log');
  assert.ok(navBtns['nav-daily-log'].classList.contains('active'), 'Session History\'s own button must be active');
  assert.ok(!navBtns['nav-log-today'].classList.contains('active'), 'Log Today must NOT light up just because Session History was opened');
});

test('the exact init() restore sequence (setCurrentView with persist:false, then syncNavHighlight) highlights the right button after a simulated reload, for a real spread of persisted views — without ever calling showView() or renderView() (Bug 1)', () => {
  for (const [view, expectedId] of Object.entries(NAV_VIEW_TO_ID)) {
    const { sandbox: nav, navBtns, getState } = makeNavHighlightSandbox();
    nav.setCurrentView(view, { persist: false });
    nav.syncNavHighlight();
    assertOnlyActive(navBtns, expectedId, `restored view '${view}'`);
    assert.strictEqual(getState().currentView, view, 'sanity: state.currentView must actually be the restored view');
  }
});

test('setCurrentView() alone, without syncNavHighlight(), leaves the DOM highlight stuck on whatever was active before — demonstrating Bug 1\'s exact mechanism (state changes, DOM never told) so the fix above is provably doing real work, not passing by coincidence', () => {
  const { sandbox: nav, navBtns } = makeNavHighlightSandbox();
  // app.js calls init() itself at module load (its very last line) — exactly like a
  // real page load — and init()'s own synchronous prefix runs through its own
  // syncNavHighlight() call before suspending on its first await, correctly lighting
  // up nav-dashboard for the default restored view. That's the fix already doing its
  // job; sanity-check it below, then show what happens without that call: a bare
  // setCurrentView() changes state but leaves the highlight exactly where it was.
  assertOnlyActive(navBtns, 'nav-dashboard', 'sanity: init()\'s own restore path already highlighted dashboard correctly');
  nav.setCurrentView('planner', { persist: false });
  assertOnlyActive(navBtns, 'nav-dashboard', 'setCurrentView alone must NOT move the highlight — without a syncNavHighlight() call it stays stuck on the stale previous view, exactly Bug 1\'s "resets to/stays on Dashboard" symptom');
});

test('openStudentDetail() highlights nav-students (Bug 3) — student-detail is a sub-view reached only through Students, not a nav item of its own, and the previous view\'s highlight must be cleared, not just left stuck', () => {
  const { sandbox: nav, navBtns, getState } = makeNavHighlightSandbox();
  const state = getState();
  state.students = [{ id: 'stu_1', first_name: 'Test', last_name: 'Student', year_level: '3' }];
  nav.showView('planner'); // establish a different starting highlight first
  assertOnlyActive(navBtns, 'nav-planner', 'sanity: planner is active before opening the student');

  nav.openStudentDetail('stu_1');
  assert.strictEqual(state.currentView, 'student-detail', 'sanity: openStudentDetail must actually switch to the student-detail view');
  assertOnlyActive(navBtns, 'nav-students', 'openStudentDetail');
});

test('openStubReview() (the "1 draft IC needs review" banner\'s Review now button) highlights nav-curriculum (Bug 4 — the same root cause found in a 4th call site during the audit for more instances)', () => {
  const { sandbox: nav, navBtns, getState } = makeNavHighlightSandbox();
  const state = getState();
  state.instructionalComponents = [
    { id: 'stub_1', homeDescriptorId: 'CD_1', ownerTier: 'teacher_stub', icReadinessStatus: 'draft', createdAt: '2026-01-01T00:00:00.000Z' },
  ];
  state.curriculumCodes = [];
  nav.showView('overview'); // establish a different starting highlight first
  assertOnlyActive(navBtns, 'nav-overview', 'sanity: overview is active before reviewing the stub');

  nav.openStubReview();
  assert.strictEqual(state.currentView, 'curriculum', 'sanity: openStubReview must actually switch to the Curriculum Codes view');
  assertOnlyActive(navBtns, 'nav-curriculum', 'openStubReview');
});

test('syncNavHighlight() clears a stale highlight rather than only ever adding — calling it twice for two different views leaves just the second one active, not both', () => {
  const { sandbox: nav, navBtns } = makeNavHighlightSandbox();
  nav.setCurrentView('admin', { persist: false });
  nav.syncNavHighlight();
  assertOnlyActive(navBtns, 'nav-admin', 'first sync');
  nav.setCurrentView('coverage', { persist: false });
  nav.syncNavHighlight();
  assertOnlyActive(navBtns, 'nav-coverage', 'second sync must clear the first, not accumulate');
});

// ── Summary ─────────────────────────────────────────────────────────────────────
(async () => {
  for (const { name, fn } of asyncTests) {
    toasts = [];
    windowOpenCalls = [];
    try { await fn(); passed++; console.log('  ✓ ' + name); }
    catch (e) { failures.push({ name, e }); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
  }
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    for (const f of failures) console.error('FAILED: ' + f.name + '\n' + (f.e && f.e.stack || f.e));
    process.exit(1);
  }
})();
