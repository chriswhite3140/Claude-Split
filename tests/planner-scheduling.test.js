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
  ';globalThis.__runInlineHandler = function(code, evt, thisArg){ return (new Function("event", code)).call(thisArg, evt); };\n',
  sandbox,
  { filename: 'app.js' }
);

// Quiet the heavy render path and capture toasts (override the global object props).
let toasts = [];
const realRenderView = sandbox.renderView;
sandbox.renderView = function () {};
sandbox.toast = function (msg, type) { toasts.push({ msg, type }); };

const getState = sandbox.__getState;

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
  // descriptor to render an IC (see its `cd && cd.Subject === subject` check) — so a
  // "fail open" IC here would never actually reach the screen. It would only occupy
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

  // Now simulate a live score for this exact IC (as if it had just been suggested).
  getState().plannerUi.suggestionScores = { ic_1: 5 };
  html = sandbox.plannerDrawerHtml(lessonById('sa_1'), [{ key: 'mon', label: 'Monday' }]);
  assert.ok(html.includes('planner-ic-confidence'), 'a confidence badge should render once live suggestion data exists for this IC');
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

// ── Summary ─────────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  for (const f of failures) console.error('FAILED: ' + f.name + '\n' + (f.e && f.e.stack || f.e));
  process.exit(1);
}
