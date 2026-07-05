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

const windowStub = {
  addEventListener() {}, removeEventListener() {},
  matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
  localStorage: localStorageStub,
  document: documentStub,
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
  st.plannerUi.draggingLessonId = null;
  st.plannerUi.draggingSlot = null;
  st.plannerUi.insertionTarget = null;
  st.plannerUi.dayOrder = {};
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

  // The drawer opens in the exact same fully-editable mode as before — no separate
  // read-only quick-view was introduced by making the card body clickable.
  const html = sandbox.plannerDrawerHtml(lessonById('ul_1'), []);
  assert.ok(html.includes('Teaching status'), 'the unit lesson drawer should render its full editable field set, unchanged');
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

// ── Summary ─────────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  for (const f of failures) console.error('FAILED: ' + f.name + '\n' + (f.e && f.e.stack || f.e));
  process.exit(1);
}
