# ClassTracker

ClassTracker is a browser-based classroom planning and mastery tracking tool for Australian Curriculum v9 (P–6) teachers.

It helps teachers:

- plan learning using Instructional Components (ICs)
- record what has been taught
- capture lightweight mastery evidence
- identify what to teach next

The app is a static front end (`index.html`, `styles.css`, `app.js`) that runs directly in the browser via GitHub Pages.

## Live URL

```
https://chriswhite3140.github.io/Claude-Split
```

## Repo structure

- `index.html` — main entry point and UI shell
- `app.js` — all application logic (vanilla JS)
- `styles.css` — all styling
- `docs/` — authoritative design documents (read before making changes)
- `data/` — curriculum source files (CSV)
- `.github/` — Claude Code workflows and issue templates

## Design documents

| File | Purpose |
|---|---|
| `docs/MASTER-PROJECT-SUMMARY.md` | Product overview and build strategy |
| `docs/PRODUCT-RULES-DOCUMENT.md` | Rules — check before every feature |
| `docs/DATA-SCHEMA-DOCUMENT.md` | All data structures and relationships |
| `docs/IC-FRAMEWORK-SPEC.md` | IC generation rules and ownership model |
| `docs/IC-GENERATION-PROMPT-TEMPLATE.md` | AI prompt template for generating system default ICs |

## Data files

| File | Purpose |
|---|---|
| `data/acara_maths_f6_elaborations_v3.csv` | AC v9 Maths F–6 content descriptors with elaborations (rebuilt from official ACARA PDF) |

## Backend

Google Apps Script connects to Google Sheets for data storage. The frontend communicates with it via fetch calls to a deployed Apps Script URL configured in `app.js`.

## Development workflow

Changes are implemented via Claude Code GitHub Actions. Create a GitHub issue using the `claude-task` template and trigger with `@claude`.
