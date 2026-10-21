# ✅ Darkflow implementation worklist

The goal is a programmable local control panel: configure each repository, describe a task and acceptance criteria, prepare a change, run project checks, inspect all evidence, and explicitly apply only the reviewed result.

## Foundation in this pass

- [x] Place the app under `Cybercore/tooling/darkflow` and connect its project identity to `cybercoretech/darkflow`.
- [x] Use `darkflow.conf` as structured project configuration.
- [x] Keep `DARKFLOW.md` human-readable and distinct from machine configuration.
- [x] Create a Tauri 2 + Rust + React + Vite desktop shell.
- [x] Add a cyber-themed control panel with task, acceptance criteria, path scope, provider, network, profile, proposal, and telemetry surfaces.
- [x] Add a keyboard command palette (`cmdk`) and reduced-motion support.
- [x] Add Tailwind CSS 4, Motion for React, Radix primitives, and Lucide icons.
- [x] Implement Rust-side project inspection and `darkflow.conf` parsing.
- [x] Add explicit review then save for request records in private app data.
- [x] Define local-only monitoring and explicit review/apply rules in docs.
- [x] Create ten dark neon logo/background directions for visual review.
- [x] Use direction 01 as a clearly provisional app icon so the desktop bundle can build.
- [x] Add README, architecture, security, configuration, telemetry, roadmap, and update docs.
- [x] Run default and optional-feature Rust tests and build Linux Debian/RPM bundles.

## Workflow engine — required before real code edits

- [ ] Capture original worktree status and immutable base commit.
- [ ] Create disposable isolated Git worktrees per proposal; clean them on discard.
- [ ] Integrate Codex CLI through a provider adapter with network disabled by default.
- [ ] Validate allowed, excluded, and protected paths before and after generation.
- [ ] Display exact commands, environment, cwd, timeout, and network policy before running checks.
- [ ] Stream check output with cancellation and bounded output retention.
- [ ] Render complete file list and unified diff, including rename/deletion/binary details.
- [ ] Detect a stale original worktree and require a fresh review.
- [ ] Apply only the reviewed diff with atomic backups and a recoverable result.
- [ ] Ensure apply does not commit, push, or deploy.
- [ ] Add integration tests for malicious paths, stale baseline, failed checks, and patch boundaries.

## Control panel and telemetry

- [ ] Persist recent projects and UI preferences locally via Tauri Store.
- [ ] Add real proposal lifecycle counts, check durations, pass/fail trends, and provider health.
- [ ] Add retention controls, clear-local-history, and privacy-safe diagnostic export.
- [ ] Keep prompts, source, paths, diffs, and raw command output out of telemetry events.
- [ ] Add profile editor with validation, import/export, and schema version warnings.

## Brand and UI

- [x] Prepare a ten-option concept board with distinct Darkflow emblem/background directions.
- [ ] Select one direction with the user before producing final logo assets.
- [ ] Redraw the selected mark in SVG and derive PNG/ICO variants only after approval.
- [ ] Refine keyboard accessibility, responsive behavior, and native platform polish.
- [ ] Verify reduced motion, screen-reader labels, keyboard-only navigation, and contrast.

## Tooling decisions

- [x] Integrate React command palette with `cmdk`.
- [x] Use Vite React Fast Refresh and Tauri's development WebView inspector.
- [x] Use `tracing` for local Rust operation spans.
- [ ] Add `tauri-specta` after command contracts stabilize.
- [ ] Evaluate `diagprint` for actionable diagnostic reports.
- [x] Add optional `image` + `resvg` asset-tool dependencies for a later preview/fix feature.
- [x] Add optional Taffy layout experiment without routing the HTML UI through it.
- [x] Keep Taffy out of Tauri HTML/CSS layout; reconsider only for a Rust-rendered canvas UI.
- [x] Avoid an external devtools server until it can be constrained to loopback with suitable licensing/platform support.
