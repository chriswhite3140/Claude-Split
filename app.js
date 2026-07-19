/*
 * ============================================================
 * ClassTracker — Australian Curriculum Progress Tracker
 * ============================================================
 * THIS FILE IS VERSION: 1.13.33
 * Last updated: 2026-06-29
 * ============================================================
 *
 * Author: Chris White
 * Repo:   https://github.com/chriswhite3140/class-tracker-split
 * Live:   https://chriswhite3140.github.io/class-tracker-split
 *
 * v1.13.33 - Fix: unit IC picker "Taught" badge now uses the most-recent taughtICs status per student+IC and ignores cleared (empty-status) outcomes, so an IC whose outcome was cleared no longer shows as taught (matches getTaughtICStatus)
 * v1.13.32 - Unit Plans: IC picker cards show an "In lesson N" tag when the IC is already linked to another lesson in the unit, and a "Taught" badge when it has been taught to the class (from existing state.taughtICs — no new fetch); Weekly Planner cards unchanged
 * v1.13.31 - Unit Plans: IC picker cards now show the IC number (sequenceOrder) and the early/middle/late stage tag, matching the Curriculum Codes drawer; Weekly Planner IC cards unchanged
 * v1.13.30 - Fix: unit lesson IC picker excludes teacher-suppressed system-default ICs (matching getICsForDescriptor / Curriculum Codes), so a hidden IC can't reappear in the "From this unit's CDs" or "Other" group; Weekly Planner picker unchanged
 * v1.13.29 - Fix: "From this unit's CDs" IC group now includes ICs tethered to a linked CD (via linkedDescriptorIds), not just home-owned ones, and is no longer hidden by the year filter — so all ICs the Curriculum Codes view shows for a linked CD appear in the group
 * v1.13.28 - Unit Plans: IC picker in the unit lesson drawer surfaces ICs parented to the unit's linked CDs first ("From this unit's CDs" / "Other Year X ICs"); flat list when the unit has no linked CDs; Weekly Planner unchanged
 * v1.13.27 - Unit Plans: IC picker in the unit lesson drawer defaults to the unit's year level (banded-subject aware) with a "Show all years" toggle, matching the CD picker; Weekly Planner IC picker unchanged
 * v1.13.26 - Unit Plans: unit title in the detail view now reads as a clearly-editable field (persistent border + pencil affordance) so it's obviously renameable after creation, including on touch devices
 * v1.13.25 - Unit Plans: linked-CD picker defaults to the unit's year level (banded-subject aware); "Show all years" toggle broadens it; no filter when the unit has no year level set
 * v1.13.24 - Unit Plans (PR1): new Unit Plans layer above the Weekly Planner; unit data model, unit list + detail views, lesson sequence (add/reorder/delete) reusing the planner IC-linking drawer, teaching-status badges, linked CDs and assessment notes
 * v1.13.21 - localStorage caching for all GitHub raw CSV fetches; cache keyed by app version so auto-invalidates on update; eliminates rate limit 400 errors on repeated loads
 * v1.13.20 - Bulk Assess: student sort toggle button added to header (Last/First name), matching Students view
 * v1.13.19 - Coverage Gaps: legend moved above table so it stays visible when ICs are expanded; expand/collapse all button visually distinct from filter buttons
 * v1.13.18 - Coverage Gaps: expandable IC sub-rows per descriptor; global expand all / collapse all toggle and per-descriptor chevron toggle
 * v1.13.17 - Fix mobile outer-scroll from draft IC banner: mobile .main used a fixed height:calc(100vh - 56px) that didn't account for the banner above .app; switched to flex:1 + min-height:0 (matching desktop) so the banner is absorbed by the flex column
 * v1.13.16 - Fix "Review now" banner button doing nothing: openStubReview() still had the 3-day age gate (removed from the banner in v1.13.14), so recently-created draft stubs were filtered out and the click silently returned; age gate now removed to match the banner filter
 * v1.13.15 - Fix draft IC banner rendering as a full-height block down the left side: insert it into body (flex column) instead of .app (flex row), so it sits as a slim full-width bar at the top with .app filling the space below
 * v1.13.14 - Remove 3-day age gate from draft IC banner; banner now shows immediately for any draft stub IC
 * v1.13.13 - Draft IC review banner: now pushes content down instead of overlaying; colour changed to blue (#1A73E8); draft ICs sort to top of IC list in descriptor side panel
 * v1.13.12 - Import Maths ICs for Foundation, Y1, Y3–Y6 across all strands (Number, Algebra, Measurement, Space, Statistics, Probability); Y2 Maths ICs already present; ~550 ICs total now loaded on init
 * v1.13.11 - Fix: opening the student detail view no longer crashes with "subjectColours is not defined" — renderStudentDetail subject tabs and the coverage tooltip now use the subjectCol() helper (SUBJECT_COLOURS); this ReferenceError was the actual cause of student cards appearing to do nothing / bounce back to Students
 * v1.13.10 - Fix: student card click reliably opens student detail — openStudentDetail now resolves the student by matching String(id) and selects that student's own id, covering all call sites and any mix of numeric/string IDs (no more redirect back to Students)
 * v1.13.7  - Fix: Bulk Assess ratings can now be cleared by clicking the active button again; toggling off an unsaved change reverts to the saved rating rather than clearing it (no silent loss of existing assessment data)
 * v1.13.7  - Fix: clicking a student card in Students view now opens the student detail view
 * v1.13.6  - Year 2 Science IC review: linked AC9S2U01-IC8 to AC9S2H01; linked AC9S2H01-IC2 to AC9S2U01
 * v1.13.5  - IC skill rollup fix: Coverage Gaps now rolls up linked ICs with OR per student (any one tethered got_it = met) instead of counting each tethered IC as required — removes false gaps on multi-context Science inquiry descriptors; shared rollUpICStatuses helper keeps the coverage bar and Bulk Assess badge in step
 * v1.13.4  - IC skill rollup: linkedDescriptorIds now surface IC outcomes on tethered CDs in Bulk Assess and Coverage Gaps (OR scoring: got_it on any one linked IC = met)
 * v1.13.3  - Planner IC picker fix: confidence now normalises against descriptors that actually render (ranked descriptors with no loaded ICs no longer deflate every visible match to partial); suggestion groups flattened by score across descriptors (strong, then partial, then "Create new IC", then weak), not taxonomy order
 * v1.13.2  - Planner IC picker: order suggestion results by confidence — strong first, then partial, then the "Create new IC" action, then weak matches at the very bottom (ordering only; scoring/thresholds unchanged)
 * v1.13.1  - Planner IC picker: three-tier confidence indicator (Strong/Partial/Weak, normalised to top suggestion) on intention-suggested ICs; always-visible "Create new IC" that opens the stub modal and auto-links the new stub to the lesson
 * v1.13.0  - Planner consolidation (step 1): retired Plan & Log and the legacy Weekly Planner; renderPlanner is now the single canonical Weekly Planner. New lesson schema (weekKey, intention, linkedICIds, position); ICs linked 1-3 per lesson via intention-driven suggestion + manual search/tick; week navigation; legacy planning localStorage wiped (clean start)
 * v1.12.58 - Stub IC Sheets persistence: loadStubICsFromSheets() at init merges persisted stubs (stub wins on ID collision); saveStubIC fire-and-forget POSTs to Apps Script after push
 * v1.12.57 - Stub modal: subject + year level selectors before descriptor, descriptor datalist filtered by subject+year, defaults from wizard context, locked state when descriptor pre-filled
 * v1.12.56 - Stub modal: optional descriptorCode param, descriptor selector first field (searchable datalist), name auto-fills from descriptor, locked when pre-filled; AI suggester adds stub link below results
 * v1.12.55 - Stub link always visible in per-descriptor IC picker (text link, not conditional button); removed from AI suggester panel
 * v1.12.54 - Stub IC creation: teacher_stub ownerTier, per-descriptor IC search in wizard step 2, stub modal, 80% gate exclusion, Draft pill, stub banner, nav badge
 * v1.12.52 - Phase 3: mastery ready banner and picker modal in IC Coverage view
 * v1.12.51 - IC Coverage legend updated: Mastered → Got it, Not yet → Needs review
 * v1.12.50 - Retire mastered from all IC Coverage comments — two inline comments still referenced mastered/not_yet; updated to gotIt/needsReview per Phase 2 spec
 * v1.12.49 - Bug fix: ics_year2_maths_number.csv had empty id column — ICs got new random UUIDs each load so TaughtICs references never matched; added stable ac9m2nXX-icNN IDs
 * v1.12.48 - Bug fix: NaN% taught in IC Coverage — descPct and taughtPctForCodes still referenced .mastered after rename to .gotIt in getICStudentCounts
 * v1.12.47 - Bug fix: capture classScanMap before modal teardown; saveDailyLog re-renders current view; toast shows got_it/needs_review breakdown; Step 2 label updated to "Class Check"
 * v1.12.46 - Phase 2 Class Scan: replaced IC Outcomes grid with per-student scan (taught/got_it/needs_review); strand history dots; global bulk toggles; step not skippable
 * v1.12.27 - Bug fixes: dlMarkAllForCode now scoped to eligible students only; masteryMap cleared when 80% gate finds no students
 * v1.12.26 - Daily Log Wizard: reordered steps (Attendance→Codes/ICs→IC Outcomes→Quick Mastery); step 4 conditional on 80% IC coverage gate
 * v1.12.25 - dlToggleCode ignores IC-derived codes; code list shows "via IC" badge for those rows
 * v1.12.24 - Daily Log: selecting an IC auto-adds its homeDescriptorId to selectedCodes; footer shows code+IC counts
 * v1.12.22 - IC tracking: taughtICs state + API, IC Outcomes step in Daily Log Wizard, IC status toggles in descriptor detail panel
 * v1.12.18 - reviewNotes added to createIC() and mapped from CSV in fetchICsCSVFromGitHub()
 * v1.12.17 - IC CSV loaded from GitHub at init and parsed into state.instructionalComponents
 * v1.12.16 - IC panel added to Curriculum Codes descriptor detail view (display only)
 * v1.12.15 - IC data structure: state.instructionalComponents[], createIC(), selector helpers
 * v1.12.14 - ContentDescriptor enriched with descriptorType and elaborations at init
 * v1.12.12 - Planner lesson cards now include a quick delete action
 * v1.12.11 - Planner lesson cards now include a quick duplicate action
 * v1.12.10 - Planner lesson cards now support drag-and-drop movement between columns
 * v1.12.9 - Planner weekly board now includes an Unscheduled column (before Monday)
 * v1.12.8 - Planner lesson plans now persist in localStorage across refresh
 * v1.12.7 - Planner drawer text fields now keep focus while typing (no per-keystroke full rerender)
 * v1.12.6 - Planner + Add Lesson button placement fixed so it stays visible in the header
 * v1.12.5 - Planner top bar now includes a visible + Add Lesson action that creates a new editable lesson card
 * v1.12.4 - Planner lesson cards now open drawer reliably with basic lesson field editing
 * v1.12.3 - Legacy planner retired from sidebar; new Planner shell page added (Phase 1)
 * v1.12.2 - Weekly Planner stabilization (canonical week key + reliable cell creation/events)
 * v1.12.1 - Weekly Planner regression fix (week navigation + drag/drop reliability after persistence restore)
 * v1.12.0 - Weekly Planner persistence and app view restore improvements
 * v1.11.0 - Assessable Components layer for partial/cumulative descriptor mastery
 * v1.10.0 - Weekly Planner Phase 2 (weekly focus, rollover, multi-period blocks, multi-day duplication)
 * v1.8.0 - Added accessible tooltips for truncated text in dense views + spacing polish for filter controls
 * v1.7.3 - Unified Data & Settings accordion: all major sections collapsible and closed by default
 * v1.7.2 - Data & Settings accordion sections for cleaner scanning (Class & Teacher Groups open by default)
 * v1.7.1 - Data & Settings layout cleanup: moved theme + CSV uploads into the main settings view
 * v1.7.0 - Light/Dark/Auto theme toggle with persistent display preference
 * v1.6.0 - Plan and Log Learning workflow with suggested/confirmed code flow and taught/assessment actions
 * v1.5.0 - Visible class settings entry + teacher-friendly checkboxes + filtering polish
 * v1.4.0 - Class/teacher group settings with subject+strand toggles
 * v1.3.6 - Coverage gaps view, student detail taught filter, dashboard taught stats
 * v1.1.0 - Mark-all buttons with full labels and icons
 * v1.0.x - Daily log wizard with AI suggestions
 * v0.9.x - Multi-subject student detail, print reports
 * ============================================================
 */

const APP_VERSION = '1.13.48';
// Cache version is tied to APP_VERSION so any version bump auto-invalidates the CSV cache.
const CSV_CACHE_VERSION = APP_VERSION;
const LESSON_PLANS_STORAGE_KEY = 'ct_planner_lessons_v2';
const UNIT_PLANS_STORAGE_KEY = 'ct_unit_plans_v1';
// Timestamp of the last local edit to unit plans / lessons — used to decide whether
// a Drive backup is newer than what's on this device (see DRIVE BACKUP SYNC below).
const PLANNER_LOCAL_MODIFIED_KEY = 'ct_planner_local_modified_v1';
// Timestamp of the last *successful* Drive backup. Persisted (not just kept on
// state.driveSync) so a reload can tell whether local edits since then still need
// to go up, instead of starting every session assuming nothing is pending.
const PLANNER_LAST_DRIVE_SYNC_KEY = 'ct_planner_last_drive_sync_v1';
// Weekday keys a unit lesson can be scheduled onto (the board columns are these +
// 'unscheduled'). Declared up here so normalizeLessonPlan — which runs during state
// init, before the planner section executes — can use it without a TDZ error.
const PLANNER_SCHEDULABLE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const THEME_STORAGE_KEY = 'app_theme';
const TEXT_SIZE_STORAGE_KEY = 'app_text_size';
const APP_UI_STATE_STORAGE_KEY = 'ct_ui_state_v1';
const RESTORABLE_VIEWS = new Set([
  'dashboard', 'students', 'overview', 'bulk-assess', 'daily-log', 'unit-plans', 'planner',
  'coverage', 'standards-judgments', 'progression-placement', 'admin', 'curriculum', 'standards', 'progressions'
]);
let systemThemeMediaQuery = null;

function loadUIState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_UI_STATE_STORAGE_KEY) || '{}');
    let currentView = RESTORABLE_VIEWS.has(parsed?.currentView) ? parsed.currentView : 'dashboard';
    return { currentView };
  } catch (e) {
    return { currentView: 'dashboard' };
  }
}

function saveUIState() {
  try {
    localStorage.setItem(APP_UI_STATE_STORAGE_KEY, JSON.stringify({
      currentView: state.currentView || 'dashboard',
    }));
  } catch (e) {}
}

function setCurrentView(v, { persist = true } = {}) {
  state.currentView = v;
  if (persist) saveUIState();
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function normalizeThemePreference(value) {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto';
}

function resolveTheme(preference) {
  return preference === 'auto' ? getSystemTheme() : preference;
}

function updateThemeUI(preference, appliedTheme) {
  const select = document.getElementById('theme-select');
  if (select && select.value !== preference) select.value = preference;
  const currentLabel = document.getElementById('theme-current');
  if (currentLabel) {
    const source = preference === 'auto' ? 'Auto (System)' : preference[0].toUpperCase() + preference.slice(1);
    currentLabel.textContent = `Current: ${source} → ${appliedTheme[0].toUpperCase() + appliedTheme.slice(1)}`;
  }
}

function applyTheme(preference, { persist = true } = {}) {
  const normalized = normalizeThemePreference(preference);
  const resolvedTheme = resolveTheme(normalized);
  document.body.setAttribute('data-theme', resolvedTheme);
  state.themePreference = normalized;

  if (persist) localStorage.setItem(THEME_STORAGE_KEY, normalized);
  updateThemeUI(normalized, resolvedTheme);
}

function initTheme() {
  const savedPreference = normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY) || 'auto');
  applyTheme(savedPreference, { persist: false });

  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemThemeMediaQuery.addEventListener('change', () => {
    if ((state.themePreference || 'auto') === 'auto') {
      applyTheme('auto', { persist: false });
    }
  });
}

function normalizeTextSizePreference(value) {
  return value === 'large' || value === 'standard' ? value : 'standard';
}

function updateTextSizeUI(preference) {
  const select = document.getElementById('text-size-select');
  if (select && select.value !== preference) select.value = preference;
  const currentLabel = document.getElementById('text-size-current');
  if (currentLabel) {
    currentLabel.textContent = `Current text size: ${preference === 'large' ? 'Large' : 'Standard'}`;
  }
}

function applyTextSize(preference, { persist = true } = {}) {
  const normalized = normalizeTextSizePreference(preference);
  document.body.setAttribute('data-text-size', normalized);
  state.textSizePreference = normalized;
  if (persist) localStorage.setItem(TEXT_SIZE_STORAGE_KEY, normalized);
  updateTextSizeUI(normalized);
}

function initTextSize() {
  const savedPreference = normalizeTextSizePreference(localStorage.getItem(TEXT_SIZE_STORAGE_KEY) || 'standard');
  applyTextSize(savedPreference, { persist: false });
}

document.addEventListener('change', (e) => {
  if (e.target?.id === 'theme-select') applyTheme(e.target.value);
  if (e.target?.id === 'text-size-select') applyTextSize(e.target.value);
});

// ── GLOBAL CONSTANTS ──
const SUBJECT_COLOURS = {
  'English':                       { col: 'var(--blue)',   bg: 'var(--blue-dim)'   },
  'Mathematics':                   { col: 'var(--green)',  bg: 'var(--green-dim)'  },
  'Science':                       { col: 'var(--teal)',   bg: 'var(--teal-dim)'   },
  'HASS':                          { col: 'var(--gold)',   bg: 'var(--gold-dim)'   },
  'Health and Physical Education': { col: 'var(--rust)',   bg: 'var(--rust-dim)'   },
  'HPE':                           { col: 'var(--rust)',   bg: 'var(--rust-dim)'   },
  'Design and Technologies':       { col: 'var(--purple)', bg: 'var(--purple-dim)' },
  'Digital Technologies':          { col: 'var(--purple)', bg: 'var(--purple-dim)' },
  'Dance':                         { col: 'var(--neutral)', bg: 'var(--neutral-dim)' },
  'Drama':                         { col: 'var(--neutral)', bg: 'var(--neutral-dim)' },
  'Media Arts':                    { col: 'var(--neutral)', bg: 'var(--neutral-dim)' },
  'Music':                         { col: 'var(--neutral)', bg: 'var(--neutral-dim)' },
  'Visual Arts':                   { col: 'var(--neutral)', bg: 'var(--neutral-dim)' },
};
const SUBJECT_ICONS = {
  'English':'✦','Mathematics':'∑','Science':'⚗','HASS':'◎',
  'Health and Physical Education':'◉','HPE':'♥','Design and Technologies':'⬡','Digital Technologies':'⬡',
  'Dance':'◐','Drama':'◓','Media Arts':'▣','Music':'♪','Visual Arts':'◫',
};
const YLM = {
  'F':'Foundation','1':'Year 1','2':'Year 2','3':'Year 3',
  '4':'Year 4','5':'Year 5','6':'Year 6',
};
const PLANNER_SUBJECTS = ['English','Mathematics','Science','HASS','The Arts','Technologies','Health & PE','Languages'];
function subjectCol(subj)   { return (SUBJECT_COLOURS[subj] || {col:'var(--blue)'}).col; }
function subjectBg(subj)    { return (SUBJECT_COLOURS[subj] || {bg:'var(--surface-alt)'}).bg; }
function subjectShort(subj) {
  if (subj === 'Health and Physical Education') return 'HPE';
  if (subj === 'Design and Technologies')       return 'D&T';
  if (subj === 'Digital Technologies')          return 'DigiTech';
  if (subj === 'Media Arts')                    return 'Media Arts';
  if (subj === 'Visual Arts')                   return 'Visual Arts';
  return subj;
}
function csvYear(yr) { return YLM[yr] || yr; }

const BANDED_SUBJECTS = new Set([
  'HPE', 'Design and Technologies', 'Digital Technologies',
  'Dance', 'Drama', 'Media Arts', 'Music', 'Visual Arts',
]);

function bandYearLevel(studentYear) {
  const map = {
    'Foundation': 'Foundation',
    'Year 1':     'Foundation',
    'Year 2':     'Year 2',
    'Year 3':     'Year 4',
    'Year 4':     'Year 4',
    'Year 5':     'Year 6',
    'Year 6':     'Year 6',
  };
  return map[studentYear] || studentYear;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateWithTooltip(text, maxChars = 80, extraClass = '', focusable = false) {
  const fullText = String(text || '—').trim() || '—';
  const shortText = fullText.length > maxChars ? `${fullText.slice(0, maxChars)}…` : fullText;
  const className = `tt-ellipsis${extraClass ? ` ${extraClass}` : ''}`;
  const tabindexAttr = focusable ? ' tabindex="0"' : '';
  return `<span class="${className}" title="${escapeHtml(fullText)}" data-tooltip="${escapeHtml(fullText)}"${tabindexAttr} aria-label="${escapeHtml(fullText)}">${escapeHtml(shortText)}</span>`;
}

// ── CONFIG ──
const API_URL = 'https://script.google.com/macros/s/AKfycbxjuzVDv1FP2_YWRvs4MV2R3vXL3Az971mRIbuIvnrTYm2wr5AnZjw4YFgmS8jeSZCp/exec';
const GITHUB_RAW = 'https://raw.githubusercontent.com/chriswhite3140/claude-split/main/data/';

const CSV_FILES = {
  curriculumCodes:        { file: 'MASTER_Content_Descriptors_Maths_AC9_v1.csv',    iconId: 'icon-cd',       navId: 'nav-load-cd' },
  curriculumCodesEnglish: { file: 'MASTER_Content_Descriptors_English_AC9_v1.csv',  iconId: 'icon-cd-en',    navId: 'nav-load-cd-en' },
  curriculumCodesScience: { file: 'MASTER_Content_Descriptors_Science_AC9_v1.csv',  iconId: 'icon-cd-sci',   navId: 'nav-load-cd-sci' },
  curriculumCodesHASS:    { file: 'MASTER_Content_Descriptors_HASS_AC9_v1.csv',     iconId: 'icon-cd-hass',  navId: 'nav-load-cd-hass' },
  curriculumCodesHPE:         { file: 'MASTER_Content_Descriptors_HPE_AC9_v1.csv',        iconId: 'icon-cd-hpe',   navId: 'nav-load-cd-hpe' },
  curriculumCodesDesignTech:  { file: 'MASTER_Content_Descriptors_DesignTech_AC9_v1.csv',  iconId: 'icon-cd-dt',    navId: 'nav-load-cd-dt' },
  curriculumCodesDigitalTech: { file: 'MASTER_Content_Descriptors_DigitalTech_AC9_v1.csv', iconId: 'icon-cd-dit',   navId: 'nav-load-cd-dit' },
  curriculumCodesDance:       { file: 'MASTER_Content_Descriptors_Dance_AC9_v1.csv',       iconId: 'icon-cd-dan',   navId: 'nav-load-cd-dan' },
  curriculumCodesDrama:       { file: 'MASTER_Content_Descriptors_Drama_AC9_v1.csv',       iconId: 'icon-cd-drm',   navId: 'nav-load-cd-drm' },
  curriculumCodesMediaArts:   { file: 'MASTER_Content_Descriptors_MediaArts_AC9_v1.csv',   iconId: 'icon-cd-ma',    navId: 'nav-load-cd-ma' },
  curriculumCodesMusic:       { file: 'MASTER_Content_Descriptors_Music_AC9_v1.csv',       iconId: 'icon-cd-mus',   navId: 'nav-load-cd-mus' },
  curriculumCodesVisualArts:  { file: 'MASTER_Content_Descriptors_VisualArts_AC9_v1.csv',  iconId: 'icon-cd-va',    navId: 'nav-load-cd-va' },
  standards:       { file: 'MASTER_Achievement_Standards_Maths_AC9_v1.csv',    iconId: 'icon-st', navId: 'nav-load-st' },
  progressions:    { file: 'literacy progressions.csv',                         iconId: 'icon-pr', navId: 'nav-load-pr' },
  numeracyProgressions: { file: 'Numeracy_Progressions_v9_MASTER_Level_Aligned.csv', iconId: 'icon-np', navId: 'nav-load-np' },
  elaborations:    { file: 'acara_maths_f6_elaborations_v3.csv',               iconId: 'icon-el', navId: 'nav-load-el' },
  ics_foundation_maths_number:      { file: 'ics_foundation_maths_number.csv' },
  ics_foundation_maths_algebra:     { file: 'ics_foundation_maths_algebra.csv' },
  ics_foundation_maths_measurement: { file: 'ics_foundation_maths_measurement.csv' },
  ics_foundation_maths_space:       { file: 'ics_foundation_maths_space.csv' },
  ics_foundation_maths_statistics:  { file: 'ics_foundation_maths_statistics.csv' },
  ics_year1_maths_number:      { file: 'ics_year1_maths_number.csv' },
  ics_year1_maths_algebra:     { file: 'ics_year1_maths_algebra.csv' },
  ics_year1_maths_measurement: { file: 'ics_year1_maths_measurement.csv' },
  ics_year1_maths_space:       { file: 'ics_year1_maths_space.csv' },
  ics_year1_maths_statistics:  { file: 'ics_year1_maths_statistics.csv' },
  ics_year2_maths_number:      { file: 'ics_year2_maths_number.csv' },
  ics_year2_maths_algebra:     { file: 'ics_year2_maths_algebra.csv' },
  ics_year2_maths_measurement: { file: 'ics_year2_maths_measurement.csv' },
  ics_year2_maths_space:       { file: 'ics_year2_maths_space.csv' },
  ics_year2_maths_statistics:  { file: 'ics_year2_maths_statistics.csv' },
  ics_year3_maths_number:      { file: 'ics_year3_maths_number.csv' },
  ics_year3_maths_algebra:     { file: 'ics_year3_maths_algebra.csv' },
  ics_year3_maths_measurement: { file: 'ics_year3_maths_measurement.csv' },
  ics_year3_maths_space:       { file: 'ics_year3_maths_space.csv' },
  ics_year3_maths_statistics:  { file: 'ics_year3_maths_statistics.csv' },
  ics_year3_maths_probability: { file: 'ics_year3_maths_probability.csv' },
  ics_year4_maths_number:      { file: 'ics_year4_maths_number.csv' },
  ics_year4_maths_algebra:     { file: 'ics_year4_maths_algebra.csv' },
  ics_year4_maths_measurement: { file: 'ics_year4_maths_measurement.csv' },
  ics_year4_maths_space:       { file: 'ics_year4_maths_space.csv' },
  ics_year4_maths_statistics:  { file: 'ics_year4_maths_statistics.csv' },
  ics_year4_maths_probability: { file: 'ics_year4_maths_probability.csv' },
  ics_year5_maths_number:      { file: 'ics_year5_maths_number.csv' },
  ics_year5_maths_algebra:     { file: 'ics_year5_maths_algebra.csv' },
  ics_year5_maths_measurement: { file: 'ics_year5_maths_measurement.csv' },
  ics_year5_maths_space:       { file: 'ics_year5_maths_space.csv' },
  ics_year5_maths_statistics:  { file: 'ics_year5_maths_statistics.csv' },
  ics_year5_maths_probability: { file: 'ics_year5_maths_probability.csv' },
  ics_year6_maths_number:      { file: 'ics_year6_maths_number.csv' },
  ics_year6_maths_algebra:     { file: 'ics_year6_maths_algebra.csv' },
  ics_year6_maths_measurement: { file: 'ics_year6_maths_measurement.csv' },
  ics_year6_maths_space:       { file: 'ics_year6_maths_space.csv' },
  ics_year6_maths_statistics:  { file: 'ics_year6_maths_statistics.csv' },
  ics_year6_maths_probability: { file: 'ics_year6_maths_probability.csv' },
  ics_year2_english_language:    { file: 'ics_year2_english_language.csv' },
  ics_year2_english_literature:  { file: 'ics_year2_english_literature.csv' },
  ics_year2_english_literacy:    { file: 'ics_year2_english_literacy.csv' },
  ics_year2_science_understanding:   { file: 'ics_year2_science_understanding.csv' },
  ics_year2_science_human_endeavour: { file: 'ics_year2_science_human_endeavour.csv' },
  ics_year2_science_inquiry_skills:  { file: 'ics_year2_science_inquiry_skills.csv' },
};

// ── STATE ──
let state = {
  students: [],
  progress: [],
  taughtLog: [],              // { id, date, student_id, code, notes }
  standardsJudgments: [],     // { id, student_id, standard_id, judgment, locked, date, notes, period }
  progressionPlacements: [],  // { id, student_id, element, sub_element, level, date, notes, ext_label, ext_value }
  components: loadComponentsState(),          // [{ id, description, contentDescriptorCode }]
  componentProgress: loadComponentProgressState(), // [{ id, student_id, component_id, code, mastery, date, notes }]
  instructionalComponents: [],
  taughtICs: [],               // { id, date, student_id, ic_id, status, notes }
  icCoverageOpen: {},          // { [subject]: bool, [subject+'|'+strand]: bool }
  curriculumCodes: [],
  standards: [],
  progressions: [],
  numeracyProgressions: [],
  aspectLinks: [],
  elaborations: [],
  currentView: 'dashboard',
  selectedStudent: null,
  loading: true,
  syncing: false,
  detailSubjectFilter: null,
  studentSortBy: 'last_name', // 'last_name' | 'first_name'

  // ── ASSESSMENT SCALE (configurable) ──
  // Each item: { id, label, colour, description }
  // Stored in localStorage so it persists across sessions
  assessmentScale: null, // loaded in init
  classSettings: loadClassSettings(),  // class/teacher group config — loaded from localStorage
  lessonPlans: loadLessonPlansState(),
  plannerUi: { selectedLessonId: null, drawerOpen: false, draggingLessonId: null, draggingSlot: null, insertionTarget: null, dayOrder: {}, icSearch: '', suggestedICIds: [], suggestionScores: {}, expandedICId: null, weekKey: null, pendingStubForLessonId: null },
  unitPlans: loadUnitPlansState(),
  unitPlansUi: { openUnitId: null, cdSearch: '', cdShowAllYears: false, draggingLessonId: null },
  driveSync: { lastSyncedAt: null, syncing: false, consecutiveFailures: 0 },
  themePreference: 'auto',
  textSizePreference: 'standard',
  adminAccordion: {
    classGroups: false,
    appearance: false,
    dataUploads: false,
    assessmentScale: false,
    exportData: false,
    driveBackup: false,
    dataStatus: false,
    sheetsSetup: false,
  },
};

// ── GOOGLE SHEETS API ──
// quiet:true skips the global sync-dot/sync-label side effects — used by the Drive
// backup calls below, which have their own dedicated indicator and quiet-retry design
// (see DRIVE BACKUP SYNC). Without this, a background Drive hiccup would flip the
// Sheets connection indicator to "Sync error" even though Sheets is fine.
async function apiCall(action, data = null, opts = {}) {
  const quiet = !!(opts && opts.quiet);
  if (!quiet) setSyncing(true);
  try {
    const resp = await fetch(API_URL + '?action=' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...(data || {}) })
    });
    const result = await resp.json();
    if (!quiet) setSyncing(false);
    return result;
  } catch (err) {
    if (!quiet) { setSyncing(false); setError(); }
    throw err;
  }
}

// ── BATCHED LOAD — single round trip for all Sheets data ──
async function loadAll() {
  const result = await apiCall('getAll');

  // If Apps Script doesn't know getAll yet, it returns { error: '...' }
  // Throw so the fallback in init() kicks in
  if (result.error) throw new Error('getAll not supported: ' + result.error);

  // Students
  if (Array.isArray(result.students) && result.students.length > 1) {
    state.students = result.students.slice(1).map(r => ({
      id: r[0], first_name: r[1], last_name: r[2],
      year_level: r[3], date_added: r[4]
    })).filter(s => s.id);
  }

  // Progress
  if (Array.isArray(result.progress) && result.progress.length > 1) {
    state.progress = result.progress.slice(1).map(r => ({
      id: r[0], student_id: r[1], code: r[2],
      mastery: r[3], date: r[4], notes: r[5] || '', evidence: r[6] || ''
    })).filter(p => p.id);
  }

  // TaughtLog
  if (Array.isArray(result.taughtLog) && result.taughtLog.length > 1) {
    state.taughtLog = result.taughtLog.slice(1).map(r => ({
      id: r[0], date: r[1], student_id: r[2], code: r[3], notes: r[4] || ''
    })).filter(t => t.id);
  }

  // TaughtICs
  if (Array.isArray(result.taughtICs) && result.taughtICs.length > 1) {
    state.taughtICs = result.taughtICs.slice(1).map(r => ({
      id: r[0], date: r[1], student_id: r[2], ic_id: r[3], status: r[4], notes: r[5] || ''
    })).filter(t => t.id);
  }

  // Standards Judgments
  if (Array.isArray(result.standardsJudgments) && result.standardsJudgments.length > 1) {
    state.standardsJudgments = result.standardsJudgments.slice(1).map(r => ({
      id: r[0], student_id: r[1], standard_id: r[2],
      judgment: r[3], locked: r[4] === true || r[4] === 'TRUE',
      date: r[5], notes: r[6] || '', period: r[7] || ''
    })).filter(j => j.id);
  }

  // Progression Placements
  if (Array.isArray(result.progressionPlacements) && result.progressionPlacements.length > 1) {
    state.progressionPlacements = result.progressionPlacements.slice(1).map(r => ({
      id: r[0], student_id: r[1], element: r[2], sub_element: r[3],
      level: r[4], date: r[5], notes: r[6] || '',
      ext_label: r[7] || '', ext_value: r[8] || ''
    })).filter(p => p.id);
  }
}

// Keep individual loaders as fallbacks (used by older scripts)
async function loadStudents() {
  try {
    const rows = await apiCall('getStudents');
    if (Array.isArray(rows) && rows.length > 1) {
      state.students = rows.slice(1).map(r => ({
        id: r[0], first_name: r[1], last_name: r[2],
        year_level: r[3], date_added: r[4]
      })).filter(s => s.id);
    }
  } catch(e) { console.error('Load students error:', e); }
}

async function loadProgress() {
  try {
    const rows = await apiCall('getProgress');
    if (Array.isArray(rows) && rows.length > 1) {
      state.progress = rows.slice(1).map(r => ({
        id: r[0], student_id: r[1], code: r[2],
        mastery: r[3], date: r[4], notes: r[5], evidence: r[6]
      })).filter(p => p.id);
    }
  } catch(e) { console.error('Load progress error:', e); }
}

async function loadTaughtLog() {
  try {
    const rows = await apiCall('getTaughtLog');
    if (Array.isArray(rows) && rows.length > 1) {
      state.taughtLog = rows.slice(1).map(r => ({
        id: r[0], date: r[1], student_id: r[2], code: r[3], notes: r[4] || ''
      })).filter(t => t.id);
    }
  } catch(e) { console.warn('TaughtLog not loaded:', e); }
}

async function loadStubICsFromSheets() {
  const resp = await fetch(API_URL + '?action=loadStubICs', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'loadStubICs' })
  });
  const result = await resp.json();
  if (!result || !Array.isArray(result.stubs) || !result.stubs.length) return;
  result.stubs.forEach(stub => {
    if (!stub.icId || !stub.name || !stub.homeDescriptorId) return;
    const ic = createIC({
      id: stub.icId,
      ownerTier: stub.ownerTier || 'teacher_stub',
      icReadinessStatus: stub.icReadinessStatus || 'draft',
      homeDescriptorId: stub.homeDescriptorId,
      name: stub.name,
      description: stub.note || '',
      note: stub.note || '',
      sequenceOrder: 999,
      createdAt: stub.createdAt || new Date().toISOString(),
    });
    const idx = state.instructionalComponents.findIndex(x => x.id === stub.icId);
    if (idx >= 0) state.instructionalComponents[idx] = ic;
    else state.instructionalComponents.push(ic);
  });
  console.log(`[StubIC] Loaded ${result.stubs.length} stub(s) from Sheets`);
}

async function loadStandardsJudgments() {
  try {
    const rows = await apiCall('getStandardsJudgments');
    if (Array.isArray(rows) && rows.length > 1) {
      state.standardsJudgments = rows.slice(1).map(r => ({
        id: r[0], student_id: r[1], standard_id: r[2],
        judgment: r[3], locked: r[4] === true || r[4] === 'TRUE',
        date: r[5], notes: r[6] || '', period: r[7] || ''
      })).filter(j => j.id);
    }
  } catch(e) { console.warn('StandardsJudgments not loaded:', e); }
}

async function loadProgressionPlacements() {
  try {
    const rows = await apiCall('getProgressionPlacements');
    if (Array.isArray(rows) && rows.length > 1) {
      state.progressionPlacements = rows.slice(1).map(r => ({
        id: r[0], student_id: r[1], element: r[2], sub_element: r[3],
        level: r[4], date: r[5], notes: r[6] || '',
        ext_label: r[7] || '', ext_value: r[8] || ''
      })).filter(p => p.id);
    }
  } catch(e) { console.warn('ProgressionPlacements not loaded:', e); }
}

async function loadTaughtICs() {
  try {
    const rows = await apiCall('getTaughtICs');
    if (Array.isArray(rows) && rows.length > 1) {
      state.taughtICs = rows.slice(1).map(r => ({
        id: r[0], date: r[1], student_id: r[2],
        ic_id: r[3], status: r[4], notes: r[5] || ''
      })).filter(t => t.id);
    }
  } catch(e) { console.warn('TaughtICs not loaded:', e); }
}

async function saveTaughtICRecord(data) {
  const matches = state.taughtICs.filter(
    t => t.student_id === data.student_id && t.ic_id === data.ic_id
  );
  const existing = matches.length
    ? matches.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    : null;
  if (existing) {
    const result = await apiCall('updateTaughtIC', { id: existing.id, status: data.status, notes: data.notes || '' });
    if (result.success) { existing.status = data.status; existing.notes = data.notes || ''; }
    return result;
  } else {
    const result = await apiCall('saveTaughtIC', data);
    if (result.success) {
      state.taughtICs.push({ id: result.id, ...data });
    }
    return result;
  }
}

async function saveTaughtICsBatch(entries) {
  const result = await apiCall('saveTaughtICs', { entries });
  if (result.success) {
    entries.forEach((e, i) => {
      state.taughtICs.push({ id: result.ids?.[i] || 'local_' + Date.now() + '_' + i, ...e });
    });
  }
  return result;
}

async function saveStandardsJudgment(data) {
  const existing = state.standardsJudgments.find(
    j => j.student_id === data.student_id && j.standard_id === data.standard_id
  );
  let result;
  if (existing) {
    result = await apiCall('updateStandardsJudgment', { ...data, judgment_id: existing.id });
    if (result.success) {
      existing.judgment = data.judgment;
      existing.locked   = data.locked || false;
      existing.date     = data.date;
      existing.notes    = data.notes || '';
      existing.period   = data.period || '';
    }
  } else {
    result = await apiCall('saveStandardsJudgment', data);
    if (result.success) {
      state.standardsJudgments.push({
        id: result.judgment_id, student_id: data.student_id,
        standard_id: data.standard_id, judgment: data.judgment,
        locked: data.locked || false, date: data.date,
        notes: data.notes || '', period: data.period || ''
      });
    }
  }
  return result;
}

async function saveProgressionPlacement(data) {
  const existing = state.progressionPlacements.find(
    p => p.student_id === data.student_id &&
         p.element === data.element &&
         p.sub_element === data.sub_element
  );
  let result;
  if (existing) {
    result = await apiCall('updateProgressionPlacement', { ...data, placement_id: existing.id });
    if (result.success) {
      existing.level     = data.level;
      existing.date      = data.date;
      existing.notes     = data.notes || '';
      existing.ext_label = data.ext_label || '';
      existing.ext_value = data.ext_value || '';
    }
  } else {
    result = await apiCall('saveProgressionPlacement', data);
    if (result.success) {
      state.progressionPlacements.push({
        id: result.placement_id, ...data
      });
    }
  }
  return result;
}

async function addStudent(data) {
  const result = await apiCall('addStudent', data);
  if (result.success) {
    state.students.push({
      id: result.student_id,
      first_name: data.first_name,
      last_name: data.last_name,
      year_level: data.year_level,
      date_added: new Date().toISOString()
    });
    toast('Student added successfully', 'success');
    renderView();
  }
  return result;
}

async function saveProgress(data) {
  invalidateReadinessCache();
  const existing = state.progress.find(
    p => p.student_id === data.student_id && p.code === data.content_descriptor_code
  );
  if (existing) {
    const result = await apiCall('updateProgress', {
      progress_id: existing.id,
      mastery_level: data.mastery_level,
      date_assessed: data.date_assessed,
      teacher_notes: data.teacher_notes
    });
    if (result.success) {
      existing.mastery = data.mastery_level;
      existing.date = data.date_assessed;
      existing.notes = data.teacher_notes;
      toast('Progress updated', 'success');
    }
  } else {
    const result = await apiCall('saveProgress', data);
    if (result.success) {
      state.progress.push({
        id: result.progress_id,
        student_id: data.student_id,
        code: data.content_descriptor_code,
        mastery: data.mastery_level,
        date: data.date_assessed,
        notes: data.teacher_notes
      });
      toast('Progress saved', 'success');
    }
  }
  renderView();
}

async function saveProgressBatch(entries) {
  invalidateReadinessCache();
  const today = new Date().toISOString().split('T')[0];
  let savedCount = 0;
  for (const data of entries) {
    try {
      const existing = state.progress.find(
        p => p.student_id === data.student_id && p.code === data.content_descriptor_code
      );
      if (existing) {
        const result = await apiCall('updateProgress', {
          progress_id: existing.id,
          mastery_level: data.mastery_level,
          date_assessed: data.date_assessed || today,
          teacher_notes: data.teacher_notes || ''
        });
        if (result.success) {
          existing.mastery = data.mastery_level;
          existing.date = data.date_assessed || today;
          existing.notes = data.teacher_notes || '';
          savedCount++;
        }
      } else {
        const result = await apiCall('saveProgress', data);
        if (result.success) {
          state.progress.push({
            id: result.progress_id,
            student_id: data.student_id,
            code: data.content_descriptor_code,
            mastery: data.mastery_level,
            date: data.date_assessed || today,
            notes: data.teacher_notes || ''
          });
          savedCount++;
        }
      }
    } catch(e) {
      console.error('saveProgressBatch entry error:', e);
    }
  }
  return savedCount;
}

// ── SYNC STATE UI ──
function setSyncing(v) {
  state.syncing = v;
  const dot = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  if (v) { dot.className = 'sync-dot syncing'; label.textContent = 'Syncing…'; }
  else   { dot.className = 'sync-dot'; label.textContent = 'Connected'; }
}

function setError() {
  document.getElementById('sync-dot').className = 'sync-dot error';
  document.getElementById('sync-label').textContent = 'Sync error';
}

// ── TOAST ──
function toast(msg, type = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'info' ? '✦' : '✗';
  el.innerHTML = `<span>${icon}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), type === 'info' ? 4000 : 3000);
}

// ── HELPERS ──
function getInitials(s) { return ((s.first_name||'')[0]+(s.last_name||'')[0]).toUpperCase(); }
function getAvClass(i) { return 'av-' + (i % 6); }
function sortStudents(arr) {
  const by = state.studentSortBy || 'last_name';
  return [...arr].sort((a,b) => {
    if (by === 'first_name') return `${a.first_name}${a.last_name}`.localeCompare(`${b.first_name}${b.last_name}`);
    return `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`);
  });
}
function toggleStudentSort() {
  state.studentSortBy = state.studentSortBy === 'last_name' ? 'first_name' : 'last_name';
  renderView();
}
function getStudentProgress(sid) { return state.progress.filter(p => p.student_id === sid); }
function loadComponentsState() {
  try {
    const raw = localStorage.getItem('ct_components');
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch(e) { return []; }
}
function saveComponentsState() {
  try { localStorage.setItem('ct_components', JSON.stringify(state.components || [])); } catch(e) {}
}
function loadComponentProgressState() {
  try {
    const raw = localStorage.getItem('ct_component_progress');
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch(e) { return []; }
}
function saveComponentProgressState() {
  try { localStorage.setItem('ct_component_progress', JSON.stringify(state.componentProgress || [])); } catch(e) {}
}
function getComponentsForCode(code) {
  return (state.components || []).filter(c => c.contentDescriptorCode === code);
}
function addComponentForCode(code, description) {
  const clean = String(description || '').trim();
  if (!clean) return null;
  const duplicate = state.components.find(c =>
    c.contentDescriptorCode === code && c.description.toLowerCase() === clean.toLowerCase()
  );
  if (duplicate) return duplicate;
  const component = {
    id: `cmp_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    description: clean,
    contentDescriptorCode: code
  };
  state.components.push(component);
  saveComponentsState();
  return component;
}
function componentLabelToLegacyMastery(label) {
  if (label === 'Highly Competent' || label === 'Competent') return 'Achieved';
  if (label === 'Developing') return 'Developing';
  if (label === 'Emerging') return 'Emerging';
  return 'Not taught';
}
function getComponentMasterySummary(studentId, code) {
  const comps = getComponentsForCode(code);
  if (!comps.length) return null;
  const achievedCount = comps.filter(c => {
    const cp = state.componentProgress.find(p => p.student_id === studentId && p.component_id === c.id);
    return cp && (cp.mastery === 'Achieved' || cp.mastery === 'Competent' || cp.mastery === 'Highly Competent');
  }).length;
  const pct = Math.round((achievedCount / comps.length) * 100);
  let label = 'Emerging';
  if (pct >= 85) label = 'Highly Competent';
  else if (pct >= 60) label = 'Competent';
  else if (pct >= 30) label = 'Developing';
  return { total: comps.length, achieved: achievedCount, pct, label };
}
function getMasteryForCode(sid, code) {
  const summary = getComponentMasterySummary(sid, code);
  if (summary) return componentLabelToLegacyMastery(summary.label);
  const p = state.progress.find(x => x.student_id === sid && x.code === code);
  return p ? p.mastery : 'Not taught';
}
function masteryClass(m) {
  if (!m || m === 'Not taught') return 'mb-nottaught';
  return 'mb-' + m.toLowerCase().replace(' ', '');
}
function masteryDot(m) {
  if (m === 'Achieved')   return '●';
  if (m === 'Developing') return '◐';
  if (m === 'Emerging')   return '○';
  return '·';
}
function getProgressStats(sid) {
  const prog = getStudentProgress(sid);
  const achieved   = prog.filter(p => p.mastery === 'Achieved').length;
  const developing = prog.filter(p => p.mastery === 'Developing').length;
  const emerging   = prog.filter(p => p.mastery === 'Emerging').length;
  const total = state.curriculumCodes.length || 1;
  return { achieved, developing, emerging, total, pct: Math.round((achieved/total)*100) };
}

function getStripedRowSurface(index) {
  return index % 2 === 0 ? 'var(--surface)' : 'var(--surface-alt)';
}

function getReadableChipText(bgToken) {
  return bgToken === 'var(--surface-alt)' ? 'var(--text3)' : 'var(--primary-contrast)';
}

// ── PARSE CSV ──
// ── ASSESSMENT SCALE ──
const DEFAULT_ASSESSMENT_SCALE = [
  { id: 'not-evident',     label: 'Not Evident',     colour: 'var(--text3)',   bg: 'var(--surface-alt)',  description: 'No evidence of understanding yet' },
  { id: 'developing',      label: 'Developing',      colour: 'var(--rust)',    bg: 'var(--rust-dim)',  description: 'Beginning to show understanding with support' },
  { id: 'competent',       label: 'Competent',       colour: 'var(--gold)',    bg: 'var(--gold-dim)',  description: 'Demonstrates understanding at year level' },
  { id: 'highly-competent',label: 'Highly Competent',colour: 'var(--blue)',    bg: 'var(--blue-dim)',  description: 'Demonstrates thorough understanding at year level' },
  { id: 'outstanding',     label: 'Outstanding',     colour: 'var(--green)',   bg: 'var(--green-dim)', description: 'Demonstrates exceptional understanding, well above year level' },
];

function getScale() {
  return state.assessmentScale || DEFAULT_ASSESSMENT_SCALE;
}

function loadAssessmentScale() {
  try {
    const saved = localStorage.getItem('ct_assessment_scale');
    if (saved) state.assessmentScale = JSON.parse(saved);
  } catch(e) { /* use default */ }
}

function saveAssessmentScale(scale) {
  state.assessmentScale = scale;
  try { localStorage.setItem('ct_assessment_scale', JSON.stringify(scale)); } catch(e) {}
}

function getScaleItem(judgmentId) {
  return getScale().find(s => s.id === judgmentId) || null;
}

function getJudgmentForStudent(studentId, standardId) {
  return state.standardsJudgments.find(
    j => j.student_id === studentId && j.standard_id === standardId
  ) || null;
}

function getPlacementForStudent(studentId, element, subElement) {
  return state.progressionPlacements.find(
    p => p.student_id === studentId && p.element === element && p.sub_element === subElement
  ) || null;
}

// How many linked codes for a standard have been taught to a student
// Memoised readiness cache — rebuilt when taughtLog or progress changes
let _readinessCache = null;
function invalidateReadinessCache() { _readinessCache = null; }

// ── MASTERY BANNER SESSION STATE ──
let masteryBannerDismissedSession = false;
let masteryPickerState = { pairs: [], selections: {}, checked: new Set(), collapsedGroups: new Set() };

function getStandardReadiness(studentId, standardId) {
  if (!_readinessCache) _readinessCache = {};
  const key = studentId + '|' + standardId;
  if (_readinessCache[key]) return _readinessCache[key];

  const linkedCodes = state.curriculumCodes.filter(c => {
    const ids = (c['Linked Achievement IDs'] || c['Linked Aspect IDs'] || '')
      .split(',').map(x => x.trim()).filter(Boolean);
    return ids.includes(standardId);
  });

  if (!linkedCodes.length) {
    _readinessCache[key] = { taught:0, total:0, pct:0, masterySpread:{}, codes:[], noLinks:true };
    return _readinessCache[key];
  }

  const taught = linkedCodes.filter(c => wasCodeTaughtToStudent(studentId, c.Code)).length;
  const masterySpread = { Achieved:0, Developing:0, Emerging:0, 'Not taught':0 };
  linkedCodes.forEach(c => {
    const m = getMasteryForCode(studentId, c.Code);
    masterySpread[m] = (masterySpread[m] || 0) + 1;
  });

  _readinessCache[key] = {
    taught, total: linkedCodes.length,
    pct: Math.round(taught / linkedCodes.length * 100),
    masterySpread, codes: linkedCodes, noLinks: false
  };
  return _readinessCache[key];
}

function normaliseYear(val) {
  if (!val) return '';
  const v = val.toString().trim();
  if (v === 'Foundation' || v === 'Prep' || v === 'F') return 'F';
  const m = v.match(/^(?:Year\s*)?(\d+)$/);
  return m ? m[1] : v;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
    return obj;
  });
}

function parseCSVLine(line) {
  const result = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

// ── VIEWS ──
function showView(v) {
  // Warn if navigating away from bulk assess with unsaved changes
  if (state.currentView === 'bulk-assess' && state.bulkAssess) {
    const pending = Object.keys(state.bulkAssess.pendingChanges || {}).length;
    if (pending > 0 && v !== 'bulk-assess') {
      if (!confirm(`You have ${pending} unsaved change${pending>1?'s':''} in Bulk Assess. Leave without saving?`)) return;
      state.bulkAssess.pendingChanges = {};
    }
  }
  setCurrentView(v);
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('nav-' + v);
  if (nb) nb.classList.add('active');
  renderView();
}

function renderView() {
  const main = document.getElementById('main-content');
  if (main) main.setAttribute('data-view', state.currentView || 'dashboard');
  switch(state.currentView) {
    case 'dashboard':               renderDashboard(main); break;
    case 'students':                renderStudents(main); break;
    case 'student-detail':          renderStudentDetail(main); break;
    case 'overview':                renderClassOverview(main); break;
    case 'bulk-assess':             renderBulkAssess(main); break;
    case 'daily-log':               renderDailyLog(main); break;
    case 'unit-plans':              renderUnitPlans(main); break;
    case 'planner':                 renderPlanner(main); break;
    case 'coverage':                renderCoverage(main); break;
    case 'standards-judgments':     renderStandardsJudgments(main); break;
    case 'progression-placement':   renderProgressionPlacement(main); break;
    case 'admin':                   renderAdmin(main); break;
    case 'curriculum':              renderCurriculum(main); break;
    case 'standards':               renderStandards(main); break;
    case 'progressions':            renderProgressions(main); break;
    default:                        renderDashboard(main);
  }
}

// ════════════════════════════════════════════════════
// ── WEEKLY PLANNER (canonical planning surface) ──
// One consolidated planner: weekly board (Unscheduled + Mon–Fri), lesson drawer,
// IC linking (1–3 per lesson), drag/drop, week navigation. Lessons persist to
// localStorage for now (Sheets persistence is step two).
// ════════════════════════════════════════════════════

const PLANNER_WEEK_STORAGE_KEY = 'ct_planner_week_v1';

// Escape a value for safe interpolation inside a single-quoted JS string in an
// inline on* handler (guards against ids containing a backslash or apostrophe).
function plannerJsStr(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function renderPlanner(main) {
  // The board is Mon–Fri only — there is no Unscheduled column. Unit lessons waiting
  // to be scheduled live in the Unit Lessons rail; standalone lessons are always
  // created directly into a day (see plannerAddLesson). A standalone lesson can still
  // technically carry the legacy dayKey 'unscheduled' (e.g. pre-existing localStorage
  // from before this change — normalizeLessonPlan still accepts it, unchanged), so
  // those are surfaced separately below rather than silently dropped from the board.
  const plannerDays = [
    { key: 'mon', label: 'Monday' },
    { key: 'tue', label: 'Tuesday' },
    { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' },
    { key: 'fri', label: 'Friday' },
  ];

  if (!Array.isArray(state.lessonPlans)) state.lessonPlans = [];
  plannerEnsureUiState();

  const weekKey = plannerSelectedWeekKey();
  // Exclude lessons that belong to a unit — those are placed on the board via
  // scheduledSlots (below), not by their legacy weekKey/dayKey.
  const weekLessons = state.lessonPlans.filter(lesson => lesson.weekKey === weekKey && !lesson.unitId);
  // Any standalone lesson whose dayKey isn't one of the rendered columns (in practice
  // only the legacy 'unscheduled' value) — kept visible in their own area instead of
  // disappearing now that the Unscheduled column is gone.
  const unassignedLessons = weekLessons.filter(lesson => !PLANNER_SCHEDULABLE_DAYS.includes(lesson.dayKey));

  // Unit lessons appear on the same board as standalone lessons — one card per slot
  // that targets the displayed week. The same lesson can yield several occurrences
  // (multi-slot), so it renders once per matching slot.
  const unitOccurrences = [];
  (state.lessonPlans || []).forEach(lesson => {
    if (!lesson.unitId) return;
    (Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots : []).forEach(slot => {
      if (isValidScheduledSlot(slot) && slot.weekKey === weekKey) {
        unitOccurrences.push({ lesson, dayKey: slot.dayKey });
      }
    });
  });

  // Scope the selected lesson to the displayed week so navigating weeks doesn't leave
  // the drawer editing a now-hidden lesson from another week. A standalone lesson must
  // belong to this week; a unit lesson must have at least one occurrence this week —
  // either way, that's exactly the set of lessons whose card is reachable on this board.
  const anySelectedLesson = state.lessonPlans.find(lesson => lesson.id === state.plannerUi.selectedLessonId) || null;
  const selectedLesson = anySelectedLesson && (
    (!anySelectedLesson.unitId && weekLessons.some(l => l.id === anySelectedLesson.id)) ||
    (anySelectedLesson.unitId && unitOccurrences.some(o => o.lesson.id === anySelectedLesson.id))
  ) ? anySelectedLesson : null;
  if (!selectedLesson) {
    state.plannerUi.selectedLessonId = null;
    state.plannerUi.drawerOpen = false;
  }

  const noICsLoaded = !state.instructionalComponents.some(ic => !ic.isArchived);
  const boardIsEmpty = weekLessons.length === 0 && unitOccurrences.length === 0;

  const boardColumns = plannerDays.map(day => {
    // Combined standalone+unit order for this day (custom order if the teacher has
    // drag-reordered it, else the default standalone-then-unit order) — see
    // plannerDayItemsInOrder for the single source of truth shared with the reorder mutation.
    const items = plannerDayItemsInOrder(weekKey, day.key, weekLessons, unitOccurrences);
    const cardsHtml = items.map(item => {
      if (item.type === 'standalone') {
        const lesson = weekLessons.find(l => l.id === item.lessonId);
        return lesson ? plannerLessonCardHtml(lesson) : '';
      }
      const occ = unitOccurrences.find(o => o.dayKey === day.key && o.lesson.id === item.lessonId);
      return occ ? plannerUnitOccurrenceCardHtml(occ.lesson, weekKey, day.key) : '';
    }).join('');
    const isEmpty = items.length === 0;
    return `
      <section class="planner-lesson-column">
        <div class="planner-lesson-column-head">${day.label}</div>
        <div class="planner-lesson-column-body" ondragover="plannerAllowLessonDrop(event, '${day.key}')" ondrop="plannerDropLessonToDay(event, '${day.key}')" ondragleave="plannerLessonDropLeave(event)">
          ${isEmpty
            ? `<div class="planner-lesson-empty">No lessons</div>`
            : cardsHtml
          }
          <button class="planner-add-in-column" type="button" onclick="plannerAddLesson('${day.key}')">+ Add</button>
        </div>
      </section>
    `;
  }).join('');

  main.innerHTML = `
    <div class="topbar" style="padding:14px 24px">
      <div>
        <div class="topbar-title">Weekly Planner</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${escapeHtml(plannerWeekRangeLabel(weekKey))}</div>
      </div>
      <div class="topbar-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn" type="button" onclick="plannerShiftWeek(-1)">‹ Prev</button>
        <button class="btn" type="button" onclick="plannerGoToThisWeek()">This week</button>
        <button class="btn" type="button" onclick="plannerShiftWeek(1)">Next ›</button>
        <button class="btn btn-primary" id="planner-add-lesson-btn" type="button" onclick="plannerAddLesson()">+ Add Lesson</button>
      </div>
    </div>
    <div class="content planner-shell-layout">
      <aside class="card planner-unit-rail">
        <div class="card-head">
          <div class="card-title">Unit lessons</div>
          <div style="font-size:12px;color:var(--text3)">Drag onto a day to add a slot</div>
        </div>
        <div class="planner-unit-rail-body">${plannerUnitSidebarHtml()}</div>
      </aside>
      <section class="card planner-shell-board">
        <div class="card-head">
          <div class="card-title">Week Board</div>
          <div style="font-size:12px;color:var(--text3)">Click a lesson to edit · drag to move between days</div>
        </div>
        ${noICsLoaded ? `<div class="planner-banner">No Instructional Components are loaded yet — lessons need at least one IC. Load curriculum/IC data first.</div>` : ''}
        ${plannerUnassignedLessonsHtml(unassignedLessons)}
        ${boardIsEmpty ? `<div class="planner-empty-week">No lessons for this week yet. Use <strong>+ Add Lesson</strong> to create one, or drag a unit lesson from the left.</div>` : ''}
        <div class="planner-lesson-board">
          ${boardColumns}
        </div>
      </section>
      <aside class="card planner-shell-drawer">
        <div class="card-head">
          <div class="card-title">Lesson Drawer</div>
          <div style="font-size:12px;color:var(--text3)">${state.plannerUi.drawerOpen && selectedLesson ? 'Editing selected lesson' : 'Select a lesson card'}</div>
        </div>
        ${state.plannerUi.drawerOpen && selectedLesson
          ? plannerDrawerHtml(selectedLesson, plannerDays)
          : `<div class="planner-shell-placeholder">Select any lesson card from the weekly board to open editing.</div>`}
      </aside>
    </div>
  `;
}

// Fallback area for standalone lessons whose dayKey isn't one of the rendered board
// columns — in practice only the legacy 'unscheduled' value, which can no longer be
// assigned going forward (plannerAddLesson and the drawer's day picker are both
// weekday-only now) but can still exist in already-saved data. Rendered as ordinary,
// fully-interactive cards (click-to-edit, drag, duplicate, delete all work unchanged) so
// nothing is silently lost — dragging one onto a day column below reassigns it like any move.
function plannerUnassignedLessonsHtml(unassignedLessons) {
  if (!unassignedLessons.length) return '';
  const n = unassignedLessons.length;
  return `
    <div class="planner-banner">${n} lesson${n === 1 ? '' : 's'} from before this change ${n === 1 ? 'has' : 'have'} no day assigned. Drag onto a day below, or click one to pick a day.</div>
    <div class="planner-unassigned-cards">${unassignedLessons.map(lesson => plannerLessonCardHtml(lesson)).join('')}</div>
  `;
}

// Single source of truth for a day column's card order — shared by the board render
// and by plannerReorderWithinDay so both agree on "current order". Default order
// (no custom order recorded yet) is standalone lessons by position, then unit
// occurrences in their natural (scheduledSlots traversal) order — i.e. exactly what
// rendered before drag-to-reorder-within-day existed, so nothing shifts visually
// until a teacher actually reorders a day. A custom order (state.plannerUi.dayOrder,
// session-only — never touches scheduledSlots or the lesson data model) is applied
// as a stable sort key; items not yet in a recorded order keep their default
// relative order and fall in after any ranked items.
function plannerDayItemsInOrder(weekKey, dayKey, weekLessons, unitOccurrences) {
  const standalone = weekLessons
    .filter(lesson => lesson.dayKey === dayKey)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map(lesson => ({ type: 'standalone', lessonId: lesson.id }));
  const unit = unitOccurrences
    .filter(occ => occ.dayKey === dayKey)
    .map(occ => ({ type: 'unit', lessonId: occ.lesson.id }));
  let items = [...standalone, ...unit];

  const orderKey = weekKey + '|' + dayKey;
  const customOrder = state.plannerUi?.dayOrder?.[orderKey];
  if (Array.isArray(customOrder) && customOrder.length) {
    const rank = new Map(customOrder.map((id, i) => [id, i]));
    items = items
      .map((item, i) => ({ item, i, rank: rank.has(item.lessonId) ? rank.get(item.lessonId) : Infinity }))
      .sort((a, b) => a.rank - b.rank || a.i - b.i)
      .map(entry => entry.item);
  }
  return items;
}

function plannerLessonCardHtml(lesson) {
  const isSelected = state.plannerUi.selectedLessonId === lesson.id;
  const isTaught = lesson.status === 'taught';
  const icCount = Array.isArray(lesson.linkedICIds) ? lesson.linkedICIds.length : 0;
  const incomplete = icCount === 0;
  const openExpr = `plannerOpenLessonDrawerFromCard('${plannerJsStr(lesson.id)}')`;
  return `
    <div class="planner-lesson-card-wrap"
      ondragover="plannerCardDragOver(event, '${plannerJsStr(lesson.dayKey)}', '${plannerJsStr(lesson.id)}')"
    >
      <div
        class="planner-lesson-card ${isSelected ? 'is-selected' : ''} ${isTaught ? 'is-taught' : ''} ${incomplete ? 'is-incomplete' : ''}"
        draggable="true"
        ondragstart="plannerStartLessonDrag(event, '${plannerJsStr(lesson.id)}')"
        ondragend="plannerEndLessonDrag(event)"
        ${plannerCardOpenAttrs(openExpr)}
      >
        <div class="planner-lesson-card-title" title="${escapeHtml(lesson.title || 'Untitled lesson')}">${escapeHtml(lesson.title || 'Untitled lesson')}</div>
        <div class="planner-lesson-card-meta">${escapeHtml(lesson.subject || 'No subject')}</div>
        <div class="planner-lesson-card-tags">
          <span class="planner-status-pill ${isTaught ? 'is-taught' : ''}">${isTaught ? 'Taught' : 'Planned'}</span>
          ${incomplete ? `<span class="planner-status-pill is-incomplete">Needs IC</span>` : ''}
        </div>
      </div>
      <div class="planner-inline-actions">
        <button class="planner-mini-btn" type="button" onclick="plannerDuplicateLesson('${plannerJsStr(lesson.id)}')">Duplicate</button>
        <button class="planner-mini-btn" type="button" onclick="plannerDeleteLesson('${plannerJsStr(lesson.id)}')">Delete</button>
      </div>
    </div>
  `;
}

// HTML attributes that make the whole card body a click/keyboard-activatable trigger
// for opening the lesson drawer, alongside its existing role as a drag handle (native
// HTML5 drag-and-drop does not fire 'click' after an actual drag, so the two coexist
// without conflict — a plain press-and-release opens the drawer, a press-and-move-away
// drags the card instead). role="button" + onkeydown mirrors the pattern already used
// for other whole-element click targets in this file (e.g. .unit-card).
function plannerCardOpenAttrs(onclickExpr) {
  return `role="button" tabindex="0"
        onclick="${onclickExpr}"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onclickExpr}}"`;
}

// A unit lesson's card as it appears on the weekly board, scheduled for one slot
// (weekKey + dayKey). Visually distinct from standalone cards (.is-unit left border
// + unit chip). The card body is a drag handle — dragging it to another day moves this
// slot (remove old {weekKey, dayKey}, add new). Clicking the card opens it for editing;
// the ✕ removes only this occurrence.
function plannerUnitOccurrenceCardHtml(lesson, weekKey, dayKey) {
  const unit = unitForLesson(lesson);
  const unitTitle = unit ? (unit.title || 'Untitled unit') : 'Unit';
  const isTaught = lesson.teachingStatus === 'taught';
  const openExpr = `plannerOpenLessonDrawerFromCard('${plannerJsStr(lesson.id)}')`;
  return `
    <div class="planner-occ-wrap" data-occurrence="${escapeHtml(weekKey)}|${escapeHtml(dayKey)}"
      ondragover="plannerCardDragOver(event, '${plannerJsStr(dayKey)}', '${plannerJsStr(lesson.id)}')"
    >
      <div class="planner-lesson-card is-unit ${isTaught ? 'is-taught' : ''}"
        draggable="true"
        ondragstart="plannerStartOccurrenceDrag(event, '${plannerJsStr(lesson.id)}', '${plannerJsStr(weekKey)}', '${plannerJsStr(dayKey)}')"
        ondragend="plannerEndLessonDrag(event)"
        ${plannerCardOpenAttrs(openExpr)}>
        <div class="planner-lesson-card-title" title="${escapeHtml(lesson.title || 'Untitled lesson')}">${escapeHtml(lesson.title || 'Untitled lesson')}</div>
        <div class="planner-lesson-card-meta">${escapeHtml(lesson.subject || 'No subject')}</div>
        <div class="planner-lesson-card-tags">
          <span class="planner-unit-chip" title="Unit: ${escapeHtml(unitTitle)}">${escapeHtml(unitTitle)}</span>
          ${unitTeachingStatusBadgeHtml(lesson.teachingStatus)}
        </div>
        <div class="planner-card-actions">
          <button class="planner-occ-remove" type="button" title="Remove from this day"
            aria-label="Remove ${escapeHtml(lesson.title || 'lesson')} from this day"
            onclick="event.stopPropagation();plannerUnscheduleSlot('${plannerJsStr(lesson.id)}','${plannerJsStr(weekKey)}','${plannerJsStr(dayKey)}')"
            onkeydown="event.stopPropagation()">✕</button>
        </div>
      </div>
    </div>
  `;
}

// Left rail on the Weekly Planner: every unit's lessons, grouped by unit, always
// draggable onto a day to add a slot. Cards stay in the rail no matter how many slots
// a lesson already has (each card shows its current slot count), so drag-to-schedule
// works for the 2nd/3rd/... slot too — not just the first. Reuses the standalone drag
// start/end handlers; plannerDropLessonToDay branches on unitId.
function plannerUnitSidebarHtml() {
  const units = state.unitPlans || [];
  if (!units.length) {
    return `<div class="planner-unit-rail-empty">No units yet. Create units in <strong>Unit Plans</strong> to schedule their lessons onto the week.</div>`;
  }
  const groups = units
    .map(unit => ({ unit, lessons: unitGetLessons(unit) }))
    .filter(g => g.lessons.length);
  if (!groups.length) {
    return `<div class="planner-unit-rail-empty">No unit lessons yet. Add lessons to a unit in <strong>Unit Plans</strong> to schedule them here.</div>`;
  }
  return groups.map(({ unit, lessons }) => `
    <div class="planner-unit-group">
      <div class="planner-unit-group-head" title="${escapeHtml(unit.title || 'Untitled unit')}">${escapeHtml(unit.title || 'Untitled unit')}</div>
      ${lessons.map(l => plannerUnitSidebarLessonHtml(l)).join('')}
    </div>
  `).join('');
}

function plannerUnitSidebarLessonHtml(lesson) {
  const icCount = Array.isArray(lesson.linkedICIds) ? lesson.linkedICIds.length : 0;
  const slotCount = Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots.length : 0;
  return `
    <div class="planner-unit-pill" draggable="true"
      ondragstart="plannerStartLessonDrag(event,'${plannerJsStr(lesson.id)}')"
      ondragend="plannerEndLessonDrag(event)"
      title="Drag onto a day to add a slot">
      <span class="planner-unit-drag" aria-hidden="true">⠿</span>
      <div class="planner-unit-pill-main">
        <div class="planner-unit-pill-title">${escapeHtml(lesson.title || 'Untitled lesson')}</div>
        <div class="planner-unit-pill-meta">${escapeHtml(lesson.subject || 'No subject')} · ${icCount} IC${icCount === 1 ? '' : 's'}</div>
      </div>
      <span class="planner-unit-slot-count ${slotCount ? 'is-scheduled' : ''}" title="Scheduled on ${slotCount} day${slotCount === 1 ? '' : 's'}">${slotCount} slot${slotCount === 1 ? '' : 's'}</span>
    </div>
  `;
}

// Right-hand Lesson Drawer on the Weekly Planner. Pure dispatcher on lesson type — clicking
// any board card (standalone or unit) opens this drawer in place, never navigating to
// another view (see plannerOpenLessonDrawer). Each branch below is a
// self-contained "edit mode" renderer; a future quick-view (read-only summary) can sit
// as a separate layer in front of either without touching this edit-mode content.
function plannerDrawerHtml(lesson, plannerDays) {
  return lesson.unitId ? plannerUnitLessonEditHtml(lesson) : plannerStandaloneLessonEditHtml(lesson, plannerDays);
}

function plannerStandaloneLessonEditHtml(lesson, plannerDays) {
  const icCount = Array.isArray(lesson.linkedICIds) ? lesson.linkedICIds.length : 0;
  const isTaught = lesson.status === 'taught';
  // Day options are weekday-only going forward (no Unscheduled column to land in). A
  // lesson already carrying the legacy 'unscheduled' value (pre-existing data) still
  // shows that as its current selection instead of silently landing on Monday, so the
  // teacher makes an active choice rather than the UI making one for them.
  const dayOptions = plannerDays.map(day => `<option value="${day.key}" ${lesson.dayKey === day.key ? 'selected' : ''}>${day.label}</option>`).join('')
    + (lesson.dayKey === 'unscheduled' ? `<option value="unscheduled" selected>Unscheduled (legacy — pick a day)</option>` : '');
  return `
    <div style="padding:16px">
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" type="text" value="${escapeHtml(lesson.title || '')}" oninput="plannerUpdateSelectedLessonField('title', this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <select class="form-input" onchange="plannerUpdateSelectedLessonField('subject', this.value)">
          <option value="">— select subject —</option>
          ${PLANNER_SUBJECTS.map(s => `<option value="${s}" ${lesson.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Day</label>
        <select class="form-input" onchange="plannerUpdateSelectedLessonField('dayKey', this.value)">
          ${dayOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Learning intention</label>
        <textarea class="form-input" rows="3" placeholder="What am I trying to get kids to do or learn?" oninput="plannerUpdateSelectedLessonField('intention', this.value)">${escapeHtml(lesson.intention || '')}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Instructional Components (1–3) · ${icCount}/3 selected</label>
        ${icCount === 0 ? `<div class="planner-incomplete-note">This lesson is incomplete — add at least one IC before it can be marked taught.</div>` : ''}
        <div class="planner-selected-ics">${plannerSelectedICsHtml(lesson)}</div>
        <div class="planner-ic-controls">
          <input class="form-input" id="planner-ic-search" type="text" placeholder="Search ICs by name or code" value="${escapeHtml(state.plannerUi.icSearch || '')}" oninput="plannerHandleICSearchInput(this.value)">
          <button class="btn" type="button" onclick="plannerSuggestICsFromIntention()">Suggest from intention</button>
        </div>
        <div id="planner-ic-results" class="planner-ic-results">${plannerICResultsHtml(lesson)}</div>
      </div>

      <div class="form-group" style="margin-bottom:0;display:flex;gap:10px;align-items:center">
        ${isTaught
          ? `<button class="btn" type="button" onclick="plannerSetLessonStatus('planned')">Mark as planned</button>`
          : `<button class="btn btn-primary" type="button" onclick="plannerSetLessonStatus('taught')">Mark as taught</button>`}
        <span style="font-size:12px;color:var(--text3)">Status: ${isTaught ? 'Taught' : 'Planned'}</span>
      </div>
    </div>
  `;
}

// Unit lesson edit mode, opened by clicking its board card — the Weekly Planner's own
// drawer, not a navigation to Unit Plans (see plannerOpenLessonDrawer). Shares its core
// fields (title/subject/teaching status/intention/ICs) with the Unit Plans detail
// drawer via plannerUnitLessonFieldsHtml, then adds the schedule section and — since
// the board has no separate unit sidebar to show them in — a trailing unit-context
// block (linked curriculum descriptors + assessment notes) so nothing requires leaving
// the board to see or edit. unitCDPanelHtml/unitUpdateField are the exact functions
// Unit Plans' own sidebar uses; reused as-is, they re-render in place on this view too.
function plannerUnitLessonEditHtml(lesson) {
  const unit = unitForLesson(lesson);
  const unitContext = unit ? `
      <div class="planner-unit-context">
        <div class="planner-unit-context-title">Unit: ${escapeHtml(unit.title || 'Untitled unit')}</div>
        <div class="form-group">
          <label class="form-label">Linked curriculum descriptors</label>
          <div id="unit-cd-panel">${unitCDPanelHtml(unit)}</div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Assessment notes</label>
          <textarea class="form-input" rows="4" placeholder="How will this unit be assessed?"
            onblur="unitUpdateField('${plannerJsStr(unit.id)}','assessmentNotes',this.value)">${escapeHtml(unit.assessmentNotes || '')}</textarea>
        </div>
      </div>`
    : '';
  return `
    <div style="padding:16px">
      ${plannerUnitLessonFieldsHtml(lesson)}
      ${unitLessonScheduleHtml(lesson)}
      ${unitContext}
    </div>
  `;
}

function plannerSelectedICsHtml(lesson) {
  const ids = Array.isArray(lesson.linkedICIds) ? lesson.linkedICIds : [];
  if (!ids.length) return `<div style="font-size:12px;color:var(--text3)">No ICs linked yet.</div>`;
  return ids.map(id => {
    const ic = state.instructionalComponents.find(x => x.id === id);
    const label = ic ? (ic.name || ic.id) : id;
    const code = ic?.homeDescriptorId ? `<span class="planner-ic-chip">${escapeHtml(ic.homeDescriptorId)}</span> ` : '';
    return `<span class="planner-selected-ic">${code}${escapeHtml(label)}<button class="planner-ic-remove" type="button" onclick="plannerToggleLessonIC('${plannerJsStr(id)}')" title="Remove IC">×</button></span>`;
  }).join('');
}

// The unit a lesson belongs to, or null for standalone (Weekly Planner) lessons.
function unitForLesson(lesson) {
  if (!lesson || !lesson.unitId) return null;
  return (state.unitPlans || []).find(u => u.id === lesson.unitId) || null;
}

// Whether an IC is parented to any of the given CDs — homed on one, or tethered to
// one via linkedDescriptorIds. Mirrors getICsForDescriptor's membership test so the
// "From this unit's CDs" group matches what the Curriculum Codes view shows.
function icBelongsToCDs(ic, cdSet) {
  if (cdSet.has(ic.homeDescriptorId)) return true;
  const linked = Array.isArray(ic.linkedDescriptorIds) ? ic.linkedDescriptorIds : [];
  return linked.some(id => cdSet.has(id));
}

// Suggestion/search results for the IC picker (unit lessons additionally group ICs
// that cover the unit's linked CDs at the top).
function plannerICResultsHtml(lesson) {
  const subject = lesson.subject || '';
  const search = (state.plannerUi.icSearch || '').trim().toLowerCase();
  const selected = new Set(Array.isArray(lesson.linkedICIds) ? lesson.linkedICIds : []);

  const unit = unitForLesson(lesson);

  // Candidate pool: active ICs, scoped to the lesson's subject when one is chosen.
  // Kept un-year-filtered so the unit's focus-CD ICs can be surfaced in full (below)
  // even when the year filter is hiding other years. In a unit lesson, teacher-
  // suppressed system-default ICs are excluded the same way getICsForDescriptor and
  // the Curriculum Codes view exclude them, so a hidden IC can't reappear in either
  // group; the Weekly Planner picker (no unit) keeps its existing behaviour.
  const subjectPool = state.instructionalComponents.filter(ic => {
    if (ic.isArchived) return false;
    if (unit && ic.ownerTier === 'system_default' && ic.suppressedByTeacher) return false;
    if (!subject) return true;
    const cd = state.curriculumCodes.find(c => c.Code === ic.homeDescriptorId);
    return cd && cd.Subject === subject;
  });

  // Unit context (Issue 2): a lesson inside a unit defaults its IC picker to the
  // unit's year level (banded-subject aware, via the IC's home descriptor), with a
  // "Show all years" toggle. Standalone Weekly Planner lessons have no unit, so this
  // is a no-op there.
  const icYearFiltered = !!unit && !!normaliseYear(unit.yearLevel) && !state.plannerUi.icShowAllYears;
  let pool = subjectPool;
  if (icYearFiltered) {
    pool = subjectPool.filter(ic => {
      const cd = state.curriculumCodes.find(c => c.Code === ic.homeDescriptorId);
      return cd && unitCDMatchesYear(unit, cd);
    });
  }

  const matchesICSearch = ic => (
    (ic.name || '').toLowerCase().includes(search) ||
    (ic.description || '').toLowerCase().includes(search) ||
    (ic.homeDescriptorId || '').toLowerCase().includes(search)
  );

  let resultIcs;
  if (search) {
    resultIcs = pool.filter(matchesICSearch).slice(0, 30);
  } else if (Array.isArray(state.plannerUi.suggestedICIds) && state.plannerUi.suggestedICIds.length) {
    const sugg = new Set(state.plannerUi.suggestedICIds);
    resultIcs = pool.filter(ic => sugg.has(ic.id));
  } else {
    resultIcs = pool.slice(0, 20);
  }

  // Always-visible create action, pinned to the bottom of the results list.
  const createRow = `<button class="planner-ic-create" type="button" onclick="plannerOpenCreateICModal()">+ Create new IC</button>`;

  // Confidence is meaningful only for intention suggestions (not text search/browse).
  const scores = state.plannerUi.suggestionScores || {};
  const showConfidence = !search && Array.isArray(state.plannerUi.suggestedICIds) && state.plannerUi.suggestedICIds.length > 0;

  // Unit context (Issue 3): ICs covering the unit's linked CDs are the lesson's
  // primary focus, so they get their own group (in browse/search, not the suggestion
  // path). Membership matches getICsForDescriptor — homed on a linked CD OR tethered
  // via linkedDescriptorIds — and is deliberately NOT year-gated, so every IC parented
  // to a linked CD appears here even if its home descriptor belongs to another year.
  const linkedCDs = unit && Array.isArray(unit.linkedCDIds) && unit.linkedCDIds.length
    ? new Set(unit.linkedCDIds) : null;
  const fromCDs = (!showConfidence && linkedCDs)
    ? subjectPool
        .filter(ic => icBelongsToCDs(ic, linkedCDs) && (!search || matchesICSearch(ic)))
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
    : [];

  if (!resultIcs.length && !fromCDs.length) {
    let msg;
    if (!subject) msg = 'Choose a subject to see its ICs, or type the learning intention and tap Suggest.';
    else if (icYearFiltered) msg = `No ${escapeHtml(unitYearLabel(unit))} ICs here. Try “Show all years”, the search box, or tap Suggest.`;
    else msg = 'No matching ICs. Try the search box, or write the intention and tap Suggest.';
    return `<div class="planner-ic-empty">${msg}</div>${createRow}`;
  }

  // Per-IC confidence inherits the score of its home descriptor. Normalise against
  // the descriptors that actually render — some ranked descriptors have no loaded
  // ICs and never appear, and including their scores would deflate every tier.
  const maxScore = showConfidence
    ? Math.max(1, ...resultIcs.map(ic => scores[ic.homeDescriptorId] || 0))
    : 0;

  const expandedId = state.plannerUi.expandedICId;

  // Unit picker only: per-IC status tags. (a) Which OTHER lessons in this unit already
  // link the IC (so the teacher sees it's in use in the sequence); (b) whether the IC
  // has been taught to the class — derived from state.taughtICs, already loaded at app
  // init, so no extra fetch. Both maps are empty for standalone Weekly Planner lessons.
  const currentLessonId = state.plannerUi.selectedLessonId;
  const icAllocMap = new Map(); // ic_id -> [{ num, title }] for other lessons in this unit
  const taughtICIds = new Set();
  if (unit) {
    (unit.lessonIds || []).forEach((lid, idx) => {
      if (lid === currentLessonId) return; // skip the lesson being edited
      const l = state.lessonPlans.find(x => x.id === lid);
      if (!l || !Array.isArray(l.linkedICIds)) return;
      l.linkedICIds.forEach(icId => {
        if (!icAllocMap.has(icId)) icAllocMap.set(icId, []);
        icAllocMap.get(icId).push({ num: idx + 1, title: l.title || `Lesson ${idx + 1}` });
      });
    });
    const classStudentIds = new Set((state.students || []).map(s => String(s.id)));
    // Mirror getTaughtICStatus: only the most-recent record per student+IC counts, and
    // a cleared outcome is stored as status:'' (not deleted), so an IC counts as taught
    // only when some class student's latest record has a non-empty status. A raw row
    // match would wrongly badge cleared ICs as "Taught".
    const latestTaught = new Map(); // `${student}|${ic}` -> { date, status, icId }
    (state.taughtICs || []).forEach(t => {
      if (!classStudentIds.has(String(t.student_id))) return;
      const key = String(t.student_id) + '|' + String(t.ic_id);
      const prev = latestTaught.get(key);
      if (!prev || new Date(t.date) > new Date(prev.date)) {
        latestTaught.set(key, { date: t.date, status: t.status, icId: String(t.ic_id) });
      }
    });
    latestTaught.forEach(rec => { if (rec.status) taughtICIds.add(rec.icId); });
  }

  // Render a single IC as a flat row: a clickable body (toggles expand) plus an
  // always-functional tick button that never toggles the expand state.
  const rowHtml = (ic, conf) => {
    const on = selected.has(ic.id);
    const expanded = ic.id === expandedId;
    const code = ic.homeDescriptorId || '';
    const detail = expanded ? plannerICDetailHtml(ic) : '';
    // Unit picker only: show the IC number + early/middle/late stage tag, matching the
    // Curriculum Codes drawer. Gated on unit context so the Weekly Planner card is
    // unchanged. (sequenceOrder / difficultyStage already live on every IC.)
    const seqPrefix = (unit && Number.isFinite(ic.sequenceOrder))
      ? `<span class="planner-ic-option-seq">${ic.sequenceOrder}.</span> `
      : '';
    const stageRaw = ic.difficultyStage || '';
    const stageKey = stageRaw === 'early' ? 'early' : stageRaw === 'late' ? 'late' : 'middle';
    const stageTag = unit && stageRaw
      ? `<span class="planner-ic-stage is-${stageKey}">${escapeHtml(stageRaw)}</span>`
      : '';
    const allocEntries = unit ? (icAllocMap.get(ic.id) || []) : [];
    const allocTag = allocEntries.length
      ? `<span class="planner-ic-alloc" title="${escapeHtml(allocEntries.map(e => e.title).join(' · '))}">In lesson${allocEntries.length > 1 ? 's' : ''} ${allocEntries.map(e => e.num).join(', ')}</span>`
      : '';
    const taughtTag = (unit && taughtICIds.has(String(ic.id)))
      ? `<span class="planner-ic-taught" title="Already taught to this class">Taught</span>`
      : '';
    return `<div class="planner-ic-option ${on ? 'is-on' : ''} ${expanded ? 'is-expanded' : ''}">
      <div class="planner-ic-option-body" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}" data-ic-id="${escapeHtml(ic.id)}" onclick="plannerToggleICExpand('${plannerJsStr(ic.id)}')" onkeydown="plannerICBodyKeydown(event, '${plannerJsStr(ic.id)}')">
        <div class="planner-ic-option-head">
          <span class="planner-ic-option-label">${seqPrefix}${escapeHtml(ic.name || ic.id)}</span>
          ${code ? `<span class="planner-ic-option-code">${escapeHtml(code)}</span>` : ''}
          ${stageTag}
          ${allocTag}
          ${taughtTag}
          ${conf ? `<span class="planner-ic-confidence is-${conf.key}"><span class="planner-ic-conf-dot"></span>${conf.label}</span>` : ''}
        </div>
        ${detail}
      </div>
      <button class="planner-ic-tick-btn ${on ? 'is-on' : ''}" type="button" title="${on ? 'Remove from lesson' : 'Add to lesson'}" onclick="plannerToggleLessonIC('${plannerJsStr(ic.id)}')">
        <span class="planner-ic-tick">${on ? '✓' : '+'}</span>
      </button>
    </div>`;
  };

  if (!showConfidence) {
    // Manual search/browse: alphabetical by IC name, create action at the bottom.
    const byName = arr => arr.slice().sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

    // Unit context (Issue 3): surface the unit's focus-CD ICs (computed above, not
    // year-gated) first; everything else falls under the year-scoped "Other" group,
    // de-duped against the focus group. Standalone lessons / units with no linked CDs
    // (fromCDs empty) fall back to a flat list with no headings.
    if (fromCDs.length) {
      const fromIds = new Set(fromCDs.map(ic => ic.id));
      const others = byName(resultIcs.filter(ic => !fromIds.has(ic.id)));
      const heading = txt => `<div class="planner-ic-group-heading">${txt}</div>`;
      const otherLabel = icYearFiltered ? `Other ${escapeHtml(unitYearLabel(unit))} ICs` : 'Other ICs';
      let html = heading("From this unit's CDs") + fromCDs.map(ic => rowHtml(ic, null)).join('');
      if (others.length) html += heading(otherLabel) + others.map(ic => rowHtml(ic, null)).join('');
      return html + createRow;
    }

    return byName(resultIcs).map(ic => rowHtml(ic, null)).join('') + createRow;
  }

  // Suggestion path: strong → partial → Create new IC → weak. Within each band,
  // order by raw score so the closest matches surface first.
  const ranked = resultIcs
    .map(ic => ({ ic, score: scores[ic.homeDescriptorId] || 0 }))
    .map(item => ({ ...item, conf: plannerConfidenceTier(item.score, maxScore) }))
    .sort((a, b) => b.score - a.score);
  const nonWeak = ranked.filter(item => !item.conf || item.conf.key !== 'weak')
    .map(item => rowHtml(item.ic, item.conf)).join('');
  const weak = ranked.filter(item => item.conf && item.conf.key === 'weak')
    .map(item => rowHtml(item.ic, item.conf)).join('');
  return nonWeak + createRow + weak;
}

// Expanded IC detail: description, example of success (green), common error
// (rust). Only renders fields that are populated.
function plannerICDetailHtml(ic) {
  const parts = [];
  if (ic.description) {
    parts.push(`<div class="planner-ic-detail-desc">${escapeHtml(ic.description)}</div>`);
  }
  if (ic.exampleOfSuccess) {
    parts.push(`<div class="planner-ic-detail-field">
      <div class="planner-ic-detail-label is-success">Example of success</div>
      <div class="planner-ic-detail-text">${escapeHtml(ic.exampleOfSuccess)}</div>
    </div>`);
  }
  if (ic.commonError) {
    parts.push(`<div class="planner-ic-detail-field">
      <div class="planner-ic-detail-label is-error">Common error</div>
      <div class="planner-ic-detail-text">${escapeHtml(ic.commonError)}</div>
    </div>`);
  }
  if (!parts.length) return '';
  return `<div class="planner-ic-detail">${parts.join('')}</div>`;
}

// Activate the expandable IC body from the keyboard (it carries role="button",
// so Enter and Space must toggle it the way a real button would).
function plannerICBodyKeydown(ev, icId) {
  if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
    ev.preventDefault();
    plannerToggleICExpand(icId);
  }
}

// Toggle expanded IC detail. Only one IC is expanded at a time; expanding a new
// row collapses the previous. Re-render only the results container to preserve
// the search field's focus. The innerHTML rebuild resets the scroller and drops
// focus, so capture/restore scrollTop and re-focus the toggled row afterwards.
function plannerToggleICExpand(icId) {
  plannerEnsureUiState();
  state.plannerUi.expandedICId = state.plannerUi.expandedICId === icId ? null : icId;
  const lesson = state.lessonPlans.find(item => item.id === state.plannerUi.selectedLessonId);
  const container = document.getElementById('planner-ic-results');
  if (!lesson || !container) return;
  const scrollTop = container.scrollTop;
  container.innerHTML = plannerICResultsHtml(lesson);
  container.scrollTop = scrollTop;
  const sel = (window.CSS && CSS.escape) ? CSS.escape(icId) : icId;
  const body = container.querySelector('[data-ic-id="' + sel + '"]');
  if (body && typeof body.focus === 'function') body.focus();
}

// Bucket a descriptor's intention-match score into a three-tier confidence label,
// normalised to the top-scoring rendered suggestion (raw scores scale with
// intention length, so absolute cut-offs don't generalise). Boundaries from the
// observed distribution: top cluster >=0.80 strong, mid 0.50-0.79 partial, tail <0.50 weak.
function plannerConfidenceTier(score, maxScore) {
  if (!score || !maxScore) return null;
  const ratio = score / maxScore;
  if (ratio >= 0.80) return { key: 'strong', label: 'Strong' };
  if (ratio >= 0.50) return { key: 'partial', label: 'Partial' };
  return { key: 'weak', label: 'Weak' };
}

function plannerEnsureUiState() {
  if (!state.plannerUi || typeof state.plannerUi !== 'object') state.plannerUi = {};
  if (typeof state.plannerUi.selectedLessonId === 'undefined') state.plannerUi.selectedLessonId = null;
  if (typeof state.plannerUi.drawerOpen === 'undefined') state.plannerUi.drawerOpen = false;
  if (typeof state.plannerUi.draggingLessonId === 'undefined') state.plannerUi.draggingLessonId = null;
  if (typeof state.plannerUi.draggingSlot === 'undefined') state.plannerUi.draggingSlot = null;
  // Within-day drag-to-reorder (session-only, never persisted): insertionTarget tracks
  // the live hover position during a drag; dayOrder records the resulting custom card
  // order per "weekKey|dayKey" so it survives re-renders without touching the lesson
  // data model or scheduledSlots (see plannerDayItemsInOrder / plannerReorderWithinDay).
  if (typeof state.plannerUi.insertionTarget === 'undefined') state.plannerUi.insertionTarget = null;
  if (!state.plannerUi.dayOrder || typeof state.plannerUi.dayOrder !== 'object') state.plannerUi.dayOrder = {};
  if (typeof state.plannerUi.icSearch !== 'string') state.plannerUi.icSearch = '';
  if (!Array.isArray(state.plannerUi.suggestedICIds)) state.plannerUi.suggestedICIds = [];
  if (!state.plannerUi.suggestionScores || typeof state.plannerUi.suggestionScores !== 'object') state.plannerUi.suggestionScores = {};
  if (typeof state.plannerUi.expandedICId === 'undefined') state.plannerUi.expandedICId = null;
  if (typeof state.plannerUi.icShowAllYears !== 'boolean') state.plannerUi.icShowAllYears = false;
  if (typeof state.plannerUi.pendingStubForLessonId === 'undefined') state.plannerUi.pendingStubForLessonId = null;
  if (!isValidIsoDate(state.plannerUi.weekKey)) state.plannerUi.weekKey = plannerNormalizeWeekStart(loadPlannerWeek());
}

function plannerSelectedWeekKey() {
  plannerEnsureUiState();
  return state.plannerUi.weekKey;
}

function plannerWeekRangeLabel(weekKey) {
  const start = parseIsoDateLocal(weekKey);
  if (!start) return 'This week';
  const end = parseIsoDateLocal(addDaysToDate(weekKey, 4));
  const opts = { day: 'numeric', month: 'short' };
  return `Week of ${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', opts)}`;
}

function plannerShiftWeek(deltaWeeks) {
  plannerEnsureUiState();
  state.plannerUi.weekKey = plannerNormalizeWeekStart(addDaysToDate(state.plannerUi.weekKey, deltaWeeks * 7));
  savePlannerWeek();
  renderView();
}

function plannerGoToThisWeek() {
  plannerEnsureUiState();
  state.plannerUi.weekKey = plannerNormalizeWeekStart(toIsoDate(getWeekStart()));
  savePlannerWeek();
  renderView();
}

function loadPlannerWeek() {
  try {
    const raw = localStorage.getItem(PLANNER_WEEK_STORAGE_KEY);
    return isValidIsoDate(raw) ? raw : toIsoDate(getWeekStart());
  } catch (e) {
    return toIsoDate(getWeekStart());
  }
}

function savePlannerWeek() {
  try { localStorage.setItem(PLANNER_WEEK_STORAGE_KEY, state.plannerUi.weekKey); } catch (e) {}
}

function plannerOpenLessonDrawer(lessonId) {
  if (!state.lessonPlans.some(lesson => lesson.id === lessonId)) return;
  state.plannerUi.selectedLessonId = lessonId;
  state.plannerUi.drawerOpen = true;
  state.plannerUi.icSearch = '';
  state.plannerUi.suggestedICIds = [];
  state.plannerUi.expandedICId = null;
  state.plannerUi.icShowAllYears = false;  // default the IC picker to the unit's year
  renderView();
}

// Pencil entry point for a board card specifically (both standalone and unit
// occurrence cards). Wraps plannerOpenLessonDrawer — unchanged, and still used as-is
// by Unit Plans' own lesson-row click — with a reset of the unit CD search/year filter
// for a unit lesson, so the trailing unit-context CD panel in plannerUnitLessonEditHtml
// doesn't inherit stale filter state left over from a previous Unit Plans session. This
// reset must NOT live inside plannerOpenLessonDrawer itself: that function also opens a
// lesson's edit drawer from within the Unit Plans detail view, where the CD search is
// live in that view's own sidebar — resetting it there on every lesson-row click would
// be an unwanted behaviour change to a different view.
function plannerOpenLessonDrawerFromCard(lessonId) {
  const lesson = state.lessonPlans.find(l => l.id === lessonId);
  if (lesson && lesson.unitId) {
    unitPlansEnsureUiState();
    state.unitPlansUi.cdSearch = '';
    state.unitPlansUi.cdShowAllYears = false;
  }
  plannerOpenLessonDrawer(lessonId);
}

function plannerStartLessonDrag(ev, lessonId) {
  state.plannerUi.draggingLessonId = lessonId;
  state.plannerUi.draggingSlot = null;
  if (ev?.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', lessonId);
  }
}

// Drag start for an on-board unit occurrence: as well as the lesson id, stash the
// source {weekKey, dayKey} so the drop can relocate *that* slot (move, not append).
function plannerStartOccurrenceDrag(ev, lessonId, weekKey, dayKey) {
  if (ev) ev.stopPropagation();
  state.plannerUi.draggingLessonId = lessonId;
  state.plannerUi.draggingSlot = { lessonId, weekKey, dayKey };
  if (ev?.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', lessonId);
  }
}

// Column-level dragover: cross-day drops keep the existing glow feedback unchanged.
// A same-day hover (the dragged card's current day === this column) is a reorder,
// not a move — so the glow is suppressed in favour of the insertion line, shown at
// the end of the list (this only fires when the cursor is over the column background
// itself, not a specific card; hovering a card is handled by plannerCardDragOver,
// which stops the event from bubbling here).
// Column-level dragover: fires while hovering the column background itself. A specific
// card being hovered is handled entirely by plannerCardDragOver below, which always
// stops propagation — so this only ever runs for "empty space in this column" (an
// empty day, or the gap below the last card), where the insertion line defaults to
// "insert at the end". The glow stays cross-day-only, same-day reorder relies on the
// insertion line alone.
function plannerAllowLessonDrop(ev, dayKey) {
  ev.preventDefault();
  if (!state.plannerUi.draggingLessonId) return;
  const zone = ev.currentTarget;
  const sameDayDrag = dayKey === plannerCurrentDragOriginDay();
  if (zone) { if (sameDayDrag) zone.classList.remove('drop-over'); else zone.classList.add('drop-over'); }
  state.plannerUi.insertionTarget = { dayKey, lessonId: null, before: false };
  plannerShowInsertionLineAtEnd(zone);
}

// Card-level dragover: takes over from the column handler whenever a specific card is
// hovered, for both a same-day reorder AND a cross-day placement — either way the
// insertion line shows exactly where the card will land, rather than always landing
// at the bottom. Always stops propagation so the column handler above can't re-run and
// clobber this precise target with its "insert at end" default while a card is hovered.
function plannerCardDragOver(ev, dayKey, hoveredLessonId) {
  const draggingId = state.plannerUi.draggingLessonId;
  if (!draggingId || draggingId === hoveredLessonId) return;
  ev.preventDefault();
  ev.stopPropagation();
  const zone = ev.currentTarget.parentElement;
  const sameDayDrag = dayKey === plannerCurrentDragOriginDay();
  // Same-day reorder: insertion line is the ONLY indicator (glow suppressed). Cross-day:
  // keep the existing glow alongside the insertion line, unchanged from before.
  if (zone) { if (sameDayDrag) zone.classList.remove('drop-over'); else zone.classList.add('drop-over'); }
  const rect = ev.currentTarget.getBoundingClientRect();
  const before = (ev.clientY - (rect.top || 0)) < (rect.height || 0) / 2;
  state.plannerUi.insertionTarget = { dayKey, lessonId: hoveredLessonId, before };
  plannerShowInsertionLine(ev.currentTarget, before);
}

// The day the currently-dragged card lives on right now (before the drop), so
// dragover handlers can tell a same-day reorder apart from a cross-day move. A
// rail-dragged unit lesson (no draggingSlot yet — it isn't on the board) has no
// current day, so it never matches and always falls through to the existing
// schedule/append path, never the reorder path.
function plannerCurrentDragOriginDay() {
  const draggingId = state.plannerUi.draggingLessonId;
  if (!draggingId) return null;
  const draggingSlot = state.plannerUi.draggingSlot;
  if (draggingSlot && draggingSlot.lessonId === draggingId) return draggingSlot.dayKey;
  const lesson = state.lessonPlans.find(l => l.id === draggingId);
  if (!lesson || lesson.unitId) return null;
  return lesson.dayKey;
}

function plannerLessonDropLeave(ev) {
  const zone = ev.currentTarget;
  if (zone) zone.classList.remove('drop-over');
}

function plannerEndLessonDrag() {
  state.plannerUi.draggingLessonId = null;
  state.plannerUi.draggingSlot = null;
  state.plannerUi.insertionTarget = null;
  plannerClearInsertionLine();
  document.querySelectorAll('.planner-lesson-column-body.drop-over').forEach(el => el.classList.remove('drop-over'));
}

// ── Within-day drag-to-reorder: insertion line ──
// A single shared DOM node moved into place via insertBefore as the cursor moves,
// rather than a permanent element baked into every card's template.
function plannerInsertionLineEl() {
  let line = document.getElementById('planner-insertion-line');
  if (!line) {
    line = document.createElement('div');
    line.id = 'planner-insertion-line';
    line.className = 'planner-insertion-line';
    line.setAttribute('aria-hidden', 'true');
  }
  return line;
}

function plannerShowInsertionLine(cardWrapEl, before) {
  if (!cardWrapEl || !cardWrapEl.parentNode) return;
  const line = plannerInsertionLineEl();
  cardWrapEl.parentNode.insertBefore(line, before ? cardWrapEl : cardWrapEl.nextSibling);
}

function plannerShowInsertionLineAtEnd(columnBodyEl) {
  if (!columnBodyEl) return;
  const line = plannerInsertionLineEl();
  const addBtn = columnBodyEl.querySelector('.planner-add-in-column');
  columnBodyEl.insertBefore(line, addBtn || null);
}

function plannerClearInsertionLine() {
  const line = document.getElementById('planner-insertion-line');
  if (line && line.parentNode) line.parentNode.removeChild(line);
}

// ── Unit lesson scheduling (PR2): scheduledSlots <-> Weekly Planner board ──
// A unit lesson is placed on the board by appending {weekKey, dayKey} entries to its
// scheduledSlots array. The same lesson can hold several slots (re-teaching / spreading
// content across days or weeks), so it renders once per slot. Standalone (non-unit)
// lessons keep using their legacy weekKey/dayKey fields and are never touched here.
// (PLANNER_SCHEDULABLE_DAYS is declared near the top of the file so normalize can use it.)

// A well-formed slot: a weekKey that is an ISO date normalized to the week's Monday,
// and a real weekday dayKey. The single source of truth for slot validity — used by
// normalize (to drop stale/hand-edited localStorage entries), the drawer, and the board
// loop. An invalid-but-truthy slot would otherwise count as "scheduled" (hiding the
// lesson from the rail) yet never match the board, stranding the lesson in the UI. The
// week-start check matters because the board only matches plannerSelectedWeekKey() (a
// Monday), so a non-week-start weekKey could never render; dropping it returns the
// lesson to the rail to be re-scheduled. (App writes are always normalized, so this only
// bites corrupted storage.)
function isValidScheduledSlot(s) {
  return !!s && typeof s === 'object'
    && typeof s.weekKey === 'string' && isValidIsoDate(s.weekKey)
    && plannerNormalizeWeekStart(s.weekKey) === s.weekKey
    && PLANNER_SCHEDULABLE_DAYS.includes(s.dayKey);
}

// Append a {weekKey, dayKey} slot to a lesson, de-duping an identical entry so the
// same lesson cannot stack two cards on one day. Returns a new lesson object.
function lessonWithScheduledSlot(lesson, weekKey, dayKey) {
  const slots = Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots : [];
  const exists = slots.some(s => s && s.weekKey === weekKey && s.dayKey === dayKey);
  const next = exists ? slots.slice() : [...slots, { weekKey, dayKey }];
  return { ...lesson, scheduledSlots: next };
}

// Remove one {weekKey, dayKey} slot from a lesson (a single board occurrence).
// De-dupe on add guarantees at most one match, so removing by value is unambiguous.
function lessonWithoutScheduledSlot(lesson, weekKey, dayKey) {
  const slots = Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots : [];
  return { ...lesson, scheduledSlots: slots.filter(s => !(s && s.weekKey === weekKey && s.dayKey === dayKey)) };
}

// Schedule a unit lesson onto a board day (append a slot). Shared by the drag-drop
// path and the drawer fallback. Only real weekdays are schedulable; teachingStatus is
// deliberately left untouched (scheduling and teaching status stay independent).
// Returns true when a new slot was added, false on a no-op (bad day / dupe / missing).
function plannerScheduleUnitLesson(lessonId, weekKey, dayKey) {
  if (!PLANNER_SCHEDULABLE_DAYS.includes(dayKey)) {
    toast('Unit lessons schedule onto a weekday — drop on Mon–Fri', 'info');
    return false;
  }
  if (!isValidIsoDate(weekKey)) return false;
  const wk = plannerNormalizeWeekStart(weekKey);
  const idx = state.lessonPlans.findIndex(l => l.id === lessonId);
  if (idx < 0) return false;
  const lesson = state.lessonPlans[idx];
  if (!lesson.unitId) return false; // standalone lessons use the legacy day write
  const before = (Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots : []).length;
  state.lessonPlans[idx] = lessonWithScheduledSlot(lesson, wk, dayKey);
  saveLessonPlansState();
  if (state.lessonPlans[idx].scheduledSlots.length === before) {
    toast('Already scheduled on that day', 'info');
    return false;
  }
  return true;
}

// Remove a single board occurrence (one slot) of a unit lesson. teachingStatus is
// left untouched. Does not offer a bulk "clear all" — removal is always per-slot.
function plannerUnscheduleSlot(lessonId, weekKey, dayKey) {
  const idx = state.lessonPlans.findIndex(l => l.id === lessonId);
  if (idx < 0) return;
  state.lessonPlans[idx] = lessonWithoutScheduledSlot(state.lessonPlans[idx], weekKey, dayKey);
  saveLessonPlansState();
  renderView();
}

// Relocate one existing occurrence: drop the source {weekKey, dayKey} slot and add the
// target one (drag a scheduled unit card from one day to another). teachingStatus is
// left untouched. Returns true when the slot moved, false on a no-op.
function plannerMoveScheduledSlot(lessonId, fromWeekKey, fromDayKey, toWeekKey, toDayKey) {
  if (!PLANNER_SCHEDULABLE_DAYS.includes(toDayKey)) {
    toast('Unit lessons schedule onto a weekday — drop on Mon–Fri', 'info');
    return false;
  }
  const toWk = isValidIsoDate(toWeekKey) ? plannerNormalizeWeekStart(toWeekKey) : null;
  if (!toWk) return false;
  if (fromWeekKey === toWk && fromDayKey === toDayKey) return false; // dropped on the same day
  const idx = state.lessonPlans.findIndex(l => l.id === lessonId);
  if (idx < 0) return false;
  let lesson = state.lessonPlans[idx];
  if (!lesson.unitId) return false;
  // If the target day already holds this lesson, moving onto it would drop the source
  // slot yet de-dupe the add — silently losing an occurrence. Treat it as a no-op.
  const slots = Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots : [];
  if (slots.some(s => s && s.weekKey === toWk && s.dayKey === toDayKey)) {
    toast('Already scheduled on that day', 'info');
    return false;
  }
  lesson = lessonWithoutScheduledSlot(lesson, fromWeekKey, fromDayKey);
  lesson = lessonWithScheduledSlot(lesson, toWk, toDayKey);
  state.lessonPlans[idx] = lesson;
  saveLessonPlansState();
  return true;
}

function plannerDropLessonToDay(ev, targetDayKey) {
  ev.preventDefault();
  const zone = ev.currentTarget;
  if (zone) zone.classList.remove('drop-over');
  const lessonId = ev?.dataTransfer?.getData('text/plain') || state.plannerUi.draggingLessonId;
  const draggingSlot = state.plannerUi.draggingSlot;
  const insertionTarget = state.plannerUi.insertionTarget;
  state.plannerUi.draggingLessonId = null;
  state.plannerUi.draggingSlot = null;
  state.plannerUi.insertionTarget = null;
  plannerClearInsertionLine();
  if (!lessonId) return;

  const idx = state.lessonPlans.findIndex(lesson => lesson.id === lessonId);
  if (idx < 0) return;

  const weekKey = plannerSelectedWeekKey();
  const isUnit = !!state.lessonPlans[idx].unitId;
  const isOccurrenceDrag = isUnit && draggingSlot && draggingSlot.lessonId === lessonId;
  // The day this card currently occupies (before the drop). Unit lessons dragged from
  // the rail (no draggingSlot — they aren't on the board yet) have no origin day, so
  // they never match a same-day reorder and always fall through to scheduling below.
  const originDayKey = isUnit ? (isOccurrenceDrag ? draggingSlot.dayKey : null) : state.lessonPlans[idx].dayKey;
  const target = (insertionTarget && insertionTarget.dayKey === targetDayKey) ? insertionTarget : null;

  // Same-day drop: reorder within the column (visual order only — never touches
  // scheduledSlots or dayKey/position) instead of moving/scheduling.
  if (originDayKey === targetDayKey) {
    plannerReorderWithinDay(weekKey, targetDayKey, lessonId, target);
    renderView();
    return;
  }

  // Unit lessons live on the board via scheduledSlots. Dragging an *existing* board
  // occurrence relocates that slot; dragging a card from the rail appends a new slot.
  // Standalone lessons keep their legacy write (unchanged — still just an append).
  // Either way, once the lesson lands on the target day, place it at the hovered
  // position via plannerReorderWithinDay (falls back to "end" if nothing was hovered)
  // — that only ever writes the session-only display order, never scheduledSlots or
  // dayKey/position beyond the append they already performed.
  let moved;
  if (isUnit) {
    moved = isOccurrenceDrag
      ? plannerMoveScheduledSlot(lessonId, draggingSlot.weekKey, draggingSlot.dayKey, weekKey, targetDayKey)
      : plannerScheduleUnitLesson(lessonId, weekKey, targetDayKey);
  } else {
    const maxPos = state.lessonPlans
      .filter(lesson => lesson.weekKey === weekKey && lesson.dayKey === targetDayKey && lesson.id !== lessonId)
      .reduce((max, lesson) => Math.max(max, lesson.position || 0), 0);
    state.lessonPlans[idx] = { ...state.lessonPlans[idx], dayKey: targetDayKey, position: maxPos + 1 };
    saveLessonPlansState();
    moved = true;
  }
  if (moved) plannerReorderWithinDay(weekKey, targetDayKey, lessonId, target);
  renderView();
}

// Places a card at a specific position within a day — used both for a same-day
// drag-to-reorder AND, after a cross-day move/schedule has already landed the lesson
// on the target day, to slot it in at the hovered position instead of always the end.
// Session-only: it records a display order in state.plannerUi.dayOrder (read back by
// plannerDayItemsInOrder on every render) and never touches scheduledSlots,
// dayKey/position, or teachingStatus. Works uniformly whether movedLessonId was
// already in this day's list (a pure reorder) or is arriving for the first time (a
// cross-day drop) — either way it's filtered out of the current order, if present,
// then reinserted at the computed position.
function plannerReorderWithinDay(weekKey, dayKey, movedLessonId, insertionTarget) {
  const weekLessons = state.lessonPlans.filter(l => l.weekKey === weekKey && !l.unitId);
  const unitOccurrences = [];
  state.lessonPlans.forEach(lesson => {
    if (!lesson.unitId) return;
    (Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots : []).forEach(slot => {
      if (isValidScheduledSlot(slot) && slot.weekKey === weekKey) {
        unitOccurrences.push({ lesson, dayKey: slot.dayKey });
      }
    });
  });

  const currentIds = plannerDayItemsInOrder(weekKey, dayKey, weekLessons, unitOccurrences).map(item => item.lessonId);
  const ids = currentIds.filter(id => id !== movedLessonId);

  let insertAt = ids.length; // default: dropped on empty space -> end of the list
  if (insertionTarget && insertionTarget.lessonId && insertionTarget.lessonId !== movedLessonId) {
    const targetIdx = ids.indexOf(insertionTarget.lessonId);
    if (targetIdx >= 0) insertAt = insertionTarget.before ? targetIdx : targetIdx + 1;
  }
  ids.splice(insertAt, 0, movedLessonId);

  if (!state.plannerUi.dayOrder || typeof state.plannerUi.dayOrder !== 'object') state.plannerUi.dayOrder = {};
  state.plannerUi.dayOrder[weekKey + '|' + dayKey] = ids;
}

function plannerAddLesson(dayKey) {
  plannerEnsureUiState();
  const weekKey = plannerSelectedWeekKey();
  // New lessons always land on a real day — there's no Unscheduled column to hold an
  // unassigned one. The per-column "+ Add" buttons always pass a valid weekday; only
  // the top-bar "+ Add Lesson" button calls this with no day, so it needs a default —
  // Monday, the first day of the board.
  const targetDay = PLANNER_SCHEDULABLE_DAYS.includes(dayKey) ? dayKey : 'mon';
  const maxPos = state.lessonPlans
    .filter(lesson => lesson.weekKey === weekKey && lesson.dayKey === targetDay)
    .reduce((max, lesson) => Math.max(max, lesson.position || 0), 0);
  const newLesson = {
    id: `lesson_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    title: 'New Lesson',
    subject: '',
    weekKey,
    dayKey: targetDay,
    intention: '',
    linkedICIds: [],
    status: 'planned',
    position: maxPos + 1,
  };
  state.lessonPlans.push(newLesson);
  saveLessonPlansState();
  state.plannerUi.selectedLessonId = newLesson.id;
  state.plannerUi.drawerOpen = true;
  state.plannerUi.icSearch = '';
  state.plannerUi.suggestedICIds = [];
  state.plannerUi.expandedICId = null;
  renderView();
}

function plannerDuplicateLesson(lessonId) {
  const lesson = state.lessonPlans.find(item => item.id === lessonId);
  if (!lesson) return;
  const maxPos = state.lessonPlans
    .filter(item => item.weekKey === lesson.weekKey && item.dayKey === lesson.dayKey)
    .reduce((max, item) => Math.max(max, item.position || 0), 0);
  const copy = {
    id: `lesson_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    title: lesson.title || '',
    subject: lesson.subject || '',
    weekKey: lesson.weekKey,
    dayKey: lesson.dayKey || 'unscheduled',
    intention: lesson.intention || '',
    linkedICIds: Array.isArray(lesson.linkedICIds) ? [...lesson.linkedICIds] : [],
    status: 'planned',
    position: maxPos + 1,
  };
  state.lessonPlans.push(copy);
  saveLessonPlansState();
  renderView();
}

function plannerDeleteLesson(lessonId) {
  const lesson = state.lessonPlans.find(item => item.id === lessonId);
  if (!lesson) return;
  if (!confirm(`Delete lesson "${lesson.title || 'Untitled lesson'}"?`)) return;
  state.lessonPlans = state.lessonPlans.filter(item => item.id !== lessonId);
  if (state.plannerUi?.selectedLessonId === lessonId) {
    state.plannerUi.selectedLessonId = null;
    state.plannerUi.drawerOpen = false;
  }
  saveLessonPlansState();
  renderView();
}

function plannerUpdateSelectedLessonField(field, value) {
  const editable = new Set(['title', 'subject', 'dayKey', 'intention']);
  if (!editable.has(field)) return;
  const selectedId = state.plannerUi?.selectedLessonId;
  if (!selectedId) return;
  const idx = state.lessonPlans.findIndex(lesson => lesson.id === selectedId);
  if (idx < 0) return;

  let nextValue = value;
  if (field === 'dayKey') {
    // Weekday-only, going forward — a lesson can no longer be (re)assigned into the
    // legacy 'unscheduled' state via this drawer, even defensively (a value outside
    // the real days is rejected as a no-op, not written).
    nextValue = PLANNER_SCHEDULABLE_DAYS.includes(value) ? value : state.lessonPlans[idx].dayKey;
  }
  state.lessonPlans[idx] = { ...state.lessonPlans[idx], [field]: nextValue };
  saveLessonPlansState();
  // title/intention update silently (preserve input focus); day/subject re-render.
  if (field === 'subject') state.plannerUi.suggestedICIds = [];
  if (field === 'dayKey' || field === 'subject') renderView();
}

function plannerToggleLessonIC(icId) {
  const selectedId = state.plannerUi?.selectedLessonId;
  if (!selectedId) return;
  const idx = state.lessonPlans.findIndex(lesson => lesson.id === selectedId);
  if (idx < 0) return;
  const current = Array.isArray(state.lessonPlans[idx].linkedICIds) ? [...state.lessonPlans[idx].linkedICIds] : [];
  const at = current.indexOf(icId);
  if (at >= 0) {
    current.splice(at, 1);
  } else {
    if (current.length >= 3) { toast('A lesson can link at most 3 ICs', 'error'); return; }
    current.push(icId);
  }
  state.lessonPlans[idx] = { ...state.lessonPlans[idx], linkedICIds: current };
  saveLessonPlansState();
  renderView();
}

function plannerSetLessonStatus(status) {
  const selectedId = state.plannerUi?.selectedLessonId;
  if (!selectedId) return;
  const idx = state.lessonPlans.findIndex(lesson => lesson.id === selectedId);
  if (idx < 0) return;
  const next = status === 'taught' ? 'taught' : 'planned';
  if (next === 'taught' && !(state.lessonPlans[idx].linkedICIds || []).length) {
    toast('Add at least one IC before marking this lesson as taught', 'error');
    return;
  }
  state.lessonPlans[idx] = { ...state.lessonPlans[idx], status: next };
  saveLessonPlansState();
  renderView();
}

// Search input updates only the results container so the field keeps focus.
function plannerHandleICSearchInput(value) {
  plannerEnsureUiState();
  state.plannerUi.icSearch = value;
  const lesson = state.lessonPlans.find(item => item.id === state.plannerUi.selectedLessonId);
  const container = document.getElementById('planner-ic-results');
  if (lesson && container) container.innerHTML = plannerICResultsHtml(lesson);
}

// Heuristic IC suggestion from the lesson's intention text. Ports the
// curriculum-code scoring previously used in Plan & Log: tokenise the intention,
// score the subject's descriptors, then surface the ICs under the best-matching
// descriptors for the teacher to tick.
// TODO(step-future): replace/augment this heuristic with an AI call — the same
// seam the Daily Wizard uses via apiCall('claudeSuggest', { prompt }). Build the
// prompt from lesson.intention + the candidate IC list, intersect the returned
// ids with the subject-scoped pool, and fall back to this heuristic on failure.
function plannerScoreDescriptor(row, tokens) {
  const text = [row.Descriptor || row.Aspect || row.Description || '', row.Strand, row['Sub-strand'] || row['Sub Strand'] || ''].join(' ').toLowerCase();
  let score = 0;
  tokens.forEach(t => { if (t && text.includes(t)) score += (t.length > 6 ? 2 : 1); });
  return score;
}

function plannerSuggestICsFromIntention() {
  plannerEnsureUiState();
  const lesson = state.lessonPlans.find(item => item.id === state.plannerUi.selectedLessonId);
  if (!lesson) return;
  if (!lesson.subject) { toast('Choose a subject first', 'error'); return; }
  const intention = (lesson.intention || '').trim();
  if (!intention) { toast('Write a learning intention first', 'error'); return; }

  const tokens = [...new Set(
    intention.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4)
  )].slice(0, 25);

  const ranked = state.curriculumCodes
    .filter(c => c.Subject === lesson.subject && isCurriculumCodeEnabled(c))
    .map(row => ({ code: row.Code, score: plannerScoreDescriptor(row, tokens) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, 8);

  const scores = {};
  ranked.forEach(r => { scores[r.code] = r.score; });

  const suggested = [];
  ranked.forEach(({ code }) => {
    getICsForDescriptor(code).forEach(ic => { if (!suggested.includes(ic.id)) suggested.push(ic.id); });
  });

  state.plannerUi.icSearch = '';
  state.plannerUi.suggestedICIds = suggested;
  state.plannerUi.suggestionScores = scores;

  const searchInput = document.getElementById('planner-ic-search');
  if (searchInput) searchInput.value = '';
  const container = document.getElementById('planner-ic-results');
  if (container) container.innerHTML = plannerICResultsHtml(lesson);

  toast(
    suggested.length
      ? `Suggested ${suggested.length} IC${suggested.length === 1 ? '' : 's'} — tick the ones you want.`
      : 'No IC matches from that intention — try the search box.',
    suggested.length ? 'success' : 'info'
  );
}

// "Create new IC" from the planner: open the existing stub-creation modal and,
// on successful save, auto-link the new stub to the lesson being edited.
function plannerOpenCreateICModal() {
  plannerEnsureUiState();
  const lesson = state.lessonPlans.find(item => item.id === state.plannerUi.selectedLessonId);
  if (!lesson) return;
  if ((lesson.linkedICIds || []).length >= 3) { toast('A lesson can link at most 3 ICs', 'error'); return; }
  state.plannerUi.pendingStubForLessonId = lesson.id;
  openStubICModal(undefined, lesson.subject || '');
}

function normalizeLessonPlan(raw = {}) {
  const validDayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'unscheduled'];
  const dayKey = validDayKeys.includes(raw.dayKey) ? raw.dayKey : 'unscheduled';
  const status = raw.status === 'taught' ? 'taught' : 'planned';
  const weekKey = isValidIsoDate(raw.weekKey) ? plannerNormalizeWeekStart(raw.weekKey) : toIsoDate(getWeekStart());
  const linkedICIds = Array.isArray(raw.linkedICIds) ? raw.linkedICIds.map(String).slice(0, 3) : [];
  return {
    id: String(raw.id || `lesson_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`),
    title: String(raw.title || ''),
    subject: String(raw.subject || ''),
    weekKey,
    dayKey,
    intention: String(raw.intention || ''),
    linkedICIds,
    status,
    position: Number.isFinite(raw.position) ? raw.position : 0,
    // ── Unit Plans (PR1) ──
    unitId: String(raw.unitId || ''),         // which unit this lesson belongs to (empty = standalone)
    // [{weekKey, dayKey}] — wired up in PR2. Drop malformed entries (see isValidScheduledSlot)
    // and de-dupe identical (weekKey,dayKey) pairs, so stale/hand-edited localStorage can't strand
    // a lesson or render the same occurrence twice (where a single ✕ would remove both).
    scheduledSlots: (Array.isArray(raw.scheduledSlots) ? raw.scheduledSlots.filter(isValidScheduledSlot) : [])
      .filter((s, i, arr) => arr.findIndex(o => o.weekKey === s.weekKey && o.dayKey === s.dayKey) === i),
    teachingStatus: ['planned','taught','partially-taught','needs-review','reteach'].includes(raw.teachingStatus) ? raw.teachingStatus : (status === 'taught' ? 'taught' : 'planned'),
  };
}

function loadLessonPlansState() {
  try {
    const raw = localStorage.getItem(LESSON_PLANS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeLessonPlan) : [];
  } catch (e) {
    return [];
  }
}

// Returns true if the write actually reached localStorage. Existing callers ignore
// this and keep working exactly as before — it exists for callers (like the Drive
// restore flow) that need to know a "successful" save wasn't silently swallowed by
// a quota/security error before treating the data as durably persisted.
function saveLessonPlansState() {
  try {
    const lessons = Array.isArray(state.lessonPlans) ? state.lessonPlans.map(normalizeLessonPlan) : [];
    localStorage.setItem(LESSON_PLANS_STORAGE_KEY, JSON.stringify(lessons));
    markPlannerDirtyForDriveSync();
    return true;
  } catch (e) {
    return false;
  }
}

// ── UNIT PLANS persistence (mirrors loadLessonPlansState / saveLessonPlansState) ──
function normalizeUnitPlan(raw = {}) {
  const linkedCDIds = Array.isArray(raw.linkedCDIds) ? raw.linkedCDIds.map(String) : [];
  const lessonIds = Array.isArray(raw.lessonIds) ? raw.lessonIds.map(String) : [];
  return {
    id: String(raw.id || `unit_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`),
    title: String(raw.title || ''),
    subject: String(raw.subject || ''),
    yearLevel: String(raw.yearLevel || ''),
    term: String(raw.term || ''),
    linkedCDIds,
    assessmentNotes: String(raw.assessmentNotes || ''),
    lessonIds,
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

function loadUnitPlansState() {
  try {
    const raw = localStorage.getItem(UNIT_PLANS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeUnitPlan) : [];
  } catch (e) {
    return [];
  }
}

// See saveLessonPlansState() above for why this returns a boolean.
function saveUnitPlansState() {
  try {
    const units = Array.isArray(state.unitPlans) ? state.unitPlans.map(normalizeUnitPlan) : [];
    localStorage.setItem(UNIT_PLANS_STORAGE_KEY, JSON.stringify(units));
    markPlannerDirtyForDriveSync();
    return true;
  } catch (e) {
    return false;
  }
}

// ════════════════════════════════════════════════════
// ── DRIVE BACKUP SYNC ──
// Unit plans + lessons are localStorage-only (see docs/ARCHITECTURE-ASSESSMENT.md §6),
// so a cache clear loses a term's worth of planning. This is a safety-net JSON backup
// to a file in the teacher's Google Drive — not full Sheets persistence. It goes
// through the existing Apps Script backend (driveBackupSave/driveBackupLoad actions)
// so it reuses the script's own Drive access with no separate Google sign-in for the
// teacher. See apps-script/DriveBackup.gs for the backend half of this.
// ════════════════════════════════════════════════════
let driveSyncDirty = false;
let driveSyncTimer = null;
let pendingDriveRestoreData = null;
let pendingDriveRestoreSavedAt = null;
let pendingDriveRestoreLocalModifiedAt = null;
let pendingDrivePersistRetrySavedAt = null;

function plannerLocalModifiedAt() {
  try { return localStorage.getItem(PLANNER_LOCAL_MODIFIED_KEY) || null; } catch (e) { return null; }
}

function plannerLastDriveSyncAt() {
  try { return localStorage.getItem(PLANNER_LAST_DRIVE_SYNC_KEY) || null; } catch (e) { return null; }
}

function markPlannerDirtyForDriveSync() {
  driveSyncDirty = true;
  try { localStorage.setItem(PLANNER_LOCAL_MODIFIED_KEY, new Date().toISOString()); } catch (e) {}
}

function driveSyncEnsureState() {
  if (!state.driveSync || typeof state.driveSync !== 'object') {
    state.driveSync = { lastSyncedAt: null, syncing: false, consecutiveFailures: 0 };
  }
  return state.driveSync;
}

// driveSyncDirty (and state.driveSync.lastSyncedAt) live in memory, so a page reload
// would otherwise forget about a backup that was still pending — including one that
// failed right before the tab closed. Reconstruct both from the two persisted
// timestamps so unsynced local edits keep retrying across reloads instead of being
// silently dropped until the next edit happens to touch a save function.
function driveSyncInitDirtyState() {
  const hasLocalPlanningData = !!((state.unitPlans && state.unitPlans.length) || (state.lessonPlans && state.lessonPlans.length));
  const persistedLastSync = plannerLastDriveSyncAt();
  if (persistedLastSync) driveSyncEnsureState().lastSyncedAt = persistedLastSync;
  if (!hasLocalPlanningData) return;
  const localModifiedAt = plannerLocalModifiedAt();
  const unsynced = !persistedLastSync || !localModifiedAt || new Date(localModifiedAt) > new Date(persistedLastSync);
  if (unsynced) driveSyncDirty = true;
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (!isFinite(diffMs) || diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

async function driveBackupSave(opts) {
  const silent = !!(opts && opts.silent);
  const ds = driveSyncEnsureState();
  if (ds.syncing) return;
  const unitPlans = state.unitPlans || [];
  const lessonPlans = state.lessonPlans || [];
  // A fresh browser (or a real cache clear) starts with empty arrays before the
  // restore banner is actioned. Uploading that as-is — especially from the manual
  // button, which isn't gated by the dirty flag — would overwrite a real Drive backup
  // with nothing. Only worth checking when this device has no confirmed sync history;
  // an established device legitimately deleting everything should still be able to
  // sync that intentional empty state.
  if (!unitPlans.length && !lessonPlans.length && !plannerLastDriveSyncAt()) {
    ds.syncing = true;
    updateDriveSyncIndicator();
    try {
      const existing = await apiCall('driveBackupLoad', null, { quiet: true });
      const existingHasData = existing && !existing.error && existing.data &&
        ((existing.data.unitPlans && existing.data.unitPlans.length) || (existing.data.lessonPlans && existing.data.lessonPlans.length));
      if (existingHasData) {
        if (!silent) toast('Drive already has unit plans saved — restore them before backing up an empty browser', 'error');
        return;
      }
    } catch (e) {
      // Can't confirm what's on Drive — safer to skip this attempt than risk
      // overwriting real data blind. The next tick (or another manual click) retries.
      if (!silent) toast('Could not confirm Drive is empty — skipped to avoid overwriting existing data', 'error');
      return;
    } finally {
      ds.syncing = false;
      updateDriveSyncIndicator();
    }
  }
  ds.syncing = true;
  updateDriveSyncIndicator();
  try {
    // savedAt reflects when the data was last actually edited, not when this upload
    // attempt happened. If it used the upload time instead, a delayed retry of stale
    // data (e.g. this device was offline while another device uploaded something
    // newer) would stamp old content with a fresh timestamp and pass the backend's
    // staleness guard, clobbering the genuinely newer backup. Using the edit time
    // means a retry of unchanged data always carries the same timestamp it always had.
    const payload = {
      unitPlans,
      lessonPlans,
      savedAt: plannerLocalModifiedAt() || new Date().toISOString(),
    };
    // Snapshot the local-modified marker right before the upload starts. If a save
    // lands while we're awaiting the network (the upload can take a second or two),
    // markPlannerDirtyForDriveSync() will move this marker and re-set driveSyncDirty
    // — in that case the payload we just uploaded is already stale, so we must not
    // clear the flag below and silently drop that edit until something else re-dirties it.
    const localModifiedAtBeforeUpload = plannerLocalModifiedAt();
    const result = await apiCall('driveBackupSave', payload, { quiet: true });
    if (!result || result.error) throw new Error((result && result.error) || 'Drive backup failed');
    // The backend rejects an out-of-order write (see DriveBackup.gs) and reports it
    // as { success: true, skipped: true } rather than an error — this payload never
    // actually landed on Drive, so treat it like a failure so it retries instead of
    // being recorded as synced.
    if (result.skipped) throw new Error('Drive backup skipped — a newer backup already exists');
    ds.lastSyncedAt = payload.savedAt;
    ds.consecutiveFailures = 0;
    if (plannerLocalModifiedAt() === localModifiedAtBeforeUpload) driveSyncDirty = false;
    try { localStorage.setItem(PLANNER_LAST_DRIVE_SYNC_KEY, payload.savedAt); } catch (e) {}
    if (!silent) toast('Backed up unit plans to Drive', 'success');
  } catch (e) {
    ds.consecutiveFailures = (ds.consecutiveFailures || 0) + 1;
    console.warn('[DriveSync] backup failed:', e);
    // Manual clicks (silent=false) always get a toast; the background timer stays
    // quiet so a single transient network blip doesn't nag the teacher.
    if (!silent) toast('Drive backup failed — will retry', 'error');
  } finally {
    ds.syncing = false;
    updateDriveSyncIndicator();
  }
}

function driveSyncTick() {
  if (!driveSyncDirty) return;
  driveBackupSave({ silent: true });
}

function startDriveSyncTimer() {
  if (driveSyncTimer) return;
  driveSyncTimer = setInterval(driveSyncTick, 150000); // every 2.5 minutes
}

// Renders without a wrapper element — callers embed this inside a container that
// already carries class="drive-sync-indicator" (there can be more than one on
// screen at once, e.g. the Unit Plans topbar and the Data & Settings panel).
function driveSyncIndicatorHtml() {
  const ds = driveSyncEnsureState();
  if (ds.syncing) return `Syncing to Drive…`;
  if ((ds.consecutiveFailures || 0) >= 2) {
    return `<span class="is-error">Drive sync failed —</span> <button type="button" class="drive-sync-retry-btn" onclick="driveBackupSave()">retry</button>`;
  }
  if (ds.lastSyncedAt) return `Last synced to Drive: ${formatRelativeTime(ds.lastSyncedAt)}`;
  return `<span class="is-muted">Not yet backed up to Drive</span>`;
}

function updateDriveSyncIndicator() {
  document.querySelectorAll('.drive-sync-indicator').forEach(el => {
    el.innerHTML = driveSyncIndicatorHtml();
  });
}

async function driveBackupCheckOnLoad() {
  try {
    const result = await apiCall('driveBackupLoad', null, { quiet: true });
    if (!result || result.error || !result.data) return;
    const driveSavedAt = result.data.savedAt || result.savedAt;
    if (!driveSavedAt) return;
    // Compare against the last time THIS device confirmed a successful sync, not the
    // last local edit — a successful upload's savedAt is always written a moment after
    // the local edit that triggered it, so comparing against the edit timestamp would
    // make Drive look "newer" on every single reload even when nothing actually changed.
    const persistedLastSync = plannerLastDriveSyncAt();
    const hasLocalPlanningData = !!((state.unitPlans && state.unitPlans.length) || (state.lessonPlans && state.lessonPlans.length));
    // No sync history on this device only means "Drive wins" when there's no local data
    // to lose (a genuinely fresh device, or a real cache clear). If local planning data
    // exists but predates this feature's timestamp tracking, treat it as authoritative
    // rather than letting an unrelated (possibly older) Drive backup look newer by default.
    const driveIsNewer = persistedLastSync
      ? new Date(driveSavedAt) > new Date(persistedLastSync)
      : !hasLocalPlanningData;
    if (driveIsNewer) showDriveRestoreBanner(result.data, driveSavedAt);
  } catch (e) {
    console.warn('[DriveSync] background check failed:', e);
  }
}

function showDriveRestoreBanner(driveData, savedAt) {
  if (document.getElementById('drive-restore-banner')) return;
  pendingDriveRestoreData = driveData;
  pendingDriveRestoreSavedAt = savedAt;
  // The banner is deliberately non-blocking, so the teacher can keep editing while it
  // sits on screen. Snapshot the local-modified marker now so restoreDriveBackup() can
  // detect if that happened and avoid clobbering newer edits with this stale snapshot.
  pendingDriveRestoreLocalModifiedAt = plannerLocalModifiedAt();
  const banner = document.createElement('div');
  banner.id = 'drive-restore-banner';
  banner.style.cssText = "background:var(--banner-bg);color:var(--banner-text);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:'Instrument Sans',sans-serif;font-size:13px;font-weight:500;flex-wrap:wrap;gap:8px";
  banner.innerHTML = `
    <span>A newer Drive backup of your unit plans was found (saved ${formatRelativeTime(savedAt)}). Restore it?</span>
    <div style="display:flex;align-items:center;gap:12px">
      <button onclick="restoreDriveBackup()"
        style="padding:4px 12px;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:var(--banner-text);font-size:12px;cursor:pointer;font-family:'Instrument Sans',sans-serif;font-weight:600">
        Restore
      </button>
      <button onclick="dismissDriveRestoreBanner()"
        style="background:none;border:none;color:var(--banner-text);font-size:18px;cursor:pointer;padding:0;line-height:1;opacity:0.7">✕</button>
    </div>`;
  document.body.insertBefore(banner, document.body.firstChild);
}

function dismissDriveRestoreBanner() {
  pendingDriveRestoreData = null;
  pendingDriveRestoreSavedAt = null;
  pendingDriveRestoreLocalModifiedAt = null;
  const banner = document.getElementById('drive-restore-banner');
  if (banner) banner.remove();
}

function restoreDriveBackup() {
  if (!pendingDriveRestoreData) return;
  const localModifiedAt = plannerLocalModifiedAt();
  // Two independent ways this restore can be stale relative to local work:
  // (1) a save happened while the banner was already on screen (it's non-blocking by
  //     design), or (2) the local edit predates the banner entirely — the banner only
  //     compares Drive's savedAt against this device's last *confirmed sync*, so Drive
  //     can still be older than a local edit that already existed when it appeared
  //     (e.g. last sync 10:00, local edit 10:10, another device's backup at 10:05).
  // Either way, applying the pending snapshot unprompted would silently discard newer
  // local work, so both are checked before overwriting without confirmation.
  const localChangedSinceBanner = localModifiedAt !== pendingDriveRestoreLocalModifiedAt;
  const driveOlderThanLocal = pendingDriveRestoreSavedAt && localModifiedAt
    && new Date(pendingDriveRestoreSavedAt) < new Date(localModifiedAt);
  if (localChangedSinceBanner || driveOlderThanLocal) {
    const proceed = confirm('You have local changes newer than this Drive backup. Restoring will overwrite those changes with the Drive version. Continue?');
    if (!proceed) return;
  }
  const data = pendingDriveRestoreData;
  const restoredSavedAt = pendingDriveRestoreSavedAt || new Date().toISOString();
  if (Array.isArray(data.unitPlans)) state.unitPlans = data.unitPlans.map(normalizeUnitPlan);
  if (Array.isArray(data.lessonPlans)) state.lessonPlans = data.lessonPlans.map(normalizeLessonPlan);
  dismissDriveRestoreBanner();
  finishDriveRestore(restoredSavedAt);
}

// Attempts to persist the already-applied in-memory restore to localStorage and, if
// that succeeds, records it as a confirmed sync. Split out from restoreDriveBackup()
// so the failure banner below can retry it: if a save*State() call fails (e.g. quota
// exceeded), the in-memory data is already correct, but the *next* successful Drive
// upload would still read from that correct in-memory state, succeed, and mark this
// device "synced" — while localStorage silently keeps the pre-restore data underneath
// it, with nothing left to catch the gap on a later reload. A dismissible toast isn't
// enough here; the failure has to stay visible until persistence actually lands.
function finishDriveRestore(restoredSavedAt) {
  const unitsSaved = saveUnitPlansState();
  const lessonsSaved = saveLessonPlansState();
  if (!unitsSaved || !lessonsSaved) {
    showDrivePersistFailureBanner(restoredSavedAt);
    renderView();
    return;
  }
  hideDrivePersistFailureBanner();
  // The restored content is exactly what Drive holds as of restoredSavedAt, so this
  // device is now in sync with Drive — record it the same way a successful upload
  // would, instead of leaving the indicator claiming nothing has ever been backed up.
  driveSyncEnsureState().lastSyncedAt = restoredSavedAt;
  try { localStorage.setItem(PLANNER_LAST_DRIVE_SYNC_KEY, restoredSavedAt); } catch (e) {}
  driveSyncDirty = false;
  toast('Restored unit plans from Drive backup', 'success');
  updateDriveSyncIndicator();
  renderView();
}

function showDrivePersistFailureBanner(restoredSavedAt) {
  hideDrivePersistFailureBanner();
  pendingDrivePersistRetrySavedAt = restoredSavedAt;
  const banner = document.createElement('div');
  banner.id = 'drive-persist-failure-banner';
  banner.style.cssText = "background:var(--status-danger-bg);color:var(--status-danger-text);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:'Instrument Sans',sans-serif;font-size:13px;font-weight:500;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--status-danger-border)";
  banner.innerHTML = `
    <span>Restored data could not be saved in this browser (storage may be full) — it exists only in memory and will be lost if you reload. Retry saving before doing anything else.</span>
    <div style="display:flex;align-items:center;gap:12px">
      <button onclick="retryDrivePersist()"
        style="padding:4px 12px;border-radius:4px;border:1px solid currentColor;background:none;color:inherit;font-size:12px;cursor:pointer;font-family:'Instrument Sans',sans-serif;font-weight:600">
        Retry
      </button>
    </div>`;
  document.body.insertBefore(banner, document.body.firstChild);
}

function hideDrivePersistFailureBanner() {
  pendingDrivePersistRetrySavedAt = null;
  const banner = document.getElementById('drive-persist-failure-banner');
  if (banner) banner.remove();
}

function retryDrivePersist() {
  if (!pendingDrivePersistRetrySavedAt) return;
  finishDriveRestore(pendingDrivePersistRetrySavedAt);
}

// ════════════════════════════════════════════════════
// ── UNIT PLANS (PR1) ──
// A planning layer above the Weekly Planner. A unit groups an ordered sequence of
// lessons (lessons live in state.lessonPlans, tagged with unitId). This PR covers
// the data model, unit list/detail views, and lesson-sequence management. Weekly
// planner integration (scheduledSlots, drag-to-schedule) is deferred to PR2.
// ════════════════════════════════════════════════════

// Each status maps to a CSS modifier (.unit-status-badge.is-<key>) that applies the
// project's status-token triad (text + background tint + border) — see styles.css.
const UNIT_TEACHING_STATUSES = [
  { key: 'planned',          label: 'Planned' },
  { key: 'taught',           label: 'Taught' },
  { key: 'partially-taught', label: 'Partially taught' },
  { key: 'needs-review',     label: 'Needs review' },
  { key: 'reteach',          label: 'Reteach' },
];

function unitPlansEnsureUiState() {
  if (!state.unitPlansUi || typeof state.unitPlansUi !== 'object') state.unitPlansUi = {};
  if (typeof state.unitPlansUi.openUnitId === 'undefined') state.unitPlansUi.openUnitId = null;
  if (typeof state.unitPlansUi.cdSearch !== 'string') state.unitPlansUi.cdSearch = '';
  if (typeof state.unitPlansUi.cdShowAllYears !== 'boolean') state.unitPlansUi.cdShowAllYears = false;
  if (typeof state.unitPlansUi.draggingLessonId === 'undefined') state.unitPlansUi.draggingLessonId = null;
  if (!Array.isArray(state.unitPlans)) state.unitPlans = [];
}

// Lessons belonging to a unit, in unit.lessonIds order, dropping any dangling ids.
function unitGetLessons(unit) {
  const byId = new Map((state.lessonPlans || []).map(l => [l.id, l]));
  return (unit.lessonIds || []).map(id => byId.get(id)).filter(Boolean);
}

function unitLessonStats(unit) {
  const lessons = unitGetLessons(unit);
  return { total: lessons.length, taught: lessons.filter(l => l.teachingStatus === 'taught').length };
}

function unitTeachingStatusMeta(status) {
  return UNIT_TEACHING_STATUSES.find(s => s.key === status) || UNIT_TEACHING_STATUSES[0];
}

function unitTeachingStatusBadgeHtml(status) {
  const meta = unitTeachingStatusMeta(status);
  return `<span class="unit-status-badge is-${meta.key}">${meta.label}</span>`;
}

// ── Routing: list vs detail ──
function renderUnitPlans(main) {
  unitPlansEnsureUiState();
  const openId = state.unitPlansUi.openUnitId;
  const openUnit = openId ? state.unitPlans.find(u => u.id === openId) : null;
  if (openId && !openUnit) state.unitPlansUi.openUnitId = null;
  if (openUnit) { renderUnitDetail(main, openUnit); return; }
  renderUnitList(main);
}

function showUnitDetail(unitId) {
  unitPlansEnsureUiState();
  if (!state.unitPlans.some(u => u.id === unitId)) return;
  state.unitPlansUi.openUnitId = unitId;
  state.unitPlansUi.cdSearch = '';
  // Default the CD picker to the unit's own year level each time it opens.
  state.unitPlansUi.cdShowAllYears = false;
  // Reset any lesson drawer carried over from another unit / the weekly planner.
  plannerEnsureUiState();
  state.plannerUi.selectedLessonId = null;
  state.plannerUi.drawerOpen = false;
  renderView();
}

function unitBackToList() {
  unitPlansEnsureUiState();
  state.unitPlansUi.openUnitId = null;
  plannerEnsureUiState();
  state.plannerUi.selectedLessonId = null;
  state.plannerUi.drawerOpen = false;
  renderView();
}

function unitCreateNew() {
  unitPlansEnsureUiState();
  const unit = normalizeUnitPlan({
    title: 'New Unit',
    createdAt: new Date().toISOString(),
  });
  state.unitPlans.push(unit);
  saveUnitPlansState();
  state.unitPlansUi.openUnitId = unit.id;
  state.unitPlansUi.cdSearch = '';
  renderView();
}

function unitDelete(unitId) {
  const unit = state.unitPlans.find(u => u.id === unitId);
  if (!unit) return;
  const stats = unitLessonStats(unit);
  const lessonNote = stats.total ? ` Its ${stats.total} lesson${stats.total === 1 ? '' : 's'} will also be deleted.` : '';
  if (!confirm(`Delete unit "${unit.title || 'Untitled unit'}"?${lessonNote}`)) return;
  const lessonIds = new Set(unit.lessonIds || []);
  state.lessonPlans = state.lessonPlans.filter(l => !lessonIds.has(l.id));
  state.unitPlans = state.unitPlans.filter(u => u.id !== unitId);
  if (state.unitPlansUi && state.unitPlansUi.openUnitId === unitId) state.unitPlansUi.openUnitId = null;
  if (state.plannerUi && lessonIds.has(state.plannerUi.selectedLessonId)) {
    state.plannerUi.selectedLessonId = null;
    state.plannerUi.drawerOpen = false;
  }
  saveLessonPlansState();
  saveUnitPlansState();
  renderView();
}

function unitUpdateField(unitId, field, value) {
  const editable = new Set(['title', 'subject', 'yearLevel', 'term', 'assessmentNotes']);
  if (!editable.has(field)) return;
  const idx = state.unitPlans.findIndex(u => u.id === unitId);
  if (idx < 0) return;
  state.unitPlans[idx] = { ...state.unitPlans[idx], [field]: String(value) };
  saveUnitPlansState();
  // Subject re-scopes the CD picker; re-render. Other text fields update silently so
  // the input keeps focus while typing.
  if (field === 'subject') { state.unitPlansUi.cdSearch = ''; state.unitPlansUi.cdShowAllYears = false; renderView(); return; }
  // Year level drives the CD picker's default filter. Refresh just that panel (it
  // lives in the sidebar, while the year input is in the topbar) so the new default
  // takes effect immediately without stealing focus from the year field.
  if (field === 'yearLevel') {
    state.unitPlansUi.cdShowAllYears = false;
    const panel = document.getElementById('unit-cd-panel');
    if (panel) panel.innerHTML = unitCDPanelHtml(state.unitPlans[idx]);
  }
}

// ── LIST VIEW ──
function renderUnitList(main) {
  const units = [...state.unitPlans].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const cards = units.map(unit => {
    const stats = unitLessonStats(unit);
    const pct = stats.total ? Math.round((stats.taught / stats.total) * 100) : 0;
    const metaBits = [unit.subject, unit.yearLevel, unit.term].filter(Boolean).join(' · ');
    return `
      <div class="unit-card" role="button" tabindex="0"
        onclick="showUnitDetail('${plannerJsStr(unit.id)}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showUnitDetail('${plannerJsStr(unit.id)}')}">
        <div class="unit-card-head">
          <div class="unit-card-title">${escapeHtml(unit.title || 'Untitled unit')}</div>
          <button class="unit-card-delete" type="button" title="Delete unit"
            onclick="event.stopPropagation();unitDelete('${plannerJsStr(unit.id)}')">Delete</button>
        </div>
        <div class="unit-card-meta">${metaBits ? escapeHtml(metaBits) : 'No subject set'}</div>
        <div class="unit-card-stats">${stats.total} lesson${stats.total === 1 ? '' : 's'} · ${stats.taught} taught</div>
        <div class="unit-progress"><div class="unit-progress-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');

  main.innerHTML = `
    <div class="topbar" style="padding:14px 24px">
      <div>
        <div class="topbar-title">Unit Plans</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">Group lessons into teaching units</div>
        <div class="drive-sync-indicator">${driveSyncIndicatorHtml()}</div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary" type="button" onclick="unitCreateNew()">+ New Unit</button>
      </div>
    </div>
    <div class="content">
      ${units.length === 0
        ? `<div class="card" style="padding:32px;text-align:center">
             <div style="font-size:15px;font-weight:600;margin-bottom:6px">No units yet</div>
             <div style="font-size:13px;color:var(--text3);margin-bottom:16px">Create your first unit to start grouping lessons into a teaching sequence.</div>
             <button class="btn btn-primary" type="button" onclick="unitCreateNew()">+ New Unit</button>
           </div>`
        : `<div class="unit-card-grid">${cards}</div>`}
    </div>
  `;
}

// ── DETAIL VIEW ──
function renderUnitDetail(main, unit) {
  plannerEnsureUiState();
  unitPlansEnsureUiState();

  const lessons = unitGetLessons(unit);
  // Drawer only opens for a lesson that belongs to this unit.
  let drawerLesson = (state.plannerUi.drawerOpen && state.plannerUi.selectedLessonId)
    ? lessons.find(l => l.id === state.plannerUi.selectedLessonId) : null;
  if (state.plannerUi.drawerOpen && !drawerLesson) {
    state.plannerUi.selectedLessonId = null;
    state.plannerUi.drawerOpen = false;
  }
  const hasDrawer = !!drawerLesson;

  const sequenceBody = lessons.length === 0
    ? `<div class="unit-seq-empty">No lessons yet. Use <strong>+ Add lesson</strong> to build the sequence.</div>`
    : lessons.map(lesson => unitLessonRowHtml(unit, lesson)).join('');

  main.innerHTML = `
    <div class="topbar" style="padding:14px 24px;gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px;flex-wrap:wrap">
        <button class="btn" type="button" onclick="unitBackToList()">‹ Units</button>
        <label class="unit-title-edit" title="Rename this unit">
          <input class="unit-title-input" type="text" value="${escapeHtml(unit.title || '')}" placeholder="Untitled unit" aria-label="Unit title"
            oninput="unitUpdateField('${plannerJsStr(unit.id)}','title',this.value)">
          <span class="unit-title-edit-icon" aria-hidden="true">✎</span>
        </label>
        <div class="drive-sync-indicator">${driveSyncIndicatorHtml()}</div>
      </div>
      <div class="topbar-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select class="form-input unit-field-sm" onchange="unitUpdateField('${plannerJsStr(unit.id)}','subject',this.value)">
          <option value="">— subject —</option>
          ${PLANNER_SUBJECTS.map(s => `<option value="${s}" ${unit.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <input class="form-input unit-field-sm" type="text" value="${escapeHtml(unit.yearLevel || '')}" placeholder="Year level"
          oninput="unitUpdateField('${plannerJsStr(unit.id)}','yearLevel',this.value)">
        <input class="form-input unit-field-sm" type="text" value="${escapeHtml(unit.term || '')}" placeholder="Term"
          oninput="unitUpdateField('${plannerJsStr(unit.id)}','term',this.value)">
      </div>
    </div>
    <div class="content">
      <div class="unit-detail-grid ${hasDrawer ? 'has-drawer' : ''}">
        <section class="card unit-seq-col">
          <div class="card-head">
            <div class="card-title">Lesson sequence</div>
            <div style="font-size:12px;color:var(--text3)">${lessons.length} lesson${lessons.length === 1 ? '' : 's'} · drag to reorder</div>
          </div>
          <div class="unit-seq-body">
            ${sequenceBody}
            <button class="unit-seq-add" type="button" onclick="unitAddLesson('${plannerJsStr(unit.id)}')">+ Add lesson</button>
          </div>
        </section>
        ${hasDrawer
          ? `<aside class="card unit-drawer-col">
               <div class="card-head">
                 <div class="card-title">Edit lesson</div>
                 <button class="btn" type="button" onclick="unitCloseLessonDrawer()">Close</button>
               </div>
               ${unitLessonDrawerHtml(drawerLesson)}
             </aside>`
          : ''}
        <aside class="card unit-side-col">
          <div class="card-head"><div class="card-title">Unit details</div></div>
          <div class="unit-side-body">
            <div class="form-group">
              <label class="form-label">Linked curriculum descriptors</label>
              <div id="unit-cd-panel">${unitCDPanelHtml(unit)}</div>
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Assessment notes</label>
              <textarea class="form-input" rows="6" placeholder="How will this unit be assessed?"
                onblur="unitUpdateField('${plannerJsStr(unit.id)}','assessmentNotes',this.value)">${escapeHtml(unit.assessmentNotes || '')}</textarea>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function unitLessonRowHtml(unit, lesson) {
  const isOpen = state.plannerUi && state.plannerUi.selectedLessonId === lesson.id && state.plannerUi.drawerOpen;
  const icCount = Array.isArray(lesson.linkedICIds) ? lesson.linkedICIds.length : 0;
  const slotCount = Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots.length : 0;
  const intention = (lesson.intention || '').trim();
  const intentionShort = intention.length > 90 ? intention.slice(0, 90).trimEnd() + '…' : intention;
  return `
    <div class="unit-lesson-row ${isOpen ? 'is-open' : ''}" draggable="true"
      ondragstart="unitStartLessonDrag(event,'${plannerJsStr(lesson.id)}')"
      ondragend="unitEndLessonDrag(event)"
      ondragover="unitAllowLessonDrop(event)"
      ondragleave="unitLessonDropLeave(event)"
      ondrop="unitDropLesson(event,'${plannerJsStr(unit.id)}','${plannerJsStr(lesson.id)}')"
      onclick="plannerOpenLessonDrawer('${plannerJsStr(lesson.id)}')">
      <span class="unit-lesson-drag" title="Drag to reorder" aria-hidden="true">⠿</span>
      <div class="unit-lesson-main">
        <div class="unit-lesson-title">${escapeHtml(lesson.title || 'Untitled lesson')}</div>
        ${intentionShort ? `<div class="unit-lesson-intention">${escapeHtml(intentionShort)}</div>` : ''}
        <div class="unit-lesson-tags">
          <span class="unit-lesson-chip">${icCount} IC${icCount === 1 ? '' : 's'}</span>
          ${unitTeachingStatusBadgeHtml(lesson.teachingStatus)}
          <span class="unit-lesson-chip">${slotCount} slot${slotCount === 1 ? '' : 's'}</span>
        </div>
      </div>
      <button class="unit-lesson-delete" type="button" title="Remove lesson from unit"
        onclick="event.stopPropagation();unitDeleteLesson('${plannerJsStr(unit.id)}','${plannerJsStr(lesson.id)}')">✕</button>
    </div>
  `;
}

// Unit lesson core fields — title, subject, teaching status, learning intention, and
// the IC picker (reuses the planner's IC-linking engine: same element ids, same
// handlers, so search / suggest / expand / create-IC all work unchanged). Shared by
// the Unit Plans detail drawer (unitLessonDrawerHtml) and the Weekly Planner's own
// drawer (plannerUnitLessonEditHtml) so both surfaces edit the exact same fields the
// exact same way.
function plannerUnitLessonFieldsHtml(lesson) {
  const icCount = Array.isArray(lesson.linkedICIds) ? lesson.linkedICIds.length : 0;
  const unit = unitForLesson(lesson);
  const icYearToggle = (unit && normaliseYear(unit.yearLevel))
    ? `<div class="unit-cd-yearfilter">
         <span class="unit-cd-yearfilter-label">${state.plannerUi.icShowAllYears ? 'Showing all year levels' : `Showing ${escapeHtml(unitYearLabel(unit))} only`}</span>
         <button class="unit-cd-yeartoggle" type="button" onclick="unitToggleICShowAllYears()">${state.plannerUi.icShowAllYears ? `Show ${escapeHtml(unitYearLabel(unit))} only` : 'Show all years'}</button>
       </div>`
    : '';
  return `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" type="text" value="${escapeHtml(lesson.title || '')}" oninput="plannerUpdateSelectedLessonField('title', this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <select class="form-input" onchange="plannerUpdateSelectedLessonField('subject', this.value)">
          <option value="">— select subject —</option>
          ${PLANNER_SUBJECTS.map(s => `<option value="${s}" ${lesson.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Teaching status</label>
        <select class="form-input" onchange="unitSetLessonTeachingStatus(this.value)">
          ${UNIT_TEACHING_STATUSES.map(s => `<option value="${s.key}" ${lesson.teachingStatus === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Learning intention</label>
        <textarea class="form-input" rows="3" placeholder="What am I trying to get kids to do or learn?" oninput="plannerUpdateSelectedLessonField('intention', this.value)">${escapeHtml(lesson.intention || '')}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Instructional Components (1–3) · ${icCount}/3 selected</label>
        ${icCount === 0 ? `<div class="planner-incomplete-note">This lesson has no ICs linked yet — a lesson should target at least one IC.</div>` : ''}
        <div class="planner-selected-ics">${plannerSelectedICsHtml(lesson)}</div>
        <div class="planner-ic-controls">
          <input class="form-input" id="planner-ic-search" type="text" placeholder="Search ICs by name or code" value="${escapeHtml(state.plannerUi.icSearch || '')}" oninput="plannerHandleICSearchInput(this.value)">
          <button class="btn" type="button" onclick="plannerSuggestICsFromIntention()">Suggest from intention</button>
        </div>
        ${icYearToggle}
        <div id="planner-ic-results" class="planner-ic-results">${plannerICResultsHtml(lesson)}</div>
      </div>
  `;
}

function unitLessonDrawerHtml(lesson) {
  return `
    <div style="padding:16px">
      ${plannerUnitLessonFieldsHtml(lesson)}
      ${unitLessonScheduleHtml(lesson)}
    </div>
  `;
}

// Non-drag scheduling fallback (for touch / tablet use): pick a week + weekday and add
// it to this lesson's scheduledSlots, the same result as dragging the lesson onto the
// board. Also lists the lesson's current slots, each with a per-slot ✕ remove (not a
// bulk "clear all"). Mirrors the board: appends to scheduledSlots, leaves teachingStatus alone.
function unitLessonScheduleHtml(lesson) {
  // Only render well-formed slots (mirrors normalize + the board loop), so a stale or
  // malformed entry can't throw or render a broken chip in the drawer.
  const slots = (Array.isArray(lesson.scheduledSlots) ? lesson.scheduledSlots : [])
    .filter(isValidScheduledSlot);
  const dayLabels = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
  const slotList = slots.length
    ? slots.map(s => `
        <span class="planner-slot-chip">
          ${escapeHtml(plannerWeekRangeLabel(s.weekKey))} · ${escapeHtml(dayLabels[s.dayKey] || s.dayKey)}
          <button class="planner-slot-remove" type="button" title="Remove this slot"
            aria-label="Remove this scheduled slot"
            onclick="unitUnscheduleLessonSlot('${plannerJsStr(lesson.id)}','${plannerJsStr(s.weekKey)}','${plannerJsStr(s.dayKey)}')">×</button>
        </span>`).join('')
    : `<div class="planner-slot-empty">Not scheduled onto the week yet.</div>`;

  // Week options span a window around the planner's current week (covers a term).
  const baseWeek = plannerSelectedWeekKey();
  const weekOptions = [];
  for (let i = -2; i <= 12; i++) {
    const wk = plannerNormalizeWeekStart(addDaysToDate(baseWeek, i * 7));
    weekOptions.push(`<option value="${wk}" ${i === 0 ? 'selected' : ''}>${escapeHtml(plannerWeekRangeLabel(wk))}</option>`);
  }

  return `
    <div class="form-group" style="margin-bottom:0">
      <label class="form-label">Schedule to week / day</label>
      <div class="planner-slot-list">${slotList}</div>
      <div class="planner-schedule-controls">
        <select class="form-input" id="unit-schedule-week" aria-label="Week to schedule onto">${weekOptions.join('')}</select>
        <select class="form-input" id="unit-schedule-day" aria-label="Day to schedule onto">
          ${PLANNER_SCHEDULABLE_DAYS.map(d => `<option value="${d}">${dayLabels[d]}</option>`).join('')}
        </select>
        <button class="btn btn-primary" type="button" onclick="unitScheduleLessonFromDrawer('${plannerJsStr(lesson.id)}')">Add to week</button>
      </div>
    </div>
  `;
}

// Drawer "Add to week" button: read the week/day selects and append a slot.
function unitScheduleLessonFromDrawer(lessonId) {
  const weekSel = document.getElementById('unit-schedule-week');
  const daySel = document.getElementById('unit-schedule-day');
  const weekKey = weekSel ? weekSel.value : '';
  const dayKey = daySel ? daySel.value : '';
  if (plannerScheduleUnitLesson(lessonId, weekKey, dayKey)) toast('Scheduled onto the week', 'success');
  renderView();
}

// Drawer per-slot remove (single occurrence; not a bulk clear).
function unitUnscheduleLessonSlot(lessonId, weekKey, dayKey) {
  plannerUnscheduleSlot(lessonId, weekKey, dayKey);
}

function unitCloseLessonDrawer() {
  plannerEnsureUiState();
  state.plannerUi.selectedLessonId = null;
  state.plannerUi.drawerOpen = false;
  renderView();
}

// Broaden the unit lesson-drawer IC picker from the unit's year level to all years.
function unitToggleICShowAllYears() {
  plannerEnsureUiState();
  state.plannerUi.icShowAllYears = !state.plannerUi.icShowAllYears;
  renderView();
}

// Set teachingStatus on the lesson currently open in the unit drawer.
function unitSetLessonTeachingStatus(value) {
  if (!UNIT_TEACHING_STATUSES.some(s => s.key === value)) return;
  const id = state.plannerUi && state.plannerUi.selectedLessonId;
  if (!id) return;
  const idx = state.lessonPlans.findIndex(l => l.id === id);
  if (idx < 0) return;
  state.lessonPlans[idx] = { ...state.lessonPlans[idx], teachingStatus: value };
  saveLessonPlansState();
  renderView();
}

// ── Lesson sequence mutations ──
function unitAddLesson(unitId) {
  plannerEnsureUiState();
  const idx = state.unitPlans.findIndex(u => u.id === unitId);
  if (idx < 0) return;
  const unit = state.unitPlans[idx];
  const lesson = normalizeLessonPlan({
    title: 'New Lesson',
    subject: unit.subject || '',
    unitId: unit.id,
    teachingStatus: 'planned',
    linkedICIds: [],
  });
  state.lessonPlans.push(lesson);
  const lessonIds = Array.isArray(unit.lessonIds) ? [...unit.lessonIds, lesson.id] : [lesson.id];
  state.unitPlans[idx] = { ...unit, lessonIds };
  saveLessonPlansState();
  saveUnitPlansState();
  state.plannerUi.selectedLessonId = lesson.id;
  state.plannerUi.drawerOpen = true;
  state.plannerUi.icSearch = '';
  state.plannerUi.suggestedICIds = [];
  state.plannerUi.expandedICId = null;
  state.plannerUi.icShowAllYears = false;
  renderView();
}

function unitDeleteLesson(unitId, lessonId) {
  const lesson = state.lessonPlans.find(l => l.id === lessonId);
  if (!confirm(`Delete lesson "${(lesson && lesson.title) || 'Untitled lesson'}" from this unit?`)) return;
  const idx = state.unitPlans.findIndex(u => u.id === unitId);
  if (idx >= 0) {
    const unit = state.unitPlans[idx];
    state.unitPlans[idx] = { ...unit, lessonIds: (unit.lessonIds || []).filter(id => id !== lessonId) };
  }
  state.lessonPlans = state.lessonPlans.filter(l => l.id !== lessonId);
  if (state.plannerUi && state.plannerUi.selectedLessonId === lessonId) {
    state.plannerUi.selectedLessonId = null;
    state.plannerUi.drawerOpen = false;
  }
  saveLessonPlansState();
  saveUnitPlansState();
  renderView();
}

// ── Lesson sequence drag-to-reorder ──
function unitStartLessonDrag(ev, lessonId) {
  unitPlansEnsureUiState();
  state.unitPlansUi.draggingLessonId = lessonId;
  if (ev && ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', lessonId);
  }
}

function unitAllowLessonDrop(ev) {
  ev.preventDefault();
  const row = ev.currentTarget;
  if (row) row.classList.add('drop-over');
}

function unitLessonDropLeave(ev) {
  const row = ev.currentTarget;
  if (row) row.classList.remove('drop-over');
}

function unitEndLessonDrag() {
  if (state.unitPlansUi) state.unitPlansUi.draggingLessonId = null;
  document.querySelectorAll('.unit-lesson-row.drop-over').forEach(el => el.classList.remove('drop-over'));
}

function unitDropLesson(ev, unitId, targetLessonId) {
  ev.preventDefault();
  const row = ev.currentTarget;
  if (row) row.classList.remove('drop-over');
  const dragId = (ev && ev.dataTransfer && ev.dataTransfer.getData('text/plain')) || (state.unitPlansUi && state.unitPlansUi.draggingLessonId);
  if (state.unitPlansUi) state.unitPlansUi.draggingLessonId = null;
  if (!dragId || dragId === targetLessonId) return;
  const idx = state.unitPlans.findIndex(u => u.id === unitId);
  if (idx < 0) return;
  const ids = [...(state.unitPlans[idx].lessonIds || [])];
  const from = ids.indexOf(dragId);
  const targetIdx = ids.indexOf(targetLessonId);
  if (from < 0 || targetIdx < 0) return;
  ids.splice(from, 1);
  // Drop relative to the hovered row: dragging downward lands after the target,
  // dragging upward lands before it. (Without the +1, an item can never move past
  // an adjacent later row — dragging B onto C in [A,B,C] would be a no-op.)
  let to = ids.indexOf(targetLessonId);
  if (to < 0) to = ids.length;
  else if (from < targetIdx) to += 1;
  ids.splice(to, 0, dragId);
  state.unitPlans[idx] = { ...state.unitPlans[idx], lessonIds: ids };
  saveUnitPlansState();
  renderView();
}

// ── Linked curriculum descriptors (unit-scoped multi-select) ──
function unitCDLabel(row) {
  return row.Descriptor || row.Aspect || row.Description || '';
}

function unitSelectedCDsHtml(unit) {
  const ids = Array.isArray(unit.linkedCDIds) ? unit.linkedCDIds : [];
  if (!ids.length) return `<div class="unit-cd-hint">No descriptors linked yet.</div>`;
  return ids.map(code => {
    const row = state.curriculumCodes.find(c => c.Code === code);
    const title = row ? unitCDLabel(row) : '';
    return `<span class="unit-cd-chip" title="${escapeHtml(title)}">
      <span class="unit-cd-chip-code">${escapeHtml(code)}</span>
      <button class="unit-cd-remove" type="button" title="Remove" onclick="unitToggleCD('${plannerJsStr(unit.id)}','${plannerJsStr(code)}')">×</button>
    </span>`;
  }).join('');
}

// Human-readable form of the unit's year level (e.g. "2" or "Year 2" -> "Year 2").
function unitYearLabel(unit) {
  const key = normaliseYear(unit.yearLevel);
  if (!key) return '';
  return YLM[key] || unit.yearLevel;
}

// Whether a curriculum descriptor matches the unit's single year level. Banded
// subjects (The Arts / Technologies / HPE) label descriptors with a band-
// representative year (Foundation / Year 2 / Year 4 / Year 6), so those match the
// unit's banded equivalent; non-banded subjects (English, Maths, Science, HASS)
// must match the exact year. The banded check keys off the descriptor's own
// Subject — the same signal Class Overview uses — so a non-banded Year 3 unit no
// longer wrongly pulls in Year 4 descriptors.
function unitCDMatchesYear(unit, c) {
  const target = normaliseYear(unit.yearLevel);
  if (!target) return true; // no year set on the unit -> match all (current behaviour)
  const cdYear = normaliseYear(c['Year Level']);
  if (BANDED_SUBJECTS.has(c.Subject)) {
    return cdYear === normaliseYear(bandYearLevel(YLM[target] || unit.yearLevel));
  }
  return cdYear === target;
}

// The whole linked-CD picker panel (selected chips + search + year toggle + results).
// Rendered into #unit-cd-panel so it can be refreshed in place when the year changes.
function unitCDPanelHtml(unit) {
  if (!unit.subject) {
    return `<div class="unit-cd-hint">Choose a subject above to link curriculum descriptors.</div>
            ${unit.linkedCDIds && unit.linkedCDIds.length ? `<div class="unit-cd-selected">${unitSelectedCDsHtml(unit)}</div>` : ''}`;
  }
  return `<div class="unit-cd-selected">${unitSelectedCDsHtml(unit)}</div>
    <input class="form-input" id="unit-cd-search" type="text" placeholder="Search ${escapeHtml(unit.subject)} codes or descriptors"
      value="${escapeHtml(state.unitPlansUi.cdSearch || '')}" oninput="unitHandleCDSearch('${plannerJsStr(unit.id)}',this.value)">
    ${normaliseYear(unit.yearLevel)
      ? `<div class="unit-cd-yearfilter">
           <span class="unit-cd-yearfilter-label">${state.unitPlansUi.cdShowAllYears ? 'Showing all year levels' : `Showing ${escapeHtml(unitYearLabel(unit))} only`}</span>
           <button class="unit-cd-yeartoggle" type="button" onclick="unitToggleCDShowAllYears()">${state.unitPlansUi.cdShowAllYears ? `Show ${escapeHtml(unitYearLabel(unit))} only` : 'Show all years'}</button>
         </div>`
      : ''}
    <div id="unit-cd-results" class="unit-cd-results">${unitCDResultsHtml(unit)}</div>`;
}

function unitCDResultsHtml(unit) {
  if (!unit.subject) return '';
  const search = (state.unitPlansUi.cdSearch || '').trim().toLowerCase();
  const selected = new Set(Array.isArray(unit.linkedCDIds) ? unit.linkedCDIds : []);
  let pool = state.curriculumCodes.filter(c => c.Subject === unit.subject && isCurriculumCodeEnabled(c));
  // Default to the unit's own year level; the "Show all years" toggle lifts this.
  const yearFiltered = !!normaliseYear(unit.yearLevel) && !state.unitPlansUi.cdShowAllYears;
  if (yearFiltered) {
    pool = pool.filter(c => unitCDMatchesYear(unit, c));
  }
  if (search) {
    pool = pool.filter(c =>
      (c.Code || '').toLowerCase().includes(search) ||
      unitCDLabel(c).toLowerCase().includes(search) ||
      (c.Strand || '').toLowerCase().includes(search)
    );
  }
  pool = pool.slice(0, 40);
  if (!pool.length) {
    const msg = search
      ? (yearFiltered ? `No matching descriptors for ${escapeHtml(unitYearLabel(unit))}. Try “Show all years”.` : 'No matching descriptors.')
      : (yearFiltered ? `No ${escapeHtml(unitYearLabel(unit))} descriptors for this subject. Try “Show all years”.` : 'No descriptors for this subject.');
    return `<div class="unit-cd-empty">${msg}</div>`;
  }
  return pool.map(c => {
    const on = selected.has(c.Code);
    const label = unitCDLabel(c);
    return `<button class="unit-cd-option ${on ? 'is-on' : ''}" type="button" onclick="unitToggleCD('${plannerJsStr(unit.id)}','${plannerJsStr(c.Code)}')">
      <span class="unit-cd-option-tick">${on ? '✓' : '+'}</span>
      <span class="unit-cd-option-body">
        <span class="unit-cd-option-code">${escapeHtml(c.Code)}${c.Strand ? ` · ${escapeHtml(c.Strand)}` : ''}</span>
        ${label ? `<span class="unit-cd-option-desc">${escapeHtml(label)}</span>` : ''}
      </span>
    </button>`;
  }).join('');
}

function unitToggleCD(unitId, code) {
  const idx = state.unitPlans.findIndex(u => u.id === unitId);
  if (idx < 0) return;
  const current = Array.isArray(state.unitPlans[idx].linkedCDIds) ? [...state.unitPlans[idx].linkedCDIds] : [];
  const at = current.indexOf(code);
  if (at >= 0) current.splice(at, 1); else current.push(code);
  state.unitPlans[idx] = { ...state.unitPlans[idx], linkedCDIds: current };
  saveUnitPlansState();
  renderView();
}

// Search input updates only the results container so the field keeps focus.
function unitHandleCDSearch(unitId, value) {
  unitPlansEnsureUiState();
  state.unitPlansUi.cdSearch = value;
  const unit = state.unitPlans.find(u => u.id === unitId);
  const container = document.getElementById('unit-cd-results');
  if (unit && container) container.innerHTML = unitCDResultsHtml(unit);
}

// Broaden the CD picker from the unit's year level to all years (and back).
function unitToggleCDShowAllYears() {
  unitPlansEnsureUiState();
  state.unitPlansUi.cdShowAllYears = !state.unitPlansUi.cdShowAllYears;
  renderView();
}

// ── DASHBOARD ──
function renderDashboard(main) {
  const totalStudents = state.students.length;
  const totalProgress = state.progress.length;
  const achieved = state.progress.filter(p => p.mastery === 'Achieved').length;
  const gaps = state.progress.filter(p => p.mastery === 'Emerging').length;

  const recent = [...state.progress]
    .filter(p => {
      const row = state.curriculumCodes.find(c => c.Code === p.code);
      return !row || isCurriculumCodeEnabled(row);
    })
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const subjectOrder = [
    'English', 'Mathematics', 'Science', 'HASS', 'HPE',
    'Design and Technologies', 'Digital Technologies',
    'Dance', 'Drama', 'Media Arts', 'Music', 'Visual Arts',
  ];


  const subjects = subjectOrder.filter(subj => state.curriculumCodes.some(c => c.Subject === subj) && isSubjectEnabled(subj));

  // Year levels present in this class — used to scope codes correctly
  const classYearLevels = [...new Set(state.students.map(s => YLM[normaliseYear(s.year_level)] || s.year_level).filter(Boolean))];

  // Taught stats — scoped to year levels in the class
  const classYearCodes = state.curriculumCodes.filter(c =>
    isCurriculumCodeEnabled(c) &&
    (classYearLevels.length === 0 || (BANDED_SUBJECTS.has(c.Subject)
      ? classYearLevels.some(yl => bandYearLevel(yl) === (c['Year Level']||'').trim())
      : classYearLevels.includes((c['Year Level']||'').trim())))
  );
  const totalCodes = classYearCodes.length;
  const coveragePct = totalCodes ? Math.round((new Set(state.taughtLog.filter(t => classYearCodes.some(c => c.Code === t.code)).map(t => t.code)).size / totalCodes) * 100) : 0;

  function subjectCard(subj) {
    const col = subjectCol(subj);
    const bg = subjectBg(subj);
    const icon = SUBJECT_ICONS[subj] || '◈';

    // All codes for this subject — but if we have students, scope to their year levels
    const allSubjCodes = state.curriculumCodes.filter(c => c.Subject === subj && isCurriculumCodeEnabled(c));
    const codes = classYearLevels.length > 0
      ? allSubjCodes.filter(c => BANDED_SUBJECTS.has(c.Subject)
          ? classYearLevels.some(yl => bandYearLevel(yl) === (c['Year Level']||'').trim())
          : classYearLevels.includes((c['Year Level']||'').trim()))
      : allSubjCodes;

    const strands = [...new Set(codes.map(c => c.Strand).filter(Boolean))].sort();
    const assessed = state.progress.filter(p => codes.some(c => c.Code === p.code));
    const subjAchieved = assessed.filter(p => p.mastery === 'Achieved').length;

    // Taught: unique codes from this subject+year that appear in taughtLog
    const taughtCodes = new Set(
      state.taughtLog.filter(t => codes.some(c => c.Code === t.code)).map(t => t.code)
    );
    const taughtPct = codes.length ? Math.round((taughtCodes.size / codes.length) * 100) : 0;
    const notTaughtCount = codes.length - taughtCodes.size;

    return `<div class="card" style="cursor:pointer" onclick="cdFilters.subject='${subj}';cdFilters.year='all';cdFilters.strand='all';showView('curriculum')">
      <div style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)">
        <div style="width:34px;height:34px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:16px;color:${col};flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subj}</div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-top:1px">${codes.length} codes · ${strands.length} strands${classYearLevels.length === 1 ? ' · ' + classYearLevels[0] : ''}</div>
        </div>
        <div style="text-align:right">
          ${taughtPct > 0 ? `<div style="font-family:'DM Mono',monospace;font-size:11px;color:${col};font-weight:700">${taughtPct}%</div>
          <div style="font-size:9px;color:var(--text3)">taught</div>` : `<div style="font-size:10px;color:var(--text3)">No data</div>`}
        </div>
      </div>
      <div style="padding:10px 16px">
        <!-- Taught progress bar -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="font-size:10px;color:var(--text3);width:52px;flex-shrink:0">Taught</div>
          <div style="flex:1;height:6px;background:var(--surface-alt);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${taughtPct}%;background:${col};border-radius:3px;transition:width 0.3s"></div>
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:${col};width:36px;text-align:right">${taughtCodes.size}/${codes.length}</div>
        </div>
        ${notTaughtCount > 0 ? `<div style="font-size:10px;color:var(--rust);margin-bottom:8px;cursor:pointer" onclick="event.stopPropagation();state.coverageFilter={subject:'${subj}',year:'all',strand:'all',mode:'not-taught'};showView('coverage')">
          ⚠ ${notTaughtCount} code${notTaughtCount>1?'s':''} not yet taught → <span style="text-decoration:underline">View gaps</span>
        </div>` : `<div style="font-size:10px;color:var(--green);margin-bottom:8px">✓ All codes taught</div>`}
        ${strands.map(strand => {
          const sc = codes.filter(c => c.Strand === strand);
          const sa = state.progress.filter(p => sc.some(c => c.Code === p.code));
          const sp = sa.length ? Math.round(sa.filter(p=>p.mastery==='Achieved').length/sa.length*100) : 0;
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <div style="font-size:10px;color:var(--text3);width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0">${strand}</div>
            <div style="flex:1;height:4px;background:var(--surface-alt);border-radius:2px;overflow:hidden"><div style="height:100%;width:${sp}%;background:${col};border-radius:2px;transition:width 0.3s"></div></div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);width:28px;text-align:right">${sa.length ? sp+'%' : '—'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  main.innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Dashboard</div>
      <div class="topbar-actions">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);letter-spacing:0.1em">${APP_VERSION}</span>
        <button class="btn" onclick="openDailyLogWizard()" style="border-color:var(--gold);color:var(--gold)">✦ Log Today</button>
        <button class="btn btn-primary" onclick="openAddStudentModal()">+ Add Student</button>
      </div>
    </div>
    <div class="content">
      <div class="stats-row" style="grid-template-columns:repeat(5,1fr)">
        <div class="stat-card c-blue"><div class="stat-label">Students</div><div class="stat-value">${totalStudents}</div><div class="stat-sub">enrolled</div></div>
        <div class="stat-card c-teal"><div class="stat-label">Assessments</div><div class="stat-value">${totalProgress}</div><div class="stat-sub">recorded</div></div>
        <div class="stat-card c-green"><div class="stat-label">Achieved</div><div class="stat-value">${achieved}</div><div class="stat-sub">outcomes met</div></div>
        <div class="stat-card c-gold" style="cursor:pointer" onclick="showView('coverage')">
          <div class="stat-label">Coverage</div>
          <div class="stat-value" style="font-size:24px">${coveragePct}%</div>
          <div class="stat-sub">codes taught this year</div>
        </div>
        <div class="stat-card" style="cursor:pointer;border-top:2px solid var(--rust)" onclick="state.coverageFilter={subject:'all',year:'all',strand:'all',mode:'not-taught'};showView('coverage')">
          <div class="stat-label" style="color:var(--rust)">Gaps</div>
          <div class="stat-value" style="color:var(--rust);font-size:24px">${gaps}</div>
          <div class="stat-sub">emerging / at risk</div>
        </div>
      </div>
      ${subjects.length > 0 ? `
        <div style="margin-bottom:6px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3)">Learning Areas · click to browse codes</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:20px">${subjects.map(subjectCard).join('')}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-head"><div class="card-title">Students</div><button class="btn" onclick="showView('students')">View all →</button></div>
          <div style="padding:8px 0;">
            ${totalStudents === 0
              ? `<div class="empty-state" style="padding:30px"><div class="empty-icon">◎</div><div class="empty-title">No students yet</div><button class="btn btn-primary" style="margin-top:8px" onclick="openAddStudentModal()">+ Add Student</button></div>`
              : state.students.slice(0,5).map((s,i) => {
                  const stats = getProgressStats(s.id);
                  return `<div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--border);cursor:pointer" onclick="openStudentDetail('${s.id}')">
                    <div class="sc-avatar ${getAvClass(i)}" style="width:32px;height:32px;font-size:13px">${getInitials(s)}</div>
                    <div style="flex:1"><div style="font-size:13px;font-weight:600">${s.first_name} ${s.last_name}</div><div style="font-size:10px;color:var(--text3)">Year ${s.year_level}</div></div>
                    <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--green)">${stats.pct}%</div>
                  </div>`;
                }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">Recent Assessments</div></div>
          <div style="padding:8px 0;">
            ${recent.length === 0
              ? `<div class="empty-state" style="padding:30px"><div class="empty-icon">◈</div><div class="empty-title">No assessments yet</div></div>`
              : recent.map(p => {
                  const student = state.students.find(s => s.id === p.student_id);
                  const name = student ? `${student.first_name} ${student.last_name}` : 'Unknown';
                  const cd = state.curriculumCodes.find(c => c.Code === p.code);
                  return `<div style="display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid var(--border)">
                    <div style="flex:1"><div style="font-size:12px;font-weight:600">${name}</div><div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">${p.code}${cd ? ' · '+cd.Subject : ''}</div></div>
                    <div class="mastery-badge ${masteryClass(p.mastery)}">${masteryDot(p.mastery)} ${p.mastery}</div>
                  </div>`;
                }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── CLASS OVERVIEW ──
function renderClassOverview(main) {
  const yearLevelMap = { 'F':'Foundation','1':'Year 1','2':'Year 2','3':'Year 3','4':'Year 4','5':'Year 5','6':'Year 6' };

  if (!state.overviewFilter) state.overviewFilter = { year: 'all', subject: 'English', strand: 'all', mode: 'mastery' };
  if (!state.overviewFilter.mode) state.overviewFilter.mode = 'mastery';
  const ovf = state.overviewFilter;

  const availableSubjects = getEnabledSubjectsFromRows(state.curriculumCodes);
  if (!availableSubjects.length) {
    main.innerHTML = `<div class="topbar"><div class="topbar-title">Class Overview</div></div>
      <div class="content"><div class="empty-state" style="padding:60px"><div class="empty-icon">▦</div><div class="empty-title">No enabled subjects for this class</div><div class="empty-sub">Go to Admin &amp; Settings to enable subjects and strands.</div></div></div>`;
    return;
  }
  if (!availableSubjects.includes(ovf.subject)) {
    ovf.subject = availableSubjects[0];
    ovf.strand = 'all';
  }

  function getCodesForStudent(student) {
    const csvYear = yearLevelMap[normaliseYear(student.year_level)] || student.year_level;
    return state.curriculumCodes.filter(c => {
      if (c.Subject !== ovf.subject) return false;
      if (!isCurriculumCodeEnabled(c)) return false;
      if ((c['Year Level']||'').trim() !== (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear)) return false;
      if (ovf.strand !== 'all' && c.Strand !== ovf.strand) return false;
      return true;
    });
  }

  function getStrandsForStudent(student) {
    const csvYear = yearLevelMap[normaliseYear(student.year_level)] || student.year_level;
    return [...new Set(state.curriculumCodes.filter(c => c.Subject === ovf.subject && (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear) && isCurriculumCodeEnabled(c)).map(c => c.Strand).filter(Boolean))].sort();
  }

  function masteryColour(pct) {
    if (pct >= 80) return 'var(--green)';
    if (pct >= 50) return 'var(--gold)';
    if (pct > 0)   return 'var(--rust)';
    return 'var(--border2)';
  }

  function masteryBg(pct) {
    if (pct >= 80) return 'var(--green-dim)';
    if (pct >= 50) return 'var(--gold-dim)';
    if (pct > 0)   return 'var(--rust-dim)';
    return 'var(--surface-alt)';
  }

  const visibleStudents = sortStudents(state.students.filter(s => ovf.year === 'all' || normaliseYear(s.year_level) === ovf.year));

  function buildStrandGrid() {
    if (!visibleStudents.length) return `<div class="empty-state" style="padding:60px"><div class="empty-icon">▦</div><div class="empty-title">No students match this filter</div></div>`;
    const allStrands = ovf.strand !== 'all' ? [ovf.strand]
      : [...new Set(visibleStudents.flatMap(s => getStrandsForStudent(s)))].sort()
          .filter(strand => !state.classSettings || isStrandEnabled(ovf.subject, strand));

    return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:600px">
      <thead><tr style="background:var(--surface-alt)">
        <th style="padding:12px 16px;text-align:left;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.12em;color:var(--text3);text-transform:uppercase;width:180px;position:sticky;left:0;background:var(--surface-alt);z-index:2">Student</th>
        <th style="padding:12px 12px;text-align:center;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.12em;color:var(--text3);text-transform:uppercase;width:80px">Overall</th>
        ${allStrands.map(strand => `<th style="padding:12px 12px;text-align:center;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.12em;color:var(--text3);text-transform:uppercase;cursor:pointer" onclick="state.overviewFilter.strand='${strand}';renderClassOverview(document.getElementById('main-content'))" title="${escapeHtml(strand)}" tabindex="0" aria-label="${escapeHtml(`Filter by strand ${strand}`)}">${truncateWithTooltip(strand, 24, '', true)}<br><span style="font-size:9px;opacity:0.7;font-weight:500">click to filter</span></th>`).join('')}
        <th style="padding:12px 12px;text-align:center;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.12em;color:var(--text3);text-transform:uppercase;width:60px">Gaps</th>
      </tr></thead>
      <tbody>
        ${visibleStudents.map((s, si) => {
          const allCodes = getCodesForStudent(s);
          const achieved = allCodes.filter(c => getMasteryForCode(s.id, c.Code) === 'Achieved').length;
          const emerging = allCodes.filter(c => getMasteryForCode(s.id, c.Code) === 'Emerging').length;
          const overallPct = allCodes.length ? Math.round(achieved/allCodes.length*100) : 0;
          const strandCells = allStrands.map(strand => {
            const sc = allCodes.filter(c => c.Strand === strand);
            const sa = sc.filter(c => getMasteryForCode(s.id, c.Code) === 'Achieved').length;
            const pct = sc.length ? Math.round(sa/sc.length*100) : 0;
            return `<td style="padding:10px 12px;text-align:center;border-bottom:1px solid var(--border);cursor:pointer" onclick="openStudentDetail('${s.id}')">
              <div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px">
                <div style="width:44px;height:44px;border-radius:50%;background:${masteryBg(pct)};border:2px solid ${masteryColour(pct)};display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:${masteryColour(pct)}">${sc.length ? pct+'%' : '—'}</div>
                <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text3)">${sa}/${sc.length}</div>
              </div>
            </td>`;
          }).join('');
          return `<tr style="border-bottom:1px solid var(--border);background:${getStripedRowSurface(si)}">
            <td style="padding:12px 16px;position:sticky;left:0;background:${getStripedRowSurface(si)};z-index:1;cursor:pointer" onclick="openStudentDetail('${s.id}')">
              <div style="display:flex;align-items:center;gap:10px">
                <div class="sc-avatar ${getAvClass(si)}" style="width:30px;height:30px;font-size:12px;flex-shrink:0">${getInitials(s)}</div>
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text)" title="${escapeHtml(`${s.last_name}, ${s.first_name}`)}">${truncateWithTooltip(`${s.last_name}, ${s.first_name}`, 28, '', true)}</div>
                  <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">Yr ${normaliseYear(s.year_level)} · ${allCodes.length} codes</div>
                </div>
              </div>
            </td>
            <td style="padding:8px 12px;text-align:center;border-bottom:1px solid var(--border)">
              <div style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${masteryColour(overallPct)}">${overallPct}%</div>
              <div style="margin-top:4px;height:4px;background:var(--surface-alt);border-radius:2px;width:52px;margin-inline:auto;overflow:hidden"><div style="height:100%;width:${overallPct}%;background:${masteryColour(overallPct)};border-radius:2px"></div></div>
            </td>
            ${strandCells}
            <td style="padding:8px 12px;text-align:center;border-bottom:1px solid var(--border)">
              ${emerging > 0 ? `<span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--rust)">${emerging}</span>` : `<span style="color:var(--text3);font-size:11px">—</span>`}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    <div style="display:flex;gap:16px;padding:12px 16px;border-top:1px solid var(--border);flex-wrap:wrap">
      <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3);margin-right:4px;align-self:center">Legend</div>
      ${[['≥80%','var(--green)','var(--green-dim)'],['50–79%','var(--gold)','var(--gold-dim)'],['1–49%','var(--rust)','var(--rust-dim)'],['Not assessed','var(--border2)','var(--surface-alt)']].map(([label,col,bg]) => `
        <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:50%;background:${bg};border:2px solid ${col}"></div><span style="font-size:11px;color:var(--text3)">${label}</span></div>
      `).join('')}
      <div style="margin-left:auto;font-size:11px;color:var(--text3)">Click any cell or name to open student profile · Click strand header to filter</div>
    </div>`;
  }

  function buildICCoverageTree() {
    if (!state.icCoverageOpen) state.icCoverageOpen = {};

    // Determine class year levels from active students
    const classYearLevels = [...new Set(
      state.students.map(s => yearLevelMap[normaliseYear(s.year_level)] || s.year_level).filter(Boolean)
    )];

    // Active students for counting
    const activeStudents = state.students;
    const totalStudents = activeStudents.length;

    if (!totalStudents) {
      return `<div class="empty-state" style="padding:60px"><div class="empty-icon">▦</div><div class="empty-title">No students in this class</div></div>`;
    }

    // Build set of descriptor IDs that have at least one system default IC
    // Include both home and linked (tethered) descriptors so a CD that only receives
    // evidence via linkedDescriptorIds (e.g. a Science inquiry CD) still renders a row.
    const descriptorsWithICs = new Set(
      state.instructionalComponents
        .filter(ic => ic.ownerTier === 'system_default' && !ic.isArchived)
        .flatMap(ic => [ic.homeDescriptorId, ...ic.linkedDescriptorIds])
        .filter(Boolean)
    );

    if (!descriptorsWithICs.size) {
      return `<div class="empty-state" style="padding:60px"><div class="empty-icon">▦</div><div class="empty-title">No system default ICs loaded yet</div><div class="empty-sub">IC coverage will appear once default ICs have been loaded.</div></div>`;
    }

    // Collect enabled curriculum codes for this class's year levels that have ICs
    const eligibleCodes = state.curriculumCodes.filter(c =>
      isCurriculumCodeEnabled(c) &&
      (BANDED_SUBJECTS.has(c.Subject)
        ? classYearLevels.some(yl => bandYearLevel(yl) === (c['Year Level']||'').trim())
        : classYearLevels.includes((c['Year Level']||'').trim())) &&
      descriptorsWithICs.has(c.Code)
    );

    if (!eligibleCodes.length) {
      return `<div class="empty-state" style="padding:60px"><div class="empty-icon">▦</div><div class="empty-title">No descriptors with ICs for this class</div><div class="empty-sub">IC coverage will appear once default ICs are available for your class year levels.</div></div>`;
    }

    // Group by subject → strand
    const subjectMap = {};
    eligibleCodes.forEach(c => {
      const subj = c.Subject || '(Unknown)';
      const strand = c.Strand || '(Unknown)';
      if (!subjectMap[subj]) subjectMap[subj] = {};
      if (!subjectMap[subj][strand]) subjectMap[subj][strand] = [];
      subjectMap[subj][strand].push(c);
    });

    // Count IC-student combinations: total = icIds.length × students.length.
    // Uses getTaughtICStatus (most-recent record) to classify each (ic, student) pair into
    // four mutually exclusive buckets: gotIt | taught | needsReview | notTaught (no record).
    function getICStudentCounts(icIds, students) {
      const total = icIds.length * students.length;
      let gotIt = 0, taught = 0, needsReview = 0;
      icIds.forEach(icId => {
        students.forEach(s => {
          const st = getTaughtICStatus(s.id, icId);
          if (st === 'got_it' || st === 'mastered')           gotIt++;
          else if (st === 'taught')                            taught++;
          else if (st === 'needs_review' || st === 'not_yet') needsReview++;
        });
      });
      return { gotIt, taught, needsReview, notTaught: total - gotIt - taught - needsReview, total };
    }

    // Render a four-colour bar (grey=notTaught, rust=needsReview, blue=taught, green=gotIt) + count line
    function renderCoverageBar(counts) {
      const { gotIt, taught, needsReview, notTaught, total } = counts;
      const gotItPct       = total ? Math.round(gotIt       / total * 100) : 0;
      const taughtPct      = total ? Math.round(taught      / total * 100) : 0;
      const needsReviewPct = total ? Math.round(needsReview / total * 100) : 0;
      const notPct         = 100 - gotItPct - taughtPct - needsReviewPct;
      return `<div style="min-width:160px;flex-shrink:0">
        <div style="height:8px;border-radius:4px;overflow:hidden;display:flex;background:var(--surface-alt)">
          ${notTaught   > 0 ? `<div style="width:${notPct}%;background:var(--border2);min-width:3px" title="${notTaught} not taught"></div>` : ''}
          ${needsReview > 0 ? `<div style="width:${needsReviewPct}%;background:var(--rust);min-width:3px" title="${needsReview} needs review"></div>` : ''}
          ${taught      > 0 ? `<div style="width:${taughtPct}%;background:var(--blue);min-width:3px" title="${taught} taught"></div>` : ''}
          ${gotIt       > 0 ? `<div style="width:${gotItPct}%;background:var(--green);min-width:3px" title="${gotIt} got it"></div>` : ''}
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-top:3px;white-space:nowrap">
          ${gotIt} got it · ${taught} taught · ${needsReview} needs review · ${notTaught} not taught
        </div>
      </div>`;
    }

    // Render expandable student-chip groups for an IC's four status buckets.
    // Uses state.icCoverageOpen with 'icchip|{icId}|{bucket}' keys — toggleICCoverageSection handles them.
    function renderICStudentChips(icId) {
      const byStatus = { got_it: [], taught: [], needs_review: [], notTaught: [] };
      activeStudents.forEach(s => {
        const st = getTaughtICStatus(s.id, icId);
        if (st === 'got_it' || st === 'mastered')           byStatus.got_it.push(s);
        else if (st === 'taught')                            byStatus.taught.push(s);
        else if (st === 'needs_review' || st === 'not_yet') byStatus.needs_review.push(s);
        else                                                 byStatus.notTaught.push(s);
      });

      const buckets = [
        { key: 'got_it',       label: 'Got it',       col: 'var(--green)', bg: 'var(--green-dim)',   list: byStatus.got_it },
        { key: 'taught',       label: 'Taught',        col: 'var(--blue)',  bg: 'var(--blue-dim)',    list: byStatus.taught },
        { key: 'needs_review', label: 'Needs review',  col: 'var(--rust)',  bg: 'var(--rust-dim)',    list: byStatus.needs_review },
        { key: 'notTaught',    label: 'Not taught',    col: 'var(--text3)', bg: 'var(--surface-alt)', list: byStatus.notTaught },
      ];

      return buckets.map(b => {
        if (!b.list.length) return '';
        const openKey = `icchip|${icId}|${b.key}`;
        const isOpen = !!state.icCoverageOpen[openKey];
        const chips = isOpen ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">${
          b.list.map(s => `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${b.bg};color:${b.col};border:1px solid ${b.col};white-space:nowrap">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</span>`).join('')
        }</div>` : '';
        return `<span style="display:inline-flex;flex-direction:column;align-items:flex-start">
          <button onclick="event.stopPropagation();toggleICCoverageSection('${escapeHtml(openKey)}')"
            style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 7px;border-radius:10px;background:${b.bg};color:${b.col};border:1px solid ${b.col};cursor:pointer;white-space:nowrap">
            ${b.list.length} ${b.label}${isOpen ? ' ▾' : ' ▸'}
          </button>
          ${chips}
        </span>`;
      }).filter(Boolean).join('');
    }

    // Render a descriptor row (click to expand/collapse IC sub-rows).
    // Key uses 'desc|{code}' prefix — distinct from subject keys, 'subj|strand' keys, and 'icchip|…' keys.
    function renderDescriptorRow(c) {
      // ICs homed on this descriptor (these alone drive the 80% mastery gate elsewhere).
      const systemICs = state.instructionalComponents.filter(ic =>
        ic.ownerTier === 'system_default' && !ic.isArchived && ic.homeDescriptorId === c.Code
      );
      // Tethered ICs — homed on another CD but listing this CD in linkedDescriptorIds.
      // Optional/display-only: counted here for coverage/rollup, never in the mastery gate.
      const linkedICs = state.instructionalComponents.filter(ic =>
        ic.ownerTier === 'system_default' && !ic.isArchived &&
        ic.linkedDescriptorIds.includes(c.Code) &&
        ic.homeDescriptorId !== c.Code
      );
      const rowICs = [...systemICs, ...linkedICs];
      // Coverage counts: home ICs counted per-IC (each is a required component); linked
      // ICs rolled up with OR per student (any one tethered got_it = met) so a descriptor
      // tethered to several contexts doesn't read as a false gap. Linked ICs stay
      // display/rollup only and never feed the 80% mastery gate.
      const descCounts = getICStudentCounts(systemICs.map(ic => ic.id), activeStudents);
      if (linkedICs.length) {
        activeStudents.forEach(s => {
          const st = rollUpICStatuses(linkedICs.map(ic => getTaughtICStatus(s.id, ic.id)).filter(Boolean));
          descCounts.total++;
          if (st === 'got_it')            descCounts.gotIt++;
          else if (st === 'needs_review') descCounts.needsReview++;
          else if (st === 'taught')       descCounts.taught++;
          else                            descCounts.notTaught++;
        });
      }
      const descPct = descCounts.total
        ? Math.round((descCounts.taught + descCounts.gotIt) / descCounts.total * 100)
        : null;

      const descKey = 'desc|' + c.Code;
      const descOpen = !!state.icCoverageOpen[descKey];

      const icRows = descOpen ? rowICs.map(ic => {
        const icCounts = getICStudentCounts([ic.id], activeStudents);
        const isLinked = ic.homeDescriptorId !== c.Code;
        const label = ic.name || ic.id;
        return `<div style="padding:6px 16px 6px 48px;border-bottom:1px solid var(--border);background:var(--surface)">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="min-width:120px;flex-shrink:0">
              <div style="font-family:'Instrument Sans',sans-serif;font-size:12px;color:var(--text-muted);line-height:1.4">${escapeHtml(label.length > 60 ? label.slice(0, 60) + '…' : label)}${isLinked ? ` <span title="Tethered skill IC — homed on ${escapeHtml(ic.homeDescriptorId)}" style="font-family:'DM Mono',monospace;font-size:8px;color:var(--blue);border:1px solid var(--blue);border-radius:6px;padding:1px 5px;white-space:nowrap">↳ ${escapeHtml(ic.homeDescriptorId)}</span>` : ''}</div>
            </div>
            <div style="flex:1;min-width:0"></div>
            ${renderCoverageBar(icCounts)}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding:5px 0 2px 132px">
            ${renderICStudentChips(ic.id)}
          </div>
        </div>`;
      }).join('') : '';

      const progressForDesc = descOpen ? state.progress.filter(p => p.code === c.Code) : [];
      const descMasteryColours = {
        'Achieved':  ['var(--green)', 'var(--green-dim)'],
        'Extended':  ['var(--teal)',  'var(--teal-dim)'],
        'Developing':['var(--gold)',  'var(--gold-dim)'],
        'Emerging':  ['var(--rust)',  'var(--rust-dim)'],
      };
      const masteryJudgementsHtml = progressForDesc.length ? `
        <div style="padding:6px 16px 6px 48px;border-bottom:1px solid var(--border);background:var(--surface)">
          <span style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3);display:inline-block;margin-bottom:4px">Mastery Judgements</span>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${progressForDesc.map(p => {
              const stu = state.students.find(s => s.id === p.student_id);
              if (!stu) return '';
              const [mc, bg] = descMasteryColours[p.mastery] || ['var(--text3)', 'var(--surface-alt)'];
              return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 6px;border-radius:10px;background:${bg};border:1px solid ${mc};font-size:10px;color:${mc}">${escapeHtml(stu.first_name)} ${escapeHtml(stu.last_name[0])}. <span style="font-family:'DM Mono',monospace;font-size:8px">${escapeHtml(p.mastery)}</span><button onclick="event.stopPropagation();openEditProgressIndicator('${stu.id}','${c.Code}')" title="Edit mastery judgement" style="border:none;background:none;color:${mc};cursor:pointer;padding:0 1px;font-size:11px;line-height:1;margin-left:2px">✎</button></span>`;
            }).filter(Boolean).join('')}
          </div>
        </div>` : '';

      return `<div>
        <div onclick="toggleICCoverageSection('${escapeHtml(descKey)}')"
          style="display:flex;align-items:center;gap:12px;padding:8px 16px 8px 32px;border-bottom:1px solid var(--border);min-height:44px;cursor:pointer;user-select:none"
          tabindex="0" role="button" aria-expanded="${descOpen}"
          onkeydown="if(event.key==='Enter'||event.key===' ')toggleICCoverageSection('${escapeHtml(descKey)}')">
          <span style="font-size:10px;color:var(--text3);width:12px;flex-shrink:0">${descOpen ? '▾' : '▸'}</span>
          <div style="min-width:108px;flex-shrink:0">
            <div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:600;color:var(--text2)">${escapeHtml(c.Code)}</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;color:var(--text-muted)">${truncateWithTooltip(c.Descriptor || c.Aspect || '', 80, '', true)}</div>
          </div>
          ${descPct !== null ? `<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);flex-shrink:0;white-space:nowrap">${descPct}% taught</div>` : ''}
          ${renderCoverageBar(descCounts)}
        </div>
        ${icRows}
        ${masteryJudgementsHtml}
      </div>`;
    }

    // Compute taught % for a set of descriptor codes: (taught + gotIt) / total IC-student combinations
    function taughtPctForCodes(codes) {
      const icIds = codes.flatMap(c =>
        state.instructionalComponents
          .filter(ic => ic.ownerTier === 'system_default' && !ic.isArchived && ic.homeDescriptorId === c.Code)
          .map(ic => ic.id)
      );
      if (!icIds.length) return null;
      const { taught, gotIt, total } = getICStudentCounts(icIds, activeStudents);
      return total ? Math.round((taught + gotIt) / total * 100) : 0;
    }

    const subjects = Object.keys(subjectMap).sort();

    const html = subjects.map(subj => {
      const subjKey = subj;
      const subjOpen = !!state.icCoverageOpen[subjKey];
      const strands = Object.keys(subjectMap[subj]).sort();
      const totalCodes = strands.reduce((n, st) => n + subjectMap[subj][st].length, 0);

      const subjAllCodes = strands.flatMap(st => subjectMap[subj][st]);
      const subjPct = taughtPctForCodes(subjAllCodes);
      const subjPctLabel = subjPct !== null ? ` · ${subjPct}% taught` : '';

      const strandSections = subjOpen ? strands.map(strand => {
        const strandKey = subj + '|' + strand;
        const strandOpen = !!state.icCoverageOpen[strandKey];
        const codes = subjectMap[subj][strand];
        const strandPct = taughtPctForCodes(codes);
        const strandPctLabel = strandPct !== null ? ` · ${strandPct}% taught` : '';
        const descriptorRows = strandOpen ? codes.map(renderDescriptorRow).join('') : '';
        return `<div style="border-bottom:1px solid var(--border)">
          <div onclick="toggleICCoverageSection('${escapeHtml(strandKey)}')"
            style="display:flex;align-items:center;gap:10px;padding:8px 16px 8px 24px;cursor:pointer;background:var(--surface);user-select:none"
            tabindex="0" role="button" aria-expanded="${strandOpen}"
            onkeydown="if(event.key==='Enter'||event.key===' ')toggleICCoverageSection('${escapeHtml(strandKey)}')">
            <span style="font-size:10px;color:var(--text3);width:12px">${strandOpen ? '▾' : '▸'}</span>
            <span style="font-size:12px;font-weight:600;color:var(--text2);flex:1">${escapeHtml(strand)}</span>
            <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">${codes.length} descriptor${codes.length !== 1 ? 's' : ''}${strandPctLabel}</span>
          </div>
          ${strandOpen ? `<div>${descriptorRows}</div>` : ''}
        </div>`;
      }).join('') : '';

      return `<div style="margin-bottom:8px;border:1px solid var(--border);border-radius:6px;overflow:hidden">
        <div onclick="toggleICCoverageSection('${escapeHtml(subjKey)}')"
          style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;background:var(--surface-alt);user-select:none"
          tabindex="0" role="button" aria-expanded="${subjOpen}"
          onkeydown="if(event.key==='Enter'||event.key===' ')toggleICCoverageSection('${escapeHtml(subjKey)}')">
          <span style="font-size:11px;color:var(--text3);width:14px">${subjOpen ? '▾' : '▸'}</span>
          <span style="font-size:13px;font-weight:700;color:var(--text);flex:1">${escapeHtml(subjectShort(subj))}</span>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">${totalCodes} descriptor${totalCodes !== 1 ? 's' : ''} · ${strands.length} strand${strands.length !== 1 ? 's' : ''}${subjPctLabel}</span>
        </div>
        ${subjOpen ? `<div>${strandSections}</div>` : ''}
      </div>`;
    }).join('');

    const readyPairs = getReadyForMasteryBanner();
    const bannerHtml = renderMasteryBannerHtml(readyPairs);

    return `<div style="padding:16px">
      ${bannerHtml}
      ${html || `<div class="empty-state" style="padding:40px"><div class="empty-icon">▦</div><div class="empty-title">No IC data to display</div></div>`}
      <div style="display:flex;gap:16px;padding:8px 0;flex-wrap:wrap">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3);align-self:center">Legend</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:8px;border-radius:2px;background:var(--green)"></div><span style="font-size:11px;color:var(--text3)">Got it</span></div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:8px;border-radius:2px;background:var(--blue)"></div><span style="font-size:11px;color:var(--text3)">Taught</span></div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:8px;border-radius:2px;background:var(--rust)"></div><span style="font-size:11px;color:var(--text3)">Needs review</span></div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:8px;border-radius:2px;background:var(--border2)"></div><span style="font-size:11px;color:var(--text3)">Not taught</span></div>
      </div>
    </div>`;
  }

  const isMastery = ovf.mode === 'mastery';

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:10px;padding:14px 24px">
      <div class="topbar-title">Class Overview <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3);font-weight:400">· ${ovf.subject}</span></div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto">
        <div style="display:flex;border:1px solid var(--border2);border-radius:5px;overflow:hidden;margin-right:6px">
          <button onclick="state.overviewFilter.mode='mastery';renderClassOverview(document.getElementById('main-content'))"
            style="padding:5px 13px;border:none;background:${isMastery?'var(--gold-dim)':'none'};color:${isMastery?'var(--gold)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;font-weight:${isMastery?'700':'400'}">
            Mastery
          </button>
          <button onclick="state.overviewFilter.mode='ic-coverage';renderClassOverview(document.getElementById('main-content'))"
            style="padding:5px 13px;border:none;border-left:1px solid var(--border2);background:${!isMastery?'var(--blue-dim)':'none'};color:${!isMastery?'var(--blue)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;font-weight:${!isMastery?'700':'400'}">
            IC Coverage
          </button>
        </div>
        ${isMastery ? `
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">SUBJECT</span>
        ${availableSubjects.map(subj => {
          const active = ovf.subject === subj;
          return `<button onclick="state.overviewFilter.subject='${subj}';state.overviewFilter.strand='all';renderClassOverview(document.getElementById('main-content'))"
            title="${escapeHtml(subj)}" aria-label="${escapeHtml(`Filter subject ${subj}`)}"
            style="padding:5px 11px;border-radius:4px;border:1px solid ${active?'var(--gold)':'var(--border2)'};background:${active?'var(--gold-dim)':'none'};color:${active?'var(--gold)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap">
            ${subjectShort(subj)}
          </button>`;
        }).join('')}
        <div style="width:1px;height:18px;background:var(--border2);margin:0 2px"></div>
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">YEAR</span>
        ${['all','F','1','2','3','4','5','6'].map(yr => `
          <button onclick="state.overviewFilter.year='${yr}';renderClassOverview(document.getElementById('main-content'))"
            style="padding:5px 11px;border-radius:4px;border:1px solid ${ovf.year===yr?'var(--blue)':'var(--border2)'};background:${ovf.year===yr?'var(--blue-dim)':'none'};color:${ovf.year===yr?'var(--blue)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">
            ${yr === 'all' ? 'All' : 'Yr '+yr}
          </button>`).join('')}
        ${ovf.strand !== 'all' ? `<button onclick="state.overviewFilter.strand='all';renderClassOverview(document.getElementById('main-content'))" style="padding:5px 11px;border-radius:4px;border:1px solid var(--teal);background:var(--teal-dim);color:var(--teal);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer" title="${escapeHtml(ovf.strand)}">✕ ${truncateWithTooltip(ovf.strand, 20)}</button>` : ''}
        ` : ''}
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">${APP_VERSION}</span>
      </div>
    </div>
    <div class="content" style="padding:0">
      <div class="card" style="border-radius:0;border-left:none;border-right:none;border-top:none">
        ${state.curriculumCodes.length === 0
          ? `<div class="empty-state" style="padding:60px"><div class="empty-icon">▦</div><div class="empty-title">Curriculum data not loaded yet</div><div class="empty-sub">The overview will appear once your CSV files have loaded</div></div>`
          : isMastery ? buildStrandGrid() : buildICCoverageTree()}
      </div>
    </div>
  `;
}

function toggleICCoverageSection(key) {
  if (!state.icCoverageOpen) state.icCoverageOpen = {};
  state.icCoverageOpen[key] = !state.icCoverageOpen[key];
  renderClassOverview(document.getElementById('main-content'));
}

// ── STUDENTS LIST ──
function renderStudents(main) {
  main.innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Students</div>
      <div class="topbar-actions">
        <div class="search-wrap">
          <span class="search-icon">⌕</span>
          <input class="search-input" placeholder="Search students…" oninput="filterStudents(this.value)" id="student-search">
        </div>
        <button class="btn" onclick="toggleStudentSort()" title="Toggle name sort order">
          ${state.studentSortBy === 'last_name' ? '↕ Last, First' : '↕ First, Last'}
        </button>
        <button class="btn" onclick="openBulkPrintModal()">⎙ Bulk Print Reports</button>
        <button class="btn btn-primary" onclick="openAddStudentModal()">+ Add Student</button>
      </div>
    </div>
    <div class="content">
      ${state.students.length === 0
        ? `<div class="empty-state" style="padding:80px"><div class="empty-icon">◎</div><div class="empty-title">No students yet</div><div class="empty-sub">Add your first student to start tracking progress.</div><button class="btn btn-primary" style="margin-top:12px" onclick="openAddStudentModal()">+ Add Student</button></div>`
        : `<div class="student-grid" id="student-grid">${renderStudentCards(sortStudents(state.students))}</div>`}
    </div>
  `;
}

function renderStudentCards(students) {
  return students.map((s, i) => {
    const stats = getProgressStats(s.id);
    return `<div class="student-card" data-action="openStudentDetail" data-student-id="${s.id}">
      <div class="sc-top">
        <div class="sc-avatar ${getAvClass(i)}">${getInitials(s)}</div>
        <div><div class="sc-name">${s.first_name} ${s.last_name}</div><div class="sc-year">Year ${s.year_level}</div></div>
      </div>
      <div class="sc-bars">
        <div class="sc-bar-row"><div class="sc-bar-label">Achieved</div><div class="sc-bar-track"><div class="sc-bar-fill bar-green" style="width:${stats.total ? Math.round(stats.achieved/stats.total*100) : 0}%"></div></div><div class="sc-bar-pct">${stats.achieved}</div></div>
        <div class="sc-bar-row"><div class="sc-bar-label">Developing</div><div class="sc-bar-track"><div class="sc-bar-fill bar-gold" style="width:${stats.total ? Math.round(stats.developing/stats.total*100) : 0}%"></div></div><div class="sc-bar-pct">${stats.developing}</div></div>
        <div class="sc-bar-row"><div class="sc-bar-label">Emerging</div><div class="sc-bar-track"><div class="sc-bar-fill" style="width:${stats.total ? Math.round(stats.emerging/stats.total*100) : 0}%;background:var(--rust)"></div></div><div class="sc-bar-pct">${stats.emerging}</div></div>
      </div>
    </div>`;
  }).join('');
}

function filterStudents(q) {
  const grid = document.getElementById('student-grid');
  if (!grid) return;
  const filtered = sortStudents(state.students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(q.toLowerCase())
  ));
  grid.innerHTML = renderStudentCards(filtered);
}

// ── STUDENT DETAIL ──
function openStudentDetail(studentId) {
  // Call sites pass the id as a string (inline onclick markup and the dataset delegator),
  // but state.students ids can be numbers, strings, or a mix (Sheets-loaded rows vs.
  // API-added students). Resolve by stringified id and store the student's own id so every
  // strict === lookup downstream (renderStudentDetail, print scope) matches the right row.
  const student = state.students.find(x => String(x.id) === String(studentId));
  state.selectedStudent = student ? student.id : studentId;
  setCurrentView('student-detail');
  state.detailFilter = 'all';
  state.detailSection = 'curriculum'; // always reset to curriculum tab
  state.detailYearFilter = student ? student.year_level : 'all';
  // Auto-select first available subject if not yet set
  if (!state.detailSubjectFilter) {
    const subjects = getEnabledSubjectsFromRows(state.curriculumCodes);
    state.detailSubjectFilter = subjects[0] || 'English';
  }
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  renderView();
}

function setDetailYearFilter(year)  { state.detailYearFilter = year; renderView(); }
function setDetailSubject(subj)     { state.detailSubjectFilter = subj; state.detailFilter = 'all'; state.detailStrandFilter = 'all'; renderView(); }
function setDetailStrand(strand)    { state.detailStrandFilter = strand; state.detailFilter = 'all'; renderView(); }

function renderStudentDetail(main) {
  const s = state.students.find(x => x.id === state.selectedStudent);
  if (!s) { showView('students'); return; }

  const si = state.students.indexOf(s);
  const filter = state.detailFilter || 'all';

  const yearLevelMap = { 'F':'Foundation','1':'Year 1','2':'Year 2','3':'Year 3','4':'Year 4','5':'Year 5','6':'Year 6' };
  const yearFilter = state.detailYearFilter !== undefined ? state.detailYearFilter : s.year_level;

  // All subjects available in the curriculum data
  const availableSubjects = getEnabledSubjectsFromRows(state.curriculumCodes);
  const subjectFilter = availableSubjects.includes(state.detailSubjectFilter) ? state.detailSubjectFilter : (availableSubjects[0] || 'English');
  state.detailSubjectFilter = subjectFilter;

  // Subject colour map for the tab pills


  // Filter codes by selected subject + year + strand
  const strandFilter = state.detailStrandFilter || 'all';
  const availableStrands = [...new Set(
    state.curriculumCodes.filter(c => c.Subject === subjectFilter && isCurriculumCodeEnabled(c)).map(c => c.Strand).filter(Boolean)
  )].sort();

  let codes = state.curriculumCodes.filter(c => {
    if (c.Subject !== subjectFilter) return false;
    if (strandFilter !== 'all' && c.Strand !== strandFilter) return false;
    if (state.classSettings && !isCurriculumCodeEnabled(c)) return false;
    if (!yearFilter || yearFilter === 'all') return true;
    const csvYear = yearLevelMap[yearFilter] || yearFilter;
    return (c['Year Level'] || '').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear);
  });

  const filteredCodes = codes.filter(c => {
    const mastery = getMasteryForCode(s.id, c.Code);
    const taught  = wasCodeTaughtToStudent(s.id, c.Code);
    if (filter === 'all')        return true;
    if (filter === 'achieved')   return mastery === 'Achieved';
    if (filter === 'developing') return mastery === 'Developing';
    if (filter === 'emerging')   return mastery === 'Emerging';
    if (filter === 'nottaught')  return mastery === 'Not taught';
    if (filter === 'taught')     return taught;
    if (filter === 'nottaughtyet') return !taught;
    return true;
  });

  const taughtCount    = codes.filter(c => wasCodeTaughtToStudent(s.id, c.Code)).length;
  const notTaughtCount = codes.length - taughtCount;

  const stats = {
    achieved:   codes.filter(c => getMasteryForCode(s.id, c.Code) === 'Achieved').length,
    developing: codes.filter(c => getMasteryForCode(s.id, c.Code) === 'Developing').length,
    emerging:   codes.filter(c => getMasteryForCode(s.id, c.Code) === 'Emerging').length,
    nottaught:  codes.filter(c => getMasteryForCode(s.id, c.Code) === 'Not taught').length,
  };

  const activeCol = subjectCol(subjectFilter);

  main.innerHTML = `
    <div class="detail-header" style="flex-wrap:wrap;gap:12px">
      <button class="btn" onclick="showView('students')" style="margin-right:4px">← Back</button>
      <div class="detail-avatar ${getAvClass(si)}">${getInitials(s)}</div>
      <div>
        <div class="detail-name">${s.first_name} ${s.last_name}</div>
        <div class="detail-meta">Year ${s.year_level} · ${subjectFilter} · ${codes.length} codes</div>
      </div>

      <!-- Subject tabs -->
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3)">Subject</span>
        ${availableSubjects.map(subj => {
          const col = subjectCol(subj);
          const active = subjectFilter === subj;
          return `<button onclick="setDetailSubject('${subj}')"
            style="padding:4px 10px;border-radius:4px;border:1px solid ${active?col:'var(--border2)'};background:${active?col+'22':'none'};color:${active?col:'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;transition:all 0.15s;font-weight:${active?'700':'400'}">
            ${subjectShort(subj)}
          </button>`;
        }).join('')}
      </div>

      <!-- Strand filter row -->
      ${availableStrands.length > 0 ? `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3)">Strand</span>
        <button onclick="setDetailStrand('all')"
          style="padding:4px 10px;border-radius:4px;border:1px solid ${strandFilter==='all'?activeCol:'var(--border2)'};background:${strandFilter==='all'?activeCol+'22':'none'};color:${strandFilter==='all'?activeCol:'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;font-weight:${strandFilter==='all'?'700':'400'}">
          All
        </button>
        ${availableStrands.map(st => `<button onclick="setDetailStrand('${st}')"
          style="padding:4px 10px;border-radius:4px;border:1px solid ${strandFilter===st?activeCol:'var(--border2)'};background:${strandFilter===st?activeCol+'22':'none'};color:${strandFilter===st?activeCol:'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap;font-weight:${strandFilter===st?'700':'400'}">
          ${st}
        </button>`).join('')}
      </div>` : ''}

      <!-- Year level toggle -->
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3)">Year</span>
        ${['all','F','1','2','3','4','5','6'].map(yr => `
          <button onclick="setDetailYearFilter('${yr}')"
            style="padding:4px 10px;border-radius:4px;border:1px solid ${yearFilter===yr||(!yearFilter&&yr==='all')?'var(--blue)':'var(--border2)'};
            background:${yearFilter===yr||(!yearFilter&&yr==='all')?'var(--blue-dim)':'none'};
            color:${yearFilter===yr||(!yearFilter&&yr==='all')?'var(--blue)':'var(--text3)'};
            font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;transition:all 0.15s;
            font-weight:${yr===s.year_level?'700':'400'}">
            ${yr === 'all' ? 'All' : yr}${yr === s.year_level ? ' ★' : ''}
          </button>`).join('')}
      </div>

      <div style="display:flex;gap:8px;flex-shrink:0">
        <button class="btn" onclick="state.sjFilter={subject:'${subjectFilter}',year:'${s.year_level}',period:''};showView('standards-judgments')">◈ Judgments</button>
        <button class="btn" onclick="state.ppFilter={type:'literacy',element:'',year:'${normaliseYear(s.year_level)}'};showView('progression-placement')">⟡ Progression</button>
        <button class="btn" onclick="openBulkPrintModal()">⎙ Bulk Print</button>
        <button class="btn" onclick="openPrintOptionsModal('${s.id}')">⎙ Print Report</button>
        <button class="btn btn-primary" onclick="openBulkAssess('${s.id}')">+ Record Assessment</button>
      </div>
    </div>
  `;

  const section = state.detailSection || 'curriculum';

  // ── Section: Coverage (personal heatmap by strand) ──
  function buildCoverageSection() {
    const subjectCodes = state.curriculumCodes.filter(c => {
      if (c.Subject !== subjectFilter) return false;
      if (!isCurriculumCodeEnabled(c)) return false;
      if (!yearFilter || yearFilter === 'all') return true;
      const csvYear = yearLevelMap[yearFilter] || yearFilter;
      return (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear);
    });
    const strands = [...new Set(subjectCodes.map(c => c.Strand).filter(Boolean))].sort();

    if (!subjectCodes.length) return `<div class="empty-state" style="padding:40px"><div class="empty-icon">◈</div><div class="empty-title">No codes loaded for this selection</div></div>`;

    return `<div class="card">
      ${strands.map(strand => {
        const sCodes = subjectCodes.filter(c => c.Strand === strand);
        const taughtHere   = sCodes.filter(c => wasCodeTaughtToStudent(s.id, c.Code)).length;
        const achievedHere = sCodes.filter(c => getMasteryForCode(s.id, c.Code) === 'Achieved').length;
        const pct = Math.round(taughtHere / sCodes.length * 100);

        return `<div style="padding:10px 16px;border-bottom:1px solid var(--border)">
          <!-- Strand header -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="font-size:12px;font-weight:600;color:var(--text);flex:1">${strand}</div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:${activeCol}">${taughtHere}/${sCodes.length} taught</div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--green)">${achievedHere} achieved</div>
            <div style="width:80px;height:4px;background:var(--surface-alt);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${activeCol};border-radius:2px"></div>
            </div>
          </div>
          <!-- Code chips -->
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            ${sCodes.map(c => {
              const mastery = getMasteryForCode(s.id, c.Code);
              const taught  = wasCodeTaughtToStudent(s.id, c.Code);
              const dates   = getTaughtDatesForCode(s.id, c.Code);
              let bg, col2, dot;
              if      (mastery==='Achieved')   { bg='var(--green)';    col2='var(--primary-contrast)'; dot='●'; }
              else if (mastery==='Developing') { bg='var(--gold)';     col2='var(--primary-contrast)'; dot='◐'; }
              else if (mastery==='Emerging')   { bg='var(--rust)';     col2='var(--primary-contrast)'; dot='○'; }
              else if (taught)                 { bg='var(--blue-dim)'; col2='var(--blue)'; dot='·'; }
              else                             { bg='var(--surface-alt)'; col2='var(--text3)'; dot=' '; }
              const tip = mastery !== 'Not taught' ? mastery : taught ? 'Taught '+dates[0] : 'Not taught yet';
              return `<div onclick="openCodeDetail('${c.Code}','${s.id}')"
                title="${c.Code} · ${tip}"
                style="padding:3px 8px;border-radius:4px;background:${bg};color:${col2};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:4px">
                <span style="font-size:10px">${dot}</span>${c.Code}
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Section: Progressions (personal placement + next steps) ──
  function buildProgressionsSection() {
    const litProgs  = state.progressions;
    const numProgs  = state.numeracyProgressions;
    const bothEmpty = !litProgs.length && !numProgs.length;
    if (bothEmpty) return `<div class="empty-state" style="padding:40px"><div class="empty-icon">⟡</div><div class="empty-title">No progressions loaded</div></div>`;

    function buildProgTable(progs, type, colour) {
      if (!progs.length) return '';
      const elements = [...new Set(progs.map(p => p.Element).filter(Boolean))];
      return `<div class="card" style="margin-bottom:16px">
        <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:10px;color:${colour};text-transform:uppercase;letter-spacing:0.1em">
          ${type === 'literacy' ? '✦ Literacy' : '∑ Numeracy'} Progressions
        </div>
        ${elements.map(element => {
          const subEls = [...new Set(progs.filter(p => p.Element === element).map(p => p['Sub-element']).filter(Boolean))].sort();
          return `<div style="padding:8px 16px;border-bottom:1px solid var(--border)">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px">${element}</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${subEls.map(subEl => {
                const items = progs.filter(p => p.Element === element && p['Sub-element'] === subEl);
                const levels = [...new Set(items.map(p => String(p['Progression level'])).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
                const placement = getPlacementForStudent(s.id, element, subEl);
                const curLevel  = placement ? String(placement.level) : null;
                const curIdx    = curLevel ? levels.indexOf(curLevel) : -1;
                const nextLevel = curIdx >= 0 && curIdx < levels.length-1 ? levels[curIdx+1] : null;
                const nextItem  = nextLevel ? items.find(i => String(i['Progression level']) === nextLevel) : null;
                const extLabel  = placement?.ext_value ? `${placement.ext_label||''} ${placement.ext_value}`.trim() : null;

                return `<div style="display:grid;grid-template-columns:160px 80px 1fr;gap:10px;align-items:start;padding:6px 8px;border-radius:6px;background:var(--surface-alt)">
                  <div style="font-size:11px;color:var(--text-muted)">${subEl}</div>
                  <div style="text-align:center">
                    <button data-pp-open="${s.id}" data-pp-element="${element.replace(/"/g,'&quot;')}" data-pp-subelement="${subEl.replace(/"/g,'&quot;')}"
                      style="padding:3px 10px;border-radius:4px;border:1px solid ${curLevel?colour:'var(--border2)'};background:${curLevel?colour+'22':'none'};color:${curLevel?colour:'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;font-weight:700">
                      ${curLevel ? 'L'+curLevel : '— Set'}
                    </button>
                    ${extLabel ? `<div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--gold);margin-top:2px">${extLabel}</div>` : ''}
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);line-height:1.4">
                    ${nextItem
                      ? `<span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--teal);background:var(--teal-dim);padding:1px 5px;border-radius:3px;margin-right:5px">L${nextLevel} ›</span>${nextItem['Indicator text (no examples)']||nextItem['Indicator text (verbatim)']||''}`
                      : curLevel
                        ? `<span style="color:var(--green);font-size:10px">✓ At highest level</span>`
                        : `<span style="color:var(--text3);font-size:10px">Set a level to see next step</span>`}
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }

    return buildProgTable(litProgs,'literacy','var(--blue)') + buildProgTable(numProgs,'numeracy','var(--green)');
  }

  // ── Section: Curriculum (original mastery table) ──
  function buildCurriculumSection() {
    return `<div class="mastery-tabs" style="flex-wrap:wrap">
        <button class="mastery-tab t-all ${filter==='all'?'active':''}" onclick="setDetailFilter('all')">All <span class="tab-count">${codes.length}</span></button>
        <button class="mastery-tab t-achieved ${filter==='achieved'?'active':''}" onclick="setDetailFilter('achieved')">● Achieved <span class="tab-count">${stats.achieved}</span></button>
        <button class="mastery-tab t-developing ${filter==='developing'?'active':''}" onclick="setDetailFilter('developing')">◐ Developing <span class="tab-count">${stats.developing}</span></button>
        <button class="mastery-tab t-emerging ${filter==='emerging'?'active':''}" onclick="setDetailFilter('emerging')">○ Emerging <span class="tab-count">${stats.emerging}</span></button>
        <button class="mastery-tab t-nottaught ${filter==='nottaught'?'active':''}" onclick="setDetailFilter('nottaught')">· Not assessed <span class="tab-count">${stats.nottaught}</span></button>
        <div style="width:1px;background:var(--border2);margin:0 4px;align-self:stretch"></div>
        <button class="mastery-tab ${filter==='taught'?'active t-all':''}" onclick="setDetailFilter('taught')"
          style="${filter==='taught'?'color:var(--green);border-color:var(--green);background:var(--green-dim)':''}">
          ✓ Taught <span class="tab-count">${taughtCount}</span>
        </button>
        <button class="mastery-tab ${filter==='nottaughtyet'?'active':''}" onclick="setDetailFilter('nottaughtyet')"
          style="${filter==='nottaughtyet'?'color:var(--rust);border-color:var(--rust);background:var(--rust-dim)':''}">
          ✗ Not taught yet <span class="tab-count">${notTaughtCount}</span>
        </button>
      </div>
      <div class="card">
        ${filteredCodes.length === 0
          ? `<div class="empty-state" style="padding:40px"><div class="empty-icon">◈</div><div class="empty-title">No codes in this filter</div>${codes.length === 0 ? '<div class="empty-sub">No '+subjectFilter+' codes loaded for this year level</div>' : ''}</div>`
          : `<table class="codes-table">
              <thead><tr><th>Code</th><th>Learning Outcome</th><th>Strand</th><th>Taught</th><th>Mastery</th><th>Date</th></tr></thead>
              <tbody>
                ${filteredCodes.map(c => {
                  const mastery = getMasteryForCode(s.id, c.Code);
                  const componentSummary = getComponentMasterySummary(s.id, c.Code);
                  const prog = state.progress.find(p => p.student_id === s.id && p.code === c.Code);
                  const date = prog ? prog.date.split('T')[0] : '—';
                  const taught = wasCodeTaughtToStudent(s.id, c.Code);
                  const taughtDates = getTaughtDatesForCode(s.id, c.Code);
                  return `<tr style="cursor:pointer" onclick="openCodeDetail('${c.Code}','${s.id}')">
                    <td><span class="code-pill" style="background:var(--surface-alt);color:${activeCol}">${c.Code}</span></td>
                    <td style="max-width:300px;color:var(--text-muted)">${c.Descriptor || c.Aspect || '—'}</td>
                    <td><span class="aspect-tag">${c.Strand || '—'}</span></td>
                    <td onclick="event.stopPropagation()" style="white-space:nowrap">
                      ${taught
                        ? `<span title="Last taught: ${taughtDates[0]}" style="font-size:11px;color:var(--green);background:var(--green-dim);padding:2px 8px;border-radius:10px;cursor:default">✓ Taught</span>`
                        : `<span style="font-size:11px;color:var(--text3)">— Not yet</span>`}
                    </td>
                    <td onclick="event.stopPropagation()">
                      <div class="mastery-badge ${masteryClass(mastery)}" title="${componentSummary ? `${componentSummary.achieved}/${componentSummary.total} components achieved (${componentSummary.pct}%)` : ''}" onclick="openMasteryPicker('${s.id}','${c.Code}','${mastery}')">
                        ${masteryDot(mastery)} ${mastery}
                      </div>
                      ${componentSummary ? `<div style="font-size:10px;color:var(--text3);margin-top:3px">${componentSummary.achieved}/${componentSummary.total} components · ${componentSummary.label}</div>` : ''}
                    </td>
                    <td style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">${date}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>`}
      </div>`;
  }

  main.innerHTML = main.innerHTML + `
    <div class="content">
      <!-- Section switcher -->
      <div style="display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:0">
        ${[
          { id:'curriculum',   label:'⊞ Curriculum',   desc:'Code mastery table' },
          { id:'coverage',     label:'⬡ Coverage',      desc:'Visual coverage map' },
          { id:'progressions', label:'⟡ Progressions',  desc:'Placement & next steps' },
        ].map(tab => `<button onclick="setDetailSection('${tab.id}')"
          style="padding:8px 16px;border:none;border-bottom:2px solid ${section===tab.id?activeCol:'transparent'};background:none;color:${section===tab.id?activeCol:'var(--text3)'};font-family:'Instrument Sans',sans-serif;font-size:13px;font-weight:${section===tab.id?'600':'400'};cursor:pointer;transition:all 0.15s">
          ${tab.label}
        </button>`).join('')}
      </div>
      ${section === 'curriculum'   ? buildCurriculumSection()   : ''}
      ${section === 'coverage'     ? buildCoverageSection()     : ''}
      ${section === 'progressions' ? buildProgressionsSection() : ''}
    </div>
  `;
}

function setDetailFilter(f)   { state.detailFilter = f; renderView(); }
function setDetailSection(sec){ state.detailSection = sec; renderView(); }

// ── CURRICULUM CODES VIEW ──
let cdFilters = { subject: 'all', year: 'all', strand: 'all', sort: 'code', search: '' };

function getFilteredCurriculumCodes() {
  const yearOrder = ['Foundation','Year 1','Year 2','Year 3','Year 4','Year 5','Year 6'];
  let codes = state.curriculumCodes.filter(c => {
    if (!isCurriculumCodeEnabled(c)) return false;
    if (cdFilters.subject !== 'all' && (c.Subject||'').trim() !== cdFilters.subject) return false;
    if (cdFilters.year    !== 'all' && (c['Year Level']||'').trim() !== (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(cdFilters.year) : cdFilters.year)) return false;
    if (cdFilters.strand  !== 'all' && (c.Strand||'').trim() !== cdFilters.strand) return false;
    const q = cdFilters.search.toLowerCase();
    if (q && !((c.Code||'').toLowerCase().includes(q)||(c.Descriptor||'').toLowerCase().includes(q)||(c.Strand||'').toLowerCase().includes(q))) return false;
    return true;
  });
  codes.sort((a,b) => {
    if (cdFilters.sort === 'year')   { const ai=yearOrder.indexOf(a['Year Level']),bi=yearOrder.indexOf(b['Year Level']); return ai!==bi?ai-bi:(a.Code||'').localeCompare(b.Code||''); }
    if (cdFilters.sort === 'strand') return (a.Strand||'').localeCompare(b.Strand||'')||(a.Code||'').localeCompare(b.Code||'');
    return (a.Code||'').localeCompare(b.Code||'');
  });
  return codes;
}

function renderCurriculum(main) {
  const allCodes = state.curriculumCodes.filter(c => isCurriculumCodeEnabled(c));
  const codes    = getFilteredCurriculumCodes();
  const subjects = ['all', ...new Set(allCodes.map(c => c.Subject).filter(Boolean))].sort();
  const years    = ['all','Foundation','Year 1','Year 2','Year 3','Year 4','Year 5','Year 6'];
  const strands  = ['all', ...new Set(allCodes.filter(c => cdFilters.subject === 'all' || c.Subject === cdFilters.subject).map(c => c.Strand).filter(Boolean))].sort();

  function sel(opts, val, onchange) {
    return `<select onchange="${onchange}" style="background:var(--surface-alt);border:1px solid var(--border2);border-radius:5px;padding:5px 8px;color:var(--text-muted);font-size:12px;cursor:pointer;outline:none">
      ${opts.map(o => `<option value="${o}" ${val===o?'selected':''}>${o==='all'?'All':o}</option>`).join('')}
    </select>`;
  }

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:10px;padding:14px 24px">
      <div class="topbar-title">Curriculum Codes</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto">
        <div class="search-wrap"><span class="search-icon">⌕</span><input class="search-input" placeholder="Search…" value="${cdFilters.search}" oninput="cdFilters.search=this.value;renderCurriculum(document.getElementById('main-content'))"></div>
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">SUBJECT</span>
        ${sel(subjects, cdFilters.subject, "cdFilters.subject=this.value;cdFilters.strand='all';renderCurriculum(document.getElementById('main-content'))")}
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">YEAR</span>
        ${sel(years, cdFilters.year, "cdFilters.year=this.value;renderCurriculum(document.getElementById('main-content'))")}
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">STRAND</span>
        ${sel(strands, cdFilters.strand, "cdFilters.strand=this.value;renderCurriculum(document.getElementById('main-content'))")}
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">SORT</span>
        ${sel(['code','year','strand'], cdFilters.sort, "cdFilters.sort=this.value;renderCurriculum(document.getElementById('main-content'))")}
      </div>
    </div>
    <div class="content">
      ${allCodes.length === 0
        ? `<div class="empty-state"><div class="empty-icon">≡</div><div class="empty-title">No curriculum data loaded</div><div class="empty-sub">Open Data &amp; Settings to load your CSV files</div></div>`
        : `<div class="card">
            <div class="card-head" style="padding:10px 18px">
              <div style="font-size:13px;color:var(--text-muted)">Showing <strong style="color:var(--text)">${codes.length}</strong> of ${allCodes.length} codes</div>
              ${codes.length !== allCodes.length ? `<button class="btn" onclick="cdFilters={subject:'all',year:'all',strand:'all',sort:'code',search:''};renderCurriculum(document.getElementById('main-content'))">✕ Clear filters</button>` : ''}
            </div>
            <div style="overflow-x:auto">
              <table class="codes-table" style="table-layout:fixed;width:100%">
                <colgroup><col style="width:130px"><col style="width:auto"><col style="width:140px"><col style="width:110px"></colgroup>
                <thead><tr>
                  <th style="cursor:pointer" onclick="cdFilters.sort='code';renderCurriculum(document.getElementById('main-content'))">Code ${cdFilters.sort==='code'?'↑':''}</th>
                  <th>Descriptor</th>
                  <th style="cursor:pointer" onclick="cdFilters.sort='strand';renderCurriculum(document.getElementById('main-content'))">Strand ${cdFilters.sort==='strand'?'↑':''}</th>
                  <th style="cursor:pointer" onclick="cdFilters.sort='year';renderCurriculum(document.getElementById('main-content'))">Year ${cdFilters.sort==='year'?'↑':''}</th>
                </tr></thead>
                <tbody>
                  ${codes.length === 0
                    ? `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text3)">No codes match your filters</td></tr>`
                    : codes.map(c => `<tr style="cursor:pointer" onclick="openCodeDetail('${c.Code}',null)">
                        <td><span class="code-pill" style="background:var(--blue-dim);color:var(--blue);font-size:11px">${c.Code}</span></td>
                        <td style="color:var(--text-muted);font-size:12px;line-height:1.4;padding-right:12px">${truncateWithTooltip(c.Descriptor||c.Aspect||'—', 110, 'tt-block', true)}</td>
                        <td><span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 6px;border-radius:3px;background:var(--surface-alt);color:var(--text3);white-space:nowrap" title="${escapeHtml(c.Strand||'—')}">${truncateWithTooltip(c.Strand||'—', 24)}</span></td>
                        <td style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">${c['Year Level']||'—'}</td>
                      </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>`}
    </div>
  `;
}

// ── STANDARDS VIEW ──
function renderStandards(main) {
  const stds = state.standards;
  const allYearOrder = ['Foundation','Year 1','Year 2','Year 3','Year 4','Year 5','Year 6'];
  if (!state.standardsFilter) state.standardsFilter = { subject: 'English', year: 'all' };
  const sf = state.standardsFilter;
  const availableSubjects = getEnabledSubjectsFromRows(stds);
  if (!availableSubjects.includes(sf.subject)) sf.subject = availableSubjects[0] || 'English';
  const filteredBySubject = stds.filter(s => s.Subject === sf.subject);
  const years = allYearOrder.filter(y => filteredBySubject.some(s => s['Year Level'] === y));
  const visibleStds = filteredBySubject.filter(s => sf.year === 'all' || s['Year Level'] === sf.year);

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:10px;padding:14px 24px">
      <div class="topbar-title">Achievement Standards <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3);font-weight:400">· ${sf.subject}</span></div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">SUBJECT</span>
        ${availableSubjects.map(subj => `<button onclick="state.standardsFilter.subject='${subj}';state.standardsFilter.year='all';renderStandards(document.getElementById('main-content'))" style="padding:4px 10px;border-radius:4px;border:1px solid ${sf.subject===subj?'var(--gold)':'var(--border2)'};background:${sf.subject===subj?'var(--gold-dim)':'none'};color:${sf.subject===subj?'var(--gold)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap">${subjectShort(subj)}</button>`).join('')}
        <div style="width:1px;height:18px;background:var(--border2);margin:0 2px"></div>
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">YEAR</span>
        ${['all',...years].map(y => `<button onclick="state.standardsFilter.year='${y}';renderStandards(document.getElementById('main-content'))" style="padding:4px 10px;border-radius:4px;border:1px solid ${sf.year===y?'var(--blue)':'var(--border2)'};background:${sf.year===y?'var(--blue-dim)':'none'};color:${sf.year===y?'var(--blue)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">${y==='all'?'All':y}</button>`).join('')}
      </div>
    </div>
    <div class="content">
      ${stds.length === 0
        ? `<div class="empty-state"><div class="empty-icon">◇</div><div class="empty-title">No standards data loaded</div><div class="empty-sub">Open Data &amp; Settings to load your CSV files</div></div>`
        : `<div class="card">
            <div class="card-head" style="padding:10px 18px"><div style="font-size:13px;color:var(--text-muted)">Showing <strong style="color:var(--text)">${visibleStds.length}</strong> of ${filteredBySubject.length} ${sf.subject} standards</div></div>
            <table class="codes-table" style="table-layout:fixed;width:100%">
              <colgroup><col style="width:150px"><col style="width:auto"><col style="width:110px"></colgroup>
              <thead><tr><th>Standard ID</th><th>Standard Text</th><th>Year</th></tr></thead>
              <tbody>
                ${visibleStds.length === 0
                  ? `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text3)">No standards for this filter</td></tr>`
                  : visibleStds.map(s => `<tr>
                      <td><span class="code-pill" style="background:var(--gold-dim);color:var(--gold);font-size:10px">${s['Achievement Standard ID']||'—'}</span></td>
                      <td style="color:var(--text-muted);font-size:12px;line-height:1.4;padding-right:12px">${s['Standard Text']||'—'}</td>
                      <td style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">${s['Year Level']||'—'}</td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
    </div>
  `;
}

// ── PROGRESSIONS VIEW ──
function renderProgressions(main) {
  if (!state.progressionType) state.progressionType = 'literacy';
  const progType = state.progressionType;
  const progs = progType === 'numeracy' ? state.numeracyProgressions : state.progressions;
  const elements = [...new Set(progs.map(p => p.Element))].filter(Boolean);
  const activeElem = state.progressionFilter || (elements[0] || '');
  const typeLabel = progType === 'numeracy' ? 'Numeracy · Mathematics' : 'Literacy · English';

  const elemButtons = elements.map(elem => {
    const active = activeElem === elem ? 'active t-all' : '';
    const safeElem = elem.replace(/'/g, "\\'");
    return `<button class="mastery-tab ${active}" onclick="setProgressionFilter('${safeElem}')">${elem}</button>`;
  }).join('');

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:10px;padding:14px 24px">
      <div class="topbar-title">Progressions <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3);font-weight:400">· ${typeLabel}</span></div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">TYPE</span>
        <button onclick="state.progressionType='literacy';state.progressionFilter='';renderProgressions(document.getElementById('main-content'))" style="padding:4px 12px;border-radius:4px;border:1px solid ${progType==='literacy'?'var(--blue)':'var(--border2)'};background:${progType==='literacy'?'var(--blue-dim)':'none'};color:${progType==='literacy'?'var(--blue)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">✦ Literacy</button>
        <button onclick="state.progressionType='numeracy';state.progressionFilter='';renderProgressions(document.getElementById('main-content'))" style="padding:4px 12px;border-radius:4px;border:1px solid ${progType==='numeracy'?'var(--green)':'var(--border2)'};background:${progType==='numeracy'?'var(--green-dim)':'none'};color:${progType==='numeracy'?'var(--green)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">∑ Numeracy</button>
        <div style="width:1px;height:18px;background:var(--border2);margin:0 2px"></div>
        <div class="search-wrap"><span class="search-icon">⌕</span><input class="search-input" placeholder="Search indicators…" oninput="filterProgressions(this.value)" style="width:180px"></div>
      </div>
    </div>
    <div class="content">
      ${progs.length === 0
        ? `<div class="empty-state"><div class="empty-icon">⟡</div><div class="empty-title">No ${progType} progressions loaded</div><div class="empty-sub">Load your ${progType === 'numeracy' ? 'Numeracy' : 'Literacy'} Progressions CSV in Data &amp; Settings</div></div>`
        : `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">${elemButtons}</div>
           <div id="prog-content">${renderProgressionContent(progs, activeElem)}</div>`}
    </div>
  `;
}

function renderProgressionContent(progs, activeElem) {
  const filtered = activeElem ? progs.filter(p => p.Element === activeElem) : progs;
  const subElements = [...new Set(filtered.map(p => p['Sub-element']))].filter(Boolean);
  return subElements.map(sub => {
    const items = filtered.filter(p => p['Sub-element'] === sub);
    const levels = [...new Set(items.map(p => p['Progression level']))].filter(Boolean).sort();
    return `<div class="card" style="margin-bottom:16px">
      <div class="card-head"><div class="card-title">${sub}</div><span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">${items.length} indicators · ${levels.length} levels</span></div>
      <div style="padding:8px 0">
        ${items.map(item => `<div style="display:flex;gap:10px;padding:8px 18px;border-bottom:1px solid var(--border);align-items:flex-start">
          <span class="pp-level">L${item['Progression level']||'?'}</span>
          <div style="flex:1">
            <div style="font-size:12px;color:var(--text-muted);line-height:1.5">${item['Indicator text (no examples)']||item['Indicator text (verbatim)']||'—'}</div>
            ${item['Example / elaboration'] ? `<div style="font-size:11px;color:var(--text3);margin-top:3px;font-style:italic">${item['Example / elaboration']}</div>` : ''}
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px">
              ${['Foundation','Year 1','Year 2','Year 3','Year 4','Year 5','Year 6'].map(yr => {
                const val = item['Relevant – '+yr];
                return val && val.trim() ? `<span style="font-family:'DM Mono',monospace;font-size:8px;padding:1px 5px;border-radius:3px;background:var(--surface-alt);color:var(--text3)">${yr}</span>` : '';
              }).join('')}
            </div>
          </div>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);flex-shrink:0">${item['Indicator ID']||''}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function setProgressionFilter(elem) { state.progressionFilter = elem; renderView(); }

function filterProgressions(q) {
  const content = document.getElementById('prog-content');
  if (!content) return;
  const activeProgs = state.progressionType === 'numeracy' ? state.numeracyProgressions : state.progressions;
  if (!q) { content.innerHTML = renderProgressionContent(activeProgs, state.progressionFilter || ''); return; }
  const filtered = activeProgs.filter(p =>
    (p['Indicator text (no examples)']||'').toLowerCase().includes(q.toLowerCase()) ||
    (p['Indicator text (verbatim)']||'').toLowerCase().includes(q.toLowerCase()) ||
    (p['Sub-element']||'').toLowerCase().includes(q.toLowerCase())
  );
  content.innerHTML = renderProgressionContent(filtered, '');
}

// ── CODE DETAIL LOOKUP ──
function getCodeDetails(code) {
  const cd = state.curriculumCodes.find(c => c.Code === code) || {};
  const linkedIds = (cd['Linked Achievement IDs']||cd['Linked Aspect IDs']||'').split(',').map(s=>s.trim()).filter(Boolean);
  const linkedStandards = linkedIds.map(id => state.standards.find(s => (s['Achievement Standard ID']||s['Aspect ID']||'').trim() === id)).filter(Boolean);
  const strand = (cd.Strand||'').toLowerCase();
  const subStrand = (cd['Sub-strand']||'').toLowerCase();
  const relatedProgressions = [];
  state.progressions.forEach(p => {
    const elem = (p['Element']||'').toLowerCase();
    const subEl = (p['Sub-element']||'').toLowerCase();
    const match = (strand && elem.includes(strand.substring(0,5))) || (subStrand && subEl.includes(subStrand.substring(0,5))) || (strand.includes('literacy')&&elem.includes('literacy')) || (strand.includes('language')&&elem.includes('language'));
    if (match && !relatedProgressions.find(x => x['Indicator ID'] === p['Indicator ID'])) relatedProgressions.push(p);
  });
  return { cd, linkedStandards, relatedProgressions: relatedProgressions.slice(0,8), linkedIds };
}

function openCodeDetail(code, studentId) {
  const { cd, linkedStandards, relatedProgressions, linkedIds } = getCodeDetails(code);
  const mastery = studentId ? getMasteryForCode(studentId, code) : null;
  const componentSummary = studentId ? getComponentMasterySummary(studentId, code) : null;
  const componentRows = studentId
    ? getComponentsForCode(code).map(cmp => {
        const rec = state.componentProgress.find(p => p.student_id === studentId && p.component_id === cmp.id);
        return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:11px;color:var(--text-muted)">${cmp.description}</span>
          <span style="font-size:10px;color:var(--text3)">${rec?.mastery || 'Not assessed'}</span>
        </div>`;
      }).join('')
    : '';
  const prog = studentId ? state.progress.find(p => p.student_id === studentId && p.code === code) : null;

  const ics = getICsForDescriptor(code);
  const descriptorType = cd.descriptorType || 'knowledge';
  const icCountRange = descriptorType === 'skill' ? '3–6' : '6–10';
  const stubsForDescriptor = state.instructionalComponents.filter(ic =>
    ic.ownerTier === 'teacher_stub' && ic.icReadinessStatus === 'draft' && ic.homeDescriptorId === code
  ).length;

  const existing = document.getElementById('code-detail-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'code-detail-panel';
  panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:440px;max-width:95vw;background:var(--surface);border-left:1px solid var(--border2);box-shadow:-8px 0 40px rgba(0,0,0,0.4);z-index:90;display:flex;flex-direction:column;animation:slideInRight 0.2s ease;';
  panel.innerHTML = `
    <style>@keyframes slideInRight { from { transform: translateX(30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }</style>
    <div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px;flex-shrink:0">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--blue)">${code}</span>
          ${cd['Year Level'] ? `<span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 7px;border-radius:3px;background:var(--surface-alt);color:var(--text3)">${cd['Year Level']}</span>` : ''}
          ${cd.Strand ? `<span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 7px;border-radius:3px;background:var(--blue-dim);color:var(--blue)">${cd.Strand}</span>` : ''}
          ${cd['Sub-strand'] ? `<span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 7px;border-radius:3px;background:var(--surface-alt);color:var(--text3)">${cd['Sub-strand']}</span>` : ''}
        </div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.5">${cd.Descriptor||cd.Aspect||'—'}</div>
      </div>
      <button onclick="document.getElementById('code-detail-panel').remove()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:2px;line-height:1;flex-shrink:0">✕</button>
    </div>
    ${studentId ? `
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--surface-alt)">
      <div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3);margin-bottom:5px">Current Mastery</div>
        <div class="mastery-badge ${masteryClass(mastery)}" style="cursor:pointer" onclick="document.getElementById('code-detail-panel').remove();openMasteryPicker('${studentId}','${code}','${mastery}')">
          ${masteryDot(mastery)} ${mastery}
        </div>
        ${componentSummary ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">${componentSummary.achieved}/${componentSummary.total} components achieved · ${componentSummary.pct}% (${componentSummary.label})</div>` : ''}
      </div>
      <div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3);margin-bottom:5px">Last Assessed</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted)">${prog ? prog.date.split('T')[0] : 'Not yet assessed'}</div>
      </div>
      ${prog && prog.notes ? `<div style="max-width:140px"><div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3);margin-bottom:5px">Notes</div><div style="font-size:11px;color:var(--text-muted);line-height:1.4">${prog.notes}</div></div>` : ''}
    </div>` : ''}
    ${studentId && getComponentsForCode(code).length ? `
    <div style="padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface)">
      <details>
        <summary style="font-size:11px;color:var(--text3);cursor:pointer">Component-level detail (${getComponentsForCode(code).length})</summary>
        <div style="margin-top:8px">${componentRows}</div>
      </details>
    </div>` : ''}
    <div style="flex:1;overflow-y:auto;padding:0">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">Linked Achievement Standards</div>
        ${linkedIds.length === 0
          ? `<div style="font-size:12px;color:var(--text3)">No linked standards found</div>`
          : linkedIds.map(id => {
              const std = linkedStandards.find(s => (s['Achievement Standard ID']||s['Aspect ID']||'').trim() === id);
              return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start">
                <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--gold);background:var(--gold-dim);padding:2px 7px;border-radius:3px;flex-shrink:0;margin-top:2px">${id}</span>
                <div>
                  <div style="font-size:12px;color:var(--text-muted);line-height:1.4">${std ? (std['Standard Text']||std.Aspect||'No text') : 'Standard not found'}</div>
                  ${std ? `<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-top:3px">${std['Year Level']||''}</div>` : ''}
                </div>
              </div>`;
            }).join('')}
      </div>
      <div style="padding:16px 20px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">Related Literacy Progressions</div>
        ${relatedProgressions.length === 0
          ? `<div style="font-size:12px;color:var(--text3)">No related progressions found</div>`
          : relatedProgressions.map(p => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start">
              <div style="flex-shrink:0"><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--purple);background:var(--purple-dim);padding:2px 6px;border-radius:3px;display:block;margin-bottom:3px">L${p['Progression level']||'?'}</span><span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text3)">${p['Indicator ID']||''}</span></div>
              <div style="flex:1"><div style="font-size:11px;color:var(--text-muted);line-height:1.5">${p['Indicator text (no examples)']||p['Indicator text (verbatim)']||'—'}</div><div style="font-size:10px;color:var(--text3);margin-top:2px">${p['Sub-element']||''}</div></div>
            </div>`).join('')}
      </div>
      <div style="padding:16px 20px;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <span style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3)">Instructional Components</span>
          <span style="font-family:'DM Mono',monospace;font-size:9px;padding:1px 6px;border-radius:3px;background:var(--surface-alt);color:var(--text3)">${ics.length} ICs</span>
          <span style="font-family:'DM Mono',monospace;font-size:9px;padding:1px 6px;border-radius:3px;background:${descriptorType === 'skill' ? 'var(--teal-dim)' : 'var(--blue-dim)'};color:${descriptorType === 'skill' ? 'var(--teal)' : 'var(--blue)'}">${descriptorType}</span>
          ${stubsForDescriptor > 0 ? `<span style="font-family:'DM Mono',monospace;font-size:8px;padding:1px 6px;border-radius:8px;background:var(--rust-dim);color:var(--rust);border:1px solid var(--rust)">${stubsForDescriptor} draft${stubsForDescriptor !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px">${icCountRange} ICs for ${descriptorType}</div>
        ${ics.length === 0
          ? `<div style="display:flex;flex-direction:column;align-items:center;padding:24px 16px;gap:8px;background:var(--surface-alt);border-radius:6px;border:1px solid var(--border)">
              <span style="font-size:20px;color:var(--text3)">◈</span>
              <div style="font-size:12px;font-weight:600;color:var(--text-muted)">No instructional components yet</div>
              <div style="font-size:11px;color:var(--text3);text-align:center">System default ICs will appear here once generated</div>
            </div>`
          : [...ics].sort((a, b) => {
              const aDraft = a.icReadinessStatus === 'draft' ? 0 : 1;
              const bDraft = b.icReadinessStatus === 'draft' ? 0 : 1;
              if (aDraft !== bDraft) return aDraft - bDraft;
              return (a.sequenceOrder || 0) - (b.sequenceOrder || 0);
            }).map(ic => {
              const stageColour = ic.difficultyStage === 'early'
                ? 'background:var(--green-dim);color:var(--green)'
                : ic.difficultyStage === 'late'
                  ? 'background:var(--rust-dim);color:var(--rust)'
                  : 'background:var(--gold-dim);color:var(--gold)';
              const tierLabel = ic.ownerTier === 'teacher_stub'
                ? 'draft stub'
                : ic.ownerTier === 'teacher_copy'
                  ? 'teacher copy'
                  : ic.ownerTier === 'teacher_original'
                    ? 'teacher original'
                    : 'system default';
              const icStatus = studentId ? getTaughtICStatus(studentId, ic.id) : null;
              const statusPill = studentId ? (() => {
                const statusMap = {
                  'taught':       { col:'var(--blue)',  bg:'var(--blue-dim)',  label:'Taught' },
                  'got_it':       { col:'var(--green)', bg:'var(--green-dim)', label:'Got it' },
                  'needs_review': { col:'var(--rust)',  bg:'var(--rust-dim)',  label:'Needs review' },
                  'mastered':     { col:'var(--green)', bg:'var(--green-dim)', label:'Got it' },
                  'not_yet':      { col:'var(--rust)',  bg:'var(--rust-dim)',  label:'Needs review' },
                };
                const s = icStatus ? statusMap[icStatus] : null;
                const pillStyle = s
                  ? `background:${s.bg};color:${s.col};border:1px solid ${s.col}`
                  : 'background:var(--surface-alt);color:var(--text3);border:1px solid var(--border2)';
                const pillLabel = s ? s.label : '— Not recorded';
                return `<span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 8px;border-radius:10px;${pillStyle}">${pillLabel}</span>`;
              })() : '';
              const statusCycle = studentId ? (() => {
                const next = { null: 'taught', 'taught': 'got_it', 'got_it': 'needs_review', 'needs_review': null, 'mastered': 'needs_review', 'not_yet': null };
                const nextStatus = next[icStatus] !== undefined ? next[icStatus] : 'taught';
                const nextArg = nextStatus === null ? 'null' : `'${nextStatus}'`;
                return `<button onclick="toggleICStatus('${studentId}','${ic.id}',${nextArg},'${code}')"
                  style="padding:4px 10px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:10px;cursor:pointer;font-family:'Instrument Sans',sans-serif">
                  Update status
                </button>`;
              })() : '';
              return `<div style="border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:8px;background:var(--surface)">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
                  <div style="font-size:12px;font-weight:600;color:var(--text-muted);line-height:1.4">
                    <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-right:5px">${ic.sequenceOrder}.</span>${ic.name}
                    ${ic.ownerTier === 'teacher_stub' ? `<span style="font-family:'DM Mono',monospace;font-size:8px;padding:1px 5px;border-radius:8px;background:var(--rust-dim);color:var(--rust);border:1px solid var(--rust);margin-left:5px;vertical-align:middle">Draft</span>` : ''}
                  </div>
                  <span style="font-family:'DM Mono',monospace;font-size:9px;padding:1px 6px;border-radius:3px;flex-shrink:0;${stageColour}">${ic.difficultyStage}</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:6px">${ic.description}</div>
                <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-bottom:${(ic.exampleOfSuccess || ic.commonError) ? '8px' : '0'}">${tierLabel}</div>
                ${ic.exampleOfSuccess ? `<div style="margin-top:6px"><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--green);margin-bottom:2px">Example of success</div><div style="font-size:11px;color:var(--text-muted);line-height:1.4">${ic.exampleOfSuccess}</div></div>` : ''}
                ${ic.commonError ? `<div style="margin-top:6px"><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--rust);margin-bottom:2px">Common error</div><div style="font-size:11px;color:var(--text-muted);line-height:1.4">${ic.commonError}</div></div>` : ''}
                ${ic.ownerTier === 'teacher_stub' && ic.icReadinessStatus === 'draft' ? `
                  <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                    <div id="stub-promote-form-${ic.id}" style="display:none">
                      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.1em">Name this IC to promote it</div>
                      <input id="stub-promote-name-${ic.id}"
                        maxlength="60"
                        placeholder="e.g. Count forwards to 20 using objects"
                        value="${escapeHtml(ic.name || '')}"
                        oninput="document.getElementById('stub-promote-char-${ic.id}').textContent=(60-this.value.length)+' left'"
                        style="width:100%;box-sizing:border-box;padding:6px 10px;background:var(--surface-alt);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:12px;outline:none;font-family:'Instrument Sans',sans-serif;margin-bottom:4px">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                        <span id="stub-promote-char-${ic.id}" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">${60 - (ic.name || '').length} left</span>
                      </div>
                      <div style="display:flex;gap:6px">
                        <button onclick="promoteStubIC('${ic.id}')"
                          style="flex:1;padding:6px 12px;border-radius:5px;border:none;background:var(--green);color:var(--primary-contrast);font-size:12px;font-weight:600;cursor:pointer;font-family:'Instrument Sans',sans-serif">
                          Promote IC
                        </button>
                        <button onclick="document.getElementById('stub-promote-form-${ic.id}').style.display='none'"
                          style="padding:6px 10px;border-radius:5px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:12px;cursor:pointer">
                          Cancel
                        </button>
                      </div>
                    </div>
                    <div id="stub-promote-actions-${ic.id}" style="display:flex;gap:6px">
                      <button onclick="document.getElementById('stub-promote-form-${ic.id}').style.display='block';document.getElementById('stub-promote-actions-${ic.id}').style.display='none';document.getElementById('stub-promote-name-${ic.id}')?.focus()"
                        style="flex:1;padding:5px 10px;border-radius:5px;border:1px solid var(--green);background:var(--green-dim);color:var(--green);font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif;font-weight:600">
                        Promote draft IC
                      </button>
                      <button onclick="deleteStubIC('${ic.id}')"
                        style="padding:5px 10px;border-radius:5px;border:1px solid var(--rust);background:var(--rust-dim);color:var(--rust);font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif">
                        Delete
                      </button>
                    </div>
                  </div>` : ''}
                ${studentId ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
                  ${statusPill}
                  ${statusCycle}
                </div>` : ''}
              </div>`;
            }).join('')}
      </div>
    </div>
    ${studentId ? `
    <div style="padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0">
      <button class="btn btn-primary" style="width:100%" onclick="document.getElementById('code-detail-panel').remove();openMasteryPicker('${studentId}','${code}','${mastery||'Not taught'}')">✏ Update Mastery</button>
    </div>` : ''}
  `;
  document.body.appendChild(panel);
}

async function toggleICStatus(studentId, icId, newStatus, code) {
  try {
    const data = { date: new Date().toISOString().split('T')[0], student_id: studentId, ic_id: icId, status: newStatus, notes: '' };
    if (newStatus === null || newStatus === 'null') {
      // Clear: remove from local state (backend doesn't support delete yet, so we set status to empty)
      const existing = state.taughtICs.find(t => t.student_id === studentId && t.ic_id === icId);
      if (existing) {
        await apiCall('updateTaughtIC', { id: existing.id, status: '', notes: '' });
        existing.status = '';
      }
    } else {
      await saveTaughtICRecord(data);
    }
  } catch(e) {
    console.warn('toggleICStatus failed:', e);
    toast('Could not save IC status', 'error');
  }
  // Re-open the panel to reflect new state
  openCodeDetail(code, studentId);
}

// ── CSV LOADERS ──
function markLoaded(iconId, navId) {
  const icon = document.getElementById(iconId);
  const nav  = document.getElementById(navId);
  if (icon) { icon.textContent = '●'; icon.style.color = 'var(--green)'; }
  if (nav)  nav.style.color = 'var(--green)';
}

function loadCurriculumCSV(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.curriculumCodes = parseCSV(e.target.result);
    toast(`✓ Loaded ${state.curriculumCodes.length} curriculum codes`, 'success');
    markLoaded('icon-cd', 'nav-load-cd');
    if (state.currentView === 'curriculum') renderView();
  };
  reader.readAsText(file);
}

function loadStandardsCSV(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.standards = parseCSV(e.target.result);
    toast(`✓ Loaded ${state.standards.length} achievement standards`, 'success');
    markLoaded('icon-st', 'nav-load-st');
    if (state.currentView === 'standards') renderView();
  };
  reader.readAsText(file);
}

function loadProgressionsCSV(input, type) {
  const progType = type || 'literacy';
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const parsed = parseCSV(e.target.result);
    if (progType === 'numeracy') {
      state.numeracyProgressions = parsed;
      markLoaded('icon-np', 'nav-load-np');
      toast(`✓ Loaded ${parsed.length} numeracy progression indicators`, 'success');
    } else {
      state.progressions = parsed;
      markLoaded('icon-pr', 'nav-load-pr');
      toast(`✓ Loaded ${parsed.length} literacy progression indicators`, 'success');
    }
    if (state.currentView === 'progressions') renderView();
  };
  reader.readAsText(file);
}

function loadLinksCSV(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.aspectLinks = parseCSV(e.target.result);
    toast(`✓ Loaded ${state.aspectLinks.length} aspect links`, 'success');
    markLoaded('icon-lk', 'nav-load-lk');
  };
  reader.readAsText(file);
}

// ── MODALS ──
function openAddStudentModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:580px;max-width:95vw">
      <div class="modal-head"><div class="modal-title">Add Students</div><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body" style="padding:0">
        <div style="display:flex;border-bottom:1px solid var(--border)">
          <button class="modal-tab active" id="tab-csv" onclick="switchModalTab('csv')" style="flex:1;padding:12px;background:none;border:none;color:var(--blue);font-family:'Instrument Sans',sans-serif;font-size:13px;cursor:pointer;border-bottom:2px solid var(--blue);font-weight:600">📂 Upload CSV</button>
          <button class="modal-tab" id="tab-manual" onclick="switchModalTab('manual')" style="flex:1;padding:12px;background:none;border:none;color:var(--text3);font-family:'Instrument Sans',sans-serif;font-size:13px;cursor:pointer;border-bottom:2px solid transparent">✏️ Add One Student</button>
        </div>
        <div id="modal-tab-csv" style="padding:20px 22px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div><div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">Upload a CSV file with your class list.</div><div style="font-size:11px;color:var(--text3)">Columns needed: <span style="font-family:'DM Mono',monospace;color:var(--blue)">first_name, last_name, year_level</span></div></div>
            <button class="btn" onclick="downloadStudentTemplate()" style="flex-shrink:0;margin-left:16px">⬇ Download Template</button>
          </div>
          <div id="csv-dropzone" style="border:2px dashed var(--border2);border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:all 0.15s;margin-bottom:14px" onclick="document.getElementById('student-csv-input').click()" ondragover="event.preventDefault();this.style.borderColor='var(--blue)';this.style.background='var(--blue-dim)'" ondragleave="this.style.borderColor='var(--border2)';this.style.background='none'" ondrop="handleStudentCSVDrop(event)">
            <div style="font-size:28px;margin-bottom:8px;opacity:0.4">📋</div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">Drop your CSV here or click to browse</div>
            <div style="font-size:11px;color:var(--text3)">Accepts .csv files</div>
            <input type="file" id="student-csv-input" accept=".csv" style="display:none" onchange="handleStudentCSVFile(this)">
          </div>
          <div id="csv-preview" style="display:none">
            <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:8px" id="csv-preview-label"></div>
            <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px"><table style="width:100%;border-collapse:collapse" id="csv-preview-table"></table></div>
            <div id="csv-errors" style="margin-top:8px;font-size:11px;color:var(--rust)"></div>
          </div>
        </div>
        <div id="modal-tab-manual" style="padding:20px 22px;display:none">
          <div class="form-row">
            <div class="form-group"><label class="form-label">First Name</label><input class="form-input" id="f-firstname" placeholder="e.g. Alex"></div>
            <div class="form-group"><label class="form-label">Last Name</label><input class="form-input" id="f-lastname" placeholder="e.g. Chen"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Year Level</label>
            <select class="form-select" id="f-year">
              <option value="">Select year level…</option>
              <option value="F">Foundation</option>
              <option value="1">Year 1</option><option value="2">Year 2</option><option value="3">Year 3</option><option value="4">Year 4</option><option value="5">Year 5</option><option value="6">Year 6</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-btn" onclick="submitAddStudent()">Add Student</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  state._csvPreviewStudents = [];
}

function switchModalTab(tab) {
  const csvTab = document.getElementById('modal-tab-csv');
  const manualTab = document.getElementById('modal-tab-manual');
  const csvBtn = document.getElementById('tab-csv');
  const manualBtn = document.getElementById('tab-manual');
  const submitBtn = document.getElementById('modal-submit-btn');
  if (tab === 'csv') {
    csvTab.style.display = 'block'; manualTab.style.display = 'none';
    csvBtn.style.color = 'var(--blue)'; csvBtn.style.borderBottom = '2px solid var(--blue)';
    manualBtn.style.color = 'var(--text3)'; manualBtn.style.borderBottom = '2px solid transparent';
    submitBtn.textContent = 'Import Students'; submitBtn.onclick = submitCSVImport;
  } else {
    csvTab.style.display = 'none'; manualTab.style.display = 'block';
    csvBtn.style.color = 'var(--text3)'; csvBtn.style.borderBottom = '2px solid transparent';
    manualBtn.style.color = 'var(--blue)'; manualBtn.style.borderBottom = '2px solid var(--blue)';
    submitBtn.textContent = 'Add Student'; submitBtn.onclick = submitAddStudent;
    document.getElementById('f-firstname').focus();
  }
}

function downloadStudentTemplate() {
  const csv = ['first_name,last_name,year_level','Alex,Chen,3','Jamie,Smith,3','Riley,Johnson,4','Morgan,Williams,2'].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'students_template.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Template downloaded', 'success');
}

function handleStudentCSVDrop(event) {
  event.preventDefault();
  const dz = document.getElementById('csv-dropzone');
  dz.style.borderColor = 'var(--border2)'; dz.style.background = 'none';
  const file = event.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) processStudentCSV(file);
  else toast('Please drop a .csv file', 'error');
}

function handleStudentCSVFile(input) { if (input.files[0]) processStudentCSV(input.files[0]); }

function processStudentCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    const errors = [], valid = [], yearOptions = ['F','1','2','3','4','5','6'];
    rows.forEach((row, i) => {
      const first = (row['first_name']||row['First Name']||row['firstname']||'').trim();
      const last  = (row['last_name']||row['Last Name']||row['lastname']||row['surname']||'').trim();
      const year  = (row['year_level']||row['Year Level']||row['year']||row['Year']||'').trim();
      if (!first) { errors.push(`Row ${i+2}: missing first_name`); return; }
      if (!last)  { errors.push(`Row ${i+2}: missing last_name`); return; }
      if (!year)  { errors.push(`Row ${i+2}: missing year_level`); return; }
      if (!yearOptions.includes(year)) { errors.push(`Row ${i+2}: year_level "${year}" must be F, 1–6`); return; }
      const exists = state.students.find(s => s.first_name.toLowerCase()===first.toLowerCase() && s.last_name.toLowerCase()===last.toLowerCase());
      if (exists) { errors.push(`Row ${i+2}: ${first} ${last} already exists — skipping`); return; }
      valid.push({ first_name: first, last_name: last, year_level: year });
    });
    state._csvPreviewStudents = valid;
    const preview = document.getElementById('csv-preview');
    const label = document.getElementById('csv-preview-label');
    const table = document.getElementById('csv-preview-table');
    const errDiv = document.getElementById('csv-errors');
    const submitBtn = document.getElementById('modal-submit-btn');
    preview.style.display = 'block';
    label.textContent = `${valid.length} student${valid.length!==1?'s':''} ready to import${errors.length?' · '+errors.length+' skipped':''}`;
    table.innerHTML = `<thead><tr style="background:var(--surface-alt)"><th style="padding:7px 12px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase">First Name</th><th style="padding:7px 12px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase">Last Name</th><th style="padding:7px 12px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase">Year</th><th style="padding:7px 12px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase">Status</th></tr></thead><tbody>${valid.map(s=>`<tr style="border-top:1px solid var(--border)"><td style="padding:7px 12px;font-size:12px">${s.first_name}</td><td style="padding:7px 12px;font-size:12px">${s.last_name}</td><td style="padding:7px 12px;font-family:'DM Mono',monospace;font-size:11px;color:var(--blue)">${s.year_level}</td><td style="padding:7px 12px"><span style="font-size:10px;color:var(--green)">✓ Ready</span></td></tr>`).join('')}</tbody>`;
    errDiv.innerHTML = errors.length ? errors.map(e=>`<div>⚠ ${e}</div>`).join('') : '';
    submitBtn.textContent = `Import ${valid.length} Student${valid.length!==1?'s':''}`;
    submitBtn.onclick = submitCSVImport;
    const dz = document.getElementById('csv-dropzone');
    dz.innerHTML = `<div style="font-size:13px;color:var(--green)">✓ ${file.name} loaded</div><div style="font-size:11px;color:var(--text3);margin-top:4px">Click to choose a different file</div><input type="file" id="student-csv-input" accept=".csv" style="display:none" onchange="handleStudentCSVFile(this)">`;
  };
  reader.readAsText(file);
}

async function submitCSVImport() {
  const students = state._csvPreviewStudents || [];
  if (!students.length) { toast('No students to import', 'error'); return; }
  closeModal();
  let added = 0;
  for (const s of students) {
    const result = await apiCall('addStudent', s);
    if (result.success) { state.students.push({ id:result.student_id, first_name:s.first_name, last_name:s.last_name, year_level:s.year_level, date_added:new Date().toISOString() }); added++; }
  }
  toast(`✓ Imported ${added} student${added!==1?'s':''}`, 'success');
  renderView();
}

async function submitAddStudent() {
  const first = document.getElementById('f-firstname').value.trim();
  const last  = document.getElementById('f-lastname').value.trim();
  const year  = document.getElementById('f-year').value;
  if (!first || !last || !year) { toast('Please fill in all fields', 'error'); return; }
  closeModal();
  await addStudent({ first_name: first, last_name: last, year_level: year });
}

function openMasteryPicker(studentId, code, currentMastery) {
  const components = getComponentsForCode(code);
  const summary = getComponentMasterySummary(studentId, code);
  const componentRows = components.map(cmp => {
    const rec = state.componentProgress.find(p => p.student_id === studentId && p.component_id === cmp.id);
    const current = rec?.mastery || '';
    return `<div data-component-row="${cmp.id}" style="border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:6px;background:var(--surface)">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${cmp.description}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${['Achieved','Developing','Emerging','Not taught'].map(m => `<button class="btn" data-component-btn="${cmp.id}|${m}" onclick="selectComponentMastery('${cmp.id}','${m}')"
          style="padding:3px 8px;border-color:${current===m?'var(--blue)':'var(--border2)'};background:${current===m?'var(--blue-dim)':'var(--surface-alt)'};color:${current===m?'var(--blue)':'var(--text3)'}">${masteryDot(m)} ${m}</button>`).join('')}
      </div>
      <input type="hidden" data-component-mastery="${cmp.id}" value="${current}">
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head"><div class="modal-title">Record Mastery</div><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--blue);margin-bottom:16px">${code}</div>
        <div class="form-group">
          <label class="form-label">Mastery Level</label>
          <div class="mastery-picker">
            ${['Achieved','Developing','Emerging','Not taught'].map(m => `<button class="mp-option ${currentMastery===m?'selected-'+m.toLowerCase().replace(' ',''):''}" onclick="selectMastery(this,'${m}')" data-mastery="${m}">${masteryDot(m)}<br>${m}</button>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Assessable Components (optional)</label>
          ${components.length
            ? `<div style="font-size:11px;color:var(--text3);margin-bottom:6px">${summary ? `${summary.achieved}/${summary.total} achieved (${summary.pct}%) → ${summary.label}` : 'Select component mastery to track cumulative progress.'}</div>${componentRows}`
            : `<div style="font-size:11px;color:var(--text3);background:var(--surface-alt);border:1px solid var(--border);border-radius:6px;padding:8px">No components linked to this descriptor yet. Add components in Plan and Log Learning.</div>`}
        </div>
        <div class="form-group"><label class="form-label">Date Assessed</label><input class="form-input" type="date" id="f-date" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label class="form-label">Notes (optional)</label><textarea class="form-textarea" id="f-notes" placeholder="Teacher observations…"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitMastery('${studentId}','${code}')">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function selectComponentMastery(componentId, mastery) {
  document.querySelectorAll(`[data-component-btn^="${componentId}|"]`).forEach(btn => {
    btn.style.borderColor = 'var(--border2)';
    btn.style.background = 'var(--surface-alt)';
    btn.style.color = 'var(--text3)';
  });
  const active = document.querySelector(`[data-component-btn="${componentId}|${mastery}"]`);
  if (active) {
    active.style.borderColor = 'var(--blue)';
    active.style.background = 'var(--blue-dim)';
    active.style.color = 'var(--blue)';
  }
  const input = document.querySelector(`[data-component-mastery="${componentId}"]`);
  if (input) input.value = mastery;
}

function selectMastery(btn, mastery) {
  document.querySelectorAll('.mp-option').forEach(b => b.className = 'mp-option');
  btn.className = 'mp-option selected-' + mastery.toLowerCase().replace(' ','');
}

async function submitMastery(studentId, code) {
  const selected = document.querySelector('.mp-option[class*="selected-"]');
  if (!selected) { toast('Please select a mastery level', 'error'); return; }
  const mastery = selected.dataset.mastery;
  const date = document.getElementById('f-date').value;
  const notes = document.getElementById('f-notes').value;

  const componentInputs = [...document.querySelectorAll('[data-component-mastery]')];
  componentInputs.forEach(input => {
    const componentId = input.getAttribute('data-component-mastery');
    const componentMastery = input.value;
    if (!componentId || !componentMastery) return;
    const existing = state.componentProgress.find(p => p.student_id === studentId && p.component_id === componentId);
    if (existing) {
      existing.mastery = componentMastery;
      existing.date = date;
      existing.notes = notes || existing.notes || '';
      existing.code = code;
    } else {
      state.componentProgress.push({
        id: `cprog_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        student_id: studentId,
        component_id: componentId,
        code,
        mastery: componentMastery,
        date,
        notes: notes || ''
      });
    }
  });
  saveComponentProgressState();
  closeModal();
  await saveProgress({ student_id:studentId, content_descriptor_code:code, mastery_level:mastery, date_assessed:date, teacher_notes:notes });
}

function openBulkAssess(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!state.bulkAssess) state.bulkAssess = { mode:'by-code', yearFilter:'all', subjectFilter:'English', strandFilter:'all', selectedCode:null, selectedStudent:null, date:new Date().toISOString().split('T')[0], pendingChanges:{} };
  if (student) {
    state.bulkAssess.yearFilter = normaliseYear(student.year_level);
    state.bulkAssess.selectedStudent = studentId;
  }
  showView('bulk-assess');
}

// ── BULK ASSESS HELPERS ──
function setBulkMode(m)    { state.bulkAssess.mode=m; renderBulkAssess(document.getElementById('main-content')); }
function setBulkSubject(s) { state.bulkAssess.subjectFilter=s; state.bulkAssess.strandFilter='all'; renderBulkAssess(document.getElementById('main-content')); }
function setBulkYear(y)    { state.bulkAssess.yearFilter=y; renderBulkAssess(document.getElementById('main-content')); }
function setBulkStrand(s)  { state.bulkAssess.strandFilter=s; renderBulkAssess(document.getElementById('main-content')); }
function setBulkCode(c)    { state.bulkAssess.selectedCode=c; renderBulkAssess(document.getElementById('main-content')); }
function setBulkStudent(s) { state.bulkAssess.selectedStudent=s; renderBulkAssess(document.getElementById('main-content')); }
function setBulkMastery(key, mastery) {
  const [sid, code] = key.split('|');
  const saved = getMasteryForCode(sid, code);
  const pending = state.bulkAssess.pendingChanges[key];
  const current = pending !== undefined ? pending : (saved || 'Not taught');
  // Clicking the already-active rating toggles it off. 'Not taught' is an explicit
  // value (not a toggle target) so re-clicking it just keeps it set.
  if (current === mastery && mastery !== 'Not taught') {
    if (pending !== undefined) {
      // Undo an unsaved pending change — revert to the saved baseline. Never overwrite
      // a saved rating here; that would silently clear existing assessment data.
      delete state.bulkAssess.pendingChanges[key];
    } else {
      // No pending change: the saved rating itself is active — clear it on save.
      state.bulkAssess.pendingChanges[key] = null; // null = clear saved rating on save
    }
  } else {
    state.bulkAssess.pendingChanges[key] = mastery;
  }
  renderBulkAssess(document.getElementById('main-content'));
}
function applyMasteryToAll(code, mastery) {
  const ba = state.bulkAssess;
  state.students.filter(s => ba.yearFilter==='all'||normaliseYear(s.year_level)===ba.yearFilter).forEach(s => { ba.pendingChanges[s.id+'|'+code]=mastery; });
  renderBulkAssess(document.getElementById('main-content'));
}
function discardBulkChanges() { state.bulkAssess.pendingChanges={}; renderBulkAssess(document.getElementById('main-content')); }

document.addEventListener('click', function(e) {
  // ── Generic data-action handlers (delegated; preferred over inline onclick) ──
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const act = actionEl.dataset.action;
    if (act === 'openStudentDetail' && actionEl.dataset.studentId) {
      openStudentDetail(actionEl.dataset.studentId);
      return;
    }
  }

  // ── Progression Placement buttons ──
  const ppType = e.target.closest('[data-pp-type]');
  if (ppType) {
    if (!state.ppFilter) state.ppFilter = { type:'literacy', element:'', year:'all' };
    state.ppFilter.type = ppType.dataset.ppType;
    state.ppFilter.element = '';
    showView('progression-placement');
    return;
  }
  const ppYear = e.target.closest('[data-pp-year]');
  if (ppYear) {
    if (!state.ppFilter) state.ppFilter = { type:'literacy', element:'', year:'all' };
    state.ppFilter.year = ppYear.dataset.ppYear;
    showView('progression-placement');
    return;
  }
  const ppEl = e.target.closest('[data-pp-element]');
  if (ppEl && !ppEl.dataset.ppOpen) {
    if (!state.ppFilter) state.ppFilter = { type:'literacy', element:'', year:'all' };
    state.ppFilter.element = ppEl.dataset.ppElement;
    showView('progression-placement');
    return;
  }
  const ppOpen = e.target.closest('[data-pp-open]');
  if (ppOpen) {
    const studentId  = ppOpen.dataset.ppOpen;
    const element    = ppOpen.dataset.ppElement;
    const subElement = ppOpen.dataset.ppSubelement;
    if (studentId && element && subElement) openPlacementPicker(studentId, element, subElement);
    return;
  }

  // ── Standards Judgments filter buttons ──
  const sjEl = e.target.closest('[data-sj-action]');
  if (sjEl) {
    if (!state.sjFilter) state.sjFilter = { subject:'English', year:'all', period:'' };
    const action = sjEl.dataset.sjAction;
    const value  = sjEl.dataset.sjValue;
    if (action === 'subject') state.sjFilter.subject = value;
    else if (action === 'year') state.sjFilter.year = value;
    showView('standards-judgments');
    return;
  }

  // ── Standards Judgment open picker ──
  const sjOpen = e.target.closest('[data-sj-open]');
  if (sjOpen) {
    const [studentId, standardId] = sjOpen.dataset.sjOpen.split('|');
    openJudgmentPicker(studentId, standardId);
    return;
  }

  // ── Coverage filter buttons ──
  const cvEl = e.target.closest('[data-cv-action]');
  if (cvEl) {
    if (!state.coverageFilter) state.coverageFilter = { subject:'English', year:'all', strand:'all', mode:'all' };
    const action = cvEl.dataset.cvAction;
    const value  = cvEl.dataset.cvValue;
    if (action === 'subject') {
      state.coverageFilter.subject = value;
      state.coverageFilter.strand  = 'all'; // reset strand when subject changes
    } else if (action === 'year')   { state.coverageFilter.year   = value; }
    else if (action === 'strand')   { state.coverageFilter.strand = value; }
    else if (action === 'mode')     { state.coverageFilter.mode   = value; }
    else if (action === 'expandAllICs') {
      if (!state.icCoverageOpen) state.icCoverageOpen = {};
      state.coverageExpandAll = !state.coverageExpandAll;
      if (state.coverageExpandAll) {
        (state._coverageVisibleCodes || []).forEach(code => { state.icCoverageOpen[`covgap|desc|${code}`] = true; });
      } else {
        // Collapse: clear every descriptor key, not just visible ones, so rows
        // expanded under another filter don't linger when the user navigates back.
        Object.keys(state.icCoverageOpen).forEach(k => { if (k.startsWith('covgap|desc|')) delete state.icCoverageOpen[k]; });
      }
    }
    else if (action === 'toggleDescIC') {
      if (!state.icCoverageOpen) state.icCoverageOpen = {};
      const k = `covgap|desc|${value}`;
      state.icCoverageOpen[k] = !state.icCoverageOpen[k];
    }
    showView('coverage');
    return;
  }

  // ── Bulk assess data-ba-fn buttons ──
  const fnEl = e.target.closest('[data-ba-fn]');
  if (fnEl && state.bulkAssess) {
    try { new Function(fnEl.dataset.baFn)(); } catch(err) { console.warn('ba-fn error:', fnEl.dataset.baFn, err); }
    return;
  }
  // ── Bulk assess data-ba-action buttons ──
  const el = e.target.closest('[data-ba-action]');
  if (!el || !state.bulkAssess) return;
  const action = el.dataset.baAction, val = el.dataset.baVal, key = el.dataset.baKey;
  if      (action === 'setBulkCode')          setBulkCode(val);
  else if (action === 'setBulkStudent')       setBulkStudent(val);
  else if (action === 'setBulkMastery')       setBulkMastery(key, val);
  else if (action === 'applyMasteryToAll')    applyMasteryToAll(key, val);
  else if (action === 'setBulkSubject')       setBulkSubject(val);
  else if (action === 'setBulkYear')          setBulkYear(val);
  else if (action === 'setBulkStrand')        setBulkStrand(val);
});

function filterBulkCodeList(q) {
  const list = document.getElementById('ba-code-list');
  if (!list) return;
  const ba = state.bulkAssess;
  const filtered = state.curriculumCodes.filter(c => {
    if (c.Subject !== ba.subjectFilter) return false;
    if (ba.strandFilter !== 'all' && c.Strand !== ba.strandFilter) return false;
    if (ba.yearFilter !== 'all' && (c['Year Level']||'').trim() !== (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(YLM[ba.yearFilter]||ba.yearFilter) : (YLM[ba.yearFilter]||ba.yearFilter))) return false;
    if (!isCurriculumCodeEnabled(c)) return false;
    if (q && !(c.Code.toLowerCase().includes(q.toLowerCase())||(c.Descriptor||'').toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });
  list.innerHTML = filtered.map(c => buildCodeListItem(c, ba.selectedCode)).join('');
}

function buildCodeListItem(c, selectedCode) {
  const active = c.Code === selectedCode;
  return `<div data-ba-action="setBulkCode" data-ba-val="${c.Code}" style="padding:8px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:10px;align-items:center;${active?'background:var(--blue-dim);':''}">
    <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--blue);flex-shrink:0;min-width:110px">${c.Code}</span>
    <span style="font-size:11px;color:var(--text-muted);line-height:1.3">${c.Descriptor||c.Aspect||''}</span>
  </div>`;
}

// ── BULK ASSESS VIEW ──
function renderBulkAssess(main) {
  if (!state.bulkAssess) state.bulkAssess = { mode:'by-code', yearFilter:'all', subjectFilter:'English', strandFilter:'all', selectedCode:null, selectedStudent:null, date:new Date().toISOString().split('T')[0], pendingChanges:{} };
  const ba = state.bulkAssess;
  const pendingCount = Object.keys(ba.pendingChanges).length;
  const availSubjects = getEnabledSubjectsFromRows(state.curriculumCodes);
  if (!availSubjects.includes(ba.subjectFilter)) {
    ba.subjectFilter = availSubjects[0] || 'English';
    ba.strandFilter = 'all';
  }
  const availStrands = ['all', ...new Set(state.curriculumCodes.filter(c => c.Subject===ba.subjectFilter && isCurriculumCodeEnabled(c)).map(c => c.Strand).filter(Boolean))].sort();

  const filteredCodes = state.curriculumCodes.filter(c => {
    if (c.Subject !== ba.subjectFilter) return false;
    if (ba.strandFilter !== 'all' && c.Strand !== ba.strandFilter) return false;
    if (ba.yearFilter !== 'all') {
      const mapped = BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(YLM[ba.yearFilter]||ba.yearFilter) : (YLM[ba.yearFilter]||ba.yearFilter);
      if ((c['Year Level']||'').trim() !== mapped) return false;
    }
    if (state.classSettings && !isCurriculumCodeEnabled(c)) return false;
    return true;
  });

  const filteredStudents = sortStudents(state.students.filter(s => ba.yearFilter==='all'||normaliseYear(s.year_level)===ba.yearFilter));

  function fBtn(label, active, fn) {
    // For simple set* calls, use data-ba-fn eval. For filter buttons we use data-ba-action instead.
    const safeFn = fn.replace(/"/g, '&quot;');
    return `<button data-ba-fn="${safeFn}" style="padding:4px 10px;border-radius:4px;border:1px solid ${active?'var(--blue)':'var(--border2)'};background:${active?'var(--blue-dim)':'none'};color:${active?'var(--blue)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap">${label}</button>`;
  }

  // Safe filter buttons that use data-ba-action (no eval, handles special chars)
  function filterBtn(label, active, action, value) {
    return `<button data-ba-action="${action}" data-ba-val="${value}" style="padding:4px 10px;border-radius:4px;border:1px solid ${active?'var(--blue)':'var(--border2)'};background:${active?'var(--blue-dim)':'none'};color:${active?'var(--blue)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap">${label}</button>`;
  }

  const masteryColours = { 'Achieved':['var(--green)','var(--green-dim)'], 'Developing':['var(--gold)','var(--gold-dim)'], 'Emerging':['var(--rust)','var(--rust-dim)'], 'Not taught':['var(--border2)','var(--surface-alt)'] };

  function masteryBtns(key, current) {
    return ['Achieved','Developing','Emerging','Not taught'].map(m => {
      const [col, bg] = masteryColours[m];
      const active = current === m;
      const canClear = active && m !== 'Not taught';
      return `<button data-ba-action="setBulkMastery" data-ba-key="${key}" data-ba-val="${m}" title="${canClear?'Click again to clear':m}" style="padding:3px 9px;border-radius:4px;border:1px solid ${active?col:'var(--border2)'};background:${active?bg:'none'};color:${active?col:'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">${m}</button>`;
    }).join('');
  }

  // Additive linked-IC evidence badge. Surfaces only where the teacher has no explicit
  // progress rating for this descriptor — the four buttons stay authoritative; this never
  // overrides them. OR rollup via getLinkedICStatusForDescriptor.
  function icRollupBadge(studentId, code) {
    const hasExplicit = state.progress.some(p => p.student_id === studentId && p.code === code);
    if (hasExplicit) return '';
    const linkedStatus = getLinkedICStatusForDescriptor(studentId, code);
    if (!linkedStatus) return '';
    const labels = { got_it: 'IC ✓', taught: 'IC •', needs_review: 'IC ↻' };
    const titles = { got_it: 'got it', taught: 'taught', needs_review: 'needs review' };
    return `<span class="ic-rollup-badge ic-rollup-${linkedStatus}" title="Evidence from linked IC: ${titles[linkedStatus]}">${labels[linkedStatus] || 'IC'}</span>`;
  }

  function buildByCode() {
    const code = ba.selectedCode;
    const cd = code ? state.curriculumCodes.find(c => c.Code===code) : null;
    const codeListHtml = filteredCodes.map(c => buildCodeListItem(c, code)).join('');
    const rosterHtml = !code
      ? `<div class="empty-state" style="padding:60px"><div class="empty-icon">⊞</div><div class="empty-title">Select a code on the left</div><div class="empty-sub">Then set mastery for each student</div></div>`
      : `<div style="display:flex;flex-direction:column;overflow:hidden;height:100%">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface-alt);display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0">
            <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--blue)">${code}</span>
            <span style="font-size:12px;color:var(--text-muted);flex:1;line-height:1.3">${cd ? (cd.Descriptor||cd.Aspect||'') : ''}</span>
            <button data-ba-action="applyMasteryToAll" data-ba-key="${code}" data-ba-val="Achieved" style="padding:4px 10px;border-radius:4px;border:1px solid var(--green);background:var(--green-dim);color:var(--green);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">✓ All Achieved</button>
            <button data-ba-action="applyMasteryToAll" data-ba-key="${code}" data-ba-val="Developing" style="padding:4px 10px;border-radius:4px;border:1px solid var(--gold);background:var(--gold-dim);color:var(--gold);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">◐ All Developing</button>
          </div>
          <div style="overflow-y:auto;flex:1"><table style="width:100%;border-collapse:collapse"><tbody>
            ${filteredStudents.map((s,si) => {
              const key = s.id+'|'+code;
              const pending = ba.pendingChanges[key];
              const saved = getMasteryForCode(s.id, code);
              const current = pending !== undefined ? pending : (saved || 'Not taught');
              const changed = pending !== undefined && pending !== saved;
              return `<tr style="background:${getStripedRowSurface(si)}${changed?';box-shadow:inset 3px 0 0 var(--gold)':''}">
                <td style="padding:12px 16px;width:220px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="sc-avatar ${getAvClass(si)}" style="width:28px;height:28px;font-size:11px;flex-shrink:0">${getInitials(s)}</div>
                    <div><div style="font-size:13px;font-weight:600">${s.last_name}, ${s.first_name}</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">Yr ${s.year_level}${changed?' · <span style="color:var(--gold)">changed</span>':''}</div></div>
                  </div>
                </td>
                <td style="padding:8px 16px"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${masteryBtns(key, current)}${icRollupBadge(s.id, code)}</div></td>
              </tr>`;
            }).join('')}
          </tbody></table></div>
        </div>`;
    return `<div style="display:grid;grid-template-columns:340px 1fr;height:calc(100vh - 118px);overflow:hidden">
      <div style="border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface-alt);flex-shrink:0">
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.1em">Select Code · ${filteredCodes.length} available</div>
          <input id="ba-code-search" placeholder="Search codes…" oninput="filterBulkCodeList(this.value)" style="width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--border2);border-radius:5px;padding:5px 10px;color:var(--text-muted);font-size:12px;outline:none">
        </div>
        <div id="ba-code-list" style="overflow-y:auto;flex:1">${codeListHtml}</div>
      </div>
      <div style="overflow:hidden">${rosterHtml}</div>
    </div>`;
  }

  function buildByStudent() {
    const sid = ba.selectedStudent;
    const student = sid ? state.students.find(s => s.id===sid) : null;
    const studentListHtml = filteredStudents.map((s,si) => {
      const active = s.id === sid;
      const pct = getProgressStats(s.id).pct;
      return `<div data-ba-action="setBulkStudent" data-ba-val="${s.id}" style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:10px;align-items:center;${active?'background:var(--blue-dim);':''}">
        <div class="sc-avatar ${getAvClass(si)}" style="width:28px;height:28px;font-size:11px;flex-shrink:0">${getInitials(s)}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">${s.last_name}, ${s.first_name}</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">Yr ${s.year_level}</div></div>
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--green)">${pct}%</span>
      </div>`;
    }).join('');

    const codesHtml = !student ? '' : (() => {
      const normYr = normaliseYear(student.year_level);
      const csvYear = YLM[normYr]||normYr;
      const sCodes = state.curriculumCodes.filter(c => c.Subject===ba.subjectFilter && (c['Year Level']||'').trim()===(BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear) && (ba.strandFilter==='all'||c.Strand===ba.strandFilter) && isCurriculumCodeEnabled(c));
      return sCodes.map((c,ci) => {
        const key = student.id+'|'+c.Code;
        const pending = ba.pendingChanges[key];
        const saved = getMasteryForCode(student.id, c.Code);
        const current = pending !== undefined ? pending : (saved||'Not taught');
        const changed = pending !== undefined && pending !== saved;
        return `<tr style="background:${getStripedRowSurface(ci)}${changed?';box-shadow:inset 3px 0 0 var(--gold)':''}">
          <td style="padding:10px 16px;width:140px;vertical-align:top;padding-top:12px"><span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--blue)">${c.Code}</span></td>
          <td style="padding:8px 8px;font-size:11px;color:var(--text-muted);line-height:1.4;max-width:300px;vertical-align:top;padding-top:12px">${c.Descriptor||c.Aspect||'—'}</td>
          <td style="padding:8px 16px;vertical-align:top;padding-top:8px"><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">${masteryBtns(key, current)}${icRollupBadge(student.id, c.Code)}</div></td>
        </tr>`;
      }).join('');
    })();

    return `<div style="display:grid;grid-template-columns:260px 1fr;height:calc(100vh - 118px);overflow:hidden">
      <div style="border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface-alt);font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;flex-shrink:0">Select Student · ${filteredStudents.length} shown</div>
        <div style="overflow-y:auto;flex:1">${studentListHtml}</div>
      </div>
      <div style="overflow:hidden;display:flex;flex-direction:column">
        ${!student
          ? `<div class="empty-state" style="padding:60px"><div class="empty-icon">◎</div><div class="empty-title">Select a student on the left</div></div>`
          : `<div style="padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface-alt);display:flex;align-items:center;gap:10px;flex-shrink:0">
              <div class="sc-avatar ${getAvClass(0)}" style="width:28px;height:28px;font-size:11px">${getInitials(student)}</div>
              <div><div style="font-size:13px;font-weight:600">${student.first_name} ${student.last_name}</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">Year ${student.year_level} · ${ba.subjectFilter}</div></div>
            </div>
            <div style="overflow-y:auto;flex:1"><table style="width:100%;border-collapse:collapse"><tbody>${codesHtml}</tbody></table></div>`}
      </div>
    </div>`;
  }

  const modeContent = ba.mode === 'by-student' ? buildByStudent() : buildByCode();

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:8px;padding:14px 24px">
      <div class="topbar-title" style="margin-right:4px">Bulk Assess</div>
      ${fBtn('By Code',    ba.mode==='by-code',    "setBulkMode('by-code')")}
      ${fBtn('By Student', ba.mode==='by-student', "setBulkMode('by-student')")}
      <div style="width:1px;height:18px;background:var(--border2);margin:0 3px"></div>
      ${availSubjects.map(s => filterBtn(subjectShort(s), ba.subjectFilter===s, 'setBulkSubject', s)).join('')}
      <div style="width:1px;height:18px;background:var(--border2);margin:0 3px"></div>
      ${['all','F','1','2','3','4','5','6'].map(yr => filterBtn(yr==='all'?'All':'Yr '+yr, ba.yearFilter===yr, 'setBulkYear', yr)).join('')}
      <div style="width:1px;height:18px;background:var(--border2);margin:0 3px"></div>
      ${availStrands.map(st => filterBtn(st==='all'?'All strands':st, ba.strandFilter===st, 'setBulkStrand', st)).join('')}
      <div style="width:1px;height:18px;background:var(--border2);margin:0 3px"></div>
      <button onclick="toggleStudentSort();renderBulkAssess(document.getElementById('main-content'))" title="Toggle name sort order" style="padding:4px 10px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap">${state.studentSortBy === 'last_name' ? '↕ Last, First' : '↕ First, Last'}</button>
      <div style="width:1px;height:18px;background:var(--border2);margin:0 3px;margin-left:auto"></div>
      <input type="date" value="${ba.date}" onchange="state.bulkAssess.date=this.value" style="background:var(--surface-alt);border:1px solid var(--border2);border-radius:5px;padding:4px 8px;color:var(--text-muted);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;outline:none">
      ${pendingCount > 0 ? `
        <button onclick="saveBulkAssess()" style="padding:5px 16px;border-radius:6px;border:none;background:var(--green);color:var(--primary-contrast);font-family:'DM Mono',monospace;font-size:11px;font-weight:700;cursor:pointer">↑ Save ${pendingCount} change${pendingCount>1?'s':''}</button>
        <button onclick="discardBulkChanges()" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text3);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer">✕ Discard</button>` : ''}
    </div>
    <div style="overflow:hidden">${modeContent}</div>
  `;
}

async function saveBulkAssess() {
  const ba = state.bulkAssess;
  const changes = Object.entries(ba.pendingChanges);
  if (!changes.length) return;
  setSyncing(true);
  toast(`Saving ${changes.length} change${changes.length>1?'s':''}…`, 'info');
  let saved = 0;
  for (const [key, rawMastery] of changes) {
    // A null pending value means "clear this rating" — persist it as 'Not taught'
    // so the saved record is unset rather than left at its previous value.
    const mastery = rawMastery === null ? 'Not taught' : rawMastery;
    const [studentId, code] = key.split('|');
    const existing = state.progress.find(p => p.student_id===studentId && p.code===code);
    try {
      if (existing) {
        const r = await apiCall('updateProgress', { progress_id:existing.id, mastery_level:mastery, date_assessed:ba.date, teacher_notes:existing.notes||'' });
        if (r.success) { existing.mastery=mastery; existing.date=ba.date; saved++; }
      } else {
        const r = await apiCall('saveProgress', { student_id:studentId, content_descriptor_code:code, mastery_level:mastery, date_assessed:ba.date, teacher_notes:'' });
        if (r.success) { state.progress.push({ id:r.progress_id, student_id:studentId, code, mastery, date:ba.date, notes:'' }); saved++; }
      }
    } catch(e) { console.error('Failed to save', key, e); }
  }
  ba.pendingChanges = {};
  setSyncing(false);
  toast(`✓ Saved ${saved} assessment${saved>1?'s':''}`, 'success');
  renderBulkAssess(document.getElementById('main-content'));
}

// ── REPORT HELPERS ──

// Shared badge + section builders used by both single and bulk print
function reportBadge(m) {
  const styles = {
    'Achieved':   'background:#d4edda;color:#155724;border:1px solid #c3e6cb',
    'Developing': 'background:#fff3cd;color:#856404;border:1px solid #ffeeba',
    'Emerging':   'background:#f8d7da;color:#721c24;border:1px solid #f5c6cb',
    'Not taught': 'background:#f1f3f4;color:#666;border:1px solid #ddd'
  };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;${styles[m]||styles['Not taught']}">${m}</span>`;
}

/**
 * Build the full HTML body content for one student's report.
 * opts: { subjectFilter: string|null, strandFilter: string|null }
 * If subjectFilter is null → include all subjects.
 * If strandFilter is set → only include that strand within the subject.
 */
function buildStudentReportBody(s, opts) {
  opts = opts || {};
  const normYr = normaliseYear(s.year_level);
  const csvYear = YLM[normYr] || normYr;
  const today = new Date().toLocaleDateString('en-AU', {day:'numeric',month:'long',year:'numeric'});

  // Scope to subject/strand filters
  const scopeLabel = opts.subjectFilter
    ? (opts.strandFilter ? `${opts.subjectFilter} · ${opts.strandFilter}` : opts.subjectFilter)
    : 'All Subjects';

  // Codes in scope for summary stats
  const scopeCodes = state.curriculumCodes.filter(c => {
    if ((c['Year Level']||'').trim() !== (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear)) return false;
    if (opts.subjectFilter && c.Subject !== opts.subjectFilter) return false;
    if (opts.strandFilter  && c.Strand  !== opts.strandFilter)  return false;
    return true;
  });
  const achieved   = scopeCodes.filter(c => getMasteryForCode(s.id, c.Code) === 'Achieved').length;
  const developing = scopeCodes.filter(c => getMasteryForCode(s.id, c.Code) === 'Developing').length;
  const emerging   = scopeCodes.filter(c => getMasteryForCode(s.id, c.Code) === 'Emerging').length;
  const assessed   = achieved + developing + emerging;
  const total      = scopeCodes.length;
  const pct        = total ? Math.round((achieved/total)*100) : 0;

  function buildSubjectSection(subject) {
    let sCodes = state.curriculumCodes.filter(c =>
      c.Subject === subject && (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear)
    );
    if (opts.strandFilter) sCodes = sCodes.filter(c => c.Strand === opts.strandFilter);
    if (!sCodes.length) return '';

    const strands = [...new Set(sCodes.map(c => c.Strand).filter(Boolean))];
    const strandSections = strands.map(strand => {
      const strandCodes = sCodes.filter(c => c.Strand === strand);
      const rows = strandCodes.map(c => {
        const mastery = getMasteryForCode(s.id, c.Code);
        const linkedIds = (c['Linked Achievement IDs']||'').split(',').map(x=>x.trim()).filter(Boolean);
        const standards = linkedIds.map(id => {
          const st = state.standards.find(x => x['Achievement Standard ID'] === id);
          return st ? `<div style="font-size:9px;color:#555;margin-top:3px;padding-left:8px;border-left:2px solid #ddd">${st['Standard Text']||''}</div>` : '';
        }).join('');
        return `<tr style="border-bottom:1px solid #eee">
          <td style="padding:6px 8px;width:120px;vertical-align:top"><span style="font-family:monospace;font-size:10px;color:#1a6db5;font-weight:600">${c.Code}</span></td>
          <td style="padding:6px 8px;vertical-align:top"><div style="font-size:11px;color:#222;line-height:1.4">${c.Descriptor||c.Aspect||'—'}</div>${standards}</td>
          <td style="padding:6px 8px;width:100px;vertical-align:top;text-align:right">${reportBadge(mastery)}</td>
        </tr>`;
      }).join('');
      const sa = strandCodes.filter(c => getMasteryForCode(s.id,c.Code)==='Achieved').length;
      return `<div style="margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#555;margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid #ccc">
          ${strand} &nbsp;·&nbsp; ${sa}/${strandCodes.length} achieved
        </div>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>`;
    }).join('');

    const sA = sCodes.filter(c=>getMasteryForCode(s.id,c.Code)==='Achieved').length;
    const sD = sCodes.filter(c=>getMasteryForCode(s.id,c.Code)==='Developing').length;
    const sE = sCodes.filter(c=>getMasteryForCode(s.id,c.Code)==='Emerging').length;
    const sN = sCodes.filter(c=>getMasteryForCode(s.id,c.Code)==='Not taught').length;
    return `<div style="margin-bottom:24px;page-break-inside:avoid">
      <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:4px;margin-bottom:10px">
        <div style="font-size:14px;font-weight:700;color:#111">${subject}</div>
        <div style="font-size:10px;color:#555;font-family:monospace">Achieved: ${sA} &nbsp;·&nbsp; Developing: ${sD} &nbsp;·&nbsp; Emerging: ${sE} &nbsp;·&nbsp; Not taught: ${sN}</div>
      </div>
      ${strandSections}
    </div>`;
  }

  const subjects = opts.subjectFilter
    ? [opts.subjectFilter]
    : [...new Set(state.curriculumCodes.map(c => c.Subject).filter(Boolean))].sort();

  const subjectSections = subjects.map(buildSubjectSection).join('');

  // ── Standards Judgments section ──
  function buildJudgmentsSection() {
    const relevantStandards = state.standards.filter(std => {
      if ((std['Year Level']||'') !== csvYear) return false;
      if (opts.subjectFilter && std.Subject !== opts.subjectFilter) return false;
      return true;
    });
    if (!relevantStandards.length) return '';

    const scale = getScale();
    const rows = relevantStandards.map(std => {
      const sid = std['Achievement Standard ID'] || std['Aspect ID'] || '';
      const j   = getJudgmentForStudent(s.id, sid);
      const scaleItem = j ? getScaleItem(j.judgment) : null;
      const readiness = getStandardReadiness(s.id, sid);

      // Inline colour for print (CSS vars don't work in print window)
      const printColours = {
        'not-evident':      { bg:'#f1f3f4', border:'#ccc',    text:'#555'    },
        'developing':       { bg:'#f8d7da', border:'#f5c6cb', text:'#721c24' },
        'competent':        { bg:'#fff3cd', border:'#ffeeba', text:'#856404' },
        'highly-competent': { bg:'#d4edda', border:'#c3e6cb', text:'#155724' },
        'outstanding':      { bg:'#cce5ff', border:'#b8daff', text:'#004085' },
      };
      const pc = j ? (printColours[j.judgment] || printColours['not-evident']) : null;
      const badgeHtml = scaleItem && pc
        ? `<span style="display:inline-block;padding:2px 10px;border-radius:3px;font-size:10px;font-weight:700;background:${pc.bg};border:1px solid ${pc.border};color:${pc.text}">${scaleItem.label}${j.locked?' 🔒':''}</span>`
        : `<span style="display:inline-block;padding:2px 10px;border-radius:3px;font-size:10px;color:#999;background:#f9f9f9;border:1px solid #eee">Not yet judged</span>`;

      return `<tr style="border-bottom:1px solid #eee">
        <td style="padding:6px 8px;width:120px;vertical-align:top">
          <span style="font-family:monospace;font-size:10px;color:#1a6db5;font-weight:600">${sid}</span>
          ${j?.date ? `<div style="font-size:9px;color:#999;margin-top:2px">${j.date}${j.period?' · '+j.period:''}</div>` : ''}
        </td>
        <td style="padding:6px 8px;vertical-align:top">
          <div style="font-size:11px;color:#222;line-height:1.4">${std['Standard Text']||'—'}</div>
          ${j?.notes ? `<div style="font-size:9px;color:#666;margin-top:3px;font-style:italic">${j.notes}</div>` : ''}
          ${!readiness.noLinks ? `<div style="font-size:9px;color:#888;margin-top:3px">${readiness.taught}/${readiness.total} linked codes taught (${readiness.pct}%)</div>` : ''}
        </td>
        <td style="padding:6px 8px;width:130px;vertical-align:top;text-align:right">${badgeHtml}</td>
      </tr>`;
    }).join('');

    const judgedCount = relevantStandards.filter(std => {
      const sid = std['Achievement Standard ID'] || std['Aspect ID'] || '';
      return getJudgmentForStudent(s.id, sid);
    }).length;

    return `<div style="margin-bottom:24px;page-break-inside:avoid">
      <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:4px;margin-bottom:10px">
        <div style="font-size:14px;font-weight:700;color:#111">Achievement Standards</div>
        <div style="font-size:10px;color:#555;font-family:monospace">${judgedCount}/${relevantStandards.length} judged</div>
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`;
  }

  // ── Progression Placements section ──
  function buildPlacementsSection() {
    const litProgs = state.progressions;
    const numProgs = state.numeracyProgressions;
    if (!litProgs.length && !numProgs.length) return '';

    function progRows(progs, label) {
      if (!progs.length) return '';
      const elements = [...new Set(progs.map(p => p.Element).filter(Boolean))];
      const rows = elements.flatMap(element => {
        const subEls = [...new Set(progs.filter(p => p.Element === element).map(p => p['Sub-element']).filter(Boolean))].sort();
        return subEls.map(subEl => {
          const items = progs.filter(p => p.Element === element && p['Sub-element'] === subEl);
          const levels = [...new Set(items.map(p => String(p['Progression level'])).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
          const placement = getPlacementForStudent(s.id, element, subEl);
          const curLevel  = placement ? String(placement.level) : null;
          const curIdx    = curLevel ? levels.indexOf(curLevel) : -1;
          const nextLevel = curIdx >= 0 && curIdx < levels.length-1 ? levels[curIdx+1] : null;
          const nextItem  = nextLevel ? items.find(i => String(i['Progression level']) === nextLevel) : null;

          return `<tr style="border-bottom:1px solid #eee">
            <td style="padding:5px 8px;width:160px;vertical-align:top;font-size:10px;color:#555">${element}</td>
            <td style="padding:5px 8px;width:160px;vertical-align:top;font-size:10px;color:#333;font-weight:600">${subEl}</td>
            <td style="padding:5px 8px;width:80px;vertical-align:top;text-align:center">
              ${curLevel
                ? `<span style="font-family:monospace;font-size:11px;font-weight:700;color:#5b2d9e;background:#ede9fe;padding:2px 8px;border-radius:3px">L${curLevel}</span>`
                : `<span style="font-size:10px;color:#999">—</span>`}
              ${placement?.ext_value ? `<div style="font-size:9px;color:#b45309;margin-top:2px">${placement.ext_label||''} ${placement.ext_value}</div>` : ''}
            </td>
            <td style="padding:5px 8px;vertical-align:top;font-size:10px;color:#444;line-height:1.4">
              ${nextItem
                ? `<span style="font-size:9px;color:#0e7490;font-weight:600">L${nextLevel} next · </span>${nextItem['Indicator text (no examples)']||nextItem['Indicator text (verbatim)']||''}`
                : curLevel ? '<span style="color:#166534">✓ At highest level</span>' : '<span style="color:#999">Not yet placed</span>'}
            </td>
          </tr>`;
        });
      }).join('');

      if (!rows) return '';
      return `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${label}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f5f5f5">
            <th style="padding:4px 8px;text-align:left;font-size:9px;color:#666;font-weight:600;text-transform:uppercase">Element</th>
            <th style="padding:4px 8px;text-align:left;font-size:9px;color:#666;font-weight:600;text-transform:uppercase">Sub-element</th>
            <th style="padding:4px 8px;text-align:center;font-size:9px;color:#666;font-weight:600;text-transform:uppercase">Level</th>
            <th style="padding:4px 8px;text-align:left;font-size:9px;color:#666;font-weight:600;text-transform:uppercase">Next Step</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }

    const content = progRows(litProgs,'Literacy Progressions') + progRows(numProgs,'Numeracy Progressions');
    if (!content) return '';
    return `<div style="margin-bottom:24px;page-break-inside:avoid">
      <div style="font-size:14px;font-weight:700;color:#111;border-bottom:2px solid #333;padding-bottom:4px;margin-bottom:10px">Progression Placements</div>
      ${content}
    </div>`;
  }

  return `
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:3px solid #111">
    <div>
      <div style="font-size:22px;font-weight:700;color:#111">${s.first_name} ${s.last_name}</div>
      <div style="font-size:12px;color:#555;margin-top:3px">Year ${s.year_level} &nbsp;·&nbsp; ${csvYear} Curriculum &nbsp;·&nbsp; ${scopeLabel}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;font-weight:700;color:#111">ClassTracker</div>
      <div style="font-size:10px;color:#777;margin-top:2px">Generated ${today}</div>
    </div>
  </div>
  <!-- Summary stats -->
  <div style="display:flex;gap:12px;margin-bottom:24px">
    <div style="flex:1;background:#d4edda;border:1px solid #c3e6cb;border-radius:6px;padding:10px 14px"><div style="font-size:22px;font-weight:700;color:#155724">${achieved}</div><div style="font-size:10px;color:#155724;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Achieved</div></div>
    <div style="flex:1;background:#fff3cd;border:1px solid #ffeeba;border-radius:6px;padding:10px 14px"><div style="font-size:22px;font-weight:700;color:#856404">${developing}</div><div style="font-size:10px;color:#856404;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Developing</div></div>
    <div style="flex:1;background:#f8d7da;border:1px solid #f5c6cb;border-radius:6px;padding:10px 14px"><div style="font-size:22px;font-weight:700;color:#721c24">${emerging}</div><div style="font-size:10px;color:#721c24;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Emerging</div></div>
    <div style="flex:1;background:#f1f3f4;border:1px solid #ddd;border-radius:6px;padding:10px 14px"><div style="font-size:22px;font-weight:700;color:#333">${assessed}/${total}</div><div style="font-size:10px;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Assessed · ${pct}%</div></div>
  </div>
  ${buildJudgmentsSection()}
  ${buildPlacementsSection()}
  ${subjectSections || '<p style="color:#888;font-style:italic">No curriculum data loaded for this scope.</p>'}
  <div style="margin-top:30px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#aaa;display:flex;justify-content:space-between">
    <span>ClassTracker · chriswhite3140.github.io/class-tracker-split</span>
    <span>Printed ${today}</span>
  </div>`;
}

// ── PRINT OPTIONS MODAL (single student) ──
function openPrintOptionsModal(studentId) {
  const s = state.students.find(x => x.id === studentId);
  if (!s) return;

  const normYr = normaliseYear(s.year_level);
  const csvYear = YLM[normYr] || normYr;

  // Current view state
  let currentSubject = state.detailSubjectFilter || null;
  const currentStrand = null; // strand filter not yet tracked in detail view — future feature

  const availableSubjects = [...new Set(
    state.curriculumCodes.filter(c => (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear)).map(c => c.Subject).filter(Boolean)
  )].sort().filter(isSubjectEnabled);
  if (!availableSubjects.includes(currentSubject)) currentSubject = null;

  const availableStrands = currentSubject
    ? [...new Set(
        state.curriculumCodes.filter(c => c.Subject === currentSubject && (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear) && isCurriculumCodeEnabled(c)).map(c => c.Strand).filter(Boolean)
      )].sort()
    : [];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:500px;max-width:95vw">
      <div class="modal-head">
        <div class="modal-title">Print Report — ${s.first_name} ${s.last_name}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Choose what to include in this student's report.</div>

        <!-- Subject scope -->
        <div class="form-group">
          <label class="form-label">Subject scope</label>
          <div style="display:flex;flex-direction:column;gap:8px" id="print-subject-opts">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--text-muted)">
              <input type="radio" name="print-subject" value="all" ${!currentSubject?'checked':''} onchange="updatePrintStrandOpts()" style="accent-color:var(--blue)">
              All subjects (full report)
            </label>
            ${availableSubjects.map(subj => `
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--text-muted)">
                <input type="radio" name="print-subject" value="${subj}" ${currentSubject===subj?'checked':''} onchange="updatePrintStrandOpts()" style="accent-color:var(--blue)">
                ${subj} only
              </label>`).join('')}
          </div>
        </div>

        <!-- Strand scope (shown only when a single subject is selected) -->
        <div class="form-group" id="print-strand-group" style="${currentSubject?'':'display:none'}">
          <label class="form-label">Strand scope</label>
          <div style="display:flex;flex-direction:column;gap:8px" id="print-strand-opts">
            ${buildPrintStrandOpts(availableStrands, null)}
          </div>
        </div>

        <div style="padding:10px 14px;background:var(--surface-alt);border-radius:6px;border:1px solid var(--border);font-size:11px;color:var(--text3)">
          <span id="print-scope-preview">Calculating…</span>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitPrintReport('${studentId}')">⎙ Open &amp; Print</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  updatePrintStrandOpts();
  updatePrintScopePreview(studentId);
}

function buildPrintStrandOpts(strands, selectedStrand) {
  return `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--text-muted)">
    <input type="radio" name="print-strand" value="all" ${!selectedStrand?'checked':''} onchange="updatePrintScopePreview()" style="accent-color:var(--blue)">
    All strands
  </label>
  ${strands.map(st => `
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--text-muted)">
      <input type="radio" name="print-strand" value="${st}" ${selectedStrand===st?'checked':''} onchange="updatePrintScopePreview()" style="accent-color:var(--blue)">
      ${st} only
    </label>`).join('')}`;
}

function updatePrintStrandOpts() {
  const subjVal = document.querySelector('input[name="print-subject"]:checked')?.value;
  const strandGroup = document.getElementById('print-strand-group');
  const strandOpts  = document.getElementById('print-strand-opts');
  if (!strandGroup || !strandOpts) return;

  if (!subjVal || subjVal === 'all') {
    strandGroup.style.display = 'none';
  } else {
    strandGroup.style.display = 'block';
    const sid = state.selectedStudent;
    const s = state.students.find(x => x.id === sid);
    if (!s) return;
      const csvYear = YLM[normaliseYear(s.year_level)] || s.year_level;
    const strands = [...new Set(
      state.curriculumCodes.filter(c => c.Subject === subjVal && (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear) && isCurriculumCodeEnabled(c)).map(c => c.Strand).filter(Boolean)
    )].sort();
    strandOpts.innerHTML = buildPrintStrandOpts(strands, null);
  }
  updatePrintScopePreview(state.selectedStudent);
}

function updatePrintScopePreview(studentId) {
  const preview = document.getElementById('print-scope-preview');
  if (!preview) return;
  const sid = studentId || state.selectedStudent;
  const s = state.students.find(x => x.id === sid);
  if (!s) return;
  const subjVal   = document.querySelector('input[name="print-subject"]:checked')?.value || 'all';
  const strandVal = document.querySelector('input[name="print-strand"]:checked')?.value   || 'all';
  const csvYear = YLM[normaliseYear(s.year_level)] || s.year_level;

  const codes = state.curriculumCodes.filter(c => {
    if ((c['Year Level']||'').trim() !== (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear)) return false;
    if (subjVal !== 'all' && c.Subject !== subjVal) return false;
    if (strandVal !== 'all' && c.Strand !== strandVal) return false;
    if (!isCurriculumCodeEnabled(c)) return false;
    return true;
  });
  const achieved = codes.filter(c => getMasteryForCode(s.id, c.Code) === 'Achieved').length;
  const scope = subjVal === 'all' ? 'All subjects' : (strandVal !== 'all' ? `${subjVal} · ${strandVal}` : subjVal);
  preview.textContent = `Report scope: ${scope} · ${codes.length} codes · ${achieved} achieved`;
}

function submitPrintReport(studentId) {
  const s = state.students.find(x => x.id === studentId);
  if (!s) return;
  const subjVal   = document.querySelector('input[name="print-subject"]:checked')?.value || 'all';
  const strandVal = document.querySelector('input[name="print-strand"]:checked')?.value   || 'all';
  closeModal();
  const opts = {
    subjectFilter: subjVal === 'all'    ? null : subjVal,
    strandFilter:  strandVal === 'all'  ? null : strandVal,
  };
  openReportWindow([s], opts);
}

// ── BULK PRINT MODAL (from Students list) ──
function openBulkPrintModal() {
  const allSubjects = getEnabledSubjectsFromRows(state.curriculumCodes);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:560px;max-width:95vw">
      <div class="modal-head">
        <div class="modal-title">Bulk Print Reports</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">

        <!-- Subject + strand scope -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Subject</label>
            <select class="form-select" id="bulk-print-subject" onchange="updateBulkPrintStrands()">
              <option value="all">All subjects</option>
              ${allSubjects.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="bulk-strand-group" style="margin-bottom:0;display:none">
            <label class="form-label">Strand</label>
            <select class="form-select" id="bulk-print-strand">
              <option value="all">All strands</option>
            </select>
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3)">Select students</div>
          <div style="display:flex;gap:8px">
            <button class="btn" style="padding:4px 10px;font-size:11px" onclick="bulkPrintSelectAll(true)">Select all</button>
            <button class="btn" style="padding:4px 10px;font-size:11px" onclick="bulkPrintSelectAll(false)">Deselect all</button>
          </div>
        </div>

        <!-- Year group headers with students -->
        ${buildBulkStudentList()}

        <div style="margin-top:14px;padding:10px 14px;background:var(--surface-alt);border-radius:6px;border:1px solid var(--border);font-size:11px;color:var(--text3)" id="bulk-print-summary">
          Select students above to continue
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitBulkPrint()">⎙ Print Selected Reports</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Wire up checkbox change to update summary
  setTimeout(() => {
    document.querySelectorAll('.bulk-student-cb').forEach(cb => {
      cb.addEventListener('change', updateBulkPrintSummary);
    });
    updateBulkPrintSummary();
  }, 0);
}

function buildBulkStudentList() {
  const yearOrder = ['F','1','2','3','4','5','6'];
  const yearLabel = {'F':'Foundation','1':'Year 1','2':'Year 2','3':'Year 3','4':'Year 4','5':'Year 5','6':'Year 6'};
  let html = '';
  yearOrder.forEach(yr => {
    const group = state.students.filter(s => normaliseYear(s.year_level) === yr)
      ;
    if (!group.length) return;
    html += `<div style="margin-bottom:12px">
      <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);padding:6px 0 4px;border-bottom:1px solid var(--border);margin-bottom:4px">${yearLabel[yr] || 'Year '+yr}</div>
      ${group.map((s,si) => `
        <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:5px;cursor:pointer;transition:background 0.1s" onmouseover="this.style.background='var(--surface-alt)'" onmouseout="this.style.background='none'">
          <input type="checkbox" class="bulk-student-cb" value="${s.id}" checked style="accent-color:var(--blue);width:15px;height:15px;flex-shrink:0">
          <div class="sc-avatar ${getAvClass(si)}" style="width:26px;height:26px;font-size:11px;flex-shrink:0">${getInitials(s)}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--text)">${s.first_name} ${s.last_name}</div>
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">${getProgressStats(s.id).achieved} achieved</div>
        </label>`).join('')}
    </div>`;
  });
  return html || '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">No students added yet</div>';
}

function bulkPrintSelectAll(checked) {
  document.querySelectorAll('.bulk-student-cb').forEach(cb => { cb.checked = checked; });
  updateBulkPrintSummary();
}

function updateBulkPrintStrands() {
  const subj = document.getElementById('bulk-print-subject')?.value;
  const strandGroup = document.getElementById('bulk-strand-group');
  const strandSel = document.getElementById('bulk-print-strand');
  if (!strandGroup || !strandSel) return;
  if (!subj || subj === 'all') {
    strandGroup.style.display = 'none';
  } else {
    strandGroup.style.display = 'block';
    const strands = [...new Set(state.curriculumCodes.filter(c => c.Subject === subj && isCurriculumCodeEnabled(c)).map(c => c.Strand).filter(Boolean))].sort();
    strandSel.innerHTML = `<option value="all">All strands</option>${strands.map(st => `<option value="${st}">${st}</option>`).join('')}`;
  }
  updateBulkPrintSummary();
}

function updateBulkPrintSummary() {
  const summary = document.getElementById('bulk-print-summary');
  if (!summary) return;
  const selected = [...document.querySelectorAll('.bulk-student-cb:checked')].map(cb => cb.value);
  const subj = document.getElementById('bulk-print-subject')?.value || 'all';
  const strand = document.getElementById('bulk-print-strand')?.value || 'all';
  const scope = subj === 'all' ? 'All subjects' : (strand !== 'all' ? `${subj} · ${strand}` : subj);
  summary.textContent = selected.length === 0
    ? 'No students selected'
    : `${selected.length} report${selected.length>1?'s':''} will be printed · Scope: ${scope}`;
}

function submitBulkPrint() {
  const selectedIds = [...document.querySelectorAll('.bulk-student-cb:checked')].map(cb => cb.value);
  if (!selectedIds.length) { toast('No students selected', 'error'); return; }
  const subj   = document.getElementById('bulk-print-subject')?.value  || 'all';
  const strand = document.getElementById('bulk-print-strand')?.value   || 'all';
  closeModal();
  const students = selectedIds.map(id => state.students.find(s => s.id === id)).filter(Boolean);
  const opts = {
    subjectFilter: subj   === 'all' ? null : subj,
    strandFilter:  strand === 'all' ? null : strand,
  };
  openReportWindow(students, opts);
}

// ── CORE REPORT WINDOW OPENER ──
// Opens a new tab with one or more student reports, one per page, then triggers print
function openReportWindow(students, opts) {
  const today = new Date().toLocaleDateString('en-AU', {day:'numeric',month:'long',year:'numeric'});
  const pages = students.map((s, i) => {
    const body = buildStudentReportBody(s, opts);
    return `<div class="report-page"${i > 0 ? ' style="page-break-before:always"' : ''}>${body}</div>`;
  }).join('\n');

  const reportHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${students.length === 1 ? 'Student Report — '+students[0].first_name+' '+students[0].last_name : 'Class Reports · '+today}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; }
  .report-page { padding: 0; }
  @page { margin: 15mm; size: A4; }
  @media print { .report-page { page-break-inside: avoid; } }
</style>
</head>
<body>${pages}</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(reportHTML);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

// ── STUDENT REPORT (kept for legacy compatibility) ──
function printStudentReport() {
  openPrintOptionsModal(state.selectedStudent);
}

function closeModal() {
  const m = document.getElementById('modal-overlay');
  if (m) m.remove();
}

document.addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// ── AUTO-FETCH CSVs FROM GITHUB ──
const CURRICULUM_CODE_KEYS = new Set([
  'curriculumCodesEnglish',
  'curriculumCodesScience',
  'curriculumCodesHASS',
  'curriculumCodesHPE',
  'curriculumCodesDesignTech',
  'curriculumCodesDigitalTech',
  'curriculumCodesDance',
  'curriculumCodesDrama',
  'curriculumCodesMediaArts',
  'curriculumCodesMusic',
  'curriculumCodesVisualArts',
]);

// ── CSV localStorage cache ──
// Key format: ct_csv_${CSV_CACHE_VERSION}_${filename}. Cache stores the raw CSV
// text so existing parsing logic is unchanged. All cache ops fail silently.
function csvCacheGet(filename) {
  try {
    return localStorage.getItem(`ct_csv_${CSV_CACHE_VERSION}_${filename}`);
  } catch(e) {
    return null;
  }
}

function csvCacheSet(filename, text) {
  try {
    localStorage.setItem(`ct_csv_${CSV_CACHE_VERSION}_${filename}`, text);
  } catch(e) {
    // localStorage full or unavailable — continue without caching.
  }
}

// Returns the raw CSV text, served from cache when present, otherwise fetched
// from GitHub raw and cached before returning.
//
// Intentional staleness tradeoff: a cache hit is returned without revalidating
// against GitHub (no TTL/ETag), so the cache lives for the entire lifetime of
// the current CSV_CACHE_VERSION (= APP_VERSION). This is deliberate — it is what
// eliminates the repeated GitHub-raw requests that were causing rate-limit 400s.
// Consequence: a data-only commit to a CSV on main does NOT reach users until
// APP_VERSION is bumped (which invalidates every ct_csv_ key). Per project
// convention, bump APP_VERSION whenever curriculum/IC CSV data changes so the
// updated data propagates to users.
async function fetchCSVTextCached(filename, url) {
  const cached = csvCacheGet(filename);
  if (cached !== null) return cached;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const text = await resp.text();
  csvCacheSet(filename, text);
  return text;
}

// Removes any ct_csv_ cache entries from a different app version (stale cache cleanup).
function clearStaleCSVCache() {
  try {
    const keep = `ct_csv_${CSV_CACHE_VERSION}_`;
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ct_csv_') && !k.startsWith(keep)) stale.push(k);
    }
    stale.forEach(k => localStorage.removeItem(k));
  } catch(e) {
    // localStorage unavailable — nothing to clean up.
  }
}

async function fetchCSVFromGitHub(key) {
  const { file, iconId, navId } = CSV_FILES[key];
  try {
    const url = GITHUB_RAW + file.split(' ').join('%20');
    const text = await fetchCSVTextCached(key, url);
    const parsed = parseCSV(text);
    if (CURRICULUM_CODE_KEYS.has(key)) {
      state.curriculumCodes = [...state.curriculumCodes, ...parsed];
    } else {
      state[key] = parsed;
    }
    markLoaded(iconId, navId);
    return parsed.length;
  } catch(e) {
    console.warn('Could not auto-load ' + file + ':', e);
    return 0;
  }
}

async function fetchICsCSVFromGitHub(key = 'ics_year2_maths_number') {
  const file = CSV_FILES[key].file;
  try {
    const url = GITHUB_RAW + file;
    const rows = parseCSV(await fetchCSVTextCached(key, url));
    const ics = rows.map(row => {
      const rawLinked = (row.linkedDescriptorIds || '').replace(/^\[|\]$/g, '').trim();
      return createIC({
        id: row.id || undefined,
        homeDescriptorId: row.homeDescriptorId || null,
        linkedDescriptorIds: rawLinked ? rawLinked.split(',').map(s => s.trim()).filter(Boolean) : [],
        name: row.name || '',
        description: row.description || '',
        sequenceOrder: parseInt(row.sequenceOrder, 10) || 0,
        difficultyStage: row.difficultyStage || 'early',
        exampleOfSuccess: row.exampleOfSuccess || null,
        commonError: row.commonError || null,
        checkpointTask: row.checkpointTask || null,
        isOptional: (row.isOptional || '').toLowerCase() === 'true',
        isArchived: (row.isArchived || '').toLowerCase() === 'true',
        ownerTier: row.ownerTier || 'system_default',
        copiedFromId: row.copiedFromId || null,
        equivalentToId: row.equivalentToId || null,
        suppressedByTeacher: (row.suppressedByTeacher || '').toLowerCase() === 'true',
        icReadinessStatus: row.icReadinessStatus || 'active',
        aiQualityFlags: row.aiQualityFlags || null,
        reviewNotes: row.reviewNotes || '',
      });
    });
    state.instructionalComponents.push(...ics);
    return ics.length;
  } catch(e) {
    console.warn('Could not auto-load ' + file + ':', e);
    return 0;
  }
}

async function fetchAllCSVs() {
  // Drop CSV cache entries left over from older app versions before fetching.
  clearStaleCSVCache();

  // ── Descriptor CSVs: sequential to avoid race condition on state.curriculumCodes ──
  const count1  = await fetchCSVFromGitHub('curriculumCodes');           // Maths (sets)
  const count2  = await fetchCSVFromGitHub('curriculumCodesEnglish');   // appends
  const count3  = await fetchCSVFromGitHub('curriculumCodesScience');   // appends
  const count4  = await fetchCSVFromGitHub('curriculumCodesHASS');      // appends
  const count5  = await fetchCSVFromGitHub('curriculumCodesHPE');       // appends
  const count6  = await fetchCSVFromGitHub('curriculumCodesDesignTech');  // appends
  const count7  = await fetchCSVFromGitHub('curriculumCodesDigitalTech'); // appends
  const count8  = await fetchCSVFromGitHub('curriculumCodesDance');       // appends
  const count9  = await fetchCSVFromGitHub('curriculumCodesDrama');       // appends
  const count10 = await fetchCSVFromGitHub('curriculumCodesMediaArts');   // appends
  const count11 = await fetchCSVFromGitHub('curriculumCodesMusic');       // appends
  const count12 = await fetchCSVFromGitHub('curriculumCodesVisualArts');  // appends

  // ── Everything else in parallel ──
  const results = await Promise.all([
    fetchCSVFromGitHub('standards'),
    fetchCSVFromGitHub('progressions'),
    fetchCSVFromGitHub('numeracyProgressions'),
    fetchCSVFromGitHub('elaborations'),
    fetchICsCSVFromGitHub('ics_foundation_maths_number'),
    fetchICsCSVFromGitHub('ics_foundation_maths_algebra'),
    fetchICsCSVFromGitHub('ics_foundation_maths_measurement'),
    fetchICsCSVFromGitHub('ics_foundation_maths_space'),
    fetchICsCSVFromGitHub('ics_foundation_maths_statistics'),
    fetchICsCSVFromGitHub('ics_year1_maths_number'),
    fetchICsCSVFromGitHub('ics_year1_maths_algebra'),
    fetchICsCSVFromGitHub('ics_year1_maths_measurement'),
    fetchICsCSVFromGitHub('ics_year1_maths_space'),
    fetchICsCSVFromGitHub('ics_year1_maths_statistics'),
    fetchICsCSVFromGitHub('ics_year2_maths_number'),
    fetchICsCSVFromGitHub('ics_year2_maths_algebra'),
    fetchICsCSVFromGitHub('ics_year2_maths_measurement'),
    fetchICsCSVFromGitHub('ics_year2_maths_space'),
    fetchICsCSVFromGitHub('ics_year2_maths_statistics'),
    fetchICsCSVFromGitHub('ics_year3_maths_number'),
    fetchICsCSVFromGitHub('ics_year3_maths_algebra'),
    fetchICsCSVFromGitHub('ics_year3_maths_measurement'),
    fetchICsCSVFromGitHub('ics_year3_maths_space'),
    fetchICsCSVFromGitHub('ics_year3_maths_statistics'),
    fetchICsCSVFromGitHub('ics_year3_maths_probability'),
    fetchICsCSVFromGitHub('ics_year4_maths_number'),
    fetchICsCSVFromGitHub('ics_year4_maths_algebra'),
    fetchICsCSVFromGitHub('ics_year4_maths_measurement'),
    fetchICsCSVFromGitHub('ics_year4_maths_space'),
    fetchICsCSVFromGitHub('ics_year4_maths_statistics'),
    fetchICsCSVFromGitHub('ics_year4_maths_probability'),
    fetchICsCSVFromGitHub('ics_year5_maths_number'),
    fetchICsCSVFromGitHub('ics_year5_maths_algebra'),
    fetchICsCSVFromGitHub('ics_year5_maths_measurement'),
    fetchICsCSVFromGitHub('ics_year5_maths_space'),
    fetchICsCSVFromGitHub('ics_year5_maths_statistics'),
    fetchICsCSVFromGitHub('ics_year5_maths_probability'),
    fetchICsCSVFromGitHub('ics_year6_maths_number'),
    fetchICsCSVFromGitHub('ics_year6_maths_algebra'),
    fetchICsCSVFromGitHub('ics_year6_maths_measurement'),
    fetchICsCSVFromGitHub('ics_year6_maths_space'),
    fetchICsCSVFromGitHub('ics_year6_maths_statistics'),
    fetchICsCSVFromGitHub('ics_year6_maths_probability'),
    fetchICsCSVFromGitHub('ics_year2_english_language'),
    fetchICsCSVFromGitHub('ics_year2_english_literature'),
    fetchICsCSVFromGitHub('ics_year2_english_literacy'),
    fetchICsCSVFromGitHub('ics_year2_science_understanding'),
    fetchICsCSVFromGitHub('ics_year2_science_human_endeavour'),
    fetchICsCSVFromGitHub('ics_year2_science_inquiry_skills'),
  ]);

  const total = count1 + count2 + count3 + count4 + count5 + count6 + count7 +
                count8 + count9 + count10 + count11 + count12 +
                results.reduce((a, b) => a + b, 0);
  if (total > 0) toast('Curriculum data loaded automatically', 'success');
}

function buildDescriptorIndex() {
  // curriculumCodes uses 'Code'; elaborations uses 'Content code' and 'Elaboration'
  state.curriculumCodes = state.curriculumCodes.map(cd => {
    const code = cd['Code'] || '';

    const isHASSSkill    = /^AC9HS\d+S\d+$/.test(code);
    const isScienceSkill = /^AC9S\d+I\d+$/.test(code);
    const descriptorType = (isHASSSkill || isScienceSkill) ? 'skill' : 'knowledge';

    const elaborations = state.elaborations
      .filter(e => (e['Content code'] || '') === code)
      .map(e => e['Elaboration'] || '')
      .filter(Boolean);

    return { ...cd, descriptorType, elaborations };
  });
}


// ── IC FACTORY AND SELECTORS ──

function createIC(fields = {}) {
  return {
    id: fields.id ?? crypto.randomUUID(),
    homeDescriptorId: fields.homeDescriptorId ?? null,
    linkedDescriptorIds: fields.linkedDescriptorIds ?? [],
    name: fields.name ?? '',
    description: fields.description ?? '',
    sequenceOrder: fields.sequenceOrder ?? 0,
    difficultyStage: fields.difficultyStage ?? 'early',
    exampleOfSuccess: fields.exampleOfSuccess ?? null,
    commonError: fields.commonError ?? null,
    checkpointTask: fields.checkpointTask ?? null,
    isOptional: fields.isOptional ?? false,
    isArchived: fields.isArchived ?? false,
    ownerTier: fields.ownerTier ?? 'system_default',
    copiedFromId: fields.copiedFromId ?? null,
    equivalentToId: fields.equivalentToId ?? null,
    suppressedByTeacher: fields.suppressedByTeacher ?? false,
    icReadinessStatus: fields.icReadinessStatus ?? 'active',
    aiQualityFlags: fields.aiQualityFlags ?? null,
    reviewNotes: fields.reviewNotes ?? '',
    note: fields.note ?? '',
    createdAt: fields.createdAt ?? new Date().toISOString(),
  };
}

// All active ICs for a descriptor (home + linked, not archived, not suppressed system defaults)
function getICsForDescriptor(descriptorId) {
  return state.instructionalComponents.filter(ic =>
    !ic.isArchived &&
    !(ic.ownerTier === 'system_default' && ic.suppressedByTeacher) &&
    (ic.homeDescriptorId === descriptorId || ic.linkedDescriptorIds.includes(descriptorId))
  );
}

// System default ICs for a descriptor (for threshold calculation)
function getSystemDefaultICsForDescriptor(descriptorId) {
  return state.instructionalComponents.filter(ic =>
    ic.ownerTier === 'system_default' &&
    !ic.isArchived &&
    !ic.suppressedByTeacher &&
    ic.homeDescriptorId === descriptorId
  );
}

// Validity ratio for a descriptor (section 9.5 — does not check lesson taught status yet)
function getICCoverageRatio(descriptorId, taughtICIds = []) {
  const activeDefaults = getSystemDefaultICsForDescriptor(descriptorId);
  if (activeDefaults.length === 0) return null;
  const taughtDefaults = activeDefaults.filter(ic => taughtICIds.includes(ic.id));
  const activeDefaultIds = new Set(activeDefaults.map(ic => ic.id));
  const equivalentTaught = state.instructionalComponents.filter(ic =>
    ic.ownerTier === 'teacher_original' &&
    ic.equivalentToId !== null &&
    activeDefaultIds.has(ic.equivalentToId) &&
    taughtICIds.includes(ic.id)
  );
  return (taughtDefaults.length + equivalentTaught.length) / activeDefaults.length;
}

function getUnresolvedStubCount() {
  return state.instructionalComponents.filter(ic =>
    ic.ownerTier === 'teacher_stub' && ic.icReadinessStatus === 'draft'
  ).length;
}

// ── COVERAGE TOOLTIP ──
function showCoverageTooltip(event, code, descriptor, subject, strand) {
  hideCoverageTooltip();
  const tip = document.createElement('div');
  tip.id = 'cv-tooltip';
  const col = subjectCol(subject);
  tip.style.cssText = `position:fixed;z-index:999;max-width:320px;background:var(--surface);border:1px solid var(--border2);border-radius:8px;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,0.4);pointer-events:none;animation:fadeIn 0.1s ease`;
  tip.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${col}">${code}</span>
      ${strand ? `<span style="font-size:9px;background:${col}22;color:${col};padding:1px 6px;border-radius:3px;font-family:'DM Mono',monospace">${strand}</span>` : ''}
    </div>
    <div style="font-size:12px;color:var(--text-muted);line-height:1.5">${descriptor}</div>
  `;
  document.body.appendChild(tip);

  // Position near cursor but keep on screen
  const x = Math.min(event.clientX + 12, window.innerWidth  - 340);
  const y = Math.min(event.clientY + 12, window.innerHeight - 120);
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideCoverageTooltip() {
  const tip = document.getElementById('cv-tooltip');
  if (tip) tip.remove();
}

// ════════════════════════════════════════════════════
// ── MASTERY READY BANNER (Phase 3) ──
// Surfaces when a student has ≥80% IC coverage for a descriptor
// but no Progress record yet. Prompts the teacher to make a
// formal descriptor-level mastery judgement.
// ════════════════════════════════════════════════════

function getReadyForMasteryBanner() {
  const results = [];
  const descriptorsWithDefaultICs = new Set(
    state.instructionalComponents
      .filter(ic => ic.ownerTier === 'system_default' && !ic.isArchived)
      .map(ic => ic.homeDescriptorId)
      .filter(Boolean)
  );
  state.students.forEach(student => {
    descriptorsWithDefaultICs.forEach(descriptorId => {
      if (state.progress.some(p => p.student_id === student.id && p.code === descriptorId)) return;
      const systemICs = state.instructionalComponents.filter(
        ic => ic.ownerTier === 'system_default' && !ic.isArchived && ic.homeDescriptorId === descriptorId
      );
      if (!systemICs.length) return;
      const taughtCount = systemICs.filter(ic => {
        const st = getTaughtICStatus(student.id, ic.id);
        return st === 'taught' || st === 'got_it' || st === 'needs_review' || st === 'mastered' || st === 'not_yet';
      }).length;
      if (taughtCount / systemICs.length >= 0.8) {
        const cd = state.curriculumCodes.find(c => c.Code === descriptorId);
        results.push({
          student,
          descriptorId,
          taughtCount,
          total: systemICs.length,
          strand: cd ? (cd.Strand || null) : null,
          subject: cd ? (cd.Subject || null) : null,
          descriptor: cd ? (cd.Descriptor || cd.Aspect || '') : ''
        });
      }
    });
  });
  return results;
}

function renderMasteryBannerHtml(readyPairs) {
  if (!readyPairs.length || masteryBannerDismissedSession) return '';
  const count = readyPairs.length;
  return `
    <div id="mastery-ready-banner" style="border:1px solid var(--gold);background:var(--gold-dim);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">Students ready for mastery review</div>
        <div style="font-size:11px;color:var(--text3)">${count} student · descriptor ${count === 1 ? 'pair' : 'pairs'} ready for a formal mastery judgement</div>
      </div>
      <button onclick="openMasteryBannerModal()" style="padding:7px 16px;border-radius:5px;border:1px solid var(--gold);background:var(--gold-dim);color:var(--gold);font-size:12px;font-weight:600;cursor:pointer;font-family:'Instrument Sans',sans-serif;flex-shrink:0">Review now</button>
      <button onclick="dismissMasteryBanner()" style="padding:7px 12px;border-radius:5px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif;flex-shrink:0">Dismiss</button>
    </div>`;
}

function dismissMasteryBanner() {
  masteryBannerDismissedSession = true;
  const banner = document.getElementById('mastery-ready-banner');
  if (banner) banner.remove();
}

function openMasteryBannerModal(pairs) {
  const readyPairs = pairs || getReadyForMasteryBanner();
  if (!readyPairs.length) { toast('No students ready for review', 'info'); return; }

  masteryPickerState = {
    pairs: readyPairs,
    selections: {},
    checked: new Set(),
    collapsedGroups: new Set(),
  };

  // Pre-populate with existing progress records (edit flow)
  readyPairs.forEach(pair => {
    const key = pair.student.id + '|' + pair.descriptorId;
    const existing = state.progress.find(p => p.student_id === pair.student.id && p.code === pair.descriptorId);
    if (existing) {
      masteryPickerState.selections[key] = { mastery: existing.mastery, notReadyReason: null };
    }
  });

  const existing = document.getElementById('mastery-banner-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mastery-banner-modal';
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  _renderMasteryBannerModalContent();
}

function _renderMasteryBannerModalContent() {
  const overlay = document.getElementById('mastery-banner-modal');
  if (!overlay) return;

  const { pairs, selections, checked, collapsedGroups } = masteryPickerState;

  const groupMap = {};
  pairs.forEach(pair => {
    if (!groupMap[pair.descriptorId]) {
      groupMap[pair.descriptorId] = { descriptor: pair.descriptor, strand: pair.strand, subject: pair.subject, pairs: [] };
    }
    groupMap[pair.descriptorId].pairs.push(pair);
  });

  const allKeys = pairs.map(p => p.student.id + '|' + p.descriptorId);
  const allChecked = allKeys.length > 0 && allKeys.every(k => checked.has(k));
  const anyChecked = allKeys.some(k => checked.has(k));
  const judgedCount = Object.values(selections).filter(s => s && s.mastery).length;
  const toWriteCount = Object.values(selections).filter(s => s && s.mastery && s.mastery !== 'not_ready').length;

  const masteryConfig = {
    'Achieved':   { col: 'var(--green)', bg: 'var(--green-dim)', label: 'Achieved'      },
    'Extended':   { col: 'var(--teal)',  bg: 'var(--teal-dim)',  label: 'Extended'       },
    'Developing': { col: 'var(--gold)',  bg: 'var(--gold-dim)',  label: 'Developing'     },
    'not_ready':  { col: 'var(--text3)', bg: 'var(--surface-alt)', label: 'Not yet ready' },
  };
  const notReadyReasons = ['Needs more practice', 'Needs reteaching', 'Needs more evidence', '(no reason)'];

  const groupsHtml = Object.entries(groupMap).map(([code, group]) => {
    const isOpen = !collapsedGroups.has(code);
    const col = subjectCol(group.subject || '');

    const studentRows = isOpen ? group.pairs.map(pair => {
      const key = pair.student.id + '|' + pair.descriptorId;
      const sel = selections[key] || {};
      const isChecked = checked.has(key);
      const dot = dlGetStrandDot(pair.student.id, pair.strand);
      const dotHtml = dot
        ? `<div title="${escapeHtml(dot.title)}" style="width:8px;height:8px;border-radius:50%;background:${dot.colour};flex-shrink:0;margin-top:4px"></div>`
        : `<div style="width:8px;height:8px;border-radius:50%;background:var(--border2);flex-shrink:0;margin-top:4px" title="No prior IC outcome data for this strand"></div>`;

      const masteryButtons = Object.entries(masteryConfig).map(([level, cfg]) => {
        const isActive = sel.mastery === level;
        return `<button onclick="masteryBannerSelectMastery('${key}','${level}')" style="padding:4px 10px;border-radius:4px;border:1px solid ${isActive ? cfg.col : 'var(--border2)'};background:${isActive ? cfg.bg : 'none'};color:${isActive ? cfg.col : 'var(--text3)'};font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif;white-space:nowrap">${cfg.label}</button>`;
      }).join('');

      const notReadyHtml = sel.mastery === 'not_ready' ? `
        <div style="display:flex;flex-wrap:wrap;gap:4px;padding:5px 0 0 0">
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);align-self:center;margin-right:2px">Reason:</span>
          ${notReadyReasons.map(r => {
            const isActive = sel.notReadyReason === r;
            return `<button onclick="masteryBannerSelectReason('${key}','${r.replace(/'/g, "\\'")}') " style="padding:2px 8px;border-radius:4px;border:1px solid ${isActive ? 'var(--text2)' : 'var(--border2)'};background:${isActive ? 'var(--surface-alt)' : 'none'};color:${isActive ? 'var(--text2)' : 'var(--text3)'};font-size:10px;cursor:pointer">${escapeHtml(r)}</button>`;
          }).join('')}
        </div>` : '';

      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)">
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="masteryBannerToggleCheck('${key}')" style="margin-top:4px;flex-shrink:0;cursor:pointer;accent-color:var(--blue)">
        ${dotHtml}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:5px">${escapeHtml(pair.student.first_name)} <span style="font-weight:400;color:var(--text3)">${escapeHtml(pair.student.last_name)}</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">${masteryButtons}</div>
          ${notReadyHtml}
        </div>
      </div>`;
    }).join('') : '';

    return `<div style="border:1px solid var(--border);border-radius:6px;margin-bottom:8px;overflow:hidden">
      <div onclick="masteryBannerToggleGroup('${code}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;background:var(--surface-alt);user-select:none">
        <span style="font-size:10px;color:var(--text3);width:12px;flex-shrink:0">${isOpen ? '▾' : '▸'}</span>
        <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${col};flex-shrink:0">${escapeHtml(code)}</span>
        <span style="font-size:11px;color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(group.descriptor)}</span>
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);flex-shrink:0;white-space:nowrap">${group.pairs.length} student${group.pairs.length !== 1 ? 's' : ''}</span>
      </div>
      ${isOpen ? `<div>${studentRows}</div>` : ''}
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" style="width:min(95vw,680px);max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-head">
        <div class="modal-title">Mastery Review</div>
        <button class="modal-close" onclick="document.getElementById('mastery-banner-modal')?.remove()">✕</button>
      </div>
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text3)">
          <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="masteryBannerToggleAll()" style="cursor:pointer;accent-color:var(--blue)">
          ${allChecked ? 'Deselect all' : 'Select all'}
        </label>
        ${anyChecked ? `
          <span style="width:1px;height:14px;background:var(--border2)"></span>
          <button onclick="masteryBannerBulkSet('Achieved')" style="padding:4px 10px;border-radius:4px;border:1px solid var(--green);background:var(--green-dim);color:var(--green);font-size:11px;cursor:pointer;white-space:nowrap">Mark Achieved</button>
          <button onclick="masteryBannerBulkSet('Developing')" style="padding:4px 10px;border-radius:4px;border:1px solid var(--gold);background:var(--gold-dim);color:var(--gold);font-size:11px;cursor:pointer;white-space:nowrap">Mark Developing</button>
        ` : ''}
        <span style="margin-left:auto;font-size:11px;color:var(--text3)">${judgedCount} of ${pairs.length} judged</span>
      </div>
      <div style="overflow-y:auto;flex:1;padding:12px 16px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px;padding:8px 12px;background:var(--surface-alt);border-radius:5px;border:1px solid var(--border)">
          Select a mastery level for each student. <strong>Not yet ready</strong> means no Progress record is written — the student stays on the banner until a formal call is made.
        </div>
        ${groupsHtml}
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="document.getElementById('mastery-banner-modal')?.remove()">Cancel</button>
        <button class="btn btn-primary" ${judgedCount === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} onclick="submitMasteryBanner()">${toWriteCount > 0 ? 'Save ' + toWriteCount + ' judgement' + (toWriteCount !== 1 ? 's' : '') : 'Confirm'}</button>
      </div>
    </div>
  `;
}

function masteryBannerSelectMastery(key, level) {
  if (!masteryPickerState.selections[key]) masteryPickerState.selections[key] = { mastery: null, notReadyReason: null };
  masteryPickerState.selections[key].mastery = level;
  if (level !== 'not_ready') masteryPickerState.selections[key].notReadyReason = null;
  _renderMasteryBannerModalContent();
}

function masteryBannerToggleCheck(key) {
  if (masteryPickerState.checked.has(key)) masteryPickerState.checked.delete(key);
  else masteryPickerState.checked.add(key);
  _renderMasteryBannerModalContent();
}

function masteryBannerToggleGroup(code) {
  if (masteryPickerState.collapsedGroups.has(code)) masteryPickerState.collapsedGroups.delete(code);
  else masteryPickerState.collapsedGroups.add(code);
  _renderMasteryBannerModalContent();
}

function masteryBannerSelectReason(key, reason) {
  if (!masteryPickerState.selections[key]) masteryPickerState.selections[key] = { mastery: 'not_ready', notReadyReason: null };
  masteryPickerState.selections[key].notReadyReason = reason;
  _renderMasteryBannerModalContent();
}

function masteryBannerBulkSet(mastery) {
  masteryPickerState.checked.forEach(key => {
    if (!masteryPickerState.selections[key]) masteryPickerState.selections[key] = { mastery: null, notReadyReason: null };
    masteryPickerState.selections[key].mastery = mastery;
    masteryPickerState.selections[key].notReadyReason = null;
  });
  _renderMasteryBannerModalContent();
}

function masteryBannerToggleAll() {
  const allKeys = masteryPickerState.pairs.map(p => p.student.id + '|' + p.descriptorId);
  const allChecked = allKeys.every(k => masteryPickerState.checked.has(k));
  if (allChecked) allKeys.forEach(k => masteryPickerState.checked.delete(k));
  else allKeys.forEach(k => masteryPickerState.checked.add(k));
  _renderMasteryBannerModalContent();
}

async function submitMasteryBanner() {
  const { pairs, selections } = masteryPickerState;
  const today = new Date().toISOString().split('T')[0];

  const toSave = pairs
    .filter(pair => {
      const key = pair.student.id + '|' + pair.descriptorId;
      const sel = selections[key];
      return sel && sel.mastery && sel.mastery !== 'not_ready';
    })
    .map(pair => {
      const key = pair.student.id + '|' + pair.descriptorId;
      return {
        student_id: pair.student.id,
        content_descriptor_code: pair.descriptorId,
        mastery_level: selections[key].mastery,
        date_assessed: today,
        teacher_notes: ''
      };
    });

  if (!toSave.length) {
    document.getElementById('mastery-banner-modal')?.remove();
    renderView();
    return;
  }

  const btn = document.querySelector('#mastery-banner-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const savedCount = await saveProgressBatch(toSave);
    document.getElementById('mastery-banner-modal')?.remove();
    toast(`${savedCount} mastery judgement${savedCount !== 1 ? 's' : ''} saved`, 'success');
    renderView();
  } catch(e) {
    console.error('submitMasteryBanner error:', e);
    toast('Could not save judgements', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save judgements'; }
  }
}

function openEditProgressIndicator(studentId, descriptorId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;
  const cd = state.curriculumCodes.find(c => c.Code === descriptorId);
  openMasteryBannerModal([{
    student,
    descriptorId,
    taughtCount: 0,
    total: 0,
    strand: cd ? (cd.Strand || null) : null,
    subject: cd ? (cd.Subject || null) : null,
    descriptor: cd ? (cd.Descriptor || cd.Aspect || '') : ''
  }]);
}

// ════════════════════════════════════════════════════
// ── COVERAGE GAPS VIEW ──
// Heatmap: codes as rows, students as columns
// Shows taught / assessed / gap at a glance
// ════════════════════════════════════════════════════

function renderCoverage(main) {
  if (!state.coverageFilter) {
    state.coverageFilter = { subject: 'English', year: 'all', strand: 'all', mode: 'all' };
  }
  const cf = state.coverageFilter;


  const availSubjects = getEnabledSubjectsFromRows(state.curriculumCodes);
  if (!availSubjects.includes(cf.subject)) {
    cf.subject = availSubjects[0] || 'English';
    cf.strand = 'all';
  }
  const col = subjectCol(cf.subject);

  // Filter codes
  let codes = state.curriculumCodes.filter(c => {
    if (cf.subject !== 'all' && c.Subject !== cf.subject) return false;
    if (cf.strand  !== 'all' && c.Strand  !== cf.strand)  return false;
    if (cf.year    !== 'all' && (c['Year Level']||'').trim() !== (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(YLM[cf.year]||cf.year) : (YLM[cf.year]||cf.year))) return false;
    if (!isCurriculumCodeEnabled(c)) return false;
    return true;
  });

  // Filter students by year
  const students = sortStudents(state.students.filter(s => cf.year === 'all' || normaliseYear(s.year_level) === cf.year));

  // Mode filter — not-taught-yet only shows codes not taught to ANY student
  if (cf.mode === 'not-taught') {
    codes = codes.filter(c => !students.some(s => wasCodeTaughtToStudent(s.id, c.Code)));
  }

  // Cache the currently-visible descriptor codes so the global "expand all ICs"
  // toggle (handled in the delegated click listener) can set every per-descriptor key.
  state._coverageVisibleCodes = codes.map(c => c.Code);

  // Keep the global toggle in sync after a filter change: while "expand all" is on,
  // any newly-visible descriptor must also be opened, otherwise the button reads
  // "Collapse all ICs" while the rows below stay collapsed. Only default keys that
  // have never been set — an explicit per-descriptor chevron collapse stores `false`
  // and must survive the re-render, so individual rows can still be collapsed.
  if (state.coverageExpandAll) {
    if (!state.icCoverageOpen) state.icCoverageOpen = {};
    state._coverageVisibleCodes.forEach(code => {
      const k = `covgap|desc|${code}`;
      if (state.icCoverageOpen[k] === undefined) state.icCoverageOpen[k] = true;
    });
  }

  // Summary stats
  const totalCells     = codes.length * students.length;
  const taughtCells    = codes.reduce((n,c) => n + students.filter(s => wasCodeTaughtToStudent(s.id,c.Code)).length, 0);
  const assessedCells  = codes.reduce((n,c) => n + students.filter(s => getMasteryForCode(s.id,c.Code) !== 'Not taught').length, 0);
  const achievedCells  = codes.reduce((n,c) => n + students.filter(s => getMasteryForCode(s.id,c.Code) === 'Achieved').length, 0);
  const gapCodes       = codes.filter(c => !students.some(s => wasCodeTaughtToStudent(s.id,c.Code)));

  function fBtn(label, active, action, value, extra) {
    // Use data attributes + dedicated handler instead of data-ba-fn eval
    const extraAttr = extra ? ` data-cv-extra="${extra}"` : '';
    return `<button data-cv-action="${action}" data-cv-value="${value}"${extraAttr}
      title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"
      style="padding:5px 11px;border-radius:4px;border:1px solid ${active?col:'var(--border2)'};background:${active?col+'22':'none'};color:${active?col:'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap">${label}</button>`;
  }

  // Build the grid
  function buildGrid() {
    if (!codes.length) return `<div class="empty-state" style="padding:60px">
      <div class="empty-icon">◈</div>
      <div class="empty-title">No codes match this filter</div>
      <div class="empty-sub">Try changing the subject, year or strand filter</div>
    </div>`;
    if (!students.length) return `<div class="empty-state" style="padding:60px">
      <div class="empty-icon">◎</div>
      <div class="empty-title">No students in this year level</div>
    </div>`;

    // Cell colour logic
    function cellStyle(s, c) {
      const taught   = wasCodeTaughtToStudent(s.id, c.Code);
      const mastery  = getMasteryForCode(s.id, c.Code);
      if (mastery === 'Achieved')   return 'background:var(--green);title=Achieved';
      if (mastery === 'Developing') return 'background:var(--gold);title=Developing';
      if (mastery === 'Emerging')   return 'background:var(--rust);title=Emerging';
      if (taught)                   return 'background:var(--blue-dim);border:1px solid var(--blue);title=Taught · not assessed';
      return 'background:var(--surface-alt);title=Not taught yet';
    }

    // IC sub-row cell colour: most-recent taughtICs record for this IC + student.
    // Mirrors the canonical status semantics used elsewhere: 'taught' = taught with no
    // outcome; got_it/mastered and needs_review/not_yet are the (legacy-aware) outcomes;
    // an empty/cleared status (toggleICStatus stores '' since the backend can't delete)
    // is treated as not taught, same as the rest of the app.
    function icCellStyle(s, ic) {
      const entries = state.taughtICs.filter(t => t.ic_id === ic.id && String(t.student_id) === String(s.id));
      if (!entries.length) return { bg: 'transparent', title: 'Not taught' };
      entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const st = entries[0].status;
      if (st === 'got_it' || st === 'mastered')      return { bg: 'var(--green)',    title: 'Got it' };
      if (st === 'needs_review' || st === 'not_yet') return { bg: 'var(--rust)',     title: 'Needs review' };
      if (st === 'taught')                           return { bg: 'var(--blue-dim)', title: 'Taught · no outcome recorded' };
      return { bg: 'transparent', title: 'Not taught' };
    }

    const studentHeaders = students.map(s =>
      `<th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border);writing-mode:vertical-rl;transform:rotate(180deg);height:92px;vertical-align:bottom;font-size:11px;color:var(--text-muted);font-weight:600;cursor:pointer;white-space:nowrap" onclick="openStudentDetail('${s.id}')" title="${s.first_name} ${s.last_name}">
        ${s.first_name} ${s.last_name[0]}.
      </th>`
    ).join('');

    // Group by strand
    const strands = [...new Set(codes.map(c => c.Strand).filter(Boolean))].sort();
    const codesByStrand = strands.map(strand => ({
      strand,
      codes: codes.filter(c => c.Strand === strand)
    }));
    // Codes with no strand
    const noStrandCodes = codes.filter(c => !c.Strand);
    if (noStrandCodes.length) codesByStrand.push({ strand: 'Other', codes: noStrandCodes });

    const bodyRows = codesByStrand.map(({strand, codes: sCodes}) => {
      const strandRow = `<tr>
        <td colspan="${students.length + 2}" style="padding:6px 10px;background:var(--surface-alt);font-family:'DM Mono',monospace;font-size:9px;color:${col};text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid var(--border)">
          ${truncateWithTooltip(`${strand} · ${sCodes.length} codes`, 60)}
        </td>
      </tr>`;
      const codeRows = sCodes.map((c, ci) => {
        const taughtCount = students.filter(s => wasCodeTaughtToStudent(s.id, c.Code)).length;
        const gapCount    = students.length - taughtCount;
        const fullDesc    = (c.Descriptor || c.Aspect || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        const descKey     = `covgap|desc|${c.Code}`;
        const descOpen    = !!state.icCoverageOpen[descKey];
        const cells = students.map(s => {
          const taught   = wasCodeTaughtToStudent(s.id, c.Code);
          const mastery  = getMasteryForCode(s.id, c.Code);
          const dates    = getTaughtDatesForCode(s.id, c.Code);
          const lastDate = dates[0] || '';
          let bg, cellTitle, dot;
          if      (mastery === 'Achieved')   { bg='var(--green)';    cellTitle=`Achieved${lastDate?' · '+lastDate:''}`;        dot='●'; }
          else if (mastery === 'Developing') { bg='var(--gold)';     cellTitle=`Developing${lastDate?' · '+lastDate:''}`;      dot='◐'; }
          else if (mastery === 'Emerging')   { bg='var(--rust)';     cellTitle=`Emerging${lastDate?' · '+lastDate:''}`;        dot='○'; }
          else if (taught)                   { bg='var(--blue-dim)'; cellTitle=`Taught ${lastDate} · not assessed`;            dot='·'; }
          else                               { bg='transparent';     cellTitle='Not taught yet';                               dot=' '; }
          return `<td style="padding:3px;text-align:center;border-bottom:1px solid var(--border);border-right:1px solid var(--border)" title="${s.first_name} ${s.last_name} · ${cellTitle}">
            <div style="width:22px;height:22px;border-radius:4px;background:${bg};margin:auto;display:flex;align-items:center;justify-content:center;font-size:10px;color:${mastery!=='Not taught'?'var(--primary-contrast)':'var(--text3)'}">${dot}</div>
          </td>`;
        }).join('');

        const descRow = `<tr style="background:${getStripedRowSurface(ci)}"
          onmouseenter="showCoverageTooltip(event,'${c.Code}','${fullDesc}','${c.Subject||''}','${c.Strand||''}')"
          onmouseleave="hideCoverageTooltip()">
          <td style="padding:7px 10px;border-bottom:1px solid var(--border);position:sticky;left:0;background:${getStripedRowSurface(ci)}">
            <div style="display:flex;align-items:flex-start;gap:6px">
              <span data-cv-action="toggleDescIC" data-cv-value="${c.Code}" title="${descOpen?'Hide':'Show'} ICs"
                style="cursor:pointer;color:var(--text3);font-size:9px;line-height:1.7;user-select:none;flex-shrink:0">${descOpen?'▼':'▶'}</span>
              <div style="flex:1;min-width:0">
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:${col}">${c.Code}</div>
                <div style="font-size:11px;color:var(--text3);max-width:220px">${truncateWithTooltip(c.Descriptor||c.Aspect||'—', 42, '', true)}</div>
              </div>
            </div>
          </td>
          ${cells}
          <td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap">
            <span style="font-family:'DM Mono',monospace;font-size:9px;color:${gapCount>0?'var(--rust)':'var(--green)'}">${taughtCount}/${students.length}</span>
          </td>
        </tr>`;

        // IC sub-rows — one per IC belonging to this descriptor, shown when expanded
        let icRows = '';
        if (descOpen) {
          const dICs = getICsForDescriptor(c.Code);
          if (!dICs.length) {
            icRows = `<tr style="background:${getStripedRowSurface(ci)}">
              <td colspan="${students.length + 2}" style="padding:4px 10px 4px 30px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text3);font-style:italic">No ICs for this descriptor</td>
            </tr>`;
          } else {
            icRows = dICs.map(ic => {
              const icCells = students.map(s => {
                const cs = icCellStyle(s, ic);
                return `<td style="padding:3px;text-align:center;border-bottom:1px solid var(--border);border-right:1px solid var(--border)" title="${s.first_name} ${s.last_name} · ${cs.title}">
                  <div style="width:22px;height:22px;border-radius:4px;background:${cs.bg};margin:auto"></div>
                </td>`;
              }).join('');
              return `<tr style="background:${getStripedRowSurface(ci)}">
                <td style="padding:4px 10px 4px 30px;border-bottom:1px solid var(--border);position:sticky;left:0;background:${getStripedRowSurface(ci)}">
                  <div style="font-size:10px;color:var(--text-muted);max-width:220px">${escapeHtml(ic.name || ic.id)}</div>
                </td>
                ${icCells}
                <td style="border-bottom:1px solid var(--border)"></td>
              </tr>`;
            }).join('');
          }
        }

        return descRow + icRows;
      }).join('');
      return strandRow + codeRows;
    }).join('');

    // Legend — rendered above the table so it stays visible when IC sub-rows are expanded
    const legend = `<div style="display:flex;gap:16px;padding:10px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap;align-items:center">
      <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em">Legend</span>
      ${[
        ['●','var(--green)','Achieved'],
        ['◐','var(--gold)','Developing'],
        ['○','var(--rust)','Emerging'],
        ['·','var(--blue)','Taught · not assessed'],
        [' ','var(--surface-alt)','Not taught yet'],
      ].map(([dot,bg,label]) => `<div style="display:flex;align-items:center;gap:6px">
        <div style="width:18px;height:18px;border-radius:3px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:10px;color:${bg==='var(--surface-alt)'?'var(--text3)':'var(--primary-contrast)'}">${dot}</div>
        <span style="font-size:11px;color:var(--text3)">${label}</span>
      </div>`).join('')}
    </div>`;

    return `${legend}
    <div style="overflow:auto;max-height:calc(100vh - 200px)">
      <table style="border-collapse:collapse;min-width:${250+students.length*26}px">
        <thead style="position:sticky;top:0;z-index:5;background:var(--surface)">
          <tr>
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);position:sticky;left:0;background:var(--surface);z-index:6;min-width:220px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase">Code</th>
            ${studentHeaders}
            <th style="padding:6px 10px;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;text-align:right">Taught</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
  }

  // Strands for the selected subject
  const availStrands = cf.subject !== 'all'
    ? [...new Set(state.curriculumCodes.filter(c => c.Subject === cf.subject && isCurriculumCodeEnabled(c)).map(c => c.Strand).filter(Boolean))].sort()
    : [];

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:8px;padding:14px 24px">
      <div class="topbar-title">Coverage Gaps</div>
      <!-- Summary stats -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text3)">
          <span style="color:${col};font-weight:700">${taughtCells}</span>/${totalCells} taught
          &nbsp;·&nbsp;
          <span style="color:var(--green);font-weight:700">${achievedCells}</span> achieved
          &nbsp;·&nbsp;
          <span style="color:var(--rust);font-weight:700">${gapCodes.length}</span> codes never taught
        </span>
      </div>
      <div style="width:100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:2px">
        <!-- Subject -->
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">SUBJECT</span>
        ${availSubjects.map(s => fBtn(subjectShort(s), cf.subject===s, 'subject', s)).join('')}
        <div style="width:1px;height:18px;background:var(--border2)"></div>
        <!-- Year -->
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">YEAR</span>
        ${['all','F','1','2','3','4','5','6'].map(y => fBtn(y==='all'?'All':'Yr '+y, cf.year===y, 'year', y)).join('')}
        <div style="width:1px;height:18px;background:var(--border2)"></div>
        <!-- Mode -->
        ${fBtn('All codes',    cf.mode==='all',        'mode', 'all')}
        ${fBtn('⚠ Gaps only', cf.mode==='not-taught', 'mode', 'not-taught')}
        <div style="width:1px;height:18px;background:var(--border2)"></div>
        <!-- Global IC drill-down toggle — distinct action-button styling, not a filter -->
        <button data-cv-action="expandAllICs" data-cv-value="toggle"
          title="${state.coverageExpandAll ? 'Collapse all ICs' : 'Expand all ICs'}" aria-label="${state.coverageExpandAll ? 'Collapse all ICs' : 'Expand all ICs'}"
          style="padding:5px 12px;border-radius:4px;cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;white-space:nowrap;${state.coverageExpandAll
            ? `background:${col};border:1px solid ${col};color:#fff`
            : 'background:none;border:1px solid var(--blue);color:var(--blue)'}">${state.coverageExpandAll ? '▼ Collapse all ICs' : '▶ Expand all ICs'}</button>
      </div>
      <!-- Strand filter row — only shown when a subject is selected -->
      ${availStrands.length > 0 ? `
      <div style="width:100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding-top:6px;border-top:1px solid var(--border)">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">STRAND</span>
        ${fBtn('All strands', cf.strand==='all', 'strand', 'all')}
        ${availStrands.map(st => fBtn(st, cf.strand===st, 'strand', st)).join('')}
      </div>` : ''}
    </div>
    <div style="padding:0">
      <div class="card" style="border-radius:0;border-left:none;border-right:none;border-top:none">
        ${state.curriculumCodes.length === 0
          ? `<div class="empty-state" style="padding:60px"><div class="empty-icon">◈</div><div class="empty-title">Curriculum data not loaded</div></div>`
          : buildGrid()}
      </div>
    </div>
  `;
}



// ════════════════════════════════════════════════════
// ── STANDARDS JUDGMENTS VIEW ──
// Rate students against achievement standards using
// the school's configurable assessment scale
// ════════════════════════════════════════════════════

function renderStandardsJudgments(main) {
  if (!state.sjFilter) state.sjFilter = { subject: 'English', year: 'all', period: '' };
  const sf = state.sjFilter;
  const scale = getScale();

  const availSubjects = getEnabledSubjectsFromRows(state.standards);
  if (!availSubjects.includes(sf.subject)) sf.subject = availSubjects[0] || 'English';
  const col = subjectCol(sf.subject);

  // Filter standards to selected subject + year
  let visibleStandards = state.standards.filter(s => {
    if (sf.subject !== 'all' && s.Subject !== sf.subject) return false;
    if (sf.year !== 'all' && (s['Year Level']||'') !== (YLM[sf.year]||sf.year)) return false;
    return true;
  });

  // Filter students
  const students = sortStudents(state.students.filter(s => sf.year === 'all' || normaliseYear(s.year_level) === sf.year));

  function fBtn(label, active, action, value) {
    return `<button data-sj-action="${action}" data-sj-value="${value}"
      title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"
      style="padding:5px 11px;border-radius:4px;border:1px solid ${active?col:'var(--border2)'};background:${active?col+'22':'none'};color:${active?col:'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap">${label}</button>`;
  }

  // Build the judgment grid
  function buildGrid() {
    if (!visibleStandards.length) return `<div class="empty-state" style="padding:60px"><div class="empty-icon">◇</div><div class="empty-title">No standards match this filter</div><div class="empty-sub">Load your standards CSV and select a subject/year</div></div>`;
    if (!students.length) return `<div class="empty-state" style="padding:60px"><div class="empty-icon">◎</div><div class="empty-title">No students in this year level</div></div>`;

    // Check if any standards have linked codes at all
    const anyLinked = visibleStandards.some(std => {
      const sid = std['Achievement Standard ID'] || std['Aspect ID'] || '';
      return state.curriculumCodes.some(c =>
        (c['Linked Achievement IDs'] || c['Linked Aspect IDs'] || '').split(',').map(x=>x.trim()).includes(sid)
      );
    });

    const stdHeaders = visibleStandards.map(std => {
      const sid = std['Achievement Standard ID'] || std['Aspect ID'] || '';
      const readyCount = students.filter(s => getStandardReadiness(s.id, sid).pct >= 60).length;
      const hasLinks = !getStandardReadiness(students[0]?.id || '', sid).noLinks;
      return `<th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border);min-width:170px;max-width:220px;vertical-align:bottom;border-left:1px solid var(--border)">
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:${col};margin-bottom:3px">${sid}</div>
        <div style="font-size:9px;color:var(--text-muted);line-height:1.3;margin-bottom:4px">${truncateWithTooltip(std['Standard Text']||'—', 80, 'tt-block', true)}</div>
        ${readyCount > 0 ? `<div style="font-size:9px;color:var(--gold)">⚡ ${readyCount} student${readyCount>1?'s':''} ready</div>` : ''}
        ${!hasLinks ? `<div style="font-size:9px;color:var(--text3);font-style:italic">No linked codes in CSV</div>` : ''}
      </th>`;
    }).join('');

    const rows = students.map((s, si) => {
      // Summary: how many standards judged for this student
      const judgedCount  = visibleStandards.filter(std => {
        const sid = std['Achievement Standard ID'] || std['Aspect ID'] || '';
        return getJudgmentForStudent(s.id, sid);
      }).length;
      const lockedCount  = visibleStandards.filter(std => {
        const sid = std['Achievement Standard ID'] || std['Aspect ID'] || '';
        const j = getJudgmentForStudent(s.id, sid);
        return j?.locked;
      }).length;

      const cells = visibleStandards.map(std => {
        const sid = std['Achievement Standard ID'] || std['Aspect ID'] || '';
        const j = getJudgmentForStudent(s.id, sid);
        const readiness = getStandardReadiness(s.id, sid);
        const scaleItem = j ? getScaleItem(j.judgment) : null;
        const isLocked  = j?.locked || false;

        return `<td style="padding:6px 8px;border-bottom:1px solid var(--border);border-left:1px solid var(--border);vertical-align:top">
          <!-- Readiness bar — only show if there are linked codes -->
          ${!readiness.noLinks ? `<div style="height:3px;background:var(--surface-alt);border-radius:2px;margin-bottom:4px;overflow:hidden">
            <div style="height:100%;width:${readiness.pct}%;background:${readiness.pct>=60?'var(--gold)':'var(--border2)'};border-radius:2px"></div>
          </div>` : ''}
          <!-- Judgment button — disabled if locked -->
          <button ${isLocked ? '' : `data-sj-open="${s.id}|${sid}"`}
            title="${escapeHtml(scaleItem ? scaleItem.label : 'Rate this standard')}"
            style="width:100%;padding:7px 8px;border-radius:4px;border:1px solid ${scaleItem?scaleItem.colour:'var(--border2)'};background:${scaleItem?scaleItem.bg:'none'};color:${scaleItem?scaleItem.colour:'var(--text3)'};font-size:9px;cursor:${isLocked?'default':'pointer'};text-align:left;display:flex;align-items:center;gap:4px;opacity:${isLocked?'0.85':'1'}">
            ${isLocked ? '<span style="font-size:8px" title="Locked for reporting">🔒</span>' : ''}
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${truncateWithTooltip(scaleItem ? scaleItem.label : '— Rate', 20)}</span>
          </button>
          ${j?.date ? `<div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text3);margin-top:2px">${j.date}</div>` : ''}
          ${isLocked ? '' : ''}
        </td>`;
      }).join('');

      return `<tr style="background:${getStripedRowSurface(si)}">
        <td style="padding:8px 10px;border-bottom:1px solid var(--border);position:sticky;left:0;background:${getStripedRowSurface(si)};min-width:170px">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="sc-avatar ${getAvClass(si)}" style="width:24px;height:24px;font-size:10px;flex-shrink:0;cursor:pointer" onclick="openStudentDetail('${s.id}')">${getInitials(s)}</div>
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--text);cursor:pointer" onclick="openStudentDetail('${s.id}')">${s.first_name} ${s.last_name}</div>
              <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">
                ${judgedCount}/${visibleStandards.length} judged
                ${lockedCount > 0 ? `· 🔒 ${lockedCount} locked` : ''}
              </div>
            </div>
          </div>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    return `
      ${!anyLinked ? `<div style="padding:10px 16px;background:var(--gold-dim);border-bottom:1px solid var(--gold);font-size:12px;color:var(--gold)">
        ⚠ No curriculum codes in your CSV have Linked Achievement IDs — readiness tracking is unavailable. Check your Content Descriptors CSV has a "Linked Achievement IDs" column.
      </div>` : ''}
      <div style="overflow:auto;max-height:calc(100vh - 220px)">
        <table style="border-collapse:collapse;min-width:${180+visibleStandards.length*170}px">
          <thead style="position:sticky;top:0;z-index:5;background:var(--surface)">
            <tr style="background:var(--surface-alt)">
              <th style="padding:9px 11px;text-align:left;border-bottom:1px solid var(--border);position:sticky;left:0;background:var(--surface-alt);z-index:6;min-width:160px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase">Student</th>
              ${stdHeaders}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <!-- Scale legend -->
      <div style="display:flex;gap:10px;padding:10px 16px;border-top:1px solid var(--border);flex-wrap:wrap;align-items:center">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em">Scale</span>
        ${scale.map(s => `<div style="display:flex;align-items:center;gap:5px">
          <div style="width:10px;height:10px;border-radius:2px;background:${s.bg};border:1px solid ${s.colour}"></div>
          <span style="font-size:10px;color:${s.colour}">${s.label}</span>
        </div>`).join('')}
        <div style="margin-left:auto;font-size:10px;color:var(--text3)">⚡ ≥60% linked codes taught · 🔒 locked for reporting</div>
      </div>`;
  }

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:8px;padding:14px 24px">
      <div class="topbar-title">Standards Judgments</div>
      <div style="width:100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">SUBJECT</span>
        ${availSubjects.map(s => fBtn(subjectShort(s), sf.subject===s, 'subject', s)).join('')}
        <div style="width:1px;height:18px;background:var(--border2)"></div>
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">YEAR</span>
        ${['all','F','1','2','3','4','5','6'].map(y => fBtn(y==='all'?'All':'Yr '+y, sf.year===y, 'year', y)).join('')}
        <div style="width:1px;height:18px;background:var(--border2)"></div>
        <button onclick="showView('admin')" style="padding:4px 10px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">⚙ Configure Scale</button>
      </div>
    </div>
    <div class="card" style="border-radius:0;border-left:none;border-right:none;border-top:none">
      ${state.standards.length === 0
        ? `<div class="empty-state" style="padding:60px"><div class="empty-icon">◇</div><div class="empty-title">Standards not loaded</div><div class="empty-sub">Load your Achievement Standards CSV in Data &amp; Settings</div></div>`
        : buildGrid()}
    </div>
  `;
}

// ── JUDGMENT PICKER MODAL ──
function openJudgmentPicker(studentId, standardId) {
  const s    = state.students.find(x => x.id === studentId);
  const std  = state.standards.find(x => (x['Achievement Standard ID']||x['Aspect ID']||'') === standardId);
  const j    = getJudgmentForStudent(studentId, standardId);
  const scale = getScale();
  const readiness = getStandardReadiness(studentId, standardId);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:580px;max-width:95vw">
      <div class="modal-head">
        <div>
          <div class="modal-title">${s ? s.first_name+' '+s.last_name : ''}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--gold);margin-top:3px">${standardId}</div>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <!-- Standard text -->
        <div style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:14px;padding:10px 12px;background:var(--surface-alt);border-radius:6px;border-left:3px solid var(--gold)">
          ${std ? std['Standard Text'] : 'Standard text not available'}
        </div>

        <!-- Evidence panel: linked codes -->
        <div style="margin-bottom:14px">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">
            Evidence — ${readiness.taught}/${readiness.total} linked codes taught
            <span style="margin-left:8px;color:${readiness.pct>=60?'var(--gold)':'var(--text3)'}">${readiness.pct}% coverage</span>
          </div>
          <!-- Readiness bar -->
          <div style="height:6px;background:var(--surface-alt);border-radius:3px;margin-bottom:8px;overflow:hidden">
            <div style="height:100%;width:${readiness.pct}%;background:${readiness.pct>=60?'var(--gold)':'var(--border2)'};border-radius:3px;transition:width 0.3s"></div>
          </div>
          <!-- Code mastery breakdown -->
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${(readiness.codes||[]).map(c => {
              const m = getMasteryForCode(studentId, c.Code);
              const t = wasCodeTaughtToStudent(studentId, c.Code);
              const col = m==='Achieved'?'var(--green)':m==='Developing'?'var(--gold)':m==='Emerging'?'var(--rust)':t?'var(--blue)':'var(--text3)';
              const bg  = m==='Achieved'?'var(--green-dim)':m==='Developing'?'var(--gold-dim)':m==='Emerging'?'var(--rust-dim)':t?'var(--blue-dim)':'var(--surface-alt)';
              return `<div style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 7px;border-radius:3px;background:${bg};color:${col}" title="${m}">${c.Code}</div>`;
            }).join('')}
            ${!readiness.codes?.length ? '<span style="font-size:11px;color:var(--text3)">No linked codes found</span>' : ''}
          </div>
        </div>

        <!-- Scale picker -->
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Judgment</div>
        <div style="display:flex;flex-direction:column;gap:6px" id="judgment-scale">
          ${scale.map(item => {
            const active = j && j.judgment === item.id;
            return `<button onclick="selectJudgment('${item.id}')"
              id="jscale-${item.id}"
              style="padding:10px 14px;border-radius:6px;border:2px solid ${active?item.colour:'var(--border2)'};background:${active?item.bg:'none'};
              text-align:left;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:10px">
              <div style="width:12px;height:12px;border-radius:50%;background:${active?item.colour:'var(--border2)'};flex-shrink:0"></div>
              <div>
                <div style="font-size:13px;font-weight:600;color:${active?item.colour:'var(--text-muted)'}">${item.label}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:1px">${item.description}</div>
              </div>
            </button>`;
          }).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Date assessed</label>
            <input class="form-input" type="date" id="j-date" value="${j?.date || new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Reporting period (optional)</label>
            <input class="form-input" id="j-period" placeholder="e.g. Semester 1 2026" value="${j?.period||''}">
          </div>
        </div>
        <div class="form-group" style="margin-top:12px;margin-bottom:0">
          <label class="form-label">Notes (optional)</label>
          <textarea class="form-textarea" id="j-notes" placeholder="Teacher observations, evidence notes…" style="min-height:60px">${j?.notes||''}</textarea>
        </div>
      </div>
      <div class="modal-foot" style="justify-content:space-between">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text-muted)">
          <input type="checkbox" id="j-locked" ${j?.locked?'checked':''} style="accent-color:var(--gold)">
          🔒 Lock for reporting
        </label>
        <div style="display:flex;gap:8px">
          <button class="btn" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="submitJudgment('${studentId}','${standardId}')">Save Judgment</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function selectJudgment(itemId) {
  document.querySelectorAll('[id^="jscale-"]').forEach(btn => {
    const scale = getScale();
    const item = scale.find(s => `jscale-${s.id}` === btn.id);
    if (!item) return;
    const active = item.id === itemId;
    btn.style.borderColor  = active ? item.colour : 'var(--border2)';
    btn.style.background   = active ? item.bg : 'none';
    const dot = btn.querySelector('div');
    if (dot) dot.style.background = active ? item.colour : 'var(--border2)';
    const label = btn.querySelectorAll('div')[1]?.querySelector('div');
    if (label) label.style.color = active ? item.colour : 'var(--text-muted)';
    btn.dataset.selected = active ? 'true' : '';
  });
  document.getElementById('judgment-scale').dataset.selected = itemId;
}

async function submitJudgment(studentId, standardId) {
  const selected = document.getElementById('judgment-scale')?.dataset.selected;
  if (!selected) { toast('Please select a judgment', 'error'); return; }
  const date   = document.getElementById('j-date')?.value || new Date().toISOString().split('T')[0];
  const notes  = document.getElementById('j-notes')?.value || '';
  const period = document.getElementById('j-period')?.value || '';
  const locked = document.getElementById('j-locked')?.checked || false;
  closeModal();
  setSyncing(true);
  const result = await saveStandardsJudgment({ student_id:studentId, standard_id:standardId, judgment:selected, date, notes, period, locked });
  setSyncing(false);
  if (result?.success) {
    toast('Judgment saved', 'success');
    renderView();
  } else {
    toast('Could not save judgment', 'error');
  }
}

// ════════════════════════════════════════════════════
// ── PROGRESSION PLACEMENT VIEW ──
// ════════════════════════════════════════════════════

function renderProgressionPlacement(main) {
  if (!state.ppFilter) state.ppFilter = { type: 'literacy', element: '', year: 'all' };
  const ppf = state.ppFilter;
  const progs = ppf.type === 'numeracy' ? state.numeracyProgressions : state.progressions;
  const elements = [...new Set(progs.map(p => p.Element).filter(Boolean))];
  const activeElement = ppf.element || elements[0] || '';
  const subElements = [...new Set(progs.filter(p => p.Element === activeElement).map(p => p['Sub-element']).filter(Boolean))].sort();

  // Filter students by year
  const students = sortStudents(state.students.filter(s => ppf.year === 'all' || normaliseYear(s.year_level) === ppf.year));

  function buildPlacementTable() {
    if (!progs.length) return `<div class="empty-state" style="padding:60px"><div class="empty-icon">⟡</div><div class="empty-title">${ppf.type === 'numeracy' ? 'Numeracy' : 'Literacy'} progressions not loaded</div><div class="empty-sub">Load your progressions CSV from Admin</div></div>`;
    if (!subElements.length) return `<div class="empty-state" style="padding:60px"><div class="empty-icon">⟡</div><div class="empty-title">Select an element above</div></div>`;
    if (!students.length) return `<div class="empty-state" style="padding:60px"><div class="empty-icon">◎</div><div class="empty-title">No students in this year level</div></div>`;

    return subElements.map(subEl => {
      const items = progs.filter(p => p.Element === activeElement && p['Sub-element'] === subEl);
      const levels = [...new Set(items.map(p => String(p['Progression level'])).filter(Boolean))]
        .sort((a,b) => Number(a) - Number(b));

      // Class summary row — count students at each level
      const levelCounts = {};
      levels.forEach(l => { levelCounts[l] = 0; });
      students.forEach(s => {
        const p = getPlacementForStudent(s.id, activeElement, subEl);
        if (p && levelCounts[String(p.level)] !== undefined) levelCounts[String(p.level)]++;
      });
      const placedCount = students.filter(s => getPlacementForStudent(s.id, activeElement, subEl)).length;

      const studentRows = students.map((s, si) => {
        const placement = getPlacementForStudent(s.id, activeElement, subEl);
        const currentLevel = placement ? String(placement.level) : null;
        const currentIdx   = currentLevel ? levels.indexOf(currentLevel) : -1;
        const nextLevel    = currentIdx >= 0 && currentIdx < levels.length - 1 ? levels[currentIdx + 1] : null;
        const nextIndicator = nextLevel
          ? items.find(i => String(i['Progression level']) === nextLevel)
          : null;

        // Encode element and subElement safely as data attributes
        return `<tr style="background:${getStripedRowSurface(si)}">
          <td style="padding:8px 10px;border-bottom:1px solid var(--border);position:sticky;left:0;background:${getStripedRowSurface(si)}">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="sc-avatar ${getAvClass(si)}" style="width:24px;height:24px;font-size:10px;flex-shrink:0;cursor:pointer" onclick="openStudentDetail('${s.id}')">${getInitials(s)}</div>
              <div style="font-size:12px;font-weight:600;cursor:pointer" onclick="openStudentDetail('${s.id}')">${s.first_name} ${s.last_name}</div>
            </div>
          </td>
          <!-- Current level -->
          <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:center">
            <button data-pp-open="${s.id}"
              data-pp-element="${activeElement.replace(/"/g,'&quot;')}"
              data-pp-subelement="${subEl.replace(/"/g,'&quot;')}"
              style="padding:4px 12px;border-radius:4px;border:1px solid ${currentLevel?'var(--purple)':'var(--border2)'};background:${currentLevel?'var(--purple-dim)':'none'};color:${currentLevel?'var(--purple)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;font-weight:700">
              ${currentLevel ? 'L'+currentLevel : '— Set'}
            </button>
            ${placement?.date ? `<div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text3);margin-top:2px">${placement.date}</div>` : ''}
          </td>
          <!-- Next step -->
          <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-muted);line-height:1.4;max-width:320px">
            ${nextIndicator
              ? `<span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--teal);background:var(--teal-dim);padding:1px 5px;border-radius:3px;margin-right:5px">L${nextLevel} next</span>${nextIndicator['Indicator text (no examples)']||nextIndicator['Indicator text (verbatim)']||''}`
              : currentLevel
                ? `<span style="color:var(--green);font-size:10px">✓ At highest level</span>`
                : `<span style="color:var(--text3);font-size:10px">Set a level to see next step</span>`}
          </td>
          <!-- External level -->
          <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:center">
            ${placement?.ext_value
              ? `<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--gold)" title="${placement.ext_label||''}">${placement.ext_value}</span>`
              : `<span style="color:var(--text3);font-size:10px">—</span>`}
          </td>
        </tr>`;
      }).join('');

      return `<div style="margin-bottom:20px">
        <div style="padding:8px 14px;background:var(--surface-alt);font-family:'DM Mono',monospace;font-size:10px;color:var(--purple);text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span>${subEl} · ${levels.length} levels</span>
            <span style="color:var(--text3);font-size:9px;text-transform:none;letter-spacing:0">${placedCount}/${students.length} students placed</span>
          </div>
          <!-- Class distribution bar -->
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            ${levels.map(l => {
              const count = levelCounts[l] || 0;
              const pct   = students.length ? Math.round(count/students.length*100) : 0;
              return count > 0 ? `<div style="display:flex;align-items:center;gap:3px" title="L${l}: ${count} students">
                <span style="font-size:8px;color:var(--text3)">L${l}</span>
                <div style="height:12px;width:${Math.max(pct*1.2,8)}px;background:var(--purple);border-radius:2px;opacity:0.7"></div>
                <span style="font-size:8px;color:var(--text3)">${count}</span>
              </div>` : '';
            }).join('')}
            ${placedCount < students.length ? `<span style="font-size:9px;color:var(--text3)">${students.length-placedCount} not yet placed</span>` : ''}
          </div>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:600px">
            <thead>
              <tr style="background:var(--surface-alt)">
                <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border);position:sticky;left:0;background:var(--surface-alt);font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;min-width:160px">Student</th>
                <th style="padding:8px 10px;text-align:center;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);text-transform:uppercase;width:100px">Current Level</th>
                <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);text-transform:uppercase">Next Step Indicator</th>
                <th style="padding:8px 10px;text-align:center;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);text-transform:uppercase;width:100px">External</th>
              </tr>
            </thead>
            <tbody>${studentRows}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');
  }

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:8px;padding:14px 24px">
      <div class="topbar-title">Progression Placement</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto">
        <button data-pp-type="literacy"
          style="padding:4px 12px;border-radius:4px;border:1px solid ${ppf.type==='literacy'?'var(--blue)':'var(--border2)'};background:${ppf.type==='literacy'?'var(--blue-dim)':'none'};color:${ppf.type==='literacy'?'var(--blue)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">✦ Literacy</button>
        <button data-pp-type="numeracy"
          style="padding:4px 12px;border-radius:4px;border:1px solid ${ppf.type==='numeracy'?'var(--green)':'var(--border2)'};background:${ppf.type==='numeracy'?'var(--green-dim)':'none'};color:${ppf.type==='numeracy'?'var(--green)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">∑ Numeracy</button>
        <div style="width:1px;height:18px;background:var(--border2)"></div>
        ${['all','F','1','2','3','4','5','6'].map(yr => `<button data-pp-year="${yr}"
          style="padding:4px 10px;border-radius:4px;border:1px solid ${ppf.year===yr?'var(--purple)':'var(--border2)'};background:${ppf.year===yr?'var(--purple-dim)':'none'};color:${ppf.year===yr?'var(--purple)':'var(--text3)'};font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">
          ${yr==='all'?'All':'Yr '+yr}
        </button>`).join('')}
      </div>
    </div>
    <!-- Element tabs -->
    <div style="padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface);display:flex;gap:6px;flex-wrap:wrap">
      ${elements.map(el => `<button data-pp-element="${el.replace(/"/g,'&quot;')}"
        style="padding:5px 12px;border-radius:4px;border:1px solid ${activeElement===el?'var(--purple)':'var(--border2)'};background:${activeElement===el?'var(--purple-dim)':'none'};color:${activeElement===el?'var(--purple)':'var(--text3)'};font-size:12px;cursor:pointer">
        ${el}
      </button>`).join('')}
    </div>
    <div class="content">
      ${!progs.length
        ? `<div class="empty-state" style="padding:60px"><div class="empty-icon">⟡</div><div class="empty-title">No ${ppf.type} progressions loaded</div></div>`
        : buildPlacementTable()}
    </div>
  `;
}

// ── PLACEMENT PICKER MODAL ──
function openPlacementPicker(studentId, element, subElement) {
  const s = state.students.find(x => x.id === studentId);
  const progs = state.ppFilter?.type === 'numeracy' ? state.numeracyProgressions : state.progressions;
  const items = progs.filter(p => p.Element === element && p['Sub-element'] === subElement);
  const levels = [...new Set(items.map(p => p['Progression level']).filter(Boolean))].sort((a,b) => Number(a)-Number(b));
  const placement = getPlacementForStudent(studentId, element, subElement);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:560px;max-width:95vw">
      <div class="modal-head">
        <div>
          <div class="modal-title">${s ? s.first_name+' '+s.last_name : ''}</div>
          <div style="font-size:11px;color:var(--purple);margin-top:2px">${element} · ${subElement}</div>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">Select current progression level</div>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto" id="pp-levels">
          ${levels.map(lvl => {
            const indicator = items.find(i => String(i['Progression level']) === String(lvl));
            const active = placement && String(placement.level) === String(lvl);
            return `<button onclick="selectPlacementLevel('${lvl}')" id="pplvl-${lvl}"
              style="padding:10px 12px;border-radius:6px;border:2px solid ${active?'var(--purple)':'var(--border2)'};background:${active?'var(--purple-dim)':'none'};text-align:left;cursor:pointer;transition:all 0.15s">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--purple);background:var(--purple-dim);padding:1px 7px;border-radius:3px;font-weight:700">L${lvl}</span>
                <span style="font-size:9px;color:var(--text3)">${indicator?.['Indicator ID']||''}</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);line-height:1.4">${indicator?.['Indicator text (no examples)']||indicator?.['Indicator text (verbatim)']||'—'}</div>
            </button>`;
          }).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">External level label</label>
            <input class="form-input" id="pp-ext-label" placeholder="e.g. PM Level, PAT Score" value="${placement?.ext_label||''}">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">External level value</label>
            <input class="form-input" id="pp-ext-value" placeholder="e.g. 18, 4A" value="${placement?.ext_value||''}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Date assessed</label>
            <input class="form-input" type="date" id="pp-date" value="${placement?.date||new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Notes</label>
            <input class="form-input" id="pp-notes" placeholder="Optional notes" value="${placement?.notes||''}">
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitPlacement('${studentId}','${element.replace(/'/g,"\\'")}','${subElement.replace(/'/g,"\\'")}')">Save Placement</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Store selected level
  modal.dataset.selectedLevel = placement?.level || '';
}

function selectPlacementLevel(lvl) {
  document.querySelectorAll('[id^="pplvl-"]').forEach(btn => {
    const active = btn.id === `pplvl-${lvl}`;
    btn.style.borderColor = active ? 'var(--purple)' : 'var(--border2)';
    btn.style.background  = active ? 'var(--purple-dim)' : 'none';
  });
  const modal = document.getElementById('modal-overlay');
  if (modal) modal.dataset.selectedLevel = lvl;
}

async function submitPlacement(studentId, element, subElement) {
  const modal = document.getElementById('modal-overlay');
  const level = modal?.dataset.selectedLevel;
  if (!level) { toast('Please select a level', 'error'); return; }
  const date      = document.getElementById('pp-date')?.value || new Date().toISOString().split('T')[0];
  const notes     = document.getElementById('pp-notes')?.value || '';
  const extLabel  = document.getElementById('pp-ext-label')?.value || '';
  const extValue  = document.getElementById('pp-ext-value')?.value || '';
  closeModal();
  setSyncing(true);
  const result = await saveProgressionPlacement({ student_id:studentId, element, sub_element:subElement, level, date, notes, ext_label:extLabel, ext_value:extValue });
  setSyncing(false);
  if (result?.success) {
    toast('Placement saved', 'success');
    renderView();
  } else {
    toast('Could not save placement', 'error');
  }
}

// ── DATA EXPORT ──
function downloadCSV(filename, rows) {
  const escape = v => {
    const s = String(v === null || v === undefined ? '' : v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = rows.map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportStudents() {
  const rows = [['id','first_name','last_name','year_level','date_added']];
  state.students.forEach(s => rows.push([s.id, s.first_name, s.last_name, s.year_level, s.date_added]));
  downloadCSV('classtracker_students.csv', rows);
}

function exportProgress() {
  const rows = [['id','student_id','student_name','code','mastery','date','notes']];
  state.progress.forEach(p => {
    const s = state.students.find(x => x.id === p.student_id);
    rows.push([p.id, p.student_id, s ? `${s.first_name} ${s.last_name}` : '', p.code, p.mastery, p.date, p.notes||'']);
  });
  downloadCSV('classtracker_progress.csv', rows);
}

function exportTaughtLog() {
  const rows = [['id','date','student_id','student_name','code','notes']];
  state.taughtLog.forEach(t => {
    const s = state.students.find(x => x.id === t.student_id);
    rows.push([t.id, t.date, t.student_id, s ? `${s.first_name} ${s.last_name}` : '', t.code, t.notes||'']);
  });
  downloadCSV('classtracker_taughtlog.csv', rows);
}

function exportJudgments() {
  const rows = [['id','student_id','student_name','standard_id','judgment','locked','date','period','notes']];
  state.standardsJudgments.forEach(j => {
    const s = state.students.find(x => x.id === j.student_id);
    rows.push([j.id, j.student_id, s ? `${s.first_name} ${s.last_name}` : '', j.standard_id, j.judgment, j.locked ? 'TRUE' : 'FALSE', j.date, j.period||'', j.notes||'']);
  });
  downloadCSV('classtracker_judgments.csv', rows);
}

function exportPlacements() {
  const rows = [['id','student_id','student_name','element','sub_element','level','date','notes','ext_label','ext_value']];
  state.progressionPlacements.forEach(p => {
    const s = state.students.find(x => x.id === p.student_id);
    rows.push([p.id, p.student_id, s ? `${s.first_name} ${s.last_name}` : '', p.element, p.sub_element, p.level, p.date, p.notes||'', p.ext_label||'', p.ext_value||'']);
  });
  downloadCSV('classtracker_placements.csv', rows);
}

function exportAll() {
  exportStudents();
  setTimeout(exportProgress,   200);
  setTimeout(exportTaughtLog,  400);
  setTimeout(exportJudgments,  600);
  setTimeout(exportPlacements, 800);
  toast('Exporting 5 files…', 'info');
}


// ════════════════════════════════════════════════════
// ── CLASS / TEACHER GROUP SETTINGS ──
// ════════════════════════════════════════════════════

function loadClassSettings() {
  function normaliseGroup(g, idx) {
    if (!g || typeof g !== 'object') g = {};
    return {
      id: g.id || ('group_' + idx),
      name: g.name || 'My Class',
      color: g.color || '#4f8ef7',
      disabledSubjects: g.disabledSubjects || {},
      disabledStrands: g.disabledStrands || {},
      disabledAreas: g.disabledAreas || {},
    };
  }

  function fallback() {
    return {
      groups: [normaliseGroup({ id: 'main', name: 'My Class', color: '#4f8ef7' }, 0)],
      activeGroup: 'main'
    };
  }

  try {
    const raw = localStorage.getItem('ct_class_settings');
    if (!raw) return fallback();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.groups) || parsed.groups.length === 0) return fallback();
    const groups = parsed.groups.map((g, idx) => normaliseGroup(g, idx));
    const activeGroup = groups.some(g => g.id === parsed.activeGroup) ? parsed.activeGroup : groups[0].id;
    return { groups, activeGroup };
  } catch(e) {}
  return fallback();
}

function saveClassSettings() {
  try { localStorage.setItem('ct_class_settings', JSON.stringify(state.classSettings)); } catch(e) {}
}

function getActiveGroup() {
  const s = state.classSettings;
  return s.groups.find(g => g.id === s.activeGroup) || s.groups[0];
}

function isStrandEnabled(subject, strand) {
  const g = getActiveGroup();
  if (!g || !strand) return true;
  if (g.disabledSubjects && g.disabledSubjects[subject]) return false;
  const key = subject + '|' + strand;
  return !(g.disabledStrands && g.disabledStrands[key]);
}

function isSubjectEnabled(subject) {
  const g = getActiveGroup();
  if (g && g.disabledSubjects && g.disabledSubjects[subject]) return false;
  const strands = [...new Set(state.curriculumCodes.filter(c => c.Subject === subject).map(c => c.Strand).filter(Boolean))];
  if (!strands.length) return true;
  return strands.some(st => isStrandEnabled(subject, st));
}

function isCurriculumAreaEnabled(subject, strand, area) {
  const g = getActiveGroup();
  if (!g || !area) return isStrandEnabled(subject, strand);
  if (!isStrandEnabled(subject, strand)) return false;
  const key = subject + '|' + strand + '|' + area;
  return !(g.disabledAreas && g.disabledAreas[key]);
}

function isCurriculumCodeEnabled(row) {
  if (!row) return true;
  const subject = row.Subject || '';
  const strand = row.Strand || '';
  const area = row['Sub-strand'] || row['Sub Strand'] || '';
  return isCurriculumAreaEnabled(subject, strand, area);
}

function getEnabledSubjectsFromRows(rows, subjectField = 'Subject') {
  const all = [...new Set((rows || []).map(r => r && r[subjectField]).filter(Boolean))].sort();
  return all.filter(isSubjectEnabled);
}

function saveActiveGroupMeta() {
  const name  = document.getElementById('cs-group-name')?.value?.trim();
  const color = document.getElementById('cs-group-color')?.value;
  const g = getActiveGroup();
  if (!g) return;
  if (name)  g.name  = name;
  if (color) g.color = color;
  saveClassSettings();
  toast('Group updated', 'success');
  renderAdmin(document.getElementById('main-content'));
}

function buildClassSettingsSection() {
  const cs = state.classSettings;
  if (!cs) return '';
  const groups = cs.groups;
  const activeGroup = getActiveGroup();
  const allSubjects = [...new Set(state.curriculumCodes.map(c => c.Subject).filter(Boolean))].sort();

  function groupTab(g) {
    const active = g.id === cs.activeGroup;
    const safeColor = g.color || '#4f8ef7';
    return `<button data-cs-action="setGroup" data-cs-val="${g.id}"
      style="padding:5px 14px;border-radius:6px;border:1px solid ${active ? safeColor : 'var(--border2)'};
      background:${active ? safeColor + '22' : 'none'};color:${active ? safeColor : 'var(--text3)'};
      font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;white-space:nowrap">${g.name}</button>`;
  }

  function subjectBlock(subject) {
    const subjectEnabled = isSubjectEnabled(subject);
    const strands = [...new Set(state.curriculumCodes.filter(c => c.Subject === subject).map(c => c.Strand).filter(Boolean))].sort();
    if (!strands.length) return '';
    const allOn = strands.every(st => isStrandEnabled(subject, st));

    const strandRows = strands.map(strand => {
      const enabled = isStrandEnabled(subject, strand);
      const key = subject + '|' + strand;
      const codeCount = state.curriculumCodes.filter(c => c.Subject === subject && c.Strand === strand).length;
      const areas = [...new Set(
        state.curriculumCodes
          .filter(c => c.Subject === subject && c.Strand === strand)
          .map(c => c['Sub-strand'] || c['Sub Strand'])
          .filter(Boolean)
      )].sort();
      const areaRows = areas.map(area => {
        const areaEnabled = isCurriculumAreaEnabled(subject, strand, area);
        const areaKey = subject + '|' + strand + '|' + area;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0 5px 12px">
          <label style="font-size:11px;color:${areaEnabled ? 'var(--text-muted)' : 'var(--text3)'};display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" data-cs-action="toggleArea" data-cs-key="${areaKey}" ${areaEnabled ? 'checked' : ''}
              style="accent-color:var(--teal)">
            <span>↳ ${area}</span>
          </label>
        </div>`;
      }).join('');
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <label style="font-size:12px;color:${enabled ? 'var(--text)' : 'var(--text3)'};display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" data-cs-action="toggleStrand" data-cs-key="${key}" ${enabled ? 'checked' : ''} ${subjectEnabled ? '' : 'disabled'}
              style="accent-color:var(--green)">
            <span>${strand}</span>
          </label>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-left:8px">${codeCount} codes</span>
          ${areaRows ? `<div style="margin-top:4px">${areaRows}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <label style="font-size:12px;font-weight:700;color:${subjectEnabled ? 'var(--text)' : 'var(--text3)'};text-transform:uppercase;letter-spacing:0.06em;display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" data-cs-action="toggleSubjectEnabled" data-cs-key="${subject}" ${subjectEnabled ? 'checked' : ''}
            style="accent-color:var(--green)">
          <span>${subject}</span>
        </label>
        <div style="display:flex;gap:6px">
        <button data-cs-action="toggleSubject" data-cs-key="${subject}" data-cs-enabled="${allOn}"
          style="padding:2px 10px;border-radius:4px;border:1px solid var(--border2);background:none;
          color:var(--text3);font-family:'DM Mono',monospace;font-size:9px;cursor:pointer">
          ${allOn ? 'Disable all' : 'Enable all'}
        </button>
        </div>
      </div>
      ${strandRows}
    </div>`;
  }

  const noCodesMsg = allSubjects.length === 0
    ? `<div style="color:var(--text3);font-size:12px;padding:16px 0">Load curriculum CSV files first to configure subjects and strands.</div>`
    : '';

  return `<div style="padding:16px 18px">
      <div style="font-size:12.5px;color:var(--text3);margin-bottom:16px">
        Configure which subjects, strands and curriculum areas each teacher or group is responsible for.
        Untick any option to hide it across Dashboard, Class Overview, Student Detail, Bulk Assess, Standards and reports.
        Settings are saved in your browser.
      </div>

      <!-- Group tabs -->
      <div style="margin-bottom:12px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">Groups</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${groups.map(groupTab).join('')}
          <button data-cs-action="addGroup"
            style="padding:5px 10px;border-radius:6px;border:1px dashed var(--border2);background:none;color:var(--text3);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">+ Add Group</button>
          ${groups.length > 1 ? `<button data-cs-action="deleteGroup"
            style="padding:5px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--rust);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">Delete &ldquo;${activeGroup.name}&rdquo;</button>` : ''}
        </div>
      </div>

      <!-- Active group meta -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:10px 12px;background:var(--surface-alt);border-radius:6px;flex-wrap:wrap">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">NAME</span>
        <input id="cs-group-name" value="${activeGroup.name}"
          style="background:var(--surface);border:1px solid var(--border2);border-radius:5px;padding:4px 10px;color:var(--text);font-size:12px;outline:none;width:160px">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">COLOUR</span>
        <input type="color" id="cs-group-color" value="${activeGroup.color || '#4f8ef7'}"
          style="width:32px;height:28px;border:1px solid var(--border2);border-radius:4px;padding:2px;cursor:pointer;background:none">
        <button onclick="saveActiveGroupMeta()" style="padding:4px 12px;border-radius:5px;border:1px solid var(--blue);background:var(--blue-dim);color:var(--blue);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">Save</button>
      </div>

      <!-- Subject/strand toggles -->
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em">
        Subjects &amp; Strands — <span style="color:${activeGroup.color || 'var(--blue)'};">${activeGroup.name}</span>
      </div>
      ${noCodesMsg}
      ${allSubjects.map(subjectBlock).join('')}
    </div>`;
}

function isAdminAccordionOpen(key) {
  if (!state.adminAccordion) {
    state.adminAccordion = {
      classGroups: false,
      appearance: false,
      dataUploads: false,
      assessmentScale: false,
      exportData: false,
      driveBackup: false,
      dataStatus: false,
      sheetsSetup: false,
    };
  }
  return !!state.adminAccordion[key];
}

function buildAdminAccordionSection({ key, title, content }) {
  const open = isAdminAccordionOpen(key);
  return `<div class="card accordion-card ${open ? 'open' : ''}" id="admin-accordion-${key}">
    <div class="card-head">
      <button class="accordion-trigger" type="button" onclick="toggleAdminAccordion('${key}')" aria-expanded="${open}" aria-controls="admin-accordion-panel-${key}">
        <span class="accordion-title">${title}</span>
        <span class="accordion-chevron">▶</span>
      </button>
    </div>
    <div class="accordion-panel" id="admin-accordion-panel-${key}">
      ${content}
    </div>
  </div>`;
}

function toggleAdminAccordion(key) {
  if (!state.adminAccordion) state.adminAccordion = {};
  state.adminAccordion[key] = !state.adminAccordion[key];

  const card = document.getElementById(`admin-accordion-${key}`);
  if (!card) return;
  card.classList.toggle('open', state.adminAccordion[key]);
  const trigger = card.querySelector('.accordion-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', String(state.adminAccordion[key]));
}

function applyClassSettingAction(action, { val, key, enabled, checked } = {}) {
  if (!state.classSettings) return;
  const cs = state.classSettings;

  if (action === 'setGroup') {
    cs.activeGroup = val;
    saveClassSettings();
    renderAdmin(document.getElementById('main-content'));
    return;
  }

  if (action === 'toggleStrand') {
    const g = getActiveGroup();
    if (!g.disabledStrands) g.disabledStrands = {};
    if (checked) delete g.disabledStrands[key];
    else g.disabledStrands[key] = true;
    saveClassSettings();
    renderAdmin(document.getElementById('main-content'));
    return;
  }

  if (action === 'toggleArea') {
    const g = getActiveGroup();
    if (!g.disabledAreas) g.disabledAreas = {};
    if (checked) delete g.disabledAreas[key];
    else g.disabledAreas[key] = true;
    saveClassSettings();
    renderAdmin(document.getElementById('main-content'));
    return;
  }

  if (action === 'toggleSubjectEnabled') {
    const g = getActiveGroup();
    if (!g.disabledSubjects) g.disabledSubjects = {};
    if (checked) delete g.disabledSubjects[key];
    else g.disabledSubjects[key] = true;
    saveClassSettings();
    renderAdmin(document.getElementById('main-content'));
    return;
  }

  if (action === 'toggleSubject') {
    const g = getActiveGroup();
    if (!g.disabledStrands) g.disabledStrands = {};
    const strands = [...new Set(state.curriculumCodes.filter(c => c.Subject === key).map(c => c.Strand).filter(Boolean))];
    if (enabled) strands.forEach(st => { g.disabledStrands[key + '|' + st] = true; });
    else strands.forEach(st => { delete g.disabledStrands[key + '|' + st]; });
    saveClassSettings();
    renderAdmin(document.getElementById('main-content'));
    return;
  }

  if (action === 'addGroup') {
    const name = prompt('Group name (e.g. Specialist — Art):');
    if (!name) return;
    const id = 'group_' + Date.now();
    cs.groups.push({ id, name, color: '#a78bfa', disabledSubjects: {}, disabledStrands: {}, disabledAreas: {} });
    cs.activeGroup = id;
    saveClassSettings();
    renderAdmin(document.getElementById('main-content'));
    return;
  }

  if (action === 'deleteGroup') {
    if (cs.groups.length <= 1) { toast('Cannot delete the only group', 'error'); return; }
    if (!confirm('Delete group "' + getActiveGroup().name + '"?')) return;
    cs.groups = cs.groups.filter(g => g.id !== cs.activeGroup);
    cs.activeGroup = cs.groups[0].id;
    saveClassSettings();
    renderAdmin(document.getElementById('main-content'));
  }
}

// Delegated handler for class settings buttons
document.addEventListener('click', function(e) {
  const el = e.target.closest('[data-cs-action]');
  if (!el || el.matches('input[type="checkbox"]')) return;
  const action  = el.dataset.csAction;
  applyClassSettingAction(action, {
    val: el.dataset.csVal,
    key: el.dataset.csKey,
    enabled: el.dataset.csEnabled === 'true'
  });
});

// Delegated handler for class settings checkbox toggles
document.addEventListener('change', function(e) {
  const el = e.target.closest('input[type="checkbox"][data-cs-action]');
  if (!el) return;
  applyClassSettingAction(el.dataset.csAction, {
    key: el.dataset.csKey,
    checked: !!el.checked
  });
});

// ════════════════════════════════════════════════════
// ── ADMIN VIEW ──
// Configure assessment scale, view system info
// ════════════════════════════════════════════════════

function renderAdmin(main) {
  const scale = getScale();
  const themePreference = normalizeThemePreference(state.themePreference || localStorage.getItem(THEME_STORAGE_KEY) || 'auto');
  const textSizePreference = normalizeTextSizePreference(state.textSizePreference || localStorage.getItem(TEXT_SIZE_STORAGE_KEY) || 'standard');
  const appliedTheme = resolveTheme(themePreference);
  const csvUploadRows = [
    ['Content Descriptors', 'icon-cd', 'nav-load-cd', "loadCurriculumCSV(this)"],
    ['Achievement Standards', 'icon-st', 'nav-load-st', "loadStandardsCSV(this)"],
    ['Literacy Progressions', 'icon-pr', 'nav-load-pr', "loadProgressionsCSV(this,'literacy')"],
    ['Numeracy Progressions', 'icon-np', 'nav-load-np', "loadProgressionsCSV(this,'numeracy')"],
  ];
  const loadedByNavId = {
    'nav-load-cd': state.curriculumCodes.length > 0,
    'nav-load-st': state.standards.length > 0,
    'nav-load-pr': state.progressions.length > 0,
    'nav-load-np': state.numeracyProgressions.length > 0,
    'nav-load-el': state.elaborations.length > 0,
  };

  main.innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Data &amp; Settings</div>
    </div>
    <div class="content">

      <!-- Class & Teacher Groups -->
      ${buildAdminAccordionSection({
        key: 'classGroups',
        title: 'Class &amp; Teacher Groups',
        content: buildClassSettingsSection()
      })}

      <!-- Appearance -->
      ${buildAdminAccordionSection({
        key: 'appearance',
        title: 'Appearance',
        content: `
          <div style="padding:16px 18px">
            <div style="font-size:12.5px;color:var(--text3);margin-bottom:14px">
              Choose how ClassTracker appears for this browser. Auto follows your device setting.
            </div>
            <div class="theme-control" style="max-width:320px">
              <label for="theme-select" class="theme-label">Theme</label>
              <select id="theme-select" class="theme-select" aria-label="Theme">
                <option value="auto" ${themePreference === 'auto' ? 'selected' : ''}>Auto (System)</option>
                <option value="light" ${themePreference === 'light' ? 'selected' : ''}>Light</option>
                <option value="dark" ${themePreference === 'dark' ? 'selected' : ''}>Dark</option>
              </select>
              <div id="theme-current" class="theme-current">
                Current: ${themePreference === 'auto' ? 'Auto (System)' : themePreference[0].toUpperCase() + themePreference.slice(1)} → ${appliedTheme[0].toUpperCase() + appliedTheme.slice(1)}
              </div>
            </div>
            <div class="theme-control" style="max-width:320px;margin-top:10px">
              <label for="text-size-select" class="theme-label">Text size</label>
              <select id="text-size-select" class="theme-select" aria-label="Text size">
                <option value="standard" ${textSizePreference === 'standard' ? 'selected' : ''}>Standard</option>
                <option value="large" ${textSizePreference === 'large' ? 'selected' : ''}>Large</option>
              </select>
              <div id="text-size-current" class="theme-current">
                Current text size: ${textSizePreference === 'large' ? 'Large' : 'Standard'}
              </div>
            </div>
          </div>
        `
      })}

      <!-- Assessment Scale configurator -->
      ${buildAdminAccordionSection({
        key: 'assessmentScale',
        title: 'Assessment Scale',
        content: `
          <div style="padding:16px 18px">
            <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
              <button class="btn" onclick="resetAssessmentScale()">↺ Reset to defaults</button>
            </div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:16px">
              Configure the scale used for Standards Judgments. Changes are saved locally in your browser.
              Each level needs a unique ID (no spaces), a label, and a colour.
            </div>
            <div id="scale-editor">
              ${buildScaleEditor(scale)}
            </div>
            <div style="display:flex;gap:8px;margin-top:14px">
              <button class="btn btn-primary" onclick="saveScaleFromEditor()">✓ Save Scale</button>
              <button class="btn" onclick="addScaleItem()">+ Add Level</button>
            </div>
          </div>
        `
      })}

      <!-- Data / CSV Uploads -->
      ${buildAdminAccordionSection({
        key: 'dataUploads',
        title: 'Data / CSV Uploads',
        content: `
          <div style="padding:14px 18px">
            <div style="font-size:12.5px;color:var(--text3);margin-bottom:16px">
              Upload curriculum CSV files here. Status dots show what has already been loaded in this session.
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
              ${csvUploadRows.map(([label, iconId, navId, handler]) => {
                const loaded = loadedByNavId[navId];
                return `<label class="nav-btn" style="cursor:pointer;font-size:12px;justify-content:flex-start;gap:8px;min-height:40px;color:${loaded ? 'var(--green)' : 'var(--text-muted)'}" id="${navId}">
                  <span class="nav-icon" id="${iconId}" style="color:${loaded ? 'var(--green)' : 'var(--text3)'}">${loaded ? '●' : '○'}</span>
                  <span>${label}</span>
                  <input type="file" accept=".csv" style="display:none" onchange="${handler}">
                </label>`;
              }).join('')}
            </div>
          </div>
        `
      })}

      <!-- Data Export -->
      ${buildAdminAccordionSection({
        key: 'exportData',
        title: 'Export Data',
        content: `
          <div style="padding:14px 18px">
            <div style="font-size:12.5px;color:var(--text3);margin-bottom:16px">Download your data as CSV files for backup or use in other tools.</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              ${[
                ['Students',             'exportStudents',    'var(--blue)'],
                ['Progress records',     'exportProgress',    'var(--green)'],
                ['Taught log',           'exportTaughtLog',   'var(--gold)'],
                ['Standards judgments',  'exportJudgments',   'var(--purple)'],
                ['Progression placements','exportPlacements', 'var(--teal)'],
              ].map(([label, fn, col]) => `<button onclick="${fn}()"
                style="padding:8px 16px;border-radius:6px;border:1px solid ${col};background:none;color:${col};font-family:'Instrument Sans',sans-serif;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px">
                ↓ ${label}
              </button>`).join('')}
              <button onclick="exportAll()"
                style="padding:8px 16px;border-radius:6px;border:none;background:var(--blue);color:var(--primary-contrast);font-family:'Instrument Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer">
                ↓ Export All
              </button>
            </div>
          </div>
        `
      })}

      <!-- Drive Backup -->
      ${buildAdminAccordionSection({
        key: 'driveBackup',
        title: 'Drive Backup',
        content: `
          <div style="padding:14px 18px">
            <div style="font-size:12.5px;color:var(--text3);margin-bottom:14px">
              Unit plans and lessons live only in this browser. A safety-net backup is written to a JSON file
              in your Google Drive automatically every few minutes while the app is open — use the button below
              to back up immediately instead of waiting for the timer.
            </div>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
              <button class="btn btn-primary" type="button" onclick="driveBackupSave()">Backup to Drive now</button>
              <div class="drive-sync-indicator">${driveSyncIndicatorHtml()}</div>
            </div>
          </div>
        `
      })}

      <!-- CSV status -->
      ${buildAdminAccordionSection({
        key: 'dataStatus',
        title: 'Data Status',
        content: `
          <div style="padding:14px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            ${[
              ['Content Descriptors', state.curriculumCodes.length],
              ['Achievement Standards', state.standards.length],
              ['Literacy Progressions', state.progressions.length],
              ['Numeracy Progressions', state.numeracyProgressions.length],
              ['Students', state.students.length],
              ['Progress records', state.progress.length],
              ['Taught log entries', state.taughtLog.length],
              ['Standards judgments', state.standardsJudgments.length],
              ['Progression placements', state.progressionPlacements.length],
            ].map(([label, count]) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface-alt);border-radius:6px">
              <span style="font-size:12px;color:var(--text-muted)">${label}</span>
              <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${count>0?'var(--green)':'var(--text3)'}">${count}</span>
            </div>`).join('')}
            <div id="nav-load-el" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface-alt);border-radius:6px;color:${state.elaborations.length>0?'var(--green)':'var(--text-muted)'}">
              <span style="display:flex;align-items:center;gap:6px;font-size:12px">
                <span id="icon-el" style="color:${state.elaborations.length>0?'var(--green)':'var(--text3)'}">${state.elaborations.length>0?'●':'○'}</span>
                Elaborations
              </span>
              <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${state.elaborations.length>0?'var(--green)':'var(--text3)'}">${state.elaborations.length}</span>
            </div>
          </div>
        `
      })}

      <!-- Apps Script info -->
      ${buildAdminAccordionSection({
        key: 'sheetsSetup',
        title: 'Google Sheets Setup',
        content: `
          <div style="padding:14px 18px;font-size:12px;color:var(--text3);line-height:1.6">
            <p style="margin-bottom:8px">Make sure your Apps Script has been updated with the new <code style="background:var(--surface-alt);padding:1px 5px;border-radius:3px;color:var(--blue)">getStandardsJudgments</code>, <code style="background:var(--surface-alt);padding:1px 5px;border-radius:3px;color:var(--blue)">saveStandardsJudgment</code>, <code style="background:var(--surface-alt);padding:1px 5px;border-radius:3px;color:var(--blue)">getProgressionPlacements</code> and <code style="background:var(--surface-alt);padding:1px 5px;border-radius:3px;color:var(--blue)">saveProgressionPlacement</code> functions.</p>
            <p>Open your browser console (F12) for the complete Apps Script code to copy.</p>
          </div>
        `
      })}

    </div>
  `;
  updateThemeUI(themePreference, appliedTheme);
}

function buildScaleEditor(scale) {
  const COLOURS = ['var(--text3)','var(--rust)','var(--gold)','var(--blue)','var(--green)','var(--teal)','var(--purple)'];
  return scale.map((item, i) => `
    <div style="display:grid;grid-template-columns:auto 1fr 1fr 2fr auto;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:var(--surface-alt);border-radius:6px;border-left:3px solid ${item.colour}">
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);width:20px;text-align:center">${i+1}</div>
      <input class="form-input" value="${item.label}" id="scale-label-${i}" placeholder="Label" style="font-size:12px;padding:5px 8px">
      <select class="form-input" id="scale-colour-${i}" style="font-size:12px;padding:5px 8px">
        ${COLOURS.map(c => `<option value="${c}" ${item.colour===c?'selected':''}>${c.replace('var(--','').replace(')','')}</option>`).join('')}
      </select>
      <input class="form-input" value="${item.description}" id="scale-desc-${i}" placeholder="Description shown to teacher" style="font-size:12px;padding:5px 8px">
      <button onclick="removeScaleItem(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:4px">✕</button>
    </div>
  `).join('');
}

function saveScaleFromEditor() {
  const scale = getScale();
  const newScale = scale.map((item, i) => ({
    id: item.id,
    label:       document.getElementById(`scale-label-${i}`)?.value || item.label,
    colour:      document.getElementById(`scale-colour-${i}`)?.value || item.colour,
    bg:          (document.getElementById(`scale-colour-${i}`)?.value || item.colour).replace(')', '-dim)').replace('var(--','var(--'),
    description: document.getElementById(`scale-desc-${i}`)?.value || item.description,
  }));
  saveAssessmentScale(newScale);
  toast('Scale saved', 'success');
  renderAdmin(document.getElementById('main-content'));
}

function addScaleItem() {
  const scale = getScale();
  scale.push({ id: 'level-'+(scale.length+1), label: 'New Level', colour: 'var(--teal)', bg: 'var(--teal-dim)', description: 'Description' });
  saveAssessmentScale(scale);
  renderAdmin(document.getElementById('main-content'));
}

function removeScaleItem(index) {
  const scale = getScale();
  scale.splice(index, 1);
  saveAssessmentScale(scale);
  renderAdmin(document.getElementById('main-content'));
}

function resetAssessmentScale() {
  saveAssessmentScale(null);
  state.assessmentScale = null;
  try { localStorage.removeItem('ct_assessment_scale'); } catch(e) {}
  toast('Scale reset to defaults', 'success');
  renderAdmin(document.getElementById('main-content'));
}


// ════════════════════════════════════════════════════
// ── DAILY LOG WIZARD ──
// 3-step popup: Attendance → Codes Taught → Quick Mastery
// ════════════════════════════════════════════════════

let dlState = {
  step: 1,           // 1=attendance, 2=codes/ICs, 3=class-scan, 4=quick-mastery (conditional)
  date: '',
  absentIds: new Set(),
  manualCodes: [],    // codes explicitly selected by the teacher via the code list
  selectedCodes: [],  // union of manualCodes + homeDescriptorId of every selected IC
  masteryMap: {},     // key: studentId+'|'+code → 'Achieved'|'Developing'|'Emerging'|null
  selectedICs: [],    // array of ic ids selected via AI IC suggester
  icScanMap: {},        // key: studentId+'|'+icId → 'got_it'|'needs_review' (absent = 'taught')
  selectedScanIC: null, // icId currently selected for bulk actions
  scanSubjectFilter: '',
  selectedSubject: '',
  aiLoading: false,
  readyForMastery: [], // populated after step 3; drives whether step 4 appears
};

// Step 2 expand/IC-search state (reset on each wizard open)
let dlStep2ExpandedCode = null;
let dlStep2ICSearch = '';

function openDailyLogWizard() {
  dlStep2ExpandedCode = null;
  dlStep2ICSearch = '';
  const availSubjects = [...new Set(state.curriculumCodes.map(c => c.Subject).filter(Boolean))].sort();
  dlState = {
    step: 1,
    date: new Date().toISOString().split('T')[0],
    absentIds: new Set(),
    manualCodes: [],
    selectedCodes: [],
    masteryMap: {},
    selectedICs: [],
    icScanMap: {},
    selectedScanIC: null,
    scanSubjectFilter: '',
    selectedSubject: availSubjects[0] || '',
    aiLoading: false,
    readyForMastery: [],
  };
  renderDlModal();
}

function renderDlModal() {
  const existing = document.getElementById('dl-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'dl-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:150;animation:fadeIn 0.15s ease';

  const hasICStep = dlState.selectedICs.length > 0;
  const hasMasteryStep = (dlState.readyForMastery || []).length > 0;
  const steps = ['Attendance', 'Codes / ICs'];
  if (hasICStep) steps.push('IC Outcomes');
  if (hasMasteryStep) steps.push('Quick Mastery');
  const totalSteps = steps.length;

  const stepBar = steps.map((s, i) => {
    const n = i + 1;
    const active  = dlState.step === n;
    const done    = dlState.step > n;
    const col     = done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--text3)';
    const bg      = done ? 'var(--green-dim)' : active ? 'var(--blue-dim)' : 'var(--surface-alt)';
    return `<div style="display:flex;align-items:center;gap:6px;flex:1;${n < totalSteps ? 'margin-right:8px' : ''}">
      <div style="width:22px;height:22px;border-radius:50%;background:${bg};border:1.5px solid ${col};display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:9px;color:${col};flex-shrink:0">${done ? '✓' : n}</div>
      <span style="font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${col}">${s}</span>
      ${n < totalSteps ? `<div style="flex:1;height:1px;background:${done?'var(--green)':'var(--border2)'}"></div>` : ''}
    </div>`;
  }).join('');

  let bodyHtml = '';
  if (dlState.step === 1) bodyHtml = buildDlStep1();
  else if (dlState.step === 2) bodyHtml = buildDlStep2();
  else if (dlState.step === 3) bodyHtml = buildDlStep3();
  else bodyHtml = buildDlStep4();

  let nextLabel;
  if (dlState.step === 1) {
    nextLabel = `Next → Codes / ICs (${state.students.length - dlState.absentIds.size} present)`;
  } else if (dlState.step === 2) {
    nextLabel = dlStep2NextLabel();
  } else if (dlState.step === 3) {
    nextLabel = `Confirm class check →`;
  } else {
    nextLabel = `✓ Save Session`;
  }

  // Modal width: step 3 and 4 get much wider to fit the grids
  const modalWidth = (dlState.step === 3 || dlState.step === 4)
    ? 'width:min(95vw,1100px)'
    : 'width:min(96vw,680px)';

  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:12px;${modalWidth};max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,0.5);animation:slideUp 0.2s ease">
      <!-- Header -->
      <div style="padding:18px 22px 14px;border-bottom:1px solid var(--border);flex-shrink:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-family:'Fraunces',serif;font-size:17px">Log Teaching Session</div>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="date" value="${dlState.date}" onchange="dlState.date=this.value"
              style="background:var(--surface-alt);border:1px solid var(--border2);border-radius:5px;padding:4px 8px;color:var(--text-muted);font-family:'DM Mono',monospace;font-size:11px;outline:none">
            <button onclick="closeDlModal()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;line-height:1">✕</button>
          </div>
        </div>
        <!-- Step bar -->
        <div style="display:flex;align-items:center">${stepBar}</div>
      </div>
      <!-- Body -->
      <div style="flex:1;overflow-y:auto;padding:18px 22px" id="dl-body">
        ${bodyHtml}
      </div>
      <!-- Footer -->
      <div style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:space-between;flex-shrink:0">
        <button onclick="${dlState.step === 1 ? 'closeDlModal()' : 'dlBack()'}" style="padding:8px 18px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text3);font-family:'Instrument Sans',sans-serif;font-size:13px;cursor:pointer">
          ${dlState.step === 1 ? 'Dismiss' : '← Back'}
        </button>
        <div style="display:flex;gap:8px">
          ${''/* class scan (step 3) is not skippable — zero interaction writes all as taught */}
          ${dlState.step === 4 ? `<button onclick="dlSkipQuickMastery()" style="padding:8px 18px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text3);font-family:'Instrument Sans',sans-serif;font-size:13px;cursor:pointer">Skip — do this later</button>` : ''}
          <button onclick="dlNext()" style="padding:8px 20px;border-radius:6px;border:none;background:var(--blue);color:var(--primary-contrast);font-family:'Instrument Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer">
            ${nextLabel}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  // Wire up step-specific events after render
  if (dlState.step === 2) wireDlStep2Events();
}

function closeDlModal() {
  const el = document.getElementById('dl-overlay');
  if (el) el.remove();
}

// ── STEP 1: ATTENDANCE ──
function buildDlStep1() {
  const sorted = sortStudents(state.students);
  const presentCount = sorted.length - dlState.absentIds.size;
  return `
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:14px">Tap any student to mark them <strong style="color:var(--rust)">absent</strong>. Everyone else is present.</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">${presentCount} present · ${dlState.absentIds.size} absent</div>
      <div style="display:flex;gap:6px">
        <button onclick="state.studentSortBy=state.studentSortBy==='last_name'?'first_name':'last_name';document.getElementById('dl-body').innerHTML=buildDlStep1()"
          style="padding:3px 10px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer">
          ${state.studentSortBy === 'last_name' ? '↕ Last, First' : '↕ First, Last'}
        </button>
        <button onclick="dlMarkAll(false)" style="padding:3px 10px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer">All present</button>
        <button onclick="dlMarkAll(true)" style="padding:3px 10px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer">All absent</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px" id="dl-attendance-grid">
      ${sorted.map((s,i) => {
        const absent = dlState.absentIds.has(s.id);
        return `<div onclick="dlToggleAbsent('${s.id}')" id="dl-att-${s.id}"
          style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;border:1.5px solid ${absent?'var(--rust)':'var(--border)'};background:${absent?'var(--rust-dim)':'none'};cursor:pointer;transition:all 0.12s;user-select:none">
          <div class="sc-avatar ${getAvClass(i)}" style="width:26px;height:26px;font-size:11px;flex-shrink:0;${absent?'opacity:0.4':''}">${getInitials(s)}</div>
          <div style="font-size:12px;font-weight:600;color:${absent?'var(--rust)':'var(--text)'};line-height:1.2">${s.first_name}<br><span style="font-weight:400;font-size:10px;color:var(--text3)">${s.last_name}</span></div>
          ${absent ? `<div style="margin-left:auto;font-size:10px;color:var(--rust)">✗</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

function dlToggleAbsent(id) {
  if (dlState.absentIds.has(id)) dlState.absentIds.delete(id);
  else dlState.absentIds.add(id);
  // Re-render just the card
  const el = document.getElementById('dl-att-' + id);
  if (!el) return;
  const s = state.students.find(x => x.id === id);
  if (!s) return;
  const i = state.students.indexOf(s);
  const absent = dlState.absentIds.has(id);
  el.style.border = `1.5px solid ${absent ? 'var(--rust)' : 'var(--border)'}`;
  el.style.background = absent ? 'var(--rust-dim)' : 'none';
  el.innerHTML = `
    <div class="sc-avatar ${getAvClass(i)}" style="width:26px;height:26px;font-size:11px;flex-shrink:0;${absent?'opacity:0.4':''}">${getInitials(s)}</div>
    <div style="font-size:12px;font-weight:600;color:${absent?'var(--rust)':'var(--text)'};line-height:1.2">${s.first_name}<br><span style="font-weight:400;font-size:10px;color:var(--text3)">${s.last_name}</span></div>
    ${absent ? `<div style="margin-left:auto;font-size:10px;color:var(--rust)">✗</div>` : ''}
  `;
  // Update footer count
  const footer = document.querySelector('#dl-overlay button[onclick="dlNext()"]');
  const presentCount = state.students.length - dlState.absentIds.size;
  if (footer) footer.textContent = `Next → Codes (${presentCount} present)`;
  // Update header count
  const countEl = document.querySelector('#dl-body div[style*="DM Mono"]');
  if (countEl) countEl.textContent = `${presentCount} present · ${dlState.absentIds.size} absent`;
}

function dlMarkAll(absent) {
  if (absent) state.students.forEach(s => dlState.absentIds.add(s.id));
  else dlState.absentIds.clear();
  document.getElementById('dl-body').innerHTML = buildDlStep1();
  const presentCount = state.students.length - dlState.absentIds.size;
  const footer = document.querySelector('#dl-overlay button[onclick="dlNext()"]');
  if (footer) footer.textContent = `Next → Codes (${presentCount} present)`;
}

// ── STEP 2: CODES TAUGHT ──
function buildDlStep2() {
  const availSubjects = [...new Set(state.curriculumCodes.map(c => c.Subject).filter(Boolean))].sort();
  const presenterCount = state.students.length - dlState.absentIds.size;

  return `
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:16px">
      Select the curriculum codes taught today to <strong style="color:var(--text)">${presenterCount} present students</strong>.
      Search, browse by subject/strand, or describe the lesson and let AI suggest codes.
    </div>

    <!-- AI IC Suggester box -->
    <div style="background:var(--surface-alt);border:1px solid var(--border2);border-radius:8px;padding:12px 14px;margin-bottom:14px">
      <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--purple);margin-bottom:8px">✦ AI IC Suggester</div>
      <!-- Subject selector -->
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px" id="dl-ai-subject-btns">
        ${availSubjects.map(s => {
          const col = subjectCol(s) || 'var(--text3)';
          const active = s === dlState.selectedSubject;
          return `<button onclick="dlSetAISubject('${s.replace(/'/g,"\\'")}')"
            style="padding:4px 10px;border-radius:4px;border:1px solid ${active?col:'var(--border2)'};background:${active?col+'22':'none'};color:${active?col:'var(--text3)'};font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif">
            ${s}
          </button>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <input id="dl-ai-input" placeholder="Describe what you taught today… AI will suggest ICs matching your selected subject and present students' year levels"
          style="flex:1;background:var(--surface);border:1px solid var(--border2);border-radius:6px;padding:8px 12px;color:var(--text);font-size:12px;outline:none;font-family:'Instrument Sans',sans-serif"
          onkeydown="if(event.key==='Enter')dlAISuggest()">
        <button onclick="dlAISuggest()" id="dl-ai-btn"
          style="padding:8px 14px;border-radius:6px;border:1px solid var(--purple);background:var(--purple-dim);color:var(--purple);font-size:12px;cursor:pointer;white-space:nowrap;font-family:'Instrument Sans',sans-serif">
          Suggest ICs
        </button>
      </div>
      <div id="dl-ai-results" style="margin-top:10px"></div>
    </div>

    <!-- Filters -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <button onclick="state.studentSortBy=state.studentSortBy==='last_name'?'first_name':'last_name';document.getElementById('dl-body').innerHTML=buildDlStep2()"
        style="padding:3px 10px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer">
        ${state.studentSortBy === 'last_name' ? '↕ Last, First' : '↕ First, Last'}
      </button>
      <div style="position:relative;flex:1;min-width:160px">
        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px">⌕</span>
        <input id="dl-code-search" placeholder="Search codes…"
          style="width:100%;padding:6px 10px 6px 30px;background:var(--surface-alt);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-size:12px;outline:none;box-sizing:border-box"
          oninput="dlFilterCodes()">
      </div>
      <select id="dl-subj-filter" onchange="dlFilterCodes()"
        style="background:var(--surface-alt);border:1px solid var(--border2);border-radius:5px;padding:6px 8px;color:var(--text-muted);font-size:12px;cursor:pointer;outline:none">
        <option value="all">All subjects</option>
        ${availSubjects.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select id="dl-strand-filter" onchange="dlFilterCodes()"
        style="background:var(--surface-alt);border:1px solid var(--border2);border-radius:5px;padding:6px 8px;color:var(--text-muted);font-size:12px;cursor:pointer;outline:none">
        <option value="all">All strands</option>
      </select>
      <select id="dl-year-filter" onchange="dlFilterCodes()"
        style="background:var(--surface-alt);border:1px solid var(--border2);border-radius:5px;padding:6px 8px;color:var(--text-muted);font-size:12px;cursor:pointer;outline:none">
        <option value="all">All years</option>
        ${['Foundation','Year 1','Year 2','Year 3','Year 4','Year 5','Year 6'].map(y => `<option value="${y}">${y}</option>`).join('')}
      </select>
    </div>

    <!-- Selected chips -->
    <div id="dl-selected-chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;min-height:26px">
      ${buildDlSelectedChips()}
    </div>

    <!-- Code list -->
    <div id="dl-code-list" style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">
      ${buildDlCodeListHtml(state.curriculumCodes.slice(0,80))}
    </div>
    <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-top:6px" id="dl-code-count">
      Showing ${Math.min(80, state.curriculumCodes.length)} of ${state.curriculumCodes.length} codes — use filters or search to narrow
    </div>
  `;
}

function wireDlStep2Events() {
  // Work out the year levels of present students
  const presentYears = [...new Set(
    state.students
      .filter(s => !dlState.absentIds.has(s.id))
      .map(s => YLM[normaliseYear(s.year_level)] || s.year_level)
  )];

  // Pre-select year if all present students are in the same year
  if (presentYears.length === 1) {
    const yr = document.getElementById('dl-year-filter');
    if (yr) yr.value = presentYears[0];
  }

  // Pre-select first subject that has codes for this year
  const subjSel = document.getElementById('dl-subj-filter');
  if (subjSel && subjSel.value === 'all' && presentYears.length === 1) {
    const firstSubj = [...new Set(
      state.curriculumCodes
        .filter(c => (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(presentYears[0]) : presentYears[0]))
        .map(c => c.Subject).filter(Boolean)
    )].sort()[0];
    if (firstSubj) subjSel.value = firstSubj;
  }

  // Now run the filter with the pre-set values
  dlFilterCodes();
}

function dlSetAISubject(subject) {
  dlState.selectedSubject = subject;
  // Re-render just the subject buttons
  const availSubjects = [...new Set(state.curriculumCodes.map(c => c.Subject).filter(Boolean))].sort();
  const container = document.getElementById('dl-ai-subject-btns');
  if (container) {
    container.innerHTML = availSubjects.map(s => {
      const col = subjectCol(s) || 'var(--text3)';
      const active = s === subject;
      return `<button onclick="dlSetAISubject('${s.replace(/'/g,"\\'")}')"
        style="padding:4px 10px;border-radius:4px;border:1px solid ${active?col:'var(--border2)'};background:${active?col+'22':'none'};color:${active?col:'var(--text3)'};font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif">
        ${s}
      </button>`;
    }).join('');
  }
}

function buildDlSelectedChips() {
  if (!dlState.selectedCodes.length) return '<span style="font-size:11px;color:var(--text3)">No codes selected yet</span>';
  return dlState.selectedCodes.map(code => {
    const cd = state.curriculumCodes.find(c => c.Code === code);
    // Colour chip by subject
    const col = subjectCol(cd?.Subject) || 'var(--blue)';
    return `<div style="display:inline-flex;align-items:center;gap:5px;background:${col}22;border:1px solid ${col};border-radius:4px;padding:3px 8px;font-size:11px;color:${col}">
      <span style="font-family:'DM Mono',monospace">${code}</span>
      ${cd ? `<span style="color:var(--text3);font-size:10px">${cd.Subject ? cd.Subject.slice(0,4).toUpperCase() : ''}</span>` : ''}
      <button onclick="dlToggleCode('${code}')" style="background:none;border:none;color:${col};cursor:pointer;font-size:12px;padding:0;line-height:1;opacity:0.7">✕</button>
    </div>`;
  }).join('');
}

function buildDlCodeListHtml(codes) {
  if (!codes.length) return '<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No codes match your filters</div>';
  const icDerivedSet = new Set(
    (dlState.selectedICs || [])
      .map(id => state.instructionalComponents.find(ic => ic.id === id)?.homeDescriptorId)
      .filter(Boolean)
  );
  return codes.map(c => {
    const icDerived = icDerivedSet.has(c.Code);
    const manualSel = (dlState.manualCodes || []).includes(c.Code);
    const selected  = manualSel || icDerived;
    const isExpanded = dlStep2ExpandedCode === c.Code;

    const rowBg     = icDerived ? 'background:var(--purple-dim);' : selected ? 'background:var(--blue-dim);' : '';
    const cursor    = icDerived ? 'default' : 'pointer';
    const clickAttr = icDerived ? '' : `onclick="dlToggleCode('${c.Code}')"`;
    const hoverAttr = icDerived ? '' : `onmouseover="if(!${selected})this.style.background='var(--surface-alt)'" onmouseout="if(!${selected})this.style.background='transparent'"`;
    const codeColor = icDerived ? 'var(--purple)' : selected ? 'var(--blue)' : 'var(--text3)';

    const indicator = icDerived
      ? `<div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--purple);border:1px solid var(--purple);border-radius:3px;padding:1px 4px;white-space:nowrap;flex-shrink:0;margin-top:2px">via IC</div>`
      : `<div style="width:16px;height:16px;border-radius:3px;border:1.5px solid ${selected?'var(--blue)':'var(--border2)'};background:${selected?'var(--blue)':'none'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
          ${selected ? '<span style="color:var(--primary-contrast);font-size:10px;font-weight:700">✓</span>' : ''}
        </div>`;

    const icPanel = isExpanded ? buildDlICPanel(c.Code) : '';

    return `<div style="border-bottom:1px solid var(--border)">
      <div ${clickAttr} data-dl-code="${c.Code}"
        style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;cursor:${cursor};transition:background 0.1s;${rowBg}"
        ${hoverAttr}>
        ${indicator}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-family:'DM Mono',monospace;font-size:10px;color:${codeColor}">${c.Code}</span>
            <span style="font-size:9px;background:var(--surface-alt);padding:1px 5px;border-radius:3px;color:var(--text3)">${c.Subject||''}</span>
            <span style="font-size:9px;color:var(--text3)">${c.Strand||''}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);line-height:1.4;margin-top:2px">${c.Descriptor||c.Aspect||'—'}</div>
        </div>
        <button onclick="event.stopPropagation();dlExpandDescriptor('${c.Code}')"
          style="padding:2px 7px;background:${isExpanded?'var(--blue-dim)':'none'};border:1px solid ${isExpanded?'var(--blue)':'var(--border2)'};border-radius:3px;color:${isExpanded?'var(--blue)':'var(--text3)'};font-size:10px;cursor:pointer;flex-shrink:0;margin-top:2px;font-family:'DM Mono',monospace;white-space:nowrap">
          ICs ${isExpanded ? '▲' : '▼'}
        </button>
      </div>
      ${icPanel}
    </div>`;
  }).join('');
}

function buildDlICChipsHtml(code, q) {
  const allICs = getICsForDescriptor(code);
  const filtered = q
    ? allICs.filter(ic => ic.name.toLowerCase().includes(q) || (ic.description||'').toLowerCase().includes(q))
    : allICs;

  let listHtml;
  if (filtered.length === 0) {
    listHtml = `<div style="font-size:11px;color:var(--text3);text-align:center;padding:6px 0">${q ? 'No ICs match your search' : 'No ICs loaded for this descriptor yet'}</div>`;
  } else {
    listHtml = filtered.map(ic => {
      const sel = (dlState.selectedICs || []).includes(ic.id);
      const isDraft = ic.ownerTier === 'teacher_stub';
      const col = sel ? 'var(--green)' : 'var(--blue)';
      return `<button onclick="dlAddAISuggestedIC('${ic.id}')"
        style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:5px;border:1.5px solid ${sel?'var(--green)':'var(--border2)'};background:${sel?'var(--green-dim)':'var(--surface)'};text-align:left;width:100%;cursor:pointer;margin-bottom:4px;transition:all 0.12s">
        <div style="width:16px;height:16px;border-radius:50%;border:2px solid ${col};background:${sel?col:'none'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:${sel?'var(--primary-contrast)':col}">
          ${sel ? '✓' : '+'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;color:${sel?'var(--green)':'var(--text-muted)'};line-height:1.3">
            ${escapeHtml(ic.name)}
            ${isDraft ? `<span style="font-family:'DM Mono',monospace;font-size:8px;padding:1px 5px;border-radius:8px;background:var(--rust-dim);color:var(--rust);border:1px solid var(--rust);margin-left:4px;vertical-align:middle">Draft</span>` : ''}
          </div>
          ${ic.difficultyStage ? `<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">${ic.difficultyStage}</div>` : ''}
        </div>
      </button>`;
    }).join('');
  }

  const stubLink = `<div style="text-align:center;padding-top:6px;${filtered.length > 0 ? 'margin-top:2px;border-top:1px solid var(--border);' : ''}">
    <button onclick="openStubICModal('${escapeHtml(code)}')"
      style="background:none;border:none;color:var(--text3);font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif;text-decoration:underline;padding:3px 0;opacity:0.8">
      Can't find the IC? Create a draft.
    </button>
  </div>`;

  return listHtml + stubLink;
}

function buildDlICPanel(code) {
  return `
    <div id="dl-ic-panel-${code}" style="padding:8px 12px 10px;background:var(--surface-alt);border-top:1px solid var(--border)">
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:7px">ICs for ${code}</div>
      <div style="position:relative;margin-bottom:8px">
        <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:12px">⌕</span>
        <input placeholder="Search ICs…" value="${escapeHtml(dlStep2ICSearch)}"
          oninput="dlUpdateICSearch(this.value,'${escapeHtml(code)}')"
          style="width:100%;padding:5px 8px 5px 26px;background:var(--surface);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:11px;outline:none;box-sizing:border-box;font-family:'Instrument Sans',sans-serif">
      </div>
      <div id="dl-ic-chips-${code}">${buildDlICChipsHtml(code, dlStep2ICSearch.toLowerCase().trim())}</div>
    </div>`;
}

function dlExpandDescriptor(code) {
  if (dlStep2ExpandedCode === code) {
    dlStep2ExpandedCode = null;
  } else {
    dlStep2ExpandedCode = code;
    dlStep2ICSearch = '';
  }
  dlFilterCodes();
}

function dlUpdateICSearch(val, code) {
  dlStep2ICSearch = val;
  const container = document.getElementById('dl-ic-chips-' + code);
  if (!container) return;
  container.innerHTML = buildDlICChipsHtml(code, val.toLowerCase().trim());
}

function getStubDefaultYear() {
  const presentStudents = state.students.filter(s => !dlState.absentIds?.has(s.id));
  const target = presentStudents.length ? presentStudents : state.students;
  if (!target.length) return '';
  const freq = {};
  target.forEach(s => {
    const y = YLM[normaliseYear(s.year_level)] || s.year_level || '';
    if (y) freq[y] = (freq[y] || 0) + 1;
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function getStubYearLevels(subject) {
  return [...new Set(
    state.curriculumCodes.filter(c => c.Subject === subject).map(c => c['Year Level']).filter(Boolean)
  )].sort();
}

function getStubDescriptorOptions(subject, year) {
  return state.curriculumCodes
    .filter(c => c.Subject === subject && c['Year Level'] === year)
    .map(c => `<option value="${escapeHtml(c.Code + ' - ' + (c.Descriptor || c.Aspect || c.Code).slice(0, 80))}">`)
    .join('');
}

function closeStubICModal() {
  if (state.plannerUi) state.plannerUi.pendingStubForLessonId = null;
  const overlay = document.getElementById('stub-ic-overlay');
  if (overlay) overlay.remove();
}

function openStubICModal(descriptorCode, defaultSubjectOverride) {
  const locked = !!descriptorCode;
  const cd = locked ? state.curriculumCodes.find(c => c.Code === descriptorCode) : null;

  const allSubjects = [...new Set(state.curriculumCodes.map(c => c.Subject).filter(Boolean))].sort();
  const defaultSubject = locked ? (cd?.Subject || '') : (defaultSubjectOverride || dlState?.selectedSubject || allSubjects[0] || '');
  const subjectDisabled = locked || allSubjects.length <= 1;

  const defaultYear = locked ? (cd?.['Year Level'] || '') : getStubDefaultYear();
  const yearLevels = defaultSubject ? getStubYearLevels(defaultSubject) : [];

  const defaultName = cd ? (cd.Descriptor || cd.Aspect || cd.Code).slice(0, 80) : '';
  const descriptorDisplayValue = cd ? `${cd.Code} - ${defaultName}` : '';
  const initialDescriptorOptions = (defaultSubject && defaultYear) ? getStubDescriptorOptions(defaultSubject, defaultYear) : '';

  const existing = document.getElementById('stub-ic-overlay');
  if (existing) existing.remove();

  const selStyle = `width:100%;padding:8px 10px;background:var(--surface-alt);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-size:12px;outline:none;box-sizing:border-box;font-family:'Instrument Sans',sans-serif`;

  const overlay = document.createElement('div');
  overlay.id = 'stub-ic-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:200;animation:fadeIn 0.15s ease';
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;width:min(95vw,480px);max-height:90vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,0.5);animation:slideUp 0.2s ease">
      <div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div style="font-family:'Fraunces',serif;font-size:15px;margin-bottom:4px">Create Draft IC</div>
          ${locked ? `<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">${escapeHtml(descriptorCode)}</div>` : ''}
        </div>
        <button onclick="closeStubICModal()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:2px;line-height:1">✕</button>
      </div>
      <div style="padding:18px 20px">
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);display:block;margin-bottom:6px">Subject <span style="color:var(--rust)">*</span></label>
          <select id="stub-ic-subject" onchange="stubSubjectChanged()" ${subjectDisabled ? 'disabled' : ''}
            style="${selStyle}${subjectDisabled ? ';opacity:0.65;cursor:default' : ''}">
            <option value="">— Select subject —</option>
            ${allSubjects.map(s => `<option value="${escapeHtml(s)}"${s === defaultSubject ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);display:block;margin-bottom:6px">Year Level <span style="color:var(--rust)">*</span></label>
          <select id="stub-ic-year" onchange="stubYearChanged()" ${locked ? 'disabled' : ''}
            style="${selStyle}${locked ? ';opacity:0.65;cursor:default' : ''}">
            <option value="">— Select year level —</option>
            ${yearLevels.map(y => `<option value="${escapeHtml(y)}"${y === defaultYear ? ' selected' : ''}>${escapeHtml(y)}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);display:block;margin-bottom:6px">Descriptor <span style="color:var(--rust)">*</span></label>
          <input id="stub-ic-descriptor" list="stub-descriptor-list"
            value="${escapeHtml(descriptorDisplayValue)}"
            placeholder="Search descriptors…"
            ${locked ? 'readonly' : ''}
            oninput="stubDescriptorChanged()"
            onchange="stubDescriptorChanged()"
            style="width:100%;padding:8px 10px;background:var(--surface-alt);border:1px solid ${locked ? 'var(--border)' : 'var(--border2)'};border-radius:6px;color:${locked ? 'var(--text3)' : 'var(--text)'};font-size:12px;outline:none;box-sizing:border-box;font-family:'Instrument Sans',sans-serif;${locked ? 'cursor:default;' : ''}">
          <datalist id="stub-descriptor-list">${initialDescriptorOptions}</datalist>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);display:block;margin-bottom:6px">Name <span style="color:var(--rust)">*</span></label>
          <input id="stub-ic-name" value="${escapeHtml(defaultName)}"
            data-auto="${defaultName ? '1' : '0'}"
            oninput="this.dataset.auto='0'"
            style="width:100%;padding:8px 10px;background:var(--surface-alt);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-size:12px;outline:none;box-sizing:border-box;font-family:'Instrument Sans',sans-serif">
        </div>
        <div style="margin-bottom:18px">
          <label style="font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);display:block;margin-bottom:6px">Note <span style="font-weight:400">(optional)</span></label>
          <input id="stub-ic-note" placeholder="e.g. Represented numbers using MAB blocks"
            style="width:100%;padding:8px 10px;background:var(--surface-alt);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-size:12px;outline:none;box-sizing:border-box;font-family:'Instrument Sans',sans-serif">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button onclick="closeStubICModal()"
            style="padding:8px 18px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:13px;cursor:pointer;font-family:'Instrument Sans',sans-serif">
            Cancel
          </button>
          <button onclick="saveStubIC()"
            style="padding:8px 18px;border-radius:6px;border:none;background:var(--blue);color:var(--primary-contrast);font-size:13px;font-weight:600;cursor:pointer;font-family:'Instrument Sans',sans-serif">
            Save and add to lesson
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => {
    if (locked) {
      document.getElementById('stub-ic-name')?.select();
    } else if (!defaultSubject) {
      document.getElementById('stub-ic-subject')?.focus();
    } else if (!defaultYear) {
      document.getElementById('stub-ic-year')?.focus();
    } else {
      document.getElementById('stub-ic-descriptor')?.focus();
    }
  }, 60);
}

function stubSubjectChanged() {
  const subjectEl = document.getElementById('stub-ic-subject');
  const yearEl = document.getElementById('stub-ic-year');
  const descriptorEl = document.getElementById('stub-ic-descriptor');
  const datalist = document.getElementById('stub-descriptor-list');
  const subject = subjectEl?.value || '';
  const yearLevels = subject ? getStubYearLevels(subject) : [];
  if (yearEl) yearEl.innerHTML = `<option value="">— Select year level —</option>` +
    yearLevels.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');
  if (descriptorEl) descriptorEl.value = '';
  if (datalist) datalist.innerHTML = '';
}

function stubYearChanged() {
  const subjectEl = document.getElementById('stub-ic-subject');
  const yearEl = document.getElementById('stub-ic-year');
  const descriptorEl = document.getElementById('stub-ic-descriptor');
  const datalist = document.getElementById('stub-descriptor-list');
  const subject = subjectEl?.value || '';
  const year = yearEl?.value || '';
  if (descriptorEl) descriptorEl.value = '';
  if (datalist) datalist.innerHTML = (subject && year) ? getStubDescriptorOptions(subject, year) : '';
}

function stubDescriptorChanged() {
  const descriptorInput = document.getElementById('stub-ic-descriptor');
  const nameInput = document.getElementById('stub-ic-name');
  if (!descriptorInput || !nameInput) return;
  const code = descriptorInput.value.split(' - ')[0].trim();
  const cd = state.curriculumCodes.find(c => c.Code === code);
  if (cd && nameInput.dataset.auto !== '0') {
    nameInput.value = (cd.Descriptor || cd.Aspect || cd.Code).slice(0, 80);
    nameInput.dataset.auto = '1';
  }
}

function saveStubIC() {
  const subjectEl = document.getElementById('stub-ic-subject');
  const yearEl = document.getElementById('stub-ic-year');
  const descriptorInput = document.getElementById('stub-ic-descriptor');
  const nameEl = document.getElementById('stub-ic-name');
  const noteEl = document.getElementById('stub-ic-note');

  if (!subjectEl?.value) { toast('Please select a subject', 'error'); subjectEl?.focus(); return; }
  if (!yearEl?.value) { toast('Please select a year level', 'error'); yearEl?.focus(); return; }

  const code = (descriptorInput ? descriptorInput.value.trim() : '').split(' - ')[0].trim();
  const cd = state.curriculumCodes.find(c => c.Code === code);
  if (!cd) { toast('Please select a descriptor', 'error'); descriptorInput?.focus(); return; }

  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { toast('Name is required', 'error'); nameEl?.focus(); return; }
  const note = noteEl ? noteEl.value.trim() : '';

  const newIC = createIC({
    homeDescriptorId: code,
    name,
    description: note,
    note,
    ownerTier: 'teacher_stub',
    icReadinessStatus: 'draft',
    sequenceOrder: 999,
    createdAt: new Date().toISOString(),
  });
  state.instructionalComponents.push(newIC);

  // Fire-and-forget persist — do not block wizard UI
  (async () => {
    try {
      const resp = await fetch(API_URL + '?action=saveStubIC', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'saveStubIC',
          icId: newIC.id,
          ownerTier: newIC.ownerTier,
          icReadinessStatus: newIC.icReadinessStatus,
          homeDescriptorId: newIC.homeDescriptorId,
          name: newIC.name,
          note: newIC.note || '',
          createdAt: newIC.createdAt,
        })
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
    } catch(err) {
      console.error('[StubIC] Failed to persist to Sheets:', err);
    }
  })();

  updateStubBadge();

  const overlay = document.getElementById('stub-ic-overlay');
  if (overlay) overlay.remove();

  // Planner context: auto-link the new stub to the lesson being edited (mirrors
  // ticking an existing IC), then stop — the wizard-specific updates don't apply.
  const plannerLessonId = state.plannerUi && state.plannerUi.pendingStubForLessonId;
  if (plannerLessonId) {
    state.plannerUi.pendingStubForLessonId = null;
    const li = state.lessonPlans.findIndex(l => l.id === plannerLessonId);
    if (li >= 0) {
      const linked = Array.isArray(state.lessonPlans[li].linkedICIds) ? [...state.lessonPlans[li].linkedICIds] : [];
      if (linked.length >= 3) {
        toast(`Draft IC "${name}" created, but the lesson already has 3 ICs`, 'info');
      } else {
        linked.push(newIC.id);
        state.lessonPlans[li] = { ...state.lessonPlans[li], linkedICIds: linked };
        saveLessonPlansState();
        toast(`Draft IC "${name}" created and linked to the lesson`, 'success');
      }
    }
    if (state.currentView === 'planner' || state.currentView === 'unit-plans') renderView();
    return;
  }

  if (!dlState.selectedICs.includes(newIC.id)) {
    dlState.selectedICs.push(newIC.id);
  }
  dlRecalcSelectedCodes();

  dlStep2ICSearch = '';
  dlFilterCodes();
  const chips = document.getElementById('dl-selected-chips');
  if (chips) chips.innerHTML = buildDlSelectedChips();
  const btn = document.querySelector('#dl-overlay button[onclick="dlNext()"]');
  if (btn) btn.textContent = dlStep2NextLabel();

  toast(`Draft IC "${name}" created and added to lesson`, 'success');
}

function promoteStubIC(icId) {
  const nameInput = document.getElementById(`stub-promote-name-${icId}`);
  const name = (nameInput?.value || '').trim();
  if (!name) { nameInput?.focus(); toast('A name is required to promote this IC', 'error'); return; }
  if (name.length > 60) { toast('Name must be 60 characters or fewer', 'error'); return; }
  const ic = state.instructionalComponents.find(x => x.id === icId);
  if (!ic) return;
  ic.name = name;
  ic.icReadinessStatus = 'active';
  ic.ownerTier = 'teacher_original';
  (async () => {
    try {
      const resp = await fetch(API_URL + '?action=promoteStubIC', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'promoteStubIC', icId, name: ic.name })
      });
      const result = await resp.json();
      if (!resp.ok || result.error || result.success === false) {
        console.error('[StubIC] promoteStubIC failed:', result?.error || resp.status);
      }
    } catch(err) {
      console.error('[StubIC] Failed to persist promotion to Sheets:', err);
    }
  })();
  updateStubBadge();
  toast(`IC promoted: "${name}"`, 'success');
  openCodeDetail(ic.homeDescriptorId, null);
}

function deleteStubIC(icId) {
  const ic = state.instructionalComponents.find(x => x.id === icId);
  if (!ic) return;
  const descriptorId = ic.homeDescriptorId;
  state.instructionalComponents = state.instructionalComponents.filter(x => x.id !== icId);
  (async () => {
    try {
      const resp = await fetch(API_URL + '?action=deleteStubIC', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'deleteStubIC', icId })
      });
      const result = await resp.json();
      if (!resp.ok || result.error || result.success === false) {
        console.error('[StubIC] deleteStubIC failed:', result?.error || resp.status);
      }
    } catch(err) {
      console.error('[StubIC] Failed to delete stub from Sheets:', err);
    }
  })();
  updateStubBadge();
  toast('Draft IC deleted', 'success');
  openCodeDetail(descriptorId, null);
}

function dlRecalcSelectedCodes() {
  const icCodes = dlState.selectedICs
    .map(id => state.instructionalComponents.find(ic => ic.id === id)?.homeDescriptorId)
    .filter(Boolean);
  dlState.selectedCodes = [...new Set([...dlState.manualCodes, ...icCodes])];
}

function dlStep2NextLabel() {
  const codes = dlState.selectedCodes.length;
  const ics   = dlState.selectedICs.length;
  if (!codes && !ics) return `✓ Save Session`;
  if (ics > 0) {
    return `Next → Class Check (${ics} IC${ics !== 1 ? 's' : ''})`;
  }
  return `✓ Save Session (${codes} code${codes !== 1 ? 's' : ''})`;
}

function dlToggleCode(code) {
  // Codes selected via IC selection are read-only — manual clicks are ignored
  const icDerived = (dlState.selectedICs || []).some(icId => {
    const ic = state.instructionalComponents.find(x => x.id === icId);
    return ic && ic.homeDescriptorId === code;
  });
  if (icDerived) return;

  const idx = (dlState.manualCodes || []).indexOf(code);
  if (idx >= 0) dlState.manualCodes.splice(idx, 1);
  else dlState.manualCodes.push(code);
  dlRecalcSelectedCodes();

  // Update chips and code list
  const chips = document.getElementById('dl-selected-chips');
  if (chips) chips.innerHTML = buildDlSelectedChips();
  dlFilterCodes();

  // Update footer
  const btn = document.querySelector('#dl-overlay button[onclick="dlNext()"]');
  if (btn) btn.textContent = dlStep2NextLabel();
}

function dlFilterCodes() {
  const q    = (document.getElementById('dl-code-search')?.value || '').toLowerCase();
  const subj = document.getElementById('dl-subj-filter')?.value || 'all';
  const year = document.getElementById('dl-year-filter')?.value || 'all';

  // Rebuild strand options for selected subject FIRST, preserving current selection
  const strandSel = document.getElementById('dl-strand-filter');
  let strand = 'all';
  if (strandSel) {
    const prevStrand = strandSel.value; // save before rebuild
    if (subj !== 'all') {
      const strands = [...new Set(
        state.curriculumCodes
          .filter(c => c.Subject === subj && (year === 'all' || (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(year) : year)))
          .map(c => c.Strand).filter(Boolean)
      )].sort();
      strandSel.innerHTML = `<option value="all">All strands</option>${strands.map(s => `<option value="${s}">${s}</option>`).join('')}`;
      // Restore previous selection if still valid
      if (strands.includes(prevStrand)) strandSel.value = prevStrand;
    } else {
      strandSel.innerHTML = `<option value="all">All strands</option>`;
    }
    strand = strandSel.value;
  }

  const filtered = state.curriculumCodes.filter(c => {
    if (subj   !== 'all' && c.Subject !== subj) return false;
    if (strand !== 'all' && c.Strand  !== strand) return false;
    if (year   !== 'all' && (c['Year Level']||'').trim() !== (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(year) : year)) return false;
    if (q && !(
      (c.Code||'').toLowerCase().includes(q) ||
      (c.Descriptor||'').toLowerCase().includes(q) ||
      (c.Strand||'').toLowerCase().includes(q)
    )) return false;
    return true;
  }).slice(0, 150);

  const list  = document.getElementById('dl-code-list');
  const count = document.getElementById('dl-code-count');
  if (list)  list.innerHTML  = buildDlCodeListHtml(filtered);
  if (count) count.textContent = `Showing ${filtered.length} codes${filtered.length === 150 ? ' (use filters to narrow)' : ''}`;
}

// ── KEYWORD SCORER (fallback — works with no API key) ──
// Expands common teaching synonyms so "doubling" matches "multiplication facts for twos" etc.
const SYNONYM_MAP = {
  'doubling':'multiplication', 'halving':'division', 'times tables':'multiplication',
  'timestables':'multiplication', 'timetables':'multiplication', 'timestabls':'multiplication',
  'number facts':'multiplication', 'addition facts':'addition', 'subtraction facts':'subtraction',
  'place value':'place', 'number sense':'number', 'counting on':'counting',
  'phonics':'phonemic', 'phonemic awareness':'phonemic', 'blending':'blend',
  'segmenting':'segment', 'decoding':'decode', 'sight words':'sight', 'high frequency':'sight',
  'narratives':'narrative', 'recounts':'recount', 'reports':'report', 'procedures':'procedure',
  'sentence types':'sentence', 'question marks':'punctuation', 'full stops':'punctuation',
  'capital letters':'capitalisation', 'speech marks':'punctuation', 'paragraphs':'paragraph',
  'character':'character', 'setting':'setting', 'plot':'plot',
  'fractions':'fraction', 'decimals':'decimal', 'percentages':'percentage',
  'measurement':'measure', 'length':'length', 'area':'area', 'volume':'volume',
  'data':'data', 'graphs':'graph', 'chance':'probability', 'probability':'probability',
  'living things':'living', 'materials':'material', 'forces':'force', 'energy':'energy',
  'geography':'geography', 'history':'history', 'civics':'civics',
};

function keywordScore(lessonText, descriptor) {
  // Normalise and expand synonyms
  let text = lessonText.toLowerCase();
  Object.entries(SYNONYM_MAP).forEach(([alias, canonical]) => {
    text = text.replace(new RegExp(alias, 'g'), canonical);
  });

  const textWords = new Set(
    text.split(/\W+/).filter(w => w.length > 2 &&
      !['the','and','for','with','are','was','that','this','they','have',
        'from','been','each','will','when','what','how','but','not','can',
        'its','their','about','into','also','using','which','through'].includes(w))
  );

  let desc = (descriptor || '').toLowerCase();
  Object.entries(SYNONYM_MAP).forEach(([alias, canonical]) => {
    desc = desc.replace(new RegExp(alias, 'g'), canonical);
  });
  const descWords = desc.split(/\W+/).filter(w => w.length > 2);

  let score = 0;
  descWords.forEach(w => { if (textWords.has(w)) score++; });
  // Bonus for longer matches (phrase-level)
  textWords.forEach(tw => { if (desc.includes(tw) && tw.length > 4) score += 0.5; });
  return score;
}

function keywordSuggest(lessonText, codes) {
  const scored = codes
    .map(c => ({ code: c.Code, score: keywordScore(lessonText, c.Descriptor || c.Aspect || '') }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  return scored.map(x => x.code);
}

// ── AI SUGGESTER (with keyword fallback) ──
async function dlAISuggest() {
  const input   = document.getElementById('dl-ai-input');
  const btn     = document.getElementById('dl-ai-btn');
  const results = document.getElementById('dl-ai-results');
  const text    = input?.value?.trim();
  if (!text) { toast('Describe what you taught first', 'error'); return; }

  btn.textContent = '…'; btn.disabled = true;
  results.innerHTML = `<div style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:8px">
    <div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Finding relevant ICs…
  </div>`;

  // Build list of present students' year levels
  const presentStudents = state.students.filter(s => !dlState.absentIds.has(s.id));
  const presentYearLevels = [...new Set(presentStudents.map(s => YLM[normaliseYear(s.year_level)] || s.year_level))];

  const relevantICs = state.instructionalComponents.filter(ic => {
    const cd = state.curriculumCodes.find(c => c.Code === ic.homeDescriptorId);
    return cd &&
      cd.Subject === dlState.selectedSubject &&
      (presentYearLevels.length === 0 || (BANDED_SUBJECTS.has(cd.Subject)
        ? presentYearLevels.some(yl => bandYearLevel(yl) === (cd['Year Level']||'').trim())
        : presentYearLevels.includes((cd['Year Level']||'').trim()))) &&
      !ic.isArchived;
  });

  if (!relevantICs.length) {
    results.innerHTML = `<div style="font-size:11px;color:var(--text3)">No ICs loaded for ${dlState.selectedSubject||'selected subject'} — ICs may not be generated yet for these year levels.</div>`;
    btn.textContent = 'Suggest ICs'; btn.disabled = false;
    return;
  }

  let suggestedICIds = [];
  let reasoning = '';

  // ── Try AI via Apps Script ──
  try {
    const icList = relevantICs.map(ic => `${ic.id}|${ic.name}|${ic.description||''}`).join('\n');
    const yearContext = presentYearLevels.length ? ` for ${presentYearLevels.join(', ')}` : '';
    const prompt = `You are helping an Australian primary school teacher identify the instructional components (ICs) most relevant to what was taught today${yearContext} in ${dlState.selectedSubject||'their subject'}.
Lesson description: "${text}"
Available ICs (id|name|description):
${icList}
Return ONLY valid JSON, no preamble, no backticks:
{"ics":["ic-id-1","ic-id-2"],"reasoning":"One sentence explanation"}
Return up to 10 ICs that best match the lesson description.`;

    const result = await apiCall('claudeSuggest', { prompt });

    if (result && result.ics && result.ics.length) {
      suggestedICIds = result.ics.filter(id => relevantICs.some(ic => ic.id === id));
      reasoning = result.reasoning || '';
    } else if (result && result.text) {
      const parsed = JSON.parse(result.text.replace(/```json|```/g,'').trim());
      suggestedICIds = (parsed.ics||[]).filter(id => relevantICs.some(ic => ic.id === id));
      reasoning = parsed.reasoning || '';
    }

    if (!suggestedICIds.length) throw new Error('AI returned no valid IC ids');

  } catch(aiErr) {
    // ── Keyword fallback: score ICs by name+description match ──
    console.info('AI IC suggest fell back to keyword scoring:', aiErr.message);
    const scored = relevantICs.map(ic => ({
      ic,
      score: keywordScore(text, (ic.name || '') + ' ' + (ic.description || ''))
    })).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, 10);
    suggestedICIds = scored.map(x => x.ic.id);
    reasoning = suggestedICIds.length ? 'Matched by keyword scoring' : '';
  }

  // ── Render results ──
  if (!suggestedICIds.length) {
    results.innerHTML = `<div style="font-size:11px;color:var(--text3)">
      No ICs matched. Try describing the lesson using specific terms from ${dlState.selectedSubject||'the subject'}.
    </div>`;
    btn.textContent = 'Suggest ICs'; btn.disabled = false;
    return;
  }

  // Group suggested ICs by homeDescriptorId
  const byDescriptor = {};
  suggestedICIds.forEach(icId => {
    const ic = relevantICs.find(x => x.id === icId);
    if (!ic) return;
    if (!byDescriptor[ic.homeDescriptorId]) byDescriptor[ic.homeDescriptorId] = [];
    byDescriptor[ic.homeDescriptorId].push(ic);
  });

  const subjCol = subjectCol(dlState.selectedSubject) || 'var(--purple)';

  const groupedHtml = Object.entries(byDescriptor).map(([descriptorId, ics]) => {
    const cd = state.curriculumCodes.find(c => c.Code === descriptorId);
    return `<div style="margin-bottom:10px">
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:${subjCol};margin-bottom:5px;display:flex;align-items:center;gap:6px">
        <span>${descriptorId}</span>
        ${cd ? `<span style="color:var(--text3);font-weight:400">${(cd.Descriptor||cd.Aspect||'').slice(0,60)}${(cd.Descriptor||cd.Aspect||'').length>60?'…':''}</span>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px">
        ${ics.map(ic => {
          const selected = dlState.selectedICs.includes(ic.id);
          const btnCol = selected ? 'var(--green)' : subjCol;
          const btnBg  = selected ? 'var(--green-dim)' : 'var(--surface-alt)';
          return `<button onclick="dlAddAISuggestedIC('${ic.id}')" id="dl-ai-ic-chip-${ic.id}"
            style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:6px;
            border:2px solid ${btnCol};background:${btnBg};
            text-align:left;width:100%;cursor:pointer;transition:all 0.15s">
            <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${btnCol};
              background:${selected?btnCol:'none'};display:flex;align-items:center;justify-content:center;
              flex-shrink:0;margin-top:1px;font-size:11px;color:${selected?'var(--primary-contrast)':btnCol}">
              ${selected ? '✓' : '+'}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:${btnCol};margin-bottom:3px">${ic.name}</div>
              <div style="font-size:11px;color:var(--text-muted);line-height:1.4">${ic.description||'—'}</div>
              ${ic.difficultyStage ? `<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-top:3px">${ic.difficultyStage}</div>` : ''}
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  results.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="color:var(--purple);font-size:10px;font-weight:600">✦ IC suggestions · ${dlState.selectedSubject}</span>
      <span style="font-size:11px;color:var(--text3);font-style:italic;flex:1">${reasoning}</span>
    </div>
    ${groupedHtml}
    <div style="font-size:10px;color:var(--text3);margin-top:6px">Click any IC to add it to your session — selected ICs unlock the IC Outcomes step</div>
    <div style="text-align:center;padding-top:8px;margin-top:4px;border-top:1px solid var(--border)">
      <button onclick="openStubICModal()"
        style="background:none;border:none;color:var(--text3);font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif;text-decoration:underline;padding:3px 0;opacity:0.8">
        Can't find the IC? Create a draft.
      </button>
    </div>`;

  btn.textContent = 'Suggest ICs'; btn.disabled = false;
}

function dlAddAISuggestedIC(icId) {
  const idx = dlState.selectedICs.indexOf(icId);
  if (idx >= 0) dlState.selectedICs.splice(idx, 1);
  else dlState.selectedICs.push(icId);

  // Auto-add/remove the IC's homeDescriptorId from selectedCodes
  dlRecalcSelectedCodes();

  // Refresh chips and code list so the auto-added code / "via IC" badge appear immediately
  const chips = document.getElementById('dl-selected-chips');
  if (chips) chips.innerHTML = buildDlSelectedChips();
  dlFilterCodes();

  const selected = dlState.selectedICs.includes(icId);
  const ic = state.instructionalComponents.find(x => x.id === icId);
  const subjCol = subjectCol(dlState.selectedSubject) || 'var(--purple)';
  const btnCol = selected ? 'var(--green)' : subjCol;
  const btnBg  = selected ? 'var(--green-dim)' : 'var(--surface-alt)';

  const chip = document.getElementById('dl-ai-ic-chip-' + icId);
  if (chip) {
    chip.style.borderColor = btnCol;
    chip.style.background  = btnBg;
    const circle = chip.querySelector('div');
    if (circle) {
      circle.style.borderColor = btnCol;
      circle.style.background  = selected ? btnCol : 'none';
      circle.style.color       = selected ? 'var(--primary-contrast)' : btnCol;
      circle.textContent       = selected ? '✓' : '+';
    }
    const nameSpan = chip.querySelector('div > div');
    if (nameSpan) nameSpan.style.color = btnCol;
  }

  // Update the Next button label
  const btn = document.querySelector('#dl-overlay button[onclick="dlNext()"]');
  if (btn && dlState.step === 2) {
    btn.textContent = dlStep2NextLabel();
  }
}

function dlAddAISuggested(code) {
  const idx = dlState.manualCodes.indexOf(code);
  if (idx < 0) dlState.manualCodes.push(code);
  else dlState.manualCodes.splice(idx, 1);
  dlRecalcSelectedCodes();
  const selected = dlState.selectedCodes.includes(code);
  const cd = state.curriculumCodes.find(c => c.Code === code);
  const col    = subjectCol(cd?.Subject) || 'var(--purple)';
  const btnCol = selected ? 'var(--green)' : col;
  const btnBg  = selected ? 'var(--green-dim)' : 'var(--surface-alt)';

  // Update the card button appearance
  const chip = document.getElementById('dl-ai-chip-' + code);
  if (chip) {
    chip.style.borderColor = btnCol;
    chip.style.background  = btnBg;
    // Update the circle indicator (first child div)
    const circle = chip.querySelector('div');
    if (circle) {
      circle.style.borderColor = btnCol;
      circle.style.background  = selected ? btnCol : 'none';
      circle.style.color       = selected ? 'var(--primary-contrast)' : btnCol;
      circle.textContent       = selected ? '✓' : '+';
    }
    // Update code text colour
    const codeSpan = chip.querySelector('span');
    if (codeSpan) codeSpan.style.color = btnCol;
  }

  // Update the selected chips row at top of code list
  const chips = document.getElementById('dl-selected-chips');
  if (chips) chips.innerHTML = buildDlSelectedChips();

  // Update footer next button
  const btn = document.querySelector('#dl-overlay button[onclick="dlNext()"]');
  if (btn) btn.textContent = dlStep2NextLabel();

  // Also highlight the row in the code list if it's visible
  const row = document.querySelector(`[data-dl-code="${code}"]`);
  if (row) {
    row.style.background = selected ? 'var(--blue-dim)' : 'transparent';
    const box = row.querySelector('div');
    if (box) {
      box.style.borderColor = selected ? 'var(--blue)' : 'var(--border2)';
      box.style.background  = selected ? 'var(--blue)' : 'none';
      box.innerHTML = selected ? '<span style="color:var(--primary-contrast);font-size:10px;font-weight:700">✓</span>' : '';
    }
  }
}

// ── STEP 3: QUICK MASTERY ──
function dlToggleStep4Sort() {
  state.studentSortBy = state.studentSortBy === 'last_name' ? 'first_name' : 'last_name';
  const body = document.getElementById('dl-body');
  if (body) body.innerHTML = buildDlStep4();
}

function dlMarkAllForCode(code, mastery) {
  const eligible = (dlState.readyForMastery || [])
    .filter(r => r.descriptorId === code)
    .map(r => r.student.id);
  const presentStudents = sortStudents(state.students.filter(s =>
    !dlState.absentIds.has(s.id) && eligible.includes(s.id)
  ));
  presentStudents.forEach(s => {
    const key = s.id + '|' + code;
    if (mastery === null) delete dlState.masteryMap[key];
    else dlState.masteryMap[key] = mastery;
  });
  const body = document.getElementById('dl-body');
  if (body) body.innerHTML = buildDlStep4();
}

function dlSetMastery(studentId, code, mastery) {
  const key = studentId + '|' + code;
  if (mastery === null) delete dlState.masteryMap[key];
  else dlState.masteryMap[key] = mastery;
  const body = document.getElementById('dl-body');
  if (body) body.innerHTML = buildDlStep4();
}

function dlSkipQuickMastery() {
  dlState.masteryMap = {};
  saveDailyLog();
}

// ── STEP 3: CLASS SCAN ──
// Returns the strand of the first selected IC for this session (used for strand history dots).
function dlGetCurrentStrand() {
  if (!dlState.selectedICs.length) return null;
  const firstIC = state.instructionalComponents.find(ic => ic.id === dlState.selectedICs[0]);
  if (!firstIC) return null;
  const cd = state.curriculumCodes.find(c => c.Code === firstIC.homeDescriptorId);
  return cd ? (cd.Strand || null) : null;
}

// Returns dot colour and tooltip for a student's recent IC outcome ratio in a strand.
// Reads state.taughtICs for got_it / needs_review records in the current school year.
function dlGetStrandDot(studentId, strand) {
  if (!strand) return null;
  const currentYear = new Date().getFullYear().toString();
  const relevant = state.taughtICs.filter(t => {
    if (t.student_id !== studentId) return false;
    if (!t.date || !t.date.startsWith(currentYear)) return false;
    if (t.status !== 'got_it' && t.status !== 'needs_review') return false;
    const ic = state.instructionalComponents.find(x => x.id === t.ic_id);
    if (!ic) return false;
    const cd = state.curriculumCodes.find(c => c.Code === ic.homeDescriptorId);
    return cd && cd.Strand === strand;
  });
  if (!relevant.length) return null; // grey — no prior data
  const gotIt = relevant.filter(t => t.status === 'got_it').length;
  const ratio = gotIt / relevant.length;
  if (ratio > 0.6) return { colour: 'var(--green)', title: 'Predominantly got it in this strand recently' };
  if (ratio >= 0.4) return { colour: 'var(--gold)', title: 'Mixed signal in this strand recently' };
  return { colour: 'var(--rust)', title: 'Predominantly needs review in this strand recently' };
}

function buildDlStep3() {
  const presentStudents = sortStudents(state.students.filter(s => !dlState.absentIds.has(s.id)));
  const ics = dlState.selectedICs
    .map(id => state.instructionalComponents.find(ic => ic.id === id))
    .filter(Boolean);

  if (!ics.length) return `<div class="empty-state" style="padding:40px"><div class="empty-icon">◈</div><div class="empty-title">No ICs selected</div></div>`;

  const subjectOfIC = (ic) => {
    const cd = state.curriculumCodes.find(c => c.Code === ic.homeDescriptorId);
    return cd ? (cd.Subject || '') : '';
  };
  const subjects = [...new Set(ics.map(subjectOfIC).filter(Boolean))];
  if (!dlState.scanSubjectFilter || !subjects.includes(dlState.scanSubjectFilter)) {
    dlState.scanSubjectFilter = subjects[0] || '';
  }
  const visibleICs = ics.filter(ic => subjectOfIC(ic) === dlState.scanSubjectFilter);

  const nGotIt = Object.entries(dlState.icScanMap)
    .filter(([k, v]) => v === 'got_it' && visibleICs.some(ic => k.endsWith('|' + ic.id))).length;
  const nNeedsReview = Object.entries(dlState.icScanMap)
    .filter(([k, v]) => v === 'needs_review' && visibleICs.some(ic => k.endsWith('|' + ic.id))).length;

  const subjectTabs = subjects.map(subj => {
    const active = subj === dlState.scanSubjectFilter;
    const col = subjectCol(subj);
    return `<button onclick="dlScanSetSubject('${subj.replace(/'/g, "\\'")}')"
      style="padding:4px 12px;border-radius:4px;border:1px solid ${active ? col : 'var(--border2)'};
      background:${active ? col + '22' : 'none'};color:${active ? col : 'var(--text3)'};
      font-size:11px;cursor:pointer;font-family:'Instrument Sans',sans-serif;font-weight:${active ? '600' : '400'}">
      ${subj}
    </button>`;
  }).join('');

  const colHeaders = visibleICs.map(ic => {
    const selected = dlState.selectedScanIC === ic.id;
    const fullName = ic.name || ic.id;
    const shortName = fullName.length > 28 ? fullName.slice(0, 28) + '…' : fullName;
    return `<th onclick="dlScanSelectIC('${ic.id}')"
      title="${escapeHtml(fullName)}"
      style="padding:8px 10px;min-width:120px;max-width:160px;text-align:center;
      border-bottom:2px solid ${selected ? 'var(--blue)' : 'var(--border)'};
      background:${selected ? 'var(--blue-dim)' : 'var(--surface-alt)'};
      cursor:pointer;font-size:11px;font-weight:600;color:${selected ? 'var(--blue)' : 'var(--text-muted)'};
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:none">
      ${escapeHtml(shortName)}
    </th>`;
  }).join('');

  const studentRows = presentStudents.map((s, si) => {
    const cells = visibleICs.map(ic => {
      const key = s.id + '|' + ic.id;
      const status = dlState.icScanMap[key] || 'taught';
      const selected = dlState.selectedScanIC === ic.id;
      let bg, dot, title;
      if (status === 'got_it') { bg = 'var(--green)'; dot = '●'; title = 'Got it'; }
      else if (status === 'needs_review') { bg = 'var(--rust)'; dot = '○'; title = 'Needs review'; }
      else { bg = 'transparent'; dot = '·'; title = 'Taught'; }
      return `<td onclick="dlScanCycleCell('${s.id}','${ic.id}')"
        title="${title}"
        style="padding:6px;text-align:center;border-bottom:1px solid var(--border);
        border-left:1px solid var(--border);cursor:pointer;
        background:${selected ? 'var(--blue-dim)' : 'transparent'}">
        <div style="width:28px;height:28px;border-radius:50%;background:${bg};
          margin:auto;display:flex;align-items:center;justify-content:center;
          font-size:14px;color:${status !== 'taught' ? 'var(--primary-contrast)' : 'var(--text3)'}">
          ${dot}
        </div>
      </td>`;
    }).join('');
    return `<tr style="background:${getStripedRowSurface(si)}">
      <td style="padding:8px 12px;border-bottom:1px solid var(--border);
        white-space:nowrap;position:sticky;left:0;background:${getStripedRowSurface(si)};z-index:1">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="sc-avatar ${getAvClass(si)}" style="width:24px;height:24px;font-size:10px;flex-shrink:0">${getInitials(s)}</div>
          <span style="font-size:12px;font-weight:600;color:var(--text)">${s.first_name} <span style="font-weight:400;color:var(--text3)">${s.last_name}</span></span>
        </div>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  const bulkButtons = dlState.selectedScanIC ? `
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em">Selected column:</span>
      <button onclick="dlScanBulkSet('got_it')" style="padding:4px 12px;border-radius:4px;border:1px solid var(--green);background:var(--green-dim);color:var(--green);font-size:11px;font-weight:600;cursor:pointer">All got it</button>
      <button onclick="dlScanBulkSet('needs_review')" style="padding:4px 12px;border-radius:4px;border:1px solid var(--rust);background:var(--rust-dim);color:var(--rust);font-size:11px;font-weight:600;cursor:pointer">All needs review</button>
      <button onclick="dlScanBulkSet('taught')" style="padding:4px 12px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:11px;cursor:pointer">Clear column</button>
    </div>` : `<div style="font-size:11px;color:var(--text3)">Click a column header to select it for bulk actions — or tap individual cells to cycle outcomes.</div>`;

  return `
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
      Tap a cell to cycle: <strong style="color:var(--text)">taught</strong> (default) → <strong style="color:var(--green)">got it</strong> → <strong style="color:var(--rust)">needs review</strong> → taught. Click a column header to select it for bulk actions.
    </div>
    ${subjects.length > 1 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${subjectTabs}</div>` : ''}
    <div style="margin-bottom:10px">${bulkButtons}</div>
    <div id="dl-scan-table-wrap" style="overflow-x:auto;overflow-y:auto;max-height:50vh;border:1px solid var(--border);border-radius:6px">
      <table style="border-collapse:collapse;min-width:${180 + visibleICs.length * 130}px;width:100%">
        <thead style="position:sticky;top:0;z-index:2;background:var(--surface-alt)">
          <tr>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid var(--border);position:sticky;left:0;background:var(--surface-alt);z-index:3;min-width:160px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase">Student</th>
            ${colHeaders}
          </tr>
        </thead>
        <tbody>${studentRows}</tbody>
      </table>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:8px;display:flex;gap:16px">
      <span>${presentStudents.length} students · ${visibleICs.length} ICs shown</span>
      ${nGotIt ? `<span style="color:var(--green)">● ${nGotIt} got it</span>` : ''}
      ${nNeedsReview ? `<span style="color:var(--rust)">● ${nNeedsReview} needs review</span>` : ''}
    </div>`;
}

function dlScanSetSubject(subject) {
  dlState.scanSubjectFilter = subject;
  dlState.selectedScanIC = null;
  const body = document.getElementById('dl-body');
  if (body) body.innerHTML = buildDlStep3();
}

function dlScanSelectIC(icId) {
  dlState.selectedScanIC = dlState.selectedScanIC === icId ? null : icId;
  const body = document.getElementById('dl-body');
  if (body) body.innerHTML = buildDlStep3();
}

function dlScanCycleCell(studentId, icId) {
  const key = studentId + '|' + icId;
  const current = dlState.icScanMap[key] || 'taught';
  const cycle = { 'taught': 'got_it', 'got_it': 'needs_review', 'needs_review': 'taught' };
  const next = cycle[current];
  if (next === 'taught') delete dlState.icScanMap[key];
  else dlState.icScanMap[key] = next;
  const wrap = document.getElementById('dl-scan-table-wrap');
  const scrollTop = wrap ? wrap.scrollTop : 0;
  const scrollLeft = wrap ? wrap.scrollLeft : 0;
  const body = document.getElementById('dl-body');
  if (body) body.innerHTML = buildDlStep3();
  const newWrap = document.getElementById('dl-scan-table-wrap');
  if (newWrap) { newWrap.scrollTop = scrollTop; newWrap.scrollLeft = scrollLeft; }
}

function dlScanBulkSet(status) {
  const presentStudents = state.students.filter(s => !dlState.absentIds.has(s.id));
  const icId = dlState.selectedScanIC;
  if (!icId) return;
  presentStudents.forEach(s => {
    const key = s.id + '|' + icId;
    if (status === 'taught') delete dlState.icScanMap[key];
    else dlState.icScanMap[key] = status;
  });
  const body = document.getElementById('dl-body');
  if (body) body.innerHTML = buildDlStep3();
}

// ── STEP 4: QUICK MASTERY (conditional — only students at ≥80% IC coverage) ──
function buildDlStep4() {
  const readyItems = dlState.readyForMastery || [];
  if (!readyItems.length) return `<div class="empty-state" style="padding:40px"><div class="empty-icon">◈</div><div class="empty-title">No students ready</div><div class="empty-sub">No students have reached 80% IC coverage yet</div></div>`;

  // Unique students and descriptors from the ready list
  const studentIds = [...new Set(readyItems.map(r => r.student.id))];
  const descriptorIds = [...new Set(readyItems.map(r => r.descriptorId))];
  const students = sortStudents(studentIds.map(id => readyItems.find(r => r.student.id === id).student));

  const masteryColours = {
    'Achieved':  { col:'var(--green)', bg:'var(--green-dim)', dot:'●' },
    'Developing':{ col:'var(--gold)',  bg:'var(--gold-dim)',  dot:'◐' },
    'Emerging':  { col:'var(--rust)',  bg:'var(--rust-dim)',  dot:'○' },
  };
  const codeHeaders = descriptorIds.map(code => {
    const cd = state.curriculumCodes.find(c => c.Code === code);
    const col = subjectCol(cd?.Subject) || 'var(--blue)';
    const descriptor = cd ? (cd.Descriptor || cd.Aspect || '') : '';
    const entry = readyItems.find(r => r.descriptorId === code);
    return `<th style="padding:0;text-align:left;border-bottom:1px solid var(--border);min-width:180px;max-width:240px;vertical-align:bottom;border-left:1px solid var(--border)">
      <div style="display:flex;flex-direction:column;height:100%;padding:10px 12px;min-height:140px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${col}">${code}</span>
          ${cd?.Subject ? `<span style="font-size:8px;background:${col}22;color:${col};padding:1px 5px;border-radius:3px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.05em">${cd.Subject.slice(0,4)}</span>` : ''}
          <span style="font-size:8px;background:var(--green-dim);color:var(--green);padding:1px 5px;border-radius:3px;font-family:'DM Mono',monospace">${entry ? Math.round(entry.taughtCount/entry.total*100) : 0}% ICs</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);line-height:1.4;flex:1;font-weight:400;font-family:'Instrument Sans',sans-serif">${descriptor}</div>
        <div style="display:flex;flex-direction:column;gap:3px;margin-top:8px">
          ${[
            {m:'Achieved',  dot:'●', label:'All Achieved'},
            {m:'Developing',dot:'◐', label:'All Developing'},
            {m:'Emerging',  dot:'○', label:'All Emerging'},
          ].map(({m, dot, label}) => {
            const {col: mc, bg} = masteryColours[m];
            return `<button onclick="dlMarkAllForCode('${code}','${m}')"
              style="padding:4px 8px;border-radius:4px;border:1px solid ${mc};background:${bg};color:${mc};
              font-size:10px;cursor:pointer;width:100%;display:flex;align-items:center;gap:6px;font-family:'Instrument Sans',sans-serif;font-weight:600">
              <span style="font-size:12px;flex-shrink:0">${dot}</span>
              <span>${label}</span>
            </button>`;
          }).join('')}
          <button onclick="dlMarkAllForCode('${code}',null)"
            style="padding:4px 8px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);
            font-size:10px;cursor:pointer;width:100%;display:flex;align-items:center;gap:6px;font-family:'Instrument Sans',sans-serif">
            <span style="font-size:12px;flex-shrink:0">✕</span>
            <span>Clear all</span>
          </button>
        </div>
      </div>
    </th>`;
  }).join('');

  const studentRows = students.map((s, si) => {
    const cells = descriptorIds.map(code => {
      // Only render a cell if this student is in the ready list for this descriptor
      const isReady = readyItems.some(r => r.student.id === s.id && r.descriptorId === code);
      if (!isReady) {
        return `<td style="padding:5px 8px;text-align:center;border-bottom:1px solid var(--border);border-left:1px solid var(--border)">
          <div style="font-size:9px;color:var(--text3);font-family:'DM Mono',monospace">—</div>
        </td>`;
      }
      const key     = s.id + '|' + code;
      const current = dlState.masteryMap[key] || null;
      const opts    = ['Achieved','Developing','Emerging'].map(m => {
        const {col, bg, dot} = masteryColours[m];
        const active = current === m;
        return `<button onclick="dlSetMastery('${s.id}','${code}','${m}')"
          title="${m}"
          style="width:28px;height:28px;border-radius:4px;border:1px solid ${active?col:'var(--border2)'};background:${active?bg:'none'};color:${active?col:'var(--text3)'};font-size:13px;cursor:pointer;transition:all 0.1s;display:flex;align-items:center;justify-content:center">
          ${dot}
        </button>`;
      }).join('');
      return `<td style="padding:5px 8px;text-align:center;border-bottom:1px solid var(--border);border-left:1px solid var(--border)">
        <div style="display:flex;gap:3px;justify-content:center">${opts}</div>
      </td>`;
    }).join('');

    return `<tr style="background:${getStripedRowSurface(si)}">
      <td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;position:sticky;left:0;background:${getStripedRowSurface(si)}">
        <div style="display:flex;align-items:center;gap:7px">
          <div class="sc-avatar ${getAvClass(si)}" style="width:22px;height:22px;font-size:9px;flex-shrink:0">${getInitials(s)}</div>
          <span style="font-size:12px;color:var(--text-muted)">${s.first_name} ${s.last_name}</span>
        </div>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <div style="font-size:12px;color:var(--text3);padding:10px 12px;background:var(--green-dim);border:1px solid var(--green);border-radius:6px;margin-bottom:12px">
      These students have been taught 80% or more of the ICs for the following descriptors. You can record a mastery judgment now or skip.
    </div>
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:6px">
      <table style="width:100%;border-collapse:collapse;min-width:${200 + descriptorIds.length * 200}px">
        <thead>
          <tr style="background:var(--surface-alt)">
            <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border);position:sticky;left:0;background:var(--surface-alt);font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;min-width:160px;vertical-align:bottom">
              <div style="display:flex;align-items:center;gap:6px">
                <span>STUDENT</span>
                <button onclick="dlToggleStep4Sort()"
                  style="padding:2px 7px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:10px;cursor:pointer;white-space:nowrap;font-family:'Instrument Sans',sans-serif;text-transform:none;letter-spacing:0">
                  ${state.studentSortBy === 'last_name' ? '↕ Last, First' : '↕ First, Last'}
                </button>
              </div>
            </th>
            ${codeHeaders}
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:8px">
      ${students.length} students · ${descriptorIds.length} descriptors · ${Object.keys(dlState.masteryMap).length} mastery judgments set
    </div>
  `;
}

// ── 80% IC COVERAGE GATE ──
function dlGetStudentsReadyForMastery() {
  const presentStudents = state.students.filter(s => !dlState.absentIds.has(s.id));
  const ready = [];

  const descriptorIds = [...new Set(
    (dlState.selectedICs || []).map(icId => {
      const ic = state.instructionalComponents.find(x => x.id === icId);
      return ic ? ic.homeDescriptorId : null;
    }).filter(Boolean)
  )];

  descriptorIds.forEach(descriptorId => {
    const systemDefaults = getSystemDefaultICsForDescriptor(descriptorId);
    if (!systemDefaults.length) return;
    const threshold = systemDefaults.length * 0.8;

    presentStudents.forEach(student => {
      const taughtCount = systemDefaults.filter(ic => {
        // Any classScan status (taught/got_it/needs_review) means the IC was taught in session.
        // If IC is in selectedICs, it was taught to all present students in this session.
        const inSession = dlState.selectedICs.includes(ic.id);
        const inRecords = state.taughtICs.some(t =>
          t.student_id === student.id &&
          t.ic_id === ic.id &&
          (t.status === 'taught' || t.status === 'got_it' || t.status === 'needs_review' ||
           t.status === 'mastered') // legacy value kept for backward compat
        );
        return inSession || inRecords;
      }).length;

      if (taughtCount >= threshold) {
        ready.push({ student, descriptorId, taughtCount, total: systemDefaults.length });
      }
    });
  });

  return ready;
}

// ── NAVIGATION ──
function dlBack() {
  if (dlState.step > 1) { dlState.step--; renderDlModal(); }
}

function dlNext() {
  if (dlState.step === 1) {
    dlState.step = 2;
    renderDlModal();
  } else if (dlState.step === 2) {
    if (!dlState.selectedCodes.length) { toast('Select at least one code taught today', 'error'); return; }
    if (dlState.selectedICs.length > 0) {
      dlState.step = 3;
      renderDlModal();
    } else {
      saveDailyLog();
    }
  } else if (dlState.step === 3) {
    const ready = dlGetStudentsReadyForMastery();
    dlState.readyForMastery = ready;
    if (ready.length > 0) {
      dlState.step = 4;
      renderDlModal();
    } else {
      dlState.masteryMap = {};
      saveDailyLog();
      toast('Session saved. No students have reached the 80% IC threshold for a mastery judgment yet.', 'success');
    }
  } else {
    saveDailyLog();
  }
}

// ── SAVE ──
async function saveDailyLog() {
  // Capture icScanMap before modal teardown: keys are studentId+'|'+icId → 'got_it'|'needs_review'.
  // Absent from the map means the teacher left that cell as 'taught' (default).
  const icScanSnapshot = Object.assign({}, dlState.icScanMap);
  const sessionICs   = dlState.selectedICs.slice();  // freeze IC list too

  closeDlModal();
  const presentStudents = state.students.filter(s => !dlState.absentIds.has(s.id));
  const entries = [];

  presentStudents.forEach(s => {
    dlState.selectedCodes.forEach(code => {
      entries.push({
        date: dlState.date,
        student_id: s.id,
        code,
        notes: dlState.masteryMap[s.id + '|' + code] || ''
      });
    });
  });

  if (!entries.length) { toast('Nothing to save', 'error'); return; }

  toast(`Saving ${entries.length} taught records…`, 'success');
  setSyncing(true);
  let saved = 0;

  try {
    const result = await apiCall('saveTaughtLog', { entries });
    if (result.success) {
      // Add to local state
      entries.forEach((e, i) => {
        state.taughtLog.push({
          id: result.ids ? result.ids[i] : ('local_' + Date.now() + '_' + i),
          date: e.date,
          student_id: e.student_id,
          code: e.code,
          notes: e.notes
        });
      });
      saved = entries.length;
    }
  } catch(err) {
    // Fallback: save locally so session isn't lost
    entries.forEach((e, i) => {
      state.taughtLog.push({ id: 'local_' + Date.now() + '_' + i, ...e });
    });
    saved = entries.length;
    toast('Saved locally (Sheets sync failed)', 'error');
  }

  // Also save any mastery ratings through the existing progress flow
  const masteryEntries = Object.entries(dlState.masteryMap);
  for (const [key, mastery] of masteryEntries) {
    const [studentId, code] = key.split('|');
    if (!mastery) continue;
    try {
      await saveProgress({
        student_id: studentId,
        content_descriptor_code: code,
        mastery_level: mastery,
        date_assessed: dlState.date,
        teacher_notes: 'Logged via daily session'
      });
    } catch(e) { console.warn('Could not save mastery for', key); }
  }

  // Save IC class scan records — one row per student per IC (batch write)
  // All three statuses (taught / got_it / needs_review) mean the IC was taught;
  // default is 'taught' for any student not explicitly flagged in the scan step.
  // NOTE: Apps Script saveTaughtICs validation must accept 'got_it' and 'needs_review'
  //       in addition to 'taught'. Without that update, new values silently write as 'taught'.
  const icEntries = [];
  if (sessionICs.length) {
    presentStudents.forEach(student => {
      sessionICs.forEach(icId => {
        const status = icScanSnapshot[student.id + '|' + icId] || 'taught';
        icEntries.push({ date: dlState.date, student_id: student.id, ic_id: icId, status, notes: '' });
      });
    });
  }
  if (icEntries.length) {
    try {
      await saveTaughtICsBatch(icEntries);
    } catch(e) {
      console.warn('IC class scan save failed:', e);
    }
  }

  setSyncing(false);
  checkDailyLogBadge();
  let icNote = '';
  if (icEntries.length) {
    const nGotIt       = Object.values(icScanSnapshot).filter(v => v === 'got_it').length;
    const nNeedsReview = Object.values(icScanSnapshot).filter(v => v === 'needs_review').length;
    const nTaught      = (sessionICs.length * presentStudents.length) - nGotIt - nNeedsReview;
    const parts = [];
    if (nGotIt)       parts.push(`${nGotIt} got it`);
    if (nNeedsReview) parts.push(`${nNeedsReview} needs review`);
    if (nTaught)      parts.push(`${nTaught} taught`);
    icNote = ` · IC scan: ${parts.join(', ')}`;
  }
  toast(`✓ Session logged — ${saved} codes taught to ${presentStudents.length} students${icNote}`, 'success');
  renderView();
}

// ── TAUGHT HELPERS ──
function wasCodeTaughtToStudent(studentId, code) {
  return state.taughtLog.some(t => t.student_id === studentId && t.code === code);
}

function getTaughtDatesForCode(studentId, code) {
  return state.taughtLog
    .filter(t => t.student_id === studentId && t.code === code)
    .map(t => t.date)
    .sort()
    .reverse();
}

function getUntaughtCodes(studentId, yearLevel) {
  const csvYear = YLM[normaliseYear(yearLevel)] || yearLevel;
  return state.curriculumCodes.filter(c =>
    (c['Year Level']||'').trim() === (BANDED_SUBJECTS.has(c.Subject) ? bandYearLevel(csvYear) : csvYear) &&
    !wasCodeTaughtToStudent(studentId, c.Code)
  );
}

function getTaughtICStatus(studentId, icId) {
  const records = state.taughtICs.filter(
    t => t.student_id === studentId && t.ic_id === icId
  );
  if (!records.length) return null;
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  return records[0].status;
}

// Collapse a set of per-IC statuses into one OR-rolled status (Option A): any got_it
// wins, then needs_review, then taught, else null. Shared by the linked-IC rollup
// (Bulk Assess badge) and the Coverage Gaps linked-IC counting so they stay in step.
function rollUpICStatuses(statuses) {
  if (statuses.includes('got_it') || statuses.includes('mastered')) return 'got_it';
  if (statuses.includes('needs_review') || statuses.includes('not_yet')) return 'needs_review';
  if (statuses.includes('taught')) return 'taught';
  return null;
}

// Best IC status a student has across every IC that lists descriptorId in its
// linkedDescriptorIds (tethered skill ICs — e.g. Science inquiry — homed under a
// knowledge CD but surfacing evidence against the linked inquiry CD).
// OR rollup (Option A): got_it on any one linked IC = met. Display/evidence only;
// these ICs are optional and never feed the 80% mastery gate.
function getLinkedICStatusForDescriptor(studentId, descriptorId) {
  const linkedICs = state.instructionalComponents.filter(ic =>
    !ic.isArchived &&
    !(ic.ownerTier === 'system_default' && ic.suppressedByTeacher) &&
    ic.linkedDescriptorIds.includes(descriptorId)
  );
  if (!linkedICs.length) return null;
  return rollUpICStatuses(linkedICs.map(ic => getTaughtICStatus(studentId, ic.id)).filter(Boolean));
}

function getICsForDescriptorAndYears(descriptorId, yearLevels) {
  return state.instructionalComponents.filter(ic =>
    !ic.isArchived &&
    !(ic.ownerTier === 'system_default' && ic.suppressedByTeacher) &&
    (ic.homeDescriptorId === descriptorId || ic.linkedDescriptorIds.includes(descriptorId)) &&
    (yearLevels.length === 0 || yearLevels.some(y => {
      const cd = state.curriculumCodes.find(c => c.Code === ic.homeDescriptorId);
      return cd && (cd['Year Level'] === y);
    }))
  );
}

// ── SESSION HISTORY VIEW ──
function renderDailyLog(main) {
  // Group log entries by date
  const byDate = {};
  state.taughtLog.forEach(t => {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  });
  const dates = Object.keys(byDate).sort().reverse();

  main.innerHTML = `
    <div class="topbar" style="flex-wrap:wrap;gap:10px;padding:14px 24px">
      <div class="topbar-title">Session History</div>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn" style="border-color:var(--gold);color:var(--gold)" onclick="openDailyLogWizard()">✦ Log Today</button>
      </div>
    </div>
    <div class="content">
      ${dates.length === 0
        ? `<div class="empty-state" style="padding:80px">
            <div class="empty-icon">◷</div>
            <div class="empty-title">No sessions logged yet</div>
            <div class="empty-sub">Use "Log Today" each day to record which codes were taught and to whom.</div>
            <button class="btn btn-primary" style="margin-top:12px" onclick="openDailyLogWizard()">✦ Log Today</button>
          </div>`
        : dates.map(date => {
            const entries = byDate[date];
            const codes   = [...new Set(entries.map(e => e.code))];
            const studs   = [...new Set(entries.map(e => e.student_id))];
            const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-AU', {weekday:'long',day:'numeric',month:'long'});
            const today = new Date().toISOString().split('T')[0];
            return `
              <div class="card" style="margin-bottom:14px">
                <div class="card-head" style="cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
                  <div style="display:flex;align-items:center;gap:12px">
                    <div>
                      <div class="card-title">${dateLabel} ${date===today?'<span style="font-family:\'DM Mono\',monospace;font-size:9px;background:var(--gold-dim);color:var(--gold);padding:1px 6px;border-radius:4px;margin-left:6px">TODAY</span>':''}</div>
                      <div style="font-size:11px;color:var(--text3);margin-top:2px">${codes.length} codes · ${studs.length} students</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${codes.slice(0,6).map(code => `<span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 6px;border-radius:3px;background:var(--blue-dim);color:var(--blue)">${code}</span>`).join('')}
                    ${codes.length > 6 ? `<span style="font-size:10px;color:var(--text3)">+${codes.length-6} more</span>` : ''}
                  </div>
                </div>
                <div style="padding:12px 18px">
                  <table style="width:100%;border-collapse:collapse;font-size:11px">
                    <thead><tr>
                      <th style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-align:left;padding:6px 8px;border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:0.1em">Student</th>
                      <th style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-align:left;padding:6px 8px;border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:0.1em">Codes Taught</th>
                      <th style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);text-align:left;padding:6px 8px;border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:0.1em">Mastery Logged</th>
                    </tr></thead>
                    <tbody>
                      ${studs.map(sid => {
                        const s = state.students.find(x => x.id === sid);
                        if (!s) return '';
                        const sEntries = entries.filter(e => e.student_id === sid);
                        const sCodes = sEntries.map(e => e.code);
                        const sMastery = sEntries.filter(e => e.notes && e.notes !== '');
                        return `<tr style="border-bottom:1px solid var(--border)">
                          <td style="padding:6px 8px;color:var(--text-muted)">${s.first_name} ${s.last_name}</td>
                          <td style="padding:6px 8px">
                            <div style="display:flex;gap:4px;flex-wrap:wrap">
                              ${sCodes.map(c => `<span style="font-family:'DM Mono',monospace;font-size:9px;padding:1px 5px;border-radius:3px;background:var(--blue-dim);color:var(--blue)">${c}</span>`).join('')}
                            </div>
                          </td>
                          <td style="padding:6px 8px">
                            ${sMastery.length
                              ? sMastery.map(e => `<span style="font-size:10px;color:${e.notes==='Achieved'?'var(--green)':e.notes==='Developing'?'var(--gold)':'var(--rust)'}">${e.notes}</span>`).join(', ')
                              : `<span style="color:var(--text3);font-size:10px">—</span>`}
                          </td>
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>`;
          }).join('')
      }
    </div>
  `;
}



// ════════════════════════════════════════════════════
// ── DATE / WEEK UTILITIES (shared) ──
// ════════════════════════════════════════════════════

function toIsoDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDateLocal(isoDate) {
  if (!isValidIsoDate(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getWeekStart(dateLike = new Date()) {
  const d = new Date(dateLike);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDaysToDate(isoDate, days) {
  const d = parseIsoDateLocal(isoDate);
  if (!d) return toIsoDate(getWeekStart());
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === (month - 1) && d.getDate() === day;
}

function plannerNormalizeWeekStart(value) {
  if (!isValidIsoDate(value)) return toIsoDate(getWeekStart());
  return toIsoDate(getWeekStart(parseIsoDateLocal(value)));
}

// ── Apps Script additions needed ──
console.info(
  `%cClassTracker v${APP_VERSION} — Apps Script update needed\n\n` +
  'Add these sheets to your Google Spreadsheet:\n' +
  '  StandardsJudgments — A:id B:student_id C:standard_id D:judgment E:locked F:date G:notes H:period\n' +
  '  ProgressionPlacements — A:id B:student_id C:element D:sub_element E:level F:date G:notes H:ext_label I:ext_value\n\n' +
  'Open browser console after deploying to see full Apps Script code.',
  'color:#60a5fa;font-family:monospace;font-size:11px'
);

// One-time clean start for the consolidated planner (step 1). The legacy planning
// surfaces (lessonPlans v1, weeklyPlanner, planLog) are retired and their data is
// intentionally not migrated — see ARCHITECTURE-ASSESSMENT.md step 1.
function plannerWipeLegacyPlanningData() {
  try {
    if (localStorage.getItem('ct_planner_v2_wiped')) return;
    ['ct_planner_lesson_plans_v1', 'ct_weekly_planner_v1', 'ct_plan_log_entries'].forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    localStorage.setItem('ct_planner_v2_wiped', '1');
  } catch (e) {}
}

async function init() {
  const verEl = document.getElementById('sidebar-version');
  if (verEl) verEl.textContent = APP_VERSION;
  initTheme();
  initTextSize();
  loadAssessmentScale();

  const uiState = loadUIState();
  setCurrentView(uiState.currentView, { persist: false });

  // Clean start for the consolidated planner (step 1): wipe retired surfaces' data.
  plannerWipeLegacyPlanningData();

  // Show loading message
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = `<div class="loading"><div class="spinner"></div><div style="margin-top:12px;color:var(--text3);font-size:13px">Loading your data…</div></div>`;

  // Run Sheets fetch and CSV fetch in parallel.
  // Try the fast batched getAll first; fall back to individual calls
  // if the Apps Script hasn't been updated yet.
  const sheetsLoad = (async () => {
    try {
      await loadAll();
    } catch(e) {
      console.warn('getAll not available or failed, falling back to individual calls:', e);
      await Promise.allSettled([
        loadStudents(), loadProgress(), loadTaughtLog(),
        loadStandardsJudgments(), loadProgressionPlacements(), loadTaughtICs()
      ]);
    }
  })();

  const [sheetsResult, csvResult] = await Promise.allSettled([
    sheetsLoad,
    fetchAllCSVs()
  ]);

  if (sheetsResult.status === 'rejected') console.warn('Sheets load failed:', sheetsResult.reason);
  if (csvResult.status   === 'rejected') console.warn('CSV load failed:',    csvResult.reason);

  buildDescriptorIndex();
  // Load persisted stubs after CSVs — stub wins on any ID collision
  try {
    await loadStubICsFromSheets();
  } catch(e) {
    console.warn('[StubIC] Failed to load stubs from Sheets:', e);
  }
  state.loading = false;
  renderView();
  checkDailyLogBadge();
  updateStubBadge();
  checkStubBanner();

  // Drive backup sync: load from localStorage above already made the app usable,
  // so the Drive check runs in the background and never blocks rendering.
  driveSyncInitDirtyState();
  updateDriveSyncIndicator();
  startDriveSyncTimer();
  driveBackupCheckOnLoad();

  const today = new Date().toISOString().split('T')[0];
  const loggedToday = state.taughtLog.some(t => t.date === today);
  if (!loggedToday && state.students.length > 0) {
    setTimeout(() => toast('✦ Nothing logged today — tap Log Today when ready', 'info'), 2000);
  }

  if (state.students.length === 0) {
    toast('⚠ No student data loaded — check your Sheets connection or update your Apps Script', 'error');
  }
}

function openClassSettings() {
  showView('admin');
  setTimeout(() => {
    const card = document.getElementById('class-settings-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 0);
}

function checkDailyLogBadge() {
  const today = new Date().toISOString().split('T')[0];
  const loggedToday = state.taughtLog.some(t => t.date === today);
  const badge = document.getElementById('daily-log-badge');
  if (badge) badge.style.display = loggedToday ? 'none' : 'inline';
}

function updateStubBadge() {
  const count = getUnresolvedStubCount();
  let badge = document.getElementById('stub-nav-badge');
  const btn = document.getElementById('nav-curriculum');
  if (!btn) return;
  if (count === 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'stub-nav-badge';
    badge.style.cssText = "margin-left:auto;background:var(--rust);color:#fff;font-family:'DM Mono',monospace;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px";
    btn.appendChild(badge);
  }
  badge.textContent = count;
}

function openStubReview() {
  if (state.currentView === 'bulk-assess' && state.bulkAssess) {
    const pending = Object.keys(state.bulkAssess.pendingChanges || {}).length;
    if (pending > 0) {
      if (!confirm(`You have ${pending} unsaved change${pending > 1 ? 's' : ''} in Bulk Assess. Leave without saving?`)) return;
      state.bulkAssess.pendingChanges = {};
    }
  }

  const banner = document.getElementById('stub-nudge-banner');
  if (banner) banner.remove();

  const stubs = state.instructionalComponents.filter(ic =>
    ic.ownerTier === 'teacher_stub' &&
    ic.icReadinessStatus === 'draft'
  ).sort((a, b) => (a.createdAt || '') < (b.createdAt || '') ? -1 : 1);
  if (!stubs.length) return;

  const firstStub = stubs[0];
  const cd = state.curriculumCodes.find(c => c.Code === firstStub.homeDescriptorId);
  if (cd) {
    cdFilters.subject = cd.Subject || 'all';
    cdFilters.year = cd['Year Level'] || 'all';
    cdFilters.strand = 'all';
    cdFilters.search = '';
    cdFilters.sort = 'code';
  }

  setCurrentView('curriculum', { persist: true });
  renderView();

  setTimeout(() => {
    openCodeDetail(firstStub.homeDescriptorId, null);
  }, 80);
}

function checkStubBanner() {
  if (document.getElementById('stub-nudge-banner')) return;
  const oldStubs = state.instructionalComponents.filter(ic =>
    ic.ownerTier === 'teacher_stub' &&
    ic.icReadinessStatus === 'draft'
  );
  if (!oldStubs.length) return;
  const n = oldStubs.length;
  const banner = document.createElement('div');
  banner.id = 'stub-nudge-banner';
  banner.style.cssText = "background:var(--banner-bg);color:var(--banner-text);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:'Instrument Sans',sans-serif;font-size:13px;font-weight:500;";
  banner.innerHTML = `
    <span>You have ${n} draft IC${n !== 1 ? 's' : ''} that need review — click to open the descriptor.</span>
    <div style="display:flex;align-items:center;gap:12px">
      <button onclick="openStubReview()"
        style="padding:4px 12px;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:var(--banner-text);font-size:12px;cursor:pointer;font-family:'Instrument Sans',sans-serif;font-weight:600">
        Review now
      </button>
      <button onclick="document.getElementById('stub-nudge-banner').remove()"
        style="background:none;border:none;color:var(--banner-text);font-size:18px;cursor:pointer;padding:0;line-height:1;opacity:0.7">✕</button>
    </div>`;
  // Insert into body (a flex column) so the banner sits as a slim full-width
  // bar at the top and .app flexes to fill the rest. Inserting into .app (a
  // flex row) would stretch the banner to full height down the left edge.
  document.body.insertBefore(banner, document.body.firstChild);
}

init();
