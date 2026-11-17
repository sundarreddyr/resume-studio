# Resume Studio

[![Check and deploy Resume Studio](https://github.com/sundarreddyr/resume-studio/actions/workflows/pages.yml/badge.svg)](https://github.com/sundarreddyr/resume-studio/actions/workflows/pages.yml)

A browser-based resume editor with a live, paginated preview and downloadable, editable PDFs. Built with HTML, CSS and JavaScript; no server, paid hosting or build step is required.

- [Open Resume Studio](https://sundarreddyr.github.io/resume-studio/)
- [Open the corrected November 17 resume](https://sundarreddyr.github.io/resume-studio/?resume=2026-11-17-corrected)

## Features

- Company → roles → projects, with optional entity names and independent company/entity links.
- Role-first headings with dates on the same row.
- Bold, italic and clickable links; editable skills, education and contact details.
- Local autosave, undo/redo, section controls and portable JSON backups.
- Text-based PDF export with embedded editable resume data for later re-import.

## Local development

Use Node.js 24 or later and Python 3. There are no npm dependencies to install.

```sh
npm test
npm start
```

Open http://localhost:8000/. Static assets use relative paths so the site also works under GitHub Pages' `/resume-studio/` path.

## CI/CD

`.github/workflows/pages.yml` runs on pull requests, pushes to `main`, and manual dispatches. It checks JavaScript syntax, relative asset paths, resume migrations, optional entities, links, formatting, pagination, and PDF/JSON round trips. Successful `main` runs upload `dist/` and deploy it to the `github-pages` environment using GitHub's official Pages actions and short-lived workflow credentials. Pull requests run checks without deploying. No personal access token or deployment secret is needed.

One-time repository setup: **Settings → Pages → Build and deployment → Source → GitHub Actions**. Once enabled, pushes to `main` deploy automatically. Re-run the workflow after changing this setting if the first deployment ran before Pages was enabled.

## Data and privacy

This public repository includes the owner's resume template and its public professional/contact information, reference PDF and reference images. Browser edits and uploaded resumes are processed locally; they are not committed back to GitHub or synced across devices. Export PDF or JSON to move your work between devices. The corrected-resume link uses its own local draft, preserving edits made at the ordinary site URL.

## Project layout

- `dist/`: published app, fonts, vendored PDF library and resume assets.
- `fixtures/`: backward-compatibility resume fixtures.
- `check*.mjs`, `scripts/`: automated validation; generated test files stay in ignored `tmp/`.
- `AGENTS.md`: project behavior and editing requirements.

The vendored PDF library's license is included at `dist/assets/pdf-lib-LICENSE.md`.
