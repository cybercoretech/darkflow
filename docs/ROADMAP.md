# 🗺️ Roadmap

## Phase 1 — Project control panel

- [x] Establish Tauri + Rust + React desktop foundation.
- [x] Separate `darkflow.conf` policy from `DARKFLOW.md` human workflow docs.
- [x] Define local telemetry metrics and explicit review contract.
- [x] Load and parse a selected project's config; report invalid TOML.
- [x] Configure a change request's task, acceptance criteria, allowed paths, provider, and network preference in the UI.
- [x] Review and save a request packet to local app data without changing project source.
- [x] Show local session events and activity telemetry.

## Phase 2 — Safe proposal workflow

- [x] Create a detached proposal worktree and capture base commit/status; block dirty trees by default.
- [ ] Run Codex CLI behind a provider interface in that worktree.
- [ ] Execute configured checks with timeout, cancellation, and visible output.
- [ ] Render unified diff, file tree, risk labels, and telemetry before apply.
- [ ] Reject stale or out-of-scope proposals; support review notes and discard.
- [ ] Apply only reviewed patch hunks to the original tree.

## Phase 3 — Reusable project templates

- [ ] Versioned presets for Rust, Tauri, React, static web, and Cloudflare Workers.
- [ ] Config editor with schema validation and a generated `DARKFLOW.md` starter.
- [ ] Check history, project health, and local telemetry retention controls.
- [ ] Optional diagprint diagnostic reports and resvg-based SVG previews.

## Phase 4 — Integrations and distribution

- [ ] tauri-specta generated bindings after the backend API stabilizes.
- [ ] Provider adapters for additional local agents.
- [ ] Platform packaging, signing, update flow, and documented permissions.

## Verified foundation

- [x] Run Rust unit tests, including optional `asset-tools` and `native-layout-experiment` features.
- [x] Build Linux Debian and RPM desktop bundles.
