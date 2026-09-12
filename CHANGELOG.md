# Changelog

## Browser demo — 2026-09-13 (after v0.2.0)

- Add an installation-free browser snapshot comparison with explicit encoding selection, composite keys, paginated differences and full JSON/HTML downloads.
- Generate browser-safe comparison/report functions directly from the unchanged CLI sources; `node build-web-core.mjs --check` detects drift.
- Process bounded files in terminable module workers. Replacing files, changing keys, clearing or cancelling invalidates stale work and reports. Preserve per-file read errors when two files finish in a different order.
- Add synthetic browser regression checks and a custom-work contact route. No customer deployment, orders or earnings are implied.
- The v0.2.0 tag and downloadable archive remain unchanged; the web demo is served from the current main branch.

## v0.2.0 — 2026-09-13

- Include the printable HTML snapshot report, explicit CSV encoding converter and n8n snapshot workflow in one tagged release.
- The one-command demo now generates `changes.html` alongside the existing audit report and JSON differences.
- Provide a release ZIP with pre-generated synthetic reports, plus the standalone n8n workflow and archive checksums.
- Consolidate the README so download instructions match the released features.

The n8n execution record comes from the actual 2026-09-13 CLI run on n8n 2.38.7 / Node.js 24.19.0 / Windows x64. Verifying that record is distinct from starting a new n8n execution. No production deployment or client sale is claimed.

## v0.1.0 — 2026-09-09

Initial local merge/deduplication, data audit, JSON snapshot comparison and synthetic delivery demo.
