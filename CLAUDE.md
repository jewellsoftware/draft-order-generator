# CLAUDE.md

Random Draft Order Generator: a static site hosted on GitHub Pages from the root of `main`.

## Constraints

- No build step, no frameworks, no dependencies. Plain `index.html`, `style.css`, `app.js` served as-is.
- Everything runs client-side. Never add anything that needs a server or a secret (API keys would be public).
- `.nojekyll` stays so Pages serves files untouched.

## Structure

- `index.html`: a single `<form id="wizard">` with one `<section class="step" data-step="N">` per step.
- `app.js`: wizard state and logic.
  - `league` holds collected data; it is saved to `localStorage` under `STORAGE_KEY`.
  - `validators[N]()` validates step N, copies its inputs into `league`, and returns
    `{ message, input }` on error or `null` when valid.
  - `render()` shows the current step and handles the progress text and Back/Next buttons.
- `style.css`: colors are CSS variables on `:root`, redefined for dark mode via `prefers-color-scheme`.

## Adding a step

1. Add `<section class="step" data-step="N" hidden>` to the form in `index.html`.
2. Add `validators[N]` in `app.js` and store results on `league`.

## Conventions

- If the saved `league` shape changes incompatibly, bump the version suffix on `STORAGE_KEY`
  rather than writing migrations.
- League name: a blank box or an unedited dice roll counts as a suggestion (`league.nameSuggested`)
  and is restored as the placeholder, never as typed text.
- Team count: preset radio chips plus an "Other" number input; whichever was set last wins.
  Limits are `MIN_TEAMS`/`MAX_TEAMS`.

## Checking changes

`node --check app.js` for syntax, then open `index.html` or run `python -m http.server 8000`.
