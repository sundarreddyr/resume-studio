# Resume Studio

Continue the buildless Resume Studio in dist/. This repository is public and publishes dist/ to GitHub Pages using .github/workflows/pages.yml. Keep all asset paths relative so /resume-studio/ works. Run npm test before publishing. Do not introduce a build dependency without a clear need.

Latest approved design: Company -> Role entries -> Projects -> Bullets. Entity is optional metadata on each role: entityName and entityUrl. Show "Role - Entity" and the role dates on one compact row; a blank/whitespace entity name means the role belongs directly to the parent company, with no empty heading, link, delimiter or gap. Only the entity name receives its entity hyperlink; the company retains its independent hyperlink.

Data version 4 flattens version-3 nested entities into company.roles. Keep entityDates, entityLocation and entityStack metadata on roles so migration/import/export is lossless. Entity tenure and location are saved, not printed as extra date/header rows. The editor keeps these metadata fields under Additional entity details. Preserve the order and all projects/bullets/URLs/formatting while flattening. normalizeResume accepts flat older drafts and nested v3 drafts. groupSpecbeeExperience applies only to pre-v3 saved/imported data, followed by flattenCompanyEntities. Never force regrouping of v3/v4 drafts after intentional user edits.

The November 17 upload supplies the seed: parent Specbee, Apr 2022 - Oct 2026, with Trumetric.AI and Livine roles. Lumen remains separate. These are user-supplied employment corrections. No other profiles or portfolio site were modified.

Keep SVG preview, PDF, JSON backups and embedded PDF attachments consistent. Preserve import, autosave, undo/redo, confirmations, bold/italic, inline links, and hiding unnamed project headings. Never overwrite an existing browser draft with seed automatically.

Regression fixtures: fixtures/original-seed.json (original template); fixtures/nested-seed-v3.json (nested entity version). check-entities.mjs verifies migrations, blank entity fallback, same-row dates, independent hyperlinks, PDF/JSON round trips, and pagination. Run affected check scripts and node --check on changed JS; visually inspect rendered PDFs for clipping and hierarchy.

November 17 spelling/contact update: seed is taken from the attached Sundar_Reddy_R_Resume(1).pdf, preserving its projects and employment dates. Use full name Sundar Kumar Reddy Rachepalli, optional personal.location, visible portfolio address, expanded RAG/MCP and degree names, and corrected technical spellings. Role precedes optional entity; no entity means no delimiter or entity link. The explicit ?resume=2026-11-17-corrected link opens assets/resume-2026-11-17-corrected.json in its own browser storage key, preserving the ordinary draft. Keep this reviewed snapshot immutable in future seed updates.
