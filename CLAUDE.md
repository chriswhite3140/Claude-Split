# CLAUDE.md – ClassTracker Project Context

## What this project is

ClassTracker is a browser-based classroom planning and assessment tool for Australian Curriculum (P–6) teachers. It is built with vanilla JavaScript, HTML, and CSS. There is no build step. It runs directly in the browser via GitHub Pages.

## Repo structure

- `index.html` – main entry point and UI shell
- `app.js` – all application logic (vanilla JS)
- `styles.css` – all styling
- `.github/workflows/claude.yml` – Claude Code GitHub Actions workflow

## Backend

Google Apps Script connects to Google Sheets for data storage. The frontend communicates with it via fetch calls to a deployed Apps Script URL.

## Key conventions

- Vanilla JavaScript only — no frameworks, no npm, no build tools
- All logic lives in `app.js`
- Keep changes small and focused — one problem at a time
- Always preserve existing functionality when making changes
- The app is used by teachers — UI must be clear, low friction, and practical

## Current focus area

The Planner module. Key features already built:
- Add, edit, delete, duplicate lessons
- Drag and drop between day columns
- Week navigation with persistence
- Inline card editing
- Copy lesson to another day or week

## Current known issue

The subject dropdown in the lesson drawer does not show the full subject list. The control works but its data source is incomplete.

## Testing

Test by opening the GitHub Pages URL in a browser. Hard refresh (Ctrl+Shift+R) when testing after changes to avoid cache issues.

## Planning docs
See `docs/` for the current roadmap and feature specs. Consult these before making planner changes.

